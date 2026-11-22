import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { AppErrorBoundary } from '@/features/shared/components/app-error-boundary'
import { AppProviders } from '@/features/shared/components/app-providers'
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

const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('boardui:theme');var dark=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);document.documentElement.setAttribute('data-mode',dark?'dark':'light');}catch(e){}})();`

export const metadata: Metadata = {
  title: 'SubConvert · 通用订阅转换',
  description: '边缘实时解析 18 种代理协议，自动识别客户端输出 Clash、sing-box 与 v2rayNG 配置',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      dir="ltr"
      data-mode="light"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className="isolate min-h-full bg-background-full font-sans text-text-primary"
        suppressHydrationWarning
      >
        <AppProviders>
          <AppErrorBoundary>{children}</AppErrorBoundary>
          <AppToaster />
        </AppProviders>
      </body>
    </html>
  )
}
