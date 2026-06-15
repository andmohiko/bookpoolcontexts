import type { SharedGroup } from '@bookpoolcontexts/common'
import { useEffect, useState } from 'react'
import { subscribeSharedGroupsByUidOperation } from '@/infrastructure/firestore/sharedGroups'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseSharedGroupsReturn = {
  sharedGroups: Array<SharedGroup>
  isLoading: boolean
  error: string | null
}

export const useSharedGroups = (): UseSharedGroupsReturn => {
  const { uid } = useFirebaseAuthContext()
  const [sharedGroups, setSharedGroups] = useState<Array<SharedGroup>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return

    setIsLoading(true)
    const unsubscribe = subscribeSharedGroupsByUidOperation(
      uid,
      (updated) => {
        setSharedGroups(updated)
        setIsLoading(false)
      },
      (err) => {
        setError(errorMessage(err))
        setIsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [uid])

  return { sharedGroups, isLoading, error }
}
