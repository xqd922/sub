import type { ClashConfig } from "../../core/clash";

/**
 * Clash base config shared by all generated subscriptions.
 */
export const CLASH_BASE: ClashConfig = {
  "mixed-port": 7890,
  "allow-lan": true,
  mode: "rule",
  "log-level": "info",
  ipv6: true,
  "external-controller": "[::]:9090",
  dns: {
    enable: true,
    ipv6: true,
    "cache-algorithm": "arc",
    listen: "[::]:1053",
    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",
    "proxy-server-nameserver": ["https://doh.pub/dns-query"],
    nameserver: ["https://dns.alidns.com/dns-query"],
    "nameserver-policy": {
      "*": "system",
      "+.arpa": "system",
      "rule-set:gfw": ["https://dns.google/dns-query#Manual"],
    },
    "use-hosts": true,
    "direct-nameserver": ["system"],
    "fake-ip-filter": [
      "rule-set:private",
      "+.market.xiaomi.com",
      "lancache.steamcontent.com",
      "+.edu.cn",
    ],
  },
  hosts: {
    "dns.alidns.com": ["223.5.5.5", "223.6.6.6"],
    "doh.pub": ["1.12.12.21", "120.53.53.53"],
    "dns.google": ["8.8.8.8", "8.8.4.4"],
  },
  "rule-providers": {},
  rules: [],
  "unified-delay": false,
  "tcp-concurrent": true,
  "keep-alive-idle": 300,
  "keep-alive-interval": 75,
  "find-process-mode": "strict",
  "external-ui": "ui",
  "external-ui-url": "https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip",
  secret: "",
  profile: {
    "store-selected": true,
    "store-fake-ip": true,
  },
  sniffer: {
    enable: true,
    "force-dns-mapping": true,
    "parse-pure-ip": true,
    "override-destination": true,
    sniff: {
      HTTP: { ports: [80, "8080-8880"], "override-destination": true },
      TLS: { ports: [443, 8443] },
      QUIC: { ports: [443, 8443] },
    },
    "skip-domain": ["Mijia Cloud", "+.push.apple.com"],
  },
  proxies: [],
  "proxy-groups": [],
};
