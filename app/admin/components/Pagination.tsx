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
      <div className="text-center text-sm text-gray-500 py-4">
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
      <div className="text-sm text-gray-500">
        共 <span className="text-white font-medium">{totalItems}</span> 条记录
      </div>

      {/* 中间：页码 */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#27272a]
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
              className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors
                ${page === currentPage
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white hover:bg-[#27272a]'
                }`}
            >
              {page}
            </button>
          ) : (
            <span key={i} className="px-1 text-gray-600">...</span>
          )
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#27272a]
                     disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent
                     transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 右侧：页码跳转（可选，留空保持对称） */}
      <div className="text-sm text-gray-500">
        第 <span className="text-white font-medium">{currentPage}</span> / {totalPages} 页
      </div>
    </div>
  )
}
