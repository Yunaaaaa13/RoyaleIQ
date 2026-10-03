'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Crown, Sparkles } from 'lucide-react'
import { NAV_GROUPS, isNavActive } from '@/components/nav-config'
import { NavItemLink } from '@/components/nav-item-link'
import { cn } from '@/lib/utils'

/**
 * Fixed left rail on lg and up. Below lg it is not rendered at all — the top
 * bar keeps the same grouped links in its scroll strip, so nothing is lost.
 */
export function SiteSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <Link
        href="/"
        className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-5 transition-colors hover:bg-white/[0.03]"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 text-white shadow-lg shadow-blue-600/25">
          <Crown className="size-4" strokeWidth={2.5} />
        </span>
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight">
            Royale<span className="gold-text">IQ</span>
          </span>
          <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            Deck Intelligence
          </span>
        </span>
      </Link>

      <nav className="scroll-thin flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => {
          const open = !collapsed[group.label]
          return (
            <div key={group.label}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() =>
                  setCollapsed((state) => ({ ...state, [group.label]: open }))
                }
                className="section-title flex w-full items-center gap-1.5 px-2.5 pb-1.5 text-left transition-colors hover:text-foreground"
              >
                <span className="flex-1 truncate">{group.label}</span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    'size-3 shrink-0 transition-transform duration-200',
                    open ? 'rotate-0 opacity-60' : '-rotate-90 opacity-40',
                  )}
                />
              </button>
              {open && (
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active =
                      item.highlight !== false && isNavActive(pathname, item.href)
                    return (
                      <li key={item.href}>
                        <NavItemLink
                          item={item}
                          className={cn(
                            'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                            active
                              ? 'bg-primary/15 text-foreground'
                              : 'text-sidebar-foreground/70 hover:bg-white/[0.06] hover:text-foreground',
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              'absolute -left-3 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary transition-all',
                              active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40',
                            )}
                          />
                          <item.icon
                            className={cn(
                              'size-4 shrink-0 transition-colors',
                              active
                                ? 'text-primary'
                                : 'text-muted-foreground group-hover:text-foreground',
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                        </NavItemLink>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/deck-lab#coach"
          className="group flex items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5 text-[13px] font-medium transition-colors hover:border-primary/45 hover:bg-primary/15"
        >
          <Sparkles className="size-4 shrink-0 text-primary transition-transform group-hover:scale-110" />
          <span className="min-w-0 flex-1 truncate">Ask the AI coach</span>
        </Link>
      </div>
    </aside>
  )
}
