import type { UpdateBookDtoFromAdmin } from '@bookpoolcontexts/common'
import { bookCollection } from '@bookpoolcontexts/common'
import { db } from '~/lib/firebase'

/** Bookドキュメントを更新する */
export const updateBookOperation = async (
  uid: string,
  bookId: string,
  dto: UpdateBookDtoFromAdmin,
): Promise<void> => {
  await db
    .collection('users')
    .doc(uid)
    .collection(bookCollection)
    .doc(bookId)
    .update(dto)
}
