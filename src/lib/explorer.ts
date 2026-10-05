import { archetypeBlurb, detectArchetype, matchupMatrix } from './archetypes'
import type { DeckStat, MetaSnapshot } from './battle'
import { round1 } from './analysis'
import { getCard } from './cards'

/**
 * Archetype-first view over the meta snapshot: every published deck variant
 * grouped by the classifier in `archetypes.ts`, so the explorer can show a
 * category, then the real compositions players piloted inside it.
 *
 * Pure data — no invented numbers. Fields missing from an older stored
 * snapshot stay undefined and the UI renders them as "—".
 */
export interface ArchetypeGroup {
  key: string
  label: string
  blurb: string
  /** Side-deck share of the whole sample (all decks, not only published ones). */
  share: number
  battles: number
  winRate: number
  /** Percentage-point share change between the sample's halves; absent for one-half samples. */
  trend?: number
  firstHalf?: number
  secondHalf?: number
  /** Published observed variants of this archetype, most used first. */
  variants: DeckStat[]
  /** Battles summed over the published variants (a subset of `battles`). */
  variantBattles: number
  /** Battles-weighted average elixir across the published variants. */
  avgElixir: number
}

export function buildExplorerGroups(snapshot: MetaSnapshot): ArchetypeGroup[] {
  const byKey = new Map<string, DeckStat[]>()
  for (const deck of snapshot.decks) {
    const list = byKey.get(deck.archetype)
    if (list) list.push(deck)
    else byKey.set(deck.archetype, [deck])
  }
  const statOf = new Map(snapshot.archetypes.map((stat) => [stat.key, stat]))

  const groups: ArchetypeGroup[] = []
  for (const [key, variants] of byKey) {
    const sortedVariants = [...variants].sort(
      (a, b) => b.usage - a.usage || b.battles - a.battles,
    )
    const stat = statOf.get(key)
    const variantBattles = sortedVariants.reduce((sum, deck) => sum + deck.battles, 0)
    const elixirWeighted = sortedVariants.reduce(
      (sum, deck) => sum + deck.avgElixir * deck.battles,
      0,
    )
    groups.push({
      key,
      label: stat?.label ?? key,
      blurb: archetypeBlurb(key),
      share: stat?.share ?? 0,
      battles: stat?.battles ?? variantBattles,
      winRate: stat?.winRate ?? 0,
      trend: stat?.trend,
      firstHalf: stat?.firstHalf,
      secondHalf: stat?.secondHalf,
      variants: sortedVariants,
      variantBattles,
      avgElixir: variantBattles ? round1(elixirWeighted / variantBattles) : 0,
    })
  }

  return groups.sort((a, b) => b.share - a.share || b.battles - a.battles)
}

/**
 * Deterministic explanation layer for one archetype: every sentence is derived
 * from the group's numbers, the sample and the existing matchup matrix — the
 * AI never adds a claim the data does not carry.
 */
export function archetypeInsight(group: ArchetypeGroup, snapshot: MetaSnapshot): string[] {
  const lines: string[] = []
  const slots = snapshot.archetypes.reduce((sum, stat) => sum + stat.battles, 0) || 1

  lines.push(
    `Piloted in ${group.share}% of sampled deck slots — ${group.battles} of ${slots} side decks across ${snapshot.battles} battles.`,
  )

  const meanWinRate = snapshot.archetypes.reduce(
    (sum, stat) => sum + stat.winRate * stat.battles,
    0,
  ) / (slots || 1)
  const gap = round1(group.winRate - meanWinRate)
  lines.push(
    `Holds a ${group.winRate}% win rate over ${group.battles} battles — ${Math.abs(gap)}pp ${
      gap >= 0 ? 'above' : 'below'
    } the sample's ${round1(meanWinRate)}% mean deck win rate.`,
  )

  if (
    typeof group.trend === 'number' &&
    typeof group.firstHalf === 'number' &&
    typeof group.secondHalf === 'number'
  ) {
    const direction =
      group.trend > 0.5 ? 'gaining ground' : group.trend < -0.5 ? 'losing ground' : 'steady'
    lines.push(
      `Share of the meta moved ${group.firstHalf}% → ${group.secondHalf}% between the sample's halves (${
        group.trend > 0 ? '+' : ''
      }${group.trend}pp, ${direction}).`,
    )
  }

  if (group.variants.length) {
    const top = group.variants[0]
    lines.push(
      `${group.variants.length} observed variant${group.variants.length === 1 ? '' : 's'} in this sample; most used is "${top.label}" (${top.usage}% usage, ${top.battles} battles, ${top.winRate}% win rate).`,
    )

    const coverage = new Map<string, number>()
    for (const variant of group.variants) {
      for (const key of variant.cards) {
        coverage.set(key, (coverage.get(key) ?? 0) + variant.battles)
      }
    }
    const core = Array.from(coverage.entries())
      .map(([key, battles]) => ({
        name: getCard(key)?.name ?? key,
        pct: round1((battles / (group.variantBattles || 1)) * 100),
      }))
      .filter((card) => card.pct >= 50)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5)
    if (core.length) {
      lines.push(
        `Defining cards (in ≥50% of its published variants): ${core
          .map((card) => `${card.name} ${card.pct}%`)
          .join(', ')}.`,
      )
    }

    const linesMatrix = matchupMatrix(detectArchetype(top.cards).proxy.key, top.cards)
    const favored = linesMatrix.filter((line) => line.verdict === 'favored').slice(0, 2)
    const unfavored = linesMatrix.filter((line) => line.verdict === 'unfavored').slice(-2)
    const parts: string[] = []
    if (favored.length)
      parts.push(
        `favored into ${favored.map((line) => `${line.label} (${line.score}%)`).join(', ')}`,
      )
    if (unfavored.length)
      parts.push(
        `unfavored vs ${unfavored.map((line) => `${line.label} (${line.score}%)`).join(', ')}`,
      )
    if (parts.length) {
      lines.push(
        `Projected matchups for "${top.label}" from the matchup matrix: ${parts.join('; ')}.`,
      )
    }
  }

  return lines
}
