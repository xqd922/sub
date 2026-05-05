/**
 * Pure data tables for region detection.
 *
 * Separated from logic so the data is editable without touching the
 * detection algorithm. ISO codes follow ISO 3166-1 alpha-2.
 */

export interface RegionData {
  /** English display name. */
  name: string;
  /** Chinese names and short forms (longest match wins). */
  chinese: string[];
  /** English aliases — 3-letter codes, alternate names. */
  aliases?: string[];
}

export const REGIONS: Record<string, RegionData> = {
  // East Asia
  HK: { name: "Hong Kong", chinese: ["香港", "港"], aliases: ["HKG"] },
  TW: { name: "Taiwan", chinese: ["台湾", "台"], aliases: ["TWN"] },
  MO: { name: "Macao", chinese: ["澳门"] },
  JP: { name: "Japan", chinese: ["日本"], aliases: ["JPN"] },
  KR: { name: "South Korea", chinese: ["韩国", "南韩"], aliases: ["KOR"] },

  // Southeast Asia
  SG: { name: "Singapore", chinese: ["新加坡", "狮城", "坡"], aliases: ["SGP"] },
  MY: { name: "Malaysia", chinese: ["马来西亚", "马来", "大马"], aliases: ["MYS"] },
  ID: { name: "Indonesia", chinese: ["印尼", "印度尼西亚"], aliases: ["IDN"] },
  TH: { name: "Thailand", chinese: ["泰国", "泰"], aliases: ["THA"] },
  VN: { name: "Vietnam", chinese: ["越南", "越"], aliases: ["VNM"] },
  PH: { name: "Philippines", chinese: ["菲律宾", "菲"], aliases: ["PHL"] },
  KH: { name: "Cambodia", chinese: ["柬埔寨"], aliases: ["KHM"] },

  // South Asia
  IN: { name: "India", chinese: ["印度"], aliases: ["IND"] },
  PK: { name: "Pakistan", chinese: ["巴基斯坦"], aliases: ["PAK"] },

  // Europe
  GB: { name: "United Kingdom", chinese: ["英国", "英"], aliases: ["GBR", "UK"] },
  DE: { name: "Germany", chinese: ["德国", "德"], aliases: ["DEU"] },
  FR: { name: "France", chinese: ["法国", "法"], aliases: ["FRA"] },
  IT: { name: "Italy", chinese: ["意大利", "意"], aliases: ["ITA"] },
  ES: { name: "Spain", chinese: ["西班牙"], aliases: ["ESP"] },
  NL: { name: "Netherlands", chinese: ["荷兰"], aliases: ["NLD"] },
  PL: { name: "Poland", chinese: ["波兰"], aliases: ["POL"] },
  UA: { name: "Ukraine", chinese: ["乌克兰"], aliases: ["UKR"] },
  CH: { name: "Switzerland", chinese: ["瑞士"] },
  SE: { name: "Sweden", chinese: ["瑞典"], aliases: ["SWE"] },
  NO: { name: "Norway", chinese: ["挪威"], aliases: ["NOR"] },
  FI: { name: "Finland", chinese: ["芬兰"], aliases: ["FIN"] },
  DK: { name: "Denmark", chinese: ["丹麦"], aliases: ["DNK"] },
  IS: { name: "Iceland", chinese: ["冰岛"], aliases: ["ISL"] },
  AT: { name: "Austria", chinese: ["奥地利"], aliases: ["AUT"] },
  IE: { name: "Ireland", chinese: ["爱尔兰"], aliases: ["IRL"] },
  HU: { name: "Hungary", chinese: ["匈牙利"], aliases: ["HUN"] },
  BG: { name: "Bulgaria", chinese: ["保加利亚"], aliases: ["BGR"] },
  MD: { name: "Moldova", chinese: ["摩尔多瓦"], aliases: ["MDA"] },
  RO: { name: "Romania", chinese: ["罗马尼亚"], aliases: ["ROU"] },
  CZ: { name: "Czech Republic", chinese: ["捷克"], aliases: ["CZE"] },
  PT: { name: "Portugal", chinese: ["葡萄牙"], aliases: ["PRT"] },
  BE: { name: "Belgium", chinese: ["比利时"], aliases: ["BEL"] },
  GR: { name: "Greece", chinese: ["希腊"], aliases: ["GRC"] },

  // North America
  US: { name: "United States", chinese: ["美国", "美"], aliases: ["USA"] },
  CA: { name: "Canada", chinese: ["加拿大"], aliases: ["CAN"] },
  MX: { name: "Mexico", chinese: ["墨西哥"], aliases: ["MEX"] },

  // South America
  BR: { name: "Brazil", chinese: ["巴西"], aliases: ["BRA"] },
  AR: { name: "Argentina", chinese: ["阿根廷"], aliases: ["ARG"] },
  CL: { name: "Chile", chinese: ["智利"], aliases: ["CHL"] },
  PE: { name: "Peru", chinese: ["秘鲁"], aliases: ["PER"] },
  CO: { name: "Colombia", chinese: ["哥伦比亚"], aliases: ["COL"] },

  // Oceania
  AU: { name: "Australia", chinese: ["澳大利亚", "澳洲", "澳"], aliases: ["AUS"] },
  NZ: { name: "New Zealand", chinese: ["新西兰"], aliases: ["NZL"] },

  // Central / West Asia
  RU: { name: "Russia", chinese: ["俄罗斯", "俄"], aliases: ["RUS"] },
  TR: { name: "Turkey", chinese: ["土耳其"], aliases: ["TUR"] },
  KZ: { name: "Kazakhstan", chinese: ["哈萨克斯坦", "哈萨克", "哈国"], aliases: ["KAZ"] },
  IL: { name: "Israel", chinese: ["以色列"], aliases: ["ISR"] },
  AE: { name: "United Arab Emirates", chinese: ["阿联酋"], aliases: ["UAE"] },
  SA: { name: "Saudi Arabia", chinese: ["沙特", "沙特阿拉伯"], aliases: ["SAU"] },
  IQ: { name: "Iraq", chinese: ["伊拉克"], aliases: ["IRQ"] },

  // Africa
  ZA: { name: "South Africa", chinese: ["南非"] },
  NG: { name: "Nigeria", chinese: ["尼日利亚"], aliases: ["NGA"] },
  EG: { name: "Egypt", chinese: ["埃及"], aliases: ["EGY"] },
};

/**
 * Flag emoji overrides — used when geopolitical context dictates a different
 * flag than the ISO code would imply (e.g. TW node names rendered with the
 * mainland flag in some operator contexts).
 */
export const FLAG_OVERRIDES: Record<string, string> = {
  TW: "🇨🇳",
};

/** Countries that warrant per-city sub-grouping. */
export const MULTI_CITY_COUNTRIES: Record<string, { short: string; full: string }> = {
  US: { short: "USA", full: "United States" },
  GB: { short: "UK", full: "United Kingdom" },
  RU: { short: "Russia", full: "Russia" },
  AU: { short: "Australia", full: "Australia" },
};

interface CityData {
  country: string;
  city: string;
  /** Match keywords (CN + EN). */
  aliases: string[];
}

export const CITIES: CityData[] = [
  // United States
  { country: "US", city: "Los Angeles", aliases: ["洛杉矶", "LA"] },
  { country: "US", city: "Seattle", aliases: ["西雅图"] },
  { country: "US", city: "San Jose", aliases: ["圣何塞"] },
  { country: "US", city: "Silicon Valley", aliases: ["硅谷"] },
  { country: "US", city: "New York", aliases: ["纽约", "NYC"] },
  { country: "US", city: "Chicago", aliases: ["芝加哥"] },
  { country: "US", city: "Dallas", aliases: ["达拉斯"] },
  { country: "US", city: "Miami", aliases: ["迈阿密"] },
  { country: "US", city: "San Francisco", aliases: ["旧金山", "SF"] },
  { country: "US", city: "Washington", aliases: ["华盛顿"] },
  { country: "US", city: "Washington DC", aliases: ["DC"] },
  { country: "US", city: "Phoenix", aliases: ["凤凰城"] },
  { country: "US", city: "Denver", aliases: ["丹佛"] },
  { country: "US", city: "Atlanta", aliases: ["亚特兰大"] },

  // United Kingdom
  { country: "GB", city: "London", aliases: ["伦敦"] },
  { country: "GB", city: "Coventry", aliases: ["考文垂"] },
  { country: "GB", city: "Manchester", aliases: ["曼彻斯特"] },
  { country: "GB", city: "Birmingham", aliases: ["伯明翰"] },

  // Russia
  { country: "RU", city: "Moscow", aliases: ["莫斯科"] },
  { country: "RU", city: "St. Petersburg", aliases: ["圣彼得堡", "Saint Petersburg"] },

  // Australia
  { country: "AU", city: "Sydney", aliases: ["悉尼"] },
  { country: "AU", city: "Melbourne", aliases: ["墨尔本"] },
  { country: "AU", city: "Brisbane", aliases: ["布里斯班"] },
];

/** city/alias → { country, city } — built once at module load. */
export const CITY_MAP: Record<string, { country: string; city: string }> = (() => {
  const out: Record<string, { country: string; city: string }> = {};
  for (const c of CITIES) {
    out[c.city] = { country: c.country, city: c.city };
    for (const alias of c.aliases) out[alias] = { country: c.country, city: c.city };
  }
  return out;
})();
