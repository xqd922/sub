'use client'

import { cx } from '@/utils/cx'

interface UrlInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
}

export default function UrlInput({ value, onChange, error, disabled }: UrlInputProps) {
  const hasValue = value.trim().length > 0

  return (
    <div className="min-w-0 flex-1">
      <input
        type="text"
        dir="ltr"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="粘贴订阅链接、GitHub Gist 或单节点地址……"
        autoComplete="off"
        spellCheck={false}
        aria-label="订阅链接"
        aria-invalid={error ? true : undefined}
        className={cx(
          'w-full rounded-lg border-0 bg-background-secondary-default px-3.5 py-2.5 text-text-primary outline-none transition-[background-color,box-shadow] duration-150',
          'placeholder:text-text-tertiary',
          'hover:bg-background-secondary-hover',
          'focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-text-primary/25',
          'disabled:cursor-not-allowed disabled:opacity-60',
          hasValue ? 'font-mono text-caption-1-regular' : 'text-body-2-regular',
          error && 'bg-background-tertiary-error ring-1 ring-inset ring-border-error-default',
        )}
      />
      {error ? (
        <p role="alert" className="mt-1.5 text-caption-1-regular text-text-error-primary">
          {error}
        </p>
      ) : null}
    </div>
  )
}
