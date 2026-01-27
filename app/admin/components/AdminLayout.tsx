import { Button } from '@heroui/react'

interface AdminLayoutProps {
  children: React.ReactNode
  onLogout: () => void
}

export function AdminLayout({ children, onLogout }: AdminLayoutProps) {
  return (
    <div className="admin-root">
      <div className="admin-container">
        <header className="admin-header">
          <h1 className="admin-title">订阅管理</h1>
          <Button variant="ghost" className="text-[var(--apple-red)]" onPress={onLogout}>
            退出登录
          </Button>
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}
