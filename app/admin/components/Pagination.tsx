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
      <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
        共 {totalItems} 条
      </div>
    )
  }

  const pages: (number | string)[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1 rounded text-sm bg-gray-100 dark:bg-gray-700
                   disabled:opacity-50 disabled:cursor-not-allowed
                   hover:bg-gray-200 dark:hover:bg-gray-600"
      >
        上一页
      </button>

      {pages.map((page, i) => (
        typeof page === 'number' ? (
          <button
            key={i}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1 rounded text-sm
              ${page === currentPage
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
          >
            {page}
          </button>
        ) : (
          <span key={i} className="px-2 text-gray-400">...</span>
        )
      ))}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1 rounded text-sm bg-gray-100 dark:bg-gray-700
                   disabled:opacity-50 disabled:cursor-not-allowed
                   hover:bg-gray-200 dark:hover:bg-gray-600"
      >
        下一页
      </button>

      <span className="ml-4 text-sm text-gray-500 dark:text-gray-400">
        共 {totalItems} 条
      </span>
    </div>
  )
}
