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
