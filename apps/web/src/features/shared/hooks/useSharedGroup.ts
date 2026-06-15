import type { SharedGroup } from '@bookpoolcontexts/common'
import { useEffect, useState } from 'react'
import { getSharedGroupOperation } from '@/infrastructure/firestore/sharedGroups'
import { errorMessage } from '@/utils/errorMessage'

export type UseSharedGroupReturn = {
  /** undefined: ローディング中, null: 存在しない */
  sharedGroup: SharedGroup | null | undefined
  isLoading: boolean
  error: string | null
}

export const useSharedGroup = (sharedGroupId: string): UseSharedGroupReturn => {
  const [sharedGroup, setSharedGroup] = useState<
    SharedGroup | null | undefined
  >(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async (): Promise<void> => {
      setIsLoading(true)
      try {
        const result = await getSharedGroupOperation(sharedGroupId)
        setSharedGroup(result)
      } catch (e) {
        setError(errorMessage(e))
        setSharedGroup(null)
      } finally {
        setIsLoading(false)
      }
    }
    fetch()
  }, [sharedGroupId])

  return { sharedGroup, isLoading, error }
}
