import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DeckWorkspace } from '@/components/deck-workspace'

export const metadata: Metadata = {
  title: 'Deck Recommendation',
  description:
    'Meta Deck Explorer: browse every archetype players actually piloted in the sampled meta — real deck variants with usage, win rate, trends and matchup insight — then rank the same meta against your 4+ card selection.',
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
        <h1 className="page-title">Meta Deck Explorer</h1>
        <p className="page-lede">
          Browse the archetypes players actually piloted — every deck, usage figure and win
          rate below is measured from the current battle sample. Pick 4+ cards and the same
          meta ranks itself against your selection, with diagnosis, matchup projections and
          the AI coach attached to whichever build you choose.
        </p>
      </header>
      <Suspense fallback={<WorkspaceFallback />}>
        <DeckWorkspace />
      </Suspense>
    </div>
  )
}
