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
    <div className="flex items-center gap-3 mb-4">
      <input
        type="text"
        placeholder="搜索..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 px-3 py-2 bg-white dark:bg-neutral-800
                   border border-neutral-200 dark:border-neutral-700 rounded
                   text-neutral-800 dark:text-neutral-100 text-sm
                   focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500"
      />

      <select
        value={clientFilter}
        onChange={(e) => onClientFilterChange(e.target.value)}
        className="px-3 py-2 bg-white dark:bg-neutral-800
                   border border-neutral-200 dark:border-neutral-700 rounded
                   text-neutral-800 dark:text-neutral-100 text-sm
                   focus:outline-none"
      >
        <option value="">全部</option>
        <option value="Clash">Clash</option>
        <option value="Sing-box">Sing-box</option>
        <option value="Browser">浏览器</option>
      </select>

      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value)}
        className="px-3 py-2 bg-white dark:bg-neutral-800
                   border border-neutral-200 dark:border-neutral-700 rounded
                   text-neutral-800 dark:text-neutral-100 text-sm
                   focus:outline-none"
      >
        <option value="lastAccess">最近访问</option>
        <option value="hits">访问量</option>
        <option value="createdAt">创建时间</option>
      </select>
    </div>
  )
}
