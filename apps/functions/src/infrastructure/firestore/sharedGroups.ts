import type {
  SharedBook,
  UpdateSharedGroupDtoFromAdmin,
} from '@bookpoolcontexts/common'
import {
  bookCollection,
  sharedGroupCollection,
  userCollection,
} from '@bookpoolcontexts/common'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '~/lib/firebase'

const sharedGroupsRef = () => db.collection(sharedGroupCollection)

/** uid + groupId で共有グループを検索する */
export const fetchSharedGroupsByGroupIdOperation = async (
  uid: string,
  groupId: string,
): Promise<Array<{ sharedGroupId: string }>> => {
  const snapshot = await sharedGroupsRef()
    .where('uid', '==', uid)
    .where('groupId', '==', groupId)
    .get()
  return snapshot.docs.map((d) => ({ sharedGroupId: d.id }))
}

/** uid + groupLabel で共有グループを検索する */
export const fetchSharedGroupsByGroupLabelOperation = async (
  uid: string,
  groupLabel: string,
): Promise<Array<{ sharedGroupId: string }>> => {
  const snapshot = await sharedGroupsRef()
    .where('uid', '==', uid)
    .where('groupLabel', '==', groupLabel)
    .get()
  return snapshot.docs.map((d) => ({ sharedGroupId: d.id }))
}

/** 共有グループを更新する */
export const updateSharedGroupOperation = async (
  sharedGroupId: string,
  dto: UpdateSharedGroupDtoFromAdmin,
): Promise<void> => {
  await sharedGroupsRef().doc(sharedGroupId).update(dto)
}

/** 共有グループを削除する */
export const deleteSharedGroupOperation = async (
  sharedGroupId: string,
): Promise<void> => {
  await sharedGroupsRef().doc(sharedGroupId).delete()
}

/** グループに属する本の公開情報で共有グループの books を再構築する */
export const rebuildSharedGroupBooksOperation = async (
  uid: string,
  groupLabel: string,
): Promise<void> => {
  // 該当 groupLabel の共有グループを検索
  const sharedGroups =
    await fetchSharedGroupsByGroupLabelOperation(uid, groupLabel)
  if (sharedGroups.length === 0) return

  // グループに属する全 Book を取得
  const booksSnapshot = await db
    .collection(userCollection)
    .doc(uid)
    .collection(bookCollection)
    .where('groups', 'array-contains', groupLabel)
    .orderBy('createdAt', 'desc')
    .get()

  const books: SharedBook[] = booksSnapshot.docs.map((d) => {
    const data = d.data()
    return {
      title: data.title ?? null,
      author: data.author ?? null,
      coverImageUrl: data.coverImageUrl ?? null,
      tags: data.tags ?? [],
      amazonUrl: data.amazonUrl ?? '',
    }
  })

  // 各共有グループの books を更新
  const batch = db.batch()
  for (const sg of sharedGroups) {
    batch.update(sharedGroupsRef().doc(sg.sharedGroupId), {
      books,
      updatedAt: FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()
}
