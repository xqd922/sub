'use client'

import { RiArrowRightLine, RiCloseLine, RiTerminalLine } from '@remixicon/react'
import { Kbd } from '@/components/base/kbd/kbd'
import { cx } from '@/utils/cx'

interface SubscriptionInputFormProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
  error?: string
  disabled?: boolean
  loading?: boolean
}

export function SubscriptionInputForm({
  value,
  onChange,
  onSubmit,
  error,
  disabled,
  loading = false,
}: SubscriptionInputFormProps) {
  const hasValue = value.trim().length > 0

  // 粘贴多行节点 URI 或多条订阅链接时自动用 `|` 拼接，避免单行输入框吞掉换行
  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text')
    if (!/[\r\n]/.test(pasted)) return

    const lines = pasted
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length > 1) {
      event.preventDefault()
      onChange(lines.join('|'))
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div
        className={cx(
          'flex items-center gap-2 rounded-xl border border-border-button-default bg-background-primary-default ps-3.5 pe-1.5 py-1.5 shadow-sm',
          'transition-[background-color,border-color,box-shadow] duration-150',
          'hover:border-border-button-hover',
          'focus-within:border-accent-500 focus-within:ring-3 focus-within:ring-accent-500/15',
          error &&
            'border-border-error-default focus-within:border-border-error-default focus-within:ring-border-error-default/20',
        )}
      >
        <RiTerminalLine
          className={cx(
            'size-4 shrink-0 transition-colors duration-150',
            hasValue ? 'text-accent-500' : 'text-foreground-icon-tertiary',
          )}
          aria-hidden
        />

        <input
          type="text"
          dir="ltr"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onPaste={handlePaste}
          placeholder="粘贴订阅链接或代理节点 URI（支持多行自动合并）"
          autoComplete="off"
          spellCheck={false}
          aria-label="订阅链接"
          aria-invalid={error ? true : undefined}
          className={cx(
            'min-w-0 flex-1 border-0 bg-transparent py-2 text-text-primary outline-none',
            'placeholder:text-text-tertiary',
            'disabled:cursor-not-allowed disabled:opacity-60',
            hasValue ? 'font-mono text-caption-1-regular' : 'text-body-2-regular',
          )}
        />

        {hasValue && !disabled ? (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="清空输入"
            className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-tertiary transition-colors duration-150 hover:bg-background-secondary-hover hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiCloseLine className="size-3.5" aria-hidden />
          </button>
        ) : (
          <Kbd className="hidden sm:inline-flex">↵</Kbd>
        )}

        <button
          type="submit"
          disabled={disabled}
          className={cx(
            'inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-0 px-4 text-body-2-medium transition-[background-color,color,opacity,transform] duration-150 active:scale-[0.98]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:ring-offset-1',
            hasValue
              ? 'bg-button-primary text-text-white shadow-xs'
              : 'border border-separator-border bg-background-secondary-default text-text-secondary hover:bg-background-secondary-hover hover:text-text-primary',
          )}
        >
          <span>{loading ? '转换中…' : '转换'}</span>
          {!loading ? <RiArrowRightLine className="size-3.5" aria-hidden /> : null}
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-border-error-default/40 bg-background-tertiary-error px-3 py-2 text-caption-1-medium text-text-error-primary"
        >
          {error}
        </p>
      ) : null}
    </form>
  )
}
