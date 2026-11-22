'use client'

import { useState } from 'react'
import { RiPauseMiniFill, RiPlayMiniFill } from '@remixicon/react'
import { cx } from '@/utils/cx'

interface HomeSceneProps {
  pulseKey?: number
  onInteract?: () => void
}

export default function HomeScene({ pulseKey = 0, onInteract }: HomeSceneProps) {
  const [paused, setPaused] = useState(false)

  return (
    <div
      className={cx(
        'relative my-2 h-[142px] w-full select-none',
        onInteract && 'cursor-pointer',
        paused && 'sub-scene-paused',
      )}
      onClick={onInteract}
      role={onInteract ? 'button' : undefined}
      tabIndex={onInteract ? 0 : undefined}
      aria-label="湖岸节点路由线稿插画"
      onKeyDown={
        onInteract
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onInteract()
              }
            }
          : undefined
      }
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          setPaused((prev) => !prev)
        }}
        aria-label={paused ? '继续线稿动画' : '暂停线稿动画'}
        title={paused ? '继续动画' : '暂停动画'}
        className="absolute end-0.5 top-0.5 z-10 flex size-7 cursor-pointer items-center justify-center rounded-md text-text-tertiary transition-colors duration-150 hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
      >
        {paused ? <RiPlayMiniFill className="size-3.5" aria-hidden /> : <RiPauseMiniFill className="size-3.5" aria-hidden />}
      </button>

      <svg
        key={pulseKey}
        viewBox="0 0 500 142"
        className="block h-full w-full overflow-visible"
        aria-hidden
      >
        {/* 远山与湖面微景 */}
        <path
          d="M 146 106 Q 178 82 214 96 Q 248 76 286 92 Q 320 80 356 104"
          className="fill-none stroke-text-primary/15"
          strokeWidth={0.95}
          strokeLinecap="round"
        />
        <g className="sub-bird">
          <path
            d="M 218 40 q 4 -3 8 0 q 4 -3 8 0"
            className="fill-none stroke-text-primary/20"
            strokeWidth={0.9}
            strokeLinecap="round"
          />
          <path
            d="M 244 48 q 3 -2.5 6 0 q 3 -2.5 6 0"
            className="fill-none stroke-text-primary/18"
            strokeWidth={0.9}
            strokeLinecap="round"
          />
        </g>

        {/* 左岸书桌与终端 */}
        <path
          d="M 38 114 L 116 114"
          className="fill-none stroke-text-primary/55"
          strokeWidth={1.05}
          strokeLinecap="round"
        />
        <rect
          x="54"
          y="72"
          width="42"
          height="28"
          rx="4"
          className="fill-none stroke-text-primary/55"
          strokeWidth={1.05}
        />
        <path
          d="M 68 100 L 65 114 M 82 100 L 85 114 M 60 114 L 90 114"
          className="fill-none stroke-text-primary/55"
          strokeWidth={1.05}
          strokeLinecap="round"
        />
        <path
          d="M 62 82 L 74 82 M 62 88 L 82 88"
          className="fill-none stroke-text-primary/25"
          strokeWidth={0.95}
          strokeLinecap="round"
        />
        <circle cx="87" cy="88" r="1.7" className="fill-orange-500/90" />

        {/* 桌面水杯 */}
        <path
          d="M 102 104 h 9 v 8 a 2 2 0 0 1 -2 2 h -5 a 2 2 0 0 1 -2 -2 z"
          className="fill-none stroke-text-primary/50"
          strokeWidth={1}
          strokeLinejoin="round"
        />
        <path
          d="M 111 106 c 3 0 3 5 0 5"
          className="fill-none stroke-text-primary/30"
          strokeWidth={0.95}
          strokeLinecap="round"
        />

        {/* 跨湖路由虚线 */}
        <path
          d="M 86 68 Q 225 22 396 66"
          className="fill-none stroke-text-primary/25"
          strokeWidth={0.95}
          strokeDasharray="2.5 4.5"
          strokeLinecap="round"
        />
        <path
          d="M 86 74 Q 238 46 396 72"
          className="fill-none stroke-text-primary/14"
          strokeWidth={0.9}
          strokeDasharray="2 5"
          strokeLinecap="round"
        />

        {/* 缓缓飘过的路由光点 */}
        <circle r="2.2" className="sub-packet-1 fill-orange-500/90" />
        <circle r="1.7" className="sub-packet-2 fill-text-primary/45" />

        {/* 右岸湖畔路灯 */}
        <circle cx="422" cy="62" r="15" className="sub-lamp-halo fill-orange-500" />
        <path
          d="M 422 72 L 422 114"
          className="fill-none stroke-text-primary/55"
          strokeWidth={1.05}
          strokeLinecap="round"
        />
        <path
          d="M 414 72 L 430 72 L 427 56 L 417 56 Z"
          className="fill-none stroke-text-primary/55"
          strokeWidth={1.05}
          strokeLinejoin="round"
        />
        <path
          d="M 412 56 Q 422 49 432 56"
          className="fill-none stroke-text-primary/55"
          strokeWidth={1.05}
          strokeLinecap="round"
        />
        <line
          x1="422"
          y1="60"
          x2="422"
          y2="67"
          className="stroke-orange-500/90"
          strokeWidth={1.3}
          strokeLinecap="round"
        />
        <path
          d="M 386 114 L 462 114"
          className="fill-none stroke-text-primary/55"
          strokeWidth={1.05}
          strokeLinecap="round"
        />

        {/* 水纹 */}
        <g className="sub-wave">
          <line x1="154" y1="118" x2="212" y2="118" className="stroke-text-primary/14" strokeWidth={0.9} strokeLinecap="round" />
          <line x1="256" y1="122" x2="324" y2="122" className="stroke-text-primary/14" strokeWidth={0.9} strokeLinecap="round" />
          <line x1="196" y1="128" x2="242" y2="128" className="stroke-text-primary/14" strokeWidth={0.9} strokeLinecap="round" />
          <line x1="340" y1="118" x2="372" y2="118" className="stroke-text-primary/14" strokeWidth={0.9} strokeLinecap="round" />
        </g>

        {/* 地平基准线 */}
        <line x1="18" y1="134" x2="482" y2="134" className="stroke-text-primary/12" strokeWidth={0.9} strokeLinecap="round" />
      </svg>
    </div>
  )
}
