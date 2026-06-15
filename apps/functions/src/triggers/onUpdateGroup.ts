import { FieldValue } from 'firebase-admin/firestore'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import {
  fetchSharedGroupsByGroupIdOperation,
  updateSharedGroupOperation,
} from '~/infrastructure/firestore/sharedGroups'
import { triggerOnce } from '~/utils/triggerOnce'

export const onUpdateGroup = onDocumentUpdated(
  {
    document: 'users/{uid}/groups/{groupId}',
    region: 'asia-northeast1',
  },
  triggerOnce('onUpdateGroup', async (event) => {
    if (!event.data) return

    const { uid, groupId } = event.params
    const before = event.data.before.data()
    const after = event.data.after.data()

    const beforeLabel = before.label as string
    const afterLabel = after.label as string

    // label が変更された場合のみ sharedGroups を同期
    if (beforeLabel === afterLabel) return

    try {
      const sharedGroups = await fetchSharedGroupsByGroupIdOperation(
        uid,
        groupId,
      )
      if (sharedGroups.length === 0) return

      for (const sg of sharedGroups) {
        await updateSharedGroupOperation(sg.sharedGroupId, {
          groupLabel: afterLabel,
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
      console.log(
        'グループ名変更に伴い共有グループを同期しました:',
        groupId,
        afterLabel,
      )
    } catch (error) {
      console.error(
        'グループ名変更時の共有グループ同期に失敗:',
        groupId,
        error,
      )
      throw error
    }
  }),
)
