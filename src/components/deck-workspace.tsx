'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { Bot, Check, ClipboardCopy, Eraser, LayoutTemplate, Pencil, Sparkles } from 'lucide-react'
import { DiagnosisPanel, MatchupPanel } from '@/components/deck-panels'
import { MetaExplorer } from '@/components/meta-explorer'
import { PersonalMatches } from '@/components/personal-matches'
import {
  DeckSlots,
  DeckStats,
  SAMPLE,
  analyzeIfReady,
  useCopyLink,
  useDeckParams,
} from '@/components/deck-selection'
import { Reveal } from '@/components/reveal'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EASE_OUT } from '@/lib/motion'
import { useMetaSnapshot } from '@/lib/use-meta'

/**
 * Deck Recommendation: the Meta Archetype Explorer is the default view of the
 * current sample; picking 4+ cards adds personalised archetype matches on top,
 * and the same route reads a deck from the URL to diagnose it and project its
 * matchups. Editing lives in the Deck Builder, the coach in /ai-coach.
 */
export function DeckWorkspace() {
  const { deck, setDeck, tag } = useDeckParams()
  const { copied, copy } = useCopyLink()
  const { snapshot, loading: metaLoading, reload } = useMetaSnapshot()
  const [tab, setTab] = useState('diagnosis')
  const analysis = analyzeIfReady(deck)
  const deckParam = encodeURIComponent(deck.join(','))
  const coachHref = `/ai-coach?deck=${deckParam}${
    tag.trim() ? `&tag=${encodeURIComponent(tag.trim())}` : ''
  }`
  const chosen = deck.length

  return (
    <div className="space-y-6">
      {!analysis && (
        <Reveal>
          <section className="panel p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <h2 className="flex items-center gap-2 panel-title">
                  <Sparkles className="size-4 text-primary" />
                  Match decks against your cards
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {chosen === 0
                    ? 'Browse the explorer below first, or select at least 4 cards to rank the observed meta decks against your selection — diagnosis, matchup projections and the AI coach unlock with them.'
                    : `Pick ${4 - chosen} more card${4 - chosen === 1 ? '' : 's'} to unlock personalised matches, diagnosis and matchup projections. The Meta Deck Explorer below stays open either way.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
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
            </div>
            {chosen > 0 && (
              <div className="mt-4 max-w-2xl">
                <DeckSlots deck={deck} evolvable={snapshot?.evolvable} />
              </div>
            )}
          </section>
        </Reveal>
      )}

      {analysis && (
        <>
          <Reveal>
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
                      <Check className="size-3.5 text-emerald-600" />
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
          </Reveal>

          <PersonalMatches selected={deck} meta={snapshot} onUse={setDeck} />

          <Reveal delay={0.05}>
            <Tabs value={tab} onValueChange={setTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
                <TabsTrigger value="matchups">Matchups</TabsTrigger>
              </TabsList>
              <TabsContent value="diagnosis">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                >
                  <DiagnosisPanel analysis={analysis} meta={snapshot} />
                </motion.div>
              </TabsContent>
              <TabsContent value="matchups">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                >
                  <MatchupPanel analysis={analysis} />
                </motion.div>
              </TabsContent>
            </Tabs>
          </Reveal>
        </>
      )}

      <MetaExplorer snapshot={snapshot} loading={metaLoading} onReload={reload} />
    </div>
  )
}
