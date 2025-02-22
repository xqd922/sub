'use client'

import { useEffect, useState } from 'react'
import * as QRCodeLib from 'qrcode'

interface QRCodeViewProps {
  url: string
  shortUrl?: string
}

export function QRCodeView({ url, shortUrl }: QRCodeViewProps) {
  const [qrCodeData, setQRCodeData] = useState('')

  useEffect(() => {
    // 直接使用订阅链接，客户端会自动识别
    QRCodeLib.toDataURL(shortUrl || url, {
      margin: 1,
      width: 160,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }).then(setQRCodeData)
  }, [url, shortUrl])

  if (!qrCodeData) return null

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-lg shadow">
      <div className="flex-1 space-y-2">
        <h3 className="text-xs text-gray-500 dark:text-gray-400">
          {shortUrl ? '短链接二维码' : '订阅二维码'}
        </h3>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          支持 Clash/Sing-box 客户端扫码导入
        </p>
      </div>
      <div className="flex-shrink-0">
        <img 
          src={qrCodeData} 
          alt="订阅二维码" 
          className="w-40 h-40 rounded-lg bg-white p-2"
        />
      </div>
    </div>
  )
} 