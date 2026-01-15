import { useMemo, useState } from 'react'
import { Chip, Button } from '@heroui/react'
import type { ShortLink, SortDescriptor } from '../types'
import { EmptyState } from './EmptyState'

interface ShortLinksTableProps {
  shortLinks: ShortLink[]
  loading: boolean
  onDelete: (id: string) => void
  onCopy: (text: string) => void
  searchTerm: string
}

export function ShortLinksTable({
  shortLinks,
  loading,
  onDelete,
  onCopy,
  searchTerm
}: ShortLinksTableProps) {
  const [page, setPage] = useState(1)
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'createdAt',
    direction: 'descending'
  })

  const rowsPerPage = 10

  // 过滤和排序
  const filteredLinks = useMemo(() => {
    let filtered = shortLinks.filter(l =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.id.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // 排序
    filtered.sort((a, b) => {
      const column = sortDescriptor.column as keyof ShortLink
      let first = a[column]
      let second = b[column]

      // 处理 undefined 值
      if (first === undefined) first = ''
      if (second === undefined) second = ''

      if (typeof first === 'string') first = first.toLowerCase()
      if (typeof second === 'string') second = second.toLowerCase()

      const cmp = first < second ? -1 : first > second ? 1 : 0
      return sortDescriptor.direction === 'descending' ? -cmp : cmp
    })

    return filtered
  }, [shortLinks, searchTerm, sortDescriptor])

  // 分页
  const pages = Math.ceil(filteredLinks.length / rowsPerPage)
  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage
    const end = start + rowsPerPage
    return filteredLinks.slice(start, end)
  }, [page, filteredLinks])

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  const handleSort = (column: string) => {
    setSortDescriptor(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'ascending'
        ? 'descending'
        : 'ascending'
    }))
  }

            return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-default-100">
            <tr>
              <th
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-default-200"
                onClick={() => handleSort('id')}
              >
                短链接 {sortDescriptor.column === 'id' && (sortDescriptor.direction === 'ascending' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-default-200"
                onClick={() => handleSort('name')}
              >
                名称 {sortDescriptor.column === 'name' && (sortDescriptor.direction === 'ascending' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-default-200"
                onClick={() => handleSort('hits')}
              >
                访问次数 {sortDescriptor.column === 'hits' && (sortDescriptor.direction === 'ascending' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-default-200"
                onClick={() => handleSort('createdAt')}
              >
                创建时间 {sortDescriptor.column === 'createdAt' && (sortDescriptor.direction === 'ascending' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-default-200"
                onClick={() => handleSort('lastAccess')}
              >
                最后访问 {sortDescriptor.column === 'lastAccess' && (sortDescriptor.direction === 'ascending' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-12">
                  <EmptyState title="加载中..." />
                </td>
              </tr>
            ) : items.length > 0 ? (
              items.map((link) => (
                <tr key={link.id} className="border-b border-default-200 hover:bg-default-50">
                  <td className="px-4 py-3">
                    <Chip size="sm" variant="soft">
                      /s/{link.id}
                    </Chip>
                  </td>
                  <td className="px-4 py-3">{link.name}</td>
                  <td className="px-4 py-3">{link.hits}</td>
                  <td className="px-4 py-3 text-default-500 text-sm">
                    {formatDate(link.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-default-500 text-sm">
                    {formatDate(link.lastAccess)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => onCopy(`${window.location.origin}/s/${link.id}`)}
                      >
                        复制
                      </Button>
                      <Button
                        size="sm"
                        className="text-danger hover:bg-danger/10"
                        variant="ghost"
                        onPress={() => onDelete(link.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-12">
                  <EmptyState
                    title={searchTerm ? '未找到匹配的短链接' : '暂无短链接'}
                    description={searchTerm ? '尝试使用其他关键词搜索' : '创建短链接后，将显示在这里'}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            isDisabled={page === 1}
            onPress={() => setPage(p => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <span className="flex items-center px-4 text-sm text-default-500">
            第 {page} / {pages} 页
          </span>
          <Button
            size="sm"
            variant="ghost"
            isDisabled={page === pages}
            onPress={() => setPage(p => Math.min(pages, p + 1))}
          >
            下一页
          </Button>
        </div>
      )}

      <div className="text-center text-sm text-default-500">
        共 {filteredLinks.length} 个短链接
        {searchTerm && ` (筛选自 ${shortLinks.length} 个)`}
      </div>
    </div>
  )
}
