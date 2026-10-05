import { combatOf, getCard, keyForName } from './cards'
import type { RawBattle } from './cr-api'
import { archetypeLabel, detectArchetype, getArchetype } from './archetypes'
import { round1 } from './analysis'
import { isPublished } from './synergy'

export interface NormalizedBattle {
  id: string
  time: string
  type: string
  result: 'win' | 'loss' | 'draw'
  crowns: { us: number; them: number }
  deck: string[]
  opponentDeck: string[]
  opponentName: string
  opponentTag?: string
  arena?: string
  /**
   * Team-side cards played in evolved form (raw payload `evolutionLevel > 0`).
   * Absent when the source does not report evolutions (demo data, older rows).
   */
  evolutions?: string[]
  /**
   * Untouched Clash Royale payload. Carried alongside the normalised battle so
   * the diagnosis engine can read tower hit points, card levels and elixir
   * leaks, and dropped before anything is serialised to the client.
   */
  raw?: RawBattle
}

export interface CardStat {
  key: string
  name: string
  elixir: number
  rarity: string
  battles: number
  usage: number
  winRate: number
  wins: number
}

export interface DeckStat {
  id: string
  label: string
  archetype: string
  cards: string[]
  battles: number
  usage: number
  winRate: number
  avgElixir: number
  /** Cards observed evolved in battles with this signature, most frequent first. */
  evoKeys?: string[]
}

export interface ArchetypeStat {
  key: string
  label: string
  share: number
  battles: number
  winRate: number
}

/**
 * Two cards measured on the same team decks.
 *
 * `lift` is a pure co-occurrence number: how much more often the pair shows up
 * than two independent cards would, so it says which cards form a package. It
 * makes no claim about results.
 *
 * `delta` does look at results - the pair's win rate minus the mean of the two
 * cards' own win rates. The two solo rates are each card's record across *all*
 * of its builds, so a pair confined to a single build reports a gap that mostly
 * measures that one build rather than the pair. `MIN_RESULT_DECKS` keeps only
 * pairs whose record spans several builds, and `decks` is published so a reader
 * can see how many.
 *
 * Only pairs that satisfy `isPublished` are serialised: card names are left
 * out entirely, because the client already holds the card catalogue and
 * `synergies` is the bulk of the `/api/meta` payload.
 */
export interface CardSynergy {
  a: string
  b: string
  /** Decided team battles containing both cards. */
  battles: number
  /** Distinct 8-card signatures those battles used. */
  decks: number
  /** Battles the pair would appear in if the two cards were independent. */
  expected: number
  /** observed / expected - above 1 means they travel together. */
  lift: number
  /** Win rate of the decided team battles with both cards. */
  winRate: number
  /** Each card's own win rate across every team battle it appears in. */
  aWinRate: number
  bWinRate: number
  /** `winRate` minus the mean of the two solo rates, in percentage points. */
  delta: number
}

export interface TrendPoint {
  key: string
  label: string
  firstHalf: number
  secondHalf: number
  delta: number
}

export interface MetaSnapshot {
  generatedAt: string
  source: 'live' | 'demo'
  battles: number
  players: number
  cards: CardStat[]
  decks: DeckStat[]
  archetypes: ArchetypeStat[]
  trending: TrendPoint[]
  topWinRate: CardStat[]
  synergies: CardSynergy[]
  avgElixir: number
  notice?: string
  /** Distinct cards observed evolved in this sample. Absent when the source reports no evolution data. */
  evolvable?: string[]
}

export function deckKeys(cards: { name?: string }[] | undefined): string[] {
  if (!cards?.length) return []
  const keys = cards.map((card) => keyForName(card.name ?? '')).filter(Boolean) as string[]
  return Array.from(new Set(keys)).slice(0, 8)
}

/**
 * Card keys the payload marks as played in evolved form. Empty when the source
 * carries no `evolutionLevel`, which is what keeps demo and older data honest:
 * an absent list never claims a card is (or is not) evolution-capable.
 */
export function evolvedKeys(
  cards: { name?: string; evolutionLevel?: number }[] | undefined,
): string[] {
  if (!cards?.length) return []
  const keys = cards
    .filter((card) => (card.evolutionLevel ?? 0) > 0)
    .map((card) => keyForName(card.name ?? ''))
    .filter(Boolean) as string[]
  return Array.from(new Set(keys))
}

/**
 * Pairs that satisfy neither table in `src/lib/synergy.ts` are dropped here
 * rather than shipped and thrown away in the browser.
 */
const MAX_SYNERGIES = 800

export function aggregateMeta(
  battles: NormalizedBattle[],
  options: { source: 'live' | 'demo'; players: number },
): MetaSnapshot {
  const cardBattles = new Map<string, Set<string>>()
  const cardWins = new Map<string, number>()
  const cardLosses = new Map<string, number>()
  const deckBattles = new Map<string, { battles: number; wins: number }>()
  const archetypeBattles = new Map<string, { battles: number; wins: number }>()
  // Team-side only, decided battles only: pairs are measured on the deck that
  // was actually being piloted, never on the opponent's, and never against a
  // draw, so both halves of every rate below share one denominator.
  const teamCardBattles = new Map<string, Set<string>>()
  const teamCardWins = new Map<string, number>()
  const pairStats = new Map<string, { battles: number; wins: number; decks: Set<string> }>()
  // Evolution is only reported for battles whose payload carries it; both maps
  // stay empty for demo data so the snapshot simply omits the fields.
  const evoCounts = new Map<string, Map<string, number>>()
  const evolvable = new Set<string>()
  let teamDecks = 0
  let elixirTotal = 0
  let elixirDecks = 0

  for (const battle of battles) {
    if (battle.result !== 'draw' && battle.deck.length === 8) {
      teamDecks += 1
      const team = [...battle.deck].sort()
      const signature = team.join('|')
      const won = battle.result === 'win'
      for (const key of team) {
        const seen = teamCardBattles.get(key) ?? new Set<string>()
        seen.add(battle.id)
        teamCardBattles.set(key, seen)
        if (won) teamCardWins.set(key, (teamCardWins.get(key) ?? 0) + 1)
      }
      for (let i = 0; i < team.length; i += 1) {
        for (let j = i + 1; j < team.length; j += 1) {
          const id = `${team[i]}|${team[j]}`
          const stat = pairStats.get(id) ?? {
            battles: 0,
            wins: 0,
            decks: new Set<string>(),
          }
          stat.battles += 1
          if (won) stat.wins += 1
          stat.decks.add(signature)
          pairStats.set(id, stat)
        }
      }
    }

    for (const deck of [battle.deck, battle.opponentDeck]) {
      if (deck.length !== 8) continue
      const isTeam = deck === battle.deck
      const outcome = isTeam ? battle.result : battle.result === 'win' ? 'loss' : battle.result === 'loss' ? 'win' : 'draw'
      const signature = [...deck].sort().join('|')
      const bucket = deckBattles.get(signature) ?? { battles: 0, wins: 0 }
      bucket.battles += 1
      if (outcome === 'win') bucket.wins += 1
      deckBattles.set(signature, bucket)

      if (isTeam && battle.evolutions?.length) {
        for (const key of battle.evolutions) {
          evolvable.add(key)
          const perDeck = evoCounts.get(signature) ?? new Map<string, number>()
          perDeck.set(key, (perDeck.get(key) ?? 0) + 1)
          evoCounts.set(signature, perDeck)
        }
      }

      const archetypeKey = detectArchetype(deck).archetype.key
      const archBucket = archetypeBattles.get(archetypeKey) ?? { battles: 0, wins: 0 }
      archBucket.battles += 1
      if (outcome === 'win') archBucket.wins += 1
      archetypeBattles.set(archetypeKey, archBucket)

      const avg =
        deck.reduce((sum, key) => sum + (getCard(key)?.elixir ?? 0), 0) / 8
      elixirTotal += avg
      elixirDecks += 1

      for (const key of deck) {
        const seen = cardBattles.get(key) ?? new Set<string>()
        seen.add(battle.id)
        cardBattles.set(key, seen)
        if (outcome === 'win') cardWins.set(key, (cardWins.get(key) ?? 0) + 1)
        if (outcome === 'loss') cardLosses.set(key, (cardLosses.get(key) ?? 0) + 1)
      }
    }
  }

  const totalBattles = battles.length || 1
  const cards: CardStat[] = Array.from(cardBattles.entries())
    .map(([key, seen]) => {
      const wins = cardWins.get(key) ?? 0
      const losses = cardLosses.get(key) ?? 0
      const decided = wins + losses || 1
      const raw = getCard(key)
      return {
        key,
        name: raw?.name ?? key,
        elixir: raw?.elixir ?? 0,
        rarity: raw?.rarity ?? 'Common',
        battles: seen.size,
        usage: round1((seen.size / totalBattles) * 100),
        winRate: round1((wins / decided) * 100),
        wins,
      }
    })
    .sort((a, b) => b.usage - a.usage)

  const decks: DeckStat[] = Array.from(deckBattles.entries())
    .map(([signature, stat]) => {
      const list = signature.split('|')
      const archetype = detectArchetype(list).archetype
      const label = deckLabel(list, archetype.key)
      const evo = evoCounts.get(signature)
      return {
        id: signature,
        label,
        archetype: archetype.key,
        cards: list,
        battles: stat.battles,
        usage: round1((stat.battles / totalBattles) * 100),
        winRate: round1((stat.wins / (stat.battles || 1)) * 100),
        avgElixir: round1(
          list.reduce((sum, key) => sum + (getCard(key)?.elixir ?? 0), 0) / list.length,
        ),
        ...(evo && evo.size
          ? {
              evoKeys: Array.from(evo.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([key]) => key),
            }
          : {}),
      }
    })
    .filter((deck) => deck.battles >= 1)
    .sort((a, b) => b.usage - a.usage)
  const labelledDecks = withUniqueLabels(decks)

  const archetypes: ArchetypeStat[] = (() => {
    const slots =
      Array.from(archetypeBattles.values()).reduce((sum, stat) => sum + stat.battles, 0) || 1
    return Array.from(archetypeBattles.entries())
      .map(([key, stat]) => ({
        key,
        label: archetypeLabel(key),
        battles: stat.battles,
        share: round1((stat.battles / slots) * 100),
        winRate: round1((stat.wins / (stat.battles || 1)) * 100),
      }))
      .sort((a, b) => b.share - a.share)
  })()

  const sorted = [...battles].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  )
  const half = Math.floor(sorted.length / 2)
  const early = new Set(sorted.slice(0, half).map((battle) => battle.id))
  const earlyUsage = new Map<string, number>()
  const lateUsage = new Map<string, number>()
  for (const battle of sorted) {
    const target = early.has(battle.id) ? earlyUsage : lateUsage
    for (const key of new Set([...battle.deck, ...battle.opponentDeck])) {
      target.set(key, (target.get(key) ?? 0) + 1)
    }
  }
  const earlyCount = Math.max(1, half)
  const lateCount = Math.max(1, sorted.length - half)
  const trending = Array.from(cardBattles.keys())
    .map((key) => {
      const firstHalf = ((earlyUsage.get(key) ?? 0) / earlyCount) * 100
      const secondHalf = ((lateUsage.get(key) ?? 0) / lateCount) * 100
      return {
        key,
        label: getCard(key)?.name ?? key,
        firstHalf: round1(firstHalf),
        secondHalf: round1(secondHalf),
        delta: round1(secondHalf - firstHalf),
      }
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 8)

  const topWinRate = cards
    .filter((card) => card.battles >= Math.max(3, totalBattles * 0.12))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 10)

  const synergies: CardSynergy[] = Array.from(pairStats.entries())
    .map(([id, stat]) => {
      const [a, b] = id.split('|')
      const aBattles = teamCardBattles.get(a)?.size ?? 0
      const bBattles = teamCardBattles.get(b)?.size ?? 0
      const expected = teamDecks ? (aBattles * bBattles) / teamDecks : 0
      const aWinRate = round1(((teamCardWins.get(a) ?? 0) / (aBattles || 1)) * 100)
      const bWinRate = round1(((teamCardWins.get(b) ?? 0) / (bBattles || 1)) * 100)
      const winRate = round1((stat.wins / stat.battles) * 100)
      return {
        a,
        b,
        battles: stat.battles,
        decks: stat.decks.size,
        expected: Math.round(expected * 10) / 10,
        lift: expected ? Math.round((stat.battles / expected) * 100) / 100 : 0,
        winRate,
        aWinRate,
        bWinRate,
        delta: round1(winRate - (aWinRate + bWinRate) / 2),
      }
    })
    .filter(isPublished)
    .sort((x, y) => y.battles - x.battles)
    .slice(0, MAX_SYNERGIES)

  return {
    generatedAt: new Date().toISOString(),
    source: options.source,
    battles: battles.length,
    players: options.players,
    // Every card the sample actually saw, not just the top of the table: the
    // catalogue page looks each card's record up here, so a cap would render a
    // card that did appear as "not in this sample". The catalogue is ~130
    // entries, so the array cannot grow past that.
    cards,
    decks: labelledDecks.slice(0, 30),
    archetypes,
    trending,
    topWinRate,
    synergies,
    avgElixir: elixirDecks ? round1(elixirTotal / elixirDecks) : 0,
    ...(evolvable.size ? { evolvable: Array.from(evolvable).sort() } : {}),
  }
}

/** Archetypes with a generic name that reads better when prefixed with the win condition. */
const PREFIXED_ARCHETYPES = new Set(['siege', 'beatdown'])

export function deckLabel(deck: string[], archetypeKey?: string): string {
  const archetype = archetypeKey ?? detectArchetype(deck).archetype.key
  const known = getArchetype(archetype)
  if (known) {
    const core = PREFIXED_ARCHETYPES.has(archetype)
      ? known.requires.find((key) => deck.includes(key))
      : undefined
    const coreName = core ? getCard(core)?.name : undefined
    return coreName ? `${coreName} ${known.label}` : known.label
  }

  const wins = deck.filter((key) => {
    const roles = combatOf(key).roles
    return roles.includes('wc') || roles.includes('wc2')
  })
  if (wins.length >= 2) return wins.map((key) => getCard(key)?.name ?? key).join(' ')
  if (wins.length === 1) {
    const name = getCard(wins[0])?.name ?? wins[0]
    const support = deck.find(
      (key) => combatOf(key).roles.includes('support') || combatOf(key).roles.includes('tank'),
    )
    return support && support !== wins[0]
      ? `${getCard(support)?.name} ${name}`
      : `${name} Deck`
  }
  return 'Mixed Deck'
}

/** Card names that can tell two same-archetype decks apart, best signal first. */
function disambiguators(deck: DeckStat): string[] {
  const used = new Set<string>()
  const out: string[] = []
  const push = (key: string) => {
    const name = getCard(key)?.name ?? key
    if (!used.has(name)) {
      used.add(name)
      out.push(name)
    }
  }

  for (const key of deck.cards) {
    const roles = combatOf(key).roles
    if (roles.includes('wc') || roles.includes('wc2')) push(key)
  }
  const byElixir = [...deck.cards].sort(
    (a, b) => (getCard(b)?.elixir ?? 0) - (getCard(a)?.elixir ?? 0),
  )
  for (const key of byElixir) push(key)
  return out
}

/**
 * Keeps deck rows readable when several distinct lists share an archetype
 * label. Tries a card from the deck (win condition first) before falling back
 * to elixir, so the list never degrades into `... (2.6 elixir) (2)`.
 */
function withUniqueLabels(decks: DeckStat[]): DeckStat[] {
  const used = new Set<string>()
  return decks.map((deck) => {
    if (!used.has(deck.label)) {
      used.add(deck.label)
      return deck
    }

    for (const name of disambiguators(deck)) {
      if (deck.label.includes(name)) continue
      const candidate = `${deck.label} · ${name}`
      if (!used.has(candidate)) {
        used.add(candidate)
        return { ...deck, label: candidate }
      }
    }

    const withElixir = `${deck.label} (${deck.avgElixir} elixir)`
    if (!used.has(withElixir)) {
      used.add(withElixir)
      return { ...deck, label: withElixir }
    }

    let suffix = 2
    let label = `${withElixir} (${suffix})`
    while (used.has(label)) {
      suffix += 1
      label = `${withElixir} (${suffix})`
    }
    used.add(label)
    return { ...deck, label }
  })
}

export function archetypeShareLabel(key: string): string {
  return archetypeLabel(key)
}

