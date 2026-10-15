import type { BookId, Uid, UpdateRankingDtoFromAdmin } from '@bookpoolcontexts/common'
import {
  currentRankingId,
  rankingCollection,
  userCollection,
} from '@bookpoolcontexts/common'
import { FieldValue } from 'firebase-admin/firestore'

import { db, serverTimestamp } from '~/lib/firebase'

const rankingDocRef = (uid: Uid) =>
  db
    .collection(userCollection)
    .doc(uid)
    .collection(rankingCollection)
    .doc(currentRankingId)

/** ランキングを更新する */
export const updateRankingOperation = async (
  uid: Uid,
  dto: UpdateRankingDtoFromAdmin,
): Promise<void> => {
  await rankingDocRef(uid).update(dto)
}

/**
 * ランキングから本を取り除く。
 *
 * 読了・削除された本をランキングの各配列から除去する。
 * arrayRemove は残りの要素の順序を保つため、ランキングの順位は崩れない。
 *
 * ランキングが未作成のユーザーでは何もしない。
 */
export const removeBookFromRankingOperation = async (
  uid: Uid,
  bookId: BookId,
): Promise<void> => {
  const snapshot = await rankingDocRef(uid).get()
  if (!snapshot.exists) return

  const dto: UpdateRankingDtoFromAdmin = {
    rankedBookIds: FieldValue.arrayRemove(bookId),
    candidateBookIds: FieldValue.arrayRemove(bookId),
    excludedBookIds: FieldValue.arrayRemove(bookId),
    updatedAt: serverTimestamp,
  }
  await rankingDocRef(uid).update(dto)
}
