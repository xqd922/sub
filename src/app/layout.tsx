import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { DirectionProvider } from '@/components/foundations/direction/direction'
import { AppErrorBoundary } from '@/features/shared/components/app-error-boundary'
import { AppToaster } from '@/features/shared/components/app-toaster'
import '@/styles/globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  axes: ['opsz'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono-source',
  subsets: ['latin'],
  display: 'swap',
})

const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('boardui:theme');var dark=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);}catch(e){}})();`

export const metadata: Metadata = {
  title: '通用订阅转换',
  description: '自动识别客户端并转换为 Clash、sing-box 与 v2rayNG 配置',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      dir="ltr"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className="min-h-full bg-background-full font-sans text-text-primary"
        suppressHydrationWarning
      >
        <DirectionProvider locale="zh-CN">
          <AppErrorBoundary>{children}</AppErrorBoundary>
          <AppToaster />
        </DirectionProvider>
      </body>
    </html>
  )
}
