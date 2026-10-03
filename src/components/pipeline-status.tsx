'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  Database,
  Globe,
  Monitor,
  RefreshCw,
  Server,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CheckStatus, StatusResponse } from '@/lib/status'

type Status = 'loading' | 'ready' | 'error'

const DOT: Record<CheckStatus, string> = {
  ok: 'bg-emerald-400 shadow-emerald-400/50',
  warn: 'bg-amber-400 shadow-amber-400/50',
  error: 'bg-rose-400 shadow-rose-400/50',
  off: 'bg-white/25 shadow-white/10',
}

const TEXT: Record<CheckStatus, string> = {
  ok: 'text-emerald-300',
  warn: 'text-amber-300',
  error: 'text-rose-300',
  off: 'text-muted-foreground',
}

const WORD: Record<CheckStatus, string> = {
  ok: 'healthy',
  warn: 'attention',
  error: 'failing',
  off: 'not configured',
}

const age = (seconds: number) =>
  seconds < 60
    ? `${seconds}s`
    : seconds < 3600
      ? `${Math.round(seconds / 60)}m`
      : `${Math.round(seconds / 3600)}h`

function Dot({ status }: { status: CheckStatus }) {
  return (
    <span
      className={`mt-1.5 inline-block size-2 shrink-0 rounded-full shadow-lg ${DOT[status]}`}
      aria-hidden
    />
  )
}

function Stage({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof Monitor
  label: string
  detail: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-yellow-300/80" />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">{label}</p>
        <p className="truncate font-mono text-[10px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}

function Connector() {
  return (
    <>
      <ChevronRight className="hidden shrink-0 self-center text-muted-foreground md:block" />
      <ChevronDown className="mx-auto shrink-0 text-muted-foreground md:hidden" />
    </>
  )
}

export function PipelineStatus() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    setStatus((current) => (current === 'ready' ? 'loading' : current))
    setError('')
    try {
      const response = await fetch('/api/status', { cache: 'no-store', signal })
      if (!response.ok) throw new Error(`Request failed (${response.status})`)
      setData((await response.json()) as StatusResponse)
      setStatus('ready')
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'Could not read the pipeline status.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  if (status === 'error' && !data) {
    return (
      <section className="panel grid place-items-center gap-2 p-10 text-center">
        <p className="text-sm font-medium">{error}</p>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </section>
    )
  }

  if (!data) return <div className="panel h-[28rem] animate-pulse" />

  const counts = Object.entries(data.database.counts)
  const maxCount = Math.max(1, ...counts.map(([, value]) => value))

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">Pipeline health</h2>
          <Badge variant="outline" className="font-mono text-[10px]">
            {new Date(data.checkedAt).toLocaleTimeString()}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-8 gap-1.5 text-xs"
            onClick={() => void load()}
            disabled={status === 'loading'}
          >
            <RefreshCw className={`size-3.5 ${status === 'loading' ? 'animate-spin' : ''}`} />
            Re-check
          </Button>
        </div>
        {status === 'error' && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2">
            <p className="text-xs text-rose-200">
              {error || 'Could not refresh the pipeline status.'}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-7 gap-1.5 text-xs"
              onClick={() => void load()}
            >
              Retry
            </Button>
          </div>
        )}
        <ul className="grid gap-3 lg:grid-cols-2">
          {data.checks.map((check) => (
            <li key={check.key} className="flex gap-3">
              <Dot status={check.status} />
              <div className="min-w-0">
                <p className="text-xs font-semibold">
                  {check.label}{' '}
                  <span className={`font-normal ${TEXT[check.status]}`}>· {WORD[check.status]}</span>
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-4">
        <h2 className="mb-3 text-sm font-semibold">How a request travels</h2>
        <div className="flex flex-col md:flex-row md:items-stretch md:gap-2">
          <Stage icon={Monitor} label="Browser" detail="no secrets, no API calls" />
          <Connector />
          <Stage
            icon={Server}
            label="Next.js route handlers"
            detail="/api/player /api/meta /api/matchups /api/status"
          />
          <Connector />
          <div className="flex min-w-0 flex-col gap-2">
            <Stage
              icon={Globe}
              label="Clash Royale API"
              detail={
                data.clashRoyaleApi.egressIp
                  ? `egress ${data.clashRoyaleApi.egressIp}`
                  : data.clashRoyaleApi.egressIpError
                    ? 'egress IP unreadable'
                    : 'token only'
              }
            />
            <Stage
              icon={Database}
              label="PostgreSQL"
              detail={
                data.database.latencyMs !== null
                  ? `${data.database.latencyMs} ms · ${data.database.counts.Battle ?? 0} battles`
                  : (data.database.error ?? 'not configured')
              }
            />
            <Stage
              icon={BrainCircuit}
              label="LLM coach"
              detail={data.checks.find((check) => check.key === 'coach')?.detail ?? ''}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="panel overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="text-sm font-semibold">Sync ledger</h2>
            <p className="text-xs text-muted-foreground">
              A player is refreshed after {data.sync.playerTtlMinutes} minutes; a meta
              aggregate after {data.sync.metaTtlMinutes}.
            </p>
          </div>
          {data.sync.players.length ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2 font-semibold">Player</th>
                    <th className="px-3 py-2 font-semibold">Battles (raw)</th>
                    <th className="px-3 py-2 font-semibold">Last pull</th>
                    <th className="px-3 py-2 font-semibold">Trophies</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sync.players.map((player) => (
                    <tr key={player.tag} className="border-t border-white/5">
                      <td className="px-4 py-2">
                        <span className="block font-medium">{player.name}</span>
                        <span className="block font-mono text-[10px] text-muted-foreground">
                          {player.tag}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {player.rawBattles}/{player.battles}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono">{age(player.ageSeconds)} ago</span>
                        <span
                          className={`ml-2 text-[10px] ${player.stale ? 'text-amber-300' : 'text-emerald-300'}`}
                        >
                          {player.stale ? 'stale' : 'fresh'}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono">{player.trophies}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-6 text-xs text-muted-foreground">No players stored yet.</p>
          )}
          <div className="border-t border-white/10 px-4 py-3 text-xs text-muted-foreground">
            {data.sync.meta
              ? `Meta aggregate built ${age(data.sync.meta.ageSeconds)} ago from ${data.sync.meta.battles} battles · ${
                  data.sync.meta.fresh ? 'inside TTL' : 'past TTL, rebuilt on next read'
                }.`
              : 'No meta aggregate stored yet.'}{' '}
            {data.sync.coachSessions} coach session(s) recorded.
          </div>
        </section>

        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Stored records</h2>
          {counts.length ? (
            <ul className="space-y-2.5">
              {counts.map(([name, value]) => (
                <li key={name}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span>{name}</span>
                    <span className="font-mono text-muted-foreground">{value}</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-yellow-400/70 to-amber-500/70"
                      style={{ width: `${Math.max(3, (value / maxCount) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              PostgreSQL is not configured, so nothing is persisted between restarts.
            </p>
          )}

          <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">In-memory response cache</span>
              <span className="font-mono">{data.clashRoyaleApi.cache.memoryEntries} entries</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Persistent response cache</span>
              <span className="font-mono">{data.clashRoyaleApi.cache.dbEntries} entries</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Calls this minute</span>
              <span className="font-mono">
                {data.clashRoyaleApi.rateLimit.used}/{data.clashRoyaleApi.rateLimit.limit}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Node</span>
              <span className="font-mono">{data.runtime.node}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Environment</span>
              <span className="font-mono">
                {data.runtime.env} · up {age(data.runtime.uptimeSeconds)}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
