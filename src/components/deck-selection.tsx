'use client'

import { useEffect, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, ClipboardCopy, Eraser, LayoutTemplate, X } from 'lucide-react'
import { CardPicker } from '@/components/card-picker'
import { CardTile } from '@/components/card-tile'
import { ScoreBar, StatTile } from '@/components/metrics'
import { Button } from '@/components/ui/button'
import { analyzeDeck, type DeckAnalysis } from '@/lib/analysis'
import { getCard } from '@/lib/cards'

export const SAMPLE = [
  'x-bow',
  'tesla',
  'archers',
  'knight',
  'fireball',
  'the-log',
  'skeletons',
  'ice-spirit',
]

export function parseDeck(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((key) => Boolean(getCard(key)))
    .slice(0, 8)
}

/** Analysis is only meaningful from four cards up; everything else is null. */
export function analyzeIfReady(deck: string[]): DeckAnalysis | null {
  return deck.length >= 4 ? analyzeDeck(deck) : null
}

/**
 * Deck + player-tag state that lives in the URL, so a selection can be shared
 * and so the Deck Lab, Deck Builder and AI Coach views agree on one source.
 */
export function useDeckParams() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [deck, setDeck] = useState<string[]>(() => parseDeck(searchParams.get('deck')))
  const [tag, setTag] = useState(() => searchParams.get('tag') ?? '')

  useEffect(() => {
    const params = new URLSearchParams()
    const next = deck.join(',')
    const cleanTag = tag.trim()
    if (next) params.set('deck', next)
    if (cleanTag) params.set('tag', cleanTag)
    const desired = params.toString()
    if (desired === searchParams.toString()) return
    router.replace(desired ? `${pathname}?${desired}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, tag])

  return { deck, setDeck, tag, setTag }
}

/** The eight slots; `onRemove` makes them interactive (builder views). */
export function DeckSlots({
  deck,
  onRemove,
}: {
  deck: string[]
  onRemove?: (key: string) => void
}) {
  const slots = Array.from({ length: 8 }, (_unused, index) => deck[index])
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {slots.map((key, index) => (
        <div
          key={`${key ?? 'empty'}-${index}`}
          className={`group relative grid aspect-[3/4] place-items-center rounded-xl border border-dashed ${
            key ? 'border-solid border-white/15 bg-white/[0.03]' : 'border-white/15'
          }`}
        >
          {key ? (
            <>
              <CardTile cardKey={key} size="md" showElixir={false} />
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(key)}
                  aria-label={`Remove ${getCard(key)?.name}`}
                  className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-white/20 bg-rose-500/90 text-white opacity-0 transition hover:scale-110 focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-100"
                >
                  <X className="size-3" />
                </button>
              )}
            </>
          ) : (
            <span className="text-2xl text-white/15">{index + 1}</span>
          )}
        </div>
      ))}
    </div>
  )
}

/** The four headline numbers shown under a ready deck. */
export function DeckStats({ analysis }: { analysis: DeckAnalysis }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile label="Average elixir" value={analysis.avgElixir} accent="cyan" />
      <StatTile
        label="Archetype"
        value={analysis.archetypeLabel}
        sub={`${Math.round(analysis.archetypeConfidence * 100)}% confidence`}
      />
      <div className="rounded-xl border border-border bg-white/[0.03] p-3">
        <ScoreBar label="Overall" value={analysis.scores.overall} tone="gold" />
      </div>
      <div className="rounded-xl border border-border bg-white/[0.03] p-3">
        <ScoreBar label="Air defense" value={analysis.scores.airDefense} tone="cyan" />
      </div>
    </div>
  )
}

/** Copies the current URL (which the `useDeckParams` sync keeps shareable). */
export function useCopyLink() {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return { copied, copy }
}

/**
 * The shared editing surface: eight slots with the quick actions, the headline
 * stats, and the card pool. `actions` injects page-specific buttons (Analyze,
 * Save) into the header row; `children` renders below the pool (the coach).
 */
export function DeckSelection({
  deck,
  setDeck,
  actions,
  children,
}: {
  deck: string[]
  setDeck: Dispatch<SetStateAction<string[]>>
  actions?: ReactNode
  children?: ReactNode
}) {
  const { copied, copy } = useCopyLink()
  const analysis = analyzeIfReady(deck)

  return (
    <>
      <section className="panel p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="panel-title">Your deck</h2>
            <p className="text-xs text-muted-foreground">{deck.length}/8 cards selected</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setDeck(SAMPLE)}
            >
              <LayoutTemplate className="size-3.5" />
              Load sample
            </Button>
            {actions}
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
              disabled={!deck.length}
            >
              <Eraser className="size-3.5" />
              Clear
            </Button>
          </div>
        </div>

        <DeckSlots
          deck={deck}
          onRemove={(key) =>
            setDeck((current) => current.filter((entry) => entry !== key))
          }
        />

        {analysis && <DeckStats analysis={analysis} />}
      </section>

      <section id="workspace" className="panel p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="panel-title">Card pool</h2>
          <span className="text-xs text-muted-foreground">
            Click a card to add or remove it
          </span>
        </div>
        <CardPicker
          selected={deck}
          max={8}
          onToggle={(key) =>
            setDeck((current) =>
              current.includes(key)
                ? current.filter((entry) => entry !== key)
                : [...current, key].slice(0, 8),
            )
          }
        />
      </section>

      {children}
    </>
  )
}
