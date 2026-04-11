import type { BookId, UpdateBookDto } from '@bookpoolcontexts/common'
import { useState } from 'react'
import { toast } from 'sonner'

import { updateBookOperation } from '@/infrastructure/firestore/books'
import { serverTimestamp } from '@/lib/firebase'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseRefetchBookMutationReturn = {
  refetchBook: (bookId: BookId) => Promise<void>
  isRefetching: boolean
}

/**
 * 本の情報をAmazonから再フェッチする
 * @description scrapingStatusを'scraping'に更新することで、onUpdateBookトリガーが再度スクレイピングを実行する
 */
export const useRefetchBookMutation = (): UseRefetchBookMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isRefetching, setIsRefetching] = useState(false)

  const refetchBook = async (bookId: BookId): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    setIsRefetching(true)
    try {
      const dto: UpdateBookDto = {
        scrapingStatus: 'scraping',
        updatedAt: serverTimestamp,
        updatedBy: 'user' as const,
      }
      await updateBookOperation(uid, bookId, dto)
      toast.success('本の情報を再取得しています')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsRefetching(false)
    }
  }

  return { refetchBook, isRefetching }
}
