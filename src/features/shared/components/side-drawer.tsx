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
        'group/drawer fixed inset-0 z-100 flex h-(--visual-viewport-height) justify-end',
        'bg-black/45 backdrop-blur-[2px]',
        'transition-opacity duration-220 ease-out',
        'data-[entering]:opacity-0 data-[exiting]:opacity-0',
      )}
    >
      <AriaModal
        className={cx(
          'relative flex h-full w-full flex-col outline-none',
          widthClassName,
          'transform-gpu transition-transform duration-260 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'ltr:data-[entering]:translate-x-full ltr:data-[exiting]:translate-x-full',
          'rtl:data-[entering]:-translate-x-full rtl:data-[exiting]:-translate-x-full',
        )}
      >
        <AriaDialog
          className={cx(
            'flex h-full min-h-0 flex-col overflow-clip outline-none',
            'border-s border-separator-border bg-background-primary-default shadow-xl',
          )}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-separator-border bg-background-secondary-default/65 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <AriaHeading
                  slot="title"
                  className="truncate text-headline-semibold text-text-primary"
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
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4"
            >
              {children}
            </div>
            <ScrollFade
              progress={fade.progress}
              surfaceClassName="from-background-primary-default"
            />
          </div>

          {footer ? (
            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-separator-border bg-background-secondary-default/55 px-5 py-3">
              {footer}
            </footer>
          ) : null}
        </AriaDialog>
      </AriaModal>
    </AriaModalOverlay>
  )
}
