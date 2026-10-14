import type { BookId, UpdateRankingDto } from '@bookpoolcontexts/common'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { updateRankingOperation } from '@/infrastructure/firestore/rankings'
import { serverTimestamp } from '@/lib/firebase'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseFinalizeRankingMutationReturn = {
  finalize: (order: Array<BookId>) => Promise<void>
  isFinalizing: boolean
}

/**
 * ソートを確定し、ランキングを置き換える。
 *
 * 通常の完了は useAnswerComparisonMutation が回答と同一の書き込みで処理する。
 * このフックは「候補が除外・削除・読了で減り、2択を出さずに completed になった」
 * ケースのための経路。
 */
export const useFinalizeRankingMutation =
  (): UseFinalizeRankingMutationReturn => {
    const { uid } = useFirebaseAuthContext()
    const [isFinalizing, setIsFinalizing] = useState(false)

    // useEffect の依存配列から呼ばれるため、参照を安定させる
    const finalize = useCallback(
      async (order: Array<BookId>): Promise<void> => {
        if (!uid) throw new Error('認証エラー：再ログインしてください')

        setIsFinalizing(true)
        try {
          const dto: UpdateRankingDto = {
            status: 'idle',
            mode: null,
            candidateBookIds: [],
            decisions: [],
            rankedBookIds: order,
            updatedAt: serverTimestamp,
          }
          await updateRankingOperation(uid, dto)
        } catch (e) {
          toast.error(errorMessage(e))
          throw e
        } finally {
          setIsFinalizing(false)
        }
      },
      [uid],
    )

    return { finalize, isFinalizing }
  }
