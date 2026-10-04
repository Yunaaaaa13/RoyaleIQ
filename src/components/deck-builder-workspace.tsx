'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FlaskConical, Save, X } from 'lucide-react'
import { CardTile } from '@/components/card-tile'
import { DeckSelection, useDeckParams } from '@/components/deck-selection'
import { Button } from '@/components/ui/button'
import { deckLabel } from '@/lib/battle'
import { deckId, removeSavedDeck, saveDeck, useSavedDecks } from '@/lib/saved-decks'
import { relativeAge } from '@/lib/utils'

/**
 * Deck Builder: the create/edit side of the deck domain. Selection is the
 * whole job here — handing the deck to Deck Analytics only happens when the
 * user presses "Analyze this deck".
 */
export function DeckBuilderWorkspace() {
  const { deck, setDeck } = useDeckParams()
  const saved = useSavedDecks()
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  const ready = deck.length >= 4
  const id = deck.length ? deckId(deck) : ''
  const isSaved = Boolean(id) && saved.some((entry) => entry.id === id)

  function analyze() {
    if (!ready) return
    router.push(`/deck-lab?deck=${encodeURIComponent(deck.join(','))}`)
  }

  function save() {
    if (!ready) return
    saveDeck({ label: deckLabel(deck), cards: deck })
    setNotice('Saved to your decks below.')
    window.setTimeout(() => setNotice(null), 2400)
  }

  return (
    <div className="space-y-6">
      <DeckSelection
        deck={deck}
        setDeck={setDeck}
        actions={
          <>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={analyze}
              disabled={!ready}
              title={ready ? undefined : 'Pick at least 4 cards first'}
            >
              <FlaskConical className="size-3.5" />
              Analyze this deck
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={save}
              disabled={!ready}
            >
              <Save className="size-3.5" />
              {isSaved ? 'Re-save' : 'Save deck'}
            </Button>
          </>
        }
      />

      <p role="status" className="text-xs text-primary">
        {notice}
      </p>

      {saved.length > 0 && (
        <section className="panel p-4 sm:p-5">
          <div className="panel-head">
            <div>
              <h3 className="panel-title">Saved decks</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Stored in this browser. Open one for its full diagnosis, or send it
                straight to analysis.
              </p>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {saved.length}
            </span>
          </div>
          <ul className="space-y-2">
            {saved.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-white/[0.03] p-3"
              >
                <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {entry.cards.map((key) => (
                    <CardTile
                      key={`${entry.id}-${key}`}
                      cardKey={key}
                      size="xxs"
                      showElixir={false}
                    />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {entry.label}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {entry.cards.length} cards · saved {relativeAge(entry.savedAt)}
                  </span>
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                  <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
                    <Link href={`/decks/${encodeURIComponent(entry.id)}`}>Open</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
                    <Link
                      href={`/deck-lab?deck=${encodeURIComponent(entry.cards.join(','))}`}
                    >
                      Analyze
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    aria-label={`Remove ${entry.label}`}
                    onClick={() => removeSavedDeck(entry.id)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
