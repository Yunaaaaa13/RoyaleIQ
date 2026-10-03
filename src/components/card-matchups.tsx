'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, RefreshCw, Swords, Target } from 'lucide-react'
import { CardTile } from '@/components/card-tile'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CardMatchupGates, CardMatchupSection, CardMatchupsResult } from '@/lib/card-matchups'
import type { MatchupEdge } from '@/lib/matchups'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'loading' | 'ready' | 'error'

const span = (iso: string) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

/** A rate is only colour-coded once it clears the gate; before that it is a count. */
const rateTone = (winRate: number, show: boolean) =>
  !show ? 'text-muted-foreground' : winRate >= 55 ? 'text-emerald-300' : winRate <= 45 ? 'text-rose-300' : 'text-foreground'

function PairingTable({
  gates,
  section,
  withCards,
}: {
  gates: CardMatchupGates
  section: CardMatchupSection
  withCards: boolean
}) {
  const byKey = useMemo(() => new Map(section.cells.map((cell) => [cell.to, cell])), [section.cells])

  if (!section.cols.length) {
    return (
      <p className="text-xs text-muted-foreground">
        Nothing has been recorded for this card yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <th className="py-2 pr-3 font-semibold">{withCards ? 'Opposing card' : 'Opponent archetype'}</th>
            <th className="px-2 py-2 text-right font-semibold">Games</th>
            <th className="px-2 py-2 text-right font-semibold">W-L-D</th>
            <th className="py-2 pl-2 text-right font-semibold">Win rate</th>
          </tr>
        </thead>
        <tbody>
          {section.cols.map((key) => {
            const cell = byKey.get(key)
            if (!cell) return null
            const show = cell.games >= gates.cellGames
            return (
              <tr key={key} className="border-b border-border/60 last:border-0">
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-2">
                    {withCards && <CardTile cardKey={key} size="xs" showElixir={false} />}
                    <span className="min-w-0 truncate text-xs sm:text-sm">
                      {section.labels[key] ?? key}
                    </span>
                  </span>
                </td>
                <td className="px-2 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {cell.games}
                </td>
                <td className="px-2 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {cell.wins}-{cell.losses}-{cell.draws}
                </td>
                <td className="py-2 pl-2 text-right">
                  <span
                    className={cn(
                      'font-mono text-sm font-semibold tabular-nums',
                      rateTone(cell.winRate, show),
                    )}
                  >
                    {show ? `${cell.winRate}%` : '—'}
                  </span>
                  <span className="block font-mono text-[10px] leading-tight text-muted-foreground">
                    {show ? `n=${cell.games}` : `n=${cell.games} · under ${gates.cellGames}`}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EdgeList({
  title,
  edges,
  tone,
  minGames,
}: {
  title: string
  edges: MatchupEdge[]
  tone: 'best' | 'worst'
  minGames: number
}) {
  return (
    <div className="min-w-0">
      <h4
        className={cn(
          'mb-1.5 text-[11px] font-semibold uppercase tracking-wide',
          tone === 'best' ? 'text-emerald-300/80' : 'text-rose-300/80',
        )}
      >
        {title}
      </h4>
      {edges.length ? (
        <ul className="space-y-1.5">
          {edges.map((edge) => (
            <li
              key={edge.to}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white/[0.03] px-3 py-2"
            >
              <span className="min-w-0 truncate text-xs">{edge.toLabel}</span>
              <span className="shrink-0 text-right">
                <span
                  className={cn(
                    'block text-xs font-bold tabular-nums',
                    tone === 'best' ? 'text-emerald-300' : 'text-rose-300',
                  )}
                >
                  {edge.winRate}%
                </span>
                <span className="block font-mono text-[10px] tabular-nums text-muted-foreground">
                  n={edge.games}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nothing clears the {minGames}-game line on this side yet.
        </p>
      )}
    </div>
  )
}

export function CardMatchups({ cardKey, cardName }: { cardKey: string; cardName: string }) {
  const [data, setData] = useState<CardMatchupsResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setStatus('loading')
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardKey}/matchups`, { signal: controller.signal })
      const body = (await response.json()) as CardMatchupsResult
      if (!response.ok && response.status !== 400) {
        throw new Error(
          body.available ? `Request failed (${response.status})` : body.reason,
        )
      }
      setData(body)
      setStatus('ready')
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Could not load matchups.')
      setStatus('error')
    }
  }, [cardKey])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    return () => controllerRef.current?.abort()
  }, [load])

  if (status === 'error') {
    return (
      <Alert className="border-rose-400/30 bg-rose-400/10">
        <AlertTitle>Matchups unavailable</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (status !== 'ready' || !data) {
    return <div className="panel h-40 animate-pulse" aria-busy="true" />
  }

  if (!data.available) {
    return (
      <Alert className="border-amber-400/30 bg-amber-400/10">
        <AlertTitle>No sample to measure</AlertTitle>
        <AlertDescription>{data.reason}</AlertDescription>
      </Alert>
    )
  }

  const { sample, gates, byArchetype, headToHead } = data

  return (
    <div className="space-y-4">
      {sample.lowSample && (
        <Alert className="border-amber-400/30 bg-amber-400/10">
          <AlertTitle>Small sample</AlertTitle>
          <AlertDescription>
            Only {sample.battlesWithCard} of the {sample.corpusGames} sampled games carry {cardName},
            under the {gates.cardGames}-game line this page treats as settled. Read every rate below
            as a hint rather than a verdict.
          </AlertDescription>
        </Alert>
      )}

      <section className="panel p-5">
        <h3 className="mb-1 panel-title">Sample</h3>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{sample.battlesWithCard} games with {cardName}</Badge>
          <Badge variant="outline">{sample.corpusGames} games in the corpus</Badge>
          <Badge variant="outline">{sample.corpusBattles} corpus entries</Badge>
          <Badge variant="outline">
            {span(sample.oldest)} to {span(sample.newest)}
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{sample.notice}</p>
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="mb-1 flex items-center gap-2 panel-title">
              <Target className="size-4 text-cyan-300" />
              By opposing archetype
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Every game where {cardName} sat on your side, bucketed by what the other side was
              playing. A rate needs {gates.cellGames} games; below that only the count is shown.
            </p>
          </div>
          <Link
            href="/matchups"
            className="hidden shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground sm:inline-flex"
          >
            Archetype matrix
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            <PairingTable gates={gates} section={byArchetype} withCards={false} />
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              {byArchetype.pairings} archetypes seen, {byArchetype.belowGate} of them under{' '}
              {gates.cellGames} games and not read as a rate.
              {byArchetype.hidden > 0 ? ` ${byArchetype.hidden} more withheld.` : ''}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <EdgeList
              title="Recorded best into"
              edges={byArchetype.best}
              tone="best"
              minGames={gates.cellGames}
            />
            <EdgeList
              title="Recorded worst into"
              edges={byArchetype.worst}
              tone="worst"
              minGames={gates.cellGames}
            />
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="mb-1 flex items-center gap-2 panel-title">
              <Swords className="size-4 text-amber-300" />
              Head to head
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              The same games, bucketed by which card sat across the river - what {cardName} has been
              recorded beating and losing to.
            </p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            <PairingTable gates={gates} section={headToHead} withCards />
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Showing {headToHead.cols.length} of {headToHead.pairings} opposing cards seen, capped
              at {gates.headToHead}. {headToHead.belowGate} sit under {gates.cellGames} games.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <EdgeList
              title="Beats most often"
              edges={headToHead.best}
              tone="best"
              minGames={gates.cellGames}
            />
            <EdgeList
              title="Loses to most often"
              edges={headToHead.worst}
              tone="worst"
              minGames={gates.cellGames}
            />
          </div>
        </div>
      </section>

      <p className="rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        These are battles, not a controlled test: the deck around {cardName}, the archetype it sat
        in and who played it are all still inside the number. Read a gap as a lead worth checking,
        not a verdict on the card.
      </p>
    </div>
  )
}
