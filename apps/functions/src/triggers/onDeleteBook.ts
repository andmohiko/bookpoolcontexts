import { FieldValue } from 'firebase-admin/firestore'
import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import { updateGroupByLabelOperation } from '~/infrastructure/firestore/groups'
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
    const groups: string[] = data.groups ?? []

    if (groups.length === 0) return

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
  }),
)
