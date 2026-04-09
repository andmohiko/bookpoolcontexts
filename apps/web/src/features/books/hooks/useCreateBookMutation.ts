import { useState } from 'react'
import { toast } from 'sonner'
import type { CreateBookDto } from '@bookpoolcontexts/common'
import { createBookOperation } from '@/infrastructure/firestore/books'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { serverTimestamp } from '@/lib/firebase'
import { errorMessage } from '@/utils/errorMessage'

export type CreateBookInput = {
  amazonUrl: string
  tags: string[]
  foundBy: string
  location: string
  purchasedBy: string[]
  groups: string[]
  note: string
}

export type UseCreateBookMutationReturn = {
  createBook: (input: CreateBookInput) => Promise<void>
  isCreating: boolean
}

export const useCreateBookMutation = (): UseCreateBookMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isCreating, setIsCreating] = useState(false)

  const createBook = async (input: CreateBookInput): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    setIsCreating(true)
    try {
      const dto: CreateBookDto = {
        ...input,
        title: null,
        author: null,
        coverImageUrl: null,
        pages: null,
        isRead: false,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      }
      await createBookOperation(uid, dto)
      toast.success('本を登録しました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsCreating(false)
    }
  }

  return { createBook, isCreating }
}
