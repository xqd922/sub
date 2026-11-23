'use client'

import type { ReactNode } from 'react'
import {
  Dialog as AriaDialog,
  Heading as AriaHeading,
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
} from 'react-aria-components'
import { CloseButton } from '@/components/base/buttons/close-button'
import { useDirection } from '@/components/foundations/direction/direction'
import { ScrollFade, useScrollFade } from '@/components/foundations/scroll-fade/scroll-fade'
import { cx } from '@/utils/cx'

interface SideDrawerProps {
  isOpen: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  headerExtra?: ReactNode
  footer?: ReactNode
  widthClassName?: string
  children: ReactNode
}

export function SideDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  headerExtra,
  footer,
  widthClassName = 'max-w-[520px]',
  children,
}: SideDrawerProps) {
  const direction = useDirection()
  const fade = useScrollFade()

  return (
    <AriaModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      isDismissable
      dir={direction}
      className={cx(
        'group/drawer fixed inset-0 z-100 flex h-(--visual-viewport-height) items-end justify-center sm:items-stretch sm:justify-end',
        'bg-black/45 backdrop-blur-[2px]',
        'transition-opacity duration-220 ease-out',
        'data-[entering]:opacity-0 data-[exiting]:opacity-0',
      )}
    >
      <AriaModal
        className={cx(
          'relative flex max-h-[90dvh] w-full flex-col outline-none sm:h-full sm:max-h-none',
          widthClassName,
          'transform-gpu transition-transform duration-260 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'max-sm:data-[entering]:translate-y-full max-sm:data-[exiting]:translate-y-full',
          'sm:ltr:data-[entering]:translate-x-full sm:ltr:data-[exiting]:translate-x-full',
          'sm:rtl:data-[entering]:-translate-x-full sm:rtl:data-[exiting]:-translate-x-full',
        )}
      >
        <AriaDialog
          className={cx(
            'flex max-h-[90dvh] min-h-0 flex-col overflow-clip outline-none sm:h-full sm:max-h-none',
            'rounded-t-3xl border-t border-separator-border bg-background-primary-default shadow-xl sm:rounded-none sm:border-t-0 sm:border-s',
          )}
        >
          <div
            aria-hidden
            className="flex shrink-0 justify-center bg-background-secondary-default/65 pt-2.5 pb-1 sm:hidden"
          >
            <span className="h-1 w-9 rounded-full bg-separator-border-strong" />
          </div>

          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-separator-border bg-background-secondary-default/65 px-4 pb-3.5 pt-2 sm:px-5 sm:pb-4 sm:pt-[calc(env(safe-area-inset-top)+1rem)]">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <AriaHeading
                  slot="title"
                  className="truncate text-headline-semibold text-text-primary sm:text-title-3-semibold"
                >
                  {title}
                </AriaHeading>
                {headerExtra}
              </div>
              {subtitle ? (
                <p className="mt-1 truncate font-mono text-caption-1-regular text-text-tertiary">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <CloseButton
              size="sm"
              aria-label="关闭抽屉"
              onClick={onClose}
              className="-me-1 shrink-0"
            />
          </header>

          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              onScroll={fade.onScroll}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
            >
              {children}
            </div>
            <ScrollFade
              progress={fade.progress}
              surfaceClassName="from-background-primary-default"
            />
          </div>

          {footer ? (
            <footer className="flex shrink-0 flex-col items-stretch justify-between gap-2 border-t border-separator-border bg-background-secondary-default/55 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
              {footer}
            </footer>
          ) : null}
        </AriaDialog>
      </AriaModal>
    </AriaModalOverlay>
  )
}
