import { useState } from 'react'
import type { AmazonBookItem, SearchBooksResponse } from '@bookpoolcontexts/common'
import { authenticatedFetch } from '@/lib/api'
import { errorMessage } from '@/utils/errorMessage'

export type UseSearchBooksReturn = {
  results: AmazonBookItem[]
  isSearching: boolean
  error: string | null
  search: (keyword: string) => Promise<void>
  clearResults: () => void
}

export const useSearchBooks = (): UseSearchBooksReturn => {
  const [results, setResults] = useState<AmazonBookItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async (keyword: string): Promise<void> => {
    if (!keyword.trim()) return
    setIsSearching(true)
    setError(null)
    try {
      const data = await authenticatedFetch<SearchBooksResponse>(
        '/books/search',
        { keyword },
      )
      setResults(data.items)
    } catch (e) {
      setError(errorMessage(e))
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const clearResults = (): void => {
    setResults([])
    setError(null)
  }

  return { results, isSearching, error, search, clearResults }
}
