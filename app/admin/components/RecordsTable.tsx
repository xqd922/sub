'use client'

import { formatRelativeTime } from '../utils/formatters'

interface ConvertRecord {
  id: string
  originalUrl: string
  name: string
  clientType: string
  createdAt: number
  updatedAt: number
  lastAccess: number
  hits: number
  nodeCount: number
  lastIp: string
}

interface ShortLink {
  id: string
  targetUrl: string
}

interface RecordsTableProps {
  records: ConvertRecord[]
  shortLinks: ShortLink[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onDelete: (id: string) => void
  onCopySubUrl: (id: string, url: string) => void
  onCreateShortLink: (record: ConvertRecord) => void
  onCopyShortLink: (shortId: string) => void
  onDeleteShortLink: (shortId: string) => void
}

export function RecordsTable({
  records,
  shortLinks,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onDelete,
  onCopySubUrl,
  onCreateShortLink,
  onCopyShortLink,
  onDeleteShortLink
}: RecordsTableProps) {
  const findShortLink = (record: ConvertRecord): ShortLink | undefined => {
    return shortLinks.find(s => s.targetUrl.includes(encodeURIComponent(record.originalUrl)))
  }

  const allSelected = records.length > 0 && records.every(r => selectedIds.has(r.id))

  if (records.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-8 text-center text-neutral-500">
        暂无记录
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
          <tr>
            <th className="px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="rounded"
              />
            </th>
            <th className="px-4 py-3 text-left text-neutral-600 dark:text-neutral-400 font-medium">名称</th>
            <th className="px-4 py-3 text-left text-neutral-600 dark:text-neutral-400 font-medium">客户端</th>
            <th className="px-4 py-3 text-left text-neutral-600 dark:text-neutral-400 font-medium">节点</th>
            <th className="px-4 py-3 text-left text-neutral-600 dark:text-neutral-400 font-medium">访问</th>
            <th className="px-4 py-3 text-left text-neutral-600 dark:text-neutral-400 font-medium">最后访问</th>
            <th className="px-4 py-3 text-right text-neutral-600 dark:text-neutral-400 font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
          {records.map((record) => {
            const shortLink = findShortLink(record)
            return (
              <tr key={record.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(record.id)}
                    onChange={() => onToggleSelect(record.id)}
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-3 text-neutral-800 dark:text-neutral-100">
                  <div className="max-w-[200px] truncate" title={record.name}>{record.name}</div>
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                  {record.clientType}
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                  {record.nodeCount}
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                  {record.hits}
                </td>
                <td className="px-4 py-3 text-neutral-500 dark:text-neutral-500">
                  {formatRelativeTime(record.lastAccess)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onCopySubUrl(record.id, record.originalUrl)}
                      className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                      title="复制链接"
                    >
                      复制
                    </button>
                    {shortLink ? (
                      <button
                        onClick={() => onCopyShortLink(shortLink.id)}
                        className="text-green-600 hover:text-green-700"
                        title="复制短链"
                      >
                        短链
                      </button>
                    ) : (
                      <button
                        onClick={() => onCreateShortLink(record)}
                        className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                        title="生成短链"
                      >
                        短链
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(record.id)}
                      className="text-red-500 hover:text-red-600"
                      title="删除"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
