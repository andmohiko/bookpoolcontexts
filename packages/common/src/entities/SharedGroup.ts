import type { FieldValue } from 'firebase/firestore'
import type { FieldValue as AdminFieldValue } from 'firebase-admin/firestore'

/** コレクション名 */
export const sharedGroupCollection = 'sharedGroups' as const

/** ID型エイリアス */
export type SharedGroupId = string

/** 共有グループに含まれる本の公開情報 */
export type SharedBook = {
  title: string | null
  author: string | null
  coverImageUrl: string | null
  tags: string[]
  amazonUrl: string
}

/** Entity型（Firestoreから取得したデータ、Date変換済み） */
export type SharedGroup = {
  sharedGroupId: SharedGroupId
  uid: string
  groupId: string
  groupLabel: string
  ownerName: string
  books: SharedBook[]
  createdAt: Date
  updatedAt: Date
}

/** 作成用DTO */
export type CreateSharedGroupDto = Omit<
  SharedGroup,
  'sharedGroupId' | 'createdAt' | 'updatedAt'
> & {
  createdAt: FieldValue
  updatedAt: FieldValue
}

/** firebase-admin を使用した更新用DTO */
export type UpdateSharedGroupDtoFromAdmin = {
  groupLabel?: string
  ownerName?: string
  books?: SharedBook[]
  updatedAt: AdminFieldValue
}
