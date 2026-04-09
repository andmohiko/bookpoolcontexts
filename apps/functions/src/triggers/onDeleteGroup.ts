import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import { removeGroupFromAllBooksOperation } from '~/infrastructure/firestore/books'
import { triggerOnce } from '~/utils/triggerOnce'

export const onDeleteGroup = onDocumentDeleted(
  {
    document: 'users/{uid}/groups/{groupId}',
    region: 'asia-northeast1',
  },
  triggerOnce('onDeleteGroup', async (event) => {
    if (!event.data) return

    const { uid, groupId } = event.params
    const data = event.data.data()
    const groupLabel = data.label as string

    if (!groupLabel) {
      console.warn('削除されたグループにラベルがありません:', groupId)
      return
    }

    try {
      await removeGroupFromAllBooksOperation(uid, groupLabel)
      console.log('グループ削除に伴う本の更新が完了しました:', groupId, groupLabel)
    } catch (error) {
      console.error('グループ削除時の本の更新に失敗:', groupId, error)
      throw error
    }
  }),
)
