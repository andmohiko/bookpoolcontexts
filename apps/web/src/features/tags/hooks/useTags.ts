import { useEffect, useState } from 'react'
import type { Tag } from '@bookpoolcontexts/common'
import { subscribeTagsOperation } from '@/infrastructure/firestore/tags'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseTagsReturn = {
  tags: Array<Tag>
  isLoading: boolean
  error: string | null
}

export const useTags = (): UseTagsReturn => {
  const { uid } = useFirebaseAuthContext()
  const [tags, setTags] = useState<Array<Tag>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return

    setIsLoading(true)
    const unsubscribe = subscribeTagsOperation(
      uid,
      (updatedTags) => {
        setTags([...updatedTags].sort((a, b) => b.count - a.count))
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
