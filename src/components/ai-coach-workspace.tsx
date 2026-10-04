'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FlaskConical, LayoutTemplate } from 'lucide-react'
import { CoachPanel } from '@/components/coach-panel'
import { DeckSelection, SAMPLE, useDeckParams } from '@/components/deck-selection'
import { Button } from '@/components/ui/button'

/**
 * AI Recommendation: the coach's own home. The deck is chosen right here —
 * the same editing surface as the builder — so intelligence never depends on
 * first visiting Deck Analytics.
 */
export function AiCoachWorkspace() {
  const { deck, setDeck, tag, setTag } = useDeckParams()
  const [opponentDeck, setOpponentDeck] = useState<string[]>([])
  const deckParam = encodeURIComponent(deck.join(','))

  return (
    <div className="space-y-6">
      <DeckSelection deck={deck} setDeck={setDeck} />

      {deck.length >= 4 ? (
        <CoachPanel
          deck={deck}
          opponentDeck={opponentDeck}
          setOpponentDeck={setOpponentDeck}
          tag={tag}
          setTag={setTag}
        />
      ) : (
        <section className="panel flex flex-col items-center gap-3 p-10 text-center">
          <span className="text-3xl">🤖</span>
          <h2 className="text-lg font-semibold">The coach needs a deck first</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Pick at least 4 cards above and the coach appears below — ask it
            anything, from a hard matchup to what your win condition is missing.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setDeck(SAMPLE)}>
              <LayoutTemplate className="size-4" />
              Load the X-Bow sample
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/deck-lab?deck=${deckParam}`}>
                <FlaskConical className="size-4" />
                Open in Deck Analytics
              </Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
