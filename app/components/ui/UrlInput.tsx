import { Input, Typography } from '@arco-design/web-react'

const { Text } = Typography
const TextArea = Input.TextArea

interface UrlInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

export default function UrlInput({ value, onChange, error }: UrlInputProps) {
  return (
    <div className="url-input-group">
      <div className="field-label-row">
        <Text className="field-label">订阅原始地址</Text>
        <Text className="field-hint">支持订阅 URL、单节点链接或 Gist 原始地址</Text>
      </div>
      <TextArea
        value={value}
        onChange={onChange}
        placeholder="粘贴你的订阅链接，例如 https://example.com/sub 或 vmess://..."
        className="public-url-input"
        autoSize={{ minRows: 4, maxRows: 7 }}
        status={error ? 'error' : undefined}
      />
      {error && <Text className="field-error">{error}</Text>}
    </div>
  )
}
