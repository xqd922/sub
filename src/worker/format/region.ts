import { code as getCode, flag as getFlag, name as getName } from "country-emoji";
import { FLAG_OVERRIDES, REGIONS } from "./region-data";

/**
 * Region detection — tells us "this proxy is in 🇯🇵 Japan" from a free-form name.
 *
 * Strategy in priority order:
 *   1. Honour an existing flag emoji in the name.
 *   2. Match Chinese keywords (longest-first to avoid prefix shadowing).
 *   3. Match English keywords with word boundaries (so "US" doesn't match "RUS").
 *   4. Fall back to the country-emoji library for fuzzy English matches.
 */

export interface RegionInfo {
  flag: string;
  code: string;
  name: string;
}

// ── Pre-built lookup tables (built once) ───────────────────────
const CHINESE_TO_ISO: Record<string, string> = {};
const ENGLISH_TO_ISO: Record<string, string> = {};
const ISO_TO_NAME: Record<string, string> = {};

for (const [code, data] of Object.entries(REGIONS)) {
  ISO_TO_NAME[code] = data.name;
  for (const cn of data.chinese) CHINESE_TO_ISO[cn] = code;
  ENGLISH_TO_ISO[code] = code;
  for (const alias of data.aliases ?? []) ENGLISH_TO_ISO[alias] = code;
}

// Sorted longest-first to avoid the "美" matching before "美国" problem.
const SORTED_CHINESE_KEYS = Object.keys(CHINESE_TO_ISO).sort((a, b) => b.length - a.length);
const SORTED_ENGLISH_KEYS = Object.keys(ENGLISH_TO_ISO).sort((a, b) => b.length - a.length);

// Pre-compiled regexes — building these once per region detection is wasteful
// at our scale (one detect per node × hundreds of nodes per request).
const ENGLISH_KEY_REGEXES = new Map<string, RegExp>();
for (const key of SORTED_ENGLISH_KEYS) {
  ENGLISH_KEY_REGEXES.set(key, new RegExp(`(^|[^A-Za-z])${key}([^A-Za-z]|$)`, "i"));
}

// ── Public helpers ─────────────────────────────────────────────

/**
 * Convert an ISO 3166-1 alpha-2 code into its flag emoji.
 *
 * Each Regional Indicator Symbol is U+1F1E6 + (letter - 'A'),
 * so the offset from ASCII is 127397.
 */
export function isoToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "";
  const upper = countryCode.toUpperCase();
  if (FLAG_OVERRIDES[upper]) return FLAG_OVERRIDES[upper]!;
  const codePoints = [...upper].map((ch) => 127397 + ch.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/** Pull the first flag emoji out of a string, or null if none. */
export function extractFlagEmoji(text: string): string | null {
  const match = text.match(/[\u{1F1E6}-\u{1F1FF}]{2}/gu);
  return match?.[0] ?? null;
}

/** Best-effort region inference from a free-form node name. */
export function detectRegion(nodeName: string): RegionInfo | null {
  // 1. Existing flag emoji wins — trust the operator's explicit tag.
  const existingFlag = extractFlagEmoji(nodeName);
  if (existingFlag) {
    let code = getCode(existingFlag) as string | undefined;
    if (code) {
      // TW special: if the operator wrote the mainland flag but the name says
      // 台湾 / Taiwan / TW, treat as TW (this matches existing behaviour).
      if (
        (code === "CN" || code === "TW") &&
        (nodeName.includes("台湾") ||
          nodeName.includes("台") ||
          /\bTW\b/i.test(nodeName) ||
          /Taiwan/i.test(nodeName))
      ) {
        code = "TW";
      }
      const flag = FLAG_OVERRIDES[code] ?? existingFlag;
      return {
        flag,
        code,
        name: ISO_TO_NAME[code] ?? (getName(existingFlag) as string | undefined) ?? code,
      };
    }
  }

  // 2. Chinese keywords.
  for (const key of SORTED_CHINESE_KEYS) {
    if (nodeName.includes(key)) {
      const code = CHINESE_TO_ISO[key]!;
      return { flag: isoToFlag(code), code, name: ISO_TO_NAME[code] ?? code };
    }
  }

  // 3. English keywords with word boundaries.
  for (const key of SORTED_ENGLISH_KEYS) {
    const re = ENGLISH_KEY_REGEXES.get(key)!;
    if (re.test(nodeName)) {
      const code = ENGLISH_TO_ISO[key]!;
      return { flag: isoToFlag(code), code, name: ISO_TO_NAME[code] ?? code };
    }
  }

  // 4. Fuzzy match via country-emoji.
  const fuzzy = getFlag(nodeName) as string | undefined;
  if (fuzzy) {
    const code = getCode(fuzzy) as string | undefined;
    if (code) {
      return {
        flag: fuzzy,
        code,
        name: ISO_TO_NAME[code] ?? (getName(fuzzy) as string | undefined) ?? code,
      };
    }
  }

  return null;
}
