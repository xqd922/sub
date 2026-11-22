'use client'

import { useSyncExternalStore } from 'react'
import { AdminApiError, adminFetch } from '@/features/admin/admin.client'
import type {
  ConvertRecord,
  CustomClientRule,
  CustomRoutingRule,
  DailyStats,
  HourlyStats,
  ShortLink,
  StatsData,
} from '@/shared/admin.types'

const SESSION_CACHE_KEY = 'sub:admin:cache:v1'
const SESSION_CACHE_TTL_MS = 10 * 60 * 1000
const SOFT_FRESH_MS = 8_000

export interface AdminBootstrapPayload {
  stats: StatsData
  daily: DailyStats[]
  hourly?: HourlyStats[]
  records: ConvertRecord[]
  shortLinks: ShortLink[]
  routingRules: CustomRoutingRule[]
  clientRules: CustomClientRule[]
  fetchedAt?: number
}

export interface AdminCacheState {
  hydrated: boolean
  bootstrapping: boolean
  stats: StatsData | null
  daily: DailyStats[]
  hourly: HourlyStats[]
  records: ConvertRecord[]
  shortLinks: ShortLink[]
  routingRules: CustomRoutingRule[]
  clientRules: CustomClientRule[]
  lastFetchedAt: number
}

const INITIAL_STATE: AdminCacheState = {
  hydrated: false,
  bootstrapping: false,
  stats: null,
  daily: [],
  hourly: [],
  records: [],
  shortLinks: [],
  routingRules: [],
  clientRules: [],
  lastFetchedAt: 0,
}

let state: AdminCacheState = INITIAL_STATE
const listeners = new Set<() => void>()
let inFlightBootstrap: Promise<'ok' | 'unauthorized' | 'error'> | null = null

function emit() {
  for (const listener of listeners) listener()
}

function setState(next: AdminCacheState) {
  state = next
  emit()
}

function recomputeStats(
  records: ConvertRecord[],
  shortLinks: ShortLink[],
  prevStats: StatsData | null,
  daily: DailyStats[],
): StatsData {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  let totalRecords = 0
  let disabledRecords = 0
  let totalHits = 0
  let activeRecords = 0

  for (const record of records) {
    if (record.deleted) {
      disabledRecords++
      continue
    }
    totalRecords++
    totalHits += record.hits
    if (record.lastAccess > sevenDaysAgo) {
      activeRecords++
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const todayHits =
    daily.find((item) => item.date === today)?.totalHits ?? prevStats?.todayHits ?? 0

  return {
    totalRecords,
    disabledRecords,
    totalShortLinks: shortLinks.length,
    totalHits,
    todayHits,
    activeRecords,
  }
}

function persistSnapshot(snapshot: AdminCacheState) {
  if (typeof window === 'undefined' || !snapshot.hydrated) return
  try {
    window.sessionStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify({
        stats: snapshot.stats,
        daily: snapshot.daily,
        hourly: snapshot.hourly,
        records: snapshot.records,
        shortLinks: snapshot.shortLinks,
        routingRules: snapshot.routingRules,
        clientRules: snapshot.clientRules,
        lastFetchedAt: snapshot.lastFetchedAt,
      }),
    )
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function hydrateAdminCacheFromStorage(): boolean {
  if (typeof window === 'undefined') return false
  if (state.hydrated) return true

  try {
    const raw = window.sessionStorage.getItem(SESSION_CACHE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as Partial<AdminCacheState>
    if (
      typeof parsed.lastFetchedAt !== 'number' ||
      Date.now() - parsed.lastFetchedAt > SESSION_CACHE_TTL_MS ||
      !Array.isArray(parsed.records) ||
      !Array.isArray(parsed.shortLinks)
    ) {
      window.sessionStorage.removeItem(SESSION_CACHE_KEY)
      return false
    }

    setState({
      hydrated: true,
      bootstrapping: state.bootstrapping,
      stats: parsed.stats ?? null,
      daily: Array.isArray(parsed.daily) ? parsed.daily : [],
      hourly: Array.isArray(parsed.hourly) ? parsed.hourly : [],
      records: parsed.records,
      shortLinks: parsed.shortLinks,
      routingRules: Array.isArray(parsed.routingRules) ? parsed.routingRules : [],
      clientRules: Array.isArray(parsed.clientRules) ? parsed.clientRules : [],
      lastFetchedAt: parsed.lastFetchedAt,
    })
    return true
  } catch {
    return false
  }
}

export function clearAdminCache() {
  inFlightBootstrap = null
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(SESSION_CACHE_KEY)
    } catch {
      // Ignore storage errors
    }
  }
  setState(INITIAL_STATE)
}

export async function bootstrapAdminCache(options?: {
  force?: boolean
}): Promise<'ok' | 'unauthorized' | 'error'> {
  const force = Boolean(options?.force)

  if (!force && state.hydrated && Date.now() - state.lastFetchedAt < SOFT_FRESH_MS) {
    return 'ok'
  }

  if (inFlightBootstrap) {
    return inFlightBootstrap
  }

  setState({ ...state, bootstrapping: true })

  inFlightBootstrap = (async () => {
    try {
      const data = await adminFetch<AdminBootstrapPayload>('/api/admin/bootstrap')
      const next: AdminCacheState = {
        hydrated: true,
        bootstrapping: false,
        stats: data.stats,
        daily: data.daily || [],
        hourly: data.hourly || [],
        records: data.records || [],
        shortLinks: data.shortLinks || [],
        routingRules: data.routingRules || [],
        clientRules: data.clientRules || [],
        lastFetchedAt: Date.now(),
      }
      setState(next)
      persistSnapshot(next)
      return 'ok' as const
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        clearAdminCache()
        return 'unauthorized' as const
      }
      setState({ ...state, bootstrapping: false })
      return 'error' as const
    } finally {
      inFlightBootstrap = null
    }
  })()

  return inFlightBootstrap
}

export function updateCachedRecords(updater: (prev: ConvertRecord[]) => ConvertRecord[]) {
  const nextRecords = updater(state.records)
  const next: AdminCacheState = {
    ...state,
    hydrated: true,
    records: nextRecords,
    stats: recomputeStats(nextRecords, state.shortLinks, state.stats, state.daily),
    lastFetchedAt: Date.now(),
  }
  setState(next)
  persistSnapshot(next)
}

export function updateCachedShortLinks(updater: (prev: ShortLink[]) => ShortLink[]) {
  const nextShortLinks = updater(state.shortLinks)
  const next: AdminCacheState = {
    ...state,
    hydrated: true,
    shortLinks: nextShortLinks,
    stats: recomputeStats(state.records, nextShortLinks, state.stats, state.daily),
    lastFetchedAt: Date.now(),
  }
  setState(next)
  persistSnapshot(next)
}

export function updateCachedRoutingRules(rules: CustomRoutingRule[]) {
  const next: AdminCacheState = {
    ...state,
    hydrated: true,
    routingRules: rules,
    lastFetchedAt: Date.now(),
  }
  setState(next)
  persistSnapshot(next)
}

export function updateCachedClientRules(rules: CustomClientRule[]) {
  const next: AdminCacheState = {
    ...state,
    hydrated: true,
    clientRules: rules,
    lastFetchedAt: Date.now(),
  }
  setState(next)
  persistSnapshot(next)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): AdminCacheState {
  return state
}

function getServerSnapshot(): AdminCacheState {
  return INITIAL_STATE
}

export function useAdminCache(): AdminCacheState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
