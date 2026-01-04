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

// 客户端类型样式
const clientStyles: Record<string, { bg: string; text: string }> = {
  'Clash': { bg: 'bg-cyan-50', text: 'text-cyan-600' },
  'Sing-box': { bg: 'bg-purple-50', text: 'text-purple-600' },
  'Browser': { bg: 'bg-green-50', text: 'text-green-600' }
}

const defaultClientStyle = { bg: 'bg-gray-50', text: 'text-gray-600' }

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
  const someSelected = selectedIds.size > 0 && !allSelected

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium">暂无记录</p>
        <p className="text-gray-400 text-sm mt-1">访问订阅链接后会自动记录</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-4 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected }}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500/20"
                />
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">名称</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">链接</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">客户端</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">节点</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">访问</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">最后访问</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">短链接</th>
              <th className="px-4 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.map((record) => {
              const shortLink = findShortLink(record)
              const style = clientStyles[record.clientType] || defaultClientStyle
              const isSelected = selectedIds.has(record.id)

              return (
                <tr
                  key={record.id}
                  className={`group transition-colors ${isSelected ? 'bg-cyan-50/50' : 'hover:bg-gray-50/50'}`}
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(record.id)}
                      className="w-4 h-4 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500/20"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-800 font-medium truncate max-w-[160px]" title={record.name}>
                      {record.name}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className="text-sm text-gray-400 font-mono truncate block max-w-[180px] cursor-help"
                      title={record.originalUrl}
                    >
                      {formatUrl(record.originalUrl, 22)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${style.bg} ${style.text}`}>
                      {record.clientType}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-600 tabular-nums">{record.nodeCount}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-600 tabular-nums">{record.hits}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-400">{formatRelativeTime(record.lastAccess)}</span>
                  </td>
                  <td className="px-4 py-4">
                    {shortLink ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onCopyShortLink(shortLink.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg
                                     bg-green-50 text-green-600 hover:bg-green-100
                                     text-xs font-mono transition-colors"
                          title="点击复制"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                          </svg>
                          {shortLink.id}
                        </button>
                        <button
                          onClick={() => onDeleteShortLink(shortLink.id)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded"
                          title="删除短链接"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onCreateShortLink(record)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg
                                   text-gray-400 hover:text-cyan-600 hover:bg-cyan-50
                                   text-xs transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        生成
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onCopySubUrl(record.id, record.originalUrl)}
                        className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                        title="复制订阅链接"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(record.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除记录"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
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
