import 'server-only'
import { aggregateMeta, deckKeys, type MetaSnapshot, type NormalizedBattle } from './battle'
import { getPrisma, isDbConfigured } from './db'
import { describeNetworkError, fetchWithRetry } from './http'
import { normalizeTag } from './tags'
import type { Prisma } from '@/generated/prisma/client'

export { normalizeTag }

const API_BASE = process.env.CLASH_ROYALE_API_BASE ?? 'https://api.clashroyale.com/v1'

/**
 * Vercel's IP allowlist cap is five addresses and the platform leaves from six,
 * so no single key can list them all: the primary key carries five of them and
 * the optional second key carries the remaining one. A 403 therefore falls back
 * to the other key before the caller is told the address is rejected.
 */
const TOKENS = [process.env.CLASH_ROYALE_API_TOKEN, process.env.CLASH_ROYALE_API_TOKEN_ALT]
  .map((value) => value?.trim())
  .filter((value): value is string => Boolean(value))

export const hasApiToken = TOKENS.length > 0

interface CacheEntry {
  value: unknown
  expires: number
}

const cache = new Map<string, CacheEntry>()
const recentHits: number[] = []
const MAX_REQUESTS_PER_WINDOW = Math.max(
  1,
  Number(process.env.CR_RATE_LIMIT_PER_MINUTE ?? 12),
)
const WINDOW_MS = 60_000
const MAX_WAIT_MS = 12_000

export class CrApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'CrApiError'
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * This machine's public IP. Only looked up when a 403 needs explaining, so the
 * normal request path never pays for it. Failures are remembered only until
 * the next retry window, otherwise a single outage would pin `publicIpError()`
 * for the whole lifetime of the process.
 */
const IP_RETRY_MS = 5 * 60_000
let cachedIp: string | null | undefined
let ipLookupError: string | null = null
let ipRetryAt = 0
let ipLookupInFlight: Promise<string | null> | null = null

async function lookupPublicIp(): Promise<string | null> {
  try {
    const response = await fetchWithRetry(
      'https://api.ipify.org?format=json',
      { cache: 'no-store' },
      { attempts: 2, timeoutMs: 5_000 },
    )
    if (!response.ok) throw new Error(`IP service responded ${response.status}`)
    const data = (await response.json()) as { ip?: unknown }
    const ip = typeof data.ip === 'string' ? data.ip : null
    if (!ip) throw new Error('IP service returned no address.')
    cachedIp = ip
    ipLookupError = null
  } catch (error) {
    cachedIp = undefined
    ipLookupError = describeNetworkError(error)
    ipRetryAt = Date.now() + IP_RETRY_MS
  }
  return cachedIp ?? null
}

function publicIp(): Promise<string | null> {
  if (cachedIp) return Promise.resolve(cachedIp)
  if (ipLookupInFlight) return ipLookupInFlight
  if (ipLookupError && Date.now() < ipRetryAt) return Promise.resolve(null)
  ipLookupInFlight = lookupPublicIp().finally(() => {
    ipLookupInFlight = null
  })
  return ipLookupInFlight
}

/** Why the egress IP could not be read, when it could not be read. */
export function publicIpError(): string | null {
  return ipLookupError
}

/**
 * Live view of the in-process rate limiter and response cache, so the data
 * page can show how much of this minute's budget is already spent.
 */
export function crApiRuntime(): {
  limit: number
  windowSeconds: number
  used: number
  memoryEntries: number
} {
  const now = Date.now()
  while (recentHits.length && now - recentHits[0] > WINDOW_MS) recentHits.shift()
  return {
    limit: MAX_REQUESTS_PER_WINDOW,
    windowSeconds: WINDOW_MS / 1000,
    used: recentHits.length,
    memoryEntries: cache.size,
  }
}

/** This server's egress IP - the value an IP allowlist has to contain. */
export function readPublicIp(): Promise<string | null> {
  return publicIp()
}

async function apiErrorMessage(response: Response): Promise<string> {
  if (response.status === 404) return 'Player or resource not found.'
  if (response.status === 403) {
    const ip = await publicIp()
    const scope = TOKENS.length > 1 ? "either key's" : "the key's"
    return ip
      ? `Clash Royale API key rejected this server (403): ${ip} is not on ${scope} IP allowlist. Add it at developer.clashroyale.com, or clear the allowlist.`
      : `Clash Royale API key rejected this server (403): this server's IP is not on ${scope} allowlist. Update it at developer.clashroyale.com.`
  }
  return `Clash Royale API error (${response.status}).`
}

/**
 * Second-level cache in Postgres, so a cold server (or a restart) does not
 * spend rate-limit budget re-fetching what it already knows. Both directions
 * are best-effort: a missing or broken database must never break the API call.
 */
async function readDbCache<T>(key: string): Promise<T | undefined> {
  if (!isDbConfigured()) return undefined
  try {
    const row = await getPrisma().apiCache.findUnique({ where: { key } })
    if (!row || row.expiresAt.getTime() < Date.now()) return undefined
    return row.value as T
  } catch {
    return undefined
  }
}

let lastPrune = 0

async function writeDbCache(key: string, value: unknown, expiresAt: Date): Promise<void> {
  if (!isDbConfigured()) return
  try {
    const prisma = getPrisma()
    const payload = value as Prisma.InputJsonValue
    await prisma.apiCache.upsert({
      where: { key },
      create: { key, value: payload, expiresAt },
      update: { value: payload, expiresAt },
    })
    if (Date.now() - lastPrune > 10 * 60_000) {
      lastPrune = Date.now()
      await prisma.apiCache.deleteMany({ where: { expiresAt: { lt: new Date() } } })
    }
  } catch {
    // caching is an optimisation, not a requirement
  }
}

async function acquireSlot(): Promise<void> {
  const startedAt = Date.now()
  for (;;) {
    const now = Date.now()
    while (recentHits.length && now - recentHits[0] > WINDOW_MS) recentHits.shift()
    if (recentHits.length < MAX_REQUESTS_PER_WINDOW) {
      recentHits.push(now)
      return
    }
    // Bail out only after the caller has actually been stalled for this long;
    // a single sleep chunk is capped at 2s, so the budget has to be measured
    // from the start of the wait rather than from one chunk.
    if (now - startedAt >= MAX_WAIT_MS) {
      throw new CrApiError('Clash Royale API rate limit reached, try again shortly.', 429)
    }
    const oldest = recentHits[0]
    const wait = Math.min(Math.max(WINDOW_MS - (now - oldest) + 50, 50), 2_000)
    await sleep(wait)
  }
}

async function crFetch<T>(path: string, ttlMs: number, cacheKey = path): Promise<T> {
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.value as T
  if (TOKENS.length === 0) throw new CrApiError('Clash Royale API token is not configured.', 503)

  const persisted = await readDbCache<T>(cacheKey)
  if (persisted !== undefined) {
    cache.set(cacheKey, { value: persisted, expires: Date.now() + ttlMs })
    return persisted
  }

  await acquireSlot()
  let response = await fetchWithRetry(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKENS[0]}` },
    cache: 'no-store',
  })

  // This key's allowlist may simply not hold the address we left from this
  // time; the second key exists precisely for that.
  if (response.status === 403 && TOKENS.length > 1) {
    await acquireSlot()
    response = await fetchWithRetry(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${TOKENS[1]}` },
      cache: 'no-store',
    })
  }

  if (response.status === 429) {
    throw new CrApiError('Clash Royale API rate limit reached, try again shortly.', 429)
  }
  if (!response.ok) {
    throw new CrApiError(await apiErrorMessage(response), response.status)
  }

  const data = (await response.json()) as T
  cache.set(cacheKey, { value: data, expires: Date.now() + ttlMs })
  void writeDbCache(cacheKey, data, new Date(Date.now() + ttlMs))
  return data
}

// ---------------------------------------------------------------------------
// Raw payloads
// ---------------------------------------------------------------------------

interface RawCardRef {
  name: string
  id?: number
  level?: number
  evolutionLevel?: number
  maxLevel?: number
  elixirCost?: number
}

export interface RawParticipant {
  tag?: string
  name?: string
  crowns?: number
  startingTrophies?: number
  /** Final hit points; 0 means the tower fell. */
  kingTowerHitPoints?: number
  princessTowersHitPoints?: number[]
  /** Elixir that ticked away unused over the whole match. */
  elixirLeaked?: number
  clan?: { name: string; badgeId?: number }
  deck?: RawCardRef[]
  cards?: RawCardRef[]
  deckCycle?: RawCardRef[]
}

export interface RawBattle {
  battleTime: string
  type?: string
  gameMode?: { id: number; name: string }
  arena?: { id: number; name: string }
  crowns?: { team: number; opponent: number }
  leagueNumber?: number
  deckSelection?: string
  team?: RawParticipant[]
  opponent?: RawParticipant[]
}

export interface CrPlayer {
  tag: string
  name: string
  expLevel: number
  trophies: number
  bestTrophies: number
  wins: number
  losses: number
  battleCount: number
  arena: { id: number; name: string }
  clan?: { name: string; tag: string; badgeId?: number; memberCount?: number }
  currentFavouriteCard?: RawCardRef
  deck?: RawCardRef[]
  gold?: number
  cardsFound?: number
  legendTrophies?: number
}

export interface RankingEntry {
  rank: number
  tag: string
  name: string
  trophies: number
  clan?: { name: string }
  arena?: { name: string }
}

export async function fetchCards() {
  return crFetch<{ items: (RawCardRef & { elixir?: number; rarity?: string })[] }>(
    '/cards',
    24 * 60 * 60 * 1000,
  )
}

export async function fetchPlayer(tag: string): Promise<CrPlayer> {
  return crFetch<CrPlayer>(`/players/${encodeURIComponent(normalizeTag(tag))}`, 60_000)
}

export async function fetchBattleLog(tag: string): Promise<RawBattle[]> {
  const data = await crFetch<RawBattle[] | { items: RawBattle[] }>(
    `/players/${encodeURIComponent(normalizeTag(tag))}/battlelog`,
    90_000,
  )
  // Unlike every other collection endpoint the battlelog returns a bare JSON
  // array at the top level instead of an object wrapping `items`.
  if (Array.isArray(data)) return data
  return data.items ?? []
}

export async function fetchRankings(): Promise<RankingEntry[]> {
  const data = await crFetch<{ items: RankingEntry[] }>(
    '/locations/global/rankings/players',
    30 * 60 * 1000,
  )
  return (data.items ?? []).slice(0, 25)
}

export interface ClanRankingEntry {
  rank: number
  tag: string
  name: string
  clanScore: number
  members: number
}

export interface ClanMember {
  tag: string
  name: string
  trophies: number
  role?: string
}

export async function fetchClanRankings(): Promise<ClanRankingEntry[]> {
  const data = await crFetch<{ items: ClanRankingEntry[] }>(
    '/locations/global/rankings/clans',
    30 * 60 * 1000,
  )
  return data.items ?? []
}

export async function fetchClanMembers(tag: string): Promise<ClanMember[]> {
  const data = await crFetch<{ items: ClanMember[] }>(
    `/clans/${encodeURIComponent(normalizeTag(tag))}/members`,
    30 * 60 * 1000,
  )
  return data.items ?? []
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

export function normalizeBattle(raw: RawBattle, index: number): NormalizedBattle | null {
  const team = raw.team?.[0]
  const opponent = raw.opponent?.[0]
  if (!team || !opponent) return null

  const ourDeck = deckKeys(team.deck ?? team.cards ?? team.deckCycle)
  const theirDeck = deckKeys(opponent.deck ?? opponent.cards ?? opponent.deckCycle)
  if (ourDeck.length < 4 || theirDeck.length < 4) return null

  const ourCrowns = raw.crowns?.team ?? team.crowns ?? 0
  const theirCrowns = raw.crowns?.opponent ?? opponent.crowns ?? 0
  const result =
    ourCrowns > theirCrowns ? 'win' : ourCrowns < theirCrowns ? 'loss' : 'draw'

  return {
    id: `${raw.battleTime}-${index}`,
    time: toIso(raw.battleTime),
    type: raw.type ?? raw.gameMode?.name ?? 'ladder',
    result,
    crowns: { us: ourCrowns, them: theirCrowns },
    deck: ourDeck,
    opponentDeck: theirDeck,
    opponentName: opponent.name ?? 'Unknown',
    opponentTag: opponent.tag,
    arena: raw.arena?.name,
    // Kept only for persistence: the raw payload carries tower hit points,
    // card levels and elixir leaks that the normalised shape throws away.
    raw,
  }
}

export function toIso(battleTime: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(battleTime)
  if (!match) return new Date().toISOString()
  const [, y, mo, d, h, mi, s] = match
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`
}

export function normalizeBattleLog(raw: RawBattle[]): NormalizedBattle[] {
  return raw
    .map((battle, index) => normalizeBattle(battle, index))
    .filter((battle): battle is NormalizedBattle => Boolean(battle))
}

// ---------------------------------------------------------------------------
// Meta snapshot
// ---------------------------------------------------------------------------

const META_TTL_MS = 10 * 60_000
const META_POOL_SIZE = Number(process.env.META_PLAYER_POOL ?? 10)
/**
 * A fresh pull under this many battles is not a window worth publishing: the
 * ranking endpoints are down, or the pool fell back to a handful of known
 * players. The accumulated corpus is still real API battles, so it stands in
 * rather than leaving yesterday's snapshot on screen indefinitely.
 */
const MIN_FRESH_BATTLES = 100
let metaInFlight: Promise<MetaSnapshot> | null = null

export async function fetchLiveMeta(options: { force?: boolean } = {}): Promise<MetaSnapshot> {
  // `/api/meta` primes this entry from the persisted snapshot so a warm meta
  // page costs no API calls - but that primed entry has no battles behind it,
  // so training has to be able to skip it and do the real pull.
  if (!options.force) {
    const cached = cache.get('meta:snapshot')
    if (cached && cached.expires > Date.now()) return cached.value as MetaSnapshot
  }
  if (metaInFlight) return metaInFlight

  metaInFlight = buildLiveMeta()
    .catch((error) => {
      const previous = cache.get('meta:snapshot')
      if (previous) return previous.value as MetaSnapshot
      throw error
    })
    .finally(() => {
      metaInFlight = null
    })

  return metaInFlight
}

/**
 * The next slice of players to pull.
 *
 * The global player leaderboard is the natural source, but it is not reliable
 * here: `rankings/players` has come back empty, and the static-IP proxy can
 * 404 the ranking paths outright while still serving battle logs. The top clan
 * rosters are the second source, and both hold far more players than one
 * build's request budget allows - so successive builds walk a window through
 * them instead of re-reading the same logs, which is what lets the training
 * corpus keep growing across meta cycles.
 *
 * When neither source answers, this throws: the caller decides whether an
 * unbuilt pool is fatal or the accumulated corpus can stand in for it.
 */
let poolCursor = 0

/** The last pool that resolved, so a ranking outage reuses it instead of stalling. */
const POOL_KEY = 'meta:pool'
const POOL_TTL_MS = 7 * 24 * 60 * 60_000

function isRankingEntry(value: unknown): value is RankingEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<RankingEntry>
  return typeof entry.tag === 'string' && entry.tag.length > 0 && typeof entry.name === 'string'
}

async function readStoredPool(): Promise<RankingEntry[]> {
  const stored = await readDbCache<unknown>(POOL_KEY)
  return Array.isArray(stored) ? stored.filter(isRankingEntry) : []
}

function rollingWindow<T>(items: T[], start: number, limit: number): T[] {
  if (!items.length) return []
  const window: T[] = []
  for (let i = 0; i < Math.min(limit, items.length); i += 1) {
    window.push(items[(start + i) % items.length])
  }
  return window
}

async function resolveMetaPool(limit: number): Promise<RankingEntry[]> {
  let source: RankingEntry[] = []

  try {
    const rankings = await fetchRankings()
    if (rankings.length >= Math.min(limit, 3)) source = rankings
  } catch {
    // fall through to the clan-based pool
  }

  if (!source.length) {
    let clans: ClanRankingEntry[] = []
    try {
      clans = await fetchClanRankings()
    } catch {
      // Both ranking endpoints are unreachable - the caller decides what to do
      // with a pool it could not assemble. This call is the second source, not
      // the contract, so a 404 here must not escape as the build's error.
    }
    // Always read all three rosters: the rotation needs a source list larger
    // than one window, and the roster calls are cheap and cached.
    for (const clan of clans.slice(0, 3)) {
      try {
        const members = await fetchClanMembers(clan.tag)
        source.push(
          ...members
            .filter((member) => member.tag)
            .map((member) => ({
              rank: 0,
              tag: member.tag,
              name: member.name,
              trophies: member.trophies ?? 0,
              clan: { name: clan.name },
            })),
        )
      } catch {
        // this clan's roster is unavailable - try the next one
      }
    }
  }

  // Every path above only ever fills `source` from a live call, so an empty
  // list here means both ranking endpoints are unreachable right now.
  const live = source.length > 0
  if (!source.length) source = await readStoredPool()

  if (!source.length) {
    throw new CrApiError('Could not build a player sample from the Clash Royale API.', 502)
  }

  if (live) await writeDbCache(POOL_KEY, source, new Date(Date.now() + POOL_TTL_MS))

  const window = rollingWindow(source, poolCursor, limit)
  poolCursor = (poolCursor + limit) % source.length
  return window
}

// ---------------------------------------------------------------------------
// Training corpus
// ---------------------------------------------------------------------------

/**
 * Battles seen across meta cycles, kept in the response cache as JSON.
 *
 * They deliberately do not go into the `Battle` table: that table requires a
 * tracked `Player` row, and the meta sample is a rotating cast of players we
 * do not follow. The raw payloads are dropped before storing - training reads
 * decks and outcomes only, and the payloads are far too large to rewrite every
 * cycle.
 */
const CORPUS_KEY = 'meta:corpus'
const CORPUS_TTL_MS = 24 * 60 * 60_000
const CORPUS_MAX_BATTLES = 4000

function corpusKey(battle: NormalizedBattle): string {
  return `${battle.time}|${[...battle.deck].sort().join(',')}|${
    battle.opponentTag ?? battle.opponentName
  }`
}

/**
 * The rolling meta corpus, oldest first.
 *
 * Exposed for the card matchup pages: they need every deck on both sides of
 * every game, and the `Battle` table only holds the handful of players the
 * Player page has synced - a couple of hundred rows against a four thousand
 * battle corpus.
 */
export async function readCorpus(): Promise<NormalizedBattle[]> {
  try {
    const rows = await readDbCache<NormalizedBattle[]>(CORPUS_KEY)
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

async function extendCorpus(battles: NormalizedBattle[]): Promise<void> {
  try {
    const current = await readCorpus()
    const seen = new Set(current.map(corpusKey))
    const merged = current.slice()
    for (const battle of battles) {
      const key = corpusKey(battle)
      if (seen.has(key)) continue
      seen.add(key)
      const lean = { ...battle }
      delete lean.raw
      merged.push(lean)
    }
    merged.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
    await writeDbCache(
      CORPUS_KEY,
      merged.slice(-CORPUS_MAX_BATTLES),
      new Date(Date.now() + CORPUS_TTL_MS),
    )
  } catch {
    // the corpus is an optimisation - a broken cache must not fail a meta build
  }
}

/**
 * How many players the previous build drew from.
 *
 * Only the corpus standing in for a pool that could not be built needs this:
 * the sample size belongs to the pool, and the accumulated battles no longer
 * record which players fed them. Counting their opponents instead would report
 * nearly every battle as a different player.
 */
async function lastPoolSize(): Promise<number> {
  if (!isDbConfigured()) return 0
  try {
    const row = await getPrisma().metaSnapshot.findFirst({
      orderBy: { capturedAt: 'desc' },
      select: { source: true, players: true },
    })
    return row && row.source === 'live' ? row.players : 0
  } catch {
    return 0
  }
}

async function buildLiveMeta(): Promise<MetaSnapshot> {
  // Neither ranking endpoint answering means the sample could not be built,
  // not that the build failed - an empty pool falls through to the corpus below.
  const pool = await resolveMetaPool(META_POOL_SIZE).catch(() => [] as RankingEntry[])
  const pulled: NormalizedBattle[] = []
  let failures = 0

  for (const entry of pool) {
    try {
      const log = await fetchBattleLog(entry.tag)
      pulled.push(...normalizeBattleLog(log))
    } catch {
      failures += 1
      if (failures >= 3) break
    }
  }

  let battles = pulled
  let players = Math.max(0, pool.length - failures)

  if (battles.length < MIN_FRESH_BATTLES) {
    const stored = await readCorpus()
    if (stored.length > battles.length) {
      battles = stored
      players = (await lastPoolSize()) || players
    }
  }

  if (!battles.length) {
    throw new CrApiError('No recent battles available from the Clash Royale API.', 502)
  }

  const snapshot = aggregateMeta(battles, { source: 'live', players })
  cache.set('meta:snapshot', { value: snapshot, expires: Date.now() + META_TTL_MS })
  // The training set is only what was actually pulled: the corpus standing in
  // for a failed sample is already folded in by fetchTrainingBattles itself.
  cache.set('meta:battles', { value: pulled, expires: Date.now() + META_TTL_MS })
  // ...and folded into the rolling corpus so the next cycle starts from every
  // battle seen so far, not just this window's players.
  await extendCorpus(pulled)
  return snapshot
}

/**
 * The battles behind the live meta snapshot.
 *
 * The prediction model trains on these so a single set of Clash Royale calls
 * serves both features. Returns [] whenever the live pull is unavailable -
 * callers must treat that as "not enough data", never as "predict anyway".
 */
export async function fetchTrainingBattles(): Promise<NormalizedBattle[]> {
  // Every battle the sample has seen so far, across meta cycles.
  const corpus = await readCorpus()

  const cached = cache.get('meta:battles')
  if (!(cached && cached.expires > Date.now())) {
    try {
      await fetchLiveMeta({ force: true })
    } catch {
      // A primed or stale snapshot may exist without any battles behind it.
      // Remember the miss for a couple of minutes so a failing API is not
      // hammered by every prediction request.
      if (!cache.get('meta:battles')) {
        cache.set('meta:battles', { value: [], expires: Date.now() + 2 * 60_000 })
      }
    }
  }

  const merged = corpus.slice()
  const seen = new Set(corpus.map(corpusKey))
  const live = cache.get('meta:battles')
  for (const battle of (live?.value as NormalizedBattle[] | undefined) ?? []) {
    const key = corpusKey(battle)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(battle)
  }
  return merged
}

export function primeMetaCache(snapshot: MetaSnapshot) {
  cache.set('meta:snapshot', { value: snapshot, expires: Date.now() + META_TTL_MS })
}

