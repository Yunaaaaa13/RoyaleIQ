'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ChevronDown,
  Database,
  Droplets,
  LayoutGrid,
  RefreshCw,
  Sparkles,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CardTile } from '@/components/card-tile'
import { StatTile } from '@/components/metrics'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ALL_CARDS, getCard } from '@/lib/cards'
import { ARCHETYPES } from '@/lib/archetypes'
import type { MetaSnapshot } from '@/lib/battle'

const DISTRIBUTION_COLORS = [
  '#2F80ED',
  '#174A8B',
  '#8FB8EC',
  '#F5B942',
  '#22A06B',
]

const CHART_TOOLTIP = {
  background: '#ffffff',
  border: '1px solid #E3EAF3',
  borderRadius: 8,
  fontSize: 12,
  color: '#172033',
}

function minutesAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes === 1) return '1 minute ago'
  return `${minutes} minutes ago`
}

function winTone(rate: number): string {
  if (rate >= 52) return 'text-emerald-600'
  if (rate <= 48) return 'text-rose-600'
  return 'text-foreground'
}

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

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="kpi h-24 animate-pulse" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="panel h-96 animate-pulse lg:col-span-7" />
        <div className="panel h-96 animate-pulse lg:col-span-5" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="panel h-80 animate-pulse lg:col-span-7" />
        <div className="panel h-80 animate-pulse lg:col-span-5" />
      </div>
      <div className="panel h-48 animate-pulse" />
    </div>
  )
}

export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState<MetaSnapshot | null>(null)
  const [error, setError] = useState(false)
  const [season, setSeason] = useState('s64')
  const [trophies, setTrophies] = useState('all')
  const [mode, setMode] = useState('ladder')

  useEffect(() => {
    let cancelled = false
    fetch('/api/meta', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: MetaSnapshot) => {
        if (!cancelled) setSnapshot(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Weighted mean win rate across decks — the baseline every trend chip
  // in the deck table is measured against.
  const deckBaseline = useMemo(() => {
    if (!snapshot?.decks.length) return 50
    const battles = snapshot.decks.reduce((sum, deck) => sum + deck.battles, 0)
    if (!battles) return 50
    return (
      snapshot.decks.reduce((sum, deck) => sum + deck.winRate * deck.battles, 0) / battles
    )
  }, [snapshot])

  const trendByKey = useMemo(() => {
    const map = new Map<string, number>()
    snapshot?.trending.forEach((entry) => map.set(entry.key, entry.delta))
    return map
  }, [snapshot])

  const metaTrendData = useMemo(
    () =>
      (snapshot?.trending ?? []).slice(0, 8).map((entry) => ({
        name: entry.label,
        first: entry.firstHalf,
        second: entry.secondHalf,
      })),
    [snapshot],
  )

  const distributionData = useMemo(() => {
    if (!snapshot) return []
    const byRarity = new Map<string, number>()
    snapshot.cards.forEach((card) => {
      byRarity.set(card.rarity, (byRarity.get(card.rarity) ?? 0) + card.battles)
    })
    const total = [...byRarity.values()].reduce((sum, value) => sum + value, 0) || 1
    return [...byRarity.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([rarity, battles], index) => ({
        name: rarity,
        value: Math.round((battles / total) * 1000) / 10,
        fill: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length],
      }))
  }, [snapshot])

  const insight = useMemo(() => {
    if (!snapshot) return null
    const lead = snapshot.topWinRate[0] ?? snapshot.cards[0]
    if (!lead) return null
    const leadCard = getCard(lead.key)
    const inTopDecks = snapshot.decks.filter((deck) => deck.cards.includes(lead.key))
    const topDeck = inTopDecks[0]
    const partner = snapshot.synergies
      .filter((pair) => pair.a === lead.key || pair.b === lead.key)
      .sort((a, b) => b.delta - a.delta)[0]
    const partnerKey = partner ? (partner.a === lead.key ? partner.b : partner.a) : null
    const partnerName = partnerKey ? getCard(partnerKey)?.name ?? null : null
    return { lead, leadCard, inTopDecks, topDeck, partner, partnerName }
  }, [snapshot])

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Alert className="border-rose-500/30 bg-rose-500/5">
          <AlertTitle>Meta unavailable</AlertTitle>
          <AlertDescription className="flex items-center gap-3">
            Could not load meta data.
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-4 sm:px-6">
      {/* Compact analytical header — no marketing hero. */}
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="page-title">Dashboard</h1>
            <p className="page-lede mt-1">
              Clash Royale Meta &amp; Performance Overview
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                Current season
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="size-3" aria-hidden />
                {snapshot ? `Updated ${minutesAgo(snapshot.generatedAt)}` : 'Loading sample…'}
              </span>
              <span aria-hidden className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">
                {ALL_CARDS.length} cards · {ARCHETYPES.length} archetypes · 5 independent scores
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={season} onValueChange={setSeason}>
              <SelectTrigger className="h-9 w-36 bg-card text-xs" aria-label="Season">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="s64">Season 64</SelectItem>
                <SelectItem value="s63">Season 63</SelectItem>
                <SelectItem value="s62">Season 62</SelectItem>
              </SelectContent>
            </Select>
            <Select value={trophies} onValueChange={setTrophies}>
              <SelectTrigger className="h-9 w-40 bg-card text-xs" aria-label="Trophy range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All trophies</SelectItem>
                <SelectItem value="low">0 – 4,000</SelectItem>
                <SelectItem value="mid">4,000 – 6,000</SelectItem>
                <SelectItem value="high">6,000+</SelectItem>
              </SelectContent>
            </Select>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="h-9 w-36 bg-card text-xs" aria-label="Game mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ladder">Ladder</SelectItem>
                <SelectItem value="challenge">Challenge</SelectItem>
                <SelectItem value="path">Path of Legends</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild size="sm" className="h-9 gap-1.5 rounded-lg px-4 font-semibold">
              <Link href="/deck-lab">
                Analyze deck
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Sample-wide figures cover the full ladder · {mode === 'ladder' ? 'Ladder' : mode === 'challenge' ? 'Challenge' : 'Path of Legends'} ·{' '}
          {trophies === 'all' ? 'all trophy ranges' : trophies === 'low' ? '0 – 4,000 trophies' : trophies === 'mid' ? '4,000 – 6,000 trophies' : '6,000+ trophies'}
        </p>
      </header>

      {!snapshot ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Total battles"
              value={snapshot.battles.toLocaleString()}
              sub={snapshot.source === 'live' ? 'live ladder feed' : 'simulated ladder sample'}
              accent={snapshot.source === 'live' ? 'green' : 'gold'}
              icon={<Swords className="size-4" />}
            />
            <StatTile
              label="Players tracked"
              value={snapshot.players.toLocaleString()}
              sub="across the current sample"
              icon={<Users className="size-4" />}
            />
            <StatTile
              label="Meta avg elixir"
              value={snapshot.avgElixir}
              sub="across all sampled decks"
              icon={<Droplets className="size-4" />}
            />
            <StatTile
              label="Cards classified"
              value={ALL_CARDS.length}
              sub={`${ARCHETYPES.length} archetype profiles`}
              icon={<LayoutGrid className="size-4" />}
            />
          </div>

          {/* Row 1: Meta Deck Rankings (dominant) + Meta Trend */}
          <div className="grid gap-4 lg:grid-cols-12">
            <section className="panel p-5 lg:col-span-7">
              <div className="panel-head">
                <div className="min-w-0">
                  <h2 className="text-[18px] font-semibold tracking-tight text-foreground">Meta deck rankings</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Top builds by win rate across the sample, measured against a{' '}
                    {deckBaseline.toFixed(1)}% deck baseline.
                  </p>
                </div>
                <Link
                  href="/meta"
                  className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Full meta
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[560px]">
                  <thead>
                    <tr>
                      <th className="w-8 text-center">#</th>
                      <th>Deck</th>
                      <th className="text-right">Usage</th>
                      <th className="text-right">Win rate</th>
                      <th className="text-right">Avg elixir</th>
                      <th className="text-right">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.decks.slice(0, 8).map((deck, index) => (
                      <tr key={deck.id}>
                        <td className="text-center">
                          <span
                            className={`text-xs font-bold tabular-nums ${
                              index < 3 ? 'text-amber-600' : 'text-muted-foreground'
                            }`}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/decks/${encodeURIComponent(deck.cards.join(','))}`}
                            className="flex items-center gap-2 transition hover:text-primary"
                          >
                            <span className="flex shrink-0 gap-0.5">
                              {deck.cards.slice(0, 4).map((key) => (
                                <CardTile
                                  key={`${deck.id}-${key}`}
                                  cardKey={key}
                                  size="xxs"
                                  showElixir={false}
                                />
                              ))}
                            </span>
                            <span className="truncate text-[13px] font-medium">
                              {deck.label}
                            </span>
                          </Link>
                        </td>
                        <td className="text-right tabular-nums text-muted-foreground">
                          {deck.usage}%
                        </td>
                        <td className={`text-right font-semibold tabular-nums ${winTone(deck.winRate)}`}>
                          {deck.winRate}%
                        </td>
                        <td className="text-right tabular-nums">{deck.avgElixir}</td>
                        <td className="text-right">
                          <TrendChip delta={Math.round((deck.winRate - deckBaseline) * 10) / 10} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel p-5 lg:col-span-5">
              <div className="panel-head">
                <div className="min-w-0">
                  <h2 className="text-[18px] font-semibold tracking-tight text-foreground">Meta trend</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Usage of trending cards, first half vs second half of the sample.
                  </p>
                </div>
              </div>
              {metaTrendData.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={metaTrendData}
                      margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(15,23,42,0.08)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#6B7280', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        angle={-24}
                        textAnchor="end"
                        height={52}
                      />
                      <YAxis
                        tick={{ fill: '#6B7280', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        unit="%"
                      />
                      <ReTooltip contentStyle={CHART_TOOLTIP} formatter={(v) => [`${v}%`]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
                      <Line
                        type="monotone"
                        dataKey="first"
                        name="First half"
                        stroke="#8FB8EC"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#8FB8EC' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="second"
                        name="Second half"
                        stroke="#2F80ED"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#2F80ED' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                  Not enough history in the sample to show trends yet.
                </p>
              )}
            </section>
          </div>

          {/* Row 2: Top Performing Cards + Card Distribution */}
          <div className="grid gap-4 lg:grid-cols-12">
            <section className="panel p-5 lg:col-span-7">
              <div className="panel-head">
                <div className="min-w-0">
                  <h2 className="text-[18px] font-semibold tracking-tight text-foreground">Top performing cards</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Highest win rates among cards with a meaningful share of games.
                  </p>
                </div>
                <Link
                  href="/cards"
                  className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Card analytics
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <ul className="divide-y divide-border/60">
                {snapshot.topWinRate.slice(0, 8).map((card, index) => (
                  <li key={card.key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <CardTile cardKey={card.key} size="xs" showElixir={false} />
                    <Link
                      href={`/cards/${card.key}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium transition hover:text-primary"
                    >
                      {card.name}
                    </Link>
                    <span className="hidden w-16 text-right text-xs tabular-nums text-muted-foreground sm:block">
                      {card.usage}% use
                    </span>
                    <span className={`w-16 text-right text-sm font-bold tabular-nums ${winTone(card.winRate)}`}>
                      {card.winRate}%
                    </span>
                    <span className="w-16 text-right">
                      <TrendChip delta={trendByKey.get(card.key)} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel p-5 lg:col-span-5">
              <div className="panel-head">
                <div className="min-w-0">
                  <h2 className="text-[18px] font-semibold tracking-tight text-foreground">Card distribution</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Share of sampled battles by card rarity.
                  </p>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={54}
                      outerRadius={88}
                      paddingAngle={2}
                      stroke="#E3EAF3"
                    >
                      {distributionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ReTooltip
                      contentStyle={CHART_TOOLTIP}
                      formatter={(value, name) => [`${value}%`, String(name)]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* AI insight: analyst annotation attached to the data, not a chatbot. */}
          {insight && (
            <section className="panel p-5">
              <div className="panel-head">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" aria-hidden />
                  <h2 className="text-[18px] font-semibold tracking-tight text-foreground">AI insight</h2>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  Analyst note
                </Badge>
              </div>
              <p className="max-w-3xl text-[15px] leading-relaxed text-foreground">
                “{insight.lead.name} is the strongest high-usage card in the current
                sample — {insight.lead.usage}% usage at a {insight.lead.winRate}% win
                rate. It anchors the decks at the top of the meta.”
              </p>
              <div className="mt-4 grid gap-5 md:grid-cols-3">
                <div>
                  <h3 className="section-title mb-2">Why?</h3>
                  <ul className="space-y-1.5 text-[13px] text-muted-foreground">
                    <li className="flex gap-2">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                      {insight.lead.elixir} elixir · {insight.leadCard?.rarity ?? ''} — fits
                      most cycle curves
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                      Appears in {insight.inTopDecks.length} of the top{' '}
                      {snapshot.decks.length} sampled decks
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                      {insight.topDeck
                        ? `Carried by ${insight.topDeck.label} at ${insight.topDeck.winRate}% win rate`
                        : 'Above the 50% win-rate line across the sample'}
                    </li>
                  </ul>
                </div>
                <div className="md:col-span-2">
                  <h3 className="section-title mb-2">Recommendation</h3>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {insight.partner && insight.partnerName
                      ? `${insight.lead.name} travels best with ${insight.partnerName} — the pair posts ${
                          insight.partner.delta >= 0 ? '+' : ''
                        }${insight.partner.delta}pp against its cards' baseline over ${insight.partner.battles} battles. Build around that core, then fill the remaining slots for air defence and a big spell.`
                      : `Pair ${insight.lead.name} with cards that cover its weaknesses — air defence and a big spell — before adding a second win condition.`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                      <Link href={`/cards/${insight.lead.key}`}>
                        <Target className="size-3.5" />
                        View {insight.lead.name}
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                      <Link href="/ai-coach">
                        <Database className="size-3.5" />
                        Open full AI recommendation
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Source context footer strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <p className="inline-flex items-center gap-1.5">
              <ChevronDown className="size-3" aria-hidden />
              {snapshot.notice ?? `Sample generated at ${new Date(snapshot.generatedAt).toLocaleString()}`}
            </p>
            <Link
              href="/data-pipeline"
              className="inline-flex items-center gap-1 font-medium text-primary transition-colors hover:text-primary/80"
            >
              Data pipeline
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
