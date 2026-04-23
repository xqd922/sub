import { useEffect, useMemo, useState } from 'react'
import { Button, Chip, Skeleton } from '@heroui/react'
import type { SortDescriptor, TypeFilter, UnifiedItem } from '../types'
import { buildShareLink, formatAdminDate, formatCompactUrl } from '../utils/items'
import { EmptyState } from './EmptyState'

interface UnifiedTableProps {
  items: UnifiedItem[]
  loading: boolean
  recordsCount: number
  shortLinksCount: number
  searchTerm: string
  onCopy: (text: string) => void
  onDelete: (item: UnifiedItem) => void
  onShowDetail: (item: UnifiedItem) => void
}

const ROWS_PER_PAGE = 15

const typeLabels: Record<TypeFilter, string> = {
  all: '全部',
  convert: '订阅',
  shortlink: '短链'
}

export function UnifiedTable({
  items,
  loading,
  recordsCount,
  shortLinksCount,
  searchTerm,
  onCopy,
  onDelete,
  onShowDetail
}: UnifiedTableProps) {
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'lastAccess',
    direction: 'descending'
  })

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const filteredItems = useMemo(() => {
    return [...items]
      .filter((item) => {
        if (typeFilter !== 'all' && item.type !== typeFilter) return false
        if (!normalizedSearch) return true

        return item.name.toLowerCase().includes(normalizedSearch) ||
          item.url.toLowerCase().includes(normalizedSearch)
      })
      .sort((a, b) => {
        const first = a[sortDescriptor.column]
        const second = b[sortDescriptor.column]

        const cmp = typeof first === 'string'
          ? first.localeCompare(String(second), 'zh-CN')
          : first - Number(second)

        return sortDescriptor.direction === 'descending' ? -cmp : cmp
      })
  }, [items, normalizedSearch, sortDescriptor, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ROWS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE
    return filteredItems.slice(start, start + ROWS_PER_PAGE)
  }, [currentPage, filteredItems])

  useEffect(() => {
    setPage(1)
  }, [normalizedSearch, typeFilter])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const handleSort = (column: SortDescriptor['column']) => {
    setSortDescriptor((current) => ({
      column,
      direction: current.column === column && current.direction === 'ascending'
        ? 'descending'
        : 'ascending'
    }))
  }

  const getSortIndicator = (column: SortDescriptor['column']) => {
    if (sortDescriptor.column !== column) return null
    return sortDescriptor.direction === 'ascending' ? '↑' : '↓'
  }

  const getFilterCount = (filter: TypeFilter) => {
    if (filter === 'convert') return recordsCount
    if (filter === 'shortlink') return shortLinksCount
    return items.length
  }

  const renderFilterButton = (filter: TypeFilter) => (
    <button
      key={filter}
      type="button"
      className={`filter-btn ${typeFilter === filter ? 'active' : ''}`}
      onClick={() => setTypeFilter(filter)}
    >
      {typeLabels[filter]} ({getFilterCount(filter)})
    </button>
  )

  return (
    <div className="table-card">
      <div className="type-filter">
        {(['all', 'convert', 'shortlink'] as TypeFilter[]).map(renderFilterButton)}
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th
                className={sortDescriptor.column === 'name' ? 'sorted' : ''}
                onClick={() => handleSort('name')}
              >
                名称
                <span className="sort-indicator">{getSortIndicator('name')}</span>
              </th>
              <th>原始链接</th>
              <th>访问链接</th>
              <th
                className={sortDescriptor.column === 'hits' ? 'sorted' : ''}
                onClick={() => handleSort('hits')}
              >
                访问
                <span className="sort-indicator">{getSortIndicator('hits')}</span>
              </th>
              <th
                className={sortDescriptor.column === 'lastAccess' ? 'sorted' : ''}
                onClick={() => handleSort('lastAccess')}
              >
                最后访问
                <span className="sort-indicator">{getSortIndicator('lastAccess')}</span>
              </th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <tr key={`skeleton-${index}`}>
                  <td><Skeleton className="h-4 w-32 rounded-lg" /></td>
                  <td><Skeleton className="h-4 w-40 rounded-lg" /></td>
                  <td><Skeleton className="h-4 w-24 rounded-lg" /></td>
                  <td><Skeleton className="h-4 w-12 rounded-lg" /></td>
                  <td><Skeleton className="h-4 w-36 rounded-lg" /></td>
                  <td>
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-14 rounded-lg" />
                      <Skeleton className="h-8 w-14 rounded-lg" />
                    </div>
                  </td>
                </tr>
              ))
            ) : pagedItems.length > 0 ? (
              pagedItems.map((item) => {
                const origin = typeof window === 'undefined' ? '' : window.location.origin
                const link = buildShareLink(item, origin)

                return (
                  <tr key={`${item.type}-${item.id}`}>
                    <td className="cell-name">
                      <div className="flex items-center gap-2">
                        <Chip
                          size="sm"
                          color={item.type === 'convert' ? 'accent' : 'default'}
                          variant="soft"
                        >
                          {item.type === 'convert' ? '订阅' : '短链'}
                        </Chip>
                        <span className="name-text">{item.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="cell-url" title={item.url}>
                        {formatCompactUrl(item.url)}
                      </span>
                    </td>
                    <td>
                      <span className="short-link" onClick={() => onCopy(link)}>
                        {origin ? link.replace(origin, '') : link}
                      </span>
                    </td>
                    <td className="cell-number">{item.hits}</td>
                    <td className="cell-date">{formatAdminDate(item.lastAccess)}</td>
                    <td>
                      <div className="row-actions">
                        <Button size="sm" variant="secondary" onPress={() => onCopy(link)}>
                          复制
                        </Button>
                        <Button size="sm" variant="secondary" onPress={() => onShowDetail(item)}>
                          详情
                        </Button>
                        <Button size="sm" variant="danger-soft" onPress={() => onDelete(item)}>
                          删除
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    title={searchTerm ? '未找到匹配项' : '暂无数据'}
                    description={searchTerm ? '尝试其他关键词' : '开始使用服务后，数据将显示在这里'}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <Button
            size="sm"
            variant="ghost"
            isDisabled={currentPage === 1}
            onPress={() => setPage((value) => Math.max(1, value - 1))}
          >
            上一页
          </Button>
          <span className="pagination-info">
            第 {currentPage} / {totalPages} 页
          </span>
          <Button
            size="sm"
            variant="ghost"
            isDisabled={currentPage === totalPages}
            onPress={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            下一页
          </Button>
        </div>
      )}

      <div className="record-count">
        共 {filteredItems.length} 条数据
        {searchTerm && ` (筛选自 ${items.length} 条)`}
      </div>
    </div>
  )
}
