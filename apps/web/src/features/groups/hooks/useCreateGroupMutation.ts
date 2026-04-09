import { useState } from 'react'
import { toast } from 'sonner'
import type { CreateGroupDto } from '@bookpoolcontexts/common'
import { createGroupOperation } from '@/infrastructure/firestore/groups'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { serverTimestamp } from '@/lib/firebase'
import { errorMessage } from '@/utils/errorMessage'

export type CreateGroupInput = {
  label: string
}

export type UseCreateGroupMutationReturn = {
  createGroup: (input: CreateGroupInput) => Promise<void>
  isCreating: boolean
}

export const useCreateGroupMutation = (): UseCreateGroupMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isCreating, setIsCreating] = useState(false)

  const createGroup = async (input: CreateGroupInput): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    setIsCreating(true)
    try {
      const dto: CreateGroupDto = {
        label: input.label,
        count: 0,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      }
      await createGroupOperation(uid, dto)
      toast.success('グループを作成しました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsCreating(false)
    }
  }

  return { createGroup, isCreating }
}
