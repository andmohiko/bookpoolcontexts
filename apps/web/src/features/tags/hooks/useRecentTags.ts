import type { Tag } from '@bookpoolcontexts/common'
import { useEffect, useState } from 'react'
import { subscribeRecentTagsOperation } from '@/infrastructure/firestore/tags'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

const RECENT_TAGS_COUNT = 10

export type UseRecentTagsReturn = {
  tags: Array<Tag>
  isLoading: boolean
  error: string | null
}

export const useRecentTags = (): UseRecentTagsReturn => {
  const { uid } = useFirebaseAuthContext()
  const [tags, setTags] = useState<Array<Tag>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return

    setIsLoading(true)
    const unsubscribe = subscribeRecentTagsOperation(
      uid,
      RECENT_TAGS_COUNT,
      (updatedTags) => {
        setTags(updatedTags)
        setIsLoading(false)
      },
      (err) => {
        setError(errorMessage(err))
        setIsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [uid])

  return { tags, isLoading, error }
}
