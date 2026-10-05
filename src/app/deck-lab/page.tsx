import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DeckWorkspace } from '@/components/deck-workspace'
import { META_DECK_COUNT } from '@/lib/meta-decks'

export const metadata: Metadata = {
  title: 'Deck Recommendation',
  description:
    'Deck recommendation with analysis: pick 4+ cards and RoyaleIQ ranks a curated library of 100+ meta decks against the sampled meta, then diagnoses the build you choose.',
}

function WorkspaceFallback() {
  return (
    <div className="space-y-4">
      <div className="panel h-56 animate-pulse" />
      <div className="panel h-80 animate-pulse" />
    </div>
  )
}

export default function DeckLabPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-2 border-b border-border/70 pb-5">
        <p className="eyebrow">Deck Recommendation</p>
        <h1 className="page-title">Which meta deck fits your cards?</h1>
        <p className="page-lede">
          Pick at least 4 cards and RoyaleIQ ranks a curated library of{' '}
          {META_DECK_COUNT} meta decks against the current sample — then keeps the
          diagnosis, matchup projections and data-driven swaps attached to
          whichever build you choose.
        </p>
      </header>
      <Suspense fallback={<WorkspaceFallback />}>
        <DeckWorkspace />
      </Suspense>
    </div>
  )
}
