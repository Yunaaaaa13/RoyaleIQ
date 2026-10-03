import { archetypeLabel, detectArchetype } from './archetypes'
import { cardLabel } from './cards'
import { readCorpus } from './cr-api'
import {
  buildMatchupGrid,
  edgeLists,
  type MatchupCell,
  type MatchupEdge,
  type MatchupGrid,
  type MatchupSample,
} from './matchups'

/**
 * Card matchups, measured rather than modelled.
 *
 * The archetype matrix on `/matchups` reads the `Battle` table, which only
 * holds the players the Player page has synced - a couple of hundred rows. The
 * rolling meta corpus behind `/api/meta` holds four thousand, each with both
 * decks intact, so that is the sample these numbers come from.
 *
 * Two tables are built from one pass over it:
 *
 * - **by archetype** - the recorded result of every game where *this* card sat
 *   on our side, bucketed by what the other side was playing.
 * - **head to head** - the same games, bucketed by which opposing card sat
 *   across the river. This is the "what does it beat" view the card page's
 *   counter panel links to.
 *
 * Nothing here is a controlled test. Every rate ships with its `n`, and a rate
 * on fewer than `MIN_CELL_GAMES` games is not published at all.
 */

/** Under this many games a pairing shows its count, never a percentage. */
export const MIN_CELL_GAMES = 5
/** Under this many games with the card in play, every rate on the page is a hint. */
export const MIN_CARD_MATCHUP_GAMES = 30
/** Head-to-head columns shipped to the browser; the rest are counted, not listed. */
export const MAX_HEAD_TO_HEAD = 12
/** One corpus read serves every card page before it is refreshed. */
const INDEX_TTL_MS = 5 * 60_000

export interface CardRef {
  key: string
  name: string
}

/** One corpus entry, reduced to the facts both tables need. */
interface CardMatchupSample {
  /**
   * Identity of the physical game: time plus *both* decks, so the two
   * perspectives of a mirror collapse onto one row. The head-to-head grid
   * suffixes the opposing card, because one game feeds eight columns there.
   */
  gameKey: string
  result: 'win' | 'loss' | 'draw'
  team: string[]
  opponent: string[]
  /** Archetype detected on the opposing side - the axis the table buckets by. */
  oppArch: string
}

export interface MatchupIndex {
  builtAt: number
  /** Corpus entries examined. */
  battles: number
  /** Distinct physical games behind them. */
  games: number
  oldest: string
  newest: string
  samples: CardMatchupSample[]
}

export interface CardMatchupSection {
  /** Columns to render, already ordered by how much data sits behind them. */
  cols: string[]
  labels: Record<string, string>
  cells: MatchupCell[]
  best: MatchupEdge[]
  worst: MatchupEdge[]
  /** Distinct columns observed before any cap. */
  pairings: number
  /** Observed columns whose total sits under `MIN_CELL_GAMES`. */
  belowGate: number
  /** Columns over the gate left out to keep the payload bounded. */
  hidden: number
}

export interface CardMatchupGates {
  /** Games a single pairing needs before its rate is read at all. */
  cellGames: number
  /** Games carrying the card before its own panel is called settled. */
  cardGames: number
  /** Columns the head-to-head section is allowed to ship. */
  headToHead: number
}

/**
 * A union rather than one bag of optional fields: when nothing can be measured
 * there are no tables to render, and the page should read `reason` and stop.
 */
export type CardMatchupsResult =
  | {
      available: false
      reason: string
      card?: CardRef
      sample?: never
      gates?: never
      byArchetype?: never
      headToHead?: never
    }
  | {
      available: true
      card: CardRef
      sample: {
        corpusBattles: number
        corpusGames: number
        battlesWithCard: number
        oldest: string
        newest: string
        lowSample: boolean
        notice?: string
      }
      gates: CardMatchupGates
      byArchetype: CardMatchupSection
      headToHead: CardMatchupSection
    }

interface IndexCache {
  index: MatchupIndex | null
  expires: number
}

/**
 * Held on `globalThis` so every route bundle shares one copy of a 1.9 MB
 * corpus read - the same trick the background meta refresh uses.
 */
const GLOBAL_KEY = '__royaleiqMatchupIndex'

function cache(): IndexCache {
  const host = globalThis as unknown as Record<string, IndexCache | undefined>
  return (host[GLOBAL_KEY] ??= { index: null, expires: 0 })
}

/**
 * The corpus, indexed once and reused for every card until the TTL lapses.
 *
 * Building it runs the archetype detector twice per entry - eight thousand
 * calls - so the result is cached rather than recomputed per request.
 */
export async function getMatchupIndex(): Promise<MatchupIndex> {
  const state = cache()
  if (state.index && state.expires > Date.now()) return state.index
  const index = await buildIndex()
  state.index = index
  state.expires = Date.now() + INDEX_TTL_MS
  return index
}

async function buildIndex(): Promise<MatchupIndex> {
  const battles = await readCorpus()
  const samples: CardMatchupSample[] = []
  const games = new Set<string>()
  let oldest = ''
  let newest = ''

  for (const battle of battles) {
    if (!Array.isArray(battle.deck) || !Array.isArray(battle.opponentDeck)) continue
    if (battle.deck.length < 4 || battle.opponentDeck.length < 4) continue
    const gameKey = `${battle.time}|${[...battle.deck, ...battle.opponentDeck].sort().join(',')}`
    games.add(gameKey)
    if (!oldest || battle.time < oldest) oldest = battle.time
    if (!newest || battle.time > newest) newest = battle.time
    samples.push({
      gameKey,
      result: battle.result,
      team: [...battle.deck],
      opponent: [...battle.opponentDeck],
      oppArch: detectArchetype(battle.opponentDeck).archetype.key,
    })
  }

  return {
    builtAt: Date.now(),
    battles: samples.length,
    games: games.size,
    oldest,
    newest,
    samples,
  }
}

/**
 * Collapse a grid into what the browser may see: no model projection - there is
 * no card-level prior, and a fabricated neutral 50 would read as one - and a
 * hard column cap so one popular card cannot ship a hundred rows.
 */
function section(grid: MatchupGrid, label: (key: string) => string, cap: number): CardMatchupSection {
  const kept = new Set(grid.cols.slice(0, cap))
  const belowGate = grid.cols.filter((key) => (grid.colTotals[key] ?? 0) < MIN_CELL_GAMES).length
  const edges = edgeLists(grid, MIN_CELL_GAMES, label, 4)

  return {
    cols: grid.cols.filter((key) => kept.has(key)),
    labels: Object.fromEntries(grid.cols.map((key) => [key, label(key)])),
    cells: grid.cells
      .filter((cell) => kept.has(cell.to))
      .map((cell) => ({ ...cell, projected: null })),
    best: edges.best,
    worst: edges.worst,
    pairings: grid.cols.length,
    belowGate,
    hidden: Math.max(0, grid.cols.length - cap),
  }
}

export function buildCardMatchups(index: MatchupIndex, card: CardRef): CardMatchupsResult {
  if (index.battles === 0) {
    return {
      available: false,
      reason:
        'No rolling meta corpus is stored yet, so there is nothing to measure card matchups against.',
      card,
    }
  }

  const archetypeLabelFor = (key: string) => (key === card.key ? card.name : archetypeLabel(key))
  const cardInPlay = index.samples.filter((sample) => sample.team.includes(card.key))

  const archetypeSamples: MatchupSample[] = cardInPlay.map((sample) => ({
    result: sample.result,
    team: card.key,
    opponent: sample.oppArch,
    gameKey: sample.gameKey,
  }))
  const archetypeGrid = buildMatchupGrid(archetypeSamples, { mirror: false })

  const headToHeadSamples: MatchupSample[] = []
  for (const sample of cardInPlay) {
    for (const opposing of sample.opponent) {
      if (opposing === card.key) continue
      headToHeadSamples.push({
        result: sample.result,
        team: card.key,
        opponent: opposing,
        gameKey: `${sample.gameKey}~${opposing}`,
      })
    }
  }
  const headToHeadGrid = buildMatchupGrid(headToHeadSamples, { mirror: false })

  const battlesWithCard = archetypeGrid.battles
  const lowSample = battlesWithCard < MIN_CARD_MATCHUP_GAMES
  const notice =
    battlesWithCard === 0
      ? `${card.name} does not appear in the rolling meta corpus yet, so no matchup can be measured.`
      : `Measured over the rolling meta corpus - ${index.games} games in a rolling window, not your own matches.` +
        (lowSample
          ? ` Only ${battlesWithCard} of them carry ${card.name}, so every rate below is a hint rather than a verdict.`
          : '')

  return {
    available: true,
    card,
    sample: {
      corpusBattles: index.battles,
      corpusGames: index.games,
      battlesWithCard,
      oldest: index.oldest,
      newest: index.newest,
      lowSample,
      notice,
    },
    gates: {
      cellGames: MIN_CELL_GAMES,
      cardGames: MIN_CARD_MATCHUP_GAMES,
      headToHead: MAX_HEAD_TO_HEAD,
    },
    byArchetype: section(archetypeGrid, archetypeLabelFor, 32),
    headToHead: section(headToHeadGrid, cardLabel, MAX_HEAD_TO_HEAD),
  }
}

export interface CounterRow {
  key: string
  label: string
  winRate: number
  games: number
}

/**
 * The compact form of `buildCardMatchups` that the card page's counter panel
 * renders: enough to say what this card has been recorded doing, plus a link to
 * the page carrying the whole table.
 */
export interface CounterIntel {
  available: boolean
  reason: string
  link: string
  linkLabel: string
  battlesWithCard: number
  lowSample: boolean
  minCellGames: number
  best: CounterRow[]
  worst: CounterRow[]
}

export function buildCounters(result: CardMatchupsResult | null): CounterIntel {
  const data = result && result.available ? result : null
  const base = {
    link: data ? `/cards/${data.card.key}/matchups` : '/matchups',
    linkLabel: data ? 'Open card matchups' : 'Archetype matchup matrix',
    minCellGames: MIN_CELL_GAMES,
    battlesWithCard: data?.sample.battlesWithCard ?? 0,
    lowSample: true,
    best: [] as CounterRow[],
    worst: [] as CounterRow[],
  }

  if (!data) {
    return {
      ...base,
      available: false,
      reason:
        (result && !result.available ? result.reason : null) ??
        'No rolling meta aggregate is available, so no card matchup can be measured.',
    }
  }

  const toRow = (edge: MatchupEdge): CounterRow => ({
    key: edge.to,
    label: edge.toLabel,
    winRate: edge.winRate,
    games: edge.games,
  })

  return {
    ...base,
    available: true,
    reason:
      data.sample.battlesWithCard === 0
        ? `${data.card.name} does not appear in the rolling meta corpus yet, so no matchup can be measured.`
        : `Recorded over ${data.sample.battlesWithCard} games carrying ${data.card.name}, ` +
          `bucketed by what the other side played. A rate needs ${MIN_CELL_GAMES} games, ` +
          'and these are battles rather than a controlled test.',
    lowSample: data.sample.lowSample,
    best: data.byArchetype.best.map(toRow),
    worst: data.byArchetype.worst.map(toRow),
  }
}
