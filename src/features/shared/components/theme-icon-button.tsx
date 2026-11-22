'use client'

import { RiMoonLine, RiSunLine } from '@remixicon/react'
import {
  applyThemeWithTransition,
  useThemeMode,
} from '@/components/application/theme/theme-toggle'
import { cx } from '@/utils/cx'

interface ThemeIconButtonProps {
  className?: string
}

export function ThemeIconButton({ className }: ThemeIconButtonProps) {
  const theme = useThemeMode()

  const handleToggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    const origin =
      event.clientX === 0 && event.clientY === 0
        ? null
        : { x: event.clientX, y: event.clientY }
    void applyThemeWithTransition(theme === 'dark' ? 'light' : 'dark', {
      origin,
      element: event.currentTarget,
    })
  }

  return (
    <button
      type="button"
      onClick={handleToggleTheme}
      aria-label={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
      title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
      className={cx(
        'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-tertiary transition-colors duration-150 hover:bg-background-secondary-default hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
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
}
