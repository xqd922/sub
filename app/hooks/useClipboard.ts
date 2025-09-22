import { useState, useCallback } from 'react'

export function useClipboard() {
  const [isCopying, setIsCopying] = useState(false)

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    if (isCopying) return false
    
    setIsCopying(true)
    
    try {
      // 优先使用现代 API
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text)
          return true
        } catch {
          // 如果 clipboard API 失败，回退到传统方法
        }
      }

      // 传统方法作为回退
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
  }, [isCopying])

  return { copyToClipboard, isCopying }
}