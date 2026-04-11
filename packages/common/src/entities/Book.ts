import type { FieldValue } from 'firebase/firestore'
import type { FieldValue as AdminFieldValue } from 'firebase-admin/firestore'

/** コレクション名 */
export const bookCollection = 'books' as const

/** ID型エイリアス */
export type BookId = string

/** ドキュメント更新の操作主 */
export type UpdatedBy = 'trigger' | 'user'

/** スクレイピングの状態 */
export type ScrapingStatus = 'scraping' | 'completed' | 'failed' | 'skipped'

/** Entity型（Firestoreから取得したデータ、Date変換済み） */
export type Book = {
  bookId: BookId
  amazonUrl: string
  author: string | null
  coverImageUrl: string | null
  createdAt: Date
  foundBy: string
  groups: string[]
  isRead: boolean
  location: string
  note: string
  pages: number | null
  purchasedBy: string[]
  scrapingStatus: ScrapingStatus
  tags: string[]
  title: string | null
  updatedAt: Date
  updatedBy: UpdatedBy
}

/** 作成用DTO */
export type CreateBookDto = Omit<Book, 'bookId' | 'createdAt' | 'updatedAt'> & {
  createdAt: FieldValue
  updatedAt: FieldValue
}

// NOTE: CreateBookDto は Book から updatedBy: UpdatedBy を継承するため、
// フロントエンドで作成時に updatedBy: 'user' を必ずセットすること

/** 更新用DTO */
export type UpdateBookDto = {
  amazonUrl?: Book['amazonUrl']
  author?: Book['author']
  coverImageUrl?: Book['coverImageUrl']
  foundBy?: Book['foundBy']
  groups?: Book['groups']
  isRead?: Book['isRead']
  location?: Book['location']
  note?: Book['note']
  pages?: Book['pages']
  purchasedBy?: Book['purchasedBy']
  scrapingStatus?: Book['scrapingStatus']
  tags?: Book['tags']
  title?: Book['title']
  updatedAt: FieldValue
  updatedBy: UpdatedBy
}

/** firebase-admin を使用した更新用DTO（Amazon情報取得時） */
export type UpdateBookDtoFromAdmin = {
  amazonUrl?: Book['amazonUrl']
  author?: Book['author']
  coverImageUrl?: Book['coverImageUrl']
  pages?: Book['pages']
  scrapingStatus?: Book['scrapingStatus']
  title?: Book['title']
  updatedAt: AdminFieldValue
  updatedBy: UpdatedBy
}
