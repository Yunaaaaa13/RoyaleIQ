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
  /**
   * Shortcuts deep-link into a section of a page that the MAIN group already
   * points at. They stay out of the active state so only one item lights up.
   */
  highlight?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/cards', label: 'Card Analytics', icon: LayoutGrid },
      { href: '/deck-lab', label: 'Deck Analytics', icon: FlaskConical },
      { href: '/meta', label: 'Meta Overview', icon: TrendingUp },
      { href: '/player', label: 'Player Analysis', icon: UserRound },
      { href: '/matchups', label: 'Matchup Analysis', icon: Scale },
    ],
  },
  {
    label: 'Intelligence',
    items: [{ href: '/deck-lab#coach', label: 'AI Recommendation', icon: Bot, highlight: false }],
  },
  {
    label: 'Tools',
    items: [
      { href: '/cards#catalog', label: 'Card Search', icon: Search, highlight: false },
      { href: '/deck-lab#workspace', label: 'Deck Builder', icon: Hammer, highlight: false },
      { href: '/player#profile', label: 'My Profile', icon: UserRoundCheck, highlight: false },
      { href: '/data', label: 'Data Pipeline', icon: Database },
    ],
  },
]

export const NAV_FLAT = NAV_GROUPS.flatMap((group) => group.items)

/** Section label for the top bar, derived from the current path. */
export function navLabelFor(pathname: string): string {
  const match = NAV_FLAT.filter((item) => item.highlight !== false)
    .filter((item) =>
      item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]
  return match?.label ?? 'RoyaleIQ'
}

export function isNavActive(pathname: string, href: string): boolean {
  const path = href.split('#')[0]
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}
