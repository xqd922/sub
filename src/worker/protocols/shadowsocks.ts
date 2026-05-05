import { registerProtocol } from "./registry";
import type { ProtocolHandler } from "./types";
import type { ShadowsocksProxy } from "../core/proxy";
import type { ClashShadowsocks } from "../core/clash";
import type { SingboxShadowsocksOutbound } from "../core/singbox";
import { base64Decode, base64Encode, stripIpv6Brackets } from "../lib/base64";
import { parsePort } from "../lib/url";
import { errors } from "../lib/errors";

/**
 * Shadowsocks protocol handler.
 *
 * Supports both URI shapes:
 *   • SIP002: `ss://base64(method:password)@host:port[/?plugin=…]#name`
 *   • Legacy: `ss://base64(method:password@host:port)#name`
 *
 * Plus simple-obfs plugin via `?plugin=obfs;obfs=…;obfs-host=…`.
 */
const handler: ProtocolHandler<ShadowsocksProxy> = {
  type: "ss",
  schemes: ["ss"],

  parseUri(uri) {
    const body = decodeURIComponent(uri.slice("ss://".length));
    const [head = "", remarkRaw = ""] = body.split("#");
    if (!head) throw errors.parseFailed("ss: missing body");

    // Split off any `/?…` plugin query string before base64 decoding.
    const [base, query] = head.split("/?");
    const pluginOpts = parsePluginQuery(query);

    let userInfo: string;
    let serverPart: string;
    if (base!.includes("@")) {
      // SIP002: only the userinfo is base64.
      const at = base!.indexOf("@");
      const encodedUser = base!.slice(0, at);
      serverPart = base!.slice(at + 1);
      userInfo = base64Decode(encodedUser);
    } else {
      // Legacy: entire body is base64-encoded `method:password@host:port`.
      const decoded = base64Decode(base!);
      const at = decoded.lastIndexOf("@");
      if (at < 0) throw errors.parseFailed("ss: legacy form missing @");
      userInfo = decoded.slice(0, at);
      serverPart = decoded.slice(at + 1);
    }

    const { cipher, password } = parseUserInfo(userInfo);
    const { server, port } = parseHostPort(serverPart);

    let remark = remarkRaw;
    try {
      remark = decodeURIComponent(remarkRaw);
    } catch {
      /* keep raw on malformed % */
    }

    const proxy: ShadowsocksProxy = {
      type: "ss",
      name: remark || server,
      server,
      port,
      cipher,
      // Trim trailing `\r` artefacts found in some subscription dumps.
      password: password.split("\r")[0]!.trim(),
    };

    if (pluginOpts) {
      proxy.plugin = "obfs";
      proxy.pluginOpts = pluginOpts;
    }

    return proxy;
  },

  toUri(p) {
    const userInfo = base64Encode(`${p.cipher}:${p.password}`);
    const params = new URLSearchParams();
    if (p.plugin === "obfs" && p.pluginOpts) {
      const parts = [`obfs=${p.pluginOpts.mode ?? "http"}`];
      if (p.pluginOpts.host) parts.push(`obfs-host=${p.pluginOpts.host}`);
      params.set("plugin", parts.join(";"));
    }
    const query = params.toString() ? `/?${params.toString()}` : "";
    return `ss://${userInfo}@${p.server}:${p.port}${query}#${encodeURIComponent(p.name)}`;
  },

  toSingbox(p): SingboxShadowsocksOutbound {
    const out: SingboxShadowsocksOutbound = {
      type: "shadowsocks",
      tag: p.name,
      server: p.server,
      server_port: p.port,
      method: p.cipher,
      password: p.password,
    };
    if (p.plugin === "obfs" && p.pluginOpts) {
      out.plugin = "obfs-local";
      const mode = p.pluginOpts.mode ?? "http";
      const host = p.pluginOpts.host ?? "www.bing.com";
      out.plugin_opts = `obfs=${mode};obfs-host=${host}`;
    }
    if (p.detour) out.detour = p.detour;
    return out;
  },

  toClash(p): ClashShadowsocks {
    const c: ClashShadowsocks = {
      name: p.name,
      type: "ss",
      server: p.server,
      port: p.port,
      cipher: p.cipher,
      password: p.password,
      ...(p.udp && { udp: true }),
      ...(p.detour && { "dialer-proxy": p.detour }),
    };
    if (p.plugin === "obfs" && p.pluginOpts) {
      c.plugin = "obfs";
      c["plugin-opts"] = { ...p.pluginOpts };
    }
    return c;
  },

  dedupKey(p) {
    const opts = p.pluginOpts ?? {};
    return [
      "ss",
      p.server,
      p.port,
      p.cipher,
      p.password,
      p.plugin ?? "",
      opts.mode ?? "",
      opts.host ?? "",
    ].join("|");
  },
};

// ── Helpers ─────────────────────────────────────────────────────

function parsePluginQuery(query?: string): Record<string, string> | null {
  if (!query) return null;
  const params = new URLSearchParams(query);
  const plugin = params.get("plugin");
  if (!plugin) return null;
  const opts: Record<string, string> = {};
  for (const part of plugin.split(";")) {
    const [k, v] = part.split("=");
    if (!k || !v) continue;
    if (k === "obfs") opts.mode = v;
    else if (k === "obfs-host") opts.host = v;
  }
  return Object.keys(opts).length > 0 ? opts : null;
}

function parseUserInfo(userInfo: string): { cipher: string; password: string } {
  const parts = userInfo.split(":");
  if (parts.length === 2) {
    return { cipher: parts[0]!, password: parts[1]! };
  }
  if (parts.length > 2) {
    // Password contains `:` — keep first segment as cipher.
    return { cipher: parts[0]!, password: parts.slice(1).join(":") };
  }
  // Single token — try base64-decoding it once more.
  try {
    const inner = base64Decode(userInfo);
    const innerParts = inner.split(":");
    if (innerParts.length >= 2) {
      return { cipher: innerParts[0]!, password: innerParts.slice(1).join(":") };
    }
  } catch {
    /* fall through */
  }
  throw errors.parseFailed("ss: malformed userinfo");
}

function parseHostPort(serverPart: string): { server: string; port: number } {
  // IPv6: `[::1]:443`
  const v6 = /^\[(.+)\]:(\d+)$/.exec(serverPart);
  if (v6) return { server: v6[1]!, port: parsePort(v6[2]!, 443) };
  const colon = serverPart.lastIndexOf(":");
  if (colon < 0) throw errors.parseFailed("ss: missing port");
  return {
    server: stripIpv6Brackets(serverPart.slice(0, colon)),
    port: parsePort(serverPart.slice(colon + 1), 443),
  };
}

registerProtocol(handler);
