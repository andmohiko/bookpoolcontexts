import type {
  CreateUserDto,
  Uid,
  UpdateUserDto,
  User,
} from '@bookpoolcontexts/common'
import { userCollection } from '@bookpoolcontexts/common'

import { db } from '~/lib/firebase'
import { convertDate } from '~/utils/convertDate'

const dateColumns = ['createdAt', 'updatedAt'] as const satisfies Array<string>

/** ユーザーを取得する */
export const fetchUserOperation = async (uid: Uid): Promise<User | null> => {
  const snapshot = await db.collection(userCollection).doc(uid).get()
  if (!snapshot.exists) return null
  const data = snapshot.data()
  if (!data) return null
  return { uid: snapshot.id, ...convertDate(data, dateColumns) } as User
}

/** ユーザーを作成する */
export const createUserOperation = async (
  uid: Uid,
  dto: CreateUserDto,
): Promise<void> => {
  await db.collection(userCollection).doc(uid).set(dto)
}

/** ユーザーを更新する */
export const updateUserOperation = async (
  uid: Uid,
  dto: UpdateUserDto,
): Promise<void> => {
  await db.collection(userCollection).doc(uid).update(dto)
}

/** ユーザーを削除する */
export const deleteUserOperation = async (uid: Uid): Promise<void> => {
  await db.collection(userCollection).doc(uid).delete()
}
