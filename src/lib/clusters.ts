import type { DeckStat } from './battle'
import { round1 } from './analysis'

/**
 * Deck clustering for the meta dashboard.
 *
 * The snapshot groups decks by exact 8-card signature, which is the right
 * answer to "what is being played" but the wrong one to "what is being
 * played *a lot*" - one family of near-identical builds gets split into five
 * separate entries that nobody reads as a family. This groups those variants
 * back together so the family can be counted once.
 *
 * Average-linkage agglomerative clustering over Jaccard similarity. Two
 * 8-card decks that share 5 cards score 5/11, so the threshold is stated in
 * cards and converted once at the top rather than being a magic float buried
 * in the merge loop.
 */

/**
 * Two decks join the same family when the average Jaccard similarity between
 * them reaches the score two 8-card decks earn for sharing this many cards.
 * Five of eight was picked by looking at what the sample actually produces:
 * at six the panel finds only one family, at four average linkage starts
 * merging decks that merely share fireball + the-log. The raw ratio is kept
 * unrounded - rounding it to one decimal would quietly loosen the bar.
 */
export const MIN_SHARED_CARDS = 5

const DECK_SIZE = 8

/** Jaccard score for `MIN_SHARED_CARDS` shared cards: k / (2n - k) = 5/11. */
export const FAMILY_SIMILARITY =
  MIN_SHARED_CARDS / (2 * DECK_SIZE - MIN_SHARED_CARDS)

/** Bounds the merge loop: O(n^3) over the number of distinct decks. */
const MAX_DECKS = 200

export function jaccard(a: string[], b: string[]): number {
  const left = new Set(a)
  const right = new Set(b)
  let shared = 0
  for (const key of left) if (right.has(key)) shared += 1
  const union = left.size + right.size - shared
  return union ? shared / union : 0
}

export interface DeckVariant {
  id: string
  label: string
  archetype: string
  cards: string[]
  battles: number
  usage: number
  winRate: number
  avgElixir: number
  /** Against the family's most-played deck: cards added and removed. */
  added: string[]
  removed: string[]
}

export interface DeckFamily {
  id: string
  /** Label of the family's most-played deck - the representative build. */
  label: string
  archetype: string
  /** Cards every member of the family plays. */
  core: string[]
  variants: DeckVariant[]
  battles: number
  /** Share of the sample, summed over members (each member's usage is
   * already a share of the same total, so the sum is the family's share). */
  usage: number
  /** Battle-weighted mean of the members' win rates. */
  winRate: number
  avgElixir: number
  /** Mean pairwise similarity inside the family - 100 for a single deck. */
  similarity: number
}

export interface DeckClusters {
  families: DeckFamily[]
  threshold: number
  minSharedCards: number
  /** Distinct decks in the snapshot. */
  deckCount: number
  /** How many of those were actually clustered (see `capped`). */
  considered: number
  capped: boolean
  /** Distinct decks that ended up with at least one sibling. */
  groupedDecks: number
  /** Sample share those grouped decks account for. */
  groupedUsage: number
}

function meanPairwise(similarity: number[][], members: number[]): number {
  if (members.length < 2) return 100
  let total = 0
  let pairs = 0
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      total += similarity[members[i]][members[j]]
      pairs += 1
    }
  }
  return pairs ? round1((total / pairs) * 100) : 100
}

function link(a: number[], b: number[], similarity: number[][]): number {
  let total = 0
  for (const i of a) for (const j of b) total += similarity[i][j]
  return total / (a.length * b.length)
}

function coreCards(members: DeckStat[]): string[] {
  const representative = [...members[0].cards]
  return representative.filter((key) =>
    members.every((member) => member.cards.includes(key)),
  )
}

function representativeIndex(members: number[], decks: DeckStat[]): number {
  return members.reduce(
    (best, index) => (decks[index].battles > decks[best].battles ? index : best),
    members[0],
  )
}

export function clusterDecks(input: DeckStat[]): DeckClusters {
  const decks = input.slice(0, MAX_DECKS)
  const deckCount = input.length

  if (deckCount === 0) {
    return {
      families: [],
      threshold: FAMILY_SIMILARITY,
      minSharedCards: MIN_SHARED_CARDS,
      deckCount: 0,
      considered: 0,
      capped: false,
      groupedDecks: 0,
      groupedUsage: 0,
    }
  }

  const similarity: number[][] = decks.map((_, i) =>
    decks.map((__, j) => (i === j ? 1 : jaccard(decks[i].cards, decks[j].cards))),
  )

  let groups: number[][] = decks.map((_, index) => [index])

  // Average-linkage agglomeration: repeatedly join the closest pair that is
  // still similar enough. Both loops are over distinct decks only, and the
  // input is capped above, so this stays interactive in the browser.
  for (;;) {
    let bestI = -1
    let bestJ = -1
    let bestScore = FAMILY_SIMILARITY
    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const score = link(groups[i], groups[j], similarity)
        if (score >= FAMILY_SIMILARITY && score > bestScore) {
          bestScore = score
          bestI = i
          bestJ = j
        }
      }
    }
    if (bestI < 0) break
    const merged = [...groups[bestI], ...groups[bestJ]]
    groups = groups.filter((_, index) => index !== bestI && index !== bestJ)
    groups.push(merged)
  }

  const families: DeckFamily[] = groups
    .map((members) => {
      const representative = representativeIndex(members, decks)
      const core = coreCards(members.map((index) => decks[index]))
      const variants: DeckVariant[] = members
        .slice()
        .sort((a, b) => decks[b].battles - decks[a].battles)
        .map((index) => {
          const deck = decks[index]
          const representativeCards = decks[representative].cards
          return {
            id: deck.id,
            label: deck.label,
            archetype: deck.archetype,
            cards: deck.cards,
            battles: deck.battles,
            usage: deck.usage,
            winRate: deck.winRate,
            avgElixir: deck.avgElixir,
            added: deck.cards.filter((key) => !representativeCards.includes(key)),
            removed: representativeCards.filter((key) => !deck.cards.includes(key)),
          }
        })

      const battles = members.reduce((sum, index) => sum + decks[index].battles, 0)
      const usage = round1(members.reduce((sum, index) => sum + decks[index].usage, 0))
      const winRate = round1(
        members.reduce((sum, index) => sum + decks[index].battles * decks[index].winRate, 0) /
          (battles || 1),
      )
      const avgElixir = round1(
        members.reduce((sum, index) => sum + decks[index].battles * decks[index].avgElixir, 0) /
          (battles || 1),
      )

      return {
        id: variants.map((variant) => variant.id).join('+'),
        label: decks[representative].label,
        archetype: decks[representative].archetype,
        core,
        variants,
        battles,
        usage,
        winRate,
        avgElixir,
        similarity: meanPairwise(similarity, members),
      }
    })
    .sort((a, b) => b.battles - a.battles)

  const multi = families.filter((family) => family.variants.length > 1)

  return {
    families,
    threshold: FAMILY_SIMILARITY,
    minSharedCards: MIN_SHARED_CARDS,
    deckCount,
    considered: decks.length,
    capped: decks.length < deckCount,
    groupedDecks: multi.reduce((sum, family) => sum + family.variants.length, 0),
    groupedUsage: round1(multi.reduce((sum, family) => sum + family.usage, 0)),
  }
}
