import type { SharedGroupId } from '@bookpoolcontexts/common'
import { useState } from 'react'
import { toast } from 'sonner'
import { deleteSharedGroupOperation } from '@/infrastructure/firestore/sharedGroups'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseDeleteSharedGroupMutationReturn = {
  deleteSharedGroup: (sharedGroupId: SharedGroupId) => Promise<void>
  isDeleting: boolean
}

export const useDeleteSharedGroupMutation =
  (): UseDeleteSharedGroupMutationReturn => {
    const { uid } = useFirebaseAuthContext()
    const [isDeleting, setIsDeleting] = useState(false)

    const deleteSharedGroup = async (
      sharedGroupId: SharedGroupId,
    ): Promise<void> => {
      if (!uid) throw new Error('認証エラー：再ログインしてください')
      setIsDeleting(true)
      try {
        await deleteSharedGroupOperation(sharedGroupId)
        toast.success('共有を解除しました')
      } catch (e) {
        toast.error(errorMessage(e))
        throw e
      } finally {
        setIsDeleting(false)
      }
    }

    return { deleteSharedGroup, isDeleting }
  }
