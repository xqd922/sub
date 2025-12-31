'use client'

import { formatRelativeTime, formatUrl } from '../utils/formatters'

interface ShortLink {
  id: string
  targetUrl: string
  name: string
  createdAt: number
  hits: number
  lastAccess: number
}

interface ShortLinksTableProps {
  shortLinks: ShortLink[]
  highlightId?: string
  onCopy: (id: string) => void
  onDelete: (id: string) => void
}

export function ShortLinksTable({ shortLinks, highlightId, onCopy, onDelete }: ShortLinksTableProps) {
  if (shortLinks.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
        暂无短链接
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">短链接</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">名称</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">目标地址</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">访问次数</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">创建时间</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">最后访问</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {shortLinks.map((link) => (
              <tr
                key={link.id}
                className={`hover:bg-gray-50 dark:hover:bg-gray-700/50
                  ${highlightId === link.id ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
              >
                <td className="px-4 py-3 text-sm">
                  <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-blue-600 dark:text-blue-400">
                    /s/{link.id}
                  </code>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{link.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  <span title={link.targetUrl} className="cursor-help">
                    {formatUrl(link.targetUrl, 35)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{link.hits}</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatRelativeTime(link.createdAt)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatRelativeTime(link.lastAccess)}
                </td>
                <td className="px-4 py-3 text-sm space-x-2">
                  <button
                    onClick={() => onCopy(link.id)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    复制
                  </button>
                  <button
                    onClick={() => onDelete(link.id)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
