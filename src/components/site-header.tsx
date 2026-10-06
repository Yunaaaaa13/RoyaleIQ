'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Fragment, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, Crown, Search, Swords, Trophy, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NAV_GROUPS, isNavActive, navLabelFor } from '@/components/nav-config'
import { ALL_CARDS, findCard } from '@/lib/cards'
import { DURATION, EASE_OUT } from '@/lib/motion'
import { isClientBooted } from '@/components/page-transition'
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
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        {/* The sidebar carries the lockup from lg up; this is its below-lg stand-in. */}
        <Link href="/" className="group flex shrink-0 items-center gap-2 lg:hidden">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-white shadow-sm transition group-hover:scale-105">
            <Crown className="size-4" strokeWidth={2.5} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight">
              Royale<span className="gold-text">IQ</span>
            </span>
            {/* The subline is the widest part of the lockup; dropping it below
                `sm` is what buys the tag field its 130px on a 360px screen. */}
            <span className="hidden text-[9px] uppercase tracking-[0.16em] text-muted-foreground sm:block">
              Clash Royale Analytics
            </span>
          </span>
        </Link>

        {/* Desktop context: breadcrumb left, chrome right. */}
        <p className="hidden min-w-0 items-baseline gap-1.5 lg:flex">
          <motion.span
            key={pathname}
            initial={isClientBooted() ? { opacity: 0, y: 4 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.micro, ease: EASE_OUT }}
            className="eyebrow truncate"
          >
            {navLabelFor(pathname)}
          </motion.span>
          <ChevronRight aria-hidden className="size-3 shrink-0 text-muted-foreground/60" />
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
              placeholder="Search tag or card…"
              aria-label="Player tag or card name"
              className="h-9 w-full rounded-lg border-border bg-card pl-9 font-mono text-xs normal-case sm:w-48 lg:w-64"
            />
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: DURATION.micro, ease: EASE_OUT }}
                  className="absolute left-0 right-0 top-full z-50 mt-2 origin-top overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg"
                >
                  <p className="section-title px-2 py-1.5 text-[10px]">Recent players</p>
                  {matches.map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => openRecent(item)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-150 hover:bg-accent"
                    >
                      <span className="min-w-0 truncate font-medium">{item.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {item.tag}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-primary">
                        {item.trophies.toLocaleString()}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Button
            type="submit"
            size="sm"
            aria-label="Analyze a player tag or open a card"
            className="h-9 shrink-0 gap-1.5 rounded-lg px-4 font-semibold"
          >
            <Swords className="size-4" />
            <span className="hidden sm:inline">Analyze</span>
          </Button>
        </form>

        {/* Season / trophy context chips + profile. */}
        <div className="hidden items-center gap-2 md:flex">
          <span className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground lg:flex">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            Season 64
          </span>
          <span className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground xl:flex">
            <Trophy className="size-3.5 text-amber-500" aria-hidden />
            Ladder
          </span>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-lg"
          >
            <Link href="/profile">
              <UserRound className="size-3.5" />
              Profile
            </Link>
          </Button>
        </div>
      </div>

      {/* Grouped link strip: the below-lg face of the sidebar. */}
      <nav className="scroll-thin flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-1.5 lg:hidden">
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
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-slate-100 hover:text-foreground'
                  }`}
                >
                  <item.icon
                    className={`size-3.5 transition-colors duration-150 ${active ? 'text-primary' : 'text-muted-foreground'}`}
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
