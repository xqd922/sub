'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  RiArrowLeftLine,
  RiEyeLine,
  RiEyeOffLine,
  RiLockPasswordLine,
  RiUserLine,
} from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { ThemeIconButton } from '@/features/shared/components/theme-icon-button'

interface AdminLoginViewProps {
  onSubmit: (username: string, password: string) => Promise<boolean>
}

const COVER_PROTOCOLS = ['VLESS', 'Hysteria2', 'Snell', 'TUIC', 'WireGuard', 'AnyTLS'] as const

const COVER_TARGETS = [
  { name: 'Clash / Mihomo', format: 'YAML' },
  { name: 'sing-box 1.12+', format: 'JSON' },
  { name: 'v2rayNG / 通用', format: 'Base64' },
] as const

const LOGIN_FIELD_CLASS =
  'h-10 rounded-lg bg-background-primary-default px-3 ring-1 ring-inset ring-border-button-default hover:ring-border-button-hover focus-within:ring-2 focus-within:ring-accent-500'

export function AdminLoginView({ onSubmit }: AdminLoginViewProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!username.trim() || !password || loading) return

    setLoading(true)
    try {
      await onSubmit(username.trim(), password)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-background-full text-text-primary lg:grid-cols-2">
      {/* Left Cover Panel (Desktop) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-e border-cover-border bg-cover-bg p-10 text-cover-text lg:flex xl:p-14">
        <div aria-hidden className="login-cover-grid pointer-events-none absolute inset-0 opacity-45" />
        <div aria-hidden className="login-cover-glow pointer-events-none absolute inset-0" />

        {/* Top Brand */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="size-2.5 rounded-full bg-brand-cloudflare shadow-[0_0_12px_var(--color-brand-cloudflare)]"
            />
            <span className="text-body-semibold tracking-[-0.015em] text-cover-text">
              SubConvert
            </span>
          </div>
          <span className="rounded-md border border-cover-border bg-cover-surface/80 px-2.5 py-1 text-caption-2-medium tracking-wider text-cover-muted">
            EDGE CONSOLE
          </span>
        </div>

        {/* Center Editorial Hero + Edge Pipeline Card */}
        <div className="relative z-10 my-auto flex max-w-[480px] flex-col gap-7 py-10">
          <div>
            <p className="text-caption-1-medium tracking-wider text-brand-cloudflare uppercase">
              Cloudflare Edge Runtime
            </p>
            <h2 className="mt-2.5 text-display-4-semibold tracking-[-0.025em] text-cover-text">
              边缘订阅转换与
              <br />
              统一管控平台
            </h2>
            <p className="mt-3 text-body-regular leading-relaxed text-cover-muted">
              零运维边缘节点解析、短链访问控制、实时上游健康检测与动态分流规则，一次部署全端适配。
            </p>
          </div>

          {/* Crisp Developer Pipeline Preview Card */}
          <div className="overflow-hidden rounded-xl border border-cover-border bg-cover-surface/90 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-cover-border px-4 py-2.5">
              <div className="flex items-center gap-2 font-mono text-caption-2-medium text-cover-muted">
                <span className="size-2 rounded-full bg-kumo-success" aria-hidden />
                <span>edge-pipeline.ts</span>
              </div>
              <span className="font-mono text-caption-2-regular text-cover-muted">18 protocols</span>
            </div>

            <div className="flex flex-col gap-4 p-4">
              <div className="flex flex-wrap gap-1.5">
                {COVER_PROTOCOLS.map((protocol) => (
                  <span
                    key={protocol}
                    className="rounded-md border border-cover-border bg-cover-bg/70 px-2 py-0.5 font-mono text-caption-2-regular text-cover-text"
                  >
                    {protocol}
                  </span>
                ))}
                <span className="rounded-md border border-cover-border/70 px-2 py-0.5 font-mono text-caption-2-regular text-cover-muted">
                  +12
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-cover-border pt-3.5">
                {COVER_TARGETS.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-lg border border-cover-border/80 bg-cover-bg/60 px-2.5 py-2"
                  >
                    <div className="font-mono text-caption-2-semibold text-cover-text">
                      {item.format}
                    </div>
                    <div className="mt-0.5 truncate text-caption-1-regular text-cover-muted">
                      {item.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Compact Telemetry Highlights */}
          <div className="grid grid-cols-3 gap-4 border-t border-cover-border/70 pt-5">
            <div>
              <div className="text-title-3-semibold tabular-nums text-cover-text">18</div>
              <div className="mt-0.5 text-caption-1-regular text-cover-muted">双向解析协议</div>
            </div>
            <div>
              <div className="text-title-3-semibold tabular-nums text-cover-text">246</div>
              <div className="mt-0.5 text-caption-1-regular text-cover-muted">ISO 地区智能识别</div>
            </div>
            <div>
              <div className="font-mono text-title-3-semibold text-cover-text">KV</div>
              <div className="mt-0.5 text-caption-1-regular text-cover-muted">热更新动态规则</div>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="relative z-10 flex items-center justify-between text-caption-1-regular text-cover-muted">
          <span>Workers Edge · Bulk KV Read</span>
          <span>HMAC-SHA256 Auth</span>
        </div>
      </aside>

      {/* Right Login Panel */}
      <div className="flex min-h-dvh flex-col bg-background-full">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-separator-border/70 px-4 sm:px-6 lg:border-b-0 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-body-semibold tracking-[-0.015em] text-text-primary lg:hidden"
          >
            <span
              aria-hidden
              className="size-2 rounded-full bg-brand-cloudflare shadow-[0_0_8px_var(--color-brand-cloudflare)]"
            />
            <span>SubConvert</span>
          </Link>

          <div className="ms-auto flex items-center gap-1.5">
            <Link
              href="/"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-transparent px-2.5 text-body-2-regular text-text-secondary transition-colors duration-150 hover:border-separator-border hover:bg-background-primary-default hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <RiArrowLeftLine className="size-3.5" aria-hidden />
              <span>返回首页</span>
            </Link>
            <ThemeIconButton disableTooltip />
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[380px]">
            {/* Compact Mobile Cover Banner */}
            <div className="mb-6 flex items-center justify-between rounded-xl border border-cover-border bg-cover-bg px-4 py-3 text-cover-text lg:hidden">
              <div className="min-w-0">
                <p className="text-caption-2-medium tracking-wider text-brand-cloudflare">
                  EDGE CONSOLE
                </p>
                <p className="mt-0.5 truncate text-body-semibold text-cover-text">
                  边缘订阅转换与统一控制台
                </p>
              </div>
              <span className="shrink-0 rounded-md border border-cover-border bg-cover-surface px-2 py-0.5 text-caption-1-regular tabular-nums text-cover-muted">
                18 协议
              </span>
            </div>

            <div className="mb-7">
              <h1 className="text-title-1-semibold tracking-[-0.02em] text-text-primary">登录控制台</h1>
              <p className="mt-2 text-body-regular text-text-secondary">
                输入管理员凭据以管理订阅、短链与边缘分流规则
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="用户名"
                type="text"
                value={username}
                onChange={setUsername}
                placeholder="请输入管理员用户名"
                autoComplete="username"
                isRequired
                leadingIcon={RiUserLine}
                fieldClassName={LOGIN_FIELD_CLASS}
              />

              <Input
                label="密码"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                placeholder="请输入密码"
                autoComplete="current-password"
                isRequired
                leadingIcon={RiLockPasswordLine}
                fieldClassName={LOGIN_FIELD_CLASS}
                trailingAddon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-background-secondary-default hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                  >
                    {showPassword ? (
                      <RiEyeOffLine className="size-4" aria-hidden />
                    ) : (
                      <RiEyeLine className="size-4" aria-hidden />
                    )}
                  </button>
                }
              />

              <Button
                type="submit"
                variant="primary"
                size="medium"
                disabled={loading || !username.trim() || !password}
                className="mt-2 h-10 w-full"
              >
                {loading ? '验证中…' : '进入控制台'}
              </Button>
            </form>

            <p className="mt-6 text-center text-caption-1-regular text-text-tertiary">
              HttpOnly 安全会话 · 有效期内免重复登录
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
