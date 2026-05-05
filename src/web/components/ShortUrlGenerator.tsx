import { Button, Typography } from "@arco-design/web-react";

const { Text } = Typography;

interface ShortUrlGeneratorProps {
  convertedUrl: string;
  shortUrl: string;
  loading: boolean;
  error: string;
  onGenerate: () => void;
  onCopy: () => void;
}

export function ShortUrlGenerator({
  convertedUrl,
  shortUrl,
  loading,
  error,
  onGenerate,
  onCopy,
}: ShortUrlGeneratorProps) {
  return (
    <div className="shortlink-action-card">
      <div>
        <Text className="result-title">短链接</Text>
        <Text className="result-description">生成更适合分享和导入客户端的短地址。</Text>
      </div>
      <div className="shortlink-actions">
        <Button
          type="primary"
          className="public-primary-button compact"
          loading={loading}
          disabled={!convertedUrl}
          onClick={onGenerate}
        >
          生成短链接
        </Button>
        {shortUrl && (
          <Button className="public-secondary-button" onClick={onCopy}>
            复制短链接
          </Button>
        )}
      </div>
      {shortUrl && <code className="result-value">{shortUrl}</code>}
      {error && <Text className="field-error">{error}</Text>}
    </div>
  );
}
