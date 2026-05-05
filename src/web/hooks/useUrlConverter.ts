import { useCallback, useState } from "react";

export function useUrlConverter() {
  const [inputUrl, setInputUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [convertedUrl, setConvertedUrl] = useState("");

  const handleConvert = useCallback(() => {
    const trimmed = inputUrl.trim();
    if (!trimmed) {
      setError("请输入订阅链接");
      return;
    }

    try {
      new URL(trimmed);
    } catch {
      setError("请输入有效的 URL");
      return;
    }

    setLoading(true);
    setError("");
    const nextUrl = `${window.location.origin}/sub?url=${encodeURIComponent(trimmed)}`;
    setConvertedUrl(nextUrl);
    window.setTimeout(() => setLoading(false), 160);
  }, [inputUrl]);

  return {
    inputUrl,
    setInputUrl,
    loading,
    error,
    convertedUrl,
    handleConvert,
  };
}
