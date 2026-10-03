import type { Metadata } from 'next'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { PlayerPanel } from '@/components/player-panel'

export const metadata: Metadata = {
  title: 'Player Tracker',
  description:
    'Track a Clash Royale player: win rate, archetype performance, best and worst matchups, and full battle history.',
}

function PlayerFallback() {
  return (
    <div className="space-y-4">
      <div className="panel h-20 animate-pulse" />
      <div className="panel h-40 animate-pulse" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel h-72 animate-pulse lg:col-span-2" />
        <div className="panel h-72 animate-pulse" />
      </div>
    </div>
  )
}

export default async function PlayerPage() {
  // The panel renders straight from `?tag=`, which is empty while this route
  // is prerendered. Waiting for the request makes `useSearchParams` resolve on
  // the server too, so the emitted HTML matches what the client hydrates.
  await connection()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
          Player Tracker
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Your results, not your memory
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Enter any player tag to see win rate over time, which archetypes you beat and
          which ones destroy you, plus the card that quietly costs you games.
        </p>
      </header>
      <Suspense fallback={<PlayerFallback />}>
        <PlayerPanel />
      </Suspense>
    </div>
  )
}
