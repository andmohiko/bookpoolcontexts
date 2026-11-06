import type {
  BookId,
  Ranking,
  UpdateRankingDto,
} from '@bookpoolcontexts/common'
import { useState } from 'react'
import { toast } from 'sonner'

import { updateRankingOperation } from '@/infrastructure/firestore/rankings'
import { serverTimestamp } from '@/lib/firebase'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseRemoveFromRankingMutationReturn = {
  removeFromRanking: (bookId: BookId) => Promise<void>
  isRemoving: boolean
}

/**
 * 確定済みランキングから1冊だけ取り除く（単品ソートのための順位リセット）。
 *
 * excludedBookIds には追加しないため、取り除いた本は新規登録した本と同じく
 * 「ランキング未追加の本」に現れ、「ランキングを更新」の二分挿入ソートで
 * 順位を決め直せる。永続的な除外（useExcludeBookMutation）とは別物。
 *
 * rankedBookIds は順序が意味を持つので arrayRemove ではなく明示的な配列で更新する。
 *
 * NOTE: 呼び出し側は status === 'idle' のときのみ実行すること。
 * ソート中に取り除くと、進行中のソートの前提（既存ランキング）が変わってしまう。
 */
export const useRemoveFromRankingMutation = (
  ranking: Ranking | null,
): UseRemoveFromRankingMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isRemoving, setIsRemoving] = useState(false)

  const removeFromRanking = async (bookId: BookId): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    if (!ranking?.rankedBookIds.includes(bookId)) return

    setIsRemoving(true)
    try {
      const dto: UpdateRankingDto = {
        rankedBookIds: ranking.rankedBookIds.filter((id) => id !== bookId),
        updatedAt: serverTimestamp,
      }
      await updateRankingOperation(uid, dto)
      toast.success(
        'ランキングから外しました。「ランキングを更新」でソートし直せます',
      )
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsRemoving(false)
    }
  }

  return { removeFromRanking, isRemoving }
}
