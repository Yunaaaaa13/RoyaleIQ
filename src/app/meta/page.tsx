import type { Metadata } from 'next'
import { Suspense } from 'react'
import { MetaDashboard } from '@/components/meta-dashboard'
import { PageTransition } from '@/components/page-transition'

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
    <PageTransition className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-2 border-b border-border/70 pb-5">
        <p className="eyebrow">Meta Analytics</p>
        <h1 className="page-title">What is actually being played?</h1>
        <p className="page-lede">
          Card usage, win rate, archetype share and momentum &mdash; aggregated from ladder
          battle logs instead of guessed from tier lists.
        </p>
      </header>
      <Suspense fallback={<MetaFallback />}>
        <MetaDashboard />
      </Suspense>
    </PageTransition>
  )
}
