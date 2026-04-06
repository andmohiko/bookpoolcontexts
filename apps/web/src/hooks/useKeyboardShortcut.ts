import { useEffect } from 'react'

type Options = {
  meta?: boolean
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
}

/**
 * キーボードショートカットを登録するカスタムフック。
 * input / textarea / contentEditable にフォーカスがある場合は発火しない。
 */
export const useKeyboardShortcut = (
  key: string,
  callback: (e: KeyboardEvent) => void,
  options: Options = {},
) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== key) return
      if (!!options.meta !== e.metaKey) return
      if (!!options.ctrl !== e.ctrlKey) return
      if (!!options.alt !== e.altKey) return
      if (!!options.shift !== e.shiftKey) return

      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return

      callback(e)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [key, callback, options.meta, options.ctrl, options.alt, options.shift])
}
