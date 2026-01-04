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
      <div className="text-center text-sm text-gray-400 py-4">
        共 {totalItems} 条记录
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
    <div className="flex items-center justify-between py-4">
      {/* 左侧：总数统计 */}
      <div className="text-sm text-gray-400">
        共 <span className="text-gray-600 font-medium">{totalItems}</span> 条记录
      </div>

      {/* 中间：页码 */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100
                     disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent
                     transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {pages.map((page, i) => (
          typeof page === 'number' ? (
            <button
              key={i}
              onClick={() => onPageChange(page)}
              className={`min-w-[36px] h-9 px-3 rounded-xl text-sm font-medium transition-colors
                ${page === currentPage
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/20'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
            >
              {page}
            </button>
          ) : (
            <span key={i} className="px-2 text-gray-300">...</span>
          )
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100
                     disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent
                     transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 右侧：页码信息 */}
      <div className="text-sm text-gray-400">
        第 <span className="text-gray-600 font-medium">{currentPage}</span> / {totalPages} 页
      </div>
    </div>
  )
}
