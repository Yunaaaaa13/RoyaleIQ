'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, ClipboardCopy, Eraser, LayoutTemplate, X } from 'lucide-react'
import { CardPicker } from '@/components/card-picker'
import { CardTile } from '@/components/card-tile'
import { CoachPanel } from '@/components/coach-panel'
import { DiagnosisPanel, MatchupPanel } from '@/components/deck-panels'
import { ScoreBar, StatTile } from '@/components/metrics'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { analyzeDeck } from '@/lib/analysis'
import { getCard } from '@/lib/cards'
import { subscribeUrlChange } from '@/lib/url-change'

const SAMPLE = [
  'x-bow',
  'tesla',
  'archers',
  'knight',
  'fireball',
  'the-log',
  'skeletons',
  'ice-spirit',
]

function parseDeck(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((key) => Boolean(getCard(key)))
    .slice(0, 8)
}

export function DeckWorkspace() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [deck, setDeck] = useState<string[]>(() => parseDeck(searchParams.get('deck')))
  const [tag, setTag] = useState(() => searchParams.get('tag') ?? '')
  const [opponentDeck, setOpponentDeck] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState('diagnosis')
  const [coachRequested, setCoachRequested] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const deckSize = useRef(deck.length)

  useEffect(() => {
    deckSize.current = deck.length
  })

  // `#coach` deep-links own the tab: the fragment is the only thing saying
  // which panel the visitor came for. With too few cards the pool scrolls into
  // view instead, and the prompt below takes over until the deck is ready.
  useEffect(() => {
    function sync() {
      if (window.location.hash !== '#coach') return
      setCoachRequested(true)
      if (deckSize.current >= 4) return
      const pool = document.getElementById('workspace')
      if (pool) {
        pool.style.scrollMarginTop = '6.5rem'
        pool.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    sync()
    return subscribeUrlChange(sync)
  }, [])

  // A `#coach` request wins until the visitor picks another tab themselves, so
  // the switch is derived (not applied in an effect): once the deck reaches 4
  // cards the coach tab opens on that very render.
  const activeTab = coachRequested && deck.length >= 4 ? 'coach' : tab

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

  const analysis = useMemo(
    () => (deck.length >= 4 ? analyzeDeck(deck) : null),
    [deck],
  )

  function toggle(key: string) {
    setDeck((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key].slice(0, 8),
    )
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const slots = Array.from({ length: 8 }, (_unused, index) => deck[index])

  return (
    <div className="space-y-6">
      <section className="panel p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="panel-title">Your deck</h2>
            <p className="text-xs text-muted-foreground">
              {deck.length}/8 cards selected
            </p>
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
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={copyLink}
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
                  <button
                    type="button"
                    onClick={() => setDeck((current) => current.filter((entry) => entry !== key))}
                    aria-label={`Remove ${getCard(key)?.name}`}
                    className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-white/20 bg-rose-500/90 text-white opacity-0 transition hover:scale-110 focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </>
              ) : (
                <span className="text-2xl text-white/15">{index + 1}</span>
              )}
            </div>
          ))}
        </div>

        {analysis && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Average elixir" value={analysis.avgElixir} accent="cyan" />
            <StatTile label="Archetype" value={analysis.archetypeLabel} sub={`${Math.round(analysis.archetypeConfidence * 100)}% confidence`} />
            <div className="rounded-xl border border-border bg-white/[0.03] p-3">
              <ScoreBar label="Overall" value={analysis.scores.overall} tone="gold" />
            </div>
            <div className="rounded-xl border border-border bg-white/[0.03] p-3">
              <ScoreBar label="Air defense" value={analysis.scores.airDefense} tone="cyan" />
            </div>
          </div>
        )}
      </section>

      <section ref={pickerRef} id="workspace" className="panel p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="panel-title">Card pool</h2>
          <span className="text-xs text-muted-foreground">
            Click a card to add or remove it
          </span>
        </div>
        <CardPicker selected={deck} max={8} onToggle={toggle} />
      </section>

      {analysis ? (
        <Tabs
          value={activeTab}
          onValueChange={(next) => {
            setTab(next)
            setCoachRequested(false)
          }}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
            <TabsTrigger value="matchups">Matchups</TabsTrigger>
            <TabsTrigger value="coach">AI Coach</TabsTrigger>
          </TabsList>
          <TabsContent value="diagnosis">
            <DiagnosisPanel analysis={analysis} />
          </TabsContent>
          <TabsContent value="matchups">
            <MatchupPanel analysis={analysis} />
          </TabsContent>
          <TabsContent value="coach">
            <CoachPanel
              deck={deck}
              opponentDeck={opponentDeck}
              setOpponentDeck={setOpponentDeck}
              tag={tag}
              setTag={setTag}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <section className="panel flex flex-col items-center gap-3 p-10 text-center">
          <span className="text-3xl">🏰</span>
          <h2 className="text-lg font-semibold">
            {coachRequested ? 'The AI coach needs a deck first' : 'Start with your cards'}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {coachRequested
              ? 'Pick at least 4 cards from the pool below — the AI coach opens automatically with a full diagnosis as soon as the deck is ready.'
              : 'Pick at least 4 cards from the pool above. RoyaleIQ will score offense, defence, air defence, cycle and spell utility, then show exactly which cards are holding the deck back.'}
          </p>
          <Button onClick={() => setDeck(SAMPLE)} className="gap-2">
            <LayoutTemplate className="size-4" />
            {coachRequested
              ? 'Load the X-Bow cycle sample'
              : 'Try the X-Bow cycle sample'}
          </Button>
        </section>
      )}
    </div>
  )
}
