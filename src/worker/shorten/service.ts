import type { Env } from "../env";
import { errors } from "../lib/errors";
import { randomSlug, shortHash } from "../lib/hash";
import { logger } from "../lib/logger";
import { extractNameFromUrl } from "../lib/url";
import { fetchJson, fetchWithRetry } from "../parse/network";

export interface ShortLink {
  id: string;
  targetUrl: string;
  name: string;
  provider: string;
  createdAt: number;
  hits: number;
  lastAccess: number;
}

export interface ShortResult {
  shortUrl: string;
  provider: string;
  id?: string;
  created?: boolean;
  reused?: boolean;
}

const SHORT_PREFIX = "short:";
const SHORT_URL_PREFIX = "short:url:";
const SHORT_INDEX = "index:shortlinks";
const ONE_YEAR = 60 * 60 * 24 * 365;

type ShortProvider = (env: Env, targetUrl: string) => Promise<ShortResult>;

const PROVIDERS: Array<[string, ShortProvider]> = [
  ["KV", createKvShortLink],
  ["TinyURL", createTinyUrlShortLink],
  ["Sink", createSinkShortLink],
  ["Bitly", createBitlyShortLink],
];

export async function createShortLink(env: Env, input: string): Promise<ShortResult> {
  const targetUrl = normalizeShortTarget(env, input);
  let lastError: unknown;

  for (const [name, provider] of PROVIDERS) {
    try {
      return await provider(env, targetUrl);
    } catch (err) {
      lastError = err;
      logger.warn("short provider failed", {
        provider: name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  throw errors.providerFailed(
    "shortlink",
    lastError instanceof Error ? lastError : new Error(String(lastError)),
  );
}

export async function getShortLink(env: Env, id: string): Promise<ShortLink | null> {
  if (!isSafeShortId(id)) return null;
  return env.LINKS_KV.get<ShortLink>(`${SHORT_PREFIX}${id}`, "json");
}

export async function listShortLinks(env: Env): Promise<ShortLink[]> {
  const index = await env.LINKS_KV.get<{ ids: string[] }>(SHORT_INDEX, "json");
  const ids = index?.ids ?? [];
  const rows = await Promise.all(ids.map((id) => getShortLink(env, id)));
  return rows
    .filter((row): row is ShortLink => row !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function touchShortLink(env: Env, id: string): Promise<ShortLink | null> {
  const link = await getShortLink(env, id);
  if (!link) return null;

  const updated: ShortLink = {
    ...link,
    hits: link.hits + 1,
    lastAccess: Date.now(),
  };
  await putShortLink(env, updated);
  return updated;
}

export async function deleteShortLink(env: Env, id: string): Promise<boolean> {
  const link = await getShortLink(env, id);
  if (!link) return false;

  const urlHash = await shortHash(link.targetUrl, 16);
  await Promise.all([
    env.LINKS_KV.delete(`${SHORT_PREFIX}${id}`),
    env.LINKS_KV.delete(`${SHORT_URL_PREFIX}${urlHash}`),
    removeFromShortIndex(env, id),
  ]);
  return true;
}

function normalizeShortTarget(env: Env, input: string): string {
  const url = input.trim();
  if (!url) throw errors.missingParam("url");

  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("url")) return parsed.toString();
    const base = env.SITE_URL || parsed.origin;
    return `${base.replace(/\/$/, "")}/sub?url=${encodeURIComponent(parsed.toString())}`;
  } catch {
    throw errors.invalidInput("Invalid URL", { field: "url" });
  }
}

async function createKvShortLink(env: Env, targetUrl: string): Promise<ShortResult> {
  const urlHash = await shortHash(targetUrl, 16);
  const existingId = await env.LINKS_KV.get(`${SHORT_URL_PREFIX}${urlHash}`);
  if (existingId) {
    const existing = await getShortLink(env, existingId);
    if (existing) {
      return {
        shortUrl: `${siteOrigin(env)}/s/${existing.id}`,
        provider: "KV",
        id: existing.id,
        reused: true,
      };
    }
  }

  const now = Date.now();
  const link: ShortLink = {
    id: await uniqueShortId(env),
    targetUrl,
    name: extractNameFromUrl(targetUrl),
    provider: "KV",
    createdAt: now,
    hits: 0,
    lastAccess: now,
  };

  await Promise.all([
    putShortLink(env, link),
    env.LINKS_KV.put(`${SHORT_URL_PREFIX}${urlHash}`, link.id, { expirationTtl: ONE_YEAR }),
    addToShortIndex(env, link.id),
  ]);

  return {
    shortUrl: `${siteOrigin(env)}/s/${link.id}`,
    provider: "KV",
    id: link.id,
    created: true,
  };
}

async function createTinyUrlShortLink(_env: Env, targetUrl: string): Promise<ShortResult> {
  const res = await fetchWithRetry(
    `https://tinyurl.com/api-create.php?url=${encodeURIComponent(targetUrl)}`,
    { retries: 1, timeoutMs: 5_000 },
  );
  const shortUrl = (await res.text()).trim();
  if (!shortUrl || shortUrl.startsWith("Error")) {
    throw errors.providerFailed("TinyURL", shortUrl || "empty response");
  }
  return { shortUrl, provider: "TinyURL", created: true };
}

async function createSinkShortLink(env: Env, targetUrl: string): Promise<ShortResult> {
  if (!env.SINK_URL || !env.SINK_TOKEN) {
    throw errors.missingParam("SINK_URL/SINK_TOKEN");
  }

  const slug = await shortHash(targetUrl, 6);
  const res = await fetch(`${env.SINK_URL.replace(/\/$/, "")}/api/link/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SINK_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: targetUrl,
      title: extractNameFromUrl(targetUrl),
      description: "Generated by subscription converter",
      slug,
    }),
  });

  if (res.status === 409) {
    return { shortUrl: `${env.SINK_URL.replace(/\/$/, "")}/${slug}`, provider: "Sink", reused: true };
  }
  if (!res.ok) {
    throw errors.providerFailed("Sink", `HTTP ${res.status}`);
  }

  const data = (await res.json()) as { link?: { slug?: string; id?: string } };
  const createdSlug = data.link?.slug ?? slug;
  return {
    shortUrl: `${env.SINK_URL.replace(/\/$/, "")}/${createdSlug}`,
    provider: "Sink",
    id: data.link?.id,
    created: true,
  };
}

async function createBitlyShortLink(env: Env, targetUrl: string): Promise<ShortResult> {
  if (!env.BITLY_TOKEN) throw errors.missingParam("BITLY_TOKEN");

  const data = await fetchJson<{ link: string }>("https://api-ssl.bitly.com/v4/shorten", {
    retries: 1,
    timeoutMs: 5_000,
    headers: {
      Authorization: `Bearer ${env.BITLY_TOKEN}`,
      "Content-Type": "application/json",
    },
    userAgent: "sub-worker/1.0",
    method: "POST",
    body: JSON.stringify({ long_url: targetUrl, domain: "bit.ly" }),
  });

  if (!data.link) throw errors.providerFailed("Bitly", "missing link");
  return { shortUrl: data.link, provider: "Bitly", created: true };
}

async function uniqueShortId(env: Env): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const id = randomSlug(6);
    const existing = await env.LINKS_KV.get(`${SHORT_PREFIX}${id}`);
    if (!existing) return id;
  }
  return randomSlug(10);
}

async function putShortLink(env: Env, link: ShortLink): Promise<void> {
  await env.LINKS_KV.put(`${SHORT_PREFIX}${link.id}`, JSON.stringify(link), {
    expirationTtl: ONE_YEAR,
  });
}

async function addToShortIndex(env: Env, id: string): Promise<void> {
  const index = await env.LINKS_KV.get<{ ids: string[] }>(SHORT_INDEX, "json");
  const ids = index?.ids ?? [];
  if (!ids.includes(id)) ids.unshift(id);
  await env.LINKS_KV.put(SHORT_INDEX, JSON.stringify({ ids, updatedAt: Date.now() }));
}

async function removeFromShortIndex(env: Env, id: string): Promise<void> {
  const index = await env.LINKS_KV.get<{ ids: string[] }>(SHORT_INDEX, "json");
  const ids = (index?.ids ?? []).filter((item) => item !== id);
  await env.LINKS_KV.put(SHORT_INDEX, JSON.stringify({ ids, updatedAt: Date.now() }));
}

function siteOrigin(env: Env): string {
  return (env.SITE_URL || "https://sub.xqd.pp.ua").replace(/\/$/, "");
}

function isSafeShortId(id: string): boolean {
  return /^[A-Za-z0-9_-]{3,32}$/.test(id);
}
