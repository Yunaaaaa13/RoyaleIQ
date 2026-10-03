'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Crown, Search, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ALL_CARDS, findCard } from '@/lib/cards'
import { readRecent, type RecentPlayer } from '@/lib/recent-players'
import { normalizeTag } from '@/lib/tags'

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/deck-lab', label: 'Deck Lab' },
  { href: '/cards', label: 'Cards' },
  { href: '/matchups', label: 'Matchups' },
  { href: '/meta', label: 'Meta' },
  { href: '/player', label: 'Player' },
  { href: '/players', label: 'Players' },
  { href: '/data', label: 'Data' },
]

/**
 * One box for the three things people type here: a `#player tag`, an exact
 * card name, or anything partial. Tag wins over card text so `#knight` is
 * still read as a tag, not the card.
 */
function resolveQuery(raw: string) {
  const text = raw.trim()
  if (!text) return null
  if (text.startsWith('#')) return `/player?tag=${encodeURIComponent(normalizeTag(text))}`

  const exact = findCard(text)
  if (exact) return `/cards/${exact.key}`

  const needle = text.toLowerCase()
  const matches = ALL_CARDS.filter((card) => card.name.toLowerCase().includes(needle))
  if (matches.length === 1) return `/cards/${matches[0].key}`

  return `/cards?q=${encodeURIComponent(text)}`
}

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [tag, setTag] = useState('')
  const [recents, setRecents] = useState<RecentPlayer[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    setRecents(readRecent())
  }, [pathname])

  const needle = tag.trim()
  const matches = recents.filter((item) => {
    if (!needle) return true
    if (!needle.startsWith('#')) return false
    const clean = normalizeTag(needle).toLowerCase()
    return item.tag.toLowerCase().includes(clean) || item.name.toLowerCase().includes(needle.toLowerCase())
  })
  const showHistory = historyOpen && matches.length > 0

  function openRecent(item: RecentPlayer) {
    setHistoryOpen(false)
    setTag('')
    router.push(`/player?tag=${encodeURIComponent(item.tag)}`)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const target = resolveQuery(tag)
    // Below sm the field is hidden, so an empty submit has to lead somewhere
    // useful instead of being a dead button.
    setHistoryOpen(false)
    router.push(target ?? '/player')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-yellow-300 to-amber-600 text-black shadow-lg shadow-yellow-500/20 transition group-hover:scale-105">
            <Crown className="size-5" strokeWidth={2.5} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-lg font-bold tracking-tight">
              Royale<span className="gold-text">IQ</span>
            </span>
            {/* The subline is the widest part of the lockup; dropping it below
                `sm` is what buys the tag field its 130px on a 360px screen. */}
            <span className="hidden text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
              Deck Intelligence
            </span>
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-white/10 text-foreground'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* `flex-1` lets the form take whatever the logo leaves over on a phone;
            at `sm` it snaps back to its fixed width and sits against the right. */}
        <form onSubmit={submit} className="ml-auto flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <div className="relative min-w-0 flex-1 sm:block sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              onFocus={() => setHistoryOpen(true)}
              onBlur={() => setHistoryOpen(false)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setHistoryOpen(false)
              }}
              placeholder="#TAG OR CARD"
              aria-label="Player tag or card name"
              className="h-9 w-full rounded-full pl-9 font-mono text-xs uppercase sm:w-44 lg:w-56"
            />
            {showHistory && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-background/95 p-1 shadow-2xl backdrop-blur-xl">
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent players
                </p>
                {matches.map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => openRecent(item)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-white/10"
                  >
                    <span className="min-w-0 truncate font-medium">{item.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {item.tag}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-yellow-300/80">
                      {item.trophies.toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            aria-label="Analyze a player tag or open a card"
            className="h-9 shrink-0 gap-1.5 rounded-full px-4 font-semibold"
          >
            <Swords className="size-4" />
            <span className="hidden sm:inline">Analyze</span>
          </Button>
        </form>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
        {NAV.map((item) => {
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                active ? 'bg-white/10 text-foreground' : 'text-muted-foreground'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
