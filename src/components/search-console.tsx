'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Layers, LayoutGrid, Search, UserRound } from 'lucide-react'
import { CardTile } from '@/components/card-tile'
import { Input } from '@/components/ui/input'
import { ALL_CARDS, cardLabel } from '@/lib/cards'
import { useRecentPlayers } from '@/lib/recent-players'
import { isLikelyTag, normalizeTag } from '@/lib/tags'
import type { CardStat, DeckStat, MetaSnapshot } from '@/lib/battle'
import { cn, relativeAge } from '@/lib/utils'

interface TrackedPlayer {
  tag: string
  name: string
  trophies: number
  winRate: number | null
  battles: number
}

interface PlayerHit {
  tag: string
  name: string
  trophies: number
  winRate: number | null
  source: 'tracked' | 'recent'
}

type MetaState = 'loading' | 'ready' | 'failed'

const winTone = (rate: number) =>
  rate >= 52 ? 'text-emerald-300' : rate <= 48 ? 'text-rose-300' : 'text-muted-foreground'

function SectionHead({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof LayoutGrid
  title: string
  count: number
}) {
  return (
    <div className="mb-3 flex items-center gap-2 border-b border-border/70 pb-3">
      <Icon className="size-4 text-primary" />
      <h2 className="panel-title">{title}</h2>
      <span className="ml-auto text-xs tabular-nums text-muted-foreground">{count}</span>
    </div>
  )
}

function DeckCard({ deck }: { deck: DeckStat }) {
  return (
    <Link
      href={`/deck-lab?deck=${encodeURIComponent(deck.cards.join(','))}`}
      className="group block rounded-xl border border-border/70 bg-white/[0.03] p-4 transition-colors hover:border-primary/40 hover:bg-white/[0.05]"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold group-hover:text-primary">
            {deck.label}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {deck.archetype} · {deck.avgElixir} avg · {deck.battles} battles
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn('text-sm font-bold tabular-nums', winTone(deck.winRate))}>
            {deck.winRate}%
          </p>
          <p className="text-[11px] text-muted-foreground">{deck.usage}% usage</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {deck.cards.map((key) => (
          <CardTile key={`${deck.id}-${key}`} cardKey={key} size="xxs" showElixir={false} />
        ))}
      </div>
      <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-primary/80 opacity-0 transition group-hover:opacity-100">
        Open in Deck Lab <ArrowRight className="size-3" />
      </p>
    </Link>
  )
}

function PlayerRow({ player }: { player: PlayerHit }) {
  return (
    <Link
      href={`/player?tag=${encodeURIComponent(player.tag)}`}
      className="group flex items-center gap-3 rounded-xl border border-border/70 bg-white/[0.03] p-3 transition-colors hover:border-primary/40 hover:bg-white/[0.05]"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15">
        <UserRound className="size-4 text-primary" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold group-hover:text-primary">
          {player.name}
        </span>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">
          {player.tag}
          {player.source === 'tracked' ? ' · tracked' : ''}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-bold tabular-nums">
          {player.trophies.toLocaleString()}
        </span>
        {player.winRate !== null && (
          <span className={cn('block text-[11px] tabular-nums', winTone(player.winRate))}>
            {player.winRate}% WR
          </span>
        )}
      </span>
    </Link>
  )
}

export function SearchConsole() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)

  const [meta, setMeta] = useState<MetaSnapshot | null>(null)
  const [metaState, setMetaState] = useState<MetaState>('loading')
  const [tracked, setTracked] = useState<TrackedPlayer[]>([])
  const recents = useRecentPlayers()

  const [query, setQuery] = useState(() => params.get('q') ?? '')

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    ;(async () => {
      const [metaRes, playersRes] = await Promise.all([
        fetch('/api/meta', { cache: 'no-store', signal: controller.signal }),
        fetch('/api/players', { cache: 'no-store', signal: controller.signal }).catch(
          () => null,
        ),
      ])
      if (cancelled) return
      if (metaRes.ok) {
        const snapshot = (await metaRes.json()) as MetaSnapshot
        if (cancelled) return
        setMeta(snapshot)
        setMetaState('ready')
      } else {
        setMetaState('failed')
      }
      // The tracked list needs a database; without it the section still works
      // from local recent players, so a failure here is not an error state.
      if (playersRes?.ok) {
        const payload = (await playersRes.json()) as { players?: TrackedPlayer[] }
        if (!cancelled) setTracked(payload.players ?? [])
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  // The input stays local so typing is instant, while `?q=` is still written
  // for shareability (same adopt-or-ignore dance as the card catalog).
  const [pushed, setPushed] = useState<string | null>(null)
  const [seenQuery, setSeenQuery] = useState(() => params.get('q') ?? '')
  const incomingQuery = params.get('q') ?? ''

  if (seenQuery !== incomingQuery) {
    setSeenQuery(incomingQuery)
    if (!(pushed !== null && incomingQuery === pushed)) setQuery(incomingQuery)
    setPushed(null)
  }

  useEffect(() => {
    const next = query.trim()
    const current = params.get('q') ?? ''
    if (next === current) return
    const timer = window.setTimeout(() => {
      setPushed(next)
      router.replace(next ? `${pathname}?q=${encodeURIComponent(next)}` : pathname, {
        scroll: false,
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query, pathname, router, params])

  const raw = query.trim()
  const needle = raw.replace(/^#/, '').toLowerCase()
  const tagQuery = raw.startsWith('#') && isLikelyTag(raw) ? normalizeTag(raw) : null

  const stats = useMemo(
    () => new Map((meta?.cards ?? []).map((card) => [card.key, card])),
    [meta],
  )

  const cardHits = useMemo(() => {
    if (!needle) return []
    return ALL_CARDS.filter(
      (card) => card.name.toLowerCase().includes(needle) || card.key.includes(needle),
    ).slice(0, 24)
  }, [needle])

  const deckHits = useMemo(() => {
    if (!needle) return []
    return (meta?.decks ?? [])
      .filter(
        (deck) =>
          deck.label.toLowerCase().includes(needle) ||
          deck.archetype.toLowerCase().includes(needle) ||
          deck.cards.some((key) => cardLabel(key).toLowerCase().includes(needle)),
      )
      .slice(0, 8)
  }, [meta, needle])

  const playerHits = useMemo<PlayerHit[]>(() => {
    if (!needle) return []
    const upper = needle.replace('#', '').toUpperCase()
    const match = (name: string, tag: string) =>
      name.toLowerCase().includes(needle) || tag.replace('#', '').toUpperCase().includes(upper)
    const rows: PlayerHit[] = []
    const seen = new Set<string>()
    for (const player of tracked) {
      if (seen.has(player.tag) || !match(player.name, player.tag)) continue
      rows.push({ ...player, source: 'tracked' })
      seen.add(player.tag)
    }
    for (const player of recents) {
      if (seen.has(player.tag) || !match(player.name, player.tag)) continue
      rows.push({
        tag: player.tag,
        name: player.name,
        trophies: player.trophies,
        winRate: null,
        source: 'recent',
      })
      seen.add(player.tag)
    }
    return rows.slice(0, 6)
  }, [needle, tracked, recents])

  const suggestionPlayers = useMemo<PlayerHit[]>(
    () =>
      recents.slice(0, 3).map((player) => ({
        tag: player.tag,
        name: player.name,
        trophies: player.trophies,
        winRate: null,
        source: 'recent',
      })),
    [recents],
  )

  const totalHits =
    cardHits.length + deckHits.length + playerHits.length + (tagQuery ? 1 : 0)

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('')
            }}
            placeholder="knight, x-bow, hog 2.6, #PLAYERTAG..."
            aria-label="Search cards, decks and players"
            className="h-11 pl-9"
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {metaState === 'ready' && meta
            ? `${meta.decks.length} top decks across ${meta.battles.toLocaleString()} battles, ${
                meta.players
              } players, ${relativeAge(meta.generatedAt)}.${
                meta.notice ? ` ${meta.notice}` : ''
              }`
            : metaState === 'failed'
              ? 'Meta sample unavailable right now — card and player search still work.'
              : 'Loading the meta sample...'}
        </p>
      </section>

      {tagQuery && (
        <Link
          href={`/player?tag=${encodeURIComponent(tagQuery)}`}
          className="panel group flex items-center gap-3 p-4 transition-colors hover:border-primary/40"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15">
            <UserRound className="size-5 text-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold group-hover:text-primary">
              Open the profile for {tagQuery}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              Win rate, archetype performance and full battle history.
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-primary" />
        </Link>
      )}

      {!raw && (
        <>
          {suggestionPlayers.length > 0 && (
            <section className="panel p-4 sm:p-5">
              <SectionHead icon={UserRound} title="Recent players" count={suggestionPlayers.length} />
              <div className="grid gap-2">
                {suggestionPlayers.map((player) => (
                  <PlayerRow key={player.tag} player={player} />
                ))}
              </div>
            </section>
          )}
          <section className="panel p-4 sm:p-5">
            <SectionHead icon={Layers} title="Top meta decks" count={meta?.decks.length ?? 0} />
            {meta && meta.decks.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {meta.decks.slice(0, 4).map((deck) => (
                  <DeckCard key={deck.id} deck={deck} />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="panel h-32 animate-pulse" />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {raw && cardHits.length > 0 && (
        <section className="panel p-4 sm:p-5">
          <SectionHead icon={LayoutGrid} title="Cards" count={cardHits.length} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cardHits.map((card) => {
              const stat: CardStat | undefined = stats.get(card.key)
              return (
                <Link
                  key={card.key}
                  href={`/cards/${card.key}`}
                  className="group rounded-xl border border-border bg-white/[0.03] p-3 transition hover:border-yellow-300/40 hover:bg-white/10"
                >
                  <CardTile cardKey={card.key} size="sm" showElixir={false} />
                  <div className="mt-2 min-w-0">
                    <p className="truncate text-sm font-semibold group-hover:text-yellow-200">
                      {card.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {card.rarity} · {card.elixir} · {card.type}
                    </p>
                  </div>
                  {stat && (
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="tabular-nums text-muted-foreground">
                        {stat.usage}% usage
                      </span>
                      <span className={cn('font-semibold tabular-nums', winTone(stat.winRate))}>
                        {stat.winRate}% WR
                      </span>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {raw && deckHits.length > 0 && (
        <section className="panel p-4 sm:p-5">
          <SectionHead icon={Layers} title="Decks" count={deckHits.length} />
          <div className="grid gap-3 md:grid-cols-2">
            {deckHits.map((deck) => (
              <DeckCard key={deck.id} deck={deck} />
            ))}
          </div>
        </section>
      )}

      {raw && playerHits.length > 0 && (
        <section className="panel p-4 sm:p-5">
          <SectionHead icon={UserRound} title="Players" count={playerHits.length} />
          <div className="grid gap-2">
            {playerHits.map((player) => (
              <PlayerRow key={player.tag} player={player} />
            ))}
          </div>
        </section>
      )}

      {raw && totalHits === 0 && metaState !== 'loading' && (
        <section className="panel grid place-items-center gap-2 p-12 text-center">
          <p className="text-sm font-semibold">Nothing matches &ldquo;{raw}&rdquo;</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Try a card name like <span className="text-foreground">knight</span>, a deck
            archetype like <span className="text-foreground">cycle</span>, or a full player
            tag like <span className="font-mono text-foreground">#2PP</span>.
          </p>
        </section>
      )}
    </div>
  )
}
