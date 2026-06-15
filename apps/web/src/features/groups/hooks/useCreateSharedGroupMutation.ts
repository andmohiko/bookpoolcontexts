import type {
  CreateSharedGroupDto,
  Group,
  SharedBook,
} from '@bookpoolcontexts/common'
import { useState } from 'react'
import { toast } from 'sonner'
import { fetchAllBooksByGroupOperation } from '@/infrastructure/firestore/books'
import { createSharedGroupOperation } from '@/infrastructure/firestore/sharedGroups'
import { serverTimestamp } from '@/lib/firebase'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseCreateSharedGroupMutationReturn = {
  createSharedGroup: (group: Group) => Promise<void>
  isCreating: boolean
}

export const useCreateSharedGroupMutation =
  (): UseCreateSharedGroupMutationReturn => {
    const { uid } = useFirebaseAuthContext()
    const [isCreating, setIsCreating] = useState(false)

    const createSharedGroup = async (group: Group): Promise<void> => {
      if (!uid) throw new Error('認証エラー：再ログインしてください')
      setIsCreating(true)
      try {
        const books = await fetchAllBooksByGroupOperation(uid, group.label)
        const sharedBooks: SharedBook[] = books.map((book) => ({
          title: book.title,
          author: book.author,
          coverImageUrl: book.coverImageUrl,
          tags: book.tags,
          amazonUrl: book.amazonUrl,
        }))

        const dto: CreateSharedGroupDto = {
          uid,
          groupId: group.groupId,
          groupLabel: group.label,
          books: sharedBooks,
          createdAt: serverTimestamp,
          updatedAt: serverTimestamp,
        }
        const sharedGroupId = await createSharedGroupOperation(dto)

        const url = `${window.location.origin}/shared/${sharedGroupId}`
        await navigator.clipboard.writeText(url)
        toast.success('共有リンクを作成し、クリップボードにコピーしました')
      } catch (e) {
        toast.error(errorMessage(e))
        throw e
      } finally {
        setIsCreating(false)
      }
    }

    return { createSharedGroup, isCreating }
  }
