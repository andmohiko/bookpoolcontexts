import type {
  GroupId,
  Uid,
  UpdateGroupDtoFromAdmin,
} from '@bookpoolcontexts/common'
import { groupCollection, userCollection } from '@bookpoolcontexts/common'
import { db } from '~/lib/firebase'

const groupsRef = (uid: Uid) =>
  db.collection(userCollection).doc(uid).collection(groupCollection)

const groupDocRef = (uid: Uid, groupId: GroupId) =>
  groupsRef(uid).doc(groupId)

/** グループを更新する */
export const updateGroupOperation = async (
  uid: Uid,
  groupId: GroupId,
  dto: UpdateGroupDtoFromAdmin,
): Promise<void> => {
  await groupDocRef(uid, groupId).update(dto)
}

/** ラベルでグループを検索して更新する */
export const updateGroupByLabelOperation = async (
  uid: Uid,
  label: string,
  dto: UpdateGroupDtoFromAdmin,
): Promise<void> => {
  const snapshot = await groupsRef(uid).where('label', '==', label).limit(1).get()
  if (snapshot.empty) {
    console.warn('ラベルに一致するグループが見つかりません:', label)
    return
  }
  await snapshot.docs[0].ref.update(dto)
}
