'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  FlaskConical,
  Layers,
  RefreshCw,
  Radar,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { motion } from 'motion/react'
import { CardTile } from '@/components/card-tile'
import { FadeIn, Reveal } from '@/components/reveal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatTile } from '@/components/metrics'
import type { DeckStat, MetaSnapshot } from '@/lib/battle'
import { getCard } from '@/lib/cards'
import { archetypeInsight, buildExplorerGroups, type ArchetypeGroup } from '@/lib/explorer'
import { DURATION, EASE_OUT, fadeUp, rowReveal, staggerParent } from '@/lib/motion'

const ENTRANCE = { duration: DURATION.component, ease: EASE_OUT }

function TrendChip({ delta }: { delta: number | null | undefined }) {
  if (delta === null || delta === undefined) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const up = delta >= 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
        up ? 'text-emerald-600' : 'text-rose-600'
      }`}
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {up ? '+' : ''}
      {delta}pp
    </span>
  )
}

/** Champion inside a variant, if the sample's deck carries one. */
function heroName(deck: DeckStat): string | null {
  const champion = deck.cards.find((key) => getCard(key)?.rarity === 'Champion')
  return champion ? (getCard(champion)?.name ?? champion) : null
}

function variantBadges(deck: DeckStat) {
  const hero = heroName(deck)
  const evoCount = deck.evoKeys?.length ?? 0
  if (!hero && !evoCount) return null
  return (
    <span className="flex flex-wrap items-center gap-1">
      {evoCount > 0 && (
        <span
          title={deck.evoKeys?.map((key) => getCard(key)?.name ?? key).join(', ')}
          className="rounded bg-emerald-500/10 px-1.5 py-px text-[9px] font-black tracking-wide text-emerald-700"
        >
          EVO ×{evoCount}
        </span>
      )}
      {hero && (
        <span className="rounded bg-amber-500/15 px-1.5 py-px text-[9px] font-black tracking-wide text-amber-700">
          Hero · {hero}
        </span>
      )}
    </span>
  )
}

function variantCards(deck: DeckStat) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {deck.cards.map((key) => (
        <CardTile key={key} cardKey={key} size="xxs" showElixir={false} />
      ))}
    </div>
  )
}

function deckHref(deck: DeckStat): string {
  return `/decks/${encodeURIComponent(deck.cards.join(','))}`
}

function analyzeHref(deck: DeckStat): string {
  return `/deck-lab?deck=${encodeURIComponent(deck.cards.join(','))}`
}

/* ------------------------------------------------------------------ */
/* Default board: the archetype grid                                   */
/* ------------------------------------------------------------------ */

function ArchetypeCard({
  group,
  onOpen,
}: {
  group: ArchetypeGroup
  onOpen: (key: string) => void
}) {
  const top = group.variants.slice(0, 3)
  return (
    <motion.button
      type="button"
      variants={fadeUp}
      onClick={() => onOpen(group.key)}
      className="panel group flex flex-col gap-3 p-4 text-left transition hover:border-primary/40 focus-visible:border-primary/60"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-foreground">{group.label}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{group.blurb}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {group.variants.length} variant{group.variants.length === 1 ? '' : 's'}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Usage</p>
          <p className="text-sm font-semibold tabular-nums">{group.share}%</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Win rate</p>
          <p className="text-sm font-semibold tabular-nums">{group.winRate}%</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Battles</p>
          <p className="text-sm font-semibold tabular-nums">{group.battles}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          Trend <TrendChip delta={group.trend} />
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {top.map((deck) => deck.label).join(' · ')}
        </span>
      </div>

      <span className="mt-auto flex items-center gap-1 text-xs font-semibold text-primary opacity-80 transition group-hover:opacity-100">
        Open archetype
        <ArrowRight className="size-3.5" />
      </span>
    </motion.button>
  )
}

function ExplorerBoard({
  groups,
  snapshot,
  onOpen,
}: {
  groups: ArchetypeGroup[]
  snapshot: MetaSnapshot
  onOpen: (key: string) => void
}) {
  const slots = snapshot.archetypes.reduce((sum, stat) => sum + stat.battles, 0)
  return (
    <section className="space-y-4">
      <div className="panel p-4 sm:p-5">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Radar className="size-4 text-primary" />
          <h2 className="panel-title">Meta Deck Explorer</h2>
          <Badge variant="secondary" className="text-[10px]">
            {snapshot.decks.length} observed decks
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {groups.length} archetypes
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Every deck, usage number and win rate below is measured from{' '}
          <strong className="font-semibold text-foreground">{snapshot.battles}</strong> sampled
          battles across {snapshot.players} players ({snapshot.source} sample,{' '}
          {new Date(snapshot.generatedAt).toLocaleDateString()}, {slots.toLocaleString()} deck
          slots). Pick an archetype to inspect its real variants, trend and matchups.
        </p>
        {snapshot.notice && <p className="mt-1 text-[11px] text-amber-600/90">{snapshot.notice}</p>}
      </div>

      <motion.div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        initial="hidden"
        animate="show"
        variants={staggerParent}
      >
        {groups.map((group) => (
          <ArchetypeCard key={group.key} group={group} onOpen={onOpen} />
        ))}
      </motion.div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Archetype detail                                                    */
/* ------------------------------------------------------------------ */

type SortKey = 'usage' | 'win' | 'elixir'

function GroupDetail({
  group,
  snapshot,
  onBack,
}: {
  group: ArchetypeGroup
  snapshot: MetaSnapshot
  onBack: () => void
}) {
  const [sort, setSort] = useState<SortKey>('usage')
  const insight = useMemo(
    () => archetypeInsight(group, snapshot),
    [group, snapshot],
  )

  const sorted = useMemo(() => {
    const list = [...group.variants]
    if (sort === 'win') list.sort((a, b) => b.winRate - a.winRate || b.battles - a.battles)
    else if (sort === 'elixir') list.sort((a, b) => a.avgElixir - b.avgElixir || b.battles - a.battles)
    else list.sort((a, b) => b.usage - a.usage || b.battles - a.battles)
    return list
  }, [group.variants, sort])

  const bestPerforming = useMemo(() => {
    const tested = group.variants.filter((deck) => deck.battles >= 3)
    const pool = tested.length ? tested : group.variants
    return [...pool].sort((a, b) => b.winRate - a.winRate || b.battles - a.battles).slice(0, 5)
  }, [group.variants])

  const mostUsed = useMemo(
    () => [...group.variants].sort((a, b) => b.usage - a.usage || b.battles - a.battles).slice(0, 5),
    [group.variants],
  )

  const lead = insight[0] ?? ''
  const details = insight.slice(1)
  const hasHalves = typeof group.firstHalf === 'number' && typeof group.secondHalf === 'number'

  return (
    <section className="space-y-4">
      <FadeIn delay={0} className="panel p-4 sm:p-5">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All archetypes
        </button>

        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">{group.label}</h2>
              <Badge variant="secondary" className="text-[10px]">
                {group.variants.length} variant{group.variants.length === 1 ? '' : 's'}
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{group.blurb}</p>
          </div>
        </div>

        <FadeIn
          delay={0.05}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        >
          <StatTile
            label="Usage rate"
            value={`${group.share}%`}
            sub="of deck slots"
            accent="cyan"
          />
          <StatTile
            label="Win rate"
            value={`${group.winRate}%`}
            sub={`${group.battles} battles`}
            accent={group.winRate >= 50 ? 'green' : 'rose'}
          />
          <StatTile label="Battles" value={group.battles.toLocaleString()} sub="side decks" />
          <StatTile
            label="Trend"
            value={<TrendChip delta={group.trend} />}
            sub={
              hasHalves
                ? `${group.firstHalf}% → ${group.secondHalf}% halves`
                : 'single-half sample'
            }
          />
          <StatTile
            label="Variants"
            value={group.variants.length}
            sub="observed compositions"
            accent="gold"
          />
          <StatTile
            label="Avg elixir"
            value={group.avgElixir}
            sub="battle-weighted"
          />
        </FadeIn>

        {hasHalves && (
          <FadeIn
            delay={0.1}
            className="mt-4 rounded-xl border border-border bg-slate-50 p-3"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Share of the meta between sample halves
            </p>
            <div className="space-y-2">
              {[
                { label: 'First half', value: group.firstHalf!, tone: 'bg-slate-400' },
                { label: 'Second half', value: group.secondHalf!, tone: 'bg-primary' },
              ].map((bar) => (
                <div key={bar.label} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-[11px] text-muted-foreground">
                    {bar.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${bar.tone}`}
                      style={{ width: `${Math.min(100, bar.value)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs font-semibold tabular-nums">
                    {bar.value}%
                  </span>
                </div>
              ))}
            </div>
          </FadeIn>
        )}
      </FadeIn>

      {/* AI insight: an annotation built from the numbers above, never beyond them. */}
      <Reveal y={8} delay={0.06} className="panel border-l-2 border-l-primary/50 p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            <h3 className="text-[15px] font-semibold tracking-tight">AI insight</h3>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            Analyst note · from sample data
          </Badge>
        </div>
        {lead && <p className="text-sm leading-relaxed text-foreground">“{lead}”</p>}
        <ul className="mt-3 space-y-1.5">
          {details.map((line) => (
            <li key={line} className="flex gap-2 text-[13px] text-muted-foreground">
              <span
                className="mt-1.5 size-1 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Every figure above is read from this sample&apos;s battles and the matchup matrix — an
          explanation of the data, not a prediction.
        </p>
      </Reveal>

      {/* Popular variants table */}
      <FadeIn delay={0.12} className="panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Layers className="size-4 text-primary" />
            <h3 className="panel-title">Popular {group.label} decks</h3>
            <Badge variant="secondary" className="text-[10px]">
              {group.variants.length} in sample
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: 'usage', label: 'Usage' },
                { key: 'win', label: 'Win rate' },
                { key: 'elixir', label: 'Elixir' },
              ] as { key: SortKey; label: string }[]
            ).map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setSort(entry.key)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                  sort === entry.key
                    ? 'border-primary/60 bg-primary/15 text-primary'
                    : 'border-border bg-slate-50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table min-w-[760px]">
            <thead>
              <tr>
                <th>#</th>
                <th>Deck</th>
                <th>Usage</th>
                <th>Win rate</th>
                <th>Battles</th>
                <th>Avg elixir</th>
                <th>Trend</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <motion.tbody
              initial="hidden"
              animate="show"
              variants={staggerParent}
            >
              {sorted.map((deck, index) => (
                <motion.tr
                  key={deck.id}
                  variants={rowReveal}
                  layout
                  className="group/row"
                >
                  <td className="tabular-nums text-muted-foreground">{index + 1}</td>
                  <td className="min-w-[240px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">{deck.label}</span>
                      {variantBadges(deck)}
                    </div>
                    {variantCards(deck)}
                  </td>
                  <td className="tabular-nums">{deck.usage}%</td>
                  <td className="tabular-nums">{deck.winRate}%</td>
                  <td className="tabular-nums">{deck.battles}</td>
                  <td className="tabular-nums">{deck.avgElixir}</td>
                  <td>
                    <TrendChip delta={deck.trend} />
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2">
                        <Link href={deckHref(deck)}>
                          <Eye className="size-3.5" />
                          View
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2">
                        <Link href={analyzeHref(deck)}>
                          <FlaskConical className="size-3.5" />
                          Analyse
                        </Link>
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      </FadeIn>

      {/* Two leaderboards: best performing + most used */}
      <FadeIn delay={0.16} className="grid gap-4 md:grid-cols-2">
        {[
          { title: 'Best performing', hint: 'min. 3 battles', rows: bestPerforming, stat: 'win' },
          { title: 'Most used', hint: 'by sample usage', rows: mostUsed, stat: 'usage' },
        ].map((board) => (
          <div key={board.title} className="panel p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="panel-title">{board.title}</h3>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {board.hint}
              </span>
            </div>
            <ol className="divide-y divide-border/70">
              {board.rows.map((deck, index) => (
                <li key={deck.id}>
                  <Link
                    href={deckHref(deck)}
                    className="flex items-center gap-3 py-2 transition hover:text-primary"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-primary/15 text-[11px] font-black text-primary">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {deck.label}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {board.stat === 'win' ? `${deck.winRate}%` : `${deck.usage}%`}
                    </span>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                      {deck.battles} battles
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </FadeIn>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */

/**
 * Default content of the Deck Recommendation route: the meta itself,
 * archetype-first. Every number comes from the snapshot — no curated or
 * generated decks are ever shown here.
 */
export function MetaExplorer({
  snapshot,
  loading,
  onReload,
}: {
  snapshot: MetaSnapshot | null
  loading?: boolean
  onReload?: () => void
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const groups = useMemo(
    () => (snapshot ? buildExplorerGroups(snapshot) : []),
    [snapshot],
  )
  const group =
    selectedKey && snapshot
      ? groups.find((entry) => entry.key === selectedKey) ?? null
      : null

  if (loading && !snapshot) {
    return (
      <section className="space-y-4">
        <div className="panel h-24 animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_unused, index) => (
            <div key={index} className="panel h-48 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (!snapshot) {
    return (
      <section className="panel flex flex-col items-center gap-3 p-10 text-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={ENTRANCE}
          className="flex"
        >
          <Radar className="size-8 text-rose-600/70" />
        </motion.span>
        <motion.h3
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...ENTRANCE, delay: 0.05 }}
          className="text-lg font-semibold"
        >
          Meta data unavailable
        </motion.h3>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...ENTRANCE, delay: 0.1 }}
          className="max-w-md text-sm text-muted-foreground"
        >
          The explorer only shows measured battles. Retry the load — no numbers are
          displayed because none are available.
        </motion.p>
        {onReload && (
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...ENTRANCE, delay: 0.15 }}
            className="inline-flex"
          >
            <Button variant="outline" className="gap-2" onClick={onReload}>
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </motion.span>
        )}
      </section>
    )
  }

  if (!groups.length) {
    return (
      <section className="panel flex flex-col items-center gap-3 p-10 text-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={ENTRANCE}
          className="flex"
        >
          <Radar className="size-8 text-primary/60" />
        </motion.span>
        <motion.h3
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...ENTRANCE, delay: 0.05 }}
          className="text-lg font-semibold"
        >
          No complete decks in this sample yet
        </motion.h3>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...ENTRANCE, delay: 0.1 }}
          className="max-w-md text-sm text-muted-foreground"
        >
          The snapshot holds {snapshot.battles} battles but no complete 8-card deck
          signatures to group into archetypes.
        </motion.p>
      </section>
    )
  }

  if (group) {
    return (
      <GroupDetail group={group} snapshot={snapshot} onBack={() => setSelectedKey(null)} />
    )
  }

  return <ExplorerBoard groups={groups} snapshot={snapshot} onOpen={setSelectedKey} />
}
