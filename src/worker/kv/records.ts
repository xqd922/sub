import type { Env } from "../env";
import { shortHash } from "../lib/hash";
import { extractNameFromUrl } from "../lib/url";

export interface ConvertRecord {
  id: string;
  originalUrl: string;
  name: string;
  clientType: string;
  createdAt: number;
  updatedAt: number;
  lastAccess: number;
  hits: number;
  nodeCount: number;
  lastIp: string;
  deleted?: boolean;
}

export interface StatsData {
  totalRecords: number;
  totalHits: number;
  todayHits: number;
  activeRecords: number;
}

interface RecordIndex {
  ids: string[];
  updatedAt: number;
}

interface DailyStats {
  date: string;
  totalHits: number;
  uniqueUrls: number;
}

const RECORD_PREFIX = "record:";
const RECORD_INDEX = "index:records";
const DAILY_PREFIX = "stats:daily:";
const ONE_YEAR = 60 * 60 * 24 * 365;
const ONE_MONTH = 60 * 60 * 24 * 30;

export async function logConversion(
  env: Env,
  params: {
    originalUrl: string;
    clientType: string;
    nodeCount: number;
    clientIp: string;
    subscriptionName?: string;
  },
): Promise<ConvertRecord> {
  const id = await recordId(params.originalUrl);
  const now = Date.now();
  const existing = await getRecord(env, id);

  const record: ConvertRecord = existing
    ? {
        ...existing,
        name: params.subscriptionName || existing.name,
        clientType: params.clientType,
        updatedAt: now,
        lastAccess: now,
        hits: existing.hits + 1,
        nodeCount: params.nodeCount,
        lastIp: params.clientIp,
      }
    : {
        id,
        originalUrl: params.originalUrl,
        name: params.subscriptionName || extractNameFromUrl(params.originalUrl),
        clientType: params.clientType,
        createdAt: now,
        updatedAt: now,
        lastAccess: now,
        hits: 1,
        nodeCount: params.nodeCount,
        lastIp: params.clientIp,
      };

  await Promise.all([
    putRecord(env, record),
    existing ? Promise.resolve() : addToRecordIndex(env, id),
    incrementDailyHits(env, id),
  ]);
  return record;
}

export async function isUrlEnabled(env: Env, url: string): Promise<boolean> {
  const record = await getRecord(env, await recordId(url));
  return !record?.deleted;
}

export async function getRecord(env: Env, id: string): Promise<ConvertRecord | null> {
  if (!isSafeId(id)) return null;
  return env.LINKS_KV.get<ConvertRecord>(`${RECORD_PREFIX}${id}`, "json");
}

export async function listRecords(env: Env): Promise<ConvertRecord[]> {
  const index = await getRecordIndex(env);
  const rows = await Promise.all(index.ids.map((id) => getRecord(env, id)));
  return rows
    .filter((row): row is ConvertRecord => row !== null && !row.deleted)
    .sort((a, b) => b.lastAccess - a.lastAccess);
}

export async function updateRecord(
  env: Env,
  id: string,
  updates: Partial<Pick<ConvertRecord, "name" | "deleted">>,
): Promise<ConvertRecord | null> {
  const record = await getRecord(env, id);
  if (!record) return null;
  const updated = { ...record, ...updates, updatedAt: Date.now() };
  await putRecord(env, updated);
  return updated;
}

export async function deleteRecord(env: Env, id: string): Promise<boolean> {
  const updated = await updateRecord(env, id, { deleted: true });
  if (!updated) return false;
  await removeFromRecordIndex(env, id);
  return true;
}

export async function getStats(env: Env): Promise<StatsData> {
  const records = await listRecords(env);
  const activeAfter = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const today = await getDailyStats(env, new Date().toISOString().slice(0, 10));

  return {
    totalRecords: records.length,
    totalHits: records.reduce((sum, record) => sum + record.hits, 0),
    todayHits: today?.totalHits ?? 0,
    activeRecords: records.filter((record) => record.lastAccess > activeAfter).length,
  };
}

async function putRecord(env: Env, record: ConvertRecord): Promise<void> {
  await env.LINKS_KV.put(`${RECORD_PREFIX}${record.id}`, JSON.stringify(record), {
    expirationTtl: ONE_YEAR,
  });
}

async function getRecordIndex(env: Env): Promise<RecordIndex> {
  return (await env.LINKS_KV.get<RecordIndex>(RECORD_INDEX, "json")) ?? {
    ids: [],
    updatedAt: Date.now(),
  };
}

async function addToRecordIndex(env: Env, id: string): Promise<void> {
  const index = await getRecordIndex(env);
  if (!index.ids.includes(id)) index.ids.unshift(id);
  await env.LINKS_KV.put(RECORD_INDEX, JSON.stringify({ ids: index.ids, updatedAt: Date.now() }));
}

async function removeFromRecordIndex(env: Env, id: string): Promise<void> {
  const index = await getRecordIndex(env);
  const ids = index.ids.filter((item) => item !== id);
  await env.LINKS_KV.put(RECORD_INDEX, JSON.stringify({ ids, updatedAt: Date.now() }));
}

async function incrementDailyHits(env: Env, recordId: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const statsKey = `${DAILY_PREFIX}${date}`;
  const urlsKey = `${statsKey}:urls`;
  const [current, urlIndex] = await Promise.all([
    getDailyStats(env, date),
    env.LINKS_KV.get<{ ids: string[] }>(urlsKey, "json"),
  ]);
  const ids = urlIndex?.ids ?? [];
  const isNew = !ids.includes(recordId);
  if (isNew) ids.push(recordId);

  const stats: DailyStats = {
    date,
    totalHits: (current?.totalHits ?? 0) + 1,
    uniqueUrls: (current?.uniqueUrls ?? 0) + (isNew ? 1 : 0),
  };

  await Promise.all([
    env.LINKS_KV.put(statsKey, JSON.stringify(stats), { expirationTtl: ONE_MONTH }),
    env.LINKS_KV.put(urlsKey, JSON.stringify({ ids }), { expirationTtl: 2 * 24 * 60 * 60 }),
  ]);
}

async function getDailyStats(env: Env, date: string): Promise<DailyStats | null> {
  return env.LINKS_KV.get<DailyStats>(`${DAILY_PREFIX}${date}`, "json");
}

async function recordId(url: string): Promise<string> {
  return shortHash(url, 12);
}

function isSafeId(id: string): boolean {
  return /^[a-f0-9]{12}$/.test(id);
}
