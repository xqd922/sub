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
    <div className="flex flex-wrap gap-3 mb-4">
      {/* 搜索框 */}
      <input
        type="text"
        placeholder="搜索名称或URL..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                   focus:ring-2 focus:ring-blue-500 outline-none text-sm"
      />

      {/* 客户端筛选 */}
      <select
        value={clientFilter}
        onChange={(e) => onClientFilterChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      >
        <option value="">全部客户端</option>
        <option value="Clash">Clash</option>
        <option value="Sing-box">Sing-box</option>
        <option value="Browser">浏览器</option>
        <option value="Unknown">未知</option>
      </select>

      {/* 排序 */}
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      >
        <option value="lastAccess">最近访问</option>
        <option value="hits">访问量</option>
        <option value="nodeCount">节点数</option>
        <option value="createdAt">创建时间</option>
      </select>
    </div>
  )
}
