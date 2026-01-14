'use client'

import { useState } from 'react'
import { Input, Button, Tabs } from '@heroui/react'
import { useAuth } from './hooks/useAuth'
import { useAdminData } from './hooks/useAdminData'
import { useToast } from './hooks/useToast'
import { LoginForm } from './components/LoginForm'
import { AdminLayout } from './components/AdminLayout'
import { StatsCards } from './components/StatsCards'
import { RecordsTable } from './components/RecordsTable'
import { ShortLinksTable } from './components/ShortLinksTable'
import { DeleteConfirmModal } from './components/DeleteConfirmModal'
import { ToastContainer } from './components/ToastContainer'
import type { TabType } from './types'

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

  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('records')
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
    setSearchTerm('')
    setActiveTab('records')
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

  // 防抖搜索
  const handleSearch = (value: string) => {
    setSearchTerm(value)
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
        <div className="flex flex-wrap gap-4">
          <Input
            type="text"
            placeholder="搜索名称或链接..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Button
            variant="ghost"
            onClick={refetch}
            isDisabled={dataLoading}
          >
            {dataLoading ? '刷新中...' : '刷新'}
          </Button>
        </div>

        {/* 标签页 */}
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as TabType)}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="管理选项">
              <Tabs.Tab id="records">
                <span>转换记录</span>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="shortlinks">
                <span>短链接</span>
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel id="records">
            <RecordsTable
              records={records}
              loading={dataLoading}
              onDelete={(id) => {
                const record = records.find(r => r.id === id)
                if (record) {
                  openDeleteModal('record', id, record.name)
                }
              }}
              onCopy={handleCopy}
              searchTerm={searchTerm}
            />
          </Tabs.Panel>

          <Tabs.Panel id="shortlinks">
            <ShortLinksTable
              shortLinks={shortLinks}
              loading={dataLoading}
              onDelete={(id) => {
                const link = shortLinks.find(l => l.id === id)
                if (link) {
                  openDeleteModal('shortlink', id, link.name)
                }
              }}
              onCopy={handleCopy}
              searchTerm={searchTerm}
            />
          </Tabs.Panel>
        </Tabs>
      </AdminLayout>

      {/* 删除确认弹窗 */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        loading={deleting}
        title={`删除${deleteModal.type === 'record' ? '记录' : '短链接'}`}
        message={`确定要删除"${deleteModal.name}"吗？${deleteModal.type === 'record' ? '删除后该订阅链接将无法使用。' : ''}`}
      />

      {/* Toast 通知 */}
      <ToastContainer toasts={toasts} onClose={hideToast} />
    </>
  )
}
