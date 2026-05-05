import { Button, Typography } from "@arco-design/web-react";

const { Text } = Typography;

interface ResultItemProps {
  title: string;
  description: string;
  value: string;
  actionLabel?: string;
  onCopy: () => void;
}

export function ResultItem({ title, description, value, actionLabel = "复制", onCopy }: ResultItemProps) {
  return (
    <div className="result-card">
      <div className="result-card-header">
        <div>
          <Text className="result-title">{title}</Text>
          <Text className="result-description">{description}</Text>
        </div>
        <Button type="primary" className="public-secondary-button" onClick={onCopy}>
          {actionLabel}
        </Button>
      </div>
      <code className="result-value">{value}</code>
    </div>
  );
}
