import type { Metadata } from 'next'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { BattlePage } from '@/components/battle-page'

export const metadata: Metadata = {
  title: 'Battle Dashboard',
  description:
    'A single battle, side by side: both decks, the matchup breakdown, the pre-match prediction and the evidence behind every score.',
}

function BattleFallback() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="panel h-24 animate-pulse" />
      <div className="panel h-40 animate-pulse" />
      <div className="panel h-64 animate-pulse" />
    </div>
  )
}

export default async function BattleRoute() {
  // The panel reads `?tag=` and `?t=` from the URL, which are empty while this
  // route is prerendered. Waiting for the request makes `useSearchParams`
  // resolve on the server too, so the emitted HTML matches the client.
  await connection()

  return (
    // The enter animation moved into `BattlePage`: the slide-out has to run on
    // the same element that slid in, and only the client can start it.
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Suspense fallback={<BattleFallback />}>
        <BattlePage />
      </Suspense>
    </div>
  )
}
