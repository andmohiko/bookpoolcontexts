import { useEffect, useState } from 'react'
import type { Group } from '@bookpoolcontexts/common'
import { subscribeGroupsOperation } from '@/infrastructure/firestore/groups'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseGroupsReturn = {
  groups: Array<Group>
  isLoading: boolean
  error: string | null
}

export const useGroups = (): UseGroupsReturn => {
  const { uid } = useFirebaseAuthContext()
  const [groups, setGroups] = useState<Array<Group>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return

    setIsLoading(true)
    const unsubscribe = subscribeGroupsOperation(
      uid,
      (updatedGroups) => {
        setGroups(updatedGroups)
        setIsLoading(false)
      },
      (err) => {
        setError(errorMessage(err))
        setIsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [uid])

  return { groups, isLoading, error }
}
