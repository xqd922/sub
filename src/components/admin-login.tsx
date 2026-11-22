'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RiArrowLeftLine, RiLockPasswordLine, RiShieldKeyholeLine, RiUserLine } from '@remixicon/react'
import { ThemeToggle } from '@/components/application/theme/theme-toggle'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'

interface AdminLoginProps {
  onSubmit: (username: string, password: string) => Promise<boolean>
}

export default function AdminLogin({ onSubmit }: AdminLoginProps) {
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
    <section className="relative flex min-h-screen flex-col items-center justify-center bg-background-secondary-default px-4 py-10 text-text-primary sm:px-6">
      <div className="fixed end-5 top-5 z-10">
        <ThemeToggle appearance="segmented" size="small" />
      </div>

      <div className="w-full max-w-[400px]">
        <div className="rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-card sm:p-7">
          <div className="mb-6 flex flex-col items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-button-primary text-text-white shadow-xs">
              <RiShieldKeyholeLine className="size-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-title-2-medium text-text-primary">Sub Console</h1>
              <p className="mt-1 text-body-2-regular text-text-secondary">
                验证管理员身份以访问订阅转换控制台
              </p>
            </div>
          </div>

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

        <div className="mt-5 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-caption-1-medium text-text-secondary transition-colors duration-150 hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiArrowLeftLine className="size-3.5" aria-hidden />
            返回首页
          </Link>
        </div>
      </div>
    </section>
  )
}
