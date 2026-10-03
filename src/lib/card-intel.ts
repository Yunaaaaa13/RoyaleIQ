import { archetypeLabel } from './archetypes'
import { combatOf, getCard, iconUrl, type CardRole, type RawCard } from './cards'
import { ROLE_LABEL } from './card-meta'
import type { CardStat, CardSynergy, DeckStat, MetaSnapshot } from './battle'
import type { CounterIntel } from './card-matchups'

/**
 * Card Intelligence: one card's slice of a meta aggregate, composed into the
 * single payload the `/cards/[key]` page renders.
 *
 * Everything here is derived from numbers that already exist - card usage and
 * win rate, per-signature deck records, and the published synergy pairs. Where
 * the sample cannot answer a question the answer is an explicit `reason` rather
 * than an estimate, so the page can say "not measured" instead of inventing a
 * figure.
 */

/** Battles a card needs before its own win rate is shown without a caveat. */
export const MIN_CARD_BATTLES = 30
/** Battles a deck signature needs to make the recommended list. */
export const MIN_DECK_BATTLES = 15
/** Snapshots a card needs before a usage trend is drawn. */
export const MIN_TREND_POINTS = 3

/** Weights behind `deckAiScore`, published so the number can be checked. */
export const SCORE_WEIGHTS = {
  results: 55,
  popularity: 25,
  confidence: 20,
} as const

export const SCORE_BASIS =
  `Heuristic ranking aid, not a prediction: ${SCORE_WEIGHTS.results}% recorded win rate, ` +
  `${SCORE_WEIGHTS.popularity}% usage, ${SCORE_WEIGHTS.confidence}% sample size. ` +
  'Win rate, usage and battle counts stay the primary numbers.'

const SUPPORT_ROLES: CardRole[] = ['support', 'spell', 'building', 'utility', 'cycle']
const SUPPORT_LABELS = new Set(SUPPORT_ROLES.map((role) => ROLE_LABEL[role]))

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const round1 = (value: number) => Math.round(value * 10) / 10

export interface CardStatic {
  key: string
  name: string
  elixir: number
  type: string
  rarity: string
  arena: number
  icon: string
  roles: CardRole[]
  roleLabels: string[]
  air: boolean
  fly: boolean
  aoe: boolean
  dps: number
}

export interface CardOverview {
  usage: number
  winRate: number
  wins: number
  battles: number
  /** Percentage-point usage change from the first stored snapshot to the last. */
  trendDelta: number | null
  /** Mean average elixir of the sample decks that carry this card. */
  avgDeckElixir: number | null
  decksInSample: number
  /** Below `MIN_CARD_BATTLES` the win rate is shown with a caveat. */
  lowSample: boolean
}

export interface CardTrendPoint {
  at: string
  usage: number
  winRate: number
}

export interface CardTrend {
  points: CardTrendPoint[]
  snapshots: number
  reason?: string
}

export interface RecommendedDeck {
  rank: number
  id: string
  label: string
  archetype: string
  archetypeLabel: string
  cards: string[]
  battles: number
  usage: number
  winRate: number
  avgElixir: number
  aiScore: number
  scoreParts: { results: number; popularity: number; confidence: number }
}

export interface DeckRecommendation {
  decks: RecommendedDeck[]
  /** Sample-qualified decks left out of `decks`. */
  hidden: number
  minBattles: number
  basis: string
}

export interface SynergyEntry {
  key: string
  name: string
  battles: number
  decks: number
  lift: number
  winRate: number
  delta: number
  roleLabels: string[]
  winCondition: boolean
}

export interface CardSynergyIntel {
  pairs: SynergyEntry[]
  bestPair: SynergyEntry | null
  bestSupport: SynergyEntry | null
  bestWinCondition: SynergyEntry | null
  reason?: string
}

export interface InsightItem {
  label: string
  text: string
}

export interface CardInsight {
  headline: string
  items: InsightItem[]
}

export interface CardIntel {
  key: string
  card: CardStatic
  available: boolean
  /** Sample-size thresholds this page applies, so the UI can quote them. */
  gates: { cardBattles: number; trendPoints: number }
  sample: { battles: number; players: number; generatedAt: string; source: string } | null
  overview: CardOverview | null
  trend: CardTrend
  decks: DeckRecommendation
  synergy: CardSynergyIntel
  counters: CounterIntel
  insight: CardInsight | null
  notice?: string
}

export function cardStatic(card: RawCard): CardStatic {
  const combat = combatOf(card.key)
  return {
    key: card.key,
    name: card.name,
    elixir: card.elixir,
    type: card.type,
    rarity: card.rarity,
    arena: card.arena,
    icon: iconUrl(card.key),
    roles: combat.roles,
    roleLabels: combat.roles.map((role) => ROLE_LABEL[role]),
    air: combat.air,
    fly: combat.fly,
    aoe: combat.aoe,
    dps: combat.dps,
  }
}

export function deckAiScore(deck: Pick<DeckStat, 'winRate' | 'usage' | 'battles'>) {
  // 45-57% spans the win rates a ladder sample actually produces, so the results
  // term saturates instead of letting one hot deck run away with the score.
  const results = clamp01((deck.winRate - 45) / 12) * SCORE_WEIGHTS.results
  const popularity =
    clamp01(Math.log10(1 + Math.max(0, deck.usage)) / Math.log10(11)) * SCORE_WEIGHTS.popularity
  const confidence = clamp01(deck.battles / 60) * SCORE_WEIGHTS.confidence
  return {
    score: Math.round(results + popularity + confidence),
    parts: {
      results: Math.round(results),
      popularity: Math.round(popularity),
      confidence: Math.round(confidence),
    },
  }
}

function toSynergyEntry(pair: CardSynergy, key: string): SynergyEntry | null {
  const other = pair.a === key ? pair.b : pair.a
  const otherCard = getCard(other)
  if (!otherCard) return null
  const roles = combatOf(other).roles
  return {
    key: other,
    name: otherCard.name,
    battles: pair.battles,
    decks: pair.decks,
    lift: round1(pair.lift),
    winRate: pair.winRate,
    delta: pair.delta,
    roleLabels: roles.map((role) => ROLE_LABEL[role]),
    winCondition: roles.includes('wc') || roles.includes('wc2'),
  }
}

function archetypePerformance(decks: DeckStat[]) {
  const bucket = new Map<string, { battles: number; weighted: number }>()
  for (const deck of decks) {
    const entry = bucket.get(deck.archetype) ?? { battles: 0, weighted: 0 }
    entry.battles += deck.battles
    entry.weighted += deck.battles * deck.winRate
    bucket.set(deck.archetype, entry)
  }
  return [...bucket.entries()]
    .map(([key, entry]) => ({
      key,
      label: archetypeLabel(key),
      battles: entry.battles,
      winRate: entry.battles ? entry.weighted / entry.battles : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate)
}

function buildTrend(key: string, history: { capturedAt: string; payload: MetaSnapshot }[]): CardTrend {
  const seen = new Set<string>()
  const points: CardTrendPoint[] = []
  for (const entry of history) {
    const stat = entry.payload.cards.find((card) => card.key === key)
    if (!stat || seen.has(entry.capturedAt)) continue
    seen.add(entry.capturedAt)
    points.push({ at: entry.capturedAt, usage: stat.usage, winRate: stat.winRate })
  }
  if (points.length < MIN_TREND_POINTS) {
    return {
      points,
      snapshots: points.length,
      reason:
        points.length === 0
          ? 'No stored meta snapshot covers this card yet.'
          : `Only ${points.length} stored meta snapshot${points.length === 1 ? '' : 's'} cover ` +
            `this card. A trend needs ${MIN_TREND_POINTS}.`,
    }
  }
  return { points, snapshots: points.length }
}

function buildInsight(input: {
  card: CardStatic
  snapshot: MetaSnapshot
  overview: CardOverview | null
  trend: CardTrend
  decks: RecommendedDeck[]
  archetypeRank: ReturnType<typeof archetypePerformance>
  usageRank: number
}): CardInsight {
  const { card, snapshot, overview, trend, decks, archetypeRank, usageRank } = input
  const items: InsightItem[] = []

  if (overview) {
    const trendText = trendDeltaText(trend) ?? ''
    items.push({
      label: 'Popularity',
      text:
        `${card.name} appears in ${overview.usage}% of sampled battles ` +
        `(${overview.battles} of ${snapshot.battles}), rank ${usageRank} of ` +
        `${snapshot.cards.length} cards seen in this window.` +
        (trendText ? ` ${trendText}` : ''),
    })
    items.push({
      label: 'Results in sample',
      text:
        `${overview.winRate}% win rate over ${overview.battles} battles ` +
        `(${overview.wins} wins)${overview.lowSample ? ', a sample too small to call settled' : ''}.`,
    })
  }

  const best = archetypeRank[0]
  if (best) {
    items.push({
      label: 'Where it performs best',
      text:
        `${best.label} builds are its strongest home in this sample: ` +
        `${round1(best.winRate)}% across ${best.battles} battles.`,
    })
  } else {
    items.push({
      label: 'Where it performs best',
      text: 'Not measured - no sample deck carrying this card has enough battles to compare archetypes.',
    })
  }

  const top = decks[0]
  if (top) {
    items.push({
      label: 'Recommended deck',
      text:
        `${top.label} leads the ${decks.length} qualifying build${decks.length === 1 ? '' : 's'} ` +
        `at ${top.winRate}% over ${top.battles} battles (AI score ${top.aiScore}/100).`,
    })
  }

  const roles = card.roleLabels.length ? card.roleLabels.join(', ') : 'no tagged role yet'
  items.push({
    label: 'Strategic fit',
    text:
      `${card.elixir} elixir, ${card.rarity.toLowerCase()} ${card.type.toLowerCase()} tagged ` +
      `${roles}${card.air ? ', able to target air' : ''}${card.fly ? ', and it flies' : ''}` +
      (overview?.avgDeckElixir
        ? `. Sample decks carrying it average ${round1(overview.avgDeckElixir)} elixir.`
        : '.'),
  })

  return {
    headline: overview
      ? `${card.name} is in ${overview.usage}% of the sampled battles`
      : `${card.name} sits outside this sample's card-level window`,
    items,
  }
}

/**
 * Usage change across the stored snapshot window, i.e. the same first-to-last
 * span the chart and the popularity insight quote. `snapshot.trending` only
 * carries the eight largest movers, so looking a single card up there would
 * silently report "no trend" for everything outside that leaderboard.
 */
function trendUsageDelta(trend: CardTrend): number | null {
  if (trend.points.length < 2) return null
  const first = trend.points[0]
  const last = trend.points[trend.points.length - 1]
  return round1(last.usage - first.usage)
}

function trendDeltaText(trend: CardTrend): string | null {
  if (!trend.points.length) return null
  const first = trend.points[0]
  const last = trend.points[trend.points.length - 1]
  const delta = round1(last.usage - first.usage)
  if (trend.points.length < 2) return null
  if (Math.abs(delta) < 0.1) return `Usage is flat across the last ${trend.points.length} snapshots.`
  return (
    `Usage ${delta > 0 ? 'rose' : 'fell'} ${Math.abs(delta)} points across the last ` +
    `${trend.points.length} snapshots.`
  )
}

/**
 * Compose one card's intelligence from a meta aggregate plus the stored
 * snapshot history used for the usage trend.
 */
export function buildCardIntel(
  card: RawCard,
  snapshot: MetaSnapshot | null,
  history: { capturedAt: string; payload: MetaSnapshot }[],
  counters: CounterIntel,
  notice?: string,
): CardIntel {
  const statics = cardStatic(card)

  if (!snapshot) {
    return {
      key: card.key,
      card: statics,
      available: false,
      gates: { cardBattles: MIN_CARD_BATTLES, trendPoints: MIN_TREND_POINTS },
      sample: null,
      overview: null,
      trend: { points: [], snapshots: 0, reason: 'No meta aggregate is available yet.' },
      decks: { decks: [], hidden: 0, minBattles: MIN_DECK_BATTLES, basis: SCORE_BASIS },
      synergy: {
        pairs: [],
        bestPair: null,
        bestSupport: null,
        bestWinCondition: null,
        reason: 'No meta aggregate is available yet.',
      },
      counters,
      insight: null,
      notice,
    }
  }

  const stat: CardStat | undefined = snapshot.cards.find((entry) => entry.key === card.key)
  const trend = buildTrend(card.key, history)

  const matchingDecks = snapshot.decks.filter((deck) => deck.cards.includes(card.key))
  const qualifying = matchingDecks.filter((deck) => deck.battles >= MIN_DECK_BATTLES)
  const ranked = qualifying
    .map((deck) => ({ deck, ...deckAiScore(deck) }))
    .sort((a, b) => b.score - a.score || b.deck.winRate - a.deck.winRate)

  const decks: RecommendedDeck[] = ranked.map((entry, index) => ({
    rank: index + 1,
    id: entry.deck.id,
    label: entry.deck.label,
    archetype: entry.deck.archetype,
    archetypeLabel: archetypeLabel(entry.deck.archetype),
    cards: entry.deck.cards,
    battles: entry.deck.battles,
    usage: entry.deck.usage,
    winRate: entry.deck.winRate,
    avgElixir: entry.deck.avgElixir,
    aiScore: entry.score,
    scoreParts: entry.parts,
  }))

  const pairs = snapshot.synergies
    .filter((pair) => pair.a === card.key || pair.b === card.key)
    .map((pair) => toSynergyEntry(pair, card.key))
    .filter((entry): entry is SynergyEntry => entry !== null)
    .sort((a, b) => b.lift - a.lift)

  const byUsage = [...snapshot.cards].sort((a, b) => b.usage - a.usage)
  const usageRank = byUsage.findIndex((entry) => entry.key === card.key) + 1

  const avgDeckElixir = matchingDecks.length
    ? matchingDecks.reduce((sum, deck) => sum + deck.avgElixir, 0) / matchingDecks.length
    : null

  const overview: CardOverview | null = stat
    ? {
        usage: stat.usage,
        winRate: stat.winRate,
        wins: stat.wins,
        battles: stat.battles,
        trendDelta: trendUsageDelta(trend),
        avgDeckElixir: avgDeckElixir === null ? null : round1(avgDeckElixir),
        decksInSample: matchingDecks.length,
        lowSample: stat.battles < MIN_CARD_BATTLES,
      }
    : null

  // Only decks past the sample gate may name a "strongest home"; otherwise a
  // ten-battle list would be presented as an archetype verdict.
  const archetypeRank = archetypePerformance(qualifying)

  // A card outside `snapshot.cards` has no usage or win rate here - that is a
  // reporting window, not an absence of battles. Say so instead of letting the
  // empty tiles imply the card never appeared.
  const scopeNotice = overview
    ? undefined
    : `Usage and win rate are not reported for ${card.name}: this sample carries ` +
      `card-level records for its ${snapshot.cards.length} most-used cards and ` +
      `${card.name} is not among them. The deck, synergy and trend figures below are ` +
      `still measured from the ${snapshot.battles} sampled battles.`

  return {
    key: card.key,
    card: statics,
    available: true,
    gates: { cardBattles: MIN_CARD_BATTLES, trendPoints: MIN_TREND_POINTS },
    sample: {
      battles: snapshot.battles,
      players: snapshot.players,
      generatedAt: snapshot.generatedAt,
      source: snapshot.source,
    },
    overview,
    trend,
    decks: {
      decks,
      hidden: matchingDecks.length - decks.length,
      minBattles: MIN_DECK_BATTLES,
      basis: SCORE_BASIS,
    },
    synergy: {
      pairs,
      bestPair: pairs[0] ?? null,
      bestSupport:
        pairs.find((entry) => entry.roleLabels.some((label) => SUPPORT_LABELS.has(label))) ?? null,
      bestWinCondition: pairs.find((entry) => entry.winCondition) ?? null,
      reason: pairs.length
        ? undefined
        : `No published synergy pair for ${card.name} clears the sample threshold yet.`,
    },
    counters,
    insight: buildInsight({
      card: statics,
      snapshot,
      overview,
      trend,
      decks,
      archetypeRank,
      usageRank,
    }),
    notice: [scopeNotice, notice ?? snapshot.notice].filter(Boolean).join(' ') || undefined,
  }
}
