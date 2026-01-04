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
    <div className="flex items-center gap-3 mb-4 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
      <span className="text-sm text-neutral-600 dark:text-neutral-400">
        已选 {selectedCount} 项
      </span>
      <button
        onClick={onDelete}
        className="px-3 py-1 text-sm text-red-600 hover:text-red-700"
      >
        删除
      </button>
      <button
        onClick={onExport}
        className="px-3 py-1 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        导出
      </button>
      <button
        onClick={onClearSelection}
        className="px-3 py-1 text-sm text-neutral-500 hover:text-neutral-700"
      >
        取消
      </button>
    </div>
  )
}
