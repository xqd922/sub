import { registerProtocol } from "./registry";
import type { ProtocolHandler } from "./types";
import type { Hysteria2Proxy } from "../core/proxy";
import type { ClashHysteria2 } from "../core/clash";
import type { SingboxHysteria2Outbound } from "../core/singbox";
import { stripIpv6Brackets } from "../lib/base64";
import { parsePort } from "../lib/url";
import { errors } from "../lib/errors";
import { toSingboxTls } from "./vmess";

/**
 * Hysteria2 protocol handler.
 *
 * Recognises both `hysteria2://` and the shorthand `hy2://`. TLS is implicit.
 * Optional `obfs=salamander` and `obfs-password` parameters are supported.
 */
const handler: ProtocolHandler<Hysteria2Proxy> = {
  type: "hysteria2",
  schemes: ["hysteria2", "hy2"],

  parseUri(uri) {
    // Normalise hy2:// → hysteria2:// so URL() resolves consistently.
    const normalised = uri.startsWith("hy2://")
      ? `hysteria2://${uri.slice("hy2://".length)}`
      : uri;
    let url: URL;
    try {
      url = new URL(normalised);
    } catch (cause) {
      throw errors.parseFailed("hysteria2: invalid URI", cause);
    }
    if (!url.username) throw errors.parseFailed("hysteria2: missing password");

    const sp = url.searchParams;
    const server = stripIpv6Brackets(url.hostname);

    const proxy: Hysteria2Proxy = {
      type: "hysteria2",
      name: url.hash ? safeDecode(url.hash.slice(1)) : server,
      server,
      port: parsePort(url.port, 443),
      password: decodeURIComponent(url.username),
      tls: {
        enabled: true,
        serverName: sp.get("sni") || server,
        ...(sp.get("insecure") === "1" && { insecure: true }),
        alpn: sp.get("alpn")?.split(",") ?? ["h3"],
        ...(sp.get("fp") && { fingerprint: sp.get("fp")! }),
      },
    };

    const obfs = sp.get("obfs");
    const obfsPass = sp.get("obfs-password");
    if (obfs === "salamander" && obfsPass) {
      proxy.obfs = { type: "salamander", password: obfsPass };
    }

    const up = numOrUndef(sp.get("up"));
    const down = numOrUndef(sp.get("down"));
    if (up !== undefined) proxy.upMbps = up;
    if (down !== undefined) proxy.downMbps = down;

    return proxy;
  },

  toUri(p) {
    const params = new URLSearchParams();
    if (p.tls.serverName) params.set("sni", p.tls.serverName);
    if (p.tls.insecure) params.set("insecure", "1");
    if (p.obfs) {
      params.set("obfs", p.obfs.type);
      params.set("obfs-password", p.obfs.password);
    }
    if (p.upMbps) params.set("up", String(p.upMbps));
    if (p.downMbps) params.set("down", String(p.downMbps));
    const q = params.toString() ? `?${params.toString()}` : "";
    return `hy2://${encodeURIComponent(p.password)}@${p.server}:${p.port}${q}#${encodeURIComponent(p.name)}`;
  },

  toSingbox(p): SingboxHysteria2Outbound {
    const out: SingboxHysteria2Outbound = {
      type: "hysteria2",
      tag: p.name,
      server: p.server,
      server_port: p.port,
      password: p.password,
      tls: toSingboxTls(p.tls),
    };
    if (p.obfs) out.obfs = { type: "salamander", password: p.obfs.password };
    if (p.upMbps) out.up_mbps = p.upMbps;
    if (p.downMbps) out.down_mbps = p.downMbps;
    if (p.detour) out.detour = p.detour;
    return out;
  },

  toClash(p): ClashHysteria2 {
    return {
      name: p.name,
      type: "hysteria2",
      server: p.server,
      port: p.port,
      password: p.password,
      ...(p.tls.serverName && { sni: p.tls.serverName }),
      ...(p.tls.insecure && { "skip-cert-verify": true }),
      ...(p.obfs && { obfs: p.obfs.type, "obfs-password": p.obfs.password }),
      ...(p.upMbps && { up: `${p.upMbps} Mbps` }),
      ...(p.downMbps && { down: `${p.downMbps} Mbps` }),
      ...(p.udp && { udp: true }),
      ...(p.detour && { "dialer-proxy": p.detour }),
    };
  },

  dedupKey(p) {
    return [
      "hysteria2",
      p.server,
      p.port,
      p.password,
      p.tls.serverName ?? "",
      p.obfs?.type ?? "",
      p.obfs?.password ?? "",
      p.upMbps ?? "",
      p.downMbps ?? "",
    ].join("|");
  },
};

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
