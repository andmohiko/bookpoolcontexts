import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'hideReadBooks'

const getStoredValue = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) === 'true'
}

export type UseHideReadBooksReturn = {
  hideReadBooks: boolean
  setHideReadBooks: (value: boolean) => void
}

export const useHideReadBooks = (): UseHideReadBooksReturn => {
  const [hideReadBooks, setValue] = useState<boolean>(false)

  useEffect(() => {
    setValue(getStoredValue())
  }, [])

  const setHideReadBooks = useCallback((value: boolean): void => {
    setValue(value)
    window.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false')
  }, [])

  return { hideReadBooks, setHideReadBooks }
}
