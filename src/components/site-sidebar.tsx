'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Crown, Sparkles } from 'lucide-react'
import { NAV_GROUPS, isNavActive } from '@/components/nav-config'
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
        className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-5 transition-colors hover:bg-slate-50"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-primary text-white shadow-sm">
          <Crown className="size-4" strokeWidth={2.5} />
        </span>
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight text-foreground">
            Royale<span className="gold-text">IQ</span>
          </span>
          <span className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            Clash Royale Analytics
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
                    const active = isNavActive(pathname, item.href)
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                            active
                              ? 'bg-sidebar-accent text-sidebar-primary'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-foreground',
                          )}
                        >
                          <item.icon
                            className={cn(
                              'size-4 shrink-0 transition-colors',
                              active
                                ? 'text-sidebar-primary'
                                : 'text-muted-foreground group-hover:text-foreground',
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                        </Link>
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
          href="/ai-coach"
          className="group flex items-center gap-2.5 rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-[13px] font-medium text-slate-700 transition-colors hover:border-primary/30 hover:bg-accent hover:text-accent-foreground"
        >
          <Sparkles className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">Ask the AI coach</span>
        </Link>
      </div>
    </aside>
  )
}
