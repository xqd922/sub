/**
 * 安全的复制到剪贴板函数
 * 优先使用现代Clipboard API，如果不可用则回退到传统方法
 */
export async function copyToClipboard(text: string): Promise<boolean> {
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
    // 确保文本区域在视口内但不可见
    textArea.style.cssText = 'position:fixed;top:50%;left:50%;opacity:0;'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    try {
      document.execCommand('copy')
      textArea.remove()
      return true
    } catch (err) {
      console.error('复制失败:', err)
      textArea.remove()
      return false
    }
  } catch (err) {
    console.error('复制失败:', err)
    return false
  }
} 