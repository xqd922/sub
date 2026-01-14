import { Button } from '@heroui/react'

interface AdminLayoutProps {
  children: React.ReactNode
  onLogout: () => void
}

export function AdminLayout({ children, onLogout }: AdminLayoutProps) {
  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 头部 */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">订阅转换管理</h1>
          <Button
            className="text-danger hover:bg-danger/10"
            onClick={onLogout}
          >
            退出
          </Button>
        </div>

        {/* 内容区域 */}
        {children}
      </div>
    </div>
  )
}
