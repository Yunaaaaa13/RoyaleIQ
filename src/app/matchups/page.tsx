import type { Metadata } from 'next'
import { Suspense } from 'react'
import { MatchupMatrix } from '@/components/matchup-matrix'

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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
          Matchup Matrix
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Which archetypes actually beat yours?
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A grid of recorded results - archetype you played down the side, archetype you
          faced across the top. Every cell is a count of stored battles with its own
          sample size, and the hover shows the gap against the archetype model.
        </p>
      </header>
      <Suspense fallback={<MatrixFallback />}>
        <MatchupMatrix />
      </Suspense>
    </div>
  )
}
