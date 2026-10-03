import { fetchLiveMeta, hasApiToken, primeMetaCache } from '@/lib/cr-api'
import { demoMeta } from '@/lib/demo'
import type { MetaSnapshot } from '@/lib/battle'
import { jsonResponse } from '@/lib/json'
import { refreshMetaInBackground, staleMetaNotice } from '@/lib/meta-refresh'
import { META_TTL_MS, persistMetaSnapshot, readLatestMetaSnapshot } from '@/lib/sync'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const forceDemo = searchParams.get('source') === 'demo'

  if (forceDemo || !hasApiToken) {
    const snapshot = demoMeta()
    return jsonResponse(request, {
      ...snapshot,
      notice: hasApiToken
        ? undefined
        : 'Live meta is off. Set CLASH_ROYALE_API_TOKEN in .env.local to aggregate real ladder battles.',
    })
  }

  // 1. An aggregate stored in Postgres inside the TTL replaces an API rebuild,
  //    and primes the in-process cache so the next call skips the query too.
  const stored = await readLatestMetaSnapshot(META_TTL_MS)
  if (stored) {
    primeMetaCache(stored)
    return jsonResponse(request, stored)
  }

  // 2. Past the TTL, a stored row at any age answers immediately while the
  //    rebuild runs behind the reader. A full pull walks the whole player pool,
  //    which can hold the response open for the better part of a minute - too
  //    long for a page that is only reading a table. The stale row is never
  //    primed into the cache: that would let the rebuild short-circuit on the
  //    very value it is meant to replace.
  const older = await readLatestMetaSnapshot(Number.MAX_SAFE_INTEGER)
  if (older) {
    refreshMetaInBackground()
    return jsonResponse(request, { ...older, notice: staleMetaNotice(older.generatedAt) })
  }

  try {
    const snapshot: MetaSnapshot = await fetchLiveMeta()
    if (snapshot.source === 'live') await persistMetaSnapshot(snapshot)
    return jsonResponse(request, snapshot)
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not reach the Clash Royale API right now.'
    // 3. Any older stored aggregate beats a demo payload when the API is down.
    const fallback = await readLatestMetaSnapshot(Number.MAX_SAFE_INTEGER)
    if (fallback) return jsonResponse(request, { ...fallback, notice: message })
    return jsonResponse(request, { ...demoMeta(), notice: message })
  }
}
