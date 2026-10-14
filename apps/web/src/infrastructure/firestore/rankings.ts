import type {
  CreateRankingDto,
  Ranking,
  Uid,
  UpdateRankingDto,
} from '@bookpoolcontexts/common'
import {
  currentRankingId,
  rankingCollection,
  userCollection,
} from '@bookpoolcontexts/common'
import type { Unsubscribe } from 'firebase/firestore'
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { convertDate } from '@/utils/convertDate'

const dateColumns = ['createdAt', 'updatedAt'] as const satisfies Array<string>

const rankingDocRef = (uid: Uid) =>
  doc(db, userCollection, uid, rankingCollection, currentRankingId)

/** ランキングをリアルタイム購読する。ドキュメントが存在しなければ null */
export const subscribeRankingOperation = (
  uid: Uid,
  setter: (ranking: Ranking | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  return onSnapshot(
    rankingDocRef(uid),
    (snapshot) => {
      const data = snapshot.data()
      if (!data) {
        setter(null)
        return
      }
      setter({
        rankingId: snapshot.id,
        ...convertDate(data, dateColumns),
      } as Ranking)
    },
    onError,
  )
}

/** ランキングを作成する（ドキュメントIDは固定） */
export const createRankingOperation = async (
  uid: Uid,
  dto: CreateRankingDto,
): Promise<void> => {
  await setDoc(rankingDocRef(uid), dto)
}

/** ランキングを更新する */
export const updateRankingOperation = async (
  uid: Uid,
  dto: UpdateRankingDto,
): Promise<void> => {
  await updateDoc(rankingDocRef(uid), dto)
}
