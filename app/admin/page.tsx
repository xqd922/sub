'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from './hooks/useAuth'
import { useAdminData } from './hooks/useAdminData'
import { useToast } from './hooks/useToast'
import { LoginForm } from './components/LoginForm'
import { AdminLayout } from './components/AdminLayout'
import { StatsCards } from './components/StatsCards'
import { UnifiedTable } from './components/UnifiedTable'
import { DeleteConfirmModal } from './components/DeleteConfirmModal'
import { ToastContainer } from './components/ToastContainer'
import './admin.css'

// 搜索图标
const SearchIcon = () => (
  <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

export default function AdminPage() {
  const { isAuthed, token, loading: authLoading, error: authError, login, logout } = useAuth()
  const {
    records,
    shortLinks,
    stats,
    loading: dataLoading,
    refetch,
    deleteRecord,
    deleteShortLink
  } = useAdminData(token)
  const { toasts, showToast, hideToast } = useToast()

  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 搜索防抖
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      setSearchTerm(searchInput)
    }, 300)
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [searchInput])

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    type: 'record' | 'shortlink'
    id: string
    name: string
  }>({
    isOpen: false,
    type: 'record',
    id: '',
    name: ''
  })
  const [deleting, setDeleting] = useState(false)

  // 处理登录
  const handleLogin = async (username: string, password: string) => {
    await login(username, password)
  }

  // 处理登出
  const handleLogout = () => {
    logout()
    setSearchInput('')
    setSearchTerm('')
  }

  // 打开删除确认弹窗
  const openDeleteModal = (type: 'record' | 'shortlink', id: string, name: string) => {
    setDeleteModal({ isOpen: true, type, id, name })
  }

  // 关闭删除确认弹窗
  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, type: 'record', id: '', name: '' })
  }

  // 确认删除
  const handleDelete = async () => {
    setDeleting(true)
    try {
      const success = deleteModal.type === 'record'
        ? await deleteRecord(deleteModal.id)
        : await deleteShortLink(deleteModal.id)

      if (success) {
        showToast('success', '删除成功')
        closeDeleteModal()
      } else {
        showToast('error', '删除失败')
      }
    } catch (err) {
      console.error('删除失败:', err)
      showToast('error', '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  // 复制到剪贴板
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('success', '已复制到剪贴板')
    } catch {
      showToast('error', '复制失败')
    }
  }

  // 登录界面
  if (!isAuthed) {
    return (
      <>
        <LoginForm
          onLogin={handleLogin}
          loading={authLoading}
          error={authError}
        />
        <ToastContainer toasts={toasts} onClose={hideToast} />
      </>
    )
  }

  // 管理界面
  return (
    <>
      <AdminLayout onLogout={handleLogout}>
        {/* 统计卡片 */}
        <StatsCards
          stats={stats}
          loading={dataLoading}
          shortLinksCount={shortLinks.length}
        />

        {/* 操作栏 */}
        <div className="actions-bar">
          <div className="search-input-wrapper">
            <SearchIcon />
            <input
              type="text"
              className="search-input"
              placeholder="搜索名称或链接..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button
            className="refresh-btn"
            onClick={refetch}
            disabled={dataLoading}
          >
            {dataLoading ? '刷新中...' : '刷新数据'}
          </button>
        </div>

        {/* 统一数据表格 */}
        <UnifiedTable
          records={records}
          shortLinks={shortLinks}
          loading={dataLoading}
          onDeleteRecord={(id) => {
            const record = records.find(r => r.id === id)
            if (record) {
              openDeleteModal('record', id, record.name)
            }
          }}
          onDeleteShortLink={(id) => {
            const link = shortLinks.find(l => l.id === id)
            if (link) {
              openDeleteModal('shortlink', id, link.name)
            }
          }}
          onCopy={handleCopy}
          searchTerm={searchTerm}
        />
      </AdminLayout>

      {/* 删除确认弹窗 */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        loading={deleting}
        title={`删除${deleteModal.type === 'record' ? '订阅' : '短链接'}`}
        message={`确定要删除"${deleteModal.name}"吗？${deleteModal.type === 'record' ? '删除后该订阅链接将无法使用。' : ''}`}
      />

      {/* Toast 通知 */}
      <ToastContainer toasts={toasts} onClose={hideToast} />
    </>
  )
}
