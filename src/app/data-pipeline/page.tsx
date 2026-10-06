import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PipelineStatus } from '@/components/pipeline-status'
import { PageTransition } from '@/components/page-transition'

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
    <PageTransition className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-2 border-b border-border/70 pb-5">
        <p className="eyebrow">Data Pipeline</p>
        <h1 className="page-title">Where does every number come from?</h1>
        <p className="page-lede">
          Nothing in RoyaleIQ is invented. This page shows the live path from the
          Clash Royale API through PostgreSQL to the charts - including which caches
          are warm, how fresh each player is, and how much raw payload is kept for
          battle diagnosis.
        </p>
      </header>
      <Suspense fallback={<StatusFallback />}>
        <PipelineStatus />
      </Suspense>
    </PageTransition>
  )
}
