import { useState } from 'react'
import { toast } from 'sonner'
import type { BookId } from '@bookpoolcontexts/common'
import { deleteBookOperation } from '@/infrastructure/firestore/books'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseDeleteBookMutationReturn = {
  deleteBook: (bookId: BookId) => Promise<void>
  isDeleting: boolean
}

export const useDeleteBookMutation = (): UseDeleteBookMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isDeleting, setIsDeleting] = useState(false)

  const deleteBook = async (bookId: BookId): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    setIsDeleting(true)
    try {
      await deleteBookOperation(uid, bookId)
      toast.success('本を削除しました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsDeleting(false)
    }
  }

  return { deleteBook, isDeleting }
}
