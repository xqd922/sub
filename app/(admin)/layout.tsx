// TODO: 管理面板布局 — 侧边栏、导航菜单
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* TODO: 侧边栏导航 */}
      <main className="p-6">
        {children}
      </main>
    </div>
  )
}
