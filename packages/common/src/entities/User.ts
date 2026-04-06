import type { FieldValue } from 'firebase/firestore'

import type { Uid } from './Auth'

/** コレクション名 */
export const userCollection = 'users' as const

/** Entity型（Firestoreから取得したデータ、Date変換済み） */
export type User = {
  uid: Uid
  createdAt: Date
  email: string
  updatedAt: Date
}

/** 作成用DTO */
export type CreateUserDto = Omit<User, 'uid' | 'createdAt' | 'updatedAt'> & {
  createdAt: FieldValue
  updatedAt: FieldValue
}

/** 更新用DTO */
export type UpdateUserDto = {
  email?: User['email']
  updatedAt: FieldValue
}
