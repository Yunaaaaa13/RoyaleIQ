import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DeckBuilderWorkspace } from '@/components/deck-builder-workspace'

export const metadata: Metadata = {
  title: 'Deck Builder',
  description:
    'Assemble a Clash Royale deck card by card: live average elixir and archetype, save your builds, and hand any deck to analysis with one click.',
}

function BuilderFallback() {
  return (
    <div className="space-y-4">
      <div className="panel h-56 animate-pulse" />
      <div className="panel h-80 animate-pulse" />
    </div>
  )
}

export default function DeckBuilderPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-2 border-b border-border/70 pb-5">
        <p className="eyebrow">Deck Builder</p>
        <h1 className="page-title">Build it here, analyse it there</h1>
        <p className="page-lede">
          Pick cards and watch the average elixir and archetype update live, save
          the builds you like, then hand any deck to Deck Analytics with one
          click — the builder never jumps to analysis on its own.
        </p>
      </header>
      <Suspense fallback={<BuilderFallback />}>
        <DeckBuilderWorkspace />
      </Suspense>
    </div>
  )
}
