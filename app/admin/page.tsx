'use client'

import { useState, useEffect, useCallback } from 'react'

interface ConvertRecord {
  id: string
  originalUrl: string
  name: string
  clientType: string
  createdAt: number
  updatedAt: number
  lastAccess: number
  hits: number
  enabled: boolean
  nodeCount: number
  lastIp: string
}

interface ShortLink {
  id: string
  targetUrl: string
  name: string
  createdAt: number
  hits: number
  lastAccess: number
}

interface Stats {
  totalRecords: number
  totalHits: number
  todayHits: number
  activeRecords: number
}

type TabType = 'records' | 'shortlinks'

export default function AdminPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [isAuthed, setIsAuthed] = useState(false)
  const [records, setRecords] = useState<ConvertRecord[]>([])
  const [shortLinks, setShortLinks] = useState<ShortLink[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('records')

  const fetchData = useCallback(async () => {
    if (!token) return

    setLoading(true)
    setError('')

    try {
      const headers = { Authorization: `Bearer ${token}` }

      const [recordsRes, statsRes, shortLinksRes] = await Promise.all([
        fetch('/api/admin/records', { headers }),
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/shortlinks', { headers })
      ])

      if (recordsRes.status === 401 || statsRes.status === 401) {
        setError('Token 无效')
        setIsAuthed(false)
        return
      }

      const recordsData = await recordsRes.json() as { records?: ConvertRecord[] }
      const statsData = await statsRes.json() as Stats
      const shortLinksData = await shortLinksRes.json() as { shortLinks?: ShortLink[] }

      setRecords(recordsData.records || [])
      setStats(statsData)
      setShortLinks(shortLinksData.shortLinks || [])
      setIsAuthed(true)
    } catch (err) {
      setError('获取数据失败')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token')
    if (savedToken) {
      setToken(savedToken)
    }
  }, [])

  useEffect(() => {
    if (token) {
      fetchData()
    }
  }, [token, fetchData])

  const handleLogin = async () => {
    if (!username || !password) {
      setError('请输入用户名和密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await res.json() as { success?: boolean; token?: string; error?: string }

      if (!res.ok || !data.success) {
        setError(data.error || '登录失败')
        return
      }

      setToken(data.token || '')
      localStorage.setItem('admin_token', data.token || '')
      setIsAuthed(true)
    } catch {
      setError('登录请求失败')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    setToken('')
    setUsername('')
    setPassword('')
    setIsAuthed(false)
    setRecords([])
    setShortLinks([])
    setStats(null)
  }

  const toggleRecord = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/records/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        fetchData()
      }
    } catch (err) {
      console.error('切换状态失败:', err)
    }
  }

  const deleteRecord = async (id: string) => {
    if (!confirm('确定要删除这条记录吗？')) return

    try {
      const res = await fetch(`/api/admin/records/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        fetchData()
      }
    } catch (err) {
      console.error('删除失败:', err)
    }
  }

  const deleteShortLink = async (id: string) => {
    if (!confirm('确定要删除这个短链接吗？')) return

    try {
      const res = await fetch(`/api/admin/shortlinks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        fetchData()
      }
    } catch (err) {
      console.error('删除短链接失败:', err)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('已复制到剪贴板')
    } catch {
      alert('复制失败')
    }
  }

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

  // 登录界面
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
            管理面板
          </h1>

          {error && (
            <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded mb-4">
              {error}
            </div>
          )}

          <input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg mb-3
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 outline-none"
          />

          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg mb-4
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 outline-none"
          />

          <button
            onClick={handleLogin}
            disabled={!username || !password || loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </div>
      </div>
    )
  }

  // 管理界面
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            订阅转换管理
          </h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-red-600
                       dark:hover:text-red-400 transition-colors"
          >
            退出
          </button>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <div className="text-3xl font-bold text-blue-600">{stats.totalRecords}</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">总记录数</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <div className="text-3xl font-bold text-green-600">{stats.totalHits}</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">总访问次数</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <div className="text-3xl font-bold text-purple-600">{shortLinks.length}</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">短链接数</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <div className="text-3xl font-bold text-orange-600">{stats.activeRecords}</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">活跃记录</div>
            </div>
          </div>
        )}

        {/* 标签页 */}
        <div className="flex space-x-4 mb-4">
          <button
            onClick={() => setActiveTab('records')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'records'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            转换记录
          </button>
          <button
            onClick={() => setActiveTab('shortlinks')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'shortlinks'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            短链接
          </button>
          <div className="flex-1" />
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                       rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors
                       disabled:opacity-50"
          >
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>

        {/* 转换记录列表 */}
        {activeTab === 'records' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {records.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                暂无记录
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">名称</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">原始链接</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">客户端</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">节点数</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">访问</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">最后访问</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">状态</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{record.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          <span title={record.originalUrl}>{formatUrl(record.originalUrl)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                            {record.clientType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{record.nodeCount}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{record.hits}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(record.lastAccess)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            record.enabled
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {record.enabled ? '启用' : '禁用'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm space-x-2">
                          <button onClick={() => toggleRecord(record.id)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                            {record.enabled ? '禁用' : '启用'}
                          </button>
                          <button onClick={() => deleteRecord(record.id)} className="text-red-600 hover:text-red-800 dark:text-red-400">
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 短链接列表 */}
        {activeTab === 'shortlinks' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {shortLinks.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                暂无短链接
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">短链接</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">名称</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">访问次数</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">创建时间</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">最后访问</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {shortLinks.map((link) => (
                      <tr key={link.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-sm">
                          <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-blue-600 dark:text-blue-400">
                            /s/{link.id}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{link.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{link.hits}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(link.createdAt)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(link.lastAccess)}</td>
                        <td className="px-4 py-3 text-sm space-x-2">
                          <button
                            onClick={() => copyToClipboard(`${window.location.origin}/s/${link.id}`)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                          >
                            复制
                          </button>
                          <button onClick={() => deleteShortLink(link.id)} className="text-red-600 hover:text-red-800 dark:text-red-400">
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 底部信息 */}
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {activeTab === 'records' ? `共 ${records.length} 条记录` : `共 ${shortLinks.length} 个短链接`}
        </div>
      </div>
    </div>
  )
}
