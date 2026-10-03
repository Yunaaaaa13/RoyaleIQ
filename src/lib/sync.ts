import 'server-only'

import { getPrisma, isDbConfigured } from './db'
import { fetchBattleLog, fetchCards, fetchPlayer, normalizeBattleLog } from './cr-api'
import type { CrPlayer, RawBattle } from './cr-api'
import { detectArchetype } from './archetypes'
import { deckKeys } from './battle'
import type { MetaSnapshot, NormalizedBattle } from './battle'
import { buildPlayerStats } from './player'
import type { PlayerStats } from './player'
import { ALL_CARDS, getCard, keyForName } from './cards'
import type { Prisma } from '@/generated/prisma/client'
import type { Player } from '@/generated/prisma/client'

/** A stored profile younger than this is served straight from Postgres. */
export const PLAYER_TTL_MS = 5 * 60_000
/** Write a PlayerSnapshot at least this often even when nothing moved. */
const SNAPSHOT_MIN_GAP_MS = 30 * 60_000
/** Most recent battles read back for the stats engine. */
const BATTLE_READ_LIMIT = 200

export interface PlayerBundle {
  profile: CrPlayer
  stats: PlayerStats
  /** True when the stored row is fresh enough that we can skip the API. */
  fresh: boolean
  syncedAt: string | null
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export function battleKey(tag: string, battle: NormalizedBattle): string {
  return `${battle.time}|${tag}|${battle.opponentTag ?? ''}`
}

function averageElixir(deck: string[]): number {
  if (!deck.length) return 0
  const total = deck.reduce((sum, key) => sum + (getCard(key)?.elixir ?? 0), 0)
  return Math.round((total / deck.length) * 100) / 100
}

function toNormalizedBattle(row: {
  id: string
  battleTime: Date
  type: string
  arena: string | null
  result: string
  playerCrowns: number
  opponentCrowns: number
  opponentTag: string | null
  opponentName: string | null
  raw?: unknown
  decks: { side: string; cards: string[] }[]
}): NormalizedBattle {
  const team = row.decks.find((deck) => deck.side === 'team')
  const rival = row.decks.find((deck) => deck.side === 'opponent')
  return {
    id: row.id,
    time: row.battleTime.toISOString(),
    type: row.type,
    result: row.result as NormalizedBattle['result'],
    crowns: { us: row.playerCrowns, them: row.opponentCrowns },
    deck: team?.cards ?? [],
    opponentDeck: rival?.cards ?? [],
    opponentName: row.opponentName ?? 'Unknown',
    opponentTag: row.opponentTag ?? undefined,
    arena: row.arena ?? undefined,
    raw: (row.raw as RawBattle | null) ?? undefined,
  }
}

/**
 * Recent battles for one player, including the raw payload the diagnosis
 * engine needs. Returns [] when the database is unavailable.
 */
export async function readBattles(tag: string, limit = 20): Promise<NormalizedBattle[]> {
  if (!isDbConfigured()) return []
  try {
    const rows = await getPrisma().battle.findMany({
      where: { playerTag: tag },
      orderBy: { battleTime: 'desc' },
      take: limit,
      include: { decks: { select: { side: true, cards: true } } },
    })
    return rows.map(toNormalizedBattle).filter((battle) => battle.deck.length >= 4)
  } catch {
    return []
  }
}

/**
 * Every battle we have stored, newest first, across all tracked players. Used
 * as extra training rows for the win-prediction model - the live meta pool
 * covers players nobody has looked up, stored history covers the reverse.
 */
export async function readAllStoredBattles(limit = 600): Promise<NormalizedBattle[]> {
  if (!isDbConfigured()) return []
  try {
    const rows = await getPrisma().battle.findMany({
      orderBy: { battleTime: 'desc' },
      take: limit,
      include: { decks: { select: { side: true, cards: true } } },
    })
    return rows.map(toNormalizedBattle).filter((battle) => battle.deck.length >= 4)
  } catch {
    return []
  }
}

function toProfile(player: Player): CrPlayer | null {
  const raw = player.raw
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const candidate = raw as unknown as CrPlayer
    if (candidate.tag && candidate.name) return candidate
  }
  return null
}

function profileSnapshotSource(profile: CrPlayer): {
  deck: string[]
  winRate: number | null
} {
  const decided = profile.wins + profile.losses
  return {
    deck: deckKeys(profile.deck),
    winRate: decided > 0 ? Math.round((profile.wins / decided) * 1000) / 10 : null,
  }
}

/**
 * Read a stored player profile and their battle history back out of Postgres.
 * Returns null when the player is unknown or has no battles yet.
 */
export async function readPlayer(tag: string): Promise<PlayerBundle | null> {
  if (!isDbConfigured()) return null
  try {
    const prisma = getPrisma()
    const player = await prisma.player.findUnique({ where: { tag } })
    if (!player) return null

    const rows = await prisma.battle.findMany({
      where: { playerTag: tag },
      orderBy: { battleTime: 'desc' },
      take: BATTLE_READ_LIMIT,
      include: { decks: { select: { side: true, cards: true } } },
    })
    const battles = rows.map(toNormalizedBattle).filter((battle) => battle.deck.length >= 4)
    if (!battles.length) return null

    const profile = toProfile(player)
    if (!profile) return null

    return {
      profile,
      stats: buildPlayerStats(battles),
      fresh: Date.now() - player.lastFetchedAt.getTime() < PLAYER_TTL_MS,
      syncedAt: player.lastFetchedAt.toISOString(),
    }
  } catch {
    // A broken database must never take the page down - fall through to live.
    return null
  }
}

/** Whether this player is on the tracked list that the cron refreshes. */
export async function readTracked(tag: string): Promise<boolean> {
  if (!isDbConfigured()) return false
  try {
    const row = await getPrisma().player.findUnique({
      where: { tag },
      select: { tracked: true },
    })
    return row?.tracked ?? false
  } catch {
    return false
  }
}

/** Pull the profile + battle log from the Clash Royale API and return them. */
export async function fetchLiveBundle(tag: string): Promise<{
  profile: CrPlayer
  battles: NormalizedBattle[]
}> {
  const profile = await fetchPlayer(tag)
  const log = await fetchBattleLog(tag)
  return { profile, battles: normalizeBattleLog(log) }
}

/**
 * Persist a live pull. Idempotent: battles are keyed on
 * `battleTime|playerTag|opponentTag`, so re-pulling a partially stored
 * history only inserts what is missing.
 */
export async function persistPlayer(
  tag: string,
  profile: CrPlayer,
  battles: NormalizedBattle[],
): Promise<void> {
  if (!isDbConfigured()) return
  const prisma = getPrisma()
  const now = new Date()

  const [previous, lastSnapshot] = await Promise.all([
    prisma.player.findUnique({
      where: { tag },
      select: { trophies: true, wins: true, losses: true, battleCount: true, arena: true },
    }),
    prisma.playerSnapshot.findFirst({
      where: { playerTag: tag },
      orderBy: { capturedAt: 'desc' },
      select: { capturedAt: true },
    }),
  ])

  const base = {
    name: profile.name,
    expLevel: profile.expLevel ?? null,
    trophies: profile.trophies ?? 0,
    bestTrophies: profile.bestTrophies ?? 0,
    arena: profile.arena?.name ?? null,
    wins: profile.wins ?? 0,
    losses: profile.losses ?? 0,
    battleCount: profile.battleCount ?? 0,
    favouriteCard: profile.currentFavouriteCard?.name ?? null,
    gold: profile.gold ?? null,
    legendTrophies: profile.legendTrophies ?? null,
    clanTag: profile.clan?.tag ?? null,
    clanName: profile.clan?.name ?? null,
    raw: json(profile),
    lastFetchedAt: now,
  }

  if (previous) {
    await prisma.player.update({ where: { tag }, data: base })
  } else {
    await prisma.player.create({ data: { tag, ...base } })
  }

  const snapshotSource = profileSnapshotSource(profile)
  const changed =
    !previous ||
    previous.trophies !== base.trophies ||
    previous.wins !== base.wins ||
    previous.losses !== base.losses ||
    previous.battleCount !== base.battleCount ||
    previous.arena !== base.arena
  const snapshotDue =
    !lastSnapshot || now.getTime() - lastSnapshot.capturedAt.getTime() > SNAPSHOT_MIN_GAP_MS

  if (changed || snapshotDue) {
    await prisma.playerSnapshot.create({
      data: {
        playerTag: tag,
        capturedAt: now,
        trophies: base.trophies,
        bestTrophies: base.bestTrophies,
        wins: base.wins,
        losses: base.losses,
        battleCount: base.battleCount,
        winRate: snapshotSource.winRate,
        arena: base.arena,
        deck: snapshotSource.deck,
      },
    })
  }

  await persistBattles(tag, battles)
}

interface ExistingBattle {
  id: string
  hasRaw: boolean
}

async function persistBattle(
  tag: string,
  battle: NormalizedBattle,
  existing: ExistingBattle | null,
): Promise<void> {
  const prisma = getPrisma()

  if (!existing) {
    await prisma.battle.create({
      data: {
        battleKey: battleKey(tag, battle),
        battleTime: new Date(battle.time),
        playerTag: tag,
        type: battle.type,
        arena: battle.arena ?? null,
        result: battle.result,
        playerCrowns: battle.crowns.us,
        opponentCrowns: battle.crowns.them,
        opponentTag: battle.opponentTag ?? null,
        opponentName: battle.opponentName,
        raw: battle.raw ? json(battle.raw) : undefined,
        decks: {
          create: [
            {
              side: 'team',
              cards: [...battle.deck].sort(),
              avgElixir: averageElixir(battle.deck),
              archetype: detectArchetype(battle.deck).archetype.key,
            },
            {
              side: 'opponent',
              cards: [...battle.opponentDeck].sort(),
              avgElixir: averageElixir(battle.opponentDeck),
              archetype: detectArchetype(battle.opponentDeck).archetype.key,
            },
          ],
        },
      },
    })
    return
  }

  // Battles stored before raw payloads were captured get backfilled here, so
  // history written by older builds becomes diagnosable too.
  if (existing.hasRaw || !battle.raw) return
  await prisma.battle.update({ where: { id: existing.id }, data: { raw: json(battle.raw) } })
}

async function persistBattles(tag: string, battles: NormalizedBattle[]): Promise<void> {
  if (!battles.length) return
  const prisma = getPrisma()

  const rows = await prisma.battle.findMany({
    where: { playerTag: tag, battleKey: { in: battles.map((b) => battleKey(tag, b)) } },
    select: { id: true, battleKey: true, raw: true },
  })
  const byKey = new Map(rows.map((row) => [row.battleKey, row]))

  for (const battle of battles) {
    const row = byKey.get(battleKey(tag, battle))
    await persistBattle(tag, battle, row ? { id: row.id, hasRaw: row.raw != null } : null)
  }
}

// ---------------------------------------------------------------------------
// Meta snapshots
// ---------------------------------------------------------------------------

/** A stored meta aggregate younger than this can replace a live rebuild. */
export const META_TTL_MS = 10 * 60_000

export async function persistMetaSnapshot(snapshot: MetaSnapshot): Promise<void> {
  if (!isDbConfigured()) return
  try {
    await getPrisma().metaSnapshot.create({
      data: {
        period: 'rolling',
        source: snapshot.source,
        battles: snapshot.battles,
        players: snapshot.players,
        payload: json(snapshot),
      },
    })
  } catch (error) {
    // analytics storage is best-effort - but a build that never lands keeps
    // every reader on the same old row, so the reason must not vanish.
    console.error('[persist-meta] could not store the live snapshot', error)
  }
}

/** Newest live meta aggregate already in Postgres, or null if stale/absent. */
export async function readLatestMetaSnapshot(
  maxAgeMs = META_TTL_MS,
): Promise<MetaSnapshot | null> {
  if (!isDbConfigured()) return null
  try {
    const row = await getPrisma().metaSnapshot.findFirst({
      orderBy: { capturedAt: 'desc' },
      select: { capturedAt: true, source: true, payload: true },
    })
    if (!row || row.source !== 'live') return null
    if (Date.now() - row.capturedAt.getTime() > maxAgeMs) return null
    const payload = row.payload as unknown
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
    const candidate = payload as MetaSnapshot
    if (typeof candidate.generatedAt !== 'string' || !Array.isArray(candidate.decks)) return null
    return candidate
  } catch {
    return null
  }
}

export interface MetaHistoryEntry {
  capturedAt: string
  payload: MetaSnapshot
}

/**
 * Stored meta aggregates, oldest first, for trend charts. Rows that fail the
 * same shape check as `readLatestMetaSnapshot` are skipped rather than
 * half-parsed, and the newest-first query is reversed so callers get a line
 * they can draw left to right.
 */
export async function readMetaSnapshotHistory(limit = 24): Promise<MetaHistoryEntry[]> {
  if (!isDbConfigured()) return []
  try {
    const rows = await getPrisma().metaSnapshot.findMany({
      where: { source: 'live' },
      orderBy: { capturedAt: 'desc' },
      take: limit,
      select: { capturedAt: true, payload: true },
    })
    const entries: MetaHistoryEntry[] = []
    for (const row of rows) {
      const payload = row.payload as unknown
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue
      const candidate = payload as MetaSnapshot
      if (typeof candidate.generatedAt !== 'string' || !Array.isArray(candidate.cards)) continue
      entries.push({ capturedAt: row.capturedAt.toISOString(), payload: candidate })
    }
    return entries.reverse()
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Card catalogue + metadata history
// ---------------------------------------------------------------------------

const normalizeRarity = (value: string): string =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : 'Common'

interface CardRow {
  name: string
  id: number | null
  elixir: number | null
  rarity: string
  type: string | null
  arena: number | null
}

/**
 * Reconcile the bundled card catalogue with the live `/cards` endpoint.
 * Writes `Card` rows and records a `CardSnapshot` whenever metadata actually
 * changes - the initial seed is deliberately not a "change".
 */
export async function syncCards(): Promise<{ synced: number; changed: number } | null> {
  if (!isDbConfigured()) return null
  try {
    const { items } = await fetchCards()
    const prisma = getPrisma()

    const apiByKey = new Map<string, CardRow>()
    for (const item of items) {
      const key = keyForName(item.name)
      if (!key) continue
      apiByKey.set(key, {
        name: item.name,
        id: item.id ?? null,
        elixir: item.elixir ?? null,
        rarity: normalizeRarity(item.rarity ?? 'common'),
        type: null,
        arena: null,
      })
    }

    const existing = new Map(
      (
        await prisma.card.findMany({
          select: { key: true, name: true, id: true, elixir: true, rarity: true, type: true, arena: true },
        })
      ).map((row) => [row.key, row]),
    )

    const keys = new Set<string>([...ALL_CARDS.map((card) => card.key), ...apiByKey.keys()])
    let changed = 0
    let synced = 0

    for (const key of keys) {
      const local = ALL_CARDS.find((card) => card.key === key)
      const api = apiByKey.get(key)
      const next: CardRow = {
        name: api?.name ?? local?.name ?? key,
        id: api?.id ?? null,
        elixir: api?.elixir ?? local?.elixir ?? null,
        rarity: normalizeRarity(api?.rarity ?? local?.rarity ?? 'common'),
        type: local?.type ?? null,
        arena: local?.arena ?? null,
      }

      const row = existing.get(key)
      synced += 1

      if (!row) {
        await prisma.card.create({ data: { key, ...next } })
        changed += 1
        continue
      }

      const dirty =
        row.name !== next.name ||
        row.id !== next.id ||
        row.elixir !== next.elixir ||
        row.rarity !== next.rarity ||
        row.type !== next.type ||
        row.arena !== next.arena
      if (!dirty) continue

      const before: CardRow = {
        name: row.name,
        id: row.id,
        elixir: row.elixir,
        rarity: row.rarity,
        type: row.type,
        arena: row.arena,
      }
      await prisma.card.update({ where: { key }, data: next })
      await prisma.cardSnapshot.create({
        data: { cardKey: key, change: 'updated', payload: json({ before, after: next }) },
      })
      changed += 1
    }

    return { synced, changed }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Coach history
// ---------------------------------------------------------------------------

export interface CoachSessionInput {
  playerTag?: string | null
  deck: string[]
  question?: string
  provider: string
  model?: string | null
  answer: unknown
}

/** Store every coach exchange so advice can be reviewed later. */
export async function recordCoachSession(input: CoachSessionInput): Promise<void> {
  if (!isDbConfigured()) return
  try {
    await getPrisma().coachSession.create({
      data: {
        playerTag: input.playerTag ?? null,
        deck: input.deck,
        question: input.question ?? null,
        provider: input.provider,
        model: input.model ?? null,
        answer: json(input.answer),
      },
    })
  } catch {
    // history is best-effort, never fail the answer
  }
}
