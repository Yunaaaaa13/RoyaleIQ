import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SearchConsole } from '@/components/search-console'

export const metadata: Metadata = {
  title: 'Search',
  description:
    'Search every Clash Royale card, top meta deck and player in one box — then jump straight to the card, the deck lab or the profile.',
}

function SearchFallback() {
  return (
    <div className="space-y-4">
      <div className="panel h-24 animate-pulse" />
      <div className="panel h-40 animate-pulse" />
      <div className="panel h-56 animate-pulse" />
    </div>
  )
}

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-2 border-b border-border/70 pb-5">
        <p className="eyebrow">Universal Search</p>
        <h1 className="page-title">What are you looking for?</h1>
        <p className="page-lede">
          Cards, top meta decks and players in one box. Jump to a card, open a deck
          straight in the Lab with its analysis ready, or load a player profile.
        </p>
      </header>
      <Suspense fallback={<SearchFallback />}>
        <SearchConsole />
      </Suspense>
    </div>
  )
}
