import { registerProtocol } from "./registry";
import type { ProtocolHandler } from "./types";
import type { SocksProxy } from "../core/proxy";
import type { ClashSocks5 } from "../core/clash";
import type { SingboxSocksOutbound } from "../core/singbox";
import { base64Decode, stripIpv6Brackets } from "../lib/base64";
import { parsePort } from "../lib/url";
import { errors } from "../lib/errors";

/**
 * SOCKS5 protocol handler.
 *
 * Userinfo may be plain `user:pass` or base64-encoded. Handler probes both.
 */
const handler: ProtocolHandler<SocksProxy> = {
  type: "socks5",
  schemes: ["socks5", "socks"],

  parseUri(uri) {
    const colon = uri.indexOf("://");
    const body = decodeURIComponent(uri.slice(colon + 3));
    const [head = "", remarkRaw = ""] = body.split("#");
    if (!head) throw errors.parseFailed("socks: missing body");

    let userInfo = "";
    let serverInfo = head;
    const at = head.lastIndexOf("@");
    if (at >= 0) {
      userInfo = head.slice(0, at);
      serverInfo = head.slice(at + 1);
    }

    const { username, password } = parseUserInfo(userInfo);

    const lastColon = serverInfo.lastIndexOf(":");
    if (lastColon < 0) throw errors.parseFailed("socks: missing port");
    const server = stripIpv6Brackets(serverInfo.slice(0, lastColon));
    const port = parsePort(serverInfo.slice(lastColon + 1), 1080);

    let remark = remarkRaw;
    try {
      remark = decodeURIComponent(remarkRaw);
    } catch {
      /* keep raw */
    }

    return {
      type: "socks5",
      name: remark || server,
      server,
      port,
      ...(username && { username }),
      ...(password && { password }),
    };
  },

  toUri(p) {
    const auth = p.username ? `${p.username}:${p.password ?? ""}@` : "";
    return `socks://${auth}${p.server}:${p.port}#${encodeURIComponent(p.name)}`;
  },

  toSingbox(p): SingboxSocksOutbound {
    const out: SingboxSocksOutbound = {
      type: "socks",
      tag: p.name,
      server: p.server,
      server_port: p.port,
      version: "5",
    };
    if (p.username) out.username = p.username;
    if (p.password) out.password = p.password;
    if (p.detour) out.detour = p.detour;
    return out;
  },

  toClash(p): ClashSocks5 {
    return {
      name: p.name,
      type: "socks5",
      server: p.server,
      port: p.port,
      ...(p.username && { username: p.username }),
      ...(p.password && { password: p.password }),
      ...(p.udp && { udp: true }),
      ...(p.detour && { "dialer-proxy": p.detour }),
    };
  },

  dedupKey(p) {
    return [
      "socks5",
      p.server,
      p.port,
      p.username ?? "",
      p.password ?? "",
    ].join("|");
  },
};

function parseUserInfo(userInfo: string): { username: string; password: string } {
  if (!userInfo) return { username: "", password: "" };
  // Try base64 first — many subscription generators wrap creds.
  try {
    const decoded = base64Decode(userInfo);
    if (decoded.includes(":")) {
      const [u = "", p = ""] = decoded.split(":");
      return { username: u, password: p };
    }
  } catch {
    /* fall through */
  }
  if (userInfo.includes(":")) {
    const [u = "", p = ""] = userInfo.split(":");
    return { username: u, password: p };
  }
  return { username: userInfo, password: "" };
}

registerProtocol(handler);
