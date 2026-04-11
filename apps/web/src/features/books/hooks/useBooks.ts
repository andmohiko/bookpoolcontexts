import type { Book } from '@bookpoolcontexts/common'
import { useEffect, useState } from 'react'
import {
  subscribeBooksByGroupOperation,
  subscribeBooksByTagOperation,
  subscribeBooksOperation,
} from '@/infrastructure/firestore/books'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'

export type UseBooksReturn = {
  books: Array<Book>
  isLoading: boolean
}

type UseBooksParams = {
  tag?: string
  group?: string
}

export const useBooks = ({
  tag,
  group,
}: UseBooksParams = {}): UseBooksReturn => {
  const { uid } = useFirebaseAuthContext()
  const [books, setBooks] = useState<Array<Book>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!uid) return

    setIsLoading(true)

    const handleBooks = (updatedBooks: Array<Book>): void => {
      setBooks(updatedBooks)
      setIsLoading(false)
    }

    // tag と group が同時指定されたら tag を優先
    const unsubscribe = tag
      ? subscribeBooksByTagOperation(uid, tag, 100, handleBooks)
      : group
        ? subscribeBooksByGroupOperation(uid, group, 100, handleBooks)
        : subscribeBooksOperation(uid, 100, handleBooks)

    return () => unsubscribe()
  }, [uid, tag, group])

  return {
    books,
    isLoading,
  }
}
