'use client'

import { useMemo } from 'react'
import { GitMerge } from 'lucide-react'
import { CardTile } from '@/components/card-tile'
import { getCard } from '@/lib/cards'
import type { MetaSnapshot } from '@/lib/battle'
import {
  isPackage,
  isResult,
  MIN_PACKAGE_BATTLES,
  MIN_PACKAGE_LIFT,
  MIN_RESULT_BATTLES,
  MIN_RESULT_DECKS,
} from '@/lib/synergy'

const nameOf = (key: string) => getCard(key)?.name ?? key

export function CardSynergy({ snapshot }: { snapshot: MetaSnapshot }) {
  const pairs = snapshot.synergies

  const { packages, measured } = useMemo(() => {
    const list = Array.isArray(pairs) ? pairs : []
    const packages = list
      .filter(isPackage)
      .sort((a, b) => b.lift - a.lift)
      .slice(0, 8)

    const eligible = list.filter(isResult)
    // Split on the sign, not on rank: sorting the same eligible list from both
    // ends renders the identical pairs under both headings whenever the sample
    // holds five or fewer of them. `isResult` already rejects a zero delta, so
    // every pair lands in exactly one column.
    const ahead = eligible.filter((pair) => pair.delta > 0)
    const behind = eligible.filter((pair) => pair.delta < 0)
    const measured = {
      best: ahead.sort((a, b) => b.delta - a.delta).slice(0, 5),
      worst: behind.sort((a, b) => a.delta - b.delta).slice(0, 5),
    }

    return { packages, measured }
  }, [pairs])

  // Snapshots stored before this metric existed simply do not carry it - say
  // nothing rather than rendering a panel that claims a sample of zero.
  if (!Array.isArray(pairs)) return null

  const hasResults = measured.best.length > 0 || measured.worst.length > 0

  return (
    <section className="panel p-5">
      <h3 className="mb-1 flex items-center gap-2 panel-title">
        <GitMerge className="size-4 text-amber-300" />
        Card synergy
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Two questions about a pair of cards. How often they travel together, measured across
        every team deck in the sample. And how they actually do together - but a pair that only
        exists inside one build simply inherits that build&apos;s record, so the results below
        only show pairs that turn up in at least {MIN_RESULT_DECKS} different builds.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* min-w-0: without it the nowrap card-name text sets the grid track's
            min-content and the row bleeds past the panel below ~380px. */}
        <div className="min-w-0">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-cyan-300/80">
            Cards that travel together
          </h4>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Pairs showing up at least {MIN_PACKAGE_LIFT}× more often than two independent cards
            would predict, across at least {MIN_PACKAGE_BATTLES} battles. This is structure, not
            results - it says nothing about winning.
          </p>
          {packages.length ? (
            <ul className="space-y-1.5">
              {packages.map((pair) => (
                <li
                  key={`${pair.a}-${pair.b}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white/[0.03] px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <CardTile cardKey={pair.a} size="xs" showElixir={false} />
                    <span className="text-muted-foreground">+</span>
                    <CardTile cardKey={pair.b} size="xs" showElixir={false} />
                    <span className="min-w-0 text-xs leading-tight">
                      {nameOf(pair.a)} / {nameOf(pair.b)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-xs font-bold tabular-nums text-cyan-300">
                      {pair.lift}×
                    </span>
                    <span className="block text-[10px] tabular-nums text-muted-foreground">
                      {pair.battles} battles
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              No pair reaches {MIN_PACKAGE_LIFT}× their expected overlap across at least{' '}
              {MIN_PACKAGE_BATTLES} battles yet.
            </p>
          )}
        </div>

        <div className="min-w-0">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-300/80">
            Winning together
          </h4>
          <p className="mb-3 text-[11px] text-muted-foreground">
            The pair&apos;s own win rate against the average of the two cards&apos; individual
            rates, in percentage points.
          </p>

          {hasResults ? (
            <div className="space-y-3">
              {[
                { title: 'Ahead of its cards', rows: measured.best, tone: 'text-emerald-300' },
                { title: 'Behind its cards', rows: measured.worst, tone: 'text-rose-300' },
              ].map(
                (group) =>
                  group.rows.length > 0 && (
                    <div key={group.title}>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.title}
                      </p>
                      <ul className="space-y-1.5">
                        {group.rows.map((pair) => (
                          <li
                            key={`${pair.a}-${pair.b}`}
                            className="rounded-lg border border-border bg-white/[0.03] px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex min-w-0 items-center gap-2">
                                <CardTile cardKey={pair.a} size="xs" showElixir={false} />
                                <span className="text-muted-foreground">+</span>
                                <CardTile cardKey={pair.b} size="xs" showElixir={false} />
                                <span className="min-w-0 text-xs leading-tight">
                                  {nameOf(pair.a)} / {nameOf(pair.b)}
                                </span>
                              </span>
                              <span className={`shrink-0 text-xs font-bold tabular-nums ${group.tone}`}>
                                {pair.delta > 0 ? '+' : ''}
                                {pair.delta}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                              Together {pair.winRate}% · alone {pair.aWinRate}% /{' '}
                              {pair.bWinRate}% · {pair.battles} battles across {pair.decks}{' '}
                              build{pair.decks === 1 ? '' : 's'}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No pair appears in {MIN_RESULT_DECKS} or more builds with at least{' '}
              {MIN_RESULT_BATTLES} battles. With that little spread there is no honest way to
              separate the pair from the deck it sits in, so nothing is shown.
            </p>
          )}
        </div>
      </div>

      {hasResults && (
        <p className="mt-4 rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          These are battles, not a controlled test: the deck around the pair, the archetype and
          who played it are all still inside the number. Read a gap as a lead worth checking,
          not a verdict on the cards.
        </p>
      )}
    </section>
  )
}
