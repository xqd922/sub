/**
 * Base64 helpers compatible with the Worker runtime.
 *
 * Node's `Buffer` is unavailable on Workers; `atob`/`btoa` operate on Latin-1
 * strings and would mangle UTF-8. These helpers do the right thing for both
 * standard and URL-safe Base64 with optional padding.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: false });

/** Decode a (possibly URL-safe, possibly unpadded) Base64 string into UTF-8 text. */
export function base64Decode(input: string): string {
  const normalised = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return decoder.decode(bytes);
}

/** Encode a UTF-8 string as standard (padded) Base64. */
export function base64Encode(input: string): string {
  const bytes = encoder.encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** True if the string can be decoded as Base64 (lenient — also accepts URL-safe). */
export function isBase64Like(input: string): boolean {
  if (input.length === 0) return false;
  return /^[A-Za-z0-9+/_-]+={0,2}$/.test(input);
}

/** Strip IPv6 brackets — `[::1]` → `::1`. URLs preserve them in `hostname`. */
export function stripIpv6Brackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]")
    ? host.slice(1, -1)
    : host;
}
