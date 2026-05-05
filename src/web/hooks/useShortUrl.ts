import { useCallback, useState } from "react";

export function useShortUrl() {
  const [shortUrl, setShortUrl] = useState("");
  const [shortLoading, setShortLoading] = useState(false);
  const [shortError, setShortError] = useState("");

  const generateShortUrl = useCallback(async (longUrl: string) => {
    if (!longUrl) {
      setShortError("请先生成转换链接");
      return;
    }

    setShortLoading(true);
    setShortError("");

    try {
      const response = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: longUrl }),
      });
      const data = (await response.json()) as { shortUrl?: string; error?: { message?: string } };
      if (!response.ok || !data.shortUrl) {
        throw new Error(data.error?.message ?? "短链接生成失败");
      }
      setShortUrl(data.shortUrl);
    } catch (err) {
      setShortError(err instanceof Error ? err.message : "短链接生成失败");
    } finally {
      setShortLoading(false);
    }
  }, []);

  return { shortUrl, shortLoading, shortError, generateShortUrl };
}
