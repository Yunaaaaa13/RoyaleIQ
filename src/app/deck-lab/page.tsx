import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DeckWorkspace } from '@/components/deck-workspace'

export const metadata: Metadata = {
  title: 'Deck Lab',
  description:
    'Analyse any Clash Royale deck: average elixir, win condition, air defence, cycle speed, weaknesses and data-driven card swaps.',
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
        <p className="eyebrow">Deck Lab</p>
        <h1 className="page-title">What is actually wrong with this deck?</h1>
        <p className="page-lede">
          RoyaleIQ does not stop at average elixir. It reads every card role, scores
          the five dimensions that decide games, flags structural weaknesses and only
          then proposes a swap — with the reasoning attached.
        </p>
      </header>
      <Suspense fallback={<WorkspaceFallback />}>
        <DeckWorkspace />
      </Suspense>
    </div>
  )
}
