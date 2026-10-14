import type { RankingDecision, UpdateRankingDto } from '@bookpoolcontexts/common'
import { arrayRemove } from 'firebase/firestore'
import { useState } from 'react'
import { toast } from 'sonner'

import { updateRankingOperation } from '@/infrastructure/firestore/rankings'
import { serverTimestamp } from '@/lib/firebase'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseUndoComparisonMutationReturn = {
  undo: (last: RankingDecision) => Promise<void>
  isUndoing: boolean
}

/**
 * 直前の回答を取り消す。
 *
 * 回答ログの順序は比較が要求された順序と一致するため、末尾を消せば直前の2択に戻る。
 * arrayUnion が重複を排除するので同じ組は1件しか存在せず、
 * arrayRemove で意図せず複数消える事故は起きない。
 */
export const useUndoComparisonMutation =
  (): UseUndoComparisonMutationReturn => {
    const { uid } = useFirebaseAuthContext()
    const [isUndoing, setIsUndoing] = useState(false)

    const undo = async (last: RankingDecision): Promise<void> => {
      if (!uid) throw new Error('認証エラー：再ログインしてください')

      setIsUndoing(true)
      try {
        const dto: UpdateRankingDto = {
          decisions: arrayRemove({ winner: last.winner, loser: last.loser }),
          updatedAt: serverTimestamp,
        }
        await updateRankingOperation(uid, dto)
      } catch (e) {
        toast.error(errorMessage(e))
        throw e
      } finally {
        setIsUndoing(false)
      }
    }

    return { undo, isUndoing }
  }
