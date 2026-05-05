import type { Proxy } from "../core/proxy";
import { buildClashConfig, serializeClashConfig } from "../config/clash";
import { buildSingboxConfig, serializeSingboxConfig } from "../config/singbox";
import type { Env } from "../env";
import { deduplicateProxies } from "../format/dedup";
import { formatProxies } from "../format/proxy";
import { errors, toAppError } from "../lib/errors";
import { fireAndForget, type ExecCtx } from "../lib/cf-context";
import { base64Encode, stripIpv6Brackets } from "../lib/base64";
import { formatBytes, isGistUrl } from "../lib/url";
import { logConversion, isUrlEnabled } from "../kv/records";
import { fetchNodesFromRemote } from "../parse/remote";
import { fetchWithRetry } from "../parse/network";
import { parseMultipleUris, parseSingleUri } from "../parse/single";
import { parseSubscriptionText } from "../parse/subscription";
import { getHandlerByType, isProtocolUri } from "../protocols/registry";

export type ClientType = "clash" | "singbox" | "v2rayng" | "browser";

export interface SubscriptionInfo {
  name: string;
  upload: string;
  download: string;
  total: string;
  expire: string;
  homepage: string;
  updateInterval?: number;
}

interface ProcessedSubscription {
  proxies: Proxy[];
  subscription: SubscriptionInfo;
  isAirportSubscription: boolean;
}

export async function handleConvertRequest(
  env: Env,
  request: Request,
  ctx?: ExecCtx,
): Promise<Response> {
  const started = Date.now();
  const url = new URL(request.url).searchParams.get("url");

  try {
    if (!url) throw errors.missingParam("url");
    new URL(url);

    if (!(await isUrlEnabled(env, url))) {
      throw errors.invalidInput("This subscription has been disabled", { field: "url" });
    }

    const client = detectClientType(request.headers.get("User-Agent") ?? "");
    const processed = await processSubscription(url, request.signal);
    const formatted = formatProxies(deduplicateProxies(processed.proxies));
    const response = createConfigResponse(client, formatted, processed);

    fireAndForget(
      ctx,
      logConversion(env, {
        originalUrl: url,
        clientType: client,
        nodeCount: formatted.length,
        clientIp: clientIp(request),
        subscriptionName: processed.subscription.name,
      }),
    );

    response.headers.set("X-Process-Time", `${Date.now() - started}ms`);
    return response;
  } catch (err) {
    const appError = toAppError(err);
    return Response.json(appError.toJSON(), {
      status: appError.status,
      headers: corsHeaders(),
    });
  }
}

export function detectClientType(userAgent: string): ClientType {
  if (/sing-box|SFA|SFI|SFM|SFT/i.test(userAgent)) return "singbox";
  if (/v2rayn|v2rayng|quantumult|shadowrocket|surge|loon/i.test(userAgent)) return "v2rayng";
  if (/mozilla|chrome|safari|firefox|edge/i.test(userAgent)) return "browser";
  return "clash";
}

async function processSubscription(url: string, signal?: AbortSignal): Promise<ProcessedSubscription> {
  if (isGistUrl(url)) {
    const result = await fetchNodesFromRemote(url, signal);
    return {
      proxies: result.proxies,
      subscription: defaultSubscription(),
      isAirportSubscription: result.hasSubscriptionUrls,
    };
  }

  if (isProtocolUri(url)) {
    const proxies = parseSingleUri(url) ? parseMultipleUris(url) : [];
    if (!proxies.length) throw errors.parseFailed("Invalid proxy URI");
    return { proxies, subscription: defaultSubscription(), isAirportSubscription: false };
  }

  const res = await fetchWithRetry(url, {
    retries: 3,
    timeoutMs: 30_000,
    userAgent: "ClashX/1.95.1",
    signal,
  });
  const subscription = subscriptionInfoFromHeaders(res.headers);
  const text = await res.text();
  return {
    proxies: parseSubscriptionText(text),
    subscription,
    isAirportSubscription: true,
  };
}

function createConfigResponse(
  client: ClientType,
  proxies: Proxy[],
  processed: ProcessedSubscription,
): Response {
  if (client === "singbox") {
    return new Response(serializeSingboxConfig(buildSingboxConfig(proxies)), {
      headers: responseHeaders(processed.subscription, "application/json; charset=utf-8"),
    });
  }

  if (client === "v2rayng") {
    return new Response(serializeV2raySubscription(proxies), {
      headers: responseHeaders(processed.subscription, "text/plain; charset=utf-8"),
    });
  }

  const clash = serializeClashConfig(buildClashConfig(proxies, processed.isAirportSubscription));
  if (client === "browser") {
    const singbox = serializeSingboxConfig(buildSingboxConfig(proxies));
    return new Response(previewHtml(clash, singbox), {
      headers: { ...corsHeaders(), "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response(clash, {
    headers: responseHeaders(processed.subscription, "text/yaml; charset=utf-8"),
  });
}

function serializeV2raySubscription(proxies: Proxy[]): string {
  const lines = proxies.map((proxy) => {
    const handler = getHandlerByType(proxy.type) as { toUri(p: Proxy): string };
    return handler.toUri(proxy);
  });
  return base64Encode(lines.join("\n"));
}

function responseHeaders(subscription: SubscriptionInfo, contentType: string): HeadersInit {
  const headers: Record<string, string> = {
    ...corsHeaders(),
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(subscription.name)}`,
    "profile-title": base64Encode(subscription.name),
    "profile-update-interval": String(subscription.updateInterval ?? 24),
    "profile-web-page-url": subscription.homepage,
    "profile-status": "active",
  };

  if (subscription.expire) {
    headers.expires = subscription.expire;
    headers["profile-expire"] = subscription.expire;
  }

  if (Number(subscription.upload) > 0 || Number(subscription.download) > 0 || Number(subscription.total) > 0) {
    headers["subscription-userinfo"] =
      `upload=${subscription.upload}; download=${subscription.download}; total=${subscription.total}; expire=${subscription.expire}`;
  }

  return headers;
}

function subscriptionInfoFromHeaders(headers: Headers): SubscriptionInfo {
  const userInfo = headers.get("subscription-userinfo") ?? "";
  const homepage =
    headers.get("profile-web-page-url") ??
    headers.get("web-page-url") ??
    headers.get("homepage") ??
    headers.get("website") ??
    "https://sub.xqd.pp.ua";
  const updateInterval = headers.get("profile-update-interval");

  return {
    name: fileNameFromDisposition(headers.get("content-disposition") ?? ""),
    upload: userInfo.match(/upload=(\d+)/)?.[1] ?? "0",
    download: userInfo.match(/download=(\d+)/)?.[1] ?? "0",
    total: userInfo.match(/total=(\d+)/)?.[1] ?? "0",
    expire: userInfo.match(/expire=(\d+)/)?.[1] ?? headers.get("profile-expire") ?? "",
    homepage: decodeHeaderUrl(homepage),
    updateInterval: updateInterval ? Number(updateInterval) : undefined,
  };
}

function defaultSubscription(): SubscriptionInfo {
  return {
    name: "Me",
    upload: "0",
    download: "0",
    total: "0",
    expire: "",
    homepage: "https://sub.xqd.pp.ua",
  };
}

function fileNameFromDisposition(value: string): string {
  const utf8 = value.match(/filename\*=UTF-8''([^;\s]+)/i)?.[1];
  if (utf8) return decodeURIComponent(utf8);
  return value.match(/filename="([^"]+)"/i)?.[1] ?? value.match(/filename=([^;\s]+)/i)?.[1] ?? "Sub";
}

function decodeHeaderUrl(value: string): string {
  try {
    return new URL(value).toString();
  } catch {
    return "https://sub.xqd.pp.ua";
  }
}

function previewHtml(clash: string, singbox: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sub Preview</title><style>body{margin:0;background:#0f172a;color:#e2e8f0;font-family:Inter,system-ui,sans-serif}main{max-width:1200px;margin:0 auto;padding:32px}section{background:#111827;border:1px solid #334155;border-radius:16px;padding:20px;margin:20px 0}pre{white-space:pre-wrap;word-break:break-word;font-size:12px}.meta{color:#94a3b8}</style></head><body><main><h1>Subscription Preview</h1><p class="meta">Clash ${formatBytes(clash.length)} · sing-box ${formatBytes(singbox.length)}</p><section><h2>Clash YAML</h2><pre>${escapeHtml(clash)}</pre></section><section><h2>sing-box JSON</h2><pre>${escapeHtml(singbox)}</pre></section></main></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  };
}

function clientIp(request: Request): string {
  return stripIpv6Brackets(
    request.headers.get("CF-Connecting-IP") ??
      request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
      "unknown",
  );
}
