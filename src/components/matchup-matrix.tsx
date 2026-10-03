'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { RefreshCw, Swords, Users } from 'lucide-react'
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
import { normalizeTag } from '@/lib/tags'
import type { MatchupCell, MatchupEdge, MatchupsResponse } from '@/lib/matchups'

type Status = 'idle' | 'loading' | 'ready' | 'error'

type Edge = MatchupEdge

const MODE_LABEL: Record<string, string> = {
  pathOfLegend: 'Path of Legends',
  trail: 'Trail',
  PvP: 'PvP',
  friendlyBattle: 'Friendly Battle',
  friendly: 'Friendly Battle',
  tournament: 'Tournament',
  unknown: 'Unclassified',
}

const modeLabel = (key: string) => MODE_LABEL[key] ?? key

function cellStyle(winRate: number, games: number) {
  const strength = Math.max(-1, Math.min(1, (winRate - 50) / 35))
  const alpha = 0.1 + Math.abs(strength) * 0.6
  return {
    backgroundColor:
      strength >= 0 ? `rgba(16,185,129,${alpha})` : `rgba(244,63,94,${alpha})`,
    opacity: games < 3 ? 0.55 : 1,
  }
}

function EdgeRow({ edge, tone }: { edge: Edge; tone: 'best' | 'worst' }) {
  const delta = edge.projected === null ? null : Math.round(edge.winRate - edge.projected)
  return (
    <li className="flex items-center gap-3 border-b border-white/5 py-2 last:border-0">
      <span
        className={`w-12 shrink-0 text-right font-mono text-sm font-semibold ${
          tone === 'best' ? 'text-emerald-300' : 'text-rose-300'
        }`}
      >
        {edge.winRate}%
      </span>
      <span className="min-w-0 flex-1 truncate text-xs">
        <span className="font-medium">{edge.fromLabel}</span>
        <span className="mx-1.5 text-muted-foreground">into</span>
        <span className="text-muted-foreground">{edge.toLabel}</span>
      </span>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
        n={edge.games}
        {delta !== null && Math.abs(delta) >= 6 ? (
          <span className={delta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {' '}
            ({delta > 0 ? '+' : ''}
            {delta})
          </span>
        ) : null}
      </span>
    </li>
  )
}

export function MatchupMatrix() {
  const params = useSearchParams()
  const [scope, setScope] = useState<'global' | 'player'>('global')
  const [mode, setMode] = useState('all')
  const [tag, setTag] = useState(() => params.get('tag') ?? '')
  const [pendingTag, setPendingTag] = useState(() => params.get('tag') ?? '')
  const [data, setData] = useState<MatchupsResponse | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  // Held in a ref so a manual retry is cancelled by the next reload and on
  // unmount, instead of outliving it and overwriting newer results.
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const { signal } = controller
    const search = new URLSearchParams({ scope, mode })
    if (scope === 'player') {
      const clean = normalizeTag(tag)
      if (!clean) {
        setData(null)
        setError('Enter a player tag to see your own matchups.')
        setStatus('error')
        return
      }
      search.set('tag', clean)
    }
    setStatus('loading')
    setError('')
    try {
      const response = await fetch(`/api/matchups?${search.toString()}`, { signal })
      if (!response.ok) throw new Error(`Request failed (${response.status})`)
      const json = (await response.json()) as MatchupsResponse
      setData(json)
      setStatus('ready')
    } catch (err) {
      if (signal.aborted) return
      setData(null)
      setError(err instanceof Error ? err.message : 'Could not load matchups.')
      setStatus('error')
    }
  }, [scope, mode, tag])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    return () => controllerRef.current?.abort()
  }, [load])

  const labelFor = useCallback(
    (key: string) => data?.labels?.[key] ?? key,
    [data],
  )

  const cellsByKey = useMemo(() => {
    const map = new Map<string, MatchupCell>()
    for (const cell of data?.cells ?? []) map.set(`${cell.from}\u0000${cell.to}`, cell)
    return map
  }, [data])

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex items-center gap-1 rounded-lg bg-black/30 p-1">
            {(
              [
                { value: 'global', label: 'Everyone stored', icon: Users },
                { value: 'player', label: 'Your battles', icon: Swords },
              ] as const
            ).map((item) => {
              const active = scope === item.value
              const Icon = item.icon
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setScope(item.value)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    active ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </button>
              )
            })}
          </div>

          {scope === 'player' && (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                setTag(pendingTag)
              }}
            >
              <Input
                value={pendingTag}
                onChange={(event) => setPendingTag(event.target.value)}
                onBlur={() => setTag(pendingTag)}
                placeholder="#PLAYERTAG"
                aria-label="Player tag"
                className="h-9 w-40 font-mono text-xs uppercase"
              />
              <Button type="submit" size="sm" variant="outline" className="h-9">
                Load
              </Button>
            </form>
          )}

          <div className="lg:ml-auto">
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder="Game mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All game modes</SelectItem>
                {(data?.modes ?? []).map((type) => (
                  <SelectItem key={type} value={type}>
                    {modeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {status === 'error' && data === null ? (
        <section className="panel grid place-items-center gap-2 p-10 text-center">
          <p className="text-sm font-medium">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </section>
      ) : status !== 'ready' || !data ? (
        <div className="panel h-96 animate-pulse" />
      ) : data.battles === 0 ? (
        <section className="panel grid place-items-center gap-2 p-12 text-center">
          <p className="text-sm font-medium">{data.notice ?? 'Nothing to chart yet.'}</p>
          <p className="max-w-md text-xs text-muted-foreground">
            The matrix is built from battles RoyaleIQ has actually stored, not from
            published tier lists. Sync a player once and it fills in.
          </p>
        </section>
      ) : (
        // grid-cols-1 keeps the implicit column a 1fr track; without it the
        // matrix table's max-content widens the panels past the container below xl.
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="panel overflow-hidden p-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/10 px-4 py-3">
              <p className="text-sm font-semibold">
                {scope === 'player'
                  ? 'Your deck archetype into the one you faced'
                  : 'Archetype played into the archetype faced'}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.battles} battle{data.battles === 1 ? '' : 's'} ·{' '}
                {data.rows.length} × {data.cols.length} pairings
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      You played
                    </th>
                    {data.cols.map((key) => (
                      <th
                        key={key}
                        className="min-w-16 px-2 py-2 text-center align-bottom text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        <span className="block">{labelFor(key)}</span>
                        <span className="block font-mono text-[9px] font-normal normal-case tracking-normal opacity-60">
                          n={data.colTotals?.[key] ?? 0}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((from) => (
                    <tr key={from} className="border-t border-white/5">
                      <th className="sticky left-0 z-10 w-40 bg-card px-3 py-2 text-left align-middle text-xs font-medium">
                        <span className="block">{labelFor(from)}</span>
                        <span className="block font-mono text-[9px] font-normal text-muted-foreground">
                          n={data.rowTotals?.[from] ?? 0}
                        </span>
                      </th>
                      {data.cols.map((to) => {
                        const cell = cellsByKey.get(`${from}\u0000${to}`)
                        if (!cell) {
                          return (
                            <td key={to} className="px-2 py-2 text-center text-muted-foreground/30">
                              ·
                            </td>
                          )
                        }
                        const delta =
                          cell.projected === null ? null : Math.round(cell.winRate - cell.projected)
                        const projection =
                          cell.projected === null
                            ? 'Model projection unavailable for this pairing'
                            : `Model projects ${cell.projected}% - recorded ${cell.winRate}% (${
                                delta === null ? '' : delta > 0 ? `+${delta}` : String(delta)
                              })`
                        return (
                          <td
                            key={to}
                            className="px-1 py-1 text-center"
                            style={cellStyle(cell.winRate, cell.games)}
                            title={[
                              `${cell.wins}W - ${cell.losses}L - ${cell.draws}D over ${cell.games} game${cell.games === 1 ? '' : 's'}`,
                              projection,
                            ].join('\n')}
                          >
                            <span className="block font-mono text-[11px] font-semibold leading-tight">
                              {cell.winRate}%
                            </span>
                            <span className="block font-mono text-[9px] leading-tight text-white/55">
                              n={cell.games}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 px-4 py-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-sm bg-emerald-500/70" />{' '}
                {scope === 'player' ? 'you came out ahead' : 'row archetype came out ahead'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-sm bg-rose-500/70" />{' '}
                {scope === 'player' ? 'you came out behind' : 'row archetype came out behind'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-sm bg-white/15" /> under 3 games, treat as a hint
              </span>
              <span className="ml-auto">hover a cell for W/L/D and the model projection</span>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="panel p-4">
              <div className="mb-2 flex items-center gap-2">
                <RefreshCw className="size-3.5 text-emerald-300" />
                <h2 className="text-sm font-semibold">
                  {scope === 'player' ? 'You handle these best' : 'Strongest pairings'}
                </h2>
              </div>
              {data.best.length ? (
                <ul>
                  {data.best.map((edge) => (
                    <EdgeRow key={`${edge.from}-${edge.to}`} edge={edge} tone="best" />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No pairing above .500 with 3+ games yet.
                </p>
              )}
            </section>

            <section className="panel p-4">
              <div className="mb-2 flex items-center gap-2">
                <Swords className="size-3.5 text-rose-300" />
                <h2 className="text-sm font-semibold">
                  {scope === 'player' ? 'These keep beating you' : 'Weakest pairings'}
                </h2>
              </div>
              {data.worst.length ? (
                <ul>
                  {data.worst.map((edge) => (
                    <EdgeRow key={`${edge.from}-${edge.to}`} edge={edge} tone="worst" />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nothing below .500 with 3+ games yet - no pairing is clearly beating
                  you.
                </p>
              )}
            </section>

            <section className="panel p-4">
              <h2 className="mb-2 text-sm font-semibold">How to read it</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Every percentage is a count of stored battles, never a simulation. The
                bracket in a hover - <span className="font-mono text-foreground/80">(+6)</span> - is
                the gap between what the archetype model projected and what actually
                happened, so a positive number means the row beat the expectation.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="outline">{data.battles} samples</Badge>
                <Badge variant="outline">draws = 0.5 win</Badge>
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}
