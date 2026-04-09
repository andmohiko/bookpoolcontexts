import type { Book } from '@bookpoolcontexts/common'
import { useEffect, useState } from 'react'
import {
  subscribeBooksByGroupOperation,
  subscribeBooksOperation,
} from '@/infrastructure/firestore/books'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'

export type UseBooksReturn = {
  books: Array<Book>
  isLoading: boolean
}

type UseBooksParams = {
  group?: string
}

export const useBooks = ({ group }: UseBooksParams = {}): UseBooksReturn => {
  const { uid } = useFirebaseAuthContext()
  const [books, setBooks] = useState<Array<Book>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!uid) return

    setIsLoading(true)

    const unsubscribe = group
      ? subscribeBooksByGroupOperation(uid, group, 100, (books) => {
          setBooks(books)
          setIsLoading(false)
        })
      : subscribeBooksOperation(uid, 100, (books) => {
          setBooks(books)
          setIsLoading(false)
        })

    return () => unsubscribe()
  }, [uid, group])

  return {
    books,
    isLoading,
  }
}
