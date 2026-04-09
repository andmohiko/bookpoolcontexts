import type { UpdateBookDtoFromAdmin } from '@bookpoolcontexts/common'
import { bookCollection, userCollection } from '@bookpoolcontexts/common'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '~/lib/firebase'

/** Bookドキュメントを更新する */
export const updateBookOperation = async (
  uid: string,
  bookId: string,
  dto: UpdateBookDtoFromAdmin,
): Promise<void> => {
  await db
    .collection(userCollection)
    .doc(uid)
    .collection(bookCollection)
    .doc(bookId)
    .update(dto)
}

/** 特定グループに所属する全ての本から groupId を除去する */
export const removeGroupFromAllBooksOperation = async (
  uid: string,
  groupId: string,
): Promise<void> => {
  const booksRef = db
    .collection(userCollection)
    .doc(uid)
    .collection(bookCollection)
  const snapshot = await booksRef
    .where('groups', 'array-contains', groupId)
    .get()

  if (snapshot.empty) return

  const batch = db.batch()
  for (const doc of snapshot.docs) {
    batch.update(doc.ref, {
      groups: FieldValue.arrayRemove(groupId),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()
}
