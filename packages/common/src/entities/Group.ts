import type { FieldValue } from 'firebase/firestore'
import type { FieldValue as AdminFieldValue } from 'firebase-admin/firestore'

/** コレクション名 */
export const groupCollection = 'groups' as const

/** ID型エイリアス */
export type GroupId = string

/** Entity型（Firestoreから取得したデータ、Date変換済み） */
export type Group = {
  groupId: GroupId
  count: number
  createdAt: Date
  label: string
  updatedAt: Date
}

/** 作成用DTO */
export type CreateGroupDto = Omit<Group, 'groupId' | 'createdAt' | 'updatedAt'> & {
  createdAt: FieldValue
  updatedAt: FieldValue
}

/** 更新用DTO */
export type UpdateGroupDto = {
  label?: Group['label']
  count?: number
  updatedAt: FieldValue
}

/** firebase-admin を使用した更新用DTO */
export type UpdateGroupDtoFromAdmin = {
  count?: number | AdminFieldValue
  updatedAt: AdminFieldValue
}
