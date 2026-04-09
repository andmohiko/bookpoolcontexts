import type { Book } from '@bookpoolcontexts/common'
import { useEffect, useState } from 'react'
import { subscribeBooksOperation } from '@/infrastructure/firestore/books'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'

export type UseBooksReturn = {
  books: Array<Book>
  isLoading: boolean
}

export const useBooks = (): UseBooksReturn => {
  const { uid } = useFirebaseAuthContext()
  const [books, setBooks] = useState<Array<Book>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!uid) return

    setIsLoading(true)

    const unsubscribe = subscribeBooksOperation(uid, 100, (books) => {
      setBooks(books)
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [uid])

  return {
    books,
    isLoading,
  }
}
