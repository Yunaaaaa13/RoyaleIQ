export interface RecentPlayer {
  tag: string
  name: string
  trophies: number
  seenAt: string
}

const STORAGE_KEY = 'royaleiq:recent-players'
const LIMIT = 10

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
  return next
}

export function readRecent(): RecentPlayer[] {
  const store = storage()
  if (!store) return []
  try {
    const parsed: unknown = JSON.parse(store.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecentPlayer).slice(0, LIMIT)
  } catch {
    return []
  }
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
      return []
    }
  }
  return []
}
