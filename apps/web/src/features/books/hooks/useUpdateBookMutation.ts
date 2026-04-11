import { useState } from 'react'
import { toast } from 'sonner'
import type { BookId, UpdateBookDto } from '@bookpoolcontexts/common'
import { updateBookOperation } from '@/infrastructure/firestore/books'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { serverTimestamp } from '@/lib/firebase'
import { errorMessage } from '@/utils/errorMessage'

export type UpdateBookInput = {
  tags: string[]
  foundBy: string
  location: string
  purchasedBy: string[]
  groups: string[]
  note: string
  isRead: boolean
}

export type UseUpdateBookMutationReturn = {
  updateBook: (bookId: BookId, input: UpdateBookInput) => Promise<void>
  isUpdating: boolean
}

export const useUpdateBookMutation = (): UseUpdateBookMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isUpdating, setIsUpdating] = useState(false)

  const updateBook = async (bookId: BookId, input: UpdateBookInput): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    setIsUpdating(true)
    try {
      const dto: UpdateBookDto = {
        ...input,
        updatedAt: serverTimestamp,
        updatedBy: 'user' as const,
      }
      await updateBookOperation(uid, bookId, dto)
      toast.success('本の情報を更新しました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsUpdating(false)
    }
  }

  return { updateBook, isUpdating }
}
