'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import type { NavItem } from '@/components/nav-config'
import { useRecentPlayers } from '@/lib/recent-players'

/**
 * Nav links go through here so an item can resolve at click time. A plain
 * `Link` cannot know about `localStorage`, but "My Profile" needs exactly that:
 * it opens the most recent player when there is one, and only falls back to the
 * bare `#profile` form when there is not.
 */
export function NavItemLink({
  item,
  className,
  children,
}: {
  item: NavItem
  className?: string
  children: ReactNode
}) {
  const router = useRouter()
  const recents = useRecentPlayers()

  function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (item.behavior !== 'recent-player') return
    event.preventDefault()
    const latest = recents[0]
    router.push(
      latest ? `/player?tag=${encodeURIComponent(latest.tag)}#profile` : item.href,
    )
  }

  return (
    <Link href={item.href} onClick={onClick} className={className}>
      {children}
    </Link>
  )
}
