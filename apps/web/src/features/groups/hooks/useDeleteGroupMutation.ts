import { useState } from 'react'
import { toast } from 'sonner'
import type { GroupId } from '@bookpoolcontexts/common'
import { deleteGroupOperation } from '@/infrastructure/firestore/groups'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseDeleteGroupMutationReturn = {
  deleteGroup: (groupId: GroupId) => Promise<void>
  isDeleting: boolean
}

export const useDeleteGroupMutation = (): UseDeleteGroupMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isDeleting, setIsDeleting] = useState(false)

  const deleteGroup = async (groupId: GroupId): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    setIsDeleting(true)
    try {
      await deleteGroupOperation(uid, groupId)
      toast.success('グループを削除しました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsDeleting(false)
    }
  }

  return { deleteGroup, isDeleting }
}
