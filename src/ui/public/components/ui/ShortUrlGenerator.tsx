import { Button, Typography } from '@arco-design/web-react'
import { IconCopy, IconLink } from '@arco-design/web-react/icon'

const { Text, Paragraph } = Typography

interface ShortUrlGeneratorProps {
  hasConvertedUrl: boolean
  shortUrl: string
  loading: boolean
  onGenerate: () => void
  onCopy: () => void
}

export default function ShortUrlGenerator({
  hasConvertedUrl,
  shortUrl,
  loading,
  onGenerate,
  onCopy
}: ShortUrlGeneratorProps) {
  if (!hasConvertedUrl) return null

  if (!shortUrl) {
    return (
      <div className="shortlink-action-card">
        <div>
          <Text className="shortlink-title">短链接</Text>
          <p>生成更短的分享地址，便于在移动端或聊天工具中使用。</p>
        </div>
        <Button type="secondary" loading={loading} onClick={onGenerate}>
          {loading ? '生成中' : '生成短链接'}
        </Button>
      </div>
    )
  }

  return (
    <div className="result-card">
      <div className="result-card-head">
        <div className="result-title">
          <IconLink />
          <Text>短链接</Text>
        </div>
        <Button size="mini" type="text" icon={<IconCopy />} onClick={onCopy}>
          复制
        </Button>
      </div>
      <Paragraph className="result-link-box">
        {shortUrl}
      </Paragraph>
    </div>
  )
}
