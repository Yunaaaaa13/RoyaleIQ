import {
  ALL_CARDS,
  combatOf,
  getCard,
  resolveDeck,
  type RawCard,
} from './cards'
import { BIG_SPELLS, EXCLUDED_SWAPS, SMALL_SPELLS } from './card-meta'
import {
  detectArchetype,
  getArchetype,
  matchupMatrix,
  type MatchupLine,
} from './archetypes'

export type ScoreKey =
  | 'offense'
  | 'defense'
  | 'airDefense'
  | 'cycle'
  | 'spellUtility'

export interface DeckScores extends Record<ScoreKey, number> {
  overall: number
}

export type Severity = 'critical' | 'warning' | 'good'

export interface Finding {
  code: string
  severity: Severity
  title: string
  detail: string
}

export interface SwapSuggestion {
  from: string
  to: string
  reason: string
  gains: string[]
  tradeoffs: string[]
  delta: Partial<DeckScores>
}

export interface Composition {
  winConditions: string[]
  smallSpells: string[]
  bigSpells: string[]
  buildings: string[]
  airDefense: string[]
  splash: string[]
  cycleCards: string[]
  tankKillers: string[]
}

export interface CostBucket {
  elixir: number
  /** Rendered on the chart axis, so buckets stay legible past 7 elixir. */
  label: string
  count: number
}

export interface DeckAnalysis {
  cards: string[]
  avgElixir: number
  archetype: string
  archetypeLabel: string
  archetypeBlurb: string
  archetypeConfidence: number
  runnerUp?: string
  scores: DeckScores
  composition: Composition
  findings: Finding[]
  swaps: SwapSuggestion[]
  matchups: MatchupLine[]
  costCurve: CostBucket[]
  valid: boolean
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const round1 = (value: number) => Math.round(value * 10) / 10

function avgElixir(cards: RawCard[]): number {
  if (!cards.length) return 0
  return cards.reduce((sum, card) => sum + card.elixir, 0) / cards.length
}

function scoreDeck(cards: RawCard[]): DeckScores {
  const metas = cards.map((card) => combatOf(card.key))
  const avg = avgElixir(cards)
  const spells = cards.filter((card) => card.type === 'Spell')
  const smallSpells = spells.filter((card) => SMALL_SPELLS.has(card.key))
  const bigSpells = spells.filter((card) => BIG_SPELLS.has(card.key))

  const wcCount = metas.filter((m) => m.roles.includes('wc')).length
  const wc2Count = metas.filter((m) => m.roles.includes('wc2')).length
  const supports = metas.filter(
    (m) => m.roles.includes('support') || m.roles.includes('dps'),
  ).length
  const flyers = metas.filter((m) => m.fly).length
  const buildings = cards.filter((card) => card.type === 'Building').length
  const spawns = metas.filter((m) => m.roles.includes('spawn')).length
  const tanks = metas.filter((m) => m.roles.includes('tank')).length
  const swarms = metas.filter((m) => m.roles.includes('swarm')).length
  const splash = metas.filter((m) => m.aoe).length
  const tankKillers = metas.filter(
    (m) => m.dps >= 3 || m.roles.includes('tankKiller'),
  ).length
  const groundStoppers = cards.filter((card) => {
    const m = combatOf(card.key)
    return (
      m.roles.includes('tank') ||
      m.roles.includes('tankKiller') ||
      m.roles.includes('splash') ||
      m.roles.includes('swarm') ||
      card.type === 'Building'
    )
  }).length

  // --- Offense ---
  let offense = 0
  if (wcCount >= 1) offense += 4
  if (wc2Count >= 1) offense += 1
  offense += Math.min(2, supports * 0.4)
  if (bigSpells.length >= 1) offense += 1.5
  if (spells.length >= 3) offense += 0.5
  if (flyers >= 1) offense += 1
  if (spawns >= 1) offense += 0.5
  if (tanks >= 1) offense += 0.5
  if (wcCount + wc2Count >= 1) offense += 0.5
  if (wcCount + wc2Count === 0) offense = Math.min(offense, 4.5)

  // --- Defense ---
  let defense = 2
  defense += Math.min(3, groundStoppers * 0.5)
  defense += Math.min(2, tankKillers * 0.8)
  defense += Math.min(1.5, splash * 0.5)
  defense += Math.min(1.5, buildings * 0.75)
  defense += Math.min(1, swarms * 0.3)
  if (avg > 4.2) defense -= 1.2
  else if (avg > 3.8) defense -= 0.5
  if (avg < 3 && tankKillers === 0) defense -= 1
  defense = clamp(defense, 0, 10)

  // --- Air defence ---
  let air = 0
  let airTroops = 0
  for (const card of cards) {
    const m = combatOf(card.key)
    if (!m.air) continue
    if (card.type === 'Spell') {
      if (SMALL_SPELLS.has(card.key)) air += 0.5
      else if (card.key === 'fireball') air += 1.2
      else if (card.key === 'rocket' || card.key === 'lightning') air += 1.4
      else if (card.key === 'poison' || card.key === 'tornado') air += 1
      else air += 0.5
    } else {
      const base =
        m.dps === 3 ? 1.8 : m.dps === 2 ? 1.4 : m.dps === 1 ? 0.9 : 0.5
      const weight = m.roles.includes('wc') ? base * 0.5 : base
      air += weight + (m.fly ? 0.2 : 0)
      airTroops += 1
    }
  }
  if (airTroops >= 1) air += 1.5
  if (airTroops >= 2) air += 1
  if (airTroops >= 3) air += 0.5
  if (airTroops === 0) air = Math.min(air, 2.5)
  else if (airTroops === 1) air = Math.min(air, 6.5)
  air = clamp(air, 0, 10)

  // --- Cycle ---
  let cycle = 10 - (avg - 2.5) * 4
  const cheap = cards.filter((card) => card.elixir <= 2).length
  const oneCost = cards.filter((card) => card.elixir === 1).length
  cycle += Math.min(2, cheap * 0.5)
  cycle += Math.min(1, oneCost * 0.35)
  cycle = clamp(cycle, 0, 10)

  // --- Spell utility ---
  let spellUtility = 0.5
  if (spells.length > 0) {
    spellUtility = 0
    if (smallSpells.length >= 1) spellUtility += 3
    if (bigSpells.length >= 1) spellUtility += 3
    if (spells.length >= 3) spellUtility += 2
    else if (spells.length === 2) spellUtility += 0.75
    if (smallSpells.length >= 1 && bigSpells.length >= 1) spellUtility += 1.5
    spellUtility = clamp(spellUtility, 0, 10)
  }

  const overall =
    offense * 0.25 +
    defense * 0.25 +
    air * 0.2 +
    cycle * 0.15 +
    spellUtility * 0.15

  return {
    offense: round1(offense),
    defense: round1(defense),
    airDefense: round1(air),
    cycle: round1(cycle),
    spellUtility: round1(spellUtility),
    overall: round1(overall),
  }
}

function buildComposition(cards: RawCard[]): Composition {
  const pick = (fn: (card: RawCard) => boolean) =>
    cards.filter(fn).map((card) => card.key)
  return {
    winConditions: pick((card) => combatOf(card.key).roles.includes('wc')),
    smallSpells: pick((card) => SMALL_SPELLS.has(card.key)),
    bigSpells: pick((card) => BIG_SPELLS.has(card.key)),
    buildings: pick((card) => card.type === 'Building'),
    airDefense: pick(
      (card) =>
        combatOf(card.key).air &&
        !(card.type === 'Spell' && SMALL_SPELLS.has(card.key)),
    ),
    splash: pick((card) => combatOf(card.key).aoe),
    cycleCards: pick((card) => card.elixir <= 2),
    tankKillers: pick(
      (card) =>
        combatOf(card.key).dps >= 3 ||
        combatOf(card.key).roles.includes('tankKiller'),
    ),
  }
}

function buildFindings(
  cards: RawCard[],
  scores: DeckScores,
  comp: Composition,
): Finding[] {
  const findings: Finding[] = []
  const avg = avgElixir(cards)
  const spells = cards.filter((card) => card.type === 'Spell')
  const tankTakers = comp.tankKillers.length

  if (cards.length !== 8) {
    findings.push({
      code: 'incomplete',
      severity: 'warning',
      title: 'Deck is not complete',
      detail: `A deck needs 8 cards, this one has ${cards.length}. Scores are provisional until the deck is full.`,
    })
  }

  if (comp.winConditions.length === 0) {
    findings.push({
      code: 'no-win-condition',
      severity: 'critical',
      title: 'No win condition',
      detail:
        'Nothing in this deck reliably takes a tower. Without a Hog Rider, X-Bow, Golem, Royal Giant, Graveyard or equivalent, you are relying on the opponent making mistakes to deal chip damage.',
    })
  }

  if (scores.airDefense < 4.5) {
    findings.push({
      code: 'air-defense-low',
      severity: 'critical',
      title: 'Air defence problem',
      detail: `Only ${comp.airDefense.length} card(s) can meaningfully answer air pushes. LavaLoon, Balloon and Minion Horde will be very hard to defend without overcommitting elixir.`,
    })
  } else if (scores.airDefense < 6.5) {
    findings.push({
      code: 'air-defense-soft',
      severity: 'warning',
      title: 'Air defence is thin',
      detail: 'Air answers exist but they are few or low-dps. One mis-timed defence against an air push can cost a tower.',
    })
  }

  const airTroopsOnly = comp.airDefense.filter(
    (key) => getCard(key)?.type !== 'Spell',
  )
  if (cards.length === 8 && airTroopsOnly.length === 1) {
    findings.push({
      code: 'air-single-point',
      severity: 'warning',
      title: 'Single point of failure on air',
      detail: `${getCard(airTroopsOnly[0])?.name} is the only non-spell card that can target air. When it is out of rotation, air pushes are undefended.`,
    })
  }

  if (spells.length === 0) {
    findings.push({
      code: 'no-spell',
      severity: 'critical',
      title: 'No spells at all',
      detail:
        'An 8-card deck with zero spells cannot punish stacked troops, clear swarms or finish a low tower.',
    })
  } else {
    if (comp.smallSpells.length === 0) {
      findings.push({
        code: 'no-small-spell',
        severity: 'warning',
        title: 'No small spell',
        detail:
          'You have nothing cheap to clear Skeleton Army, Goblins, Bats or a low-HP tower. Chip damage and swarm punishment will be expensive.',
      })
    }
    if (comp.bigSpells.length === 0) {
      findings.push({
        code: 'no-big-spell',
        severity: 'warning',
        title: 'No big spell',
        detail:
          'No Fireball, Poison, Rocket, Lightning or Earthquake means no reliable way to finish a tower or delete a back-line support unit.',
      })
    }
    if (spells.length >= 4) {
      findings.push({
        code: 'too-many-spells',
        severity: 'warning',
        title: 'Too many spells',
        detail: `${spells.length} spells leaves too little unit density to defend pushes or support a win condition.`,
      })
    }
  }

  if (avg > 4) {
    findings.push({
      code: 'heavy-deck',
      severity: 'warning',
      title: 'Heavy elixir curve',
      detail: `Average elixir is ${round1(avg)}. One failed push puts you behind on elixir, so you will usually be defending rather than setting the pace.`,
    })
  } else if (avg < 2.8) {
    findings.push({
      code: 'glass-deck',
      severity: 'warning',
      title: 'Very cheap, very fragile',
      detail: `Average elixir is ${round1(avg)}. You will out-cycle counters easily but lack the raw stats to stop a committed tank push.`,
    })
  }

  if (comp.splash.length <= 1) {
    findings.push({
      code: 'low-splash',
      severity: 'warning',
      title: 'Swarm vulnerability',
      detail:
        'With almost no area damage, Skeleton Army, Goblin Gang and Minion Horde cost you far more elixir to answer than they cost to play.',
    })
  }

  if (tankTakers === 0 && avg >= 3.4) {
    findings.push({
      code: 'no-tank-killer',
      severity: 'warning',
      title: 'No tank killer',
      detail:
        'Nothing in the deck has the single-target dps to shred Golem, Giant, Royal Giant or Mega Knight before they connect.',
    })
  }

  if (comp.buildings.length === 0 && comp.tankKillers.length <= 1) {
    findings.push({
      code: 'no-building',
      severity: 'warning',
      title: 'No defensive building',
      detail:
        'Without a building you cannot pull win conditions to the centre, so every bridge push connects for full damage unless you trade troops into it.',
    })
  }

  if (
    scores.overall >= 7 &&
    comp.winConditions.length > 0 &&
    comp.smallSpells.length > 0
  ) {
    findings.push({
      code: 'well-rounded',
      severity: 'good',
      title: 'Structurally well rounded',
      detail: `Win condition, small spell and a balanced defensive core. Average elixir ${round1(avg)} keeps your rotation healthy.`,
    })
  }

  if (scores.cycle >= 7.5) {
    findings.push({
      code: 'fast-cycle',
      severity: 'good',
      title: 'Fast cycle',
      detail: `Average elixir ${round1(avg)} with ${comp.cycleCards.length} card(s) at 2 elixir or less lets you get back to your win condition before the opponent re-draws theirs.`,
    })
  }

  if (comp.airDefense.length >= 3 && scores.airDefense >= 7) {
    findings.push({
      code: 'solid-air',
      severity: 'good',
      title: 'Air defence covered',
      detail: `${comp.airDefense.length} cards answer air, so LavaLoon and Balloon decks do not force a panic response.`,
    })
  }

  return findings
}

type Need = ScoreKey

const NEED_THRESHOLD: Record<Need, number> = {
  offense: 6.5,
  defense: 6.5,
  airDefense: 6,
  cycle: 6,
  spellUtility: 6,
}

function candidatesFor(
  need: Need,
  deck: Set<string>,
): { key: string; elixir: number }[] {
  return ALL_CARDS.filter((card) => {
    if (deck.has(card.key)) return false
    if (EXCLUDED_SWAPS.has(card.key)) return false
    const m = combatOf(card.key)
    switch (need) {
      case 'airDefense':
        return m.air && card.type !== 'Spell' && m.dps >= 1 && card.elixir <= 5
      case 'offense':
        return (
          (m.roles.includes('wc') || m.roles.includes('wc2')) ||
          ((m.roles.includes('support') || m.roles.includes('dps')) &&
            card.elixir <= 5)
        )
      case 'defense':
        return (
          m.roles.includes('tank') ||
          m.roles.includes('tankKiller') ||
          m.roles.includes('splash') ||
          card.type === 'Building'
        ) && card.elixir <= 6
      case 'spellUtility':
        return (
          card.type === 'Spell' &&
          (SMALL_SPELLS.has(card.key) || BIG_SPELLS.has(card.key))
        )
      case 'cycle':
        return card.elixir <= 3
    }
  }).map((card) => ({ key: card.key, elixir: card.elixir }))
}

function isProtected(
  need: Need,
  card: RawCard,
  comp: Composition,
  scores: DeckScores,
): boolean {
  const m = combatOf(card.key)
  if (m.roles.includes('wc') && comp.winConditions.length <= 1) return true
  if (m.roles.includes('wc2') && comp.winConditions.length === 0 && need !== 'offense')
    return true
  if (scores.airDefense < 6) {
    const nonSpellAir = comp.airDefense.filter(
      (key) => getCard(key)?.type !== 'Spell',
    )
    if (nonSpellAir.length <= 1 && comp.airDefense.includes(card.key)) return true
  }
  if (scores.spellUtility < 6 && card.type === 'Spell') {
    const total = comp.smallSpells.length + comp.bigSpells.length
    if (total <= 1) return true
  }
  return false
}

const NEED_HINT: Record<Need, string> = {
  offense: 'Adds a real damage threat so the deck can take a tower on its own terms.',
  defense: 'Gives you a stable answer to committed pushes without bleeding elixir.',
  airDefense: 'Adds a dedicated air answer so LavaLoon and Balloon do not snowball.',
  cycle: 'Lowers the average cost so you rotate back to your win condition faster.',
  spellUtility: 'Covers the missing spell role and makes chip / punish damage cheaper.',
}

function buildSwaps(
  cards: RawCard[],
  scores: DeckScores,
  comp: Composition,
): SwapSuggestion[] {
  const deck = new Set(cards.map((card) => card.key))
  const needs = (Object.keys(NEED_THRESHOLD) as Need[]).filter(
    (need) => scores[need] < NEED_THRESHOLD[need],
  )
  if (!needs.length) return []

  const results: (SwapSuggestion & { value: number })[] = []

  for (const need of needs) {
    const candidates = candidatesFor(need, deck)
    for (const out of cards) {
      if (isProtected(need, out, comp, scores)) continue
      for (const candidate of candidates) {
        const next = cards
          .filter((card) => card.key !== out.key)
          .concat(getCard(candidate.key) as RawCard)
        if (next.length !== 8) continue
        const nextScores = scoreDeck(next)
        const gain = nextScores[need] - scores[need]
        if (gain < 0.8) continue
        const bleed = Math.max(0, scores.overall - nextScores.overall)
        const value = gain - bleed * 0.45 - Math.max(0, candidate.elixir - out.elixir) * 0.3
        if (value < 0.6) continue
        results.push({
          value,
          from: out.key,
          to: candidate.key,
          reason: NEED_HINT[need],
          gains: describeGain(need, out, getCard(candidate.key) as RawCard),
          tradeoffs: describeTradeoff(out, getCard(candidate.key) as RawCard),
          delta: {
            [need]: round1(gain),
            overall: round1(nextScores.overall - scores.overall),
          },
        })
      }
    }
  }

  results.sort((a, b) => b.value - a.value)
  const picked: typeof results = []
  const usedIn = new Set<string>()
  const usedOut = new Set<string>()
  for (const item of results) {
    if (usedIn.has(item.to) || usedOut.has(item.from)) continue
    picked.push(item)
    usedIn.add(item.to)
    usedOut.add(item.from)
    if (picked.length >= 3) break
  }
  return picked.map((item) => ({
    from: item.from,
    to: item.to,
    reason: item.reason,
    gains: item.gains,
    tradeoffs: item.tradeoffs,
    delta: item.delta,
  }))
}

function describeGain(need: Need, out: RawCard, into: RawCard): string[] {
  const gains: string[] = []
  const m = combatOf(into.key)
  const outM = combatOf(out.key)
  switch (need) {
    case 'airDefense':
      if (m.air) gains.push(`Hits air (replaces a ground-only card)`)
      if (m.dps >= 2) gains.push(`DPS tier ${m.dps} vs air tanks`)
      break
    case 'offense':
      if (m.roles.includes('wc') || m.roles.includes('wc2'))
        gains.push('Adds a genuine tower threat')
      if (m.roles.includes('support')) gains.push('Supports the win condition on a push')
      break
    case 'defense':
      if (m.roles.includes('tankKiller') || m.dps >= 3)
        gains.push('Shreds high-HP tanks')
      if (m.roles.includes('splash')) gains.push('Clears swarm pushes')
      if (into.type === 'Building') gains.push('Pulls bridge threats to the centre')
      break
    case 'cycle':
      gains.push(`${into.elixir} elixir (was ${out.elixir})`)
      if (into.elixir <= 2) gains.push('Rotates your win condition back sooner')
      break
    case 'spellUtility':
      if (SMALL_SPELLS.has(into.key)) gains.push('Cheap swarm / chip clear')
      if (BIG_SPELLS.has(into.key)) gains.push('Finishes low towers and deletes back-line')
      break
  }
  if (m.roles.includes('reset') && !outM.roles.includes('reset'))
    gains.push('Resets Inferno Dragon / Tower and Sparky')
  if (!gains.length) gains.push('Fills the gap this deck is missing')
  return gains
}

function describeTradeoff(out: RawCard, into: RawCard): string[] {
  const outM = combatOf(out.key)
  const inM = combatOf(into.key)
  const tradeoffs: string[] = []
  if (into.elixir > out.elixir)
    tradeoffs.push(`Costs ${into.elixir - out.elixir} more elixir`)
  if (outM.dps > inM.dps) tradeoffs.push('Lower single-target dps')
  if (outM.fly && !inM.fly) tradeoffs.push('Loses a flying body for distraction')
  if (outM.roles.includes('swarm') && !inM.roles.includes('swarm'))
    tradeoffs.push('Less cheap distraction for single-target attackers')
  if (out.type === 'Building' && into.type !== 'Building')
    tradeoffs.push('Loses the building pull')
  if (!tradeoffs.length) tradeoffs.push('Changes your defensive rotation timing')
  return tradeoffs
}

function buildCostCurve(cards: RawCard[]): CostBucket[] {
  const buckets = new Map<number, number>()
  for (const card of cards) {
    const bucket = Math.min(9, Math.max(1, card.elixir))
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
  }
  // Cards cost 1..9 elixir. Bucketing from 0 left the first bar permanently
  // empty and folded everything from 8 upwards into the 7 bar.
  return Array.from({ length: 9 }, (_unused, index) => {
    const elixir = index + 1
    return {
      elixir,
      label: String(elixir),
      count: buckets.get(elixir) ?? 0,
    }
  })
}

export function analyzeDeck(keys: string[]): DeckAnalysis {
  const cards = resolveDeck(keys)
  const scores = scoreDeck(cards)
  const composition = buildComposition(cards)
  const { archetype, proxy, confidence, runnerUp } = detectArchetype(
    cards.map((card) => card.key),
  )
  const archetypeData = getArchetype(archetype.key)

  return {
    cards: cards.map((card) => card.key),
    avgElixir: round1(avgElixir(cards)),
    archetype: archetype.key,
    archetypeLabel: archetypeData?.label ?? archetype.label,
    archetypeBlurb:
      archetype.key === 'hybrid' && proxy.key !== 'hybrid'
        ? `${archetype.blurb} Projected from the closest profile: ${proxy.label}.`
        : archetype.blurb,
    archetypeConfidence: Math.round(confidence * 100) / 100,
    runnerUp: runnerUp?.key,
    scores,
    composition,
    findings: buildFindings(cards, scores, composition),
    swaps: buildSwaps(cards, scores, composition),
    matchups: matchupMatrix(proxy.key, cards.map((card) => card.key)),
    costCurve: buildCostCurve(cards),
    valid: cards.length === 8,
  }
}

// ---------------------------------------------------------------------------
// Head to head matchup
// ---------------------------------------------------------------------------

export interface MatchupResult {
  offense: number
  defense: number
  cycle: number
  overall: number
  threats: string[]
  strategy: string[]
  verdict: 'favored' | 'even' | 'unfavored'
}

export function compareDecks(
  mineKeys: string[],
  theirsKeys: string[],
): MatchupResult {
  const mine = resolveDeck(mineKeys)
  const theirs = resolveDeck(theirsKeys)
  const a = scoreDeck(mine)
  const b = scoreDeck(theirs)

  const offense = clamp(Math.round(50 + (a.offense - b.defense) * 3.4), 18, 88)
  const defense = clamp(Math.round(50 + (a.defense - b.offense) * 3.4), 18, 88)
  const cycleEdge = clamp(Math.round(50 + (a.cycle - b.cycle) * 3), 18, 88)
  const spellEdge = (a.spellUtility - b.spellUtility) * 1.2
  const airEdge = (a.airDefense - b.airDefense) * 1.4
  const overall = clamp(
    Math.round((offense + defense + cycleEdge) / 3 + spellEdge + airEdge),
    15,
    90,
  )

  const threats = theirs
    .filter((card) => {
      const m = combatOf(card.key)
      return (
        m.roles.includes('wc') ||
        m.roles.includes('wc2') ||
        m.roles.includes('tankKiller') ||
        m.dps >= 3
      )
    })
    .map((card) => card.name)
    .slice(0, 4)

  const strategy: string[] = []
  const theirComp = buildComposition(theirs)
  const myComp = buildComposition(mine)

  if (theirComp.winConditions.includes('x-bow') || theirComp.winConditions.includes('mortar'))
    strategy.push(
      'Never commit your win condition into their building - punish the opposite lane while it is down.',
    )
  if (b.cycle > a.cycle + 1)
    strategy.push(
      'They out-cycle you: hold your key counter in hand and do not spend it on chip damage.',
    )
  if (a.airDefense < 6)
    strategy.push(
      'Your air answers are thin - save the air-targeting card for their main threat instead of using it on the first push.',
    )
  if (theirComp.bigSpells.length && myComp.buildings.length)
    strategy.push(
      'They run a big spell, so do not stack your building with a support troop in the same radius.',
    )
  if (theirComp.smallSpells.length === 0 && myComp.buildings.length)
    strategy.push(
      'They struggle with swarms - punish every tank they play with cheap ground units in the other lane.',
    )
  if (theirs.some((card) => card.key === 'golem' || card.key === 'giant' || card.key === 'lava-hound'))
    strategy.push(
      'Do not overcommit early - leak the first tank and counter-push instead of defending at a negative elixir trade.',
    )
  if (mine.some((card) => card.key === 'x-bow') && theirs.some((card) => BIG_SPELLS.has(card.key)))
    strategy.push(
      'Their big spell melts your siege building - only lock when they are at low elixir.',
    )
  if (strategy.length < 3)
    strategy.push(
      'Win the elixir trade in the first minute, then apply pressure in the lane they are defending weakest.',
    )

  return {
    offense,
    defense,
    cycle: cycleEdge,
    overall,
    threats,
    strategy: strategy.slice(0, 5),
    verdict: overall >= 55 ? 'favored' : overall <= 45 ? 'unfavored' : 'even',
  }
}

export { round1 }
