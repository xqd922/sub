'use client'

import { formatRelativeTime, formatUrl } from '../utils/formatters'

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
  // 找到记录对应的短链接
  const findShortLink = (record: ConvertRecord): ShortLink | undefined => {
    return shortLinks.find(s => s.targetUrl.includes(encodeURIComponent(record.originalUrl)))
  }

  const allSelected = records.length > 0 && records.every(r => selectedIds.has(r.id))

  if (records.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
        暂无记录
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 rounded"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">名称</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">原始链接</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">客户端</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">节点</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">访问</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">最后访问</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">短链接</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {records.map((record) => {
              const shortLink = findShortLink(record)
              return (
                <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(record.id)}
                      onChange={() => onToggleSelect(record.id)}
                      className="w-4 h-4 rounded"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                    {record.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    <span title={record.originalUrl} className="cursor-help">
                      {formatUrl(record.originalUrl, 25)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                      {record.clientType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{record.nodeCount}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{record.hits}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(record.lastAccess)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {shortLink ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onCopyShortLink(shortLink.id)}
                          className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs"
                          title="点击复制"
                        >
                          /s/{shortLink.id}
                        </button>
                        <button
                          onClick={() => onDeleteShortLink(shortLink.id)}
                          className="text-gray-400 hover:text-red-500 text-xs ml-1"
                          title="删除短链接"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onCreateShortLink(record)}
                        className="text-gray-500 hover:text-blue-600 text-xs"
                      >
                        + 生成
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    <button
                      onClick={() => onCopySubUrl(record.id, record.originalUrl)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      复制
                    </button>
                    <button
                      onClick={() => onDelete(record.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
