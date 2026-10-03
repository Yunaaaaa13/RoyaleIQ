import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CardCatalog } from '@/components/card-catalog'

export const metadata: Metadata = {
  title: 'Card Intelligence',
  description:
    'Every Clash Royale card with its sample usage and win rate, plus the decks, synergies and matchups each card sits in.',
}

function CatalogFallback() {
  return (
    <div className="space-y-4">
      <div className="panel h-24 animate-pulse" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="panel h-28 animate-pulse" />
        ))}
      </div>
    </div>
  )
}

export default function CardsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-300/80">
          Card Intelligence
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Which cards are in the meta?</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Every card in the catalogue, ranked by how much of the current sample it appears in.
          Open one for its usage trend, the decks carrying it, its published synergy pairs and a
          rules-written read of what the numbers say.
        </p>
      </header>
      <Suspense fallback={<CatalogFallback />}>
        <CardCatalog />
      </Suspense>
    </div>
  )
}
