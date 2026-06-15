import type {
  CreateSharedGroupDto,
  SharedGroup,
  SharedGroupId,
  Uid,
} from '@bookpoolcontexts/common'
import { sharedGroupCollection } from '@bookpoolcontexts/common'
import type { Unsubscribe } from 'firebase/firestore'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { convertDate } from '@/utils/convertDate'

const dateColumns = ['createdAt', 'updatedAt'] as const satisfies Array<string>

const sharedGroupsRef = () => collection(db, sharedGroupCollection)

const sharedGroupDocRef = (sharedGroupId: SharedGroupId) =>
  doc(db, sharedGroupCollection, sharedGroupId)

/** 共有グループを作成する */
export const createSharedGroupOperation = async (
  dto: CreateSharedGroupDto,
): Promise<string> => {
  const docRef = await addDoc(sharedGroupsRef(), dto)
  return docRef.id
}

/** 共有グループを削除する */
export const deleteSharedGroupOperation = async (
  sharedGroupId: SharedGroupId,
): Promise<void> => {
  await deleteDoc(sharedGroupDocRef(sharedGroupId))
}

/** 共有グループを取得する（公開ページ用、認証不要） */
export const getSharedGroupOperation = async (
  sharedGroupId: SharedGroupId,
): Promise<SharedGroup | null> => {
  const snapshot = await getDoc(sharedGroupDocRef(sharedGroupId))
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return {
    sharedGroupId: snapshot.id,
    ...convertDate(data, dateColumns),
  } as SharedGroup
}

/** 自分が作成した共有グループ一覧をリアルタイム購読する */
export const subscribeSharedGroupsByUidOperation = (
  uid: Uid,
  setter: (sharedGroups: Array<SharedGroup>) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const q = query(sharedGroupsRef(), where('uid', '==', uid))
  return onSnapshot(
    q,
    (snapshot) => {
      const sharedGroups = snapshot.docs.map(
        (d) =>
          ({
            sharedGroupId: d.id,
            ...convertDate(d.data(), dateColumns),
          }) as SharedGroup,
      )
      setter(sharedGroups)
    },
    onError,
  )
}
