import type { ArchetypeDetection } from './archetypes'
import { detectArchetype } from './archetypes'
import { analyzeDeck } from './analysis'
import type { CardStat, DeckStat, MetaSnapshot } from './battle'
import { deckLabel } from './battle'
import { BIG_SPELLS, SMALL_SPELLS, type CardRole } from './card-meta'
import { combatOf, getCard } from './cards'

/**
 * Meta-deck recommendation engine.
 *
 * Pipeline: selected cards -> candidate decks (every observed meta deck, plus
 * completions that keep the selection and borrow a donor's shell, plus one
 * role-driven fill) -> one score from real snapshot values -> ranked list.
 *
 * Every input is existing data: deck win rate / usage / battles from the
 * meta snapshot, card records, card roles from the catalogue, and archetype
 * detection from `archetypes.ts`. Unobserved decks never display a win rate —
 * their performance factor is derived from card records and labelled as such.
 */

export const MIN_SELECTED_CARDS = 4
export const DEFAULT_RECOMMENDATIONS = 10
export const MAX_RECOMMENDATIONS = 20
/** Completions are cheap to generate, so keep at most this many per archetype label. */
export const MAX_VARIANT_COMPLETIONS = 3

export const SCORE_WEIGHTS = {
  /** Share of the user's selected cards the candidate contains. */
  match: 30,
  /** Observed win rate + sample confidence (or card-record mean, labelled). */
  performance: 20,
  /** Role coverage of the complete candidate. */
  coverage: 15,
  /** Pairs of the candidate's cards that co-occur inside meta decks. */
  synergy: 12,
  /** Agreement between the candidate's archetype and the selection's lean. */
  archetype: 10,
  /** Usage share in the current sample. */
  usage: 8,
  /** Distance from the sample's median deck elixir. */
  elixir: 5,
} as const

export const SCORE_BASIS =
  `Compatibility = ${SCORE_WEIGHTS.match}% selected-card match, ` +
  `${SCORE_WEIGHTS.performance}% meta performance (win rate + sample confidence), ` +
  `${SCORE_WEIGHTS.coverage}% role coverage, ` +
  `${SCORE_WEIGHTS.synergy}% card-pair synergy inside the meta decks, ` +
  `${SCORE_WEIGHTS.archetype}% archetype fit, ${SCORE_WEIGHTS.usage}% usage, ` +
  `${SCORE_WEIGHTS.elixir}% elixir fit. Heuristic ranking aid built from the current ` +
  'meta snapshot — not a prediction. Unobserved builds show no win rate.'

export type CandidateSource = 'meta' | 'completed'

export interface RecommendationParts {
  match: number
  performance: number
  coverage: number
  synergy: number
  archetype: number
  usage: number
  elixir: number
}

export interface Recommendation {
  rank: number
  id: string
  label: string
  archetype: string
  archetypeLabel: string
  cards: string[]
  /** 'meta' = observed in the sample; 'completed' = built around the selection. */
  source: CandidateSource
  battles: number
  /** Percent of sampled battles, or null when the exact build was not observed. */
  usage: number | null
  /** Percent, or null when the exact build was not observed. */
  winRate: number | null
  avgElixir: number
  /** 0-100. */
  compatibility: number
  parts: RecommendationParts
  matched: string[]
  /** Cards that complete a 'completed' candidate. */
  fills: string[]
  missingSelected: string[]
  reasons: string[]
  summary: string
  champions: string[]
  /** Observed-evolution cards inside this candidate; undefined if the sample reports none. */
  evolutions?: string[]
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const round1 = (value: number) => Math.round(value * 10) / 10
const round0 = (value: number) => Math.round(value)

const pairId = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : round1((sorted[mid - 1] + sorted[mid]) / 2)
}

interface Context {
  selected: string[]
  selSet: Set<string>
  cardStats: Map<string, CardStat>
  pairSet: Set<string>
  medianElixir: number
  selArch: ArchetypeDetection
  needed: Set<string>
  selSpells: number
  selChampions: number
}

/** Roles the partial selection cannot cover on its own (analysis on <8 cards). */
function missingRoles(selected: string[]): Set<string> {
  const partial = analyzeDeck(selected, { swaps: false, matchups: false })
  const comp = partial.composition
  const needed = new Set<string>()
  if (comp.winConditions.length === 0) needed.add('wc')
  if (comp.airDefense.length < 2) needed.add('air')
  if (comp.smallSpells.length === 0) needed.add('small')
  if (comp.bigSpells.length === 0) needed.add('big')
  if (comp.tankKillers.length < 1) needed.add('defense')
  if (comp.buildings.length === 0) needed.add('building')
  if (comp.splash.length < 2) needed.add('splash')
  if (comp.cycleCards.length < 2) needed.add('cycle')
  return needed
}

function cardAllows(
  key: string,
  picked: string[],
  selSpells: number,
  selChampions: number,
): boolean {
  const card = getCard(key)
  if (!card) return false
  const spells = picked.filter((entry) => getCard(entry)?.type === 'Spell').length
  const champs = picked.filter((entry) => getCard(entry)?.rarity === 'Champion').length
  if (selSpells + spells + (card.type === 'Spell' ? 1 : 0) > 3) return false
  if (selChampions + champs + (card.rarity === 'Champion' ? 1 : 0) > 1) return false
  return true
}

function fillValue(key: string, ctx: Context): number {
  const card = getCard(key)
  if (!card) return -Infinity
  const m = combatOf(key)
  let score = 0
  if (ctx.needed.has('wc') && (m.roles.includes('wc') || m.roles.includes('wc2')))
    score += 100
  if (ctx.needed.has('air') && m.air && card.type !== 'Spell') score += 80
  if (ctx.needed.has('small') && SMALL_SPELLS.has(key)) score += 70
  if (ctx.needed.has('big') && BIG_SPELLS.has(key)) score += 70
  if (ctx.needed.has('defense') && (m.roles.includes('tankKiller') || m.dps >= 3))
    score += 60
  if (ctx.needed.has('building') && card.type === 'Building') score += 60
  if (ctx.needed.has('splash') && m.aoe) score += 50
  if (ctx.needed.has('cycle') && card.elixir <= 2) score += 40
  const stat = ctx.cardStats.get(key)
  if (stat) score += clamp01((stat.winRate - 45) / 12) * 30 + clamp01(stat.usage / 20) * 6
  return score
}

/**
 * Keep every selected card and borrow the donor's remaining shell. Extras are
 * chosen by the roles the selection is missing, then by real card records;
 * champion and spell limits are hard filters, not penalties.
 */
function completeFromSelection(
  selected: string[],
  donor: DeckStat,
  ctx: Context,
): string[] {
  const target = 8 - selected.length
  if (target <= 0) return selected.slice(0, 8)
  const extras = donor.cards.filter((key) => !ctx.selSet.has(key))
  const allowed = extras.filter((key) =>
    cardAllows(key, selected, ctx.selSpells, ctx.selChampions),
  )
  const source = allowed.length >= target ? allowed : extras
  const ranked = [...source].sort((a, b) => fillValue(b, ctx) - fillValue(a, ctx))
  return [...selected, ...ranked.slice(0, target)]
}

/** One candidate assembled purely from missing roles + the best real card records. */
function buildRoleFill(selected: string[], ctx: Context, snapshot: MetaSnapshot): string[] | null {
  const target = 8 - selected.length
  if (target <= 0) return null
  const pool = snapshot.cards
    .filter((card) => card.battles >= 3 && !ctx.selSet.has(card.key))
    .sort((a, b) => b.winRate - a.winRate || b.battles - a.battles)
  if (!pool.length) return null

  const picked: string[] = []
  const has = (key: string) => ctx.selSet.has(key) || picked.includes(key)
  const take = (predicate: (card: CardStat) => boolean) => {
    if (picked.length >= target) return
    const match = pool.find(
      (card) =>
        !has(card.key) &&
        predicate(card) &&
        cardAllows(card.key, [...selected, ...picked], ctx.selSpells, ctx.selChampions),
    )
    if (match) picked.push(match.key)
  }

  const hasRole = (key: string, role: CardRole) => combatOf(key).roles.includes(role)
  if (ctx.needed.has('wc'))
    take((card) => hasRole(card.key, 'wc') || hasRole(card.key, 'wc2'))
  if (ctx.needed.has('air'))
    take((card) => combatOf(card.key).air && getCard(card.key)?.type !== 'Spell')
  if (ctx.needed.has('small')) take((card) => SMALL_SPELLS.has(card.key))
  if (ctx.needed.has('big')) take((card) => BIG_SPELLS.has(card.key))
  if (ctx.needed.has('defense'))
    take((card) => hasRole(card.key, 'tankKiller') || combatOf(card.key).dps >= 3)
  if (ctx.needed.has('building')) take((card) => getCard(card.key)?.type === 'Building')
  if (ctx.needed.has('splash')) take((card) => combatOf(card.key).aoe)
  if (ctx.needed.has('cycle')) take((card) => getCard(card.key)!.elixir <= 2)

  while (picked.length < target) {
    const next = pool.find(
      (card) =>
        !has(card.key) &&
        cardAllows(card.key, [...selected, ...picked], ctx.selSpells, ctx.selChampions),
    )
    if (!next) break
    picked.push(next.key)
  }
  if (picked.length < target) return null
  return [...selected, ...picked]
}

function coverageFlags(cards: string[]) {
  const partial = analyzeDeck(cards, { swaps: false, matchups: false })
  const comp = partial.composition
  const checks: { label: string; ok: boolean }[] = [
    { label: 'win condition', ok: comp.winConditions.length >= 1 },
    { label: 'air defence', ok: comp.airDefense.length >= 2 },
    { label: 'small spell', ok: comp.smallSpells.length >= 1 },
    { label: 'big spell', ok: comp.bigSpells.length >= 1 },
    {
      label: 'ground defence',
      ok: comp.buildings.length >= 1 || comp.tankKillers.length >= 1,
    },
    { label: 'splash', ok: comp.splash.length >= 2 },
    { label: 'cheap cycle cards', ok: comp.cycleCards.length >= 2 },
  ]
  return { checks, analysis: partial }
}

function buildReasons(input: {
  matchedNames: string[]
  missingNames: string[]
  total: number
  meta: DeckStat | null
  observed: boolean
  cardMean: number | null
  covered: string[]
  gaps: string[]
  pairHits: number
  pairTotal: number
  archLabel: string
  archAgree: boolean
  archConfidence: number
  avgElixir: number
  medianElixir: number
  fills: string[]
}): string[] {
  const reasons: string[] = []
  const { matchedNames, missingNames, total, meta, observed, cardMean } = input
  if (matchedNames.length === total) {
    reasons.push(`All ${total} selected cards are in this deck`)
  } else {
    reasons.push(
      `${matchedNames.length}/${total} selected cards compatible${
        missingNames.length ? ` — ${missingNames.join(', ')} not included` : ''
      }`,
    )
  }
  if (meta && observed) {
    reasons.push(`Win rate ${meta.winRate}% across ${meta.battles} battles`)
    reasons.push(`Usage ${meta.usage}% of sampled battles`)
  } else if (cardMean !== null) {
    reasons.push(`Card records average ${cardMean}% win rate (exact build not sampled)`)
  } else {
    reasons.push('Not enough recorded battles to read its performance')
  }
  if (input.covered.length)
    reasons.push(`Covers ${input.covered.join(', ')}`)
  if (input.gaps.length) reasons.push(`Still missing ${input.gaps.join(', ')}`)
  reasons.push(
    `${input.pairHits} of ${input.pairTotal} card pairs appear together in meta decks`,
  )
  reasons.push(
    `${input.archLabel} archetype${input.archAgree ? ' — matches your selection' : ''} (${Math.round(input.archConfidence * 100)}% confidence)`,
  )
  if (Math.abs(input.avgElixir - input.medianElixir) >= 0.1)
    reasons.push(`Avg elixir ${input.avgElixir} vs meta median ${input.medianElixir}`)
  if (input.fills.length)
    reasons.push(`Completed with ${input.fills.length} card(s) chosen for the missing roles`)
  return reasons
}

function buildSummary(input: {
  matched: string[]
  total: number
  fills: string[]
  fillRoles: string[]
  meta: DeckStat | null
  observed: boolean
  cardMean: number | null
}): string {
  const head =
    input.matched.length === input.total
      ? `Your ${input.total} selected cards form this deck's core exactly`
      : `${input.matched.length} of your ${input.total} selected cards fit this deck's core strategy`
  let body = ''
  if (input.fills.length) {
    body = input.fillRoles.length
      ? `. Filling the rest with ${input.fills.join(', ')} adds ${input.fillRoles.join(' and ')}`
      : `. The remaining slots are filled from the same shell`
  }
  let tail = ''
  if (input.meta && input.observed) {
    tail = `. In the current sample it holds a ${input.meta.winRate}% win rate over ${input.meta.battles} battles (${input.meta.usage}% usage)`
  } else if (input.cardMean !== null) {
    tail = `. The exact build is not in the sample, so its cards average ${input.cardMean}% win rate where records exist`
  }
  return `${head}${body}${tail}.`
}

interface Draft {
  id: string
  cards: string[]
  source: CandidateSource
  meta: DeckStat | null
}

export function recommendDecks(
  selectedInput: string[],
  snapshot: MetaSnapshot | null | undefined,
): Recommendation[] {
  if (!snapshot?.decks?.length) return []
  const selected = Array.from(
    new Set(selectedInput.filter((key) => getCard(key))),
  ).slice(0, 8)
  if (selected.length < MIN_SELECTED_CARDS) return []

  const metaDecks = snapshot.decks
  const selSet = new Set(selected)
  const cardStats = new Map(snapshot.cards.map((card) => [card.key, card]))

  const pairSet = new Set<string>()
  for (const deck of metaDecks) {
    const cards = [...deck.cards].sort()
    for (let i = 0; i < cards.length; i += 1) {
      for (let j = i + 1; j < cards.length; j += 1) pairSet.add(pairId(cards[i], cards[j]))
    }
  }

  const selSpells = selected.filter((key) => getCard(key)?.type === 'Spell').length
  const selChampions = selected.filter((key) => getCard(key)?.rarity === 'Champion').length
  const ctx: Context = {
    selected,
    selSet,
    cardStats,
    pairSet,
    medianElixir: median(metaDecks.map((deck) => deck.avgElixir)),
    selArch: detectArchetype(selected),
    needed: missingRoles(selected),
    selSpells,
    selChampions,
  }

  // --- Candidate generation -------------------------------------------------
  const drafts = new Map<string, Draft>()
  const add = (cards: string[], source: CandidateSource, meta: DeckStat | null) => {
    const id = [...cards].sort().join('|')
    if (!drafts.has(id)) drafts.set(id, { id, cards: id.split('|'), source, meta })
  }

  // Every observed meta deck, high compatibility or not.
  for (const deck of metaDecks) add(deck.cards, 'meta', deck)

  // Completions: keep the selection, borrow the shell of the decks that fit it.
  const overlapOf = (deck: DeckStat) =>
    deck.cards.reduce((total, key) => total + (selSet.has(key) ? 1 : 0), 0)
  const donors = [...metaDecks]
    .sort((a, b) => overlapOf(b) - overlapOf(a) || b.usage - a.usage)
    .slice(0, 12)
  for (const donor of donors) {
    const completed = completeFromSelection(selected, donor, ctx)
    if (completed.length === 8) add(completed, 'completed', null)
  }

  // One pure role-driven fill from the best real card records.
  const roleFill = buildRoleFill(selected, ctx, snapshot)
  if (roleFill) add(roleFill, 'completed', null)

  // --- Scoring --------------------------------------------------------------
  const results: (Recommendation & { baseLabel: string })[] = []

  for (const draft of drafts.values()) {
    const { checks, analysis } = coverageFlags(draft.cards)
    const matched = selected.filter((key) => draft.cards.includes(key))
    const missing = selected.filter((key) => !draft.cards.includes(key))
    const fills = draft.cards.filter((key) => !selSet.has(key))

    const match = matched.length / selected.length

    let performance: number
    let cardMean: number | null = null
    if (draft.meta) {
      const results01 = clamp01((draft.meta.winRate - 45) / 12)
      const confidence = clamp01(draft.meta.battles / 60)
      performance = results01 * 0.75 + confidence * 0.25
    } else {
      const rates = draft.cards
        .map((key) => cardStats.get(key)?.winRate)
        .filter((rate): rate is number => typeof rate === 'number')
      if (rates.length >= Math.ceil(draft.cards.length / 2)) {
        cardMean = round1(rates.reduce((sum, rate) => sum + rate, 0) / rates.length)
        performance =
          clamp01((cardMean - 45) / 12) * 0.75 + (rates.length / draft.cards.length) * 0.25
      } else {
        performance = 0
      }
    }

    const covered = checks.filter((check) => check.ok).map((check) => check.label)
    const gaps = checks.filter((check) => !check.ok).map((check) => check.label)
    const coverage = covered.length / checks.length

    const n = draft.cards.length
    let pairHits = 0
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        if (pairSet.has(pairId(draft.cards[i], draft.cards[j]))) pairHits += 1
      }
    }
    const pairTotal = (n * (n - 1)) / 2
    const synergy = pairTotal ? clamp01(pairHits / pairTotal) : 0

    const candArch = detectArchetype(draft.cards)
    const agree =
      candArch.archetype.key === ctx.selArch.archetype.key ||
      candArch.archetype.key === ctx.selArch.runnerUp?.key ||
      ctx.selArch.archetype.key === candArch.runnerUp?.key
    const archetype =
      0.5 * (agree ? 1 : 0.4) + 0.5 * clamp01(candArch.confidence / 0.7)

    const usage = draft.meta
      ? clamp01(Math.log10(1 + Math.max(0, draft.meta.usage)) / Math.log10(11))
      : 0

    const elixirFit = clamp01(
      1 - Math.abs(analysis.avgElixir - ctx.medianElixir) / 1.5,
    )

    const parts: RecommendationParts = {
      match,
      performance,
      coverage,
      synergy,
      archetype,
      usage,
      elixir: elixirFit,
    }
    const compatibility = round0(
      match * SCORE_WEIGHTS.match +
        performance * SCORE_WEIGHTS.performance +
        coverage * SCORE_WEIGHTS.coverage +
        synergy * SCORE_WEIGHTS.synergy +
        archetype * SCORE_WEIGHTS.archetype +
        usage * SCORE_WEIGHTS.usage +
        elixirFit * SCORE_WEIGHTS.elixir,
    )

    const baseLabel = draft.meta?.label ?? deckLabel(draft.cards)

    const fillRoleLabels = fills
      .flatMap((key) => {
        const m = combatOf(key)
        const card = getCard(key)
        const out: string[] = []
        if (ctx.needed.has('wc') && (m.roles.includes('wc') || m.roles.includes('wc2')))
          out.push('a win condition')
        if (ctx.needed.has('air') && m.air && card?.type !== 'Spell' && !out.length)
          out.push('an air answer')
        if (ctx.needed.has('small') && SMALL_SPELLS.has(key) && !out.length)
          out.push('a small spell')
        if (ctx.needed.has('big') && BIG_SPELLS.has(key) && !out.length)
          out.push('a big spell')
        if (ctx.needed.has('building') && card?.type === 'Building' && !out.length)
          out.push('a defensive building')
        return out
      })
      .filter((value, index, list) => list.indexOf(value) === index)

    results.push({
      rank: 0,
      id: draft.id,
      label: baseLabel,
      baseLabel,
      archetype: analysis.archetype,
      archetypeLabel: analysis.archetypeLabel,
      cards: draft.cards,
      source: draft.source,
      battles: draft.meta?.battles ?? 0,
      usage: draft.meta?.usage ?? null,
      winRate: draft.meta?.winRate ?? null,
      avgElixir: analysis.avgElixir,
      compatibility,
      parts,
      matched,
      fills,
      missingSelected: missing,
      reasons: buildReasons({
        matchedNames: matched.map((key) => getCard(key)?.name ?? key),
        missingNames: missing.map((key) => getCard(key)?.name ?? key),
        total: selected.length,
        meta: draft.meta,
        observed: draft.meta !== null,
        cardMean,
        covered,
        gaps,
        pairHits,
        pairTotal,
        archLabel: analysis.archetypeLabel,
        archAgree: agree,
        archConfidence: analysis.archetypeConfidence,
        avgElixir: analysis.avgElixir,
        medianElixir: ctx.medianElixir,
        fills: fills.map((key) => getCard(key)?.name ?? key),
      }),
      summary: buildSummary({
        matched,
        total: selected.length,
        fills: fills.map((key) => getCard(key)?.name ?? key),
        fillRoles: fillRoleLabels,
        meta: draft.meta,
        observed: draft.meta !== null,
        cardMean,
      }),
      champions: draft.cards.filter((key) => getCard(key)?.rarity === 'Champion'),
      ...(snapshot.evolvable
        ? { evolutions: draft.cards.filter((key) => snapshot.evolvable?.includes(key)) }
        : {}),
    })
  }

  results.sort(
    (a, b) =>
      b.compatibility - a.compatibility ||
      (b.winRate ?? -1) - (a.winRate ?? -1) ||
      (b.usage ?? -1) - (a.usage ?? -1) ||
      b.battles - a.battles ||
      a.label.localeCompare(b.label),
  )

  // Diversity pass: near-identical completions of the same shell would crowd
  // the ranked list, so only the best few per archetype label survive the cap.
  const kept: (Recommendation & { baseLabel: string })[] = []
  const completedPerLabel = new Map<string, number>()
  for (const item of results) {
    if (item.source === 'completed') {
      const count = completedPerLabel.get(item.baseLabel) ?? 0
      if (count >= MAX_VARIANT_COMPLETIONS) continue
      completedPerLabel.set(item.baseLabel, count + 1)
    }
    kept.push(item)
  }

  // Number duplicate labels in ranked order, so a viewer sees a contiguous
  // "variant 2 / 3" run instead of gaps left by dropped candidates.
  const labelSeen = new Map<string, number>()
  return kept.slice(0, MAX_RECOMMENDATIONS).map((item, index) => {
    const seen = (labelSeen.get(item.baseLabel) ?? 0) + 1
    labelSeen.set(item.baseLabel, seen)
    const { baseLabel, ...rest } = item
    return {
      ...rest,
      label: seen === 1 ? baseLabel : `${baseLabel} · variant ${seen}`,
      rank: index + 1,
    }
  })
}
