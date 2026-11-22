import { useEffect, useState } from 'react'

interface UseQrCodeOptions {
  enabled?: boolean
  width?: number
  margin?: number
}

interface QrResultState {
  target: string
  dataUrl: string | null
  failed: boolean
}

export function useQrCode(
  text: string,
  { enabled = true, width = 148, margin = 2 }: UseQrCodeOptions = {},
): { dataUrl: string | null; failed: boolean } {
  const [result, setResult] = useState<QrResultState | null>(null)

  useEffect(() => {
    if (!enabled || !text) return
    let cancelled = false

    const generate = async () => {
      try {
        const QRCode = (await import('qrcode')).default
        const generated = await QRCode.toDataURL(text, { width, margin })
        if (!cancelled) {
          setResult({ target: text, dataUrl: generated, failed: false })
        }
      } catch {
        if (!cancelled) {
          setResult({ target: text, dataUrl: null, failed: true })
        }
      }
    }

    void generate()
    return () => {
      cancelled = true
    }
  }, [enabled, text, width, margin])

  if (!enabled || !text || result?.target !== text) {
    return { dataUrl: null, failed: false }
  }

  return { dataUrl: result.dataUrl, failed: result.failed }
}
