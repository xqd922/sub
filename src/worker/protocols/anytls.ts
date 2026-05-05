import { registerProtocol } from "./registry";
import type { ProtocolHandler } from "./types";
import type { AnyTlsProxy } from "../core/proxy";
import type { ClashAnyTls } from "../core/clash";
import type { SingboxAnyTlsOutbound } from "../core/singbox";
import { stripIpv6Brackets } from "../lib/base64";
import { parsePort } from "../lib/url";
import { errors } from "../lib/errors";
import { toSingboxTls } from "./vmess";

/**
 * AnyTLS protocol handler.
 *
 * URI shape: `anytls://password@host:port?sni=…&skip-cert-verify=true#name`
 * Optional idle-session knobs are duration strings (e.g. `30s`).
 */
const handler: ProtocolHandler<AnyTlsProxy> = {
  type: "anytls",
  schemes: ["anytls"],

  parseUri(uri) {
    let url: URL;
    try {
      url = new URL(uri);
    } catch (cause) {
      throw errors.parseFailed("anytls: invalid URI", cause);
    }
    if (!url.username) throw errors.parseFailed("anytls: missing password");

    const sp = url.searchParams;
    const server = stripIpv6Brackets(url.hostname);

    const proxy: AnyTlsProxy = {
      type: "anytls",
      name: url.hash ? safeDecode(url.hash.slice(1)) : server,
      server,
      port: parsePort(url.port, 443),
      password: decodeURIComponent(url.username),
      udp: true,
      tls: {
        enabled: true,
        serverName: sp.get("sni") || server,
        ...(isInsecure(sp) && { insecure: true }),
      },
    };

    const checkInterval = numOrUndef(sp.get("idle-session-check-interval"));
    const timeout = numOrUndef(sp.get("idle-session-timeout"));
    if (checkInterval !== undefined) proxy.idleSessionCheckInterval = checkInterval;
    if (timeout !== undefined) proxy.idleSessionTimeout = timeout;

    return proxy;
  },

  toUri(p) {
    const params = new URLSearchParams();
    if (p.tls.serverName) params.set("sni", p.tls.serverName);
    if (p.tls.insecure) params.set("skip-cert-verify", "true");
    if (p.idleSessionCheckInterval !== undefined) {
      params.set("idle-session-check-interval", String(p.idleSessionCheckInterval));
    }
    if (p.idleSessionTimeout !== undefined) {
      params.set("idle-session-timeout", String(p.idleSessionTimeout));
    }
    const q = params.toString() ? `?${params.toString()}` : "";
    return `anytls://${encodeURIComponent(p.password)}@${p.server}:${p.port}${q}#${encodeURIComponent(p.name)}`;
  },

  toSingbox(p): SingboxAnyTlsOutbound {
    const out: SingboxAnyTlsOutbound = {
      type: "anytls",
      tag: p.name,
      server: p.server,
      server_port: p.port,
      password: p.password,
      tls: toSingboxTls(p.tls),
    };
    if (p.idleSessionCheckInterval !== undefined) {
      out.idle_session_check_interval = `${p.idleSessionCheckInterval}s`;
    }
    if (p.idleSessionTimeout !== undefined) {
      out.idle_session_timeout = `${p.idleSessionTimeout}s`;
    }
    if (p.detour) out.detour = p.detour;
    return out;
  },

  toClash(p): ClashAnyTls {
    return {
      name: p.name,
      type: "anytls",
      server: p.server,
      port: p.port,
      password: p.password,
      ...(p.tls.serverName && { sni: p.tls.serverName }),
      ...(p.tls.insecure && { "skip-cert-verify": true }),
      ...(p.idleSessionCheckInterval !== undefined && {
        "idle-session-check-interval": p.idleSessionCheckInterval,
      }),
      ...(p.idleSessionTimeout !== undefined && {
        "idle-session-timeout": p.idleSessionTimeout,
      }),
      ...(p.udp && { udp: true }),
      ...(p.detour && { "dialer-proxy": p.detour }),
    };
  },

  dedupKey(p) {
    return [
      "anytls",
      p.server,
      p.port,
      p.password,
      p.tls.serverName ?? "",
    ].join("|");
  },
};

function isInsecure(sp: URLSearchParams): boolean {
  const v = sp.get("skip-cert-verify") ?? sp.get("allowInsecure");
  return v === "1" || v === "true";
}

function numOrUndef(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

registerProtocol(handler);
