export type CardRole =
  | 'wc'
  | 'wc2'
  | 'tank'
  | 'tankKiller'
  | 'dps'
  | 'splash'
  | 'swarm'
  | 'support'
  | 'spell'
  | 'building'
  | 'cycle'
  | 'utility'
  | 'spawn'
  | 'heal'
  | 'reset'
  | 'pump'

export interface CardCombat {
  roles: CardRole[]
  /** Can deal damage to air units. */
  air: boolean
  /** Unit itself flies (needs an air-targeting counter). */
  fly: boolean
  /** Deals area / splash damage. */
  aoe: boolean
  /** Single-target DPS tier versus tanks, 0-3. */
  dps: 0 | 1 | 2 | 3
}

export const ROLE_LABEL: Record<CardRole, string> = {
  wc: 'Win Condition',
  wc2: 'Secondary Win Condition',
  tank: 'Tank',
  tankKiller: 'Tank Killer',
  dps: 'DPS',
  splash: 'Splash',
  swarm: 'Swarm',
  support: 'Support',
  spell: 'Spell',
  building: 'Building',
  cycle: 'Cycle',
  utility: 'Utility',
  spawn: 'Spawner',
  heal: 'Heal',
  reset: 'Reset',
  pump: 'Elixir',
}

const c = (
  roles: CardRole[],
  air: boolean,
  fly: boolean,
  aoe: boolean,
  dps: 0 | 1 | 2 | 3,
): CardCombat => ({ roles, air, fly, aoe, dps })

export const CARD_COMBAT: Record<string, CardCombat> = {
  knight: c(['tank', 'dps'], false, false, false, 2),
  archers: c(['support', 'dps'], true, false, false, 1),
  goblins: c(['swarm', 'dps', 'cycle'], false, false, false, 1),
  giant: c(['wc', 'tank'], false, false, false, 1),
  pekka: c(['tank', 'tankKiller'], false, false, false, 3),
  minions: c(['swarm', 'dps'], true, true, false, 1),
  balloon: c(['wc'], false, true, false, 2),
  witch: c(['support', 'splash', 'spawn'], true, false, true, 1),
  barbarians: c(['swarm', 'dps'], false, false, false, 2),
  golem: c(['wc', 'tank'], false, false, false, 1),
  skeletons: c(['swarm', 'cycle'], false, false, false, 1),
  valkyrie: c(['tank', 'splash', 'dps'], false, false, true, 2),
  'skeleton-army': c(['swarm'], false, false, false, 1),
  bomber: c(['splash', 'support', 'cycle'], false, false, true, 1),
  musketeer: c(['support', 'dps'], true, false, false, 2),
  'baby-dragon': c(['support', 'splash'], true, true, true, 1),
  prince: c(['dps', 'tankKiller'], false, false, false, 3),
  wizard: c(['support', 'splash'], true, false, true, 2),
  'mini-pekka': c(['tankKiller', 'dps'], false, false, false, 3),
  'spear-goblins': c(['support', 'cycle'], true, false, false, 1),
  'giant-skeleton': c(['tank', 'splash'], false, false, true, 1),
  'hog-rider': c(['wc'], false, false, false, 2),
  'minion-horde': c(['swarm', 'dps'], true, true, false, 1),
  'ice-wizard': c(['support', 'splash'], true, false, true, 1),
  'royal-giant': c(['wc'], false, false, false, 2),
  guards: c(['swarm', 'dps'], false, false, false, 1),
  princess: c(['splash', 'support', 'cycle'], false, false, true, 0),
  'dark-prince': c(['dps', 'splash'], false, false, true, 2),
  'three-musketeers': c(['support', 'dps'], true, false, false, 3),
  'lava-hound': c(['wc', 'tank'], false, true, false, 0),
  'ice-spirit': c(['cycle', 'utility'], true, false, true, 0),
  'fire-spirit': c(['cycle', 'splash'], true, false, true, 1),
  miner: c(['wc2', 'utility'], false, false, false, 1),
  sparky: c(['tankKiller', 'splash'], false, false, true, 3),
  bowler: c(['tank', 'splash', 'support'], false, false, true, 1),
  lumberjack: c(['dps', 'utility'], false, false, false, 2),
  'battle-ram': c(['wc2', 'dps'], false, false, false, 2),
  'inferno-dragon': c(['tankKiller'], true, true, false, 3),
  'ice-golem': c(['tank', 'cycle', 'utility'], false, false, false, 0),
  'mega-minion': c(['dps', 'support'], true, true, false, 2),
  'dart-goblin': c(['support', 'dps', 'cycle'], true, false, false, 1),
  'goblin-gang': c(['swarm', 'dps'], true, false, false, 1),
  'electro-wizard': c(['support', 'reset', 'dps'], true, false, false, 2),
  'elite-barbarians': c(['dps', 'tankKiller'], false, false, false, 3),
  hunter: c(['tankKiller', 'dps'], true, false, false, 3),
  executioner: c(['support', 'splash'], true, false, true, 1),
  bandit: c(['dps', 'utility'], false, false, false, 2),
  'royal-recruits': c(['tank', 'swarm'], false, false, false, 1),
  'night-witch': c(['support', 'spawn', 'dps'], false, false, false, 2),
  bats: c(['swarm', 'dps', 'cycle'], true, true, false, 1),
  'royal-ghost': c(['dps', 'utility'], false, false, false, 2),
  'ram-rider': c(['wc2', 'dps'], false, false, false, 2),
  zappies: c(['swarm', 'reset', 'support'], true, false, false, 1),
  rascals: c(['swarm', 'support'], true, false, false, 1),
  'cannon-cart': c(['dps'], false, false, false, 2),
  'mega-knight': c(['tank', 'splash', 'dps'], false, false, true, 2),
  'skeleton-barrel': c(['wc2', 'swarm'], true, true, false, 1),
  'flying-machine': c(['support', 'dps'], true, true, false, 2),
  'wall-breakers': c(['wc', 'cycle'], false, false, true, 0),
  'royal-hogs': c(['wc', 'swarm'], false, false, false, 2),
  'goblin-giant': c(['wc2', 'tank'], false, false, false, 1),
  fisherman: c(['utility', 'support'], false, false, false, 1),
  'magic-archer': c(['support', 'splash'], false, false, true, 1),
  'electro-dragon': c(['support', 'splash', 'reset'], true, true, true, 1),
  firecracker: c(['support', 'splash', 'cycle'], true, false, true, 1),
  'mighty-miner': c(['tankKiller', 'dps'], false, false, false, 3),
  'super-witch': c(['support', 'splash', 'spawn'], true, false, true, 1),
  'elixir-golem': c(['tank'], false, false, false, 1),
  'battle-healer': c(['support', 'heal'], false, false, false, 1),
  'skeleton-king': c(['tank', 'spawn', 'dps'], false, false, false, 2),
  'super-lava-hound': c(['wc', 'tank'], false, true, false, 0),
  'super-magic-archer': c(['support', 'splash'], false, false, true, 1),
  'archer-queen': c(['support', 'dps'], true, false, false, 3),
  'santa-hog-rider': c(['wc'], false, false, false, 2),
  'golden-knight': c(['dps', 'utility'], false, false, false, 2),
  'super-ice-golem': c(['tank', 'cycle', 'utility'], false, false, false, 0),
  monk: c(['tank', 'utility', 'dps'], false, false, false, 2),
  'super-archers': c(['support', 'dps'], true, false, false, 2),
  'skeleton-dragons': c(['support', 'splash'], true, true, true, 1),
  terry: c(['dps', 'support'], false, false, false, 2),
  'super-mini-pekka': c(['tankKiller', 'dps'], false, false, false, 3),
  'mother-witch': c(['support', 'utility', 'spawn'], false, false, false, 1),
  'electro-spirit': c(['cycle', 'reset', 'splash'], true, false, true, 1),
  'electro-giant': c(['wc2', 'tank', 'reset'], false, false, true, 1),
  'raging-prince': c(['dps', 'tankKiller'], false, false, false, 3),
  phoenix: c(['dps', 'support'], true, true, false, 2),

  cannon: c(['building', 'cycle'], false, false, false, 2),
  'goblin-hut': c(['building', 'spawn'], true, false, false, 1),
  mortar: c(['building', 'wc', 'splash'], false, false, true, 1),
  'inferno-tower': c(['building', 'tankKiller'], true, false, false, 3),
  'bomb-tower': c(['building', 'splash'], false, false, true, 1),
  'barbarian-hut': c(['building', 'spawn'], false, false, false, 1),
  tesla: c(['building', 'cycle'], true, false, false, 2),
  'elixir-collector': c(['building', 'pump'], false, false, false, 0),
  'x-bow': c(['building', 'wc'], true, false, false, 2),
  tombstone: c(['building', 'spawn'], false, false, false, 1),
  furnace: c(['building', 'spawn', 'splash'], true, false, true, 1),
  'goblin-cage': c(['building', 'spawn'], false, false, false, 2),
  'goblin-drill': c(['building', 'wc'], false, false, true, 1),
  'party-hut': c(['building', 'spawn'], true, false, false, 1),

  fireball: c(['spell', 'splash'], true, false, true, 2),
  arrows: c(['spell', 'splash', 'cycle'], true, false, true, 1),
  rage: c(['spell', 'utility'], false, false, false, 0),
  rocket: c(['spell', 'splash', 'wc'], true, false, true, 3),
  'goblin-barrel': c(['spell', 'wc'], false, false, false, 1),
  freeze: c(['spell', 'utility'], true, false, false, 0),
  mirror: c(['spell', 'utility'], false, false, false, 0),
  lightning: c(['spell', 'splash', 'reset', 'tankKiller'], true, false, true, 3),
  zap: c(['spell', 'splash', 'cycle', 'reset'], true, false, true, 1),
  poison: c(['spell', 'splash', 'utility'], true, false, true, 1),
  graveyard: c(['spell', 'wc'], false, false, false, 1),
  'the-log': c(['spell', 'splash', 'cycle'], false, false, true, 1),
  tornado: c(['spell', 'utility'], true, false, true, 0),
  clone: c(['spell', 'utility'], true, false, false, 0),
  earthquake: c(['spell', 'splash'], false, false, true, 0),
  'barbarian-barrel': c(['spell', 'cycle', 'spawn'], false, false, true, 1),
  'heal-spirit': c(['heal', 'cycle'], false, false, false, 0),
  'giant-snowball': c(['spell', 'splash', 'cycle'], true, false, true, 1),
  'royal-delivery': c(['spell', 'spawn'], false, false, true, 1),
  'party-rocket': c(['spell', 'splash'], true, false, true, 2),

  void: c(['spell', 'splash'], true, false, true, 1),
  'goblin-curse': c(['spell', 'utility'], true, false, true, 0),
  vines: c(['spell'], true, false, false, 0),
}

/** Cards that should never be proposed as a replacement. */
export const EXCLUDED_SWAPS = new Set([
  'clone',
  'mirror',
  'party-hut',
  'party-rocket',
  'santa-hog-rider',
  'super-witch',
  'super-lava-hound',
  'super-magic-archer',
  'super-ice-golem',
  'super-archers',
  'super-mini-pekka',
  'elixir-collector',
])

export const SMALL_SPELLS = new Set([
  'zap',
  'the-log',
  'arrows',
  'giant-snowball',
  'barbarian-barrel',
  'royal-delivery',
])

export const BIG_SPELLS = new Set([
  'fireball',
  'poison',
  'rocket',
  'lightning',
  'earthquake',
])
