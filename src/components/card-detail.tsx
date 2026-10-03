'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, ArrowRight, Sparkles, Target } from 'lucide-react'
import { CardTile } from '@/components/card-tile'
import { StatTile } from '@/components/metrics'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { CardIntel, RecommendedDeck } from '@/lib/card-intel'
import { cn, relativeAge } from '@/lib/utils'

const winTone = (rate: number) =>
  rate >= 52 ? 'text-emerald-300' : rate <= 48 ? 'text-rose-300' : ''

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="panel h-40 animate-pulse" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel h-72 animate-pulse" />
        <div className="panel h-72 animate-pulse" />
      </div>
      <div className="panel h-56 animate-pulse" />
    </div>
  )
}

function AiScore({ deck }: { deck: RecommendedDeck }) {
  return (
    <div className="rounded-lg border border-border bg-white/[0.03] p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">AI Score</span>
        <span className="text-sm font-bold tabular-nums text-yellow-300">
          {deck.aiScore}
          <span className="text-muted-foreground">/100</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-yellow-400"
          style={{ width: `${deck.aiScore}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
        win rate {deck.scoreParts.results}/55 · usage {deck.scoreParts.popularity}/25 · sample{' '}
        {deck.scoreParts.confidence}/20
      </p>
    </div>
  )
}

export function CardDetail({ cardKey }: { cardKey: string }) {
  const [intel, setIntel] = useState<CardIntel | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    ;(async () => {
      try {
        const response = await fetch(`/api/cards/${encodeURIComponent(cardKey)}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const body = (await response.json()) as CardIntel & { reason?: string }
        if (cancelled) return
        if (!response.ok) {
          setError(body.reason ?? 'That card could not be loaded.')
          return
        }
        setIntel(body)
      } catch (reason) {
        if (cancelled || controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : 'Could not reach the analytics API.')
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [cardKey])

  if (error) {
    return (
      <Alert className="border-rose-400/30 bg-rose-400/10" role="alert">
        <AlertTitle>Card not found</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error}</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/cards">Back to all cards</Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!intel) return <Skeleton />

  const { overview, trend, decks, synergy, counters, insight, sample } = intel
  const delta = overview?.trendDelta ?? null
  const trendData = trend.points.map((point) => ({
    ...point,
    label: timeLabel(point.at),
  }))

  return (
    <div className="space-y-4">
      {intel.notice && (
        <Alert className="border-amber-400/30 bg-amber-400/10">
          <AlertTriangle className="size-4" />
          <AlertTitle>About this sample</AlertTitle>
          <AlertDescription>{intel.notice}</AlertDescription>
        </Alert>
      )}

      {overview?.lowSample && (
        <Alert className="border-amber-400/30 bg-amber-400/10">
          <AlertTriangle className="size-4" />
          <AlertTitle>Small sample</AlertTitle>
          <AlertDescription>
            The win rate for {intel.card.name} rests on {overview.battles} battles, under the{' '}
            {intel.gates.cardBattles}-battle line this page treats as settled. Read it as
            indicative rather than as a verdict.
          </AlertDescription>
        </Alert>
      )}

      <section className="panel p-5">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div className="min-w-0 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
              <StatTile
                label="Usage rate"
                value={overview ? `${overview.usage}%` : '—'}
                sub={overview ? `${overview.battles} battles` : 'outside this window'}
                accent="gold"
              />
              <StatTile
                label="Win rate"
                value={overview ? `${overview.winRate}%` : '—'}
                sub={
                  overview
                    ? `${overview.wins} wins of ${overview.battles} battles${
                        overview.lowSample ? ' · small sample' : ''
                      }`
                    : 'outside this window'
                }
                accent={overview && overview.winRate >= 50 ? 'green' : 'rose'}
              />
              <StatTile
                label="Avg deck elixir"
                value={overview?.avgDeckElixir ?? '—'}
                sub={
                  overview?.decksInSample
                    ? `${overview.decksInSample} deck${overview.decksInSample === 1 ? '' : 's'} in sample`
                    : 'no qualifying deck'
                }
                accent="cyan"
              />
              <StatTile
                label="Usage trend"
                value={delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}pp`}
                sub="first vs last stored snapshot"
                accent={delta === null || delta >= 0 ? 'green' : 'rose'}
              />
              <StatTile label="Card cost" value={`${intel.card.elixir}`} sub={intel.card.rarity} accent="gold" />
              <StatTile
                label="Sample"
                value={sample ? `${sample.battles}` : '—'}
                sub={sample ? `${sample.players} players · ${relativeAge(sample.generatedAt)}` : 'unavailable'}
                accent="cyan"
              />
            </div>

            <div className="rounded-xl border border-border bg-white/[0.03] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="section-title">
                  Usage trend
                </h3>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-yellow-400" /> Usage %
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-cyan-400" /> Win rate %
                  </span>
                </div>
              </div>
              {trend.reason ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{trend.reason}</p>
              ) : (
                <div className="h-48 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }}
                        minTickGap={28}
                      />
                      <YAxis
                        domain={[0, 100]}
                        width={36}
                        tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }}
                      />
                      <ReTooltip
                        contentStyle={{
                          background: '#0b1020',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: 10,
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="usage"
                        name="Usage %"
                        stroke="#facc15"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="winRate"
                        name="Win rate %"
                        stroke="#22d3ee"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {trend.points.length > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {trend.snapshots} stored meta snapshots
                  {sample ? ` · sample of ${sample.battles} battles` : ''}
                </p>
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            {/* The page header already carries the role badges, so this column
                only adds the combat facts they do not cover. */}
            <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              <span>{intel.card.air ? 'Targets air' : 'Targets ground only'}</span>
              {intel.card.fly && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Flies</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{intel.card.aoe ? 'Area damage' : 'Single target'}</span>
              <span aria-hidden="true">·</span>
              <span>DPS tier {intel.card.dps}/3</span>
            </div>

            {insight && (
              <div className="rounded-xl border border-yellow-300/20 bg-yellow-400/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="size-4 text-yellow-300" />
                  <h3 className="text-sm font-semibold">AI intelligence</h3>
                </div>
                <p className="mb-3 text-sm leading-relaxed">{insight.headline}</p>
                <dl className="space-y-2.5">
                  {insight.items.map((item) => (
                    <div key={item.label}>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-yellow-200/80">
                        {item.label}
                      </dt>
                      <dd className="text-xs leading-relaxed text-muted-foreground">{item.text}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-[10px] leading-snug text-muted-foreground">
                  Written from the numbers above by fixed rules - no model call, no invented figures.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="panel-title">Recommended decks</h3>
          <p className="text-xs text-muted-foreground">
            {decks.decks.length} build{decks.decks.length === 1 ? '' : 's'} carrying{' '}
            {intel.card.name} · {decks.minBattles}+ battles each
          </p>
        </div>
        <p className="mb-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          {decks.basis}
        </p>

        {decks.decks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No deck signature with this card has reached {decks.minBattles} battles in the current
            sample yet. The card itself may still be common - check the usage tile above.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {decks.decks.map((deck) => (
              <article key={deck.id} className="rounded-xl border border-border bg-white/[0.03] p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">#{deck.rank}</p>
                    <p className="truncate text-sm font-semibold">{deck.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {deck.archetypeLabel} · {deck.avgElixir} avg · {deck.battles} battles
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn('text-sm font-bold tabular-nums', winTone(deck.winRate))}>
                      {deck.winRate}%
                    </p>
                    <p className="text-[11px] text-muted-foreground">{deck.usage}% usage</p>
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap gap-1">
                  {deck.cards.map((key) => (
                    <CardTile key={`${deck.id}-${key}`} cardKey={key} size="xxs" showElixir={false} />
                  ))}
                </div>
                <AiScore deck={deck} />
                <Button asChild size="sm" variant="outline" className="mt-3 h-8 w-full">
                  <Link href={`/deck-lab?deck=${encodeURIComponent(deck.cards.join(','))}`}>
                    Open in Deck Lab
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        )}

        {decks.hidden > 0 && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            +{decks.hidden} smaller sample{decks.hidden === 1 ? '' : 's'} hidden below{' '}
            {decks.minBattles} battles.
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h3 className="panel-title">Synergy analysis</h3>
            <span className="text-xs text-muted-foreground">{synergy.pairs.length} pairs</span>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            Pairs published from the aggregate: lift is how much more often the two travel together
            than chance, delta is the pair&apos;s win rate minus the mean of the cards&apos; own rates.
          </p>

          {synergy.reason ? (
            <p className="text-sm text-muted-foreground">{synergy.reason}</p>
          ) : (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Best pair', entry: synergy.bestPair },
                  { label: 'Best support', entry: synergy.bestSupport },
                  { label: 'Best win condition', entry: synergy.bestWinCondition },
                ].map(({ label, entry }) => (
                  <div key={label} className="rounded-xl border border-border bg-white/[0.03] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    {entry ? (
                      <>
                        <div className="mt-2 flex items-center gap-2">
                          <CardTile cardKey={entry.key} size="xs" showElixir={false} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{entry.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              lift {entry.lift}× · {entry.battles} battles
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {entry.roleLabels.join(', ')}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">Not in the sample.</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Partner</th>
                      <th className="py-2 pr-3 text-right font-medium">Lift</th>
                      <th className="hidden py-2 pr-3 text-right font-medium sm:table-cell">
                        Battles
                      </th>
                      <th className="py-2 pr-3 text-right font-medium">Win rate</th>
                      <th className="py-2 text-right font-medium">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {synergy.pairs.map((pair) => (
                      <tr key={pair.key} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-3">
                          <Link
                            href={`/cards/${pair.key}`}
                            className="font-medium transition hover:text-yellow-200"
                          >
                            {pair.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{pair.lift}×</td>
                        <td className="hidden py-2 pr-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                          {pair.battles}
                        </td>
                        <td className={cn('py-2 pr-3 text-right tabular-nums', winTone(pair.winRate))}>
                          {pair.winRate}%
                        </td>
                        <td
                          className={cn(
                            'py-2 text-right tabular-nums',
                            pair.delta >= 0 ? 'text-emerald-300' : 'text-rose-300',
                          )}
                        >
                          {pair.delta > 0 ? '+' : ''}
                          {pair.delta}pp
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section className="panel p-5">
          <div className="mb-1 flex items-center gap-2">
            <Target className="size-4 text-cyan-300" />
            <h3 className="panel-title">Counter analysis</h3>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            What this card beats and loses to, measured rather than guessed.
          </p>

          {counters.available ? (
            <>
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{counters.reason}</p>
              {counters.lowSample && (
                <p className="mb-3 text-[11px] font-medium text-amber-300">
                  Small sample - treat every rate below as a hint, not a verdict.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ['Beats most often', 'best', 'text-emerald-300', 'text-emerald-300/80'],
                  ['Loses to most often', 'worst', 'text-rose-300', 'text-rose-300/80'],
                ] as const).map(([title, side, valueTone, titleTone]) => (
                  <div key={side} className="min-w-0">
                    <h4 className={`mb-1.5 text-[11px] font-semibold uppercase tracking-wide ${titleTone}`}>
                      {title}
                    </h4>
                    <ul className="space-y-1.5">
                      {counters[side].length ? (
                        counters[side].map((row) => (
                          <li
                            key={row.key}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white/[0.03] px-3 py-2"
                          >
                            <span className="min-w-0 truncate text-xs">{row.label}</span>
                            <span className="shrink-0 text-right">
                              <span className={`block text-xs font-bold tabular-nums ${valueTone}`}>
                                {row.winRate}%
                              </span>
                              <span className="block font-mono text-[10px] tabular-nums text-muted-foreground">
                                n={row.games}
                              </span>
                            </span>
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-muted-foreground">
                          No pairing clears the {counters.minCellGames}-game line yet.
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href={counters.link}>
                  {counters.linkLabel}
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </>
          ) : (
            <Alert className="border-cyan-400/25 bg-cyan-400/5">
              <AlertTitle>Not measured at card level</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{counters.reason}</p>
                <Button asChild variant="outline" size="sm">
                  <Link href={counters.link}>
                    {counters.linkLabel}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </section>
      </div>
    </div>
  )
}
