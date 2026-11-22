'use client'

import { RiCloseLine, RiLinkM } from '@remixicon/react'
import { cx } from '@/utils/cx'

interface UrlInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  loading?: boolean
}

export default function UrlInput({
  value,
  onChange,
  error,
  disabled,
  loading = false,
}: UrlInputProps) {
  const hasValue = value.trim().length > 0

  return (
    <div className="w-full">
      <div
        className={cx(
          'flex items-center gap-2 rounded-xl border border-separator-border bg-background-secondary-default ps-3.5 pe-1.5 py-1.5',
          'transition-[background-color,border-color,box-shadow] duration-150',
          'hover:border-border-button-default',
          'focus-within:border-border-button-default focus-within:bg-background-primary-default focus-within:shadow-xs',
          error && 'border-border-error-default bg-background-tertiary-error focus-within:border-border-error-default focus-within:bg-background-tertiary-error',
        )}
      >
        <RiLinkM className="size-4 shrink-0 text-text-tertiary" aria-hidden />

        <input
          type="text"
          dir="ltr"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="粘贴订阅链接"
          autoComplete="off"
          spellCheck={false}
          aria-label="订阅链接"
          aria-invalid={error ? true : undefined}
          className={cx(
            'min-w-0 flex-1 border-0 bg-transparent py-1.5 text-text-primary outline-none',
            'placeholder:text-text-tertiary',
            'disabled:cursor-not-allowed disabled:opacity-60',
            hasValue ? 'font-mono text-caption-1-regular' : 'text-body-regular',
          )}
        />

        {hasValue && !disabled ? (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="清空输入"
            className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-tertiary transition-colors duration-150 hover:bg-background-tertiary-default hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiCloseLine className="size-3.5" aria-hidden />
          </button>
        ) : null}

        <button
          type="submit"
          disabled={disabled}
          className={cx(
            'h-9 shrink-0 cursor-pointer rounded-lg border-0 px-4 text-body-2-medium transition-[background-color,color,opacity,transform] duration-150 active:scale-[0.98]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:ring-offset-1',
            hasValue
              ? 'bg-text-primary text-background-full hover:opacity-85'
              : 'bg-background-tertiary-default text-text-secondary hover:text-text-primary',
          )}
        >
          {loading ? '转换中…' : '转换'}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 ps-1 text-caption-1-regular text-text-error-primary">
          {error}
        </p>
      ) : null}
    </div>
  )
}
