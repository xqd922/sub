'use client'

import { useState } from 'react'
import { useAdminSystem, useAutoRefresh, type SystemStatus } from '@/components/use-admin-data'
import { showToast } from '@/components/use-toast'

interface AdminSystemProps {
  autoRefresh: boolean
  onUnauthorized?: () => void
}

const CONFIG_ITEMS: Array<{ key: keyof SystemStatus['config']; label: string }> = [
  { key: 'adminPassword', label: '管理员密码 ADMIN_PASSWORD' },
  { key: 'adminUsername', label: '管理员用户名 ADMIN_USERNAME' },
  { key: 'adminSecret', label: '会话密钥 ADMIN_SECRET（可选）' },
  { key: 'siteUrl', label: '站点地址 SITE_URL' },
  { key: 'sink', label: 'Sink 短链服务' },
  { key: 'bitly', label: 'Bitly 短链服务' },
  { key: 'cuttly', label: 'Cuttly 短链服务' }
]

export default function AdminSystem({ autoRefresh, onUnauthorized }: AdminSystemProps) {
  const { system, loading, refresh, pingKV, rebuildIndex } = useAdminSystem(onUnauthorized)
  const [pingResult, setPingResult] = useState<string | null>(null)
  const [rebuildResult, setRebuildResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useAutoRefresh(refresh, autoRefresh)

  const handlePingKV = async () => {
    setBusy(true)
    setPingResult(null)
    const result = await pingKV()
    if (result) {
      setPingResult(result.ok ? `✓ 连通正常，耗时 ${result.latencyMs}ms` : '✗ 读写校验失败')
      showToast(result.ok ? 'KV 存储连通正常' : 'KV 存储异常', result.ok ? 'success' : 'error')
    }
    setBusy(false)
  }

  const handleRebuildIndex = async () => {
    if (!window.confirm('索引重建将扫描全部 KV 键并重写记录与短链索引，用于修复并发导致的索引丢失。继续？')) return

    setBusy(true)
    setRebuildResult(null)
    const result = await rebuildIndex()
    if (result) {
      setRebuildResult(
        `记录 ${result.recordIndexed} 条（修复 ${result.recordRepaired}）· 短链 ${result.shortIndexed} 条（修复 ${result.shortRepaired}）`
      )
      showToast(`索引重建完成，修复了 ${result.recordRepaired + result.shortRepaired} 条丢失的索引项`, 'success')
    }
    setBusy(false)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg sm:rounded-xl p-4 sm:p-5">
          <h2 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">环境配置状态</h2>
          {loading ? (
            <p className="text-xs text-gray-400 py-6 text-center">加载中...</p>
          ) : !system ? (
            <p className="text-xs text-gray-400 py-6 text-center">无法获取系统状态</p>
          ) : (
            <div className="space-y-2">
              <ConfigRow label="KV 存储" ok={system.kvAvailable} okText="可用" failText="不可用" />
              {CONFIG_ITEMS.map(item => (
                <ConfigRow key={item.key} label={item.label} ok={system.config[item.key]} />
              ))}
              <p className="text-[10px] text-gray-400 dark:text-gray-500 pt-1">仅显示配置状态，不回显具体值</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg sm:rounded-xl p-4 sm:p-5 space-y-3">
            <h2 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">存储维护</h2>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => void handlePingKV()}
                disabled={busy}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200/50 dark:border-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-black/50 disabled:opacity-40"
              >
                KV 连通性测试
              </button>
              <button
                onClick={() => void handleRebuildIndex()}
                disabled={busy}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200/50 dark:border-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-black/50 disabled:opacity-40"
              >
                重建索引
              </button>
            </div>

            {pingResult && <p className="text-[11px] text-gray-500 dark:text-gray-400">{pingResult}</p>}
            {rebuildResult && <p className="text-[11px] text-gray-500 dark:text-gray-400">{rebuildResult}</p>}

            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              索引重建可修复并发写入导致的历史记录在列表中丢失的问题
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg sm:rounded-xl overflow-hidden">
        <h2 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 px-4 pt-4 pb-2">登录审计</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="border-b border-gray-200/50 dark:border-gray-700/50 text-[10px] text-gray-400 dark:text-gray-500">
                <th className="pl-4 px-2 py-2">时间</th>
                <th className="px-2 py-2">IP</th>
                <th className="px-2 py-2">结果</th>
                <th className="px-2 pr-4 py-2">User-Agent</th>
              </tr>
            </thead>
            <tbody>
              {!system || system.loginLog.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-xs text-gray-400">暂无登录记录</td></tr>
              ) : (
                system.loginLog.map((entry, index) => (
                  <tr key={`${entry.time}-${index}`} className="border-b border-gray-200/30 dark:border-gray-700/30 text-xs last:border-b-0">
                    <td className="pl-4 px-2 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(entry.time).toLocaleString('zh-CN', { hour12: false })}
                    </td>
                    <td className="px-2 py-2 font-mono text-gray-600 dark:text-gray-300">{entry.ip}</td>
                    <td className="px-2 py-2">
                      {entry.ok ? (
                        <span className="text-green-600 dark:text-green-400">成功</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">失败</span>
                      )}
                    </td>
                    <td className="px-2 pr-4 py-2 max-w-64 truncate text-[10px] text-gray-400 dark:text-gray-500" title={entry.userAgent}>
                      {entry.userAgent || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ConfigRow({ label, ok, okText = '已配置', failText = '未配置' }: { label: string; ok: boolean; okText?: string; failText?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-gray-600 dark:text-gray-300 truncate" title={label}>{label}</span>
      {ok ? (
        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-[10px]">
          ✓ {okText}
        </span>
      ) : (
        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-500/10 text-gray-500 dark:text-gray-400 text-[10px]">
          ✗ {failText}
        </span>
      )}
    </div>
  )
}
