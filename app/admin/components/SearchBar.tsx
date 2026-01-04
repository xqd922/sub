'use client'

interface SearchBarProps {
  search: string
  onSearchChange: (value: string) => void
  clientFilter: string
  onClientFilterChange: (value: string) => void
  sortBy: string
  onSortChange: (value: string) => void
}

export function SearchBar({
  search,
  onSearchChange,
  clientFilter,
  onClientFilterChange,
  sortBy,
  onSortChange
}: SearchBarProps) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* 搜索框 */}
        <div className="relative flex-1 min-w-[240px]">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="搜索名称或 URL..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border-0 rounded-xl
                       text-gray-800 placeholder-gray-400
                       focus:bg-gray-100 focus:ring-2 focus:ring-cyan-500/20
                       outline-none transition-all duration-200 text-sm"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 筛选器 */}
        <div className="flex items-center gap-2">
          {/* 客户端筛选 */}
          <div className="relative">
            <select
              value={clientFilter}
              onChange={(e) => onClientFilterChange(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 bg-gray-50 border-0 rounded-xl
                         text-gray-600 text-sm cursor-pointer
                         focus:bg-gray-100 focus:ring-2 focus:ring-cyan-500/20
                         outline-none transition-all duration-200"
            >
              <option value="">全部客户端</option>
              <option value="Clash">Clash</option>
              <option value="Sing-box">Sing-box</option>
              <option value="Browser">浏览器</option>
              <option value="Unknown">未知</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* 排序 */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 bg-gray-50 border-0 rounded-xl
                         text-gray-600 text-sm cursor-pointer
                         focus:bg-gray-100 focus:ring-2 focus:ring-cyan-500/20
                         outline-none transition-all duration-200"
            >
              <option value="lastAccess">最近访问</option>
              <option value="hits">访问量</option>
              <option value="nodeCount">节点数</option>
              <option value="createdAt">创建时间</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
