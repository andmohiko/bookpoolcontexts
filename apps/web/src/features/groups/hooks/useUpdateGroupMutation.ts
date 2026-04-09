import { useState } from 'react'
import { toast } from 'sonner'
import type { GroupId, UpdateGroupDto } from '@bookpoolcontexts/common'
import { updateGroupOperation } from '@/infrastructure/firestore/groups'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { serverTimestamp } from '@/lib/firebase'
import { errorMessage } from '@/utils/errorMessage'

export type UpdateGroupInput = {
  label: string
}

export type UseUpdateGroupMutationReturn = {
  updateGroup: (groupId: GroupId, input: UpdateGroupInput) => Promise<void>
  isUpdating: boolean
}

export const useUpdateGroupMutation = (): UseUpdateGroupMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isUpdating, setIsUpdating] = useState(false)

  const updateGroup = async (
    groupId: GroupId,
    input: UpdateGroupInput,
  ): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    setIsUpdating(true)
    try {
      const dto: UpdateGroupDto = {
        label: input.label,
        updatedAt: serverTimestamp,
      }
      await updateGroupOperation(uid, groupId, dto)
      toast.success('グループを更新しました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsUpdating(false)
    }
  }

  return { updateGroup, isUpdating }
}
