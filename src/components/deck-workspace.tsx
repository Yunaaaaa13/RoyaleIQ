'use client'

import Link from 'next/link'
import { Bot, Check, ClipboardCopy, Eraser, LayoutTemplate, Pencil } from 'lucide-react'
import { DiagnosisPanel, MatchupPanel } from '@/components/deck-panels'
import {
  DeckSlots,
  DeckStats,
  SAMPLE,
  analyzeIfReady,
  useCopyLink,
  useDeckParams,
} from '@/components/deck-selection'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/**
 * Deck Analytics: the analysis side of the deck domain. Editing lives in the
 * Deck Builder, the coach in /ai-coach — this route reads a deck from the URL
 * (or builds one from the sample) and only ever scores it.
 */
export function DeckWorkspace() {
  const { deck, setDeck, tag } = useDeckParams()
  const { copied, copy } = useCopyLink()
  const analysis = analyzeIfReady(deck)
  const deckParam = encodeURIComponent(deck.join(','))
  const coachHref = `/ai-coach?deck=${deckParam}${
    tag.trim() ? `&tag=${encodeURIComponent(tag.trim())}` : ''
  }`

  if (!analysis) {
    return (
      <section className="panel flex flex-col items-center gap-3 p-10 text-center">
        <span className="text-3xl">🏰</span>
        <h2 className="text-lg font-semibold">Nothing analysed yet</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Assemble a deck in the Deck Builder and send it here with one click — or
          load the sample to see a full diagnosis, matchup read and scored swaps.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild className="gap-2">
            <Link href="/deck-builder">
              <Pencil className="size-4" />
              Open Deck Builder
            </Link>
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setDeck(SAMPLE)}>
            <LayoutTemplate className="size-4" />
            Load the X-Bow sample
          </Button>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="panel p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="panel-title">Analysed deck</h2>
            <p className="text-xs text-muted-foreground">
              {deck.length}/8 cards · {analysis.archetypeLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
              <Link href={coachHref}>
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
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={copy}
              disabled={!deck.length}
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <ClipboardCopy className="size-3.5" />
              )}
              {copied ? 'Copied' : 'Share link'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setDeck([])}
            >
              <Eraser className="size-3.5" />
              Clear
            </Button>
          </div>
        </div>

        <DeckSlots deck={deck} />
        <DeckStats analysis={analysis} />
      </section>

      <Tabs defaultValue="diagnosis" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
          <TabsTrigger value="matchups">Matchups</TabsTrigger>
        </TabsList>
        <TabsContent value="diagnosis">
          <DiagnosisPanel analysis={analysis} />
        </TabsContent>
        <TabsContent value="matchups">
          <MatchupPanel analysis={analysis} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
