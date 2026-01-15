interface AdminLayoutProps {
  children: React.ReactNode
  onLogout: () => void
}

export function AdminLayout({ children, onLogout }: AdminLayoutProps) {
  return (
    <div className="admin-root">
      <div className="admin-container">
        {/* 头部 */}
        <header className="admin-header">
          <h1 className="admin-title">订阅管理</h1>
          <button
            className="admin-logout-btn"
            onClick={onLogout}
          >
            退出登录
          </button>
        </header>

        {/* 内容区域 */}
        <main>{children}</main>
      </div>
    </div>
  )
}
