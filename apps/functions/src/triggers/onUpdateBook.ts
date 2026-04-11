import { normalizeTagLabel } from '@bookpoolcontexts/common'
import { FieldValue } from 'firebase-admin/firestore'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import { updateGroupByLabelOperation } from '~/infrastructure/firestore/groups'
import {
  createTagOperation,
  deleteTagOperation,
  fetchTagByLabelOperation,
  updateTagOperation,
} from '~/infrastructure/firestore/tags'
import { serverTimestamp } from '~/lib/firebase'
import { triggerOnce } from '~/utils/triggerOnce'

/** タグ配列を正規化 + 重複除去する */
const normalizeTagList = (tags: string[]): string[] =>
  Array.from(
    new Set(tags.map((t) => normalizeTagLabel(t)).filter((t) => t !== '')),
  )

export const onUpdateBook = onDocumentUpdated(
  {
    document: 'users/{uid}/books/{bookId}',
    region: 'asia-northeast1',
  },
  triggerOnce('onUpdateBook', async (event) => {
    if (!event.data) return

    const { uid, bookId } = event.params
    const before = event.data.before.data()
    const after = event.data.after.data()

    // トリガーによる更新なら処理をスキップ（連鎖発火防止）
    if (after.updatedBy === 'trigger') {
      console.log('トリガーによる更新のためスキップ:', bookId)
      return
    }

    // ===== グループ count 差分同期 =====
    const beforeGroups: string[] = before.groups ?? []
    const afterGroups: string[] = after.groups ?? []
    const groupsChanged =
      JSON.stringify([...beforeGroups].sort()) !==
      JSON.stringify([...afterGroups].sort())

    if (groupsChanged) {
      const addedGroups = afterGroups.filter((g) => !beforeGroups.includes(g))
      const removedGroups = beforeGroups.filter(
        (g) => !afterGroups.includes(g),
      )

      // 追加されたグループの count をインクリメント
      for (const groupLabel of addedGroups) {
        try {
          await updateGroupByLabelOperation(uid, groupLabel, {
            count: FieldValue.increment(1),
            updatedAt: serverTimestamp,
          })
        } catch (error) {
          console.error(
            'グループカウントのインクリメントに失敗:',
            groupLabel,
            error,
          )
        }
      }

      // 除去されたグループの count をデクリメント
      for (const groupLabel of removedGroups) {
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

      console.log('グループカウントを同期しました:', bookId, {
        added: addedGroups,
        removed: removedGroups,
      })
    }

    // ===== タグ count 差分同期 =====
    const beforeTags = normalizeTagList(before.tags ?? [])
    const afterTags = normalizeTagList(after.tags ?? [])
    const tagsChanged =
      JSON.stringify([...beforeTags].sort()) !==
      JSON.stringify([...afterTags].sort())

    if (tagsChanged) {
      const addedTags = afterTags.filter((t) => !beforeTags.includes(t))
      const removedTags = beforeTags.filter((t) => !afterTags.includes(t))

      // 追加されたタグの count をインクリメント（存在しなければ新規作成）
      for (const label of addedTags) {
        try {
          const existing = await fetchTagByLabelOperation(uid, label)
          if (existing) {
            await updateTagOperation(uid, existing.tagId, {
              count: FieldValue.increment(1),
              updatedAt: serverTimestamp,
            })
          } else {
            await createTagOperation(uid, {
              label,
              count: 1,
              createdAt: serverTimestamp,
              updatedAt: serverTimestamp,
            })
          }
        } catch (error) {
          console.error('タグカウントのインクリメントに失敗:', label, error)
        }
      }

      // 除去されたタグの count をデクリメント（count<=1 ならドキュメント削除）
      for (const label of removedTags) {
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

      console.log('タグカウントを同期しました:', bookId, {
        added: addedTags,
        removed: removedTags,
      })
    }
  }),
)
