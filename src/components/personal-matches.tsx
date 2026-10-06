'use client'

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { Check, Eye, FlaskConical, Radar, Sparkles } from 'lucide-react'
import { CardTile } from '@/components/card-tile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { MetaSnapshot } from '@/lib/battle'
import { fadeUp, rowReveal } from '@/lib/motion'
import {
  MAX_RECOMMENDATIONS,
  MIN_SELECTED_CARDS,
  SCORE_BASIS,
  recommendDecks,
  type Recommendation,
} from '@/lib/recommend'
import { useCountUp } from '@/lib/use-count-up'

const recStagger: Variants = {
  hidden: {},
  show: { transition: { delayChildren: (index: number) => index * 0.055 } },
}

const tableStagger: Variants = {
  hidden: {},
  show: { transition: { delayChildren: (index: number) => Math.min(index * 0.04, 0.45) } },
}

/** Observed vs built-around-your-selection, stated so nothing reads as sampled. */
const SOURCE_BADGE: Record<Recommendation['source'], { label: string; className: string }> = {
  meta: { label: 'In sample', className: 'bg-emerald-500/10 text-emerald-600' },
  completed: { label: 'Completed', className: 'bg-sky-500/10 text-cyan-700' },
}

interface MatchGroup {
  key: string
  label: string
  best: Recommendation
  items: Recommendation[]
}

function groupByArchetype(items: Recommendation[]): MatchGroup[] {
  const map = new Map<string, Recommendation[]>()
  for (const item of items) {
    const list = map.get(item.archetype)
    if (list) list.push(item)
    else map.set(item.archetype, [item])
  }
  const groups: MatchGroup[] = Array.from(map.entries()).map(([key, list]) => ({
    key,
    label: list[0]?.archetypeLabel ?? key,
    best: list[0],
    items: list,
  }))
  return groups.sort((a, b) => b.best.compatibility - a.best.compatibility)
}

function CountValue({ value, className }: { value: ReactNode; className?: string }) {
  const display = useCountUp(value)
  return <span className={className}>{display}</span>
}

function StatCell({ label, value }: { label: string; value: string }) {
  const display = useCountUp(value)
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{display}</p>
    </div>
  )
}

/**
 * "Best Matches For Your Cards": the selected cards compared against the
 * actual deck compositions in the sample, ranked archetype-first, then by the
 * strongest matching variant. Statistics only ever come from observed decks;
 * completions built around the selection are labelled and show no numbers.
 */
export function PersonalMatches({
  selected,
  meta,
  onUse,
}: {
  selected: string[]
  meta: MetaSnapshot | null
  onUse?: (deck: string[]) => void
}) {
  const recommendations = useMemo(
    () => recommendDecks(selected, meta),
    [selected, meta],
  )
  const groups = useMemo(
    () => groupByArchetype(recommendations),
    [recommendations],
  )

  if (selected.length < MIN_SELECTED_CARDS || !meta || !recommendations.length) return null

  const featured = groups.slice(0, 6)

  return (
    <section className="space-y-4">
      <div className="panel p-4 sm:p-5">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Radar className="size-4 text-primary" />
          <h2 className="panel-title">Best Matches For Your Cards</h2>
          <Badge variant="secondary" className="text-[10px]">
            {groups.length} archetype{groups.length === 1 ? '' : 's'}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {recommendations.length} decks ranked
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Your {selected.length} selected cards compared against the actual deck compositions
          in this sample — ranked by archetype, then by the strongest matching variant.{' '}
          {SCORE_BASIS}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1">
          {selected.map((key) => (
            <CardTile key={key} cardKey={key} size="xxs" showElixir={false} />
          ))}
        </div>
      </div>

      <motion.div
        className="grid gap-4 md:grid-cols-2"
        initial="hidden"
        animate="show"
        variants={recStagger}
      >
        {featured.map((group, index) => {
          const best = group.best
          const deckParam = encodeURIComponent(best.cards.join(','))
          return (
            <motion.article
              key={group.key}
              variants={fadeUp}
              className={`group/cell flex flex-col gap-3 rounded-xl border border-border bg-slate-50 p-4${
                index === 0 ? ' border-l-2 border-l-primary/60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-xs font-black text-primary">
                    #{index + 1}
                  </span>
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold">{group.label}</h4>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {group.items.length} matching deck{group.items.length === 1 ? '' : 's'}
                      {' · '}
                      best: {best.label}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={`shrink-0 text-[10px] ${SOURCE_BADGE[best.source].className}`}
                >
                  {SOURCE_BADGE[best.source].label}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-1">
                {best.cards.map((key) => (
                  <CardTile key={key} cardKey={key} size="xxs" showElixir={false} />
                ))}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Best compatibility
                  </span>
                  <span className="text-lg font-black tabular-nums text-primary">
                    <CountValue value={best.compatibility} />
                    <span className="text-sm">%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-sky-500 transition-all duration-700"
                    style={{ width: `${best.compatibility}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <StatCell label="Usage" value={best.usage !== null ? `${best.usage}%` : '—'} />
                <StatCell
                  label="Win rate"
                  value={best.winRate !== null ? `${best.winRate}%` : '—'}
                />
                <StatCell
                  label="Battles"
                  value={best.source === 'meta' ? String(best.battles) : '—'}
                />
                <StatCell label="Elixir" value={String(best.avgElixir)} />
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Why it matches
                </p>
                <ul className="space-y-1 text-xs">
                  {best.reasons.slice(0, 3).map((reason) => (
                    <li key={reason} className="flex gap-1.5 text-muted-foreground">
                      <Check className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                  <Link href={`/decks/${encodeURIComponent(best.cards.join(','))}`}>
                    <Eye className="size-3.5" />
                    View deck
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                  <Link href={`/deck-lab?deck=${deckParam}`}>
                    <FlaskConical className="size-3.5" />
                    Analyse
                  </Link>
                </Button>
                {onUse && (
                  <Button size="sm" className="h-8 gap-1.5" onClick={() => onUse(best.cards)}>
                    <Check className="size-3.5" />
                    Use deck
                  </Button>
                )}
              </div>
            </motion.article>
          )
        })}
      </motion.div>

      <div className="panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="panel-title">Matching deck compositions</h3>
          <Badge variant="secondary" className="text-[10px]">
            {recommendations.length} ranked
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table min-w-[760px]">
            <thead>
              <tr>
                <th>#</th>
                <th>Deck</th>
                <th>Archetype</th>
                <th>Compat.</th>
                <th>Usage</th>
                <th>Win rate</th>
                <th>Battles</th>
                <th>Elixir</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <motion.tbody initial="hidden" animate="show" variants={tableStagger}>
              {recommendations.map((item) => (
                <motion.tr key={item.id} variants={rowReveal} className="group/row">
                  <td className="tabular-nums text-muted-foreground">{item.rank}</td>
                  <td className="min-w-[200px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">{item.label}</span>
                      <span
                        className={`rounded px-1.5 py-px text-[9px] font-black ${SOURCE_BADGE[item.source].className}`}
                      >
                        {SOURCE_BADGE[item.source].label}
                      </span>
                    </div>
                  </td>
                  <td className="text-muted-foreground">{item.archetypeLabel}</td>
                  <td className="font-semibold tabular-nums text-primary">
                    <CountValue value={`${item.compatibility}%`} />
                  </td>
                  <td className="tabular-nums">
                    {item.usage !== null ? (
                      <CountValue value={`${item.usage}%`} />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="tabular-nums">
                    {item.winRate !== null ? (
                      <CountValue value={`${item.winRate}%`} />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="tabular-nums">
                    {item.source === 'meta' ? item.battles : '—'}
                  </td>
                  <td className="tabular-nums">{item.avgElixir}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2">
                        <Link href={`/decks/${encodeURIComponent(item.cards.join(','))}`}>
                          <Eye className="size-3.5" />
                          View
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2">
                        <Link
                          href={`/deck-lab?deck=${encodeURIComponent(item.cards.join(','))}`}
                        >
                          <FlaskConical className="size-3.5" />
                          Analyse
                        </Link>
                      </Button>
                      {onUse && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2"
                          onClick={() => onUse(item.cards)}
                        >
                          <Check className="size-3.5" />
                          Use
                        </Button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>

        {recommendations.length === MAX_RECOMMENDATIONS && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Ranked list capped at {MAX_RECOMMENDATIONS} — the engine ranks deeper but shows
            the strongest matches first.
          </p>
        )}
      </div>
    </section>
  )
}
