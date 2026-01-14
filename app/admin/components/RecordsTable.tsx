import { useMemo, useState } from 'react'
import { Chip, Button } from '@heroui/react'
import type { ConvertRecord, SortDescriptor } from '../types'
import { EmptyState } from './EmptyState'

interface RecordsTableProps {
  records: ConvertRecord[]
  loading: boolean
  onDelete: (id: string) => void
  onCopy: (text: string) => void
  searchTerm: string
}

export function RecordsTable({
  records,
  loading,
  onDelete,
  onCopy,
  searchTerm
}: RecordsTableProps) {
  const [page, setPage] = useState(1)
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'lastAccess',
    direction: 'descending'
  })

  const rowsPerPage = 10

  // 过滤和排序
  const filteredRecords = useMemo(() => {
    let filtered = records.filter(r =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.originalUrl.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // 排序
    filtered.sort((a, b) => {
      const column = sortDescriptor.column as keyof ConvertRecord
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
  }, [records, searchTerm, sortDescriptor])

  // 分页
  const pages = Math.ceil(filteredRecords.length / rowsPerPage)
  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage
    const end = start + rowsPerPage
    return filteredRecords.slice(start, end)
  }, [page, filteredRecords])

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  const formatUrl = (url: string) => {
    try {
      const u = new URL(url)
      return `${u.hostname}${u.pathname.slice(0, 20)}...`
    } catch {
      return url.slice(0, 30) + '...'
    }
  }

  const handleSort = (column: string) => {
    setSortDescriptor(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'ascending'
        ? 'descending'
        : 'ascending'
    }))
  }

  if (filteredRecords.length === 0 && !loading) {
    return (
      <EmptyState
        title={searchTerm ? '未找到匹配的记录' : '暂无记录'}
        description={searchTerm ? '尝试使用其他关键词搜索' : '开始使用订阅转换服务后，记录将显示在这里'}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-default-100">
            <tr>
              <th
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-default-200"
                onClick={() => handleSort('name')}
              >
                名称 {sortDescriptor.column === 'name' && (sortDescriptor.direction === 'ascending' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">原始链接</th>
              <th
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-default-200"
                onClick={() => handleSort('clientType')}
              >
                客户端 {sortDescriptor.column === 'clientType' && (sortDescriptor.direction === 'ascending' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-default-200"
                onClick={() => handleSort('nodeCount')}
              >
                节点数 {sortDescriptor.column === 'nodeCount' && (sortDescriptor.direction === 'ascending' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-default-200"
                onClick={() => handleSort('hits')}
              >
                访问 {sortDescriptor.column === 'hits' && (sortDescriptor.direction === 'ascending' ? '↑' : '↓')}
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
                <td colSpan={7} className="px-4 py-8 text-center text-default-500">
                  加载中...
                </td>
              </tr>
            ) : (
              items.map((record) => (
                <tr key={record.id} className="border-b border-default-200 hover:bg-default-50">
                  <td className="px-4 py-3">{record.name}</td>
                  <td className="px-4 py-3">
                    <span title={record.originalUrl} className="text-default-500 text-sm">
                      {formatUrl(record.originalUrl)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Chip size="sm" variant="soft">
                      {record.clientType}
                    </Chip>
                  </td>
                  <td className="px-4 py-3">{record.nodeCount}</td>
                  <td className="px-4 py-3">{record.hits}</td>
                  <td className="px-4 py-3 text-default-500 text-sm">
                    {formatDate(record.lastAccess)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => onCopy(`${window.location.origin}/sub/${record.id}`)}
                      >
                        复制
                      </Button>
                      <Button
                        size="sm"
                        className="text-danger hover:bg-danger/10"
                        variant="ghost"
                        onPress={() => onDelete(record.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
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
        共 {filteredRecords.length} 条记录
        {searchTerm && ` (筛选自 ${records.length} 条)`}
      </div>
    </div>
  )
}
