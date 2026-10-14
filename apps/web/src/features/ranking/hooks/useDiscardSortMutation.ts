import type { UpdateRankingDto } from '@bookpoolcontexts/common'
import { useState } from 'react'
import { toast } from 'sonner'

import { updateRankingOperation } from '@/infrastructure/firestore/rankings'
import { serverTimestamp } from '@/lib/firebase'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseDiscardSortMutationReturn = {
  discard: () => Promise<void>
  isDiscarding: boolean
}

/** 進行中のソートを破棄する。確定済みランキング（rankedBookIds）は保持する */
export const useDiscardSortMutation = (): UseDiscardSortMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isDiscarding, setIsDiscarding] = useState(false)

  const discard = async (): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')

    setIsDiscarding(true)
    try {
      const dto: UpdateRankingDto = {
        status: 'idle',
        mode: null,
        candidateBookIds: [],
        decisions: [],
        updatedAt: serverTimestamp,
      }
      await updateRankingOperation(uid, dto)
      toast.success('ソートを破棄しました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsDiscarding(false)
    }
  }

  return { discard, isDiscarding }
}
