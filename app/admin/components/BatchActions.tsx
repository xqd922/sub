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
    <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
      <span className="text-sm text-blue-700 dark:text-blue-300">
        已选择 {selectedCount} 项
      </span>
      <button
        onClick={onDelete}
        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
      >
        批量删除
      </button>
      <button
        onClick={onExport}
        className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
      >
        导出 CSV
      </button>
      <button
        onClick={onClearSelection}
        className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800"
      >
        取消选择
      </button>
    </div>
  )
}
