'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bar,
  BarChart,
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
import { Database, RefreshCw, Search, TrendingDown, TrendingUp } from 'lucide-react'
import { CardTile } from '@/components/card-tile'
import { CardSynergy } from '@/components/card-synergy'
import { DeckFamilies } from '@/components/deck-families'
import { MetaMatrix } from '@/components/meta-matrix'
import { BarList, StatTile } from '@/components/metrics'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MetaSnapshot } from '@/lib/battle'

const PIE_COLORS = [
  '#3b82f6',
  '#22d3ee',
  '#a78bfa',
  '#facc15',
  '#34d399',
  '#fb7185',
  '#60a5fa',
  '#e879f9',
]

type SortKey = 'usage' | 'winRate' | 'name' | 'elixir'

export function MetaDashboard() {
  const [snapshot, setSnapshot] = useState<MetaSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('usage')
  const [rarity, setRarity] = useState('all')

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/meta', { cache: 'no-store' })
      const payload = (await response.json()) as MetaSnapshot
      if (!response.ok) throw new Error('bad response')
      setSnapshot(payload)
      setError(null)
    } catch {
      setError('Could not load meta data.')
    } finally {
      setLoading(false)
    }
  }, [])

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    void load()
  }, [load])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const cards = useMemo(() => {
    if (!snapshot) return []
    const needle = query.trim().toLowerCase()
    return snapshot.cards
      .filter(
        (card) =>
          (rarity === 'all' || card.rarity === rarity) &&
          (!needle || card.name.toLowerCase().includes(needle)),
      )
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name)
        if (sort === 'elixir') return a.elixir - b.elixir
        return b[sort] - a[sort]
      })
  }, [snapshot, query, sort, rarity])

  const usageLeaders = useMemo(
    () =>
      [...(snapshot?.cards ?? [])]
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 8)
        .map((card) => ({
          label: card.name,
          value: card.usage,
          display: `${card.usage}%`,
          tone: 'bg-cyan-400',
        })),
    [snapshot],
  )

  const archetypeData = useMemo(
    () =>
      (snapshot?.archetypes ?? []).map((entry, index) => ({
        name: entry.label,
        value: entry.share,
        battles: entry.battles,
        winRate: entry.winRate,
        fill: PIE_COLORS[index % PIE_COLORS.length],
      })),
    [snapshot],
  )

  const winRateDomain = useMemo(() => {
    const rates = (snapshot?.topWinRate ?? []).map((card) => card.winRate)
    if (!rates.length) return [40, 65] as [number, number]
    // A fixed window silently clips any card that falls outside it.
    const min = Math.max(0, Math.floor(Math.min(...rates, 50) - 3))
    const max = Math.min(100, Math.ceil(Math.max(...rates, 50) + 3))
    return [min, max] as [number, number]
  }, [snapshot])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="panel h-24 animate-pulse" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="panel h-72 animate-pulse lg:col-span-2" />
          <div className="panel h-72 animate-pulse" />
        </div>
        <div className="panel h-80 animate-pulse" />
      </div>
    )
  }

  if (error || !snapshot) {
    return (
      <Alert className="border-rose-400/30 bg-rose-400/10">
        <AlertTitle>Meta unavailable</AlertTitle>
        <AlertDescription className="flex items-center gap-3">
          {error}
          <Button size="sm" variant="outline" onClick={reload}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-5">
      {snapshot.notice && (
        <Alert className="border-yellow-400/30 bg-yellow-400/10">
          <AlertTitle className="flex items-center gap-2">
            <Database className="size-4" />
            {snapshot.source === 'demo' ? 'Demo dataset' : 'Serving a stored sample'}
          </AlertTitle>
          <AlertDescription>{snapshot.notice}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Battles sampled"
          value={snapshot.battles.toLocaleString()}
          sub={snapshot.source === 'live' ? 'live ladder feed' : 'simulated ladder'}
          accent={snapshot.source === 'live' ? 'green' : 'gold'}
        />
        <StatTile label="Players tracked" value={snapshot.players} />
        <StatTile
          label="Meta avg elixir"
          value={snapshot.avgElixir}
          sub="across all sampled decks"
          accent="cyan"
        />
        <StatTile
          label="Sample generated"
          value={new Date(snapshot.generatedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
          sub={snapshot.source === 'live' ? 'revalidates every 10 min' : 'on demand'}
        />
      </div>

      <MetaMatrix snapshot={snapshot} />

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="panel p-5 lg:col-span-3">
          <div className="panel-head">
            <h3 className="panel-title">Top cards by usage</h3>
            <span className="text-[11px] text-muted-foreground">share of the sample</span>
          </div>
          <BarList items={usageLeaders} />
        </section>

        <section className="panel p-5 lg:col-span-2">
          <div className="panel-head">
            <h3 className="panel-title">Archetype share</h3>
            <span className="text-[11px] text-muted-foreground">by battles</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={archetypeData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="rgba(0,0,0,0.4)"
                >
                  {archetypeData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <ReTooltip
                  contentStyle={{
                    background: '#141a2e',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [`${value}%`, String(name)]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="panel p-5">
        <div className="panel-head">
          <h3 className="panel-title">Card analytics</h3>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <div className="relative grow sm:grow-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter cards…"
              className="h-9 w-full pl-9 sm:w-44"
            />
          </div>
          <Select value={rarity} onValueChange={setRarity}>
            <SelectTrigger className="h-9 min-w-0 flex-1 sm:w-36 sm:flex-none">
              <SelectValue placeholder="Rarity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rarities</SelectItem>
              <SelectItem value="Common">Common</SelectItem>
              <SelectItem value="Rare">Rare</SelectItem>
              <SelectItem value="Epic">Epic</SelectItem>
              <SelectItem value="Legendary">Legendary</SelectItem>
              <SelectItem value="Champion">Champion</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger className="h-9 min-w-0 flex-1 sm:w-36 sm:flex-none">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usage">Usage</SelectItem>
              <SelectItem value="winRate">Win rate</SelectItem>
              <SelectItem value="elixir">Elixir</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/80 text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="py-2.5 pr-3 font-semibold">Card</th>
                <th className="hidden py-2.5 pr-3 text-right font-semibold sm:table-cell">Elixir</th>
                <th className="hidden py-2.5 pr-3 text-right font-semibold sm:table-cell">Battles</th>
                <th className="py-2.5 pr-3 text-right font-semibold">Usage</th>
                <th className="py-2.5 text-right font-semibold">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr
                  key={card.key}
                  className="border-b border-border/50 transition hover:bg-white/[0.04]"
                >
                  <td className="py-2 pr-3">
                    <Link
                      href={`/cards/${card.key}`}
                      className="flex items-center gap-2 transition hover:text-primary"
                    >
                      <CardTile cardKey={card.key} size="xs" showElixir={false} />
                      <span className="font-medium">{card.name}</span>
                    </Link>
                  </td>
                  <td className="hidden py-2 pr-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                    {card.elixir}
                  </td>
                  <td className="hidden py-2 pr-3 text-right tabular-nums sm:table-cell">
                    {card.battles}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{card.usage}%</td>
                  <td
                    className={`py-2 text-right font-semibold tabular-nums ${
                      card.winRate >= 52
                        ? 'text-emerald-300'
                        : card.winRate <= 48
                          ? 'text-rose-300'
                          : ''
                    }`}
                  >
                    {card.winRate}%
                  </td>
                </tr>
              ))}
              {!cards.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No cards match that filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* `grid-cols-1` clamps the implicit column to `minmax(0,1fr)` - without
          it the single-column track sizes to max-content and these two panels
          push the page wider than a 320px viewport. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="panel-head">
            <div>
              <h3 className="panel-title flex items-center gap-2">
                <RefreshCw className="size-4 text-primary" />
                Trending cards
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Usage in the second half of the sample versus the first half.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {(snapshot.trending ?? []).map((entry) => (
              <div key={entry.key} className="flex items-center gap-3">
                <CardTile cardKey={entry.key} size="xs" showElixir={false} />
                <Link
                  href={`/cards/${entry.key}`}
                  className="flex-1 truncate text-sm transition hover:text-primary"
                >
                  {entry.label}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {entry.firstHalf}% → {entry.secondHalf}%
                </span>
                <Badge
                  variant="outline"
                  className={
                    entry.delta >= 0
                      ? 'gap-1 text-emerald-300'
                      : 'gap-1 text-rose-300'
                  }
                >
                  {entry.delta >= 0 ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  {entry.delta > 0 ? '+' : ''}
                  {entry.delta}%
                </Badge>
              </div>
            ))}
            {!snapshot.trending?.length && (
              <p className="text-sm text-muted-foreground">
                Not enough history in the sample to show trends yet.
              </p>
            )}
          </div>
        </section>

        <section className="panel p-5">
          <div className="panel-head">
            <div>
              <h3 className="panel-title">Highest win rate cards</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Cards that show up in a meaningful share of games first.
              </p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={snapshot.topWinRate.map((card) => ({
                  name: card.name,
                  winRate: card.winRate,
                }))}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                <XAxis
                  type="number"
                  domain={winRateDomain}
                  tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={96}
                  tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReTooltip
                  cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                  contentStyle={{
                    background: '#141a2e',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value) => [`${value}%`, 'Win rate']}
                />
                <Bar dataKey="winRate" fill="#34d399" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <DeckFamilies snapshot={snapshot} />

      <CardSynergy snapshot={snapshot} />

      <section className="panel p-5">
        <div className="panel-head">
          <div>
            <h3 className="panel-title">Top performing decks</h3>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
              Decks grouped by exact 8-card signature across the sample. Variant builds are folded
              into families above; this is the per-signature breakdown underneath.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.decks.slice(0, 9).map((deck) => (
            <article
              key={deck.id}
              className="rounded-xl border border-border/70 bg-white/[0.03] p-4 transition-colors hover:border-primary/35 hover:bg-white/[0.05]"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{deck.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {deck.avgElixir} avg · {deck.battles} battles
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      deck.winRate >= 52
                        ? 'text-emerald-300'
                        : deck.winRate <= 48
                          ? 'text-rose-300'
                          : ''
                    }`}
                  >
                    {deck.winRate}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {deck.usage}% usage
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {deck.cards.map((key) => (
                  <CardTile
                    key={`${deck.id}-${key}`}
                    cardKey={key}
                    size="xs"
                    showElixir={false}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel p-5">
        <div className="panel-head">
          <div>
            <h3 className="panel-title">Archetype performance</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Win rate and ladder share for every archetype in the sample.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="h-56 min-w-[560px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={archetypeData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={54}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReTooltip
                  contentStyle={{
                    background: '#141a2e',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="winRate"
                  name="Win rate"
                  stroke="#facc15"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#facc15' }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Share %"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#22d3ee' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {snapshot.archetypes.map((entry, index) => (
            <span
              key={entry.key}
              className="flex items-center gap-2 rounded-full border border-border bg-white/[0.03] px-3 py-1 text-xs"
            >
              <span
                className="size-2 rounded-full"
                style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
              />
              {entry.label}
              <span className="text-muted-foreground">{entry.share}%</span>
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
