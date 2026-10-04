import type { LucideIcon } from 'lucide-react'
import {
  Bot,
  Database,
  FlaskConical,
  Hammer,
  LayoutDashboard,
  LayoutGrid,
  Scale,
  Search,
  TrendingUp,
  UserRound,
  UserRoundCheck,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * One primary route per item — no two menu entries share a destination.
 * Analytics routes live under Main, intelligence under Intelligence, and the
 * find/build/view utilities under Tools.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/cards', label: 'Card Analytics', icon: LayoutGrid },
      { href: '/deck-lab', label: 'Deck Analytics', icon: FlaskConical },
      { href: '/meta', label: 'Meta Overview', icon: TrendingUp },
      { href: '/player', label: 'Player Analysis', icon: UserRound },
      { href: '/matchup', label: 'Matchup Analysis', icon: Scale },
    ],
  },
  {
    label: 'Intelligence',
    items: [{ href: '/ai-coach', label: 'AI Recommendation', icon: Bot }],
  },
  {
    label: 'Tools',
    items: [
      { href: '/search', label: 'Global Search', icon: Search },
      { href: '/deck-builder', label: 'Deck Builder', icon: Hammer },
      { href: '/profile', label: 'My Profile', icon: UserRoundCheck },
      { href: '/data-pipeline', label: 'Data Pipeline', icon: Database },
    ],
  },
]

export const NAV_FLAT = NAV_GROUPS.flatMap((group) => group.items)

/** Section label for the top bar, derived from the current path. */
export function navLabelFor(pathname: string): string {
  const match = NAV_FLAT.filter((item) =>
    item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`),
  )
    .sort((a, b) => b.href.length - a.href.length)[0]
  return match?.label ?? 'RoyaleIQ'
}

/** The active sidebar item follows the pathname; `/cards/knight` still reads as Card Analytics. */
export function isNavActive(pathname: string, href: string): boolean {
  const path = href.split('#')[0]
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}
