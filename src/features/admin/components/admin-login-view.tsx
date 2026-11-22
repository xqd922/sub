'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@cloudflare/kumo/components/badge'
import { LayerCard } from '@cloudflare/kumo/components/layer-card'
import { RiArrowLeftLine, RiLockPasswordLine, RiUserLine } from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { ThemeIconButton } from '@/features/shared/components/theme-icon-button'

interface AdminLoginViewProps {
  onSubmit: (username: string, password: string) => Promise<boolean>
}

export function AdminLoginView({ onSubmit }: AdminLoginViewProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!password || loading) return

    setLoading(true)
    try {
      await onSubmit(username.trim(), password)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-background-full text-text-primary">
      <div
        aria-hidden
        className="console-dot-grid pointer-events-none fixed inset-0 opacity-60 [mask-image:radial-gradient(ellipse_55%_45%_at_50%_30%,#000_20%,transparent_100%)]"
      />

      <header className="relative z-10 flex h-13 items-center justify-between border-b border-separator-border/80 bg-background-full/80 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="size-2 rounded-full bg-brand-cloudflare shadow-[0_0_8px_var(--color-brand-cloudflare)]"
          />
          <span className="font-mono text-body-2-semibold tracking-tight text-text-primary">
            SubConvert
          </span>
          <span className="text-caption-1-regular text-text-tertiary">/</span>
          <span className="font-mono text-caption-1-medium text-text-secondary">Console</span>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-transparent px-2.5 text-caption-1-medium text-text-secondary transition-colors duration-150 hover:border-separator-border hover:bg-background-primary-default hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiArrowLeftLine className="size-3.5" aria-hidden />
            <span>返回首页</span>
          </Link>
          <ThemeIconButton />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-5 pt-[14vh] pb-16 sm:px-6 sm:pt-[18vh]">
        <div className="w-full max-w-[400px]">
          <LayerCard className="overflow-hidden shadow-sm">
            <LayerCard.Secondary className="flex items-center justify-between px-5 py-3.5">
              <div>
                <h1 className="text-body-semibold text-text-primary">管理员登录</h1>
                <p className="mt-0.5 text-caption-1-regular text-text-tertiary">
                  验证身份以访问订阅控制台
                </p>
              </div>
              <Badge variant="outline" className="font-mono">
                Auth
              </Badge>
            </LayerCard.Secondary>

            <LayerCard.Primary className="p-5">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="用户名"
                  type="text"
                  value={username}
                  onChange={setUsername}
                  placeholder="未配置则留空"
                  autoComplete="username"
                  leadingIcon={RiUserLine}
                />

                <Input
                  label="密码"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="请输入管理员密码"
                  autoComplete="current-password"
                  isRequired
                  leadingIcon={RiLockPasswordLine}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="medium"
                  disabled={loading || !password}
                  className="mt-1 w-full"
                >
                  {loading ? '验证中…' : '进入控制台'}
                </Button>
              </form>
            </LayerCard.Primary>
          </LayerCard>
        </div>
      </main>
    </div>
  )
}
