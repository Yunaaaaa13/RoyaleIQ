import type { Metadata } from 'next'
import { Suspense } from 'react'
import { MatchupMatrix } from '@/components/matchup-matrix'
import { PageTransition } from '@/components/page-transition'

export const metadata: Metadata = {
  title: 'Matchup Matrix',
  description:
    'Archetype versus archetype win rates built from stored Clash Royale battles, with the model projection next to the recorded result.',
}

function MatrixFallback() {
  return (
    <div className="space-y-4">
      <div className="panel h-20 animate-pulse" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="panel h-96 animate-pulse" />
        <div className="space-y-4">
          <div className="panel h-44 animate-pulse" />
          <div className="panel h-44 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export default function MatchupsPage() {
  return (
    <PageTransition className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-2 border-b border-border/70 pb-5">
        <p className="eyebrow">Matchup Matrix</p>
        <h1 className="page-title">Which archetypes actually beat yours?</h1>
        <p className="page-lede">
          A grid of recorded results - archetype you played down the side, archetype you
          faced across the top. Every cell is a count of stored battles with its own
          sample size, and the hover shows the gap against the archetype model.
        </p>
      </header>
      <Suspense fallback={<MatrixFallback />}>
        <MatchupMatrix />
      </Suspense>
    </PageTransition>
  )
}
