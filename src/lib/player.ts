import { getCard } from './cards'
import { archetypeLabel, detectArchetype } from './archetypes'
import { round1 } from './analysis'
import type { NormalizedBattle } from './battle'

export interface ArchetypeRecord {
  key: string
  label: string
  battles: number
  wins: number
  winRate: number
  verdict: 'strong' | 'even' | 'weak'
}

export interface TrendBucket {
  label: string
  winRate: number
  battles: number
}

export interface CardRecord {
  key: string
  name: string
  battles: number
  winRate: number
  elixir: number
}

export interface PlayerStats {
  battles: number
  wins: number
  losses: number
  draws: number
  winRate: number
  currentStreak: number
  /** Win rate when *you* pilot each archetype. */
  byArchetype: ArchetypeRecord[]
  /** Win rate when *facing* each archetype - the real matchup table. */
  byOpponent: ArchetypeRecord[]
  trend: TrendBucket[]
  bestMatchup?: ArchetypeRecord
  worstMatchup?: ArchetypeRecord
  mostUsedCards: CardRecord[]
  worstCard?: CardRecord
  bestCard?: CardRecord
  recent: NormalizedBattle[]
  avgElixir: number
}

function verdictFor(winRate: number): ArchetypeRecord['verdict'] {
  if (winRate >= 60) return 'strong'
  if (winRate <= 45) return 'weak'
  return 'even'
}

export function buildPlayerStats(battles: NormalizedBattle[]): PlayerStats {
  const sorted = [...battles].sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  )
  const wins = sorted.filter((battle) => battle.result === 'win').length
  const losses = sorted.filter((battle) => battle.result === 'loss').length
  const draws = sorted.filter((battle) => battle.result === 'draw').length
  const decided = wins + losses || 1

  const archetypeMap = new Map<string, { battles: number; wins: number }>()
  const opponentMap = new Map<string, { battles: number; wins: number }>()
  const cardMap = new Map<string, { battles: number; wins: number }>()
  let elixirTotal = 0

  for (const battle of sorted) {
    const archetype = detectArchetype(battle.deck).archetype.key
    const bucket = archetypeMap.get(archetype) ?? { battles: 0, wins: 0 }
    bucket.battles += 1
    if (battle.result === 'win') bucket.wins += 1
    archetypeMap.set(archetype, bucket)

    const facing = detectArchetype(battle.opponentDeck).archetype.key
    const facingBucket = opponentMap.get(facing) ?? { battles: 0, wins: 0 }
    facingBucket.battles += 1
    if (battle.result === 'win') facingBucket.wins += 1
    opponentMap.set(facing, facingBucket)

    elixirTotal +=
      battle.deck.reduce((sum, key) => sum + (getCard(key)?.elixir ?? 0), 0) /
      (battle.deck.length || 1)

    for (const key of new Set(battle.deck)) {
      const entry = cardMap.get(key) ?? { battles: 0, wins: 0 }
      entry.battles += 1
      if (battle.result === 'win') entry.wins += 1
      cardMap.set(key, entry)
    }
  }

  const toRecords = (
    source: Map<string, { battles: number; wins: number }>,
  ): ArchetypeRecord[] =>
    Array.from(source.entries())
      .map(([key, stat]) => {
        const winRate = round1((stat.wins / (stat.battles || 1)) * 100)
        return {
          key,
          label: archetypeLabel(key),
          battles: stat.battles,
          wins: stat.wins,
          winRate,
          verdict: verdictFor(winRate),
        }
      })
      .sort((a, b) => b.battles - a.battles)

  const byArchetype = toRecords(archetypeMap)
  const byOpponent = toRecords(opponentMap)

  const trend = buildTrend(sorted)

  const mostUsedCards: CardRecord[] = Array.from(cardMap.entries())
    .map(([key, stat]) => ({
      key,
      name: getCard(key)?.name ?? key,
      battles: stat.battles,
      winRate: round1((stat.wins / (stat.battles || 1)) * 100),
      elixir: getCard(key)?.elixir ?? 0,
    }))
    .sort((a, b) => b.battles - a.battles)
    .slice(0, 8)

  const decidedCards = mostUsedCards.filter((card) => card.battles >= 3)
  const worstCard = [...decidedCards].sort((a, b) => a.winRate - b.winRate)[0]
  const bestCard = [...decidedCards].sort((a, b) => b.winRate - a.winRate)[0]

  const matchupEligible = byOpponent.filter((record) => record.battles >= 3)
  const bestMatchup = [...matchupEligible].sort((a, b) => b.winRate - a.winRate)[0]
  const worstMatchup = [...matchupEligible].sort((a, b) => a.winRate - b.winRate)[0]

  let currentStreak = 0
  for (const battle of sorted) {
    if (battle.result === sorted[0]?.result && battle.result !== 'draw') currentStreak += 1
    else break
  }

  return {
    battles: sorted.length,
    wins,
    losses,
    draws,
    winRate: round1((wins / decided) * 100),
    currentStreak,
    byArchetype,
    byOpponent,
    trend,
    bestMatchup,
    worstMatchup,
    mostUsedCards,
    worstCard,
    bestCard,
    // `raw` is the full Clash Royale payload; the diagnosis engine reads it
    // server-side, so it is never serialised into an API response.
    recent: sorted.slice(0, 20).map((battle) => ({ ...battle, raw: undefined })),
    avgElixir: sorted.length
      ? round1(elixirTotal / sorted.length)
      : 0,
  }
}

function buildTrend(battles: NormalizedBattle[]): TrendBucket[] {
  const buckets = new Map<string, { wins: number; battles: number }>()
  for (const battle of battles) {
    const date = new Date(battle.time)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const bucket = buckets.get(key) ?? { wins: 0, battles: 0 }
    bucket.battles += 1
    if (battle.result === 'win') bucket.wins += 1
    buckets.set(key, bucket)
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, stat]) => ({
      label,
      winRate: round1((stat.wins / (stat.battles || 1)) * 100),
      battles: stat.battles,
    }))
    .slice(-8)
}
