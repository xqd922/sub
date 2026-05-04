import { Button, Typography } from '@arco-design/web-react'
import { IconCopy, IconLink } from '@arco-design/web-react/icon'

const { Text, Paragraph } = Typography

interface ResultItemProps {
  title: string
  url: string
  onCopy: () => void
}

export default function ResultItem({ title, url, onCopy }: ResultItemProps) {
  return (
    <div className="result-card">
      <div className="result-card-head">
        <div className="result-title">
          <IconLink />
          <Text>{title}</Text>
        </div>
        <Button size="mini" type="text" icon={<IconCopy />} onClick={onCopy}>
          复制
        </Button>
      </div>
      <Paragraph className="result-link-box">
        {url}
      </Paragraph>
    </div>
  )
}
