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

// 客户端类型对应的颜色和图标
const clientStyles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  'Clash': {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    )
  },
  'Sing-box': {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    )
  },
  'Browser': {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    )
  }
}

const defaultClientStyle = {
  bg: 'bg-gray-500/10',
  text: 'text-gray-400',
  icon: (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  )
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
  const someSelected = selectedIds.size > 0 && !allSelected

  if (records.length === 0) {
    return (
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#27272a] flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p className="text-gray-500">暂无记录</p>
        <p className="text-gray-600 text-sm mt-1">访问订阅链接后会自动记录</p>
      </div>
    )
  }

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#27272a]">
              <th className="px-4 py-3 text-left">
                <label className="relative flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected }}
                    onChange={onToggleSelectAll}
                    className="peer sr-only"
                  />
                  <div className="w-4 h-4 border border-[#3f3f46] rounded bg-[#27272a]
                                  peer-checked:bg-white peer-checked:border-white
                                  transition-colors flex items-center justify-center">
                    <svg className="w-3 h-3 text-black hidden peer-checked:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </label>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">链接</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">客户端</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">节点</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">访问</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最后访问</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">短链接</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#27272a]">
            {records.map((record) => {
              const shortLink = findShortLink(record)
              const style = clientStyles[record.clientType] || defaultClientStyle
              const isSelected = selectedIds.has(record.id)

              return (
                <tr
                  key={record.id}
                  className={`group transition-colors ${isSelected ? 'bg-[#27272a]/50' : 'hover:bg-[#1f1f23]'}`}
                >
                  <td className="px-4 py-3">
                    <label className="relative flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(record.id)}
                        className="peer sr-only"
                      />
                      <div className={`w-4 h-4 border rounded transition-colors flex items-center justify-center
                                      ${isSelected
                                        ? 'bg-white border-white'
                                        : 'border-[#3f3f46] bg-[#27272a] group-hover:border-[#52525b]'}`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-white font-medium truncate max-w-[160px]" title={record.name}>
                      {record.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-sm text-gray-500 font-mono truncate block max-w-[180px] cursor-help"
                      title={record.originalUrl}
                    >
                      {formatUrl(record.originalUrl, 22)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${style.bg} ${style.text}`}>
                      {style.icon}
                      {record.clientType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-white tabular-nums">{record.nodeCount}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-white tabular-nums">{record.hits}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">{formatRelativeTime(record.lastAccess)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {shortLink ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onCopyShortLink(shortLink.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md
                                     bg-green-500/10 text-green-400 hover:bg-green-500/20
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
                          className="p-1 text-gray-500 hover:text-red-400 transition-colors rounded"
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
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md
                                   text-gray-500 hover:text-white hover:bg-[#27272a]
                                   text-xs transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        生成
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onCopySubUrl(record.id, record.originalUrl)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-[#27272a] rounded-md transition-colors"
                        title="复制订阅链接"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(record.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
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
