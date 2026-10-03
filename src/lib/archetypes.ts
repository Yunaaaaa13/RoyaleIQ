/**
 * Every key an archetype table may name. Typing the two matchup lists with it
 * is what makes a typo like `'cycle'` a compile error instead of a silently
 * dead ±3 adjustment that never matches a real target key.
 */
export type ArchetypeKey =
  | 'siege'
  | 'log-bait'
  | 'beatdown'
  | 'lavaloon'
  | 'bridge-spam'
  | 'graveyard'
  | 'royal-giant'
  | 'hog-cycle'
  | 'goblin-drill'
  | 'control'
  | 'hybrid'

export interface Archetype {
  key: ArchetypeKey
  label: string
  blurb: string
  /** Any one of these cards must be in the deck for the archetype to apply. */
  requires: string[]
  /** Card key -> weight contributed to the match score. */
  signature: Record<string, number>
  /** Minimum weighted score required to claim the archetype. */
  threshold: number
  strongAgainst: ArchetypeKey[]
  weakAgainst: ArchetypeKey[]
}

export const ARCHETYPES: Archetype[] = [
  {
    key: 'siege',
    label: 'Siege',
    blurb: 'Wins by locking a building onto the enemy tower from your own side.',
    requires: ['x-bow', 'mortar'],
    signature: {
      'x-bow': 5,
      mortar: 5,
      tesla: 3,
      'the-log': 2,
      archers: 2,
      knight: 2,
      skeletons: 1.5,
      'ice-spirit': 1.5,
      fireball: 2,
    },
    threshold: 7,
    strongAgainst: ['log-bait', 'graveyard', 'control'],
    weakAgainst: ['beatdown', 'lavaloon', 'bridge-spam'],
  },
  {
    key: 'log-bait',
    label: 'Log Bait',
    requires: ['goblin-barrel'],
    blurb: 'Forces out The Log, then punishes with Goblin Barrel.',
    signature: {
      'goblin-barrel': 5,
      princess: 3,
      'goblin-gang': 3,
      'knight': 2,
      'inferno-tower': 2.5,
      rocket: 2.5,
      'the-log': 2,
      'dart-goblin': 1.5,
      'ice-spirit': 1,
      skeletons: 1,
      'goblins': 1.5,
    },
    threshold: 9,
    strongAgainst: ['beatdown', 'bridge-spam', 'control'],
    // Was `['log-bait-counter', 'cycle', 'graveyard']` - neither of the first
    // two is an archetype key, so neither ever matched a target and the
    // adjustment never fired. Both now name the decks the base matrix already
    // has Log Bait losing to.
    weakAgainst: ['siege', 'hog-cycle', 'graveyard'],
  },
  {
    key: 'beatdown',
    label: 'Beatdown',
    requires: ['golem', 'giant', 'electro-giant', 'elixir-golem', 'goblin-giant'],
    blurb: 'Builds a huge elixir push behind a high-HP tank in one lane.',
    signature: {
      golem: 6,
      giant: 5,
      'electro-giant': 5,
      'elixir-golem': 3.5,
      'goblin-giant': 4,
      'night-witch': 2.5,
      'baby-dragon': 2,
      'mega-minion': 2,
      lightning: 2.5,
      tornado: 2,
      'elixir-collector': 2,
      witch: 2,
      wizard: 1.5,
      'dark-prince': 1.5,
      'flying-machine': 1.5,
      'battle-healer': 1.5,
      'skeleton-dragons': 1.5,
      bowler: 1.5,
    },
    threshold: 7,
    strongAgainst: ['siege', 'log-bait', 'hog-cycle'],
    weakAgainst: ['control', 'graveyard', 'lavaloon'],
  },
  {
    key: 'lavaloon',
    label: 'LavaLoon',
    requires: ['lava-hound'],
    blurb: 'Air beatdown: Lava Hound soaks, Balloon connects.',
    signature: {
      'lava-hound': 6,
      balloon: 5,
      'super-lava-hound': 6,
      'tombstone': 2,
      'mega-minion': 2,
      'minions': 1.5,
      'fireball': 2,
      'zap': 2,
      'lightning': 2.5,
      'baby-dragon': 1.5,
      'guards': 1,
      'phoenix': 1.5,
      'skeleton-dragons': 1.5,
      'inferno-dragon': 1.5,
      'barbarians': 1,
    },
    threshold: 9,
    strongAgainst: ['siege', 'hog-cycle', 'control'],
    weakAgainst: ['beatdown', 'log-bait'],
  },
  {
    key: 'bridge-spam',
    label: 'Bridge Spam',
    requires: ['battle-ram', 'bandit', 'royal-ghost', 'ram-rider', 'royal-recruits', 'elite-barbarians'],
    blurb: 'Constant dual-lane pressure with fast, punishing troops.',
    signature: {
      bandit: 4,
      'battle-ram': 4,
      'royal-ghost': 3.5,
      'ram-rider': 3,
      'magic-archer': 2.5,
      'dark-prince': 2.5,
      'electro-wizard': 2,
      'poison': 2,
      'royal-recruits': 2.5,
      'elite-barbarians': 2,
      'inferno-dragon': 1.5,
      'fireball': 1.5,
      'zappies': 1.5,
      'cannon-cart': 1.5,
      'mother-witch': 1.5,
      'mighty-miner': 1.5,
      monk: 1.5,
      'golden-knight': 1.5,
    },
    threshold: 7,
    strongAgainst: ['siege', 'hog-cycle', 'lavaloon'],
    weakAgainst: ['log-bait', 'beatdown'],
  },
  {
    key: 'graveyard',
    label: 'Graveyard Control',
    requires: ['graveyard'],
    blurb: 'Slow control that ends with a Graveyard on a counter-push.',
    signature: {
      graveyard: 6,
      'poison': 3,
      'knight': 2,
      'ice-wizard': 2.5,
      'tombstone': 2,
      'baby-dragon': 1.5,
      'balloon': 1.5,
      'freeze': 2.5,
      'super-witch': 1.5,
      'night-witch': 1.5,
      'barbarian-barrel': 1.5,
      'tornado': 1.5,
      'valkyrie': 1.5,
      'flying-machine': 1.5,
    },
    threshold: 8,
    strongAgainst: ['beatdown', 'log-bait', 'siege'],
    // `cycle` here named no archetype, and the base matrix has Graveyard
    // favoured into Hog Cycle (56) - so unlike the other five the intended
    // adjustment cannot be restored without contradicting the matrix.
    weakAgainst: ['bridge-spam'],
  },
  {
    key: 'royal-giant',
    label: 'Royal Giant',
    requires: ['royal-giant'],
    blurb: 'Locks onto the tower from the bridge and chips it down.',
    signature: {
      'royal-giant': 6,
      'fisherman': 3,
      'flying-machine': 2,
      'zappies': 2,
      'heal-spirit': 1.5,
      'earthquake': 2,
      'fireball': 1.5,
      'the-log': 1.5,
      'elite-barbarians': 1.5,
      'mother-witch': 1.5,
      'golden-knight': 1.5,
      'mighty-miner': 1.5,
      'barbarians': 1,
      hunter: 1.5,
      'inferno-tower': 1,
    },
    threshold: 7,
    strongAgainst: ['siege', 'control', 'graveyard'],
    weakAgainst: ['beatdown', 'hog-cycle'],
  },
  {
    key: 'hog-cycle',
    label: 'Hog Cycle',
    requires: ['hog-rider'],
    blurb: 'Cheap, fast Hog Rider cycles that out-rotate your counters.',
    signature: {
      'hog-rider': 6,
      'santa-hog-rider': 6,
      'earthquake': 3,
      'the-log': 2,
      'fireball': 2,
      musketeer: 2,
      'mini-pekka': 2,
      valkyrie: 1.5,
      skeletons: 1.5,
      'ice-spirit': 1.5,
      'fire-spirit': 1,
      'cannon': 2,
      tesla: 1.5,
      'ice-golem': 1.5,
      knight: 1.5,
      'giant-snowball': 1.5,
      'royal-delivery': 1,
      'bomb-tower': 1,
      'electro-spirit': 1,
    },
    threshold: 8,
    strongAgainst: ['graveyard', 'royal-giant', 'log-bait'],
    weakAgainst: ['beatdown', 'control', 'lavaloon'],
  },
  {
    key: 'goblin-drill',
    label: 'Goblin Drill',
    requires: ['goblin-drill'],
    blurb: 'Underground pressure that spawns Goblins directly on the tower.',
    signature: {
      'goblin-drill': 6,
      'wall-breakers': 3,
      'fireball': 2.5,
      'the-log': 2,
      'tesla': 2,
      'bomber': 1.5,
      'dart-goblin': 1.5,
      'electro-spirit': 1,
      skeletons: 1,
      'magic-archer': 1.5,
      'super-archers': 1,
      'archers': 1,
    },
    threshold: 8,
    strongAgainst: ['siege', 'log-bait', 'control'],
    weakAgainst: ['beatdown', 'bridge-spam'],
  },
  {
    key: 'control',
    label: 'Control / Cycle',
    requires: [],
    blurb: 'Reactive defence, positive elixir trades, chip damage win.',
    signature: {
      'hog-rider': 1,
      tesla: 1.5,
      'cannon': 1,
      'inferno-tower': 1.5,
      'ice-spirit': 1.5,
      skeletons: 1.5,
      'the-log': 1.5,
      zap: 1.5,
      'fireball': 1,
      knight: 1.5,
      musketeer: 1.5,
      'mega-minion': 1.5,
      'ice-golem': 1,
      'royal-delivery': 1,
      'barbarian-barrel': 1,
      'giant-snowball': 1,
      'fisherman': 1,
      'royal-ghost': 1,
      'bandit': 1,
      'electro-wizard': 1,
      'firecracker': 1,
      'bomb-tower': 1,
      'tornado': 1,
      'flying-machine': 1,
    },
    threshold: 9,
    strongAgainst: ['beatdown', 'lavaloon'],
    weakAgainst: ['log-bait', 'bridge-spam', 'hog-cycle'],
  },
]

export interface MatchupLine {
  key: string
  label: string
  /** 0-100 projected win rate for your deck against this archetype. */
  score: number
  verdict: 'favored' | 'even' | 'unfavored'
}

const BASE_MATRIX: Record<string, number> = {
  'siege>beatdown': 38,
  'siege>lavaloon': 40,
  'siege>log-bait': 56,
  'siege>bridge-spam': 44,
  'siege>graveyard': 57,
  'siege>royal-giant': 50,
  'siege>hog-cycle': 50,
  'siege>goblin-drill': 52,
  'siege>control': 53,
  'log-bait>beatdown': 57,
  'log-bait>lavaloon': 55,
  'log-bait>siege': 44,
  'log-bait>bridge-spam': 56,
  'log-bait>graveyard': 46,
  'log-bait>royal-giant': 48,
  'log-bait>hog-cycle': 45,
  'log-bait>goblin-drill': 50,
  'log-bait>control': 54,
  'beatdown>siege': 62,
  'beatdown>lavaloon': 55,
  'beatdown>log-bait': 43,
  'beatdown>bridge-spam': 52,
  'beatdown>graveyard': 57,
  'beatdown>royal-giant': 55,
  'beatdown>hog-cycle': 55,
  'beatdown>goblin-drill': 54,
  'beatdown>control': 46,
  'lavaloon>siege': 60,
  'lavaloon>log-bait': 45,
  'lavaloon>beatdown': 45,
  'lavaloon>bridge-spam': 54,
  'lavaloon>graveyard': 47,
  'lavaloon>royal-giant': 46,
  'lavaloon>hog-cycle': 57,
  'lavaloon>goblin-drill': 55,
  'lavaloon>control': 44,
  'bridge-spam>siege': 56,
  'bridge-spam>log-bait': 44,
  'bridge-spam>beatdown': 48,
  'bridge-spam>lavaloon': 46,
  'bridge-spam>graveyard': 54,
  'bridge-spam>royal-giant': 52,
  'bridge-spam>hog-cycle': 53,
  'bridge-spam>goblin-drill': 50,
  'bridge-spam>control': 54,
  'graveyard>siege': 43,
  'graveyard>log-bait': 54,
  'graveyard>beatdown': 43,
  'graveyard>lavaloon': 53,
  'graveyard>bridge-spam': 46,
  'graveyard>royal-giant': 45,
  'graveyard>hog-cycle': 56,
  'graveyard>goblin-drill': 52,
  'graveyard>control': 51,
  'royal-giant>siege': 50,
  'royal-giant>log-bait': 52,
  'royal-giant>beatdown': 45,
  'royal-giant>lavaloon': 54,
  'royal-giant>bridge-spam': 48,
  'royal-giant>graveyard': 55,
  'royal-giant>hog-cycle': 46,
  'royal-giant>goblin-drill': 51,
  'royal-giant>control': 50,
  'hog-cycle>siege': 50,
  'hog-cycle>log-bait': 55,
  'hog-cycle>beatdown': 45,
  'hog-cycle>lavaloon': 43,
  'hog-cycle>bridge-spam': 47,
  'hog-cycle>graveyard': 44,
  'hog-cycle>royal-giant': 54,
  'hog-cycle>goblin-drill': 50,
  'hog-cycle>control': 50,
  'goblin-drill>siege': 48,
  'goblin-drill>log-bait': 50,
  'goblin-drill>beatdown': 46,
  'goblin-drill>lavaloon': 45,
  'goblin-drill>bridge-spam': 50,
  'goblin-drill>graveyard': 48,
  'goblin-drill>royal-giant': 49,
  'goblin-drill>hog-cycle': 50,
  'goblin-drill>control': 51,
  'control>siege': 47,
  'control>log-bait': 46,
  'control>beatdown': 54,
  'control>lavaloon': 56,
  'control>bridge-spam': 46,
  'control>graveyard': 49,
  'control>royal-giant': 50,
  'control>hog-cycle': 50,
  'control>goblin-drill': 49,
}

const HYBRID: Archetype = {
  key: 'hybrid',
  label: 'Hybrid / Off-Meta',
  blurb: 'Does not map cleanly onto a standard archetype profile.',
  requires: [],
  signature: {},
  threshold: 0,
  strongAgainst: [],
  weakAgainst: [],
}

export interface ArchetypeDetection {
  archetype: Archetype
  /**
   * Archetype profile used to project matchups. For hybrid decks this is the
   * closest qualified profile, so off-meta decks still get useful numbers.
   */
  proxy: Archetype
  confidence: number
  runnerUp?: Archetype
}

export function detectArchetype(deck: string[]): ArchetypeDetection {
  const scored = ARCHETYPES.map((archetype) => {
    let score = 0
    let possible = 0
    for (const [key, weight] of Object.entries(archetype.signature)) {
      possible += weight
      if (deck.includes(key)) score += weight
    }
    const hasCore =
      archetype.requires.length === 0 ||
      archetype.requires.some((key) => deck.includes(key))
    return { archetype, score, ratio: possible ? score / possible : 0, hasCore }
  })

  const ranked = [...scored]
    .filter((entry) => entry.hasCore)
    .sort((a, b) => b.score - a.score)
  const top = ranked[0]
  const second = ranked[1]

  if (!top || top.score < top.archetype.threshold) {
    const nearest =
      ranked.find((entry) => entry.score >= 5) ??
      [...scored].sort((a, b) => b.score - a.score).find((entry) => entry.score >= 5)
    return { archetype: HYBRID, proxy: nearest?.archetype ?? HYBRID, confidence: 0.35 }
  }

  const confidence = Math.min(
    0.97,
    0.45 + top.ratio * 0.6 + (top.score - (second?.score ?? 0)) * 0.03,
  )
  return {
    archetype: top.archetype,
    proxy: top.archetype,
    confidence,
    runnerUp:
      second && second.score >= second.archetype.threshold
        ? second.archetype
        : undefined,
  }
}

export function getArchetype(key: string): Archetype | undefined {
  return ARCHETYPES.find((a) => a.key === key)
}

export function archetypeLabel(key: string): string {
  return getArchetype(key)?.label ?? (key === 'hybrid' ? 'Hybrid / Off-Meta' : key)
}

export function matchupMatrix(
  from: string,
  deck: string[],
): MatchupLine[] {
  return ARCHETYPES.filter((target) => target.key !== from).map<MatchupLine>((target) => {
    const direct = BASE_MATRIX[`${from}>${target.key}`] ?? 50
    const own = getArchetype(from)
    let score = direct
    if (own?.strongAgainst.includes(target.key)) score += 3
    if (own?.weakAgainst.includes(target.key)) score -= 3
    const edge = deckEdgeAdjustment(deck, target)
    score = Math.round(Math.max(25, Math.min(75, score + edge)))
    return {
      key: target.key,
      label: target.label,
      score,
      verdict: score >= 54 ? 'favored' : score <= 46 ? 'unfavored' : 'even',
    }
  }).sort((a, b) => b.score - a.score)
}

function deckEdgeAdjustment(deck: string[], target: Archetype): number {
  let edge = 0
  const present = new Set(deck)
  if (target.key === 'lavaloon' || target.key === 'beatdown') {
    const counters = [
      'inferno-dragon',
      'inferno-tower',
      'mega-minion',
      'archers',
      'musketeer',
      'electro-wizard',
      'tesla',
      'hunter',
      'firecracker',
    ]
    edge += counters.filter((key) => present.has(key)).length * 0.8
    if (present.has('lightning') || present.has('rocket')) edge -= 2
  }
  if (target.key === 'log-bait') {
    if (present.has('the-log') || present.has('barbarian-barrel')) edge += 2
    if (present.has('rocket') || present.has('fireball')) edge += 1
    if (present.has('zap') && !present.has('the-log')) edge -= 1.5
  }
  if (target.key === 'bridge-spam') {
    if (present.has('tornado')) edge += 1
    if (present.has('pekka') || present.has('mini-pekka')) edge += 1.5
    if (present.has('goblin-barrel')) edge += 1
  }
  if (target.key === 'hog-cycle') {
    if (present.has('the-log') || present.has('zap')) edge += 0.5
    if (present.has('princess') || present.has('firecracker')) edge += 0.5
  }
  return edge
}
