import { crApiRuntime, hasApiToken, publicIpError, readPublicIp } from '@/lib/cr-api'
import { isDbConfigured, getPrisma } from '@/lib/db'
import { jsonResponse } from '@/lib/json'
import { llmConfigured, llmModel } from '@/lib/llm'
import type { StatusCheck, StatusResponse } from '@/lib/status'
import { META_TTL_MS, PLAYER_TTL_MS } from '@/lib/sync'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const checkedAt = new Date()
  const runtime: StatusResponse['runtime'] = {
    node: process.version,
    env: process.env.NODE_ENV ?? 'unknown',
    uptimeSeconds: Math.round(process.uptime()),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }

  const api: StatusResponse['clashRoyaleApi'] = {
    status: hasApiToken ? 'ok' : 'off',
    tokenConfigured: hasApiToken,
    baseUrl: process.env.CLASH_ROYALE_API_BASE ?? 'https://api.clashroyale.com/v1',
    egressIp: null,
    egressIpError: null,
    rateLimit: { limit: 0, windowSeconds: 60, used: 0 },
    cache: { memoryEntries: 0, dbEntries: 0 },
  }
  const runtimeInfo = crApiRuntime()
  api.rateLimit = { limit: runtimeInfo.limit, windowSeconds: runtimeInfo.windowSeconds, used: runtimeInfo.used }
  api.cache.memoryEntries = runtimeInfo.memoryEntries

  const database: StatusResponse['database'] = {
    status: isDbConfigured() ? 'ok' : 'off',
    latencyMs: null,
    counts: {},
    battleRawCoverage: null,
  }
  const sync: StatusResponse['sync'] = {
    playerTtlMinutes: Math.round(PLAYER_TTL_MS / 60_000),
    metaTtlMinutes: Math.round(META_TTL_MS / 60_000),
    players: [],
    meta: null,
    coachSessions: 0,
  }

  if (hasApiToken) {
    api.egressIp = await readPublicIp()
    api.egressIpError = api.egressIp ? null : publicIpError()
  }

  if (isDbConfigured()) {
    const started = Date.now()
    try {
      const prisma = getPrisma()
      const [
        players,
        battles,
        decks,
        cards,
        snapshots,
        coachSessions,
        cacheEntries,
        perPlayer,
        rawCoverage,
        latestMeta,
      ] = await Promise.all([
        prisma.player.findMany({
          select: { tag: true, name: true, trophies: true, lastFetchedAt: true },
          orderBy: { lastFetchedAt: 'desc' },
        }),
        prisma.battle.count(),
        prisma.battleDeck.count(),
        prisma.card.count(),
        prisma.metaSnapshot.count(),
        prisma.coachSession.count(),
        prisma.apiCache.count({ where: { expiresAt: { gt: checkedAt } } }),
        prisma.$queryRaw<
          { playerTag: string; battles: number; withRaw: number; lastBattle: Date | null }[]
        >`select b."playerTag" as "playerTag", count(*)::int as battles, count(b.raw)::int as "withRaw", max(b."battleTime") as "lastBattle"
          from "Battle" b group by b."playerTag"`,
        prisma.$queryRaw<{ total: number; withRaw: number }[]>`select count(*)::int as total, count(raw)::int as "withRaw" from "Battle"`,
        prisma.metaSnapshot.findFirst({ orderBy: { capturedAt: 'desc' } }),
      ])
      database.latencyMs = Date.now() - started
      database.counts = {
        Player: players.length,
        Battle: battles,
        BattleDeck: decks,
        Card: cards,
        MetaSnapshot: snapshots,
        CoachSession: coachSessions,
        ApiCache: cacheEntries,
      }
      const coverage = rawCoverage[0]
      database.battleRawCoverage = coverage
        ? { total: coverage.total, withRaw: coverage.withRaw }
        : null
      api.cache.dbEntries = cacheEntries

      const statsByTag = new Map(perPlayer.map((row) => [row.playerTag, row]))
      sync.players = players.map((player) => {
        const stats = statsByTag.get(player.tag)
        const ageSeconds = Math.max(
          0,
          Math.round((checkedAt.getTime() - player.lastFetchedAt.getTime()) / 1000),
        )
        return {
          tag: player.tag,
          name: player.name,
          trophies: player.trophies,
          lastFetchedAt: player.lastFetchedAt.toISOString(),
          ageSeconds,
          stale: ageSeconds > PLAYER_TTL_MS / 1000,
          battles: stats?.battles ?? 0,
          rawBattles: stats?.withRaw ?? 0,
          lastBattleAt: stats?.lastBattle ? stats.lastBattle.toISOString() : null,
        }
      })

      if (latestMeta) {
        const ageSeconds = Math.max(
          0,
          Math.round((checkedAt.getTime() - latestMeta.capturedAt.getTime()) / 1000),
        )
        sync.meta = {
          capturedAt: latestMeta.capturedAt.toISOString(),
          ageSeconds,
          fresh: ageSeconds * 1000 <= META_TTL_MS,
          battles: latestMeta.battles,
        }
      }
      sync.coachSessions = coachSessions
    } catch (error) {
      database.status = 'error'
      database.error = error instanceof Error ? error.message : 'PostgreSQL is unreachable.'
    }
  }

  const checks: StatusCheck[] = [
    {
      key: 'cr-token',
      label: 'Clash Royale API key',
      status: hasApiToken ? 'ok' : 'off',
      detail: hasApiToken
        ? `Token loaded from CLASH_ROYALE_API_TOKEN. Calls leave from ${
            api.egressIp ?? 'an address RoyaleIQ could not read'
          }${api.egressIpError ? ` (${api.egressIpError})` : ''} - that address must be on the key's IP allowlist.`
        : 'Set CLASH_ROYALE_API_TOKEN in .env.local; without it /api/player returns 503 and the meta page serves only its seeded fallback dataset.',
    },
    {
      key: 'rate-limit',
      label: 'Request budget',
      status: runtimeInfo.used >= runtimeInfo.limit ? 'warn' : 'ok',
      detail: `${runtimeInfo.used} of ${runtimeInfo.limit} Clash Royale calls spent in the last ${runtimeInfo.windowSeconds}s, in-process.`,
    },
    {
      key: 'postgres',
      label: 'PostgreSQL',
      status: database.status,
      detail:
        database.status === 'ok'
          ? `Connected in ${database.latencyMs} ms. ${database.counts.Battle ?? 0} battles, ${database.counts.Card ?? 0} cards stored.`
          : (database.error ??
            'DATABASE_URL is not set - RoyaleIQ is running stateless: nothing is stored between restarts.'),
    },
    {
      key: 'raw-coverage',
      label: 'Diagnosis payload coverage',
      status:
        database.battleRawCoverage && database.battleRawCoverage.withRaw === database.battleRawCoverage.total
          ? 'ok'
          : database.battleRawCoverage?.withRaw
            ? 'warn'
            : 'off',
      detail: database.battleRawCoverage
        ? `${database.battleRawCoverage.withRaw} of ${database.battleRawCoverage.total} stored battles keep the raw payload the diagnosis engine reads.`
        : 'No battles stored yet.',
    },
    {
      key: 'meta',
      label: 'Meta aggregate',
      status: sync.meta ? (sync.meta.fresh ? 'ok' : 'warn') : 'off',
      detail: sync.meta
        ? `Built ${sync.meta.ageSeconds}s ago from ${sync.meta.battles} battles; reuses it for ${sync.metaTtlMinutes} minutes.`
        : 'No aggregate stored yet - the first /api/meta call builds one.',
    },
    {
      key: 'coach',
      label: 'AI coach',
      status: llmConfigured ? 'ok' : 'off',
      detail: llmConfigured
        ? `Calling ${llmModel}. ${sync.coachSessions} session(s) recorded.`
        : 'No LLM key configured - the coach answers from the analytics rules only.',
    },
  ]

  return jsonResponse(request, {
    checkedAt: checkedAt.toISOString(),
    runtime,
    clashRoyaleApi: api,
    database,
    sync,
    checks,
  } satisfies StatusResponse)
}
