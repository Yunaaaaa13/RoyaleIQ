'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Flame, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { CardTile } from '@/components/card-tile'
import type { MetaSnapshot } from '@/lib/battle'

export function HomeMetaPulse() {
  const [snapshot, setSnapshot] = useState<MetaSnapshot | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/meta', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: MetaSnapshot) => {
        if (!cancelled) setSnapshot(data)
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 panel-title">
            <Flame className="size-4 text-orange-600" />
            Meta today
          </h2>
          <p className="text-xs text-muted-foreground">
            {snapshot
              ? `${snapshot.battles} battles sampled · ${snapshot.source === 'live' ? 'live ladder data' : 'demo dataset'}`
              : 'Loading sample…'}
          </p>
        </div>
        <Link
          href="/meta"
          className="flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          Full dashboard
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="section-title">
            Top decks
          </p>
          {snapshot?.decks.slice(0, 4).map((deck) => (
            <div
              key={deck.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-slate-50 p-3"
            >
              <div className="flex -space-x-2">
                {deck.cards.slice(0, 4).map((key) => (
                  <div key={`${deck.id}-${key}`} className="ring-2 ring-background rounded-md">
                    <CardTile cardKey={key} size="xs" showElixir={false} />
                  </div>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{deck.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {deck.avgElixir} avg elixir · {deck.battles} battles
                </p>
              </div>
              <span
                className={`text-sm font-bold tabular-nums ${
                  deck.winRate >= 52
                    ? 'text-emerald-600'
                    : deck.winRate <= 48
                      ? 'text-rose-600'
                      : ''
                }`}
              >
                {deck.winRate}%
              </span>
            </div>
          ))}
          {!snapshot && (
            <>
              <div className="h-16 animate-pulse rounded-xl bg-slate-50" />
              <div className="h-16 animate-pulse rounded-xl bg-slate-50" />
            </>
          )}
        </div>

        <div className="space-y-3">
          <p className="section-title">
            Trending cards
          </p>
          <div className="grid grid-cols-2 gap-2">
            {snapshot?.trending.slice(0, 4).map((entry) => (
              <div
                key={entry.key}
                className="flex items-center gap-2 rounded-xl border border-border bg-slate-50 p-3"
              >
                <CardTile cardKey={entry.key} size="xs" showElixir={false} />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{entry.label}</p>
                  <p
                    className={`flex items-center gap-1 text-[11px] font-bold ${
                      entry.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {entry.delta >= 0 ? (
                      <TrendingUp className="size-3" />
                    ) : (
                      <TrendingDown className="size-3" />
                    )}
                    {entry.delta > 0 ? '+' : ''}
                    {entry.delta}%
                  </p>
                </div>
              </div>
            ))}
            {!snapshot && (
              <>
                <div className="h-16 animate-pulse rounded-xl bg-slate-50" />
                <div className="h-16 animate-pulse rounded-xl bg-slate-50" />
              </>
            )}
          </div>

          {snapshot && (
            <div className="rounded-xl border border-border bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Most played card
              </p>
              <div className="mt-2 flex items-center gap-3">
                <CardTile cardKey={snapshot.cards[0]?.key ?? 'knight'} size="xs" />
                <div>
                  <p className="text-sm font-semibold">
                    {snapshot.cards[0]?.name ?? '—'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {snapshot.cards[0]?.usage}% usage · {snapshot.cards[0]?.winRate}% win
                    rate
                  </p>
                </div>
                <span className="ml-auto text-primary/70">
                  <RefreshCw className="size-4" />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
