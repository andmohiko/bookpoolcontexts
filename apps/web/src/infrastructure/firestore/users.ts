import type {
  CreateUserDto,
  Uid,
  UpdateUserDto,
  User,
} from '@vectornote/common'
import { userCollection } from '@vectornote/common'
import type { Unsubscribe } from 'firebase/firestore'
import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { convertDate } from '@/utils/convertDate'

const dateColumns = ['createdAt', 'updatedAt'] as const satisfies Array<string>

/** ユーザーを取得する */
export const fetchUserOperation = async (uid: Uid): Promise<User | null> => {
  const snapshot = await getDoc(doc(db, userCollection, uid))
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return { uid: snapshot.id, ...convertDate(data, dateColumns) } as User
}

/** ユーザーをリアルタイム購読する */
export const subscribeUserOperation = (
  uid: Uid,
  setter: (user: User | null | undefined) => void,
): Unsubscribe => {
  return onSnapshot(doc(db, userCollection, uid), (snapshot) => {
    const data = snapshot.data()
    if (!data) {
      setter(null)
      return
    }
    setter({ uid: snapshot.id, ...convertDate(data, dateColumns) } as User)
  })
}

/** ユーザーを作成する */
export const createUserOperation = async (
  uid: Uid,
  dto: CreateUserDto,
): Promise<void> => {
  await setDoc(doc(db, userCollection, uid), dto)
}

/** ユーザーを更新する */
export const updateUserOperation = async (
  uid: Uid,
  dto: UpdateUserDto,
): Promise<void> => {
  await updateDoc(doc(db, userCollection, uid), dto)
}

/** ユーザーを削除する */
export const deleteUserOperation = async (uid: Uid): Promise<void> => {
  await deleteDoc(doc(db, userCollection, uid))
}
