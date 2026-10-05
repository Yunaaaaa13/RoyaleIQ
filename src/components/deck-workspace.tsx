'use client'

import Link from 'next/link'
import { Bot, Check, ClipboardCopy, Eraser, LayoutTemplate, Pencil } from 'lucide-react'
import { DiagnosisPanel, MatchupPanel } from '@/components/deck-panels'
import { RecommendationPanel } from '@/components/recommendation-panel'
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
import { useMetaSnapshot } from '@/lib/use-meta'

/**
 * Deck Analytics: the analysis side of the deck domain. Editing lives in the
 * Deck Builder, the coach in /ai-coach — this route reads a deck from the URL
 * and scores it, projects its matchups, and ranks the meta decks that fit it.
 */
export function DeckWorkspace() {
  const { deck, setDeck, tag } = useDeckParams()
  const { copied, copy } = useCopyLink()
  const { snapshot, loading: metaLoading, reload } = useMetaSnapshot()
  const analysis = analyzeIfReady(deck)
  const deckParam = encodeURIComponent(deck.join(','))
  const coachHref = `/ai-coach?deck=${deckParam}${
    tag.trim() ? `&tag=${encodeURIComponent(tag.trim())}` : ''
  }`

  if (!analysis) {
    const chosen = deck.length
    return (
      <section className="panel flex flex-col items-center gap-3 p-10 text-center">
        <span className="text-3xl">🏰</span>
        <h2 className="text-lg font-semibold">
          {chosen === 0
            ? 'Build a deck to start analysis'
            : `Incomplete deck — ${chosen}/4 cards selected`}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {chosen === 0
            ? 'Select at least 4 cards. RoyaleIQ will analyse your deck structure, compare it with current meta patterns, and recommend compatible decks.'
            : `Pick ${4 - chosen} more card(s) to unlock the diagnosis, matchups and meta recommendations.`}
        </p>
        {chosen > 0 && (
          <div className="w-full max-w-lg">
            <DeckSlots deck={deck} evolvable={snapshot?.evolvable} />
          </div>
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button asChild className="gap-2">
            <Link href="/deck-builder">
              <Pencil className="size-4" />
              Open Deck Builder
            </Link>
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setDeck(SAMPLE)}>
            <LayoutTemplate className="size-4" />
            Try Example
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

        <DeckSlots deck={deck} evolvable={snapshot?.evolvable} />
        <DeckStats analysis={analysis} />
      </section>

      <Tabs defaultValue="diagnosis" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
          <TabsTrigger value="matchups">Matchups</TabsTrigger>
          <TabsTrigger value="meta">Meta Decks</TabsTrigger>
        </TabsList>
        <TabsContent value="diagnosis">
          <DiagnosisPanel analysis={analysis} meta={snapshot} />
        </TabsContent>
        <TabsContent value="matchups">
          <MatchupPanel analysis={analysis} />
        </TabsContent>
        <TabsContent value="meta">
          <RecommendationPanel
            selected={deck}
            meta={snapshot}
            loading={metaLoading}
            onReload={reload}
            onUse={setDeck}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
