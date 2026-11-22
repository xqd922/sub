import type { Metadata } from 'next'
import { AdminConsole } from '@/features/admin/components/admin-console'

export const metadata: Metadata = {
  title: '管理后台 · 通用订阅转换',
}

export default function AdminPage() {
  return <AdminConsole />
}
