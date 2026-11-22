'use client'

import { useState } from 'react'
import Link from 'next/link'
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
    <div className="flex min-h-screen flex-col bg-background-full text-text-primary">
      <header className="flex items-center justify-end gap-1 px-5 pt-4 sm:px-6 sm:pt-5">
        <Link
          href="/"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-caption-1-medium text-text-tertiary transition-colors duration-150 hover:bg-background-secondary-default hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <RiArrowLeftLine className="size-3.5" aria-hidden />
          <span>首页</span>
        </Link>
        <ThemeIconButton />
      </header>

      <main className="flex flex-1 flex-col items-center px-5 pt-[15vh] pb-16 sm:px-6 sm:pt-[19vh]">
        <div className="w-full max-w-[380px]">
          <div className="mb-7 text-center">
            <h1 className="text-title-1-medium tracking-tight text-text-primary">管理后台</h1>
            <p className="mt-1.5 text-body-2-regular text-text-tertiary">
              验证管理员身份以访问订阅控制台
            </p>
          </div>

          <div className="rounded-xl border border-separator-border bg-background-secondary-default/55 p-5">
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
          </div>
        </div>
      </main>
    </div>
  )
}
