import { useCallback, useEffect, useState } from "react";
import type { ConvertRecord, ShortLink, Stats } from "./types";

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function useAdminData(token: string) {
  const [records, setRecords] = useState<ConvertRecord[]>([]);
  const [shortLinks, setShortLinks] = useState<ShortLink[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [recordsRes, statsRes, shortLinksRes] = await Promise.all([
        fetch("/api/admin/records", { headers }),
        fetch("/api/admin/stats", { headers }),
        fetch("/api/admin/shortlinks", { headers }),
      ]);

      if (!recordsRes.ok || !statsRes.ok || !shortLinksRes.ok) {
        setError("获取管理数据失败，请检查登录状态和 KV 配置");
        return;
      }

      const [recordsData, statsData, shortLinksData] = await Promise.all([
        readJson<ConvertRecord[] | { records?: ConvertRecord[] }>(recordsRes),
        readJson<Stats>(statsRes),
        readJson<ShortLink[] | { shortLinks?: ShortLink[] }>(shortLinksRes),
      ]);

      setRecords(Array.isArray(recordsData) ? recordsData : recordsData.records ?? []);
      setStats(statsData);
      setShortLinks(Array.isArray(shortLinksData) ? shortLinksData : shortLinksData.shortLinks ?? []);
    } catch {
      setError("网络请求失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const deleteRecord = useCallback(async (id: string) => {
    const response = await fetch(`/api/admin/records/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      setRecords((items) => items.filter((item) => item.id !== id));
      return true;
    }
    return false;
  }, [token]);

  const deleteShortLink = useCallback(async (id: string) => {
    const response = await fetch(`/api/admin/shortlinks/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      setShortLinks((items) => items.filter((item) => item.id !== id));
      return true;
    }
    return false;
  }, [token]);

  return { records, shortLinks, stats, loading, error, refetch: fetchData, deleteRecord, deleteShortLink };
}
