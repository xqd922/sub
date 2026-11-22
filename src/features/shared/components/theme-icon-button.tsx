'use client'

import { Tooltip } from '@cloudflare/kumo/components/tooltip'
import { RiMoonLine, RiSunLine } from '@remixicon/react'
import {
  applyThemeWithTransition,
  useThemeMode,
} from '@/components/application/theme/theme-toggle'
import { cx } from '@/utils/cx'

interface ThemeIconButtonProps {
  className?: string
  disableTooltip?: boolean
}

export function ThemeIconButton({ className, disableTooltip = false }: ThemeIconButtonProps) {
  const theme = useThemeMode()
  const label = theme === 'dark' ? '切换浅色模式' : '切换深色模式'

  const handleToggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    // 触摸设备上点击后主动失焦，避免残留 focus 状态或触发顶部浮层抖动
    if (event.detail > 0) {
      event.currentTarget.blur()
    }
    const origin =
      event.clientX === 0 && event.clientY === 0
        ? null
        : { x: event.clientX, y: event.clientY }
    void applyThemeWithTransition(theme === 'dark' ? 'light' : 'dark', {
      origin,
      element: event.currentTarget,
    })
  }

  const button = (
    <button
      type="button"
      onClick={handleToggleTheme}
      aria-label={label}
      className={cx(
        'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-background-secondary-hover hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
        className,
      )}
    >
      {theme === 'dark' ? (
        <RiSunLine className="size-4" aria-hidden />
      ) : (
        <RiMoonLine className="size-4" aria-hidden />
      )}
    </button>
  )

  if (disableTooltip) return button

  return <Tooltip content={label} side="bottom" render={button} />
}
