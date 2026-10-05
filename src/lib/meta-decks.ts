/**
 * Curated meta-deck library.
 *
 * 113 proven competitive builds that extend the sampled snapshot, so
 * recommendations keep working even when the current sample holds few (or no)
 * complete deck signatures. `recommend.ts` scores every entry as a candidate,
 * uses them as completion donors, and counts their card pairs for synergy.
 *
 * Every entry obeys the game's deck-building rules, checked by
 * `scripts/validate-meta-decks.mjs`:
 *   - exactly 8 cards, all keys from the bundled card catalogue
 *   - no duplicate cards inside a deck, no duplicate decks in the library
 *   - at most 3 spells (win-condition spells like Goblin Barrel count) and
 *     at most 1 champion
 *   - at least one win condition (a card with the `wc` / `wc2` role)
 *
 * Library decks are never claimed as sampled results: they carry no win rate
 * or usage in the UI — performance is derived from per-card records and
 * labelled as such.
 */

export const META_DECKS: readonly (readonly string[])[] = [
  // --- Hog Cycle (11) -------------------------------------------------------
  ['hog-rider', 'musketeer', 'cannon', 'the-log', 'fireball', 'ice-golem', 'skeletons', 'ice-spirit'],
  ['hog-rider', 'earthquake', 'the-log', 'musketeer', 'cannon', 'skeletons', 'ice-spirit', 'knight'],
  ['hog-rider', 'earthquake', 'giant-snowball', 'firecracker', 'cannon', 'skeletons', 'ice-spirit', 'musketeer'],
  ['hog-rider', 'fireball', 'the-log', 'musketeer', 'bomb-tower', 'ice-golem', 'skeletons', 'ice-spirit'],
  ['hog-rider', 'royal-delivery', 'fireball', 'musketeer', 'cannon', 'skeletons', 'ice-spirit', 'knight'],
  ['hog-rider', 'mini-pekka', 'fireball', 'the-log', 'archers', 'skeletons', 'ice-spirit', 'ice-golem'],
  ['hog-rider', 'valkyrie', 'the-log', 'fireball', 'musketeer', 'cannon', 'skeletons', 'ice-spirit'],
  ['hog-rider', 'tesla', 'firecracker', 'earthquake', 'the-log', 'skeletons', 'ice-spirit', 'knight'],
  ['hog-rider', 'earthquake', 'the-log', 'musketeer', 'cannon', 'skeletons', 'ice-spirit', 'valkyrie'],
  ['hog-rider', 'goblin-gang', 'spear-goblins', 'the-log', 'fireball', 'mini-pekka', 'skeletons', 'ice-spirit'],
  ['hog-rider', 'rocket', 'the-log', 'musketeer', 'cannon', 'skeletons', 'ice-golem', 'ice-spirit'],

  // --- Beatdown (19) --------------------------------------------------------
  ['golem', 'night-witch', 'baby-dragon', 'mega-minion', 'lightning', 'tornado', 'elixir-collector', 'the-log'],
  ['golem', 'night-witch', 'witch', 'baby-dragon', 'mega-minion', 'lightning', 'tornado', 'the-log'],
  ['golem', 'elixir-collector', 'night-witch', 'baby-dragon', 'mega-minion', 'bomber', 'lightning', 'the-log'],
  ['golem', 'bomber', 'night-witch', 'mega-minion', 'flying-machine', 'lightning', 'tornado', 'the-log'],
  ['golem', 'bowler', 'night-witch', 'mega-minion', 'baby-dragon', 'lightning', 'tornado', 'the-log'],
  ['golem', 'night-witch', 'electro-wizard', 'mega-minion', 'baby-dragon', 'lightning', 'tornado', 'the-log'],
  ['golem', 'night-witch', 'guards', 'mega-minion', 'baby-dragon', 'lightning', 'barbarian-barrel', 'tornado'],
  ['golem', 'witch', 'skeleton-dragons', 'mega-minion', 'night-witch', 'lightning', 'tornado', 'the-log'],
  ['giant', 'prince', 'mega-minion', 'dark-prince', 'fireball', 'the-log', 'elixir-collector', 'archers'],
  ['giant', 'witch', 'mega-minion', 'wizard', 'fireball', 'the-log', 'skeletons', 'elixir-collector'],
  ['giant', 'mini-pekka', 'dark-prince', 'mega-minion', 'fireball', 'the-log', 'ice-spirit', 'elixir-collector'],
  ['giant', 'sparky', 'lumberjack', 'mega-minion', 'zap', 'fireball', 'dark-prince', 'bats'],
  ['electro-giant', 'night-witch', 'tornado', 'lightning', 'the-log', 'mega-minion', 'bomber', 'phoenix'],
  ['electro-giant', 'lightning', 'tornado', 'witch', 'baby-dragon', 'electro-spirit', 'mega-minion', 'the-log'],
  ['electro-giant', 'cannon-cart', 'lightning', 'tornado', 'bats', 'mega-minion', 'the-log', 'bomber'],
  ['golem', 'night-witch', 'witch', 'skeleton-dragons', 'mega-minion', 'lightning', 'barbarian-barrel', 'tornado'],
  ['giant', 'night-witch', 'mega-minion', 'dark-prince', 'fireball', 'the-log', 'elixir-collector', 'bats'],
  ['goblin-giant', 'sparky', 'night-witch', 'mega-minion', 'zap', 'fireball', 'spear-goblins', 'dark-prince'],
  ['goblin-giant', 'sparky', 'night-witch', 'mega-minion', 'skeleton-dragons', 'lightning', 'tornado', 'the-log'],

  // --- LavaLoon (10) --------------------------------------------------------
  ['lava-hound', 'balloon', 'tombstone', 'mega-minion', 'fireball', 'zap', 'phoenix', 'skeleton-dragons'],
  ['lava-hound', 'balloon', 'mega-minion', 'lightning', 'zap', 'phoenix', 'tombstone', 'guards'],
  ['lava-hound', 'balloon', 'barbarians', 'minions', 'fireball', 'zap', 'tombstone', 'mega-minion'],
  ['lava-hound', 'balloon', 'baby-dragon', 'mega-minion', 'lightning', 'zap', 'tombstone', 'inferno-dragon'],
  ['lava-hound', 'balloon', 'guards', 'mega-minion', 'fireball', 'zap', 'tombstone', 'phoenix'],
  ['lava-hound', 'balloon', 'skeleton-dragons', 'mega-minion', 'fireball', 'zap', 'tombstone', 'flying-machine'],
  ['lava-hound', 'balloon', 'minion-horde', 'minions', 'fireball', 'zap', 'tombstone', 'mega-minion'],
  ['lava-hound', 'balloon', 'mega-minion', 'tombstone', 'clone', 'zap', 'phoenix', 'bats'],
  ['lava-hound', 'balloon', 'baby-dragon', 'mega-minion', 'lightning', 'barbarian-barrel', 'tombstone', 'inferno-dragon'],
  ['lava-hound', 'balloon', 'lumberjack', 'tombstone', 'mega-minion', 'fireball', 'zap', 'phoenix'],

  // --- Log Bait (10) --------------------------------------------------------
  ['goblin-barrel', 'princess', 'goblin-gang', 'knight', 'inferno-tower', 'rocket', 'the-log', 'ice-spirit'],
  ['goblin-barrel', 'princess', 'goblin-gang', 'knight', 'inferno-tower', 'rocket', 'ice-spirit', 'skeletons'],
  ['goblin-barrel', 'dart-goblin', 'princess', 'goblin-gang', 'knight', 'inferno-tower', 'rocket', 'the-log'],
  ['goblin-barrel', 'goblins', 'spear-goblins', 'princess', 'knight', 'inferno-tower', 'rocket', 'the-log'],
  ['goblin-barrel', 'princess', 'goblin-gang', 'valkyrie', 'inferno-tower', 'rocket', 'the-log', 'ice-spirit'],
  ['goblin-barrel', 'princess', 'goblin-gang', 'knight', 'inferno-dragon', 'rocket', 'the-log', 'skeletons'],
  ['goblin-barrel', 'princess', 'goblin-gang', 'bomber', 'knight', 'inferno-tower', 'rocket', 'zap'],
  ['goblin-barrel', 'princess', 'goblin-gang', 'knight', 'inferno-tower', 'rocket', 'the-log', 'electro-spirit'],
  ['goblin-barrel', 'princess', 'goblin-gang', 'firecracker', 'knight', 'inferno-tower', 'rocket', 'the-log'],
  ['goblin-barrel', 'princess', 'goblin-gang', 'guards', 'inferno-tower', 'rocket', 'the-log', 'ice-spirit'],

  // --- Royal Giant (8) ------------------------------------------------------
  ['royal-giant', 'fisherman', 'hunter', 'mother-witch', 'barbarians', 'earthquake', 'the-log', 'fireball'],
  ['royal-giant', 'fisherman', 'zappies', 'flying-machine', 'barbarians', 'earthquake', 'the-log', 'fireball'],
  ['royal-giant', 'hunter', 'mother-witch', 'zappies', 'heal-spirit', 'earthquake', 'the-log', 'fireball'],
  ['royal-giant', 'elite-barbarians', 'flying-machine', 'zappies', 'heal-spirit', 'earthquake', 'the-log', 'fireball'],
  ['royal-giant', 'mighty-miner', 'fisherman', 'mother-witch', 'earthquake', 'the-log', 'fireball', 'archers'],
  ['royal-giant', 'golden-knight', 'fisherman', 'hunter', 'earthquake', 'the-log', 'fireball', 'barbarians'],
  ['royal-giant', 'barbarians', 'hunter', 'mother-witch', 'flying-machine', 'earthquake', 'the-log', 'fireball'],
  ['royal-giant', 'fisherman', 'hunter', 'mother-witch', 'mega-minion', 'earthquake', 'the-log', 'fireball'],

  // --- Bridge Spam (13) -----------------------------------------------------
  ['pekka', 'battle-ram', 'bandit', 'magic-archer', 'electro-wizard', 'poison', 'the-log', 'dark-prince'],
  ['battle-ram', 'bandit', 'royal-ghost', 'dark-prince', 'electro-wizard', 'poison', 'the-log', 'mega-minion'],
  ['royal-ghost', 'bandit', 'battle-ram', 'magic-archer', 'poison', 'the-log', 'dark-prince', 'mega-minion'],
  ['ram-rider', 'bandit', 'electro-wizard', 'dark-prince', 'fireball', 'the-log', 'mega-minion', 'ice-golem'],
  ['royal-recruits', 'battle-ram', 'flying-machine', 'zappies', 'dark-prince', 'fireball', 'the-log', 'heal-spirit'],
  ['royal-recruits', 'elite-barbarians', 'battle-ram', 'flying-machine', 'zappies', 'poison', 'the-log', 'dark-prince'],
  ['cannon-cart', 'bandit', 'battle-ram', 'magic-archer', 'poison', 'the-log', 'electro-wizard', 'dark-prince'],
  ['monk', 'battle-ram', 'bandit', 'royal-ghost', 'poison', 'the-log', 'electro-wizard', 'dark-prince'],
  ['golden-knight', 'battle-ram', 'bandit', 'royal-ghost', 'fireball', 'the-log', 'magic-archer', 'dark-prince'],
  ['mighty-miner', 'elite-barbarians', 'battle-ram', 'bandit', 'poison', 'the-log', 'electro-wizard', 'mother-witch'],
  ['royal-ghost', 'bandit', 'battle-ram', 'dark-prince', 'mother-witch', 'poison', 'the-log', 'zappies'],
  ['three-musketeers', 'battle-ram', 'bandit', 'dark-prince', 'fireball', 'the-log', 'ice-golem', 'skeletons'],
  ['mega-knight', 'battle-ram', 'bandit', 'poison', 'the-log', 'electro-wizard', 'dark-prince', 'zappies'],

  // --- Graveyard Control (9) ------------------------------------------------
  ['graveyard', 'poison', 'knight', 'ice-wizard', 'tombstone', 'baby-dragon', 'barbarian-barrel', 'valkyrie'],
  ['graveyard', 'freeze', 'knight', 'ice-wizard', 'tombstone', 'baby-dragon', 'valkyrie', 'the-log'],
  ['graveyard', 'poison', 'valkyrie', 'ice-wizard', 'tombstone', 'flying-machine', 'barbarian-barrel', 'baby-dragon'],
  ['graveyard', 'poison', 'balloon', 'knight', 'ice-wizard', 'tombstone', 'barbarian-barrel', 'valkyrie'],
  ['graveyard', 'poison', 'night-witch', 'knight', 'tombstone', 'baby-dragon', 'barbarian-barrel', 'mega-minion'],
  ['graveyard', 'poison', 'witch', 'ice-wizard', 'tombstone', 'baby-dragon', 'barbarian-barrel', 'flying-machine'],
  ['graveyard', 'poison', 'guards', 'ice-wizard', 'tombstone', 'baby-dragon', 'barbarian-barrel', 'valkyrie'],
  ['graveyard', 'poison', 'knight', 'tombstone', 'skeleton-dragons', 'barbarian-barrel', 'baby-dragon', 'ice-wizard'],
  ['graveyard', 'poison', 'baby-dragon', 'knight', 'tombstone', 'mega-minion', 'barbarian-barrel', 'ice-wizard'],

  // --- Goblin Drill (8) -----------------------------------------------------
  ['goblin-drill', 'wall-breakers', 'fireball', 'the-log', 'tesla', 'firecracker', 'skeletons', 'ice-spirit'],
  ['goblin-drill', 'wall-breakers', 'dart-goblin', 'fireball', 'the-log', 'tesla', 'skeletons', 'electro-spirit'],
  ['goblin-drill', 'wall-breakers', 'magic-archer', 'fireball', 'the-log', 'tesla', 'bomber', 'skeletons'],
  ['goblin-drill', 'wall-breakers', 'archers', 'fireball', 'the-log', 'tesla', 'bomber', 'ice-spirit'],
  ['goblin-drill', 'wall-breakers', 'royal-delivery', 'fireball', 'tesla', 'skeletons', 'bomber', 'dart-goblin'],
  ['goblin-drill', 'wall-breakers', 'fireball', 'the-log', 'bomb-tower', 'skeletons', 'spear-goblins', 'bomber'],
  ['goblin-drill', 'wall-breakers', 'princess', 'fireball', 'the-log', 'tesla', 'skeletons', 'ice-spirit'],
  ['goblin-drill', 'wall-breakers', 'goblin-gang', 'fireball', 'the-log', 'tesla', 'bomber', 'skeletons'],

  // --- Siege (13) -----------------------------------------------------------
  ['x-bow', 'tesla', 'archers', 'knight', 'skeletons', 'ice-spirit', 'the-log', 'fireball'],
  ['x-bow', 'tesla', 'ice-wizard', 'knight', 'skeletons', 'ice-spirit', 'the-log', 'fireball'],
  ['x-bow', 'tesla', 'musketeer', 'knight', 'skeletons', 'ice-spirit', 'the-log', 'fireball'],
  ['x-bow', 'tesla', 'archers', 'bomber', 'knight', 'skeletons', 'the-log', 'fireball'],
  ['x-bow', 'tesla', 'archers', 'knight', 'skeletons', 'ice-spirit', 'arrows', 'fireball'],
  ['x-bow', 'tesla', 'archers', 'valkyrie', 'skeletons', 'ice-spirit', 'the-log', 'fireball'],
  ['mortar', 'miner', 'skeletons', 'ice-spirit', 'the-log', 'fireball', 'archers', 'knight'],
  ['mortar', 'miner', 'poison', 'the-log', 'skeletons', 'ice-spirit', 'archers', 'knight'],
  ['mortar', 'musketeer', 'skeletons', 'ice-spirit', 'the-log', 'fireball', 'archers', 'ice-golem'],
  ['mortar', 'dark-prince', 'skeletons', 'ice-spirit', 'the-log', 'fireball', 'archers', 'knight'],
  ['mortar', 'musketeer', 'skeletons', 'ice-spirit', 'the-log', 'fireball', 'goblin-gang', 'knight'],
  ['mortar', 'mini-pekka', 'skeletons', 'ice-spirit', 'the-log', 'fireball', 'spear-goblins', 'knight'],
  ['mortar', 'wall-breakers', 'valkyrie', 'ice-spirit', 'the-log', 'fireball', 'archers', 'knight'],

  // --- Control / Cycle (12) -------------------------------------------------
  ['miner', 'mega-minion', 'ice-spirit', 'skeletons', 'the-log', 'fireball', 'knight', 'tesla'],
  ['miner', 'poison', 'mega-minion', 'ice-spirit', 'skeletons', 'the-log', 'knight', 'tesla'],
  ['miner', 'bomb-tower', 'musketeer', 'skeletons', 'ice-spirit', 'the-log', 'fireball', 'knight'],
  ['miner', 'royal-ghost', 'bandit', 'mega-minion', 'skeletons', 'the-log', 'fireball', 'musketeer'],
  ['miner', 'fisherman', 'musketeer', 'skeletons', 'ice-spirit', 'the-log', 'fireball', 'knight'],
  ['miner', 'electro-wizard', 'mega-minion', 'skeletons', 'ice-spirit', 'the-log', 'fireball', 'knight'],
  ['miner', 'cannon', 'musketeer', 'skeletons', 'ice-spirit', 'the-log', 'fireball', 'knight'],
  ['miner', 'firecracker', 'mega-minion', 'musketeer', 'the-log', 'fireball', 'knight', 'tesla'],
  ['miner', 'inferno-tower', 'musketeer', 'skeletons', 'ice-spirit', 'the-log', 'fireball', 'ice-golem'],
  ['royal-hogs', 'firecracker', 'royal-delivery', 'flying-machine', 'skeletons', 'ice-spirit', 'the-log', 'knight'],
  ['royal-hogs', 'firecracker', 'royal-delivery', 'flying-machine', 'mega-minion', 'ice-spirit', 'the-log', 'tesla'],
  ['miner', 'musketeer', 'mega-minion', 'ice-spirit', 'skeletons', 'the-log', 'fireball', 'tesla'],
]

/** Library size, surfaced in the recommendation panel copy. */
export const META_DECK_COUNT = META_DECKS.length
