/**
 * Hashing utilities — single source of truth.
 *
 * Replaces 4 near-duplicate SHA-256 helpers scattered across the old codebase.
 */

const encoder = new TextEncoder();

/** SHA-256 hex digest of a string. */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return bufToHex(buf);
}

/** Stable short id derived from a string (default 12 hex chars). */
export async function shortHash(input: string, length = 12): Promise<string> {
  const hex = await sha256Hex(input);
  return hex.slice(0, length);
}

/** Random alphanumeric slug — for short link generation. */
export function randomSlug(length = 6): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[buf[i]! % alphabet.length];
  }
  return out;
}

/** Constant-time string comparison — used for password/token checks. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}
