import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import { removeGroupFromAllBooksOperation } from '~/infrastructure/firestore/books'
import {
  deleteSharedGroupOperation,
  fetchSharedGroupsByGroupIdOperation,
} from '~/infrastructure/firestore/sharedGroups'
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

    // 共有グループも削除
    try {
      const sharedGroups = await fetchSharedGroupsByGroupIdOperation(
        uid,
        groupId,
      )
      for (const sg of sharedGroups) {
        await deleteSharedGroupOperation(sg.sharedGroupId)
      }
      if (sharedGroups.length > 0) {
        console.log(
          'グループ削除に伴い共有グループを削除しました:',
          groupId,
        )
      }
    } catch (error) {
      console.error(
        'グループ削除時の共有グループ削除に失敗:',
        groupId,
        error,
      )
      throw error
    }
  }),
)
