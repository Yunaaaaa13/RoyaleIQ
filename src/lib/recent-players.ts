import { useSyncExternalStore } from 'react'

export interface RecentPlayer {
  tag: string
  name: string
  trophies: number
  seenAt: string
}

const STORAGE_KEY = 'royaleiq:recent-players'
/** Fired on every local write so subscribers in this tab refresh too. */
const CHANGE_EVENT = 'royaleiq:recent-players-changed'
const LIMIT = 10

const EMPTY: RecentPlayer[] = []

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isRecentPlayer(entry: unknown): entry is RecentPlayer {
  if (!entry || typeof entry !== 'object') return false
  const candidate = entry as Record<string, unknown>
  return (
    typeof candidate.tag === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.trophies === 'number' &&
    typeof candidate.seenAt === 'string'
  )
}

/**
 * `useSyncExternalStore` calls `getSnapshot` several times per render and
 * treats a changed reference as a changed store, so parsing has to return the
 * same array until the stored string actually moves.
 */
let rawCache: string | null = null
let parsedCache: RecentPlayer[] = EMPTY

function parse(raw: string): RecentPlayer[] {
  if (raw === rawCache) return parsedCache
  let next: RecentPlayer[] = EMPTY
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) next = parsed.filter(isRecentPlayer).slice(0, LIMIT)
  } catch {
    next = EMPTY
  }
  rawCache = raw
  parsedCache = next
  return next
}

export function readRecent(): RecentPlayer[] {
  const store = storage()
  if (!store) return EMPTY
  try {
    return parse(store.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return EMPTY
  }
}

function notify(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
}

function write(entries: RecentPlayer[]): RecentPlayer[] {
  const next = entries.slice(0, LIMIT)
  const store = storage()
  if (store) {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      return next
    }
  }
  notify()
  return next
}

export function pushRecent(entry: {
  tag: string
  name: string
  trophies: number
}): RecentPlayer[] {
  const fresh: RecentPlayer = {
    tag: entry.tag,
    name: entry.name,
    trophies: entry.trophies,
    seenAt: new Date().toISOString(),
  }
  return write([fresh, ...readRecent().filter((item) => item.tag !== fresh.tag)])
}

export function removeRecent(tag: string): RecentPlayer[] {
  return write(readRecent().filter((item) => item.tag !== tag))
}

export function clearRecent(): RecentPlayer[] {
  const store = storage()
  if (store) {
    try {
      store.removeItem(STORAGE_KEY)
    } catch {
      return EMPTY
    }
  }
  notify()
  return EMPTY
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CHANGE_EVENT, onStoreChange)
  // Another tab writing the same key.
  window.addEventListener('storage', onStoreChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange)
    window.removeEventListener('storage', onStoreChange)
  }
}

/**
 * The recent-player list as live store state.
 *
 * Reading `localStorage` in an effect would need a `setState` on mount to show
 * anything, which is both a cascading render and one render behind every write;
 * subscribing to the store instead makes the header and the player panel agree
 * the moment a profile is opened, in this tab or another one.
 */
export function useRecentPlayers(): RecentPlayer[] {
  return useSyncExternalStore(subscribe, readRecent, () => EMPTY)
}
