import { Button, SearchField } from '@heroui/react'

interface AdminToolbarProps {
  searchValue: string
  autoRefresh: boolean
  loading: boolean
  onSearchChange: (value: string) => void
  onAutoRefreshChange: (enabled: boolean) => void
  onRefresh: () => void | Promise<void>
}

export function AdminToolbar({
  searchValue,
  autoRefresh,
  loading,
  onSearchChange,
  onAutoRefreshChange,
  onRefresh
}: AdminToolbarProps) {
  return (
    <div className="actions-bar">
      <SearchField
        value={searchValue}
        onChange={onSearchChange}
        className="flex-1 min-w-[240px]"
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="搜索名称或链接..." />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      <label className="auto-refresh-toggle">
        <input
          type="checkbox"
          checked={autoRefresh}
          onChange={(event) => onAutoRefreshChange(event.target.checked)}
        />
        <span>自动刷新</span>
      </label>

      <Button
        variant="secondary"
        onPress={() => void onRefresh()}
        isDisabled={loading}
      >
        {loading ? '刷新中...' : '刷新数据'}
      </Button>
    </div>
  )
}
