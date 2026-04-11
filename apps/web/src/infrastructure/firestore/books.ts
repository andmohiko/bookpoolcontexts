import type {
  Book,
  BookId,
  CreateBookDto,
  Uid,
  UpdateBookDto,
} from '@bookpoolcontexts/common'
import { bookCollection, userCollection } from '@bookpoolcontexts/common'
import type { DocumentSnapshot, Unsubscribe } from 'firebase/firestore'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { convertDate } from '@/utils/convertDate'

const dateColumns = ['createdAt', 'updatedAt'] as const satisfies Array<string>

export const PAGE_SIZE = 18

export type FetchResultWithPagination<T> = {
  items: Array<T>
  lastDoc: DocumentSnapshot | null
  hasMore: boolean
}

const booksRef = (uid: Uid) =>
  collection(db, userCollection, uid, bookCollection)

const bookDocRef = (uid: Uid, bookId: BookId) =>
  doc(db, userCollection, uid, bookCollection, bookId)

/** 本を取得する */
export const fetchBookOperation = async (
  uid: Uid,
  bookId: BookId,
): Promise<Book | null> => {
  const snapshot = await getDoc(bookDocRef(uid, bookId))
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return { bookId: snapshot.id, ...convertDate(data, dateColumns) } as Book
}

/** 本をリアルタイム購読する */
export const subscribeBookOperation = (
  uid: Uid,
  bookId: BookId,
  setter: (book: Book | null | undefined) => void,
): Unsubscribe => {
  return onSnapshot(bookDocRef(uid, bookId), (snapshot) => {
    const data = snapshot.data()
    if (!data) {
      setter(null)
      return
    }
    setter({ bookId: snapshot.id, ...convertDate(data, dateColumns) } as Book)
  })
}

/** 本の一覧を取得する（ページネーション対応） */
export const fetchBooksOperation = async (
  uid: Uid,
  pageSize: number,
  lastDocument: DocumentSnapshot | null,
  tag?: string,
): Promise<FetchResultWithPagination<Book>> => {
  const baseConstraints = tag
    ? [where('tags', 'array-contains', tag), orderBy('createdAt', 'desc')]
    : [orderBy('createdAt', 'desc')]
  const constraints = lastDocument
    ? [...baseConstraints, startAfter(lastDocument), limit(pageSize)]
    : [...baseConstraints, limit(pageSize)]

  const snapshot = await getDocs(query(booksRef(uid), ...constraints))
  const items = snapshot.docs.map(
    (d) => ({ bookId: d.id, ...convertDate(d.data(), dateColumns) }) as Book,
  )
  const lastDoc =
    snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
  const hasMore = snapshot.docs.length === pageSize

  return { items, lastDoc, hasMore }
}

/** 本の一覧をリアルタイム購読する */
export const subscribeBooksOperation = (
  uid: Uid,
  pageSize: number,
  setter: (books: Array<Book>) => void,
): Unsubscribe => {
  const q = query(booksRef(uid), orderBy('createdAt', 'desc'), limit(pageSize))
  return onSnapshot(q, (snapshot) => {
    const books = snapshot.docs.map(
      (d) => ({ bookId: d.id, ...convertDate(d.data(), dateColumns) }) as Book,
    )
    setter(books)
  })
}

/** グループに属する本の一覧を取得する（ページネーション対応） */
export const fetchBooksByGroupOperation = async (
  uid: Uid,
  groupLabel: string,
  pageSize: number,
  lastDocument: DocumentSnapshot | null,
): Promise<FetchResultWithPagination<Book>> => {
  const baseConstraints = [
    where('groups', 'array-contains', groupLabel),
    orderBy('createdAt', 'desc'),
  ]
  const constraints = lastDocument
    ? [...baseConstraints, startAfter(lastDocument), limit(pageSize)]
    : [...baseConstraints, limit(pageSize)]

  const snapshot = await getDocs(query(booksRef(uid), ...constraints))
  const items = snapshot.docs.map(
    (d) => ({ bookId: d.id, ...convertDate(d.data(), dateColumns) }) as Book,
  )
  const lastDoc =
    snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
  const hasMore = snapshot.docs.length === pageSize

  return { items, lastDoc, hasMore }
}

/** グループに属する本の一覧をリアルタイム購読する */
export const subscribeBooksByGroupOperation = (
  uid: Uid,
  groupLabel: string,
  pageSize: number,
  setter: (books: Array<Book>) => void,
): Unsubscribe => {
  const q = query(
    booksRef(uid),
    where('groups', 'array-contains', groupLabel),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  )
  return onSnapshot(q, (snapshot) => {
    const books = snapshot.docs.map(
      (d) => ({ bookId: d.id, ...convertDate(d.data(), dateColumns) }) as Book,
    )
    setter(books)
  })
}

/** タグが付いた本の一覧を取得する（ページネーション対応） */
export const fetchBooksByTagOperation = async (
  uid: Uid,
  tagLabel: string,
  pageSize: number,
  lastDocument: DocumentSnapshot | null,
): Promise<FetchResultWithPagination<Book>> => {
  const baseConstraints = [
    where('tags', 'array-contains', tagLabel),
    orderBy('createdAt', 'desc'),
  ]
  const constraints = lastDocument
    ? [...baseConstraints, startAfter(lastDocument), limit(pageSize)]
    : [...baseConstraints, limit(pageSize)]

  const snapshot = await getDocs(query(booksRef(uid), ...constraints))
  const items = snapshot.docs.map(
    (d) => ({ bookId: d.id, ...convertDate(d.data(), dateColumns) }) as Book,
  )
  const lastDoc =
    snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
  const hasMore = snapshot.docs.length === pageSize

  return { items, lastDoc, hasMore }
}

/** タグが付いた本の一覧をリアルタイム購読する */
export const subscribeBooksByTagOperation = (
  uid: Uid,
  tagLabel: string,
  pageSize: number,
  setter: (books: Array<Book>) => void,
): Unsubscribe => {
  const q = query(
    booksRef(uid),
    where('tags', 'array-contains', tagLabel),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  )
  return onSnapshot(q, (snapshot) => {
    const books = snapshot.docs.map(
      (d) => ({ bookId: d.id, ...convertDate(d.data(), dateColumns) }) as Book,
    )
    setter(books)
  })
}

/** 本を作成する */
export const createBookOperation = async (
  uid: Uid,
  dto: CreateBookDto,
): Promise<void> => {
  await addDoc(booksRef(uid), dto)
}

/** 本を更新する */
export const updateBookOperation = async (
  uid: Uid,
  bookId: BookId,
  dto: UpdateBookDto,
): Promise<void> => {
  await updateDoc(bookDocRef(uid, bookId), dto)
}

/** 本を削除する */
export const deleteBookOperation = async (
  uid: Uid,
  bookId: BookId,
): Promise<void> => {
  await deleteDoc(bookDocRef(uid, bookId))
}
