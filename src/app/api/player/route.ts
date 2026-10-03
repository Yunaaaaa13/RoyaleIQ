import { CrApiError, hasApiToken, type CrPlayer } from '@/lib/cr-api'
import { isDbConfigured } from '@/lib/db'
import { jsonResponse } from '@/lib/json'
import { buildPlayerStats } from '@/lib/player'
import { fetchLiveBundle, persistPlayer, readPlayer, readTracked } from '@/lib/sync'
import { normalizeTag } from '@/lib/tags'

export const dynamic = 'force-dynamic'

const NO_TOKEN =
  'Live player data is off. Set CLASH_ROYALE_API_TOKEN in .env.local to load a real profile.'

/**
 * The Clash Royale profile carries the player's whole card collection, badge
 * sheet and achievement list - about 45KB that no view here renders. The
 * response is narrowed to the declared `CrPlayer` shape instead, so what ships
 * is the type the client already types against.
 */
function publicProfile(profile: CrPlayer): CrPlayer {
  return {
    tag: profile.tag,
    name: profile.name,
    expLevel: profile.expLevel,
    trophies: profile.trophies,
    bestTrophies: profile.bestTrophies,
    wins: profile.wins,
    losses: profile.losses,
    battleCount: profile.battleCount,
    arena: profile.arena,
    clan: profile.clan,
    currentFavouriteCard: profile.currentFavouriteCard,
    deck: profile.deck,
    gold: profile.gold,
    cardsFound: profile.cardsFound,
    legendTrophies: profile.legendTrophies,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawTag = searchParams.get('tag')?.trim() ?? ''
  const tag = normalizeTag(rawTag)

  // There is no demo profile: a search without a tag is a bad request, not a
  // seeded account, so the UI keeps its own empty state instead of calling us.
  if (!tag) {
    return Response.json({ error: 'Enter a player tag to load a profile.' }, { status: 400 })
  }

  // Stored profile first: it costs one query and survives API outages.
  const stored = await readPlayer(tag)
  const tracked = await readTracked(tag)

  if (stored?.fresh) {
    return jsonResponse(request, {
      source: 'db' as const,
      profile: publicProfile(stored.profile),
      stats: stored.stats,
      syncedAt: stored.syncedAt,
      tracked,
    })
  }

  // No token configured: still serve whatever Postgres already holds, but never
  // fabricate a player.
  if (!hasApiToken) {
    if (stored) {
      return jsonResponse(request, {
        source: 'db' as const,
        profile: publicProfile(stored.profile),
        stats: stored.stats,
        syncedAt: stored.syncedAt,
        tracked,
        notice: `${NO_TOKEN} Showing the profile stored on ${new Date(
          stored.syncedAt ?? Date.now(),
        ).toLocaleString()}.`,
      })
    }
    return Response.json({ error: NO_TOKEN }, { status: 503 })
  }

  try {
    const { profile, battles } = await fetchLiveBundle(tag)
    const syncedAt = new Date().toISOString()
    await persistPlayer(tag, profile, battles)
    return jsonResponse(request, {
      source: 'live' as const,
      profile: publicProfile(profile),
      stats: buildPlayerStats(battles),
      syncedAt,
      tracked,
      stored: isDbConfigured(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const notFound = error instanceof CrApiError && error.status === 404

    // Serve whatever we have before giving up.
    if (stored) {
      return jsonResponse(request, {
        source: 'db' as const,
        profile: publicProfile(stored.profile),
        stats: stored.stats,
        syncedAt: stored.syncedAt,
        tracked,
        notice: `Showing the profile stored on ${new Date(
          stored.syncedAt ?? Date.now(),
        ).toLocaleString()}. Live refresh failed: ${message}`,
      })
    }

    // No stored data and the API is unreachable: report the failure verbatim so
    // an allowlist problem is never mistaken for a typo in the tag.
    return Response.json(
      {
        error: `Could not load ${tag}: ${message}`,
        source: 'live' as const,
      },
      { status: notFound ? 404 : 502 },
    )
  }
}
