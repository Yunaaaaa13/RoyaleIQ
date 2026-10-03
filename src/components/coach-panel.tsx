'use client'

import { useState } from 'react'
import { Bot, ChevronDown, Loader2, MessageSquareQuote, Sparkles, UserRound } from 'lucide-react'
import { CardPicker } from '@/components/card-picker'
import { CardTile } from '@/components/card-tile'
import { SeverityIcon } from '@/components/metrics'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CoachResponse } from '@/lib/coach'
import type { DeckAnalysis, MatchupResult } from '@/lib/analysis'

interface CoachResult {
  provider: 'llm' | 'rules'
  llmConfigured: boolean
  analysis: DeckAnalysis
  coach: CoachResponse
  headToHead?: MatchupResult
  grounding?: {
    record: { tag: string; name: string; battles: number; winRate: number } | null
    metaBattles: number | null
    metaGeneratedAt: string | null
    note: string
  }
  error?: string
}

export function CoachPanel({
  deck,
  opponentDeck,
  setOpponentDeck,
  tag,
  setTag,
}: {
  deck: string[]
  opponentDeck: string[]
  setOpponentDeck: (cards: string[]) => void
  tag: string
  setTag: (value: string) => void
}) {
  const [question, setQuestion] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CoachResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (deck.length < 4) {
      setError('Pick at least 4 cards first so the coach has something to read.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: deck, question, matchup: opponentDeck, tag }),
      })
      const payload = (await response.json()) as CoachResult
      if (!response.ok) {
        setError(payload.error ?? 'The coach could not run.')
        return
      }
      setResult(payload)
    } catch {
      setError('Network error while contacting the coach.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
            <Bot className="size-4 text-violet-300" />
            AI Deck Coach
          </h3>
          <Badge variant="secondary" className="text-[10px]">
            {result?.provider === 'llm'
              ? 'LLM reasoning'
              : result?.provider === 'rules'
                ? 'Rule engine'
                : 'Ready'}
          </Badge>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            placeholder="#PLAYERTAG (optional)"
            aria-label="Your player tag"
            className="h-7 w-44 border-0 bg-transparent px-0 font-mono text-xs uppercase shadow-none focus-visible:ring-0"
          />
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
            {tag.trim()
              ? 'The coach will quote your own win rates and matchups.'
              : 'Add your tag so the coach answers from your real results instead of general advice.'}
          </p>
        </div>

        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="e.g. I play X-Bow but always lose to Golem — what am I doing wrong?"
          className="min-h-24 resize-y"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={run}
            disabled={loading || deck.length < 4}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {loading ? 'Analyzing…' : 'Explain my deck'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPicker((value) => !value)}
            className="gap-1.5"
          >
            <ChevronDown className="size-4" />
            {opponentDeck.length ? `Opponent: ${opponentDeck.length}/8` : 'Add opponent deck'}
          </Button>
        </div>

        {showPicker && (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Opponent deck (optional, for matchup advice)
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpponentDeck([])}
                disabled={!opponentDeck.length}
              >
                Clear
              </Button>
            </div>
            <CardPicker
              selected={opponentDeck}
              max={8}
              onToggle={(key) =>
                setOpponentDeck(
                  opponentDeck.includes(key)
                    ? opponentDeck.filter((entry) => entry !== key)
                    : [...opponentDeck, key].slice(0, 8),
                )
              }
            />
          </div>
        )}

        {error && (
          <Alert className="mt-4 border-rose-400/30 bg-rose-400/10">
            <AlertTitle>Could not run</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </section>

      {result && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Badge
              variant="outline"
              className={
                result.grounding?.record ? 'border-emerald-400/40 text-emerald-300' : ''
              }
            >
              {result.grounding?.record
                ? `Grounded on ${result.grounding.record.battles} stored battles`
                : 'Deck structure only'}
            </Badge>
            {result.grounding?.metaBattles ? (
              <Badge variant="outline">Meta from {result.grounding.metaBattles} battles</Badge>
            ) : null}
            {result.grounding?.record ? (
              <span className="min-w-0 flex-1">
                {result.grounding.note}
              </span>
            ) : null}
          </div>

          {!result.llmConfigured && (
            <Alert className="border-yellow-400/30 bg-yellow-400/10">
              <AlertTitle>Running on the local rule engine</AlertTitle>
              <AlertDescription>
                Set <code className="font-mono">OPENAI_API_KEY</code> in{' '}
                <code className="font-mono">.env.local</code> to get free-form LLM
                reasoning. The rule engine is deterministic and always available.
              </AlertDescription>
            </Alert>
          )}

          <section className="panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquareQuote className="size-4 text-yellow-300" />
              <h3 className="text-sm font-semibold uppercase tracking-wide">Verdict</h3>
            </div>
            <p className="text-sm leading-relaxed text-balance">{result.coach.summary}</p>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Diagnosis
                </h4>
                <ul className="space-y-2">
                  {result.coach.diagnosis.map((entry) => (
                    <li
                      key={entry.title}
                      className="flex gap-2.5 rounded-lg border border-white/10 bg-white/5 p-3"
                    >
                      <SeverityIcon severity={entry.severity} />
                      <div>
                        <p className="text-sm font-semibold">{entry.title}</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {entry.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                {result.coach.changes.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Suggested change
                    </h4>
                    <ul className="space-y-2">
                      {result.coach.changes.map((change) => (
                        <li
                          key={`${change.from}-${change.to}`}
                          className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                        >
                          <span className="text-sm font-semibold">{change.from}</span>
                          <span className="text-yellow-300">→</span>
                          <span className="text-sm font-semibold">{change.to}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    In-match tips
                  </h4>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {result.coach.tips.map((tip) => (
                      <li key={tip} className="flex gap-2">
                        <span className="text-yellow-300">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {result.headToHead && (
            <section className="panel p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">
                Head to head vs opponent deck
              </h3>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {opponentDeck.map((key) => (
                  <CardTile key={key} cardKey={key} size="xs" />
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Your offense', result.headToHead.offense],
                  ['Your defense', result.headToHead.defense],
                  ['Cycle edge', result.headToHead.cycle],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-xl bg-white/5 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {label as string}
                    </p>
                    <p className="text-xl font-bold tabular-nums">{value as number}%</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan-400"
                        style={{ width: `${value as number}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Main threats
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {result.headToHead.threats.map((threat) => (
                      <li key={threat}>
                        <Badge variant="outline" className="text-rose-300">
                          {threat}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Game plan
                  </p>
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                    {result.headToHead.strategy.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
