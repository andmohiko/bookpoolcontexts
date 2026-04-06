import type { FieldValue } from 'firebase/firestore'
import type { FieldValue as AdminFieldValue } from 'firebase-admin/firestore'

/** コレクション名 */
export const tagCollection = 'tags' as const

/** ID型エイリアス */
export type TagId = string

/** Entity型（Firestoreから取得したデータ、Date変換済み） */
export type Tag = {
  tagId: TagId
  count: number
  createdAt: Date
  label: string
  updatedAt: Date
}

/** 作成用DTO */
export type CreateTagDto = Omit<Tag, 'tagId' | 'createdAt' | 'updatedAt'> & {
  createdAt: FieldValue
  updatedAt: FieldValue
}

/** 更新用DTO */
export type UpdateTagDto = {
  count?: number
  updatedAt: FieldValue
}

/** firebase-admin を使用した作成用DTO */
export type CreateTagDtoFromAdmin = Omit<Tag, 'tagId' | 'createdAt' | 'updatedAt'> & {
  createdAt: AdminFieldValue
  updatedAt: AdminFieldValue
}

/** firebase-admin を使用した更新用DTO */
export type UpdateTagDtoFromAdmin = {
  count?: number | AdminFieldValue
  updatedAt: AdminFieldValue
}
