import type { ClashProxy, ClashProxyGroup } from "../../core/clash";

const TEST_URL = "http://www.gstatic.com/generate_204";

/**
 * Build Clash proxy groups from the generated proxy list.
 */
export function buildProxyGroups(
  proxies: readonly ClashProxy[],
  isAirportSubscription = true,
): ClashProxyGroup[] {
  const proxyNames = proxies.map((proxy) => proxy.name);

  const hkProxies = proxyNames.filter(
    (name) => /香港|HK|Hong Kong|HKG/.test(name) && !/家宽|Home/.test(name),
  );
  const minProxies = proxies
    .filter((proxy) => proxy.name.includes("0.") || (typeof (proxy as { multiplier?: unknown }).multiplier === "number" && Number((proxy as { multiplier?: unknown }).multiplier) < 0.4))
    .map((proxy) => proxy.name);

  const manualProxies = ["Auto", "DIRECT"];
  if (hkProxies.length > 0) {
    manualProxies.push("HK");
    if (isAirportSubscription && minProxies.length > 0) manualProxies.push("Min");
  }
  manualProxies.push(...proxyNames);

  const embyProxies = ["Manual", "DIRECT"];
  if (isAirportSubscription && minProxies.length > 0) embyProxies.push("Min");
  embyProxies.push(...proxyNames);

  const groups: ClashProxyGroup[] = [
    {
      name: "Manual",
      type: "select",
      proxies: manualProxies,
    },
    {
      name: "Auto",
      type: "url-test",
      proxies: proxyNames,
      url: TEST_URL,
      interval: 300,
      tolerance: 50,
    },
    {
      name: "Emby",
      type: "select",
      proxies: embyProxies,
    },
    {
      name: "AI",
      type: "select",
      proxies: ["Manual", ...proxyNames],
    },
  ];

  if (hkProxies.length > 0) {
    groups.push({
      name: "HK",
      type: "url-test",
      proxies: hkProxies,
      url: TEST_URL,
      interval: 300,
      tolerance: 50,
    });
  }

  if (isAirportSubscription && minProxies.length > 0) {
    groups.push({
      name: "Min",
      type: "url-test",
      proxies: minProxies,
      url: TEST_URL,
      interval: 300,
      tolerance: 50,
    });
  }

  return groups;
}
