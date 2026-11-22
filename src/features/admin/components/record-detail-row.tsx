'use client'

import type { ConvertRecord } from '@/shared/admin.types'
import { formatDateTime } from '@/shared/format.utils'

interface RecordDetailRowProps {
  record: ConvertRecord
}

export function RecordDetailRow({ record }: RecordDetailRowProps) {
  return (
    <tr className="bg-background-secondary-default/70">
      <td colSpan={8} className="px-5 py-3.5">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-caption-1-regular sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="inline text-text-tertiary">订阅链接：</dt>
            <dd dir="ltr" className="inline font-mono break-all text-text-primary">
              {record.originalUrl}
            </dd>
          </div>
          <div>
            <dt className="inline text-text-tertiary">ID：</dt>
            <dd dir="ltr" className="inline font-mono text-text-primary">
              {record.id}
            </dd>
          </div>
          <div>
            <dt className="inline text-text-tertiary">最后 IP：</dt>
            <dd dir="ltr" className="inline font-mono text-text-primary">
              {record.lastIp || '—'}
            </dd>
          </div>
          <div>
            <dt className="inline text-text-tertiary">创建时间：</dt>
            <dd className="inline tabular-nums text-text-secondary">
              {formatDateTime(record.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="inline text-text-tertiary">更新时间：</dt>
            <dd className="inline tabular-nums text-text-secondary">
              {formatDateTime(record.updatedAt)}
            </dd>
          </div>
          <div>
            <dt className="inline text-text-tertiary">最后访问：</dt>
            <dd className="inline tabular-nums text-text-secondary">
              {formatDateTime(record.lastAccess)}
            </dd>
          </div>
        </dl>
      </td>
    </tr>
  )
}
