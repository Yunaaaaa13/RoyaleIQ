import type { MetaSnapshot } from '@/lib/battle'
import { buildCounters, buildCardMatchups, getMatchupIndex } from '@/lib/card-matchups'
import { buildCardIntel } from '@/lib/card-intel'
import { findCard } from '@/lib/cards'
import { fetchLiveMeta, hasApiToken } from '@/lib/cr-api'
import { demoMeta } from '@/lib/demo'
import { jsonResponse } from '@/lib/json'
import { startMetaRefresh, staleMetaNotice } from '@/lib/meta-refresh'
import {
  META_TTL_MS,
  persistMetaSnapshot,
  readLatestMetaSnapshot,
  readMetaSnapshotHistory,
} from '@/lib/sync'
import { after } from 'next/server'

export const dynamic = 'force-dynamic'
/** The rebuild walks the whole player pool; give `after()` room to finish it. */
export const maxDuration = 300

const LIVE_TOKEN_NOTICE =
  'Live meta is off. Set CLASH_ROYALE_API_TOKEN in .env.local to aggregate real ladder battles.'

/**
 * Same freshness ladder as `/api/meta`: a stored aggregate inside the TTL wins,
 * a live rebuild is attempted only when the token exists, and any stored row -
 * however old - beats demo data when the API is unreachable. The card page is
 * read-heavy, so once a row has aged past the TTL it is served immediately with
 * a freshness notice while the rebuild runs behind the reader.
 */
async function resolveMeta(): Promise<{ snapshot: MetaSnapshot; notice?: string }> {
  const fresh = await readLatestMetaSnapshot(META_TTL_MS)
  if (fresh) return { snapshot: fresh }

  if (!hasApiToken) {
    const stored = await readLatestMetaSnapshot(Number.MAX_SAFE_INTEGER)
    if (stored) return { snapshot: stored, notice: LIVE_TOKEN_NOTICE }
    return { snapshot: demoMeta(), notice: LIVE_TOKEN_NOTICE }
  }

  // Past the TTL, and a token exists (the branch above returned otherwise):
  // answer from the newest row at any age instead of stalling the response
  // behind a full round of Clash Royale API calls.
  const older = await readLatestMetaSnapshot(Number.MAX_SAFE_INTEGER)
  if (older) {
    // Handed to `after()` so the rebuild survives the response being flushed.
    after(() => startMetaRefresh())
    return { snapshot: older, notice: staleMetaNotice(older.generatedAt) }
  }

  try {
    const snapshot = await fetchLiveMeta()
    if (snapshot.source === 'live') await persistMetaSnapshot(snapshot)
    return { snapshot }
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not reach the Clash Royale API right now.'
    const stored = await readLatestMetaSnapshot(Number.MAX_SAFE_INTEGER)
    if (stored) return { snapshot: stored, notice: message }
    return { snapshot: demoMeta(), notice: message }
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const card = findCard(decodeURIComponent(key))
  if (!card) {
    return jsonResponse(
      request,
      { available: false, reason: `Unknown card "${key}".` },
      { status: 404 },
    )
  }

  const [{ snapshot, notice }, history, index] = await Promise.all([
    resolveMeta(),
    readMetaSnapshotHistory(24),
    // The matchup index is independent of the snapshot ladder: if the corpus
    // cannot be read the card page still renders, with counters saying so.
    getMatchupIndex().catch(() => null),
  ])

  const counters = buildCounters(index ? buildCardMatchups(index, card) : null)

  return jsonResponse(request, buildCardIntel(card, snapshot, history, counters, notice))
}
