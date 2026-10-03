import { round1 } from './analysis'
import { archetypeLabel, detectArchetype, matchupMatrix } from './archetypes'
import { combatOf, getCard } from './cards'
import type { NormalizedBattle } from './battle'
import type { RawBattle, RawParticipant } from './cr-api'

/**
 * Battle Diagnosis.
 *
 * Every number here is derived from something the Clash Royale API actually
 * sent: card levels, tower hit points, elixir leaks, both decks and the
 * final crowns. The API has no move-by-move log, so instead of inventing a
 * timeline we point each claim back at the field it came from (`source`).
 */

export interface DiagnosisAxis {
  key: string
  label: string
  /** 0-10, one decimal. */
  score: number
  detail: string
  /** The API field or dataset this number was computed from. */
  source: string
}

export interface DiagnosisFinding {
  rank: number
  title: string
  detail: string
  severity: 'critical' | 'warning' | 'good' | 'neutral'
}

export interface DiagnosisEvidence {
  label: string
  value: string
  source: string
}

/**
 * Field-level numbers for one side of the battle, used by the versus screen.
 * `null` means the Clash Royale payload for that battle never sent the field -
 * the UI shows a dash rather than guessing a value.
 */
export interface SideMetrics {
  /** Elixir that ticked away unused over the whole match. */
  elixirLeaked: number | null
  kingTowerHp: number | null
  princessTowers: number[] | null
  /** Average levels below max across the eight cards. */
  levelDeficit: number | null
  evolutions: number | null
  avgElixir: number
}

export interface BattleDiagnosis {
  overall: number
  /** The same weighting applied to the opponent's side of the table. */
  opponentOverall: number
  axes: DiagnosisAxis[]
  /** Every axis re-scored from the opponent's point of view. */
  opponentAxes: DiagnosisAxis[]
  findings: DiagnosisFinding[]
  evidence: DiagnosisEvidence[]
  sides: { you: SideMetrics; them: SideMetrics }
  context: {
    ourArchetype: string
    theirArchetype: string
    matchup: number | null
    gameMode: string
    /** Fields the API did not send, so the related axis was skipped. */
    unavailable: string[]
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const toScore = (ratio: number): number => round1(clamp(ratio * 10, 0, 10))

const mean = (values: number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

const isSpell = (key: string): boolean => getCard(key)?.type?.toLowerCase() === 'spell'

const elixirOf = (key: string): number => getCard(key)?.elixir ?? 4

function cheapestCycle(deck: string[], size = 4): number {
  return round1(
    [...deck]
      .sort((a, b) => elixirOf(a) - elixirOf(b))
      .slice(0, size)
      .reduce((sum, key) => sum + elixirOf(key), 0),
  )
}

interface LevelSummary {
  averageDeficit: number
  evolutions: number
}

function levelSummary(participant: RawParticipant | undefined): LevelSummary | null {
  const cards = participant?.cards?.length ? participant.cards : participant?.deck
  if (!cards?.length) return null
  const deficits = cards.map((card) =>
    Math.max(0, (card.maxLevel ?? card.level ?? 0) - (card.level ?? 0)),
  )
  if (!deficits.some((value) => value > 0 || (cards[0]?.maxLevel ?? 0) > 0)) return null
  return {
    averageDeficit: round1(mean(deficits)),
    evolutions: cards.filter((card) => (card.evolutionLevel ?? 0) > 0).length,
  }
}

// ---------------------------------------------------------------------------
// Axes
// ---------------------------------------------------------------------------

function matchupAxis(our: string[], their: string[]): DiagnosisAxis {
  const ours = detectArchetype(our).archetype.key
  const theirs = detectArchetype(their).archetype.key
  const line = matchupMatrix(ours, our).find((entry) => entry.key === theirs)
  const pct = line?.score ?? null
  const score = pct === null ? 5 : round1(clamp(((pct - 25) / 50) * 10, 0, 10))
  return {
    key: 'matchup',
    label: 'Deck Matchup',
    score,
    detail:
      pct === null
        ? `${archetypeLabel(ours)} vs ${archetypeLabel(theirs)} has no historical line yet.`
        : `${archetypeLabel(ours)} into ${archetypeLabel(theirs)}: ${pct}% historical win rate.`,
    source: 'RoyaleIQ archetype matchup matrix (both decks)',
  }
}

function airAxis(our: string[], their: string[]): DiagnosisAxis {
  const threats = their.filter((key) => combatOf(key).fly)
  const counters = our.filter((key) => combatOf(key).air)
  const score = threats.length ? toScore(counters.length / threats.length) : 10
  return {
    key: 'air',
    label: 'Air Defence',
    score,
    detail:
      threats.length === 0
        ? `Opponent deck has no flying units; your ${counters.length} air-targeting cards are spare.`
        : `${counters.length} air-targeting card${counters.length === 1 ? '' : 's'} against ${threats.length} flying threat${threats.length === 1 ? '' : 's'} (${threats
            .map((key) => getCard(key)?.name ?? key)
            .join(', ')}).`,
    source: 'opponent[0].cards[] + card combat metadata (air / fly)',
  }
}

function spellAxis(our: string[], their: string[]): DiagnosisAxis {
  const spells = our.filter(isSpell)
  const small = spells.filter((key) => elixirOf(key) <= 3)
  const big = spells.filter((key) => elixirOf(key) >= 4)
  const swarm = their.filter((key) => !isSpell(key) && elixirOf(key) <= 3)
  const tanks = their.filter((key) => !isSpell(key) && elixirOf(key) >= 5)

  const smallCovered = swarm.length === 0 ? 1 : small.length > 0 ? 1 : 0
  const bigCovered = tanks.length === 0 ? 1 : big.length > 0 ? 1 : 0
  const score = toScore(0.5 * smallCovered + 0.5 * bigCovered)

  const gaps: string[] = []
  if (swarm.length && !small.length)
    gaps.push(`no small spell for ${swarm.length} cheap troop${swarm.length === 1 ? '' : 's'}`)
  if (tanks.length && !big.length)
    gaps.push(`no big spell for ${tanks.length} tank${tanks.length === 1 ? '' : 's'}`)

  return {
    key: 'spells',
    label: 'Spell Coverage',
    score,
    detail: gaps.length
      ? `You carry ${small.length} small + ${big.length} big spell${small.length + big.length === 1 ? '' : 's'}: ${gaps.join('; ')}.`
      : `You carry ${small.length} small + ${big.length} big spell${small.length + big.length === 1 ? '' : 's'} against ${swarm.length} cheap troop${swarm.length === 1 ? '' : 's'} and ${tanks.length} tank${tanks.length === 1 ? '' : 's'}.`,
    source: 'both card lists + elixir cost',
  }
}

function cycleAxis(our: string[], their: string[]): DiagnosisAxis {
  const ourCycle = cheapestCycle(our)
  const theirCycle = cheapestCycle(their)
  const score = round1(clamp(5 + (theirCycle - ourCycle) * 1.2, 0, 10))
  return {
    key: 'cycle',
    label: 'Cycle Efficiency',
    score,
    detail: `Cycle of 4 costs you ${ourCycle} elixir vs ${theirCycle} for them (deck average ${round1(
      mean(our.map(elixirOf)),
    )} vs ${round1(mean(their.map(elixirOf)))}).`,
    source: 'card elixir cost',
  }
}

function levelAxis(
  our: RawParticipant | undefined,
  their: RawParticipant | undefined,
): DiagnosisAxis | null {
  const mine = levelSummary(our)
  const theirs = levelSummary(their)
  if (!mine || !theirs) return null
  const score = round1(clamp(5 + (theirs.averageDeficit - mine.averageDeficit) * 3, 0, 10))
  const gap = round1(mine.averageDeficit - theirs.averageDeficit)
  const detail =
    gap > 0
      ? `Your cards sit ${gap} levels below max on average, opponent only ${theirs.averageDeficit}.`
      : gap < 0
        ? `Your cards sit ${Math.abs(gap)} levels better than theirs (${mine.averageDeficit} vs ${theirs.averageDeficit} below max).`
        : `Both decks sit ${mine.averageDeficit} levels below max on average.`
  return {
    key: 'levels',
    label: 'Level Parity',
    score,
    detail,
    source: 'team[0].cards[].level vs maxLevel',
  }
}

function elixirAxis(
  our: RawParticipant | undefined,
  their: RawParticipant | undefined,
): DiagnosisAxis | null {
  const mine = our?.elixirLeaked
  const theirs = their?.elixirLeaked
  if (typeof mine !== 'number' || typeof theirs !== 'number') return null
  const score = round1(clamp(5 + (theirs - mine) * 1.2, 0, 10))
  return {
    key: 'elixir',
    label: 'Elixir Discipline',
    score,
    detail: `You let ${mine} elixir tick away, opponent ${theirs}.`,
    source: 'team[0].elixirLeaked',
  }
}

// ---------------------------------------------------------------------------
// Findings + evidence
// ---------------------------------------------------------------------------

const AXIS_TITLE: Record<string, (score: number, axis: DiagnosisAxis) => string> = {
  matchup: (score) =>
    score > 5.3 ? 'Favourable matchup' : score < 4.7 ? 'Unfavourable matchup' : 'Even matchup',
  air: (score) => (score < 5 ? 'Thin air defence' : 'Air defence held up'),
  spells: (score) => (score < 6.5 ? 'Spell coverage gap' : 'Spell coverage was enough'),
  cycle: (score) => (score < 5 ? 'Slower defensive cycle' : 'Cycle advantage'),
  levels: (score) =>
    score < 4.5 ? 'Card level disadvantage' : score > 5.5 ? 'Card level advantage' : 'Level playing field',
  elixir: (score) => (score < 4.5 ? 'Elixir left on the table' : 'Elixir discipline held up'),
}

const titleFor = (axis: DiagnosisAxis): string =>
  AXIS_TITLE[axis.key]?.(axis.score, axis) ?? axis.label

/**
 * Per-axis bands. Below `weak` the axis is a liability, above `strong` it is a
 * strength, in between it is simply even - and gets reported as such instead
 * of being dressed up as a problem.
 */
const BANDS: Record<string, { weak: number; strong: number }> = {
  matchup: { weak: 4.7, strong: 5.3 },
  air: { weak: 5, strong: 7.5 },
  spells: { weak: 6.5, strong: 8 },
  cycle: { weak: 5, strong: 7.5 },
  levels: { weak: 4.5, strong: 5.5 },
  elixir: { weak: 4.5, strong: 6 },
}

function severityFor(axis: DiagnosisAxis): DiagnosisFinding['severity'] {
  const band = BANDS[axis.key] ?? { weak: 5, strong: 7.5 }
  if (axis.score < band.weak) return axis.score < band.weak - 1 ? 'critical' : 'warning'
  if (axis.score > band.strong) return 'good'
  return 'neutral'
}

function buildFindings(
  diagnosis: Omit<BattleDiagnosis, 'findings'>,
  raw: RawBattle | undefined,
): DiagnosisFinding[] {
  const ascending = [...diagnosis.axes].sort((a, b) => a.score - b.score)
  const descending = [...ascending].reverse()

  // The three weakest axes always speak first, then whatever clearly worked.
  const picked: DiagnosisAxis[] = [
    ...ascending.slice(0, 3),
    ...descending.filter((axis) => axis.score >= 7.5).slice(0, 2),
  ]

  const seen = new Set<string>()
  const selected: DiagnosisFinding[] = []
  for (const axis of picked) {
    if (seen.has(axis.key)) continue
    seen.add(axis.key)
    selected.push({ rank: 0, title: titleFor(axis), detail: axis.detail, severity: severityFor(axis) })
    if (selected.length >= 5) break
  }

  // One concrete, result-shaped observation: which tower actually fell.
  const team = raw?.team?.[0]
  const foe = raw?.opponent?.[0]
  const towers = team?.princessTowersHitPoints
  if (team && foe && Array.isArray(towers) && towers.some((hp) => hp === 0)) {
    const lane =
      towers[0] === 0 ? (towers[1] === 0 ? 'Both lanes' : 'Left lane') : 'Right lane'
    selected.unshift({
      rank: 0,
      title: team.crowns === 0 ? 'No tower taken' : `${lane} collapsed`,
      detail: `Your princess towers ended at ${towers.join(' / ')} HP, opponent's at ${
        foe.princessTowersHitPoints?.join(' / ') ?? 'n/a'
      }. Final score ${team.crowns}-${foe.crowns}.`,
      severity: 'critical',
    })
  }

  return selected.slice(0, 5).map((finding, index) => ({ ...finding, rank: index + 1 }))
}

function buildEvidence(
  battle: NormalizedBattle,
  axes: DiagnosisAxis[],
  raw: RawBattle | undefined,
): DiagnosisEvidence[] {
  const evidence: DiagnosisEvidence[] = []
  const team = raw?.team?.[0]
  const foe = raw?.opponent?.[0]

  evidence.push({
    label: 'Result',
    value: `${battle.result.toUpperCase()} ${battle.crowns.us}-${battle.crowns.them}`,
    source: 'team[0].crowns',
  })

  if (raw) {
    evidence.push({
      label: 'Game mode',
      value: `${raw.gameMode?.name ?? 'unknown'} / league ${raw.leagueNumber ?? 'n/a'}`,
      source: 'battlelog.gameMode, battlelog.leagueNumber',
    })
  }

  const matchup = axes.find((axis) => axis.key === 'matchup')
  if (matchup) evidence.push({ label: matchup.label, value: matchup.detail, source: matchup.source })

  if (team && foe) {
    const mine = levelSummary(team)
    const theirs = levelSummary(foe)
    if (mine && theirs) {
      evidence.push({
        label: 'Card levels',
        value: `deficit ${mine.averageDeficit} vs ${theirs.averageDeficit} levels below max`,
        source: 'team[0].cards[].level vs maxLevel',
      })
      evidence.push({
        label: 'Evolutions',
        value: `${mine.evolutions} vs ${theirs.evolutions} evolved cards in deck`,
        source: 'team[0].cards[].evolutionLevel',
      })
    }
    if (typeof team.elixirLeaked === 'number' && typeof foe.elixirLeaked === 'number') {
      evidence.push({
        label: 'Elixir leaked',
        value: `${team.elixirLeaked} vs ${foe.elixirLeaked}`,
        source: 'team[0].elixirLeaked',
      })
    }
    const myTowers = team.princessTowersHitPoints
    const theirTowers = foe.princessTowersHitPoints
    if (Array.isArray(myTowers) && Array.isArray(theirTowers)) {
      evidence.push({
        label: 'Princess towers',
        value: `yours ${myTowers.join(' / ')} HP, opponent ${theirTowers.join(' / ')} HP`,
        source: 'team[0].princessTowersHitPoints',
      })
      evidence.push({
        label: 'King tower',
        value: `${team.kingTowerHitPoints ?? 'n/a'} vs ${foe.kingTowerHitPoints ?? 'n/a'} HP`,
        source: 'team[0].kingTowerHitPoints',
      })
    }
  }

  const air = axes.find((axis) => axis.key === 'air')
  if (air) evidence.push({ label: 'Air profile', value: air.detail, source: air.source })
  const spells = axes.find((axis) => axis.key === 'spells')
  if (spells) evidence.push({ label: 'Spell profile', value: spells.detail, source: spells.source })
  const cycle = axes.find((axis) => axis.key === 'cycle')
  if (cycle) evidence.push({ label: 'Elixir curve', value: cycle.detail, source: cycle.source })

  return evidence
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const WEIGHTS: Record<string, number> = {
  matchup: 0.25,
  air: 0.2,
  spells: 0.15,
  cycle: 0.15,
  levels: 0.15,
  elixir: 0.1,
}

/**
 * The axes are deliberately symmetric: every builder takes `(ours, theirs)`, so
 * swapping both decks *and* both participants scores the mirror image of the
 * table from the opponent's seat. Level and elixir parity mirror around 5 by
 * construction, which is exactly what a two-sided comparison needs.
 */
function buildAxes(
  our: string[],
  their: string[],
  mine: RawParticipant | undefined,
  theirs: RawParticipant | undefined,
): DiagnosisAxis[] {
  const core: DiagnosisAxis[] = [
    matchupAxis(our, their),
    airAxis(our, their),
    spellAxis(our, their),
    cycleAxis(our, their),
  ]
  const optional: DiagnosisAxis[] = [levelAxis(mine, theirs), elixirAxis(mine, theirs)].filter(
    (axis): axis is DiagnosisAxis => Boolean(axis),
  )
  return [...core, ...optional]
}

function overallFor(axes: DiagnosisAxis[]): number {
  let weightSum = 0
  let weighted = 0
  for (const axis of axes) {
    const weight = WEIGHTS[axis.key] ?? 0.1
    weightSum += weight
    weighted += axis.score * weight
  }
  return weightSum ? round1(weighted / weightSum) : 0
}

function sideMetrics(
  participant: RawParticipant | undefined,
  deck: string[],
): SideMetrics {
  const summary = levelSummary(participant)
  const towers = participant?.princessTowersHitPoints
  return {
    elixirLeaked: typeof participant?.elixirLeaked === 'number' ? participant.elixirLeaked : null,
    kingTowerHp:
      typeof participant?.kingTowerHitPoints === 'number' ? participant.kingTowerHitPoints : null,
    princessTowers: Array.isArray(towers) ? towers : null,
    levelDeficit: summary?.averageDeficit ?? null,
    evolutions: summary?.evolutions ?? null,
    avgElixir: deck.length ? round1(mean(deck.map(elixirOf))) : 0,
  }
}

export function diagnoseBattle(battle: NormalizedBattle): BattleDiagnosis {
  const raw = battle.raw
  const our = battle.deck
  const their = battle.opponentDeck
  const mine = raw?.team?.[0]
  const theirs = raw?.opponent?.[0]

  const axes = buildAxes(our, their, mine, theirs)
  const opponentAxes = buildAxes(their, our, theirs, mine)
  const unavailable = ['levels', 'elixir'].filter(
    (key) => !axes.some((axis) => axis.key === key),
  )

  const ours = detectArchetype(our).archetype.key
  const theirsKey = detectArchetype(their).archetype.key
  const matchup = matchupMatrix(ours, our).find((entry) => entry.key === theirsKey)?.score ?? null

  const base: Omit<BattleDiagnosis, 'findings'> = {
    overall: overallFor(axes),
    opponentOverall: overallFor(opponentAxes),
    axes,
    opponentAxes,
    evidence: [],
    sides: {
      you: sideMetrics(mine, our),
      them: sideMetrics(theirs, their),
    },
    context: {
      ourArchetype: archetypeLabel(ours),
      theirArchetype: archetypeLabel(theirsKey),
      matchup,
      gameMode: raw?.gameMode?.name ?? battle.type,
      unavailable,
    },
  }

  const findings = buildFindings(base, raw)
  const evidence = buildEvidence(battle, axes, raw)

  return { ...base, findings, evidence }
}
