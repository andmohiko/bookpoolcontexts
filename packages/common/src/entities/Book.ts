import type { FieldValue } from 'firebase/firestore'
import type { FieldValue as AdminFieldValue } from 'firebase-admin/firestore'

/** コレクション名 */
export const bookCollection = 'books' as const

/** ID型エイリアス */
export type BookId = string

/** Entity型（Firestoreから取得したデータ、Date変換済み） */
export type Book = {
  bookId: BookId
  author: string
  coverImageUrl: string
  createdAt: Date
  foundBy: string
  groups: string[]
  isRead: boolean
  location: string
  note: string
  pages: number
  purchasedBy: string[]
  tags: string[]
  title: string
  updatedAt: Date
}

/** 作成用DTO */
export type CreateBookDto = Omit<Book, 'bookId' | 'createdAt' | 'updatedAt'> & {
  createdAt: FieldValue
  updatedAt: FieldValue
}

/** 更新用DTO */
export type UpdateBookDto = {
  author?: Book['author']
  coverImageUrl?: Book['coverImageUrl']
  foundBy?: Book['foundBy']
  groups?: Book['groups']
  isRead?: Book['isRead']
  location?: Book['location']
  note?: Book['note']
  pages?: Book['pages']
  purchasedBy?: Book['purchasedBy']
  tags?: Book['tags']
  title?: Book['title']
  updatedAt: FieldValue
}

/** firebase-admin を使用した更新用DTO（Amazon情報取得時） */
export type UpdateBookDtoFromAdmin = {
  author?: Book['author']
  coverImageUrl?: Book['coverImageUrl']
  pages?: Book['pages']
  title?: Book['title']
  updatedAt: AdminFieldValue
}
