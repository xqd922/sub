import { useCallback, useState } from 'react'

export function useClipboard() {
  const [isCopying, setIsCopying] = useState(false)

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    setIsCopying(true)

    try {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text)
          return true
        } catch {
          // 降级到 execCommand
        }
      }

      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.cssText = 'position:fixed;top:50%;left:50%;opacity:0;'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()

      try {
        const success = document.execCommand('copy')
        textArea.remove()
        return success
      } catch {
        textArea.remove()
        return false
      }
    } catch {
      return false
    } finally {
      setIsCopying(false)
    }
  }, [])

  return { copyToClipboard, isCopying }
}
