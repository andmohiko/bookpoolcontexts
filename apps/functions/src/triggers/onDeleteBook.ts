import { normalizeTagLabel } from '@bookpoolcontexts/common'
import { FieldValue } from 'firebase-admin/firestore'
import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import { updateGroupByLabelOperation } from '~/infrastructure/firestore/groups'
import {
  deleteTagOperation,
  fetchTagByLabelOperation,
  updateTagOperation,
} from '~/infrastructure/firestore/tags'
import { serverTimestamp } from '~/lib/firebase'
import { triggerOnce } from '~/utils/triggerOnce'

export const onDeleteBook = onDocumentDeleted(
  {
    document: 'users/{uid}/books/{bookId}',
    region: 'asia-northeast1',
  },
  triggerOnce('onDeleteBook', async (event) => {
    if (!event.data) return

    const { uid, bookId } = event.params
    const data = event.data.data()

    // ===== グループ count 同期 =====
    const groups: string[] = data.groups ?? []
    if (groups.length > 0) {
      for (const groupLabel of groups) {
        try {
          await updateGroupByLabelOperation(uid, groupLabel, {
            count: FieldValue.increment(-1),
            updatedAt: serverTimestamp,
          })
        } catch (error) {
          console.error(
            'グループカウントのデクリメントに失敗:',
            groupLabel,
            error,
          )
        }
      }
      console.log(
        '本の削除に伴いグループカウントを更新しました:',
        bookId,
        groups,
      )
    }

    // ===== タグ count 同期 =====
    const rawTags: string[] = data.tags ?? []
    const tags = Array.from(
      new Set(
        rawTags.map((t) => normalizeTagLabel(t)).filter((t) => t !== ''),
      ),
    )
    if (tags.length > 0) {
      for (const label of tags) {
        try {
          const existing = await fetchTagByLabelOperation(uid, label)
          if (!existing) continue
          if (existing.count <= 1) {
            await deleteTagOperation(uid, existing.tagId)
          } else {
            await updateTagOperation(uid, existing.tagId, {
              count: FieldValue.increment(-1),
              updatedAt: serverTimestamp,
            })
          }
        } catch (error) {
          console.error('タグカウントのデクリメントに失敗:', label, error)
        }
      }
      console.log('本の削除に伴いタグカウントを更新しました:', bookId, tags)
    }
  }),
)
