import type {
  CreateGroupDto,
  Group,
  GroupId,
  Uid,
  UpdateGroupDto,
} from '@bookpoolcontexts/common'
import { groupCollection, userCollection } from '@bookpoolcontexts/common'
import type { Unsubscribe } from 'firebase/firestore'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { convertDate } from '@/utils/convertDate'

const dateColumns = ['createdAt', 'updatedAt'] as const satisfies Array<string>

const groupsRef = (uid: Uid) =>
  collection(db, userCollection, uid, groupCollection)

const groupDocRef = (uid: Uid, groupId: GroupId) =>
  doc(db, userCollection, uid, groupCollection, groupId)

/** グループ一覧をリアルタイム購読する（label昇順） */
export const subscribeGroupsOperation = (
  uid: Uid,
  setter: (groups: Array<Group>) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const q = query(groupsRef(uid), orderBy('label', 'asc'))
  return onSnapshot(
    q,
    (snapshot) => {
      const groups = snapshot.docs.map(
        (d) =>
          ({ groupId: d.id, ...convertDate(d.data(), dateColumns) }) as Group,
      )
      setter(groups)
    },
    onError,
  )
}

/** グループを作成する */
export const createGroupOperation = async (
  uid: Uid,
  dto: CreateGroupDto,
): Promise<void> => {
  await addDoc(groupsRef(uid), dto)
}

/** グループを更新する */
export const updateGroupOperation = async (
  uid: Uid,
  groupId: GroupId,
  dto: UpdateGroupDto,
): Promise<void> => {
  await updateDoc(groupDocRef(uid, groupId), dto)
}

/** グループを削除する */
export const deleteGroupOperation = async (
  uid: Uid,
  groupId: GroupId,
): Promise<void> => {
  await deleteDoc(groupDocRef(uid, groupId))
}
