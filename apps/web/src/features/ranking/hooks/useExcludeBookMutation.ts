import type { BookId, Ranking, UpdateRankingDto } from '@bookpoolcontexts/common'
import { arrayUnion } from 'firebase/firestore'
import { useState } from 'react'
import { toast } from 'sonner'

import { updateRankingOperation } from '@/infrastructure/firestore/rankings'
import { serverTimestamp } from '@/lib/firebase'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseExcludeBookMutationReturn = {
  exclude: (bookId: BookId) => Promise<void>
  isExcluding: boolean
}

/**
 * 本をランキング対象から除外する。
 *
 * 確定済みランキングに含まれている場合は、その本を除いた配列で上書きする。
 * （rankedBookIds は順序が意味を持つので arrayRemove ではなく明示的な配列で更新する）
 */
export const useExcludeBookMutation = (
  ranking: Ranking | null,
): UseExcludeBookMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isExcluding, setIsExcluding] = useState(false)

  const exclude = async (bookId: BookId): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')

    setIsExcluding(true)
    try {
      const isInRanking = ranking?.rankedBookIds.includes(bookId) ?? false
      const dto: UpdateRankingDto = {
        excludedBookIds: arrayUnion(bookId),
        updatedAt: serverTimestamp,
        ...(isInRanking && ranking
          ? {
              rankedBookIds: ranking.rankedBookIds.filter(
                (id) => id !== bookId,
              ),
            }
          : {}),
      }
      await updateRankingOperation(uid, dto)
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsExcluding(false)
    }
  }

  return { exclude, isExcluding }
}
