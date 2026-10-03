import type { Metadata } from 'next'
import { Suspense } from 'react'
import { MetaDashboard } from '@/components/meta-dashboard'

export const metadata: Metadata = {
  title: 'Meta Analytics',
  description:
    'Live Clash Royale meta: card usage, win rates, archetype share, trending cards and top performing decks.',
}

function MetaFallback() {
  return (
    <div className="space-y-4">
      <div className="panel h-24 animate-pulse" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel h-72 animate-pulse lg:col-span-2" />
        <div className="panel h-72 animate-pulse" />
      </div>
    </div>
  )
}

export default function MetaPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
          Meta Analytics
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          What is actually being played?
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Card usage, win rate, archetype share and momentum — aggregated from ladder
          battle logs instead of guessed from tier lists.
        </p>
      </header>
      <Suspense fallback={<MetaFallback />}>
        <MetaDashboard />
      </Suspense>
    </div>
  )
}
