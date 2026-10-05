import { fetchLiveMeta } from './cr-api'
import { relativeAge } from './time'
import { persistMetaSnapshot } from './sync'

interface RefreshState {
  running: Promise<void> | null
}

/**
 * Held on `globalThis` so every route bundle in the server shares one latch:
 * without it Turbopack's per-entry modules would start a rebuild per route.
 */
const GLOBAL_KEY = '__royaleiqMetaRefresh'

function state(): RefreshState {
  const host = globalThis as unknown as Record<string, RefreshState | undefined>
  return (host[GLOBAL_KEY] ??= { running: null })
}

/**
 * Rebuild the live aggregate without making the caller wait for it.
 *
 * A full pull walks the whole player pool, so after `META_TTL_MS` expires a
 * blocking rebuild can hold a page open for the better part of a minute. This
 * lets the reader answer from the stored row instead, and the first caller
 * starts the work while everyone behind it joins that same promise rather than
 * launching a second round of API calls.
 *
 * The promise is meant to be handed to Next's `after()` (which becomes
 * `waitUntil` on Vercel): a fire-and-forget promise dies with the serverless
 * invocation once the response is flushed, so the rebuild would never persist.
 */
export function startMetaRefresh(): Promise<void> {
  const current = state()
  if (current.running) return current.running
  current.running = (async () => {
    try {
      // `force` matters: a snapshot primed into the in-process cache would
      // otherwise short-circuit this and re-persist the very row we are
      // trying to replace.
      const snapshot = await fetchLiveMeta({ force: true })
      if (snapshot.source === 'live') await persistMetaSnapshot(snapshot)
    } catch (error) {
      // Best effort - the next request past the TTL starts it again.
      console.error('[meta-refresh] background rebuild failed', error)
    } finally {
      current.running = null
    }
  })()
  return current.running
}

/** Honest wording for a payload served from an aggregate that has aged out. */
export function staleMetaNotice(generatedAt: string): string {
  const age = relativeAge(generatedAt)
  return (
    `Showing the most recent stored aggregate${age ? ` (from ${age})` : ''}; ` +
    'a fresh one is being collected in the background.'
  )
}
