import { detectArchetype, matchupMatrix } from './archetypes'
import { aggregateMeta, type MetaSnapshot, type NormalizedBattle } from './battle'

export interface DemoDeckTemplate {
  id: string
  label: string
  cards: string[]
  weight: number
}

export const DEMO_DECKS: DemoDeckTemplate[] = [
  {
    id: 'xbow-cycle',
    label: 'X-Bow Cycle',
    weight: 1.1,
    cards: ['x-bow', 'tesla', 'archers', 'knight', 'fireball', 'the-log', 'skeletons', 'ice-spirit'],
  },
  {
    id: 'hog-26',
    label: 'Hog 2.6',
    weight: 1.4,
    cards: ['hog-rider', 'musketeer', 'cannon', 'skeletons', 'ice-spirit', 'the-log', 'ice-golem', 'fireball'],
  },
  {
    id: 'log-bait',
    label: 'Log Bait',
    weight: 1.2,
    cards: ['goblin-barrel', 'princess', 'goblin-gang', 'knight', 'inferno-tower', 'rocket', 'the-log', 'ice-spirit'],
  },
  {
    id: 'golem-beatdown',
    label: 'Golem Beatdown',
    weight: 0.9,
    cards: ['golem', 'night-witch', 'baby-dragon', 'mega-minion', 'tornado', 'lightning', 'barbarian-barrel', 'dark-prince'],
  },
  {
    id: 'lavaloon',
    label: 'LavaLoon',
    weight: 0.95,
    cards: ['lava-hound', 'balloon', 'tombstone', 'mega-minion', 'fireball', 'zap', 'phoenix', 'guards'],
  },
  {
    id: 'bridge-spam',
    label: 'Bridge Spam',
    weight: 1.05,
    cards: ['bandit', 'battle-ram', 'magic-archer', 'dark-prince', 'electro-wizard', 'poison', 'royal-ghost', 'zappies'],
  },
  {
    id: 'graveyard-control',
    label: 'Graveyard Control',
    weight: 1,
    cards: ['graveyard', 'poison', 'knight', 'ice-wizard', 'tombstone', 'baby-dragon', 'barbarian-barrel', 'tornado'],
  },
  {
    id: 'royal-giant',
    label: 'Royal Giant',
    weight: 1.1,
    cards: ['royal-giant', 'fisherman', 'flying-machine', 'zappies', 'heal-spirit', 'earthquake', 'the-log', 'hunter'],
  },
  {
    id: 'mortar-cycle',
    label: 'Mortar Cycle',
    weight: 0.85,
    cards: ['mortar', 'the-log', 'archers', 'skeletons', 'ice-spirit', 'miner', 'fireball', 'knight'],
  },
  {
    id: 'goblin-drill',
    label: 'Goblin Drill',
    weight: 0.9,
    cards: ['goblin-drill', 'wall-breakers', 'fireball', 'the-log', 'tesla', 'bomber', 'dart-goblin', 'electro-spirit'],
  },
  {
    id: 'pekka-bridge-spam',
    label: 'P.E.K.K.A Bridge Spam',
    weight: 0.9,
    cards: ['pekka', 'battle-ram', 'bandit', 'electro-wizard', 'magic-archer', 'poison', 'royal-ghost', 'the-log'],
  },
  {
    id: 'giant-beatdown',
    label: 'Giant Beatdown',
    weight: 0.8,
    cards: ['giant', 'dark-prince', 'mega-minion', 'night-witch', 'lightning', 'tornado', 'barbarian-barrel', 'skeleton-dragons'],
  },
  {
    id: 'miner-wallbreakers',
    label: 'Miner Wall Breakers',
    weight: 0.85,
    cards: ['miner', 'wall-breakers', 'skeletons', 'knight', 'archers', 'the-log', 'fireball', 'tesla'],
  },
  {
    id: 'electric-giant',
    label: 'Electro Giant',
    weight: 0.75,
    cards: ['electro-giant', 'tornado', 'lightning', 'baby-dragon', 'mega-minion', 'barbarian-barrel', 'witch', 'cannon-cart'],
  },
]

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const OPPONENT_NAMES = [
  'MuyLynx',
  'ChiefJules',
  'NovaBite',
  'GrindMode',
  'PekkaPam',
  'TorreRoja',
  'ZapQueen',
  'CycleKing',
  'GolemGod',
  'BalloonBoy',
  'LogSpammer',
  'ArenaAce',
  'RushHour',
  'SparkyFan',
  'HogWild',
]

function weightedPick<T extends { weight: number }>(items: T[], random: () => number): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let roll = random() * total
  for (const item of items) {
    roll -= item.weight
    if (roll <= 0) return item
  }
  return items[items.length - 1]
}

function projectedWinRate(myDeck: string[], theirDeck: string[]): number {
  const line = matchupMatrix(detectArchetype(myDeck).proxy.key, myDeck).find(
    (entry) => entry.key === detectArchetype(theirDeck).proxy.key,
  )
  return line?.score ?? 50
}

function makeBattle(
  teamDeck: string[],
  opponent: DemoDeckTemplate,
  index: number,
  hoursAgo: number,
  random: () => number,
): NormalizedBattle {
  const chance = projectedWinRate(teamDeck, opponent.cards)
  const roll = random() * 100
  const win = roll < chance
  const draw = !win && roll < chance + 3
  let crowns: number
  let them: number
  if (draw) {
    crowns = Math.floor(random() * 3)
    them = crowns
  } else if (win) {
    crowns = 1 + Math.floor(random() * 3)
    them = Math.floor(random() * crowns)
  } else {
    them = 1 + Math.floor(random() * 3)
    crowns = Math.floor(random() * them)
  }
  const time = new Date(Date.now() - hoursAgo * 3_600_000).toISOString()

  return {
    id: `demo-${index}`,
    time,
    type: index % 7 === 0 ? 'pathOfLegend' : 'ladder',
    result: draw ? 'draw' : win ? 'win' : 'loss',
    crowns: { us: crowns, them },
    deck: teamDeck,
    opponentDeck: opponent.cards,
    opponentName: OPPONENT_NAMES[Math.floor(random() * OPPONENT_NAMES.length)],
    opponentTag: `#DEMO${String(1000 + index).slice(-4)}`,
    arena: 'Ultimate Champion',
  }
}

let cachedBattles: NormalizedBattle[] | null = null

export function demoBattles(): NormalizedBattle[] {
  if (cachedBattles) return cachedBattles
  const random = mulberry32(20260930)
  const battles: NormalizedBattle[] = []

  for (let i = 0; i < 600; i += 1) {
    const team = weightedPick(DEMO_DECKS, random)
    const opponent = weightedPick(DEMO_DECKS, random)
    battles.push(
      makeBattle(team.cards, opponent, i, 2 + random() * 24 * 75, random),
    )
  }

  cachedBattles = battles
  return battles
}

export function demoMeta(): MetaSnapshot {
  return aggregateMeta(demoBattles(), { source: 'demo', players: 48 })
}
