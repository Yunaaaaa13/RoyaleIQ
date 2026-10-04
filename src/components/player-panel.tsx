'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Bot, Crown, Database, Loader2, Search, Star, Trophy, Users } from 'lucide-react'
import { averageElixir, DeckStrip } from '@/components/battle-detail'
import { BarList, StatTile } from '@/components/metrics'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ArchetypeRecord, PlayerStats } from '@/lib/player'
import type { CrPlayer } from '@/lib/cr-api'
import { archetypeLabel, detectArchetype } from '@/lib/archetypes'
import {
  clearRecent,
  pushRecent,
  removeRecent,
  useRecentPlayers,
} from '@/lib/recent-players'
import { isLikelyTag, normalizeTag } from '@/lib/tags'

interface PlayerResponse {
  source: 'live' | 'db'
  profile?: CrPlayer
  stats?: PlayerStats
  syncedAt?: string
  tracked?: boolean
  notice?: string
  error?: string
}

const VERDICT_TONE: Record<string, string> = {
  strong: 'text-emerald-300',
  even: 'text-muted-foreground',
  weak: 'text-rose-300',
}

function ArchetypeRow({ record }: { record: ArchetypeRecord }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-white/[0.03] px-3 py-2">
      <span className="flex-1 truncate text-sm font-medium">{record.label}</span>
      <span className="text-xs text-muted-foreground">{record.battles} games</span>
      <span
        className={`w-14 text-right text-sm font-bold tabular-nums ${VERDICT_TONE[record.verdict]}`}
      >
        {record.winRate}%
      </span>
      <span className="w-16 text-right">
        <Badge
          variant="outline"
          className={
            record.verdict === 'strong'
              ? 'text-emerald-300'
              : record.verdict === 'weak'
                ? 'text-rose-300'
                : ''
          }
        >
          {record.verdict}
        </Badge>
      </span>
    </li>
  )
}

interface LoadedProfile {
  tag: string
  nonce: number
  payload: PlayerResponse | null
  error: string | null
}

export function PlayerPanel({
  defaultTag,
  hideSearch = false,
}: {
  /** Seed when the URL carries no `?tag=` — used by My Profile. */
  defaultTag?: string
  /** Hide the tag form and recent chips: this route shows one fixed player. */
  hideSearch?: boolean
} = {}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  // The URL is the single source of truth for *which* player is on screen: the
  // header search box pushes a new `?tag=` onto this same route, which must
  // remount the data without a full page navigation. `defaultTag` seeds that
  // state when the route itself owns the player (My Profile).
  const paramTag = normalizeTag(searchParams.get('tag')?.trim() ?? '')
  const urlTag = paramTag || normalizeTag(defaultTag ?? '')
  const hashAttempted = useRef(false)

  const [tagInput, setTagInput] = useState(urlTag)
  // Adjust the input while rendering when the URL tag changes underneath it,
  // so an external navigation is reflected without an extra effect pass.
  const [lastUrlTag, setLastUrlTag] = useState(urlTag)
  if (lastUrlTag !== urlTag) {
    setLastUrlTag(urlTag)
    setTagInput(urlTag)
  }

  const [loaded, setLoaded] = useState<LoadedProfile | null>(null)
  const [nonce, setNonce] = useState(0)
  const inflight = useRef({ tag: '', nonce: -1 })

  const history = useRecentPlayers()
  const [tracked, setTracked] = useState(false)
  const [trackBusy, setTrackBusy] = useState(false)
  const [trackNotice, setTrackNotice] = useState<string | null>(null)

  const load = useCallback(async (rawTag: string, request: number) => {
    const query = `?tag=${encodeURIComponent(normalizeTag(rawTag))}`
    let next: LoadedProfile
    try {
      const response = await fetch(`/api/player${query}`, { cache: 'no-store' })
      const data = (await response.json()) as PlayerResponse
      next = response.ok
        ? { tag: rawTag, nonce: request, payload: data, error: null }
        : {
            tag: rawTag,
            nonce: request,
            payload: null,
            error: data.error ?? 'Could not load that player.',
          }
    } catch {
      next = {
        tag: rawTag,
        nonce: request,
        payload: null,
        error: 'Network error while loading the profile.',
      }
    }
    // A newer search superseded this one while it was in flight.
    if (inflight.current.tag !== rawTag || inflight.current.nonce !== request) return
    setLoaded(next)
  }, [])

  useEffect(() => {
    // `/player?tag=#G9CP9VUJR` hands the tag to the URL fragment handler, so
    // recover it once after mount when the query parameter came through empty.
    if (hashAttempted.current) return
    hashAttempted.current = true
    if (urlTag || typeof window === 'undefined') return
    const hash = window.location.hash.replace(/^#/, '')
    if (isLikelyTag(hash)) {
      router.replace(`${pathname}?tag=${encodeURIComponent(normalizeTag(hash))}`, {
        scroll: false,
      })
    }
  }, [urlTag, pathname, router])

  useEffect(() => {
    if (!urlTag) {
      inflight.current = { tag: '', nonce: -1 }
      return
    }
    inflight.current = { tag: urlTag, nonce }
    void load(urlTag, nonce)
  }, [urlTag, nonce, load])

  // Results are only trusted while they still describe the player in the URL,
  // so a stale response or a cleared search can never render a wrong profile.
  const current = loaded && loaded.tag === urlTag ? loaded : null
  const payload = current?.payload ?? null
  // A refresh of the same player keeps the profile on screen but must not keep
  // showing the previous run's error.
  const error = current && current.nonce === nonce ? current.error : null
  const loading = Boolean(urlTag) && (!current || current.nonce !== nonce)

  const stats = payload?.stats
  const profile = payload?.profile

  useEffect(() => {
    if (!profile || !stats) return
    pushRecent({ tag: profile.tag, name: profile.name, trophies: profile.trophies })
  }, [profile, stats])

  // The track toggle and its notice belong to one payload: when a different
  // profile lands they are reset here rather than in an effect, so the button
  // never shows the previous player's state for a frame.
  const [trackedFor, setTrackedFor] = useState<unknown>(payload)
  if (trackedFor !== payload) {
    setTrackedFor(payload)
    setTracked(Boolean(payload?.tracked))
    setTrackNotice(null)
  }

  const trend = useMemo(
    () =>
      (stats?.trend ?? []).map((bucket) => ({
        month: bucket.label,
        winRate: bucket.winRate,
        battles: bucket.battles,
      })),
    [stats],
  )

  const usageItems = useMemo(
    () =>
      (stats?.mostUsedCards ?? []).map((card) => ({
        label: card.name,
        value: card.battles,
        display: `${card.winRate}% wr`,
        tone:
          card.winRate >= 52
            ? 'bg-emerald-400'
            : card.winRate <= 48
              ? 'bg-rose-400'
              : 'bg-cyan-400',
      })),
    [stats],
  )

  const recent = useMemo(
    () =>
      (stats?.recent ?? []).map((battle) => ({
        battle,
        opponent: archetypeLabel(detectArchetype(battle.opponentDeck).archetype.key),
        when: new Date(battle.time).toLocaleString(undefined, {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
      })),
    [stats],
  )

  function clearSearch() {
    setTagInput('')
    inflight.current = { tag: '', nonce: -1 }
    router.replace(pathname, { scroll: false })
  }

  function openTag(rawTag: string) {
    const clean = normalizeTag(rawTag)
    if (!clean) return
    setTrackNotice(null)
    setNonce((value) => value + 1)
    router.replace(`${pathname}?tag=${encodeURIComponent(clean)}`, { scroll: false })
  }

  async function toggleTrack() {
    if (!urlTag || trackBusy) return
    const next = !tracked
    setTracked(next)
    setTrackNotice(null)
    setTrackBusy(true)
    try {
      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: urlTag, action: next ? 'track' : 'untrack' }),
      })
      const data = (await response.json()) as { tracked?: boolean; error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Could not update tracking.')
      setTracked(Boolean(data.tracked))
    } catch (error) {
      setTracked(!next)
      setTrackNotice(error instanceof Error ? error.message : 'Could not update tracking.')
    } finally {
      setTrackBusy(false)
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const clean = normalizeTag(tagInput)
    if (!clean) {
      clearSearch()
      return
    }
    // Bumping the nonce re-runs the fetch even when the tag is unchanged, so
    // "Load profile" always behaves like a refresh.
    openTag(clean)
  }

  return (
    <div className="space-y-5" id="profile">
      {!hideSearch && (
        <form onSubmit={submit} className="panel flex flex-wrap items-center gap-2 p-4">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              placeholder="#PLAYERTAG"
              className="h-10 pl-9 font-mono uppercase"
              aria-label="Player tag"
            />
          </div>
          <Button type="submit" className="h-10 gap-2" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
            Load profile
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={clearSearch}
            disabled={!payload && !error && !tagInput}
          >
            Clear
          </Button>
        </form>
      )}

      {!hideSearch && history.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recent
          </span>
          {history.map((item) => (
            <span
              key={item.tag}
              className="flex items-center gap-1.5 rounded-full border border-border bg-white/[0.03] py-1 pl-3 pr-1.5 text-xs transition-colors hover:border-white/20"
            >
              <button
                type="button"
                onClick={() => openTag(item.tag)}
                className="font-medium hover:text-foreground"
              >
                {item.name}
              </button>
              <span className="font-mono text-[10px] text-muted-foreground">
                {item.tag}
              </span>
              <span className="font-mono text-[10px] text-yellow-300/80">
                {item.trophies.toLocaleString()}
              </span>
              <button
                type="button"
                aria-label={`Remove ${item.name} from recent searches`}
                onClick={() => removeRecent(item.tag)}
                className="grid size-5 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => clearRecent()}
            className="text-[11px] text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {error && (
        <Alert className="border-rose-400/30 bg-rose-400/10">
          <AlertTitle>Could not load that player</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!payload && !error && !loading && (
        <section className="panel grid place-items-center gap-3 px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/[0.03] text-yellow-300">
            <Search className="size-5" />
          </span>
          <h2 className="text-lg font-semibold">Search a player tag to begin</h2>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            RoyaleIQ does not run on a demo account. Enter a real Clash Royale
            player tag — for example{' '}
            <span className="font-mono text-foreground">#G9CP9VUJR</span> — and the
            name, trophies, battle history and per-match diagnosis load straight from
            the official API.
          </p>
        </section>
      )}

      {loading && !payload && (
        <div className="space-y-4">
          <div className="panel h-40 animate-pulse" />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="panel h-64 animate-pulse lg:col-span-2" />
            <div className="panel h-64 animate-pulse" />
          </div>
        </div>
      )}

      {payload?.notice && (
        <Alert className="border-yellow-400/30 bg-yellow-400/10">
          <AlertTitle className="flex items-center gap-2">
            <Database className="size-4" />
            Stored profile
          </AlertTitle>
          <AlertDescription>{payload.notice}</AlertDescription>
        </Alert>
      )}

      {profile && stats && (
        <>
          <section className="panel relative overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-yellow-400/10 blur-3xl" />
            <div className="flex flex-wrap items-center gap-5">
              <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-yellow-300 to-amber-600 text-black">
                <Crown className="size-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{profile.name}</h2>
                <p className="font-mono text-xs text-muted-foreground">{profile.tag}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {profile.clan && (
                    <span className="flex items-center gap-1">
                      <Users className="size-3.5" />
                      {profile.clan.name}
                    </span>
                  )}
                  <Badge variant="outline">{profile.arena?.name}</Badge>
                  <Badge variant="outline" className="text-yellow-300">
                    {profile.trophies.toLocaleString()} trophies
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Database className="size-3" />
                    {payload?.source === 'db' ? 'PostgreSQL' : 'Live API'}
                  </Badge>
                  {payload?.syncedAt && (
                    <span>
                      synced{' '}
                      {new Date(payload.syncedAt).toLocaleString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                  {recent[0]?.battle.deck.length === 8 && (
                    <Link
                      href={`/ai-coach?deck=${encodeURIComponent(recent[0].battle.deck.join(','))}&tag=${encodeURIComponent(profile.tag)}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 px-2.5 py-1 font-medium text-violet-300 transition hover:bg-violet-400/10"
                    >
                      <Bot className="size-3" />
                      Coach this deck
                    </Link>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-pressed={tracked}
                    onClick={toggleTrack}
                    disabled={trackBusy}
                    className={`h-7 gap-1.5 rounded-full px-3 text-xs font-medium ${
                      tracked
                        ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-300'
                        : ''
                    }`}
                  >
                    <Star className={tracked ? 'size-3 fill-current' : 'size-3'} />
                    {trackBusy ? 'Saving…' : tracked ? 'Tracking' : 'Track'}
                  </Button>
                  {trackNotice && (
                    <span className="text-[11px] text-rose-300">{trackNotice}</span>
                  )}
                </div>
              </div>
              <div className="ml-auto grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Win rate" value={`${stats.winRate}%`} accent="green" />
                <StatTile label="Battles" value={stats.battles.toLocaleString()} />
                <StatTile label="Wins" value={stats.wins} accent="cyan" />
                <StatTile label="Losses" value={stats.losses} accent="rose" />
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="panel p-5 lg:col-span-2">
              <h3 className="mb-4 panel-title">
                Win rate trend
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
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
                      formatter={(value) => [`${value}%`, 'Win rate']}
                    />
                    <Line
                      type="monotone"
                      dataKey="winRate"
                      stroke="#facc15"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#facc15' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <StatTile
                  label="Best matchup"
                  value={stats.bestMatchup?.label ?? '—'}
                  sub={
                    stats.bestMatchup
                      ? `${stats.bestMatchup.winRate}% over ${stats.bestMatchup.battles}`
                      : undefined
                  }
                  accent="green"
                />
                <StatTile
                  label="Worst matchup"
                  value={stats.worstMatchup?.label ?? '—'}
                  sub={
                    stats.worstMatchup
                      ? `${stats.worstMatchup.winRate}% over ${stats.worstMatchup.battles}`
                      : undefined
                  }
                  accent="rose"
                />
                <StatTile
                  label="Avg deck elixir"
                  value={stats.avgElixir}
                  sub={`${stats.currentStreak} ${stats.currentStreak === 1 ? 'game' : 'games'} current streak`}
                  accent="cyan"
                />
              </div>
            </section>

            <section className="panel p-5">
              <h3 className="mb-4 panel-title">
                Most used cards
              </h3>
              <BarList items={usageItems} />
              {stats.worstCard && (
                <div className="mt-4 rounded-lg border border-rose-400/25 bg-rose-400/10 p-3 text-xs">
                  <p className="font-semibold text-rose-200">Worst card in your deck</p>
                  <p className="mt-1 text-rose-100/80">
                    {stats.worstCard.name} — {stats.worstCard.winRate}% win rate across{' '}
                    {stats.worstCard.battles} games.
                  </p>
                </div>
              )}
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="panel p-5">
              <h3 className="mb-4 panel-title">
                Your archetypes
              </h3>
              <ul className="space-y-2">
                {stats.byArchetype.map((record) => (
                  <ArchetypeRow key={record.key} record={record} />
                ))}
              </ul>
            </section>

            <section className="panel p-5">
              <h3 className="mb-4 panel-title">
                Matchup analysis
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Win rate against each archetype you actually face, computed from this
                player&apos;s stored battle history.
              </p>
              {stats.byOpponent.length ? (
                <ul className="space-y-2">
                  {stats.byOpponent.map((record) => (
                    <ArchetypeRow key={record.key} record={record} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No battles stored for this player yet.
                </p>
              )}
            </section>

            <section className="panel p-5">
              <h3 className="mb-4 panel-title">
                Recent battles
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Both decks are shown before you open anything. Open a battle for the
                full dashboard: two-sided matchup breakdown, air defence, spell coverage,
                cycle, pre-match prediction and the evidence behind each score.
              </p>
              <ul className="space-y-2">
                {recent.map(({ battle, opponent, when }) => (
                  <li key={battle.id}>
                    <Link
                      href={`/battle?tag=${encodeURIComponent(urlTag)}&t=${encodeURIComponent(battle.time)}`}
                      className="block w-full rounded-xl border border-border bg-white/[0.03] px-3 py-3 text-left text-sm transition-colors hover:border-white/20 hover:bg-white/10"
                    >
                        <span className="flex items-center gap-3">
                          <span
                            className={`grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold ${
                              battle.result === 'win'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : battle.result === 'loss'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-white/10 text-muted-foreground'
                            }`}
                          >
                            {battle.result === 'win'
                              ? 'W'
                              : battle.result === 'loss'
                                ? 'L'
                                : 'D'}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              vs {battle.opponentName}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {battle.crowns.us}–{battle.crowns.them} · {when} · {opponent}
                            </span>
                          </span>
                          <span className="hidden shrink-0 text-right text-[11px] text-muted-foreground sm:block">
                            {averageElixir(battle.deck)} / {averageElixir(battle.opponentDeck)}{' '}
                            avg elixir
                          </span>
                          <span className="w-14 shrink-0 text-right text-[11px] text-muted-foreground">
                            Open
                          </span>
                        </span>
                        <span className="mt-2.5 flex flex-col gap-1.5">
                          <DeckStrip cards={battle.deck} label="You" />
                          <DeckStrip cards={battle.opponentDeck} label="Opp" />
                        </span>
                    </Link>
                  </li>
                ))}
                {!recent.length && (
                  <li className="py-6 text-center text-sm text-muted-foreground">
                    No battles stored for this player yet.
                  </li>
                )}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
