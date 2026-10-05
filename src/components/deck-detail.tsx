'use client'

import Link from 'next/link'
import { Bot, FlaskConical, Pencil, Save, X } from 'lucide-react'
import { CardTile } from '@/components/card-tile'
import { DiagnosisPanel } from '@/components/deck-panels'
import { DeckStats, analyzeIfReady } from '@/components/deck-selection'
import { Button } from '@/components/ui/button'
import { deckLabel } from '@/lib/battle'
import { deckId, removeSavedDeck, saveDeck, useSavedDecks } from '@/lib/saved-decks'
import { useMetaSnapshot } from '@/lib/use-meta'
import { relativeAge } from '@/lib/utils'

/**
 * One deck under the microscope: the shared `/decks/[id]` view for both saved
 * builds and hand-shared links. Every action routes to the owning page —
 * builder for editing, deck lab for scoring, ai-coach for intelligence.
 */
export function DeckDetail({ cards }: { cards: string[] }) {
  const saved = useSavedDecks()
  const { snapshot } = useMetaSnapshot()
  const analysis = analyzeIfReady(cards)
  const id = deckId(cards)
  const entry = saved.find((deck) => deck.id === id)
  const deckParam = encodeURIComponent(cards.join(','))

  if (cards.length < 4) {
    return (
      <section className="panel grid place-items-center gap-3 p-12 text-center">
        <span className="text-3xl">🃏</span>
        <h2 className="text-lg font-semibold">That is not a readable deck</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          A deck id is the eight card keys joined by commas — at least four known
          cards are needed before RoyaleIQ can say anything about it.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild className="gap-2">
            <Link href="/deck-builder">
              <Pencil className="size-4" />
              Open Deck Builder
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/search">
              <FlaskConical className="size-4" />
              Find a card first
            </Link>
          </Button>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Deck</p>
            <h2 className="text-xl font-bold tracking-tight">
              {entry?.label ?? deckLabel(cards)}
            </h2>
            <p className="text-xs text-muted-foreground">
              {cards.length} cards
              {entry ? ` · saved ${relativeAge(entry.savedAt)}` : ' · not saved yet'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {entry ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => removeSavedDeck(entry.id)}
              >
                <X className="size-3.5" />
                Remove from saved
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => saveDeck({ label: deckLabel(cards), cards })}
              >
                <Save className="size-3.5" />
                Save deck
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
              <Link href={`/ai-coach?deck=${deckParam}`}>
                <Bot className="size-3.5" />
                Ask the AI coach
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
              <Link href={`/deck-builder?deck=${deckParam}`}>
                <Pencil className="size-3.5" />
                Edit in Deck Builder
              </Link>
            </Button>
            <Button asChild size="sm" className="h-8 gap-1.5">
              <Link href={`/deck-lab?deck=${deckParam}`}>
                <FlaskConical className="size-3.5" />
                Analyze
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {cards.map((key) => (
            <CardTile
              key={key}
              cardKey={key}
              size="xs"
              showElixir={false}
              overlay={
                snapshot?.evolvable?.includes(key) ? (
                  <span
                    title="Observed played in evolved form in this sample"
                    className="absolute -bottom-1 -right-1 rounded bg-emerald-400 px-1 text-[7px] font-black text-emerald-950 shadow"
                  >
                    EVO
                  </span>
                ) : undefined
              }
            />
          ))}
        </div>

        {analysis && <DeckStats analysis={analysis} />}
      </section>

      {analysis ? (
        <DiagnosisPanel analysis={analysis} meta={snapshot} />
      ) : (
        <section className="panel p-8 text-center text-sm text-muted-foreground">
          Pick a few more cards to unlock the full diagnosis.
        </section>
      )}
    </div>
  )
}
