import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PipelineStatus } from '@/components/pipeline-status'

export const metadata: Metadata = {
  title: 'Data Pipeline',
  description:
    'Where RoyaleIQ data comes from: Clash Royale API, PostgreSQL persistence, caching layers, sync freshness and record counts.',
}

function StatusFallback() {
  return (
    <div className="space-y-4">
      <div className="panel h-64 animate-pulse" />
      <div className="panel h-40 animate-pulse" />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel h-72 animate-pulse" />
        <div className="panel h-72 animate-pulse" />
      </div>
    </div>
  )
}

export default function DataPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
          Data Pipeline
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Where does every number come from?
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Nothing in RoyaleIQ is invented. This page shows the live path from the
          Clash Royale API through PostgreSQL to the charts - including which caches
          are warm, how fresh each player is, and how much raw payload is kept for
          battle diagnosis.
        </p>
      </header>
      <Suspense fallback={<StatusFallback />}>
        <PipelineStatus />
      </Suspense>
    </div>
  )
}
