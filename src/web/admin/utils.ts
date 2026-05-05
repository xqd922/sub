import type { ConvertRecord, ShortLink, UnifiedItem } from "./types";

export function buildAdminItems(records: ConvertRecord[], shortLinks: ShortLink[]): UnifiedItem[] {
  return [
    ...records.map((record): UnifiedItem => ({
      id: record.id,
      name: record.name,
      type: "convert",
      url: record.originalUrl,
      hits: record.hits,
      lastAccess: record.lastAccess,
      clientType: record.clientType,
      nodeCount: record.nodeCount,
    })),
    ...shortLinks.map((shortLink): UnifiedItem => ({
      id: shortLink.id,
      name: shortLink.name,
      type: "shortlink",
      url: shortLink.targetUrl,
      hits: shortLink.hits,
      lastAccess: shortLink.lastAccess,
    })),
  ];
}

export function buildShareLink(item: UnifiedItem): string {
  return item.type === "convert"
    ? `${window.location.origin}/sub?url=${encodeURIComponent(item.url)}`
    : `${window.location.origin}/s/${item.id}`;
}

export function formatAdminDate(timestamp: number): string {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString("zh-CN");
}

export function formatCompactUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname.length > 18 ? `${parsedUrl.pathname.slice(0, 18)}...` : parsedUrl.pathname;
    return `${parsedUrl.hostname}${path}`;
  } catch {
    return url.length > 36 ? `${url.slice(0, 36)}...` : url;
  }
}
