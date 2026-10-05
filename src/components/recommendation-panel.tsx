'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Eye, FlaskConical, Radar, RefreshCw } from 'lucide-react'
import { CardTile } from '@/components/card-tile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { MetaSnapshot } from '@/lib/battle'
import { getCard } from '@/lib/cards'
import {
  DEFAULT_RECOMMENDATIONS,
  MAX_RECOMMENDATIONS,
  MIN_SELECTED_CARDS,
  SCORE_BASIS,
  recommendDecks,
  type Recommendation,
} from '@/lib/recommend'

type FilterKey =
  | 'all'
  | 'compat'
  | 'win'
  | 'usage'
  | 'synergy'
  | 'elixir'
  | 'meta'
  | 'archetype'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'compat', label: 'Highest compatibility' },
  { key: 'win', label: 'Highest win rate' },
  { key: 'usage', label: 'Highest usage' },
  { key: 'synergy', label: 'Best synergy' },
  { key: 'elixir', label: 'Low elixir' },
  { key: 'meta', label: 'Meta' },
  { key: 'archetype', label: 'Archetype' },
]

function applyFilter(items: Recommendation[], filter: FilterKey): Recommendation[] {
  const list = [...items]
  const byNullable = (pick: (item: Recommendation) => number | null) =>
    list.sort((a, b) => {
      const av = pick(a)
      const bv = pick(b)
      if (av === null && bv === null) return a.rank - b.rank
      if (av === null) return 1
      if (bv === null) return -1
      return bv - av
    })
  switch (filter) {
    case 'win':
      return byNullable((item) => item.winRate)
    case 'usage':
      return byNullable((item) => item.usage)
    case 'synergy':
      return list.sort((a, b) => b.parts.synergy - a.parts.synergy || a.rank - b.rank)
    case 'elixir':
      return list.sort((a, b) => a.avgElixir - b.avgElixir || a.rank - b.rank)
    case 'meta':
      return list
        .filter((item) => item.source === 'meta')
        .sort((a, b) => a.rank - b.rank)
    case 'archetype':
      return list.sort(
        (a, b) =>
          a.archetypeLabel.localeCompare(b.archetypeLabel) || a.rank - b.rank,
      )
    default:
      return list.sort((a, b) => a.rank - b.rank)
  }
}

function EvoBadge({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span
      title="Observed played in evolved form in this sample"
      className="absolute -bottom-1 -right-1 rounded bg-emerald-500 px-[3px] text-[7px] font-black leading-[1.4] text-emerald-950 shadow"
    >
      EVO
    </span>
  )
}

function RecommendationCard({
  item,
  onUse,
}: {
  item: Recommendation
  onUse?: (deck: string[]) => void
}) {
  const deckParam = encodeURIComponent(item.cards.join(','))
  const stats: { label: string; value: string; sub?: string }[] = [
    {
      label: 'Win rate',
      value: item.winRate !== null ? `${item.winRate}%` : '—',
      sub: item.winRate !== null ? `${item.battles} battles` : 'not in sample',
    },
    {
      label: 'Usage',
      value: item.usage !== null ? `${item.usage}%` : '—',
      sub: item.usage !== null ? 'of sampled battles' : 'not in sample',
    },
    { label: 'Avg elixir', value: String(item.avgElixir) },
    { label: 'Archetype', value: item.archetypeLabel },
  ]

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-xs font-black text-primary">
            #{item.rank}
          </span>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold">{item.label}</h4>
            <p className="truncate text-[11px] text-muted-foreground">
              {item.archetypeLabel} · {item.avgElixir} avg elixir
            </p>
          </div>
        </div>
        <Badge
          variant="secondary"
          className={`shrink-0 text-[10px] ${
            item.source === 'meta'
              ? 'bg-emerald-500/10 text-emerald-600'
              : 'bg-sky-500/10 text-cyan-700'
          }`}
        >
          {item.source === 'meta' ? 'In sample' : 'Completed'}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1">
        {item.cards.map((key) => (
          <CardTile
            key={key}
            cardKey={key}
            size="xxs"
            showElixir={false}
            overlay={<EvoBadge show={Boolean(item.evolutions?.includes(key))} />}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Compatibility
          </span>
          <span className="text-lg font-black tabular-nums text-primary">
            {item.compatibility}
            <span className="text-sm">%</span>
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-sky-500 transition-all duration-700"
            style={{ width: `${item.compatibility}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-slate-50 p-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p className="truncate font-semibold tabular-nums">{stat.value}</p>
            {stat.sub && <p className="truncate text-[10px] text-muted-foreground">{stat.sub}</p>}
          </div>
        ))}
        <div className="col-span-2 rounded-lg bg-slate-50 p-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Hero (Champion)
          </p>
          <p className="truncate font-medium">
            {item.champions.length
              ? item.champions.map((key) => getCard(key)?.name ?? key).join(', ')
              : 'None'}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Why recommended
        </p>
        <ul className="space-y-1 text-xs">
          {item.reasons.map((reason) => (
            <li key={reason} className="flex gap-1.5 text-muted-foreground">
              <Check className="mt-0.5 size-3 shrink-0 text-emerald-600" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-muted-foreground">{item.summary}</p>
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
          <Link href={`/decks/${encodeURIComponent(item.cards.join(','))}`}>
            <Eye className="size-3.5" />
            View deck
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
          <Link href={`/deck-lab?deck=${deckParam}`}>
            <FlaskConical className="size-3.5" />
            Analyze
          </Link>
        </Button>
        {onUse && (
          <Button size="sm" className="h-8 gap-1.5" onClick={() => onUse(item.cards)}>
            <Check className="size-3.5" />
            Use deck
          </Button>
        )}
      </div>
    </article>
  )
}

/**
 * Meta discovery: ranks every candidate the engine produced against the
 * current meta snapshot and presents it as an analytics board — numbers and
 * comparison first, explanation second, AI one click away in the workspace.
 */
export function RecommendationPanel({
  selected,
  meta,
  loading,
  onReload,
  onUse,
}: {
  selected: string[]
  meta: MetaSnapshot | null
  loading?: boolean
  onReload?: () => void
  onUse?: (deck: string[]) => void
}) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [visible, setVisible] = useState(DEFAULT_RECOMMENDATIONS)

  const recommendations = useMemo(
    () => recommendDecks(selected, meta),
    [selected, meta],
  )
  const filtered = useMemo(
    () => applyFilter(recommendations, filter),
    [recommendations, filter],
  )
  const shown = filtered.slice(0, visible)
  const remaining = filtered.length - shown.length

  if (selected.length < MIN_SELECTED_CARDS) {
    return (
      <section className="panel flex flex-col items-center gap-3 p-10 text-center">
        <Radar className="size-8 text-primary/60" />
        <h3 className="text-lg font-semibold">Pick {MIN_SELECTED_CARDS}+ cards to discover decks</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Once you select at least {MIN_SELECTED_CARDS} cards, RoyaleIQ scores every
          meta deck and completed candidate against your selection and ranks the
          most compatible builds.
        </p>
      </section>
    )
  }

  if (loading && !meta) {
    return (
      <section className="space-y-4">
        <div className="panel h-20 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_unused, index) => (
            <div key={index} className="panel h-72 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (!meta) {
    return (
      <section className="panel flex flex-col items-center gap-3 p-10 text-center">
        <Radar className="size-8 text-rose-600/70" />
        <h3 className="text-lg font-semibold">Meta data unavailable</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Recommendations need the current meta snapshot. Retry the load — no
          numbers are shown because none are available.
        </p>
        {onReload && (
          <Button variant="outline" className="gap-2" onClick={onReload}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        )}
      </section>
    )
  }

  if (!recommendations.length) {
    return (
      <section className="panel flex flex-col items-center gap-3 p-10 text-center">
        <Radar className="size-8 text-primary/60" />
        <h3 className="text-lg font-semibold">No meta decks in this sample yet</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          The current snapshot holds {meta.battles} battles but no complete deck
          signatures to rank against your selection.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="panel p-4 sm:p-5">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Radar className="size-4 text-primary" />
          <h3 className="panel-title">Recommended meta decks</h3>
          <Badge variant="secondary" className="text-[10px]">
            {recommendations.length} ranked
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Meta decks that best match your selected cards and deck structure —
          scored from {meta.battles.toLocaleString()} sampled battles ({meta.source},
          {new Date(meta.generatedAt).toLocaleDateString()}). {SCORE_BASIS}
        </p>
        {meta.notice && (
          <p className="mt-1 text-[11px] text-amber-600/90">{meta.notice}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => {
              setFilter(entry.key)
              setVisible(DEFAULT_RECOMMENDATIONS)
            }}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === entry.key
                ? 'border-primary/60 bg-primary/15 text-primary'
                : 'border-border bg-slate-50 text-muted-foreground hover:text-foreground'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((item) => (
          <RecommendationCard key={item.id} item={item} onUse={onUse} />
        ))}
      </div>

      {remaining > 0 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              setVisible((current) =>
                Math.min(MAX_RECOMMENDATIONS, current + DEFAULT_RECOMMENDATIONS),
              )
            }
          >
            Show more
            <span className="text-muted-foreground">(+{remaining})</span>
          </Button>
        </div>
      )}
      {remaining === 0 && filtered.length > DEFAULT_RECOMMENDATIONS && (
        <p className="text-center text-xs text-muted-foreground">
          All {filtered.length} ranked candidates shown — the engine caps at {MAX_RECOMMENDATIONS}.
        </p>
      )}
    </section>
  )
}
