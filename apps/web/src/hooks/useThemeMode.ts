import { useCallback, useEffect, useMemo, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'auto'

const STORAGE_KEY = 'theme'

const getStoredMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'auto'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored
  return 'auto'
}

const applyTheme = (mode: ThemeMode) => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode

  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(resolved)

  if (mode === 'auto') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', mode)
  }

  document.documentElement.style.colorScheme = resolved
}

export const useThemeMode = () => {
  const [mode, setMode] = useState<ThemeMode>('auto')

  useEffect(() => {
    const initialMode = getStoredMode()
    setMode(initialMode)
    applyTheme(initialMode)
  }, [])

  useEffect(() => {
    if (mode !== 'auto') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('auto')

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [mode])

  const setThemeMode = useCallback((newMode: ThemeMode) => {
    setMode(newMode)
    applyTheme(newMode)
    window.localStorage.setItem(STORAGE_KEY, newMode)
  }, [])

  const resolvedTheme = useMemo(() => {
    if (mode !== 'auto') return mode
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }, [mode])

  return { mode, resolvedTheme, setThemeMode }
}
