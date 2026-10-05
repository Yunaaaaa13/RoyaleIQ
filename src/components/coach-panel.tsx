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
import { cn } from '@/lib/utils'
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
      <section className="panel p-5" id="coach">
        <div className="panel-head">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <Bot className="size-4" />
            </span>
            <div>
              <p className="eyebrow">AI insight</p>
              <h3 className="panel-title">Deck coach</h3>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {result?.provider === 'llm'
              ? 'LLM reasoning'
              : result?.provider === 'rules'
                ? 'Rule engine'
                : 'Ready'}
          </Badge>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-slate-100 px-3 py-2">
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
          <div className="mt-4 rounded-xl border border-border/70 bg-slate-100 p-3">
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
          <Alert className="mt-4 border-rose-500/30 bg-rose-500/10">
            <AlertTitle>Could not run</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </section>

      {result && (
        <>
          <div className="panel flex flex-wrap items-center gap-2 px-4 py-3 text-[11px] text-muted-foreground">
            <Badge
              variant="outline"
              className={
                result.grounding?.record ? 'border-emerald-500/40 text-emerald-600' : ''
              }
            >
              {result.grounding?.record
                ? `Grounded on ${result.grounding.record.battles} stored battles`
                : 'Deck structure only'}
            </Badge>
            {result.grounding?.metaBattles ? (
              <Badge variant="outline">Meta from {result.grounding.metaBattles} battles</Badge>
            ) : null}
            {/* The server's note is only worth a line when there is no record:
                with one, the badge above already says so, and the note is the
                call to action that gets the user to add their tag. */}
            {!result.grounding?.record && result.grounding?.note ? (
              <span className="min-w-0 flex-1">{result.grounding.note}</span>
            ) : null}
          </div>

          {!result.llmConfigured && (
            <Alert className="border-amber-500/30 bg-amber-500/10">
              <AlertTitle>Running on the local rule engine</AlertTitle>
              <AlertDescription>
                Set <code className="font-mono">OPENAI_API_KEY</code> in{' '}
                <code className="font-mono">.env.local</code> to get free-form LLM
                reasoning. The rule engine is deterministic and always available.
              </AlertDescription>
            </Alert>
          )}

          <section className="panel p-5">
            <div className="panel-head">
              <div className="flex items-center gap-2">
                <MessageSquareQuote className="size-4 text-primary" />
                <h3 className="panel-title">Verdict</h3>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {result.provider === 'llm' ? 'LLM reasoning' : 'Rule engine'}
              </span>
            </div>
            <div className="rounded-r-xl border-l-2 border-primary bg-primary/[0.06] py-3 pl-4 pr-3">
              <p className="text-sm leading-relaxed text-balance">{result.coach.summary}</p>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="section-title mb-2">Diagnosis</h4>
                <ul className="space-y-2">
                  {result.coach.diagnosis.map((entry) => (
                    <li
                      key={entry.title}
                      className={cn(
                        'flex gap-2.5 rounded-lg border border-border/70 border-l-2 bg-slate-50 p-3',
                        entry.severity === 'good'
                          ? 'border-l-emerald-400'
                          : entry.severity === 'critical'
                            ? 'border-l-rose-400'
                            : 'border-l-amber-400',
                      )}
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
                    <h4 className="section-title mb-2">Suggested change</h4>
                    <ul className="space-y-2">
                      {result.coach.changes.map((change) => (
                        <li
                          key={`${change.from}-${change.to}`}
                          className="flex items-center gap-3 rounded-lg border border-border/70 bg-slate-50 p-3"
                        >
                          <span className="rounded-md bg-slate-50 px-2 py-1 text-sm font-semibold">
                            {change.from}
                          </span>
                          <span className="text-primary">→</span>
                          <span className="rounded-md bg-primary/15 px-2 py-1 text-sm font-semibold text-primary">
                            {change.to}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h4 className="section-title mb-2">In-match tips</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {result.coach.tips.map((tip) => (
                      <li key={tip} className="flex gap-2.5">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
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
              <div className="panel-head">
                <div>
                  <h3 className="panel-title">Head to head vs opponent deck</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Projected from both eight-card lists, not from played games.
                  </p>
                </div>
              </div>
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
                  <div key={label as string} className="kpi">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {label as string}
                    </p>
                    <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">
                      {value as number}%
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${value as number}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="section-title mb-1.5">Main threats</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {result.headToHead.threats.map((threat) => (
                      <li key={threat}>
                        <Badge variant="outline" className="border-rose-400/40 text-rose-600">
                          {threat}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="section-title mb-1.5">Game plan</p>
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
