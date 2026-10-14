import type { BookId, UpdateRankingDto } from '@bookpoolcontexts/common'
import { arrayUnion } from 'firebase/firestore'
import { useState } from 'react'
import { toast } from 'sonner'

import { updateRankingOperation } from '@/infrastructure/firestore/rankings'
import { serverTimestamp } from '@/lib/firebase'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'
import type { SortInput } from '@/features/ranking/utils/sortEngine'
import { computeSortProgress } from '@/features/ranking/utils/sortEngine'

export type UseAnswerComparisonMutationReturn = {
  answer: (winner: BookId, loser: BookId) => Promise<void>
  isAnswering: boolean
}

/**
 * 2択の回答を記録する。
 *
 * 次の進捗をローカルで先に計算し、完了なら回答の追記と確定を1回の書き込みにまとめる。
 *
 * NOTE: onSnapshot の到着を待って complete を呼ぶ設計にはできない。
 * arrayUnion は valueEquals による深い重複排除を行うため、スナップショット到着前に
 * 同じ組へ再回答すると書き込みが無視され、進捗が進まず画面が固まる。
 */
export const useAnswerComparisonMutation = (
  sortInput: SortInput | null,
): UseAnswerComparisonMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isAnswering, setIsAnswering] = useState(false)

  const answer = async (winner: BookId, loser: BookId): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    if (!sortInput) return

    setIsAnswering(true)
    try {
      const nextDecisions = [...sortInput.decisions, { winner, loser }]
      const next = computeSortProgress({
        ...sortInput,
        decisions: nextDecisions,
      })

      const dto: UpdateRankingDto =
        next.status === 'completed'
          ? {
              status: 'idle',
              mode: null,
              candidateBookIds: [],
              decisions: [],
              rankedBookIds: next.order,
              updatedAt: serverTimestamp,
            }
          : {
              decisions: arrayUnion({ winner, loser }),
              updatedAt: serverTimestamp,
            }

      await updateRankingOperation(uid, dto)
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsAnswering(false)
    }
  }

  return { answer, isAnswering }
}
