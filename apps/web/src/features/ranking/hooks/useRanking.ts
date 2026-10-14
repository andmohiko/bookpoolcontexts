import type { Ranking } from '@bookpoolcontexts/common'
import { useEffect, useState } from 'react'

import { subscribeRankingOperation } from '@/infrastructure/firestore/rankings'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseRankingReturn = {
  ranking: Ranking | null
  isLoading: boolean
  error: string | null
}

/** ユーザーのランキングドキュメントをリアルタイム購読する */
export const useRanking = (): UseRankingReturn => {
  const { uid } = useFirebaseAuthContext()
  const [ranking, setRanking] = useState<Ranking | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return

    setIsLoading(true)
    const unsubscribe = subscribeRankingOperation(
      uid,
      (updatedRanking) => {
        setRanking(updatedRanking)
        setIsLoading(false)
      },
      (err) => {
        setError(errorMessage(err))
        setIsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [uid])

  return { ranking, isLoading, error }
}
