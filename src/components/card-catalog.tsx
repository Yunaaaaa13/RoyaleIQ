'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { CardTile } from '@/components/card-tile'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CardStat, MetaSnapshot } from '@/lib/battle'
import { cn, relativeAge } from '@/lib/utils'

interface CatalogCard {
  key: string
  name: string
  elixir: number
  type: string
  rarity: string
  roles: string[]
}

type SortKey = 'usage' | 'winRate' | 'name' | 'elixir'

const RARITIES = ['All', 'Common', 'Rare', 'Epic', 'Legendary', 'Champion'] as const
const TYPES = ['All', 'Troop', 'Building', 'Spell'] as const

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'usage', label: 'Usage' },
  { value: 'winRate', label: 'Win rate' },
  { value: 'elixir', label: 'Elixir' },
  { value: 'name', label: 'Name' },
]

const winTone = (rate: number) =>
  rate >= 52 ? 'text-emerald-300' : rate <= 48 ? 'text-rose-300' : 'text-muted-foreground'

export function CardCatalog() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const [catalog, setCatalog] = useState<CatalogCard[] | null>(null)
  const [stats, setStats] = useState<Map<string, CardStat>>(new Map())
  const [metaSample, setMetaSample] = useState<MetaSnapshot | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const [rarity, setRarity] = useState<string>('All')
  const [type, setType] = useState<string>('All')
  const [sort, setSort] = useState<SortKey>('usage')

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    ;(async () => {
      try {
        const [cardsRes, metaRes] = await Promise.all([
          fetch('/api/cards', { cache: 'no-store', signal: controller.signal }),
          fetch('/api/meta', { cache: 'no-store', signal: controller.signal }),
        ])
        if (!cardsRes.ok || !metaRes.ok) throw new Error('catalogue unavailable')
        const cards = (await cardsRes.json()) as { cards: CatalogCard[] }
        const meta = (await metaRes.json()) as MetaSnapshot
        if (cancelled) return
        setCatalog(cards.cards)
        setMetaSample(meta)
        setStats(new Map(meta.cards.map((card) => [card.key, card])))
        setNotice(meta.notice ?? null)
      } catch (reason) {
        if (cancelled || controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : 'Could not load the card catalogue.')
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  // The input is local so typing stays instant, but `?q=` is still written for
  // shareability. Adjusting during render keeps this free of the cascading
  // render an effect would schedule, and tracking the previous `q` is what
  // stops a local keystroke from being mistaken for an incoming change: only a
  // `q` that actually moved is adopted, and only when it is not the echo of the
  // replace we just made.
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

  const rows = useMemo(() => {
    if (!catalog) return []
    const needle = query.trim().toLowerCase()
    const filtered = catalog.filter((card) => {
      if (rarity !== 'All' && card.rarity !== rarity) return false
      if (type !== 'All' && card.type !== type) return false
      if (!needle) return true
      return card.name.toLowerCase().includes(needle) || card.key.includes(needle)
    })
    const stat = (key: string) => stats.get(key)
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'elixir') return a.elixir - b.elixir || a.name.localeCompare(b.name)
      const av = stat(a.key)?.[sort] ?? -1
      const bv = stat(b.key)?.[sort] ?? -1
      return bv - av || a.name.localeCompare(b.name)
    })
  }, [catalog, query, rarity, type, sort, stats])

  const sampled = useMemo(
    () => (catalog ? catalog.filter((card) => stats.has(card.key)).length : 0),
    [catalog, stats],
  )

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a card - knight, hog rider, fireball..."
              aria-label="Search cards"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-auto lg:shrink-0">
            <Select value={rarity} onValueChange={setRarity}>
              <SelectTrigger className="w-full" aria-label="Filter by rarity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RARITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === 'All' ? 'All rarities' : value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full" aria-label="Filter by type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === 'All' ? 'All types' : value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
              <SelectTrigger className="w-full" aria-label="Sort cards">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {catalog
            ? `${catalog.length} cards in the catalogue, ${sampled} seen in the current sample.`
            : 'Loading catalogue...'}
          {metaSample
            ? ` ${metaSample.battles} battles from ${metaSample.players} players, ${relativeAge(
                metaSample.generatedAt,
              )}.`
            : ''}
          {notice ? ` ${notice}` : ''}
        </p>
      </section>

      {error && (
        <section className="panel p-6 text-sm text-rose-300" role="alert">
          {error}
        </section>
      )}

      {!catalog && !error && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="panel h-28 animate-pulse" />
          ))}
        </div>
      )}

      {catalog && rows.length === 0 && (
        <section className="panel grid place-items-center gap-2 p-12 text-center">
          <p className="text-sm font-semibold">No card matches that filter</p>
          <p className="text-xs text-muted-foreground">
            Try a shorter name, or reset the rarity and type filters.
          </p>
        </section>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.map((card) => {
            const stat = stats.get(card.key)
            return (
              <Link
                key={card.key}
                href={`/cards/${card.key}`}
                className={cn(
                  'group rounded-xl border border-white/10 bg-white/5 p-3 transition',
                  'hover:border-yellow-300/40 hover:bg-white/10 focus-visible:outline-none',
                  'focus-visible:ring-2 focus-visible:ring-yellow-300/60',
                )}
              >
                {/* Stacked instead of side by side: at 360px a two-column cell
                    leaves the name under 70px, which truncates most card names. */}
                <CardTile cardKey={card.key} size="sm" showElixir={false} />
                <div className="mt-2 min-w-0">
                  <p className="truncate text-sm font-semibold group-hover:text-yellow-200">
                    {card.name}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {card.rarity} · {card.elixir} · {card.type}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  {stat ? (
                    <>
                      <span className="tabular-nums text-muted-foreground">{stat.usage}% usage</span>
                      <span className={cn('font-semibold tabular-nums', winTone(stat.winRate))}>
                        {stat.winRate}% WR
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">not in this sample</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
