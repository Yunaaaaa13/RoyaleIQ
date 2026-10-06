import type { Metadata } from 'next'
import { DeckDetail } from '@/components/deck-detail'
import { PageTransition } from '@/components/page-transition'
import { deckLabel } from '@/lib/battle'
import { getCard } from '@/lib/cards'

interface DeckPageProps {
  params: Promise<{ id: string }>
}

/** The id is eight card keys joined by commas; unknown keys are dropped. */
function parseId(id: string): string[] {
  let raw = id
  try {
    raw = decodeURIComponent(id)
  } catch {
    // A malformed escape can only mean the id itself was the raw string.
  }
  return raw
    .split(',')
    .map((key) => key.trim().toLowerCase())
    .filter((key) => Boolean(getCard(key)))
    .slice(0, 8)
}

export async function generateMetadata({ params }: DeckPageProps): Promise<Metadata> {
  const { id } = await params
  const cards = parseId(id)
  if (cards.length < 4) return { title: 'Deck' }
  return {
    title: `${deckLabel(cards)} - Deck`,
    description: `A saved Clash Royale deck: card list, average elixir, archetype and full diagnosis.`,
  }
}

export default async function DeckPage({ params }: DeckPageProps) {
  const { id } = await params
  const cards = parseId(id)

  return (
    <PageTransition className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-2 border-b border-border/70 pb-5">
        <p className="eyebrow">Saved Deck</p>
        <h1 className="page-title">One deck, every angle</h1>
        <p className="page-lede">
          The saved build as a stable page: card list, average elixir, archetype and
          the full diagnosis — with edit, analyze and coach one click away.
        </p>
      </header>
      <DeckDetail cards={cards} />
    </PageTransition>
  )
}
