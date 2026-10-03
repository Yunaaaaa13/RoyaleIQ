import Link from 'next/link'
import { Crown } from 'lucide-react'

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-black/20">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Crown className="size-4 text-yellow-400" />
          <span>
            RoyaleIQ — unofficial analytics for Clash Royale. Not affiliated with
            Supercell.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <Link href="/deck-lab" className="hover:text-foreground">
            Deck Lab
          </Link>
          <Link href="/matchups" className="hover:text-foreground">
            Matchups
          </Link>
          <Link href="/meta" className="hover:text-foreground">
            Meta
          </Link>
          <Link href="/player" className="hover:text-foreground">
            Player
          </Link>
          <Link href="/data" className="hover:text-foreground">
            Data Pipeline
          </Link>
        </div>
      </div>
    </footer>
  )
}
