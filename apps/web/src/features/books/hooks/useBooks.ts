import { useCallback, useEffect, useRef, useState } from 'react'
import type { Book } from '@bookpoolcontexts/common'
import type { DocumentSnapshot } from 'firebase/firestore'
import {
  type FetchResultWithPagination,
  PAGE_SIZE,
  fetchBooksOperation,
  subscribeBooksOperation,
} from '@/infrastructure/firestore/books'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseBooksReturn = {
  books: Array<Book>
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  loadMore: () => Promise<void>
}

export const useBooks = (tag?: string): UseBooksReturn => {
  const { uid } = useFirebaseAuthContext()
  const [firstPageBooks, setFirstPageBooks] = useState<Array<Book>>([])
  const [additionalBooks, setAdditionalBooks] = useState<Array<Book>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastDocRef = useRef<DocumentSnapshot | null>(null)

  // 最初のページをリアルタイム購読
  useEffect(() => {
    if (!uid) return

    setIsLoading(true)
    setAdditionalBooks([])
    lastDocRef.current = null

    if (tag) {
      // タグフィルタ時はfetchで取得（subscribeはタグフィルタ非対応のため）
      fetchBooksOperation(uid, PAGE_SIZE, null, tag)
        .then((result: FetchResultWithPagination<Book>) => {
          setFirstPageBooks(result.items)
          lastDocRef.current = result.lastDoc
          setHasMore(result.hasMore)
          setIsLoading(false)
        })
        .catch((e: unknown) => {
          setError(errorMessage(e))
          setIsLoading(false)
        })
      return
    }

    const unsubscribe = subscribeBooksOperation(uid, PAGE_SIZE, (books) => {
      setFirstPageBooks(books)
      setHasMore(books.length === PAGE_SIZE)
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [uid, tag])

  const loadMore = useCallback(async (): Promise<void> => {
    if (!uid || !hasMore || isLoadingMore) return

    setIsLoadingMore(true)
    try {
      const allBooks = [...firstPageBooks, ...additionalBooks]
      const lastDoc = lastDocRef.current ?? null
      // lastDocがない場合はfetchで最初のページ末尾を基準にする
      const result = await fetchBooksOperation(
        uid,
        PAGE_SIZE,
        lastDoc,
        tag,
      )
      setAdditionalBooks((prev) => [...prev, ...result.items])
      lastDocRef.current = result.lastDoc
      setHasMore(result.hasMore)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setIsLoadingMore(false)
    }
  }, [uid, hasMore, isLoadingMore, firstPageBooks, additionalBooks, tag])

  return {
    books: [...firstPageBooks, ...additionalBooks],
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
  }
}
