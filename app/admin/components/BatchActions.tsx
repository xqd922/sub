'use client'

interface BatchActionsProps {
  selectedCount: number
  onDelete: () => void
  onExport: () => void
  onClearSelection: () => void
}

export function BatchActions({ selectedCount, onDelete, onExport, onClearSelection }: BatchActionsProps) {
  if (selectedCount === 0) return null

  return (
    <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-[#18181b] border border-[#27272a] rounded-xl">
      {/* 选择计数 */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-white flex items-center justify-center">
          <span className="text-xs font-bold text-black">{selectedCount}</span>
        </div>
        <span className="text-sm text-gray-400">
          项已选择
        </span>
      </div>

      {/* 分隔线 */}
      <div className="h-5 w-px bg-[#27272a]" />

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm
                     bg-red-500/10 text-red-400 rounded-lg
                     hover:bg-red-500/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          删除
        </button>

        <button
          onClick={onExport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm
                     bg-[#27272a] text-gray-300 rounded-lg
                     hover:bg-[#3f3f46] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          导出 CSV
        </button>
      </div>

      {/* 清除选择按钮 */}
      <button
        onClick={onClearSelection}
        className="ml-auto p-1.5 text-gray-500 hover:text-gray-300
                   hover:bg-[#27272a] rounded-lg transition-colors"
        title="清除选择"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
