import type { DeckAnalysis } from './analysis'
import { combatOf, getCard } from './cards'

/**
 * The structural read of a deck: one row per role the analysis model knows
 * about, plus the strengths / weaknesses it has already derived from real
 * score thresholds. Every number here comes from the existing card metadata
 * (`combatOf`, rarity, elixir) and `analyzeDeck` — nothing is estimated.
 *
 * Evolution and Hero (Champion) rows are honest about their sources: the
 * evolution row only reports what the battle sample actually recorded, and the
 * hero row uses the catalogue's Champion rarity, the only hero-class distinction
 * the dataset carries.
 */

export type RoleState = 'ok' | 'gap' | 'info' | 'unavailable'

export interface RoleRow {
  key: string
  label: string
  state: RoleState
  /** Short display value: a check, a count, or a level word. */
  value: string
  /** Names behind the row, or the explanation for a gap / unavailable row. */
  note?: string
}

export interface HeroInfo {
  champions: string[]
  count: number
  /** The game rule of one Champion per deck, not a dataset statistic. */
  max: number
}

export interface EvolutionInfo {
  /** False when the sample recorded no evolution data at all. */
  recorded: boolean
  /** Cards observed played in evolved form across the sample. */
  evolvable: string[]
  /** Of this deck's cards, which the sample has seen evolved. */
  inDeck: string[]
}

export interface DeckStructure {
  /** Deck score (0-10) on a 0-100 scale — the same value, rescaled. */
  health: number
  rows: RoleRow[]
  /** Labels of the rows currently marked as gaps. */
  gaps: string[]
  strengths: string[]
  weaknesses: string[]
  hero: HeroInfo
  evolution: EvolutionInfo
}

export interface StructureOptions {
  /** The snapshot's observed-evolution list; omit when the source reports none. */
  evolvable?: string[]
}

const names = (keys: string[]) =>
  keys.map((key) => getCard(key)?.name ?? key).join(', ')

export function deckStructure(
  analysis: DeckAnalysis,
  options: StructureOptions = {},
): DeckStructure {
  const cards = analysis.cards
  const comp = analysis.composition
  const roles = (key: string) => combatOf(key).roles
  const count = (fn: (key: string) => boolean) => cards.filter(fn).length

  const wc2 = count((key) => roles(key).includes('wc2'))
  const tanks = count((key) => roles(key).includes('tank'))
  const supports = count(
    (key) => roles(key).includes('support') || roles(key).includes('dps'),
  )
  const groundDefenders = count((key) => {
    const card = getCard(key)
    if (!card || card.type === 'Spell') return false
    const m = combatOf(key)
    return (
      m.roles.includes('tank') ||
      m.roles.includes('tankKiller') ||
      m.roles.includes('splash') ||
      m.roles.includes('swarm') ||
      card.type === 'Building'
    )
  })
  const controlCards = count((key) => {
    const card = getCard(key)
    return (
      card?.type === 'Building' ||
      roles(key).includes('utility') ||
      roles(key).includes('reset') ||
      roles(key).includes('spawn')
    )
  })
  const utilityCards = count((key) => {
    const card = getCard(key)
    return (
      card?.type === 'Spell' ||
      roles(key).includes('utility') ||
      roles(key).includes('reset') ||
      roles(key).includes('heal')
    )
  })
  const champions = cards.filter((key) => getCard(key)?.rarity === 'Champion')

  const ok = (value: boolean): RoleState => (value ? 'ok' : 'gap')

  const rows: RoleRow[] = [
    {
      key: 'win-condition',
      label: 'Win Condition',
      state: ok(comp.winConditions.length >= 1),
      value: comp.winConditions.length >= 1 ? '✓' : '⚠',
      note: comp.winConditions.length
        ? names(comp.winConditions)
        : 'Nothing reliably takes a tower',
    },
    {
      key: 'win-condition-2',
      label: 'Secondary Win Condition',
      state: ok(wc2 >= 1 || comp.winConditions.length >= 2),
      value: wc2 >= 1 || comp.winConditions.length >= 2 ? '✓' : '⚠',
      note:
        wc2 >= 1 || comp.winConditions.length >= 2
          ? 'A second way to pressure the tower'
          : 'One push failing leaves no backup plan',
    },
    {
      key: 'tank',
      label: 'Tank',
      state: ok(tanks >= 1),
      value: tanks >= 1 ? '✓' : '⚠',
      note: tanks >= 1 ? `${tanks} in deck` : 'No unit to soak damage on pushes',
    },
    {
      key: 'support',
      label: 'Support',
      state: ok(supports >= 2),
      value: supports >= 2 ? '✓' : '⚠',
      note: `${supports} support / dps card(s)`,
    },
    {
      key: 'air-defense',
      label: 'Air Defense',
      state: ok(comp.airDefense.length >= 2),
      value: comp.airDefense.length >= 2 ? '✓' : '⚠',
      note: comp.airDefense.length
        ? names(comp.airDefense)
        : 'No dedicated answer to air pushes',
    },
    {
      key: 'ground-defense',
      label: 'Ground Defense',
      state: ok(groundDefenders >= 2),
      value: groundDefenders >= 2 ? '✓' : '⚠',
      note: `${groundDefenders} ground stopper(s)`,
    },
    {
      key: 'building',
      label: 'Building',
      state: ok(comp.buildings.length >= 1),
      value: comp.buildings.length >= 1 ? '✓' : '⚠',
      note: comp.buildings.length
        ? names(comp.buildings)
        : 'No building to pull win conditions to the centre',
    },
    {
      key: 'small-spell',
      label: 'Small Spell',
      state: ok(comp.smallSpells.length >= 1),
      value: comp.smallSpells.length >= 1 ? '✓' : '⚠',
      note: comp.smallSpells.length
        ? names(comp.smallSpells)
        : 'Nothing cheap for swarms and chip damage',
    },
    {
      key: 'big-spell',
      label: 'Big Spell',
      state: ok(comp.bigSpells.length >= 1),
      value: comp.bigSpells.length >= 1 ? '✓' : '⚠',
      note: comp.bigSpells.length
        ? names(comp.bigSpells)
        : 'No spell to finish a tower or delete back-line',
    },
    {
      key: 'cycle',
      label: 'Cycle',
      state: analysis.scores.cycle >= 5.5 ? 'ok' : 'gap',
      value:
        analysis.scores.cycle >= 7.5
          ? 'Strong'
          : analysis.scores.cycle >= 5.5
            ? 'OK'
            : 'Weak',
      note: `${comp.cycleCards.length} card(s) at 2 elixir or less · cycle score ${analysis.scores.cycle}/10`,
    },
    {
      key: 'control',
      label: 'Control',
      state: ok(controlCards >= 2),
      value: controlCards >= 2 ? '✓' : '⚠',
      note: `${controlCards} control tool(s) (buildings, utility, reset, spawners)`,
    },
    {
      key: 'pressure',
      label: 'Pressure',
      state: ok(comp.winConditions.length >= 1),
      value:
        comp.winConditions.length === 0
          ? 'None'
          : comp.cycleCards.length >= 2
            ? 'High'
            : 'Moderate',
      note:
        comp.winConditions.length === 0
          ? 'Without a win condition there is no pressure'
          : comp.cycleCards.length >= 2
            ? 'Cheap rotation keeps the win condition coming back'
            : 'Steady pressure, slower rotation',
    },
    {
      key: 'utility',
      label: 'Utility',
      state: ok(utilityCards >= 2),
      value: utilityCards >= 2 ? '✓' : '⚠',
      note: `${utilityCards} utility card(s) (spells, reset, heal)`,
    },
    (() => {
      if (!options.evolvable) {
        return {
          key: 'evolution',
          label: 'Evolution',
          state: 'unavailable' as const,
          value: '—',
          note: 'Evolution data unavailable — this sample does not report evolutions.',
        }
      }
      const inDeck = cards.filter((key) => options.evolvable?.includes(key))
      return {
        key: 'evolution',
        label: 'Evolution',
        state: (inDeck.length ? 'ok' : 'info') as RoleState,
        value: String(inDeck.length),
        note: inDeck.length
          ? `Observed evolved in sample: ${names(inDeck)}`
          : `Sample tracks evolutions, but none of these cards appear evolved in it`,
      }
    })(),
    {
      key: 'hero',
      label: 'Hero (Champion)',
      state: champions.length <= 1 ? 'ok' : 'gap',
      value: `${champions.length} / 1`,
      note: champions.length ? names(champions) : 'No Champion (hero-class) card carried',
    },
  ]

  return {
    health: Math.round(analysis.scores.overall * 10),
    rows,
    gaps: rows.filter((row) => row.state === 'gap').map((row) => row.label),
    strengths: analysis.findings
      .filter((finding) => finding.severity === 'good')
      .map((finding) => finding.title),
    weaknesses: analysis.findings
      .filter((finding) => finding.severity !== 'good')
      .map((finding) => finding.title),
    hero: { champions, count: champions.length, max: 1 },
    evolution: {
      recorded: Boolean(options.evolvable),
      evolvable: options.evolvable ?? [],
      inDeck: cards.filter((key) => options.evolvable?.includes(key)),
    },
  }
}
