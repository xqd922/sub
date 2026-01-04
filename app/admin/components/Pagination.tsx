'use client'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, totalItems, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return (
      <div className="text-center text-sm text-neutral-500 py-4">
        共 {totalItems} 条
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-4 text-sm">
      <span className="text-neutral-500">共 {totalItems} 条</span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded disabled:opacity-50"
        >
          上一页
        </button>

        <span className="px-3 py-1 text-neutral-600 dark:text-neutral-400">
          {currentPage} / {totalPages}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded disabled:opacity-50"
        >
          下一页
        </button>
      </div>
    </div>
  )
}
