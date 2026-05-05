import { dump as dumpYaml } from "js-yaml";
import type { Proxy } from "../core/proxy";
import type { ClashConfig, ClashProxy } from "../core/clash";
import { CLASH_BASE } from "./clash/base";
import { buildProxyGroups } from "./clash/groups";
import { RULE_PROVIDERS } from "./clash/providers";
import { CLASH_RULES } from "./clash/rules";
import { getHandlerByType } from "../protocols/registry";

/**
 * Convert internal proxies into a Clash YAML document.
 */
export function buildClashConfig(
  proxies: readonly Proxy[],
  isAirportSubscription = true,
): ClashConfig {
  const clashProxies = proxies.map(toClashProxy);

  return {
    ...CLASH_BASE,
    proxies: clashProxies,
    "proxy-groups": buildProxyGroups(clashProxies, isAirportSubscription),
    "rule-providers": RULE_PROVIDERS,
    rules: CLASH_RULES,
  };
}

/**
 * Serialize the Clash config as YAML.
 */
export function serializeClashConfig(config: ClashConfig): string {
  let output = dumpYaml(config, {
    flowLevel: 2,
    lineWidth: -1,
    indent: 2,
    noRefs: true,
    forceQuotes: false,
    quotingType: '"',
    styles: {
      "!!null": "lowercase",
    },
  });

  // Quote path-like values with reserved YAML characters.
  output = output.replace(/path: ([^,}"'\n]+)/g, (match, value) => {
    if (/[?:&]/.test(value) && !value.startsWith('"')) {
      return `path: "${value}"`;
    }
    return match;
  });

  return output;
}

function toClashProxy(proxy: Proxy): ClashProxy {
  return getHandlerByType(proxy.type).toClash(proxy as never);
}
