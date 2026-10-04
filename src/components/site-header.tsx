'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Fragment, useState } from 'react'
import { Crown, Search, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NAV_GROUPS, isNavActive, navLabelFor } from '@/components/nav-config'
import { ALL_CARDS, findCard } from '@/lib/cards'
import { useRecentPlayers, type RecentPlayer } from '@/lib/recent-players'
import { normalizeTag } from '@/lib/tags'

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

  // Anything partial belongs on the universal search page, which also covers
  // meta decks and players — not just cards.
  return `/search?q=${encodeURIComponent(text)}`
}

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [tag, setTag] = useState('')
  const recents = useRecentPlayers()
  const [historyOpen, setHistoryOpen] = useState(false)

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
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        {/* The sidebar carries the lockup from lg up; this is its below-lg stand-in. */}
        <Link href="/" className="group flex shrink-0 items-center gap-2 lg:hidden">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 text-white shadow-lg shadow-blue-600/25 transition group-hover:scale-105">
            <Crown className="size-4" strokeWidth={2.5} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight">
              Royale<span className="gold-text">IQ</span>
            </span>
            {/* The subline is the widest part of the lockup; dropping it below
                `sm` is what buys the tag field its 130px on a 360px screen. */}
            <span className="hidden text-[9px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
              Deck Intelligence
            </span>
          </span>
        </Link>

        {/* Desktop context: where the search box sits relative to the rail. */}
        <p className="hidden min-w-0 items-baseline gap-2 lg:flex">
          <span className="eyebrow truncate">{navLabelFor(pathname)}</span>
          <span className="truncate text-xs text-muted-foreground">RoyaleIQ analytics</span>
        </p>

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
              className="h-9 w-full rounded-full border-border/80 bg-black/25 pl-9 font-mono text-xs uppercase sm:w-44 lg:w-64"
            />
            {showHistory && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border/80 bg-popover/95 p-1 shadow-2xl backdrop-blur-xl">
                <p className="section-title px-2 py-1.5 text-[10px]">Recent players</p>
                {matches.map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => openRecent(item)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-primary/15"
                  >
                    <span className="min-w-0 truncate font-medium">{item.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {item.tag}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-primary/90">
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

      {/* Grouped link strip: the below-lg face of the sidebar. */}
      <nav className="scroll-thin flex items-center gap-1 overflow-x-auto border-t border-border/60 px-4 py-1.5 lg:hidden">
        {NAV_GROUPS.map((group, groupIndex) => (
          <Fragment key={group.label}>
            {groupIndex > 0 && (
              <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />
            )}
            {group.items.map((item) => {
              const active = isNavActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-primary/15 text-foreground'
                      : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground'
                  }`}
                >
                  <item.icon
                    className={`size-3.5 ${active ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  {item.label}
                </Link>
              )
            })}
          </Fragment>
        ))}
      </nav>
    </header>
  )
}
