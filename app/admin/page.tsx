'use client'

import { useCallback, useMemo, useState } from 'react'
import type { DeleteTarget, UnifiedItem } from './types'
import { useAuth } from './hooks/useAuth'
import { useAdminData } from './hooks/useAdminData'
import { useToast } from './hooks/useToast'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { useAutoRefresh } from './hooks/useAutoRefresh'
import { buildAdminItems } from './utils/items'
import { LoginForm } from './components/LoginForm'
import { AdminLayout } from './components/AdminLayout'
import { AdminToolbar } from './components/AdminToolbar'
import { StatsCards } from './components/StatsCards'
import { UnifiedTable } from './components/UnifiedTable'
import { DeleteConfirmModal } from './components/DeleteConfirmModal'
import { DetailModal } from './components/DetailModal'
import { ToastContainer } from './components/ToastContainer'
import './admin.css'

const emptyDeleteTarget: DeleteTarget = {
  isOpen: false,
  item: null
}

export default function AdminPage() {
  const { isAuthed, token, loading: authLoading, error: authError, login, logout } = useAuth()
  const {
    records,
    shortLinks,
    stats,
    loading: dataLoading,
    error: dataError,
    refetch,
    deleteRecord,
    deleteShortLink
  } = useAdminData(token)
  const { toasts, showToast, hideToast } = useToast()

  const [searchInput, setSearchInput] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(emptyDeleteTarget)
  const [deleting, setDeleting] = useState(false)
  const [detailItem, setDetailItem] = useState<UnifiedItem | null>(null)

  const searchTerm = useDebouncedValue(searchInput)
  const tableItems = useMemo(() => buildAdminItems(records, shortLinks), [records, shortLinks])

  useAutoRefresh({
    enabled: autoRefresh,
    active: isAuthed,
    onRefresh: refetch
  })

  const handleLogout = useCallback(() => {
    logout()
    setSearchInput('')
    setDeleteTarget(emptyDeleteTarget)
    setDetailItem(null)
  }, [logout])

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('success', '已复制到剪贴板')
    } catch {
      showToast('error', '复制失败')
    }
  }, [showToast])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget.item) return

    setDeleting(true)
    try {
      const success = deleteTarget.item.type === 'convert'
        ? await deleteRecord(deleteTarget.item.id)
        : await deleteShortLink(deleteTarget.item.id)

      if (success) {
        showToast('success', '删除成功')
        setDeleteTarget(emptyDeleteTarget)
      } else {
        showToast('error', '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      showToast('error', '删除失败')
    } finally {
      setDeleting(false)
    }
  }, [deleteRecord, deleteShortLink, deleteTarget.item, showToast])

  const deleteTitle = deleteTarget.item
    ? `删除${deleteTarget.item.type === 'convert' ? '订阅' : '短链接'}`
    : '删除'

  const deleteMessage = deleteTarget.item
    ? `确定要删除"${deleteTarget.item.name}"吗？${deleteTarget.item.type === 'convert' ? '删除后该订阅链接将无法使用。' : ''}`
    : ''

  if (authLoading && !isAuthed) {
    return (
      <div className="admin-root login-container">
        <div className="login-card auth-check-card">
          <h1 className="login-title">订阅管理</h1>
          <p className="login-subtitle">正在验证登录状态...</p>
        </div>
      </div>
    )
  }

  if (!isAuthed) {
    return (
      <>
        <LoginForm onLogin={login} loading={authLoading} error={authError} />
        <ToastContainer toasts={toasts} onClose={hideToast} />
      </>
    )
  }

  return (
    <>
      <AdminLayout onLogout={handleLogout}>
        <StatsCards
          stats={stats}
          loading={dataLoading}
          shortLinksCount={shortLinks.length}
        />

        <AdminToolbar
          searchValue={searchInput}
          autoRefresh={autoRefresh}
          loading={dataLoading}
          onSearchChange={setSearchInput}
          onAutoRefreshChange={setAutoRefresh}
          onRefresh={refetch}
        />

        {dataError && (
          <div className="admin-error-banner" role="alert">
            {dataError}
          </div>
        )}

        <UnifiedTable
          items={tableItems}
          recordsCount={records.length}
          shortLinksCount={shortLinks.length}
          loading={dataLoading}
          searchTerm={searchTerm}
          onDelete={(item) => setDeleteTarget({ isOpen: true, item })}
          onShowDetail={setDetailItem}
          onCopy={handleCopy}
        />
      </AdminLayout>

      <DeleteConfirmModal
        isOpen={deleteTarget.isOpen}
        onClose={() => setDeleteTarget(emptyDeleteTarget)}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title={deleteTitle}
        message={deleteMessage}
      />

      <DetailModal
        isOpen={detailItem !== null}
        onClose={() => setDetailItem(null)}
        onCopy={handleCopy}
        item={detailItem}
      />

      <ToastContainer toasts={toasts} onClose={hideToast} />
    </>
  )
}
