import type { Book, BookId } from '@bookpoolcontexts/common'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'

import { getBookIdentity } from '@/features/ranking/utils/bookIdentity'
import { subscribeUnreadBooksOperation } from '@/infrastructure/firestore/books'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

/** 重複登録として除外した本と、代わりに残した本の組 */
export type DuplicateBook = {
  /** 除外した本 */
  book: Book
  /** 同じ本として扱い、ランキングに残した本（先に登録されたもの） */
  keptBook: Book
}

export type UseUnreadBooksReturn = {
  /** ランキングの対象になる未読本（タイトル取得済み・重複排除済み・createdAt 昇順） */
  books: Array<Book>
  bookMap: Map<BookId, Book>
  /** タイトル未取得でランキング対象外になった未読本 */
  pendingBooks: Array<Book>
  /** 同じ本の重複登録として除外した本 */
  duplicateBooks: Array<DuplicateBook>
  isLoading: boolean
  error: string | null
}

/**
 * 未読の本を全件購読し、createdAt 昇順に整えて返す。
 *
 * タイトルが未取得（スクレイピング中・失敗）の本は対象から外す。
 * タイトルも表紙もない状態では「どちらをより読みたいか」を判断できず、
 * 2 択に並べても見分けがつかないため。取得が完了すれば自動的に
 * 「ランキング未追加の本」として現れ、次回の更新で組み込める。
 *
 * ランキング画面配下でのみ使用すること（全件購読のため読み取りコストが高い）。
 */
export const useUnreadBooks = (): UseUnreadBooksReturn => {
  const { uid } = useFirebaseAuthContext()
  const [allBooks, setAllBooks] = useState<Array<Book>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return

    setIsLoading(true)
    const unsubscribe = subscribeUnreadBooksOperation(
      uid,
      (updatedBooks) => {
        setAllBooks(
          [...updatedBooks].sort((a, b) =>
            dayjs(a.createdAt).diff(dayjs(b.createdAt)),
          ),
        )
        setIsLoading(false)
      },
      (err) => {
        setError(errorMessage(err))
        setIsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [uid])

  /**
   * ランキングの対象にする本を選ぶ。
   *
   * 1. タイトル未取得の本を除く。タイトルも表紙もない状態では
   *    「どちらをより読みたいか」を判断できず、2 択に並べても見分けがつかない
   * 2. 同じ本の重複登録を除く。本の登録に重複チェックがないため、同じ本を
   *    2 回登録すると別の bookId で中身が同一のドキュメントができる。
   *    ランキングでは別の本として扱われ、2 択の左右に同じ本が並んでしまう。
   *    amazonUrl、それも無ければタイトルと著者の組で同一性を判定し、
   *    先に登録された 1 冊だけを残す
   */
  const { books, pendingBooks, duplicateBooks } = useMemo(() => {
    const keptByIdentity = new Map<string, Book>()
    const picked: Array<Book> = []
    const pending: Array<Book> = []
    const duplicates: Array<DuplicateBook> = []

    for (const book of allBooks) {
      if (book.title === null) {
        pending.push(book)
        continue
      }

      const identity = getBookIdentity(book)
      const kept = keptByIdentity.get(identity)
      if (kept) {
        // どちらを削除するか判断できるよう、残した側とペアで返す
        duplicates.push({ book, keptBook: kept })
        continue
      }
      keptByIdentity.set(identity, book)
      picked.push(book)
    }

    return {
      books: picked,
      pendingBooks: pending,
      duplicateBooks: duplicates,
    }
  }, [allBooks])

  const bookMap = useMemo(
    () => new Map(books.map((book) => [book.bookId, book])),
    [books],
  )

  return { books, bookMap, pendingBooks, duplicateBooks, isLoading, error }
}
