'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Swords } from 'lucide-react'
import { CardTile } from '@/components/card-tile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getCard } from '@/lib/cards'
import { archetypeLabel, detectArchetype } from '@/lib/archetypes'

// ---------------------------------------------------------------------------
// Wire types (mirrored from /api/battles)
// ---------------------------------------------------------------------------

export interface DiagnosisAxisData {
  key: string
  label: string
  score: number
  detail: string
  source: string
}

export interface DiagnosisFindingData {
  rank: number
  title: string
  detail: string
  severity: 'critical' | 'warning' | 'good' | 'neutral'
}

export interface DiagnosisEvidenceData {
  label: string
  value: string
  source: string
}

export interface SideMetricsData {
  elixirLeaked: number | null
  kingTowerHp: number | null
  princessTowers: number[] | null
  levelDeficit: number | null
  evolutions: number | null
  avgElixir: number
}

export interface BattleDiagnosisData {
  overall: number
  opponentOverall?: number
  axes: DiagnosisAxisData[]
  opponentAxes?: DiagnosisAxisData[]
  findings: DiagnosisFindingData[]
  evidence: DiagnosisEvidenceData[]
  sides?: { you: SideMetricsData; them: SideMetricsData }
  context: {
    ourArchetype: string
    theirArchetype: string
    matchup: number | null
    gameMode: string
    unavailable: string[]
  }
}

export interface BattleSummary {
  id: string
  time: string
  result: 'win' | 'loss' | 'draw'
  crowns: { us: number; them: number }
  deck: string[]
  opponentDeck: string[]
  opponentName: string
  opponentTag?: string
  arena?: string
  type?: string
  diagnosis?: BattleDiagnosisData
}

// ---------------------------------------------------------------------------
// Wire types (mirrored from /api/predict)
// ---------------------------------------------------------------------------

export interface PredictionModelData {
  decidedBattles: number
  wins: number
  losses: number
  folds: number
  accuracy: number
  baselineAccuracy: number
  trainAccuracy: number
  logLoss: number
  baselineLogLoss: number
  auc: number
}

export interface PredictionContributionData {
  feature: { key: string; label: string }
  points: number
  value: number
  text: string
}

export type PredictionData =
  | {
      status: 'ok'
      model: PredictionModelData
      probability: number
      baseline: number
      contributions: PredictionContributionData[]
    }
  | { status: 'no-signal'; reason: string; model: PredictionModelData }
  | { status: 'too-small'; reason: string; available: number }
  | { status: 'unavailable'; reason: string }

// ---------------------------------------------------------------------------
// Pre-match prediction
// ---------------------------------------------------------------------------

type PredictionState = { key: string; data: PredictionData | null }

function ModelCard({ model }: { model: PredictionModelData }) {
  return (
    <p className="mt-4 rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      Model card — trained on {model.decidedBattles} decided battles ({model.wins}W–
      {model.losses}L), {model.folds}-fold cross-validated accuracy {model.accuracy}% against a{' '}
      {model.baselineAccuracy}% win-rate baseline, AUC {model.auc.toFixed(3)}, log loss{' '}
      {model.logLoss} vs {model.baselineLogLoss} baseline, {model.trainAccuracy}% on the rows it
      was fitted on. Deck construction only: no trophy count, card levels or player skill.
    </p>
  )
}

function PredictionPanel({ deck, opponentDeck }: { deck: string[]; opponentDeck: string[] }) {
  const deckKey = deck.join(',')
  const vsKey = opponentDeck.join(',')
  const requestKey = `${deckKey}|${vsKey}`
  const invalid = deck.length < 4 || opponentDeck.length < 4
  const [result, setResult] = useState<PredictionState | null>(null)

  useEffect(() => {
    if (deckKey.split(',').length < 4 || vsKey.split(',').length < 4) return
    let cancelled = false
    const key = `${deckKey}|${vsKey}`
    const query = new URLSearchParams({ deck: deckKey, vs: vsKey })
    fetch(`/api/predict?${query.toString()}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('failed'))))
      .then((data: PredictionData) => {
        if (!cancelled) setResult({ key, data })
      })
      .catch(() => {
        if (!cancelled) setResult({ key, data: null })
      })
    return () => {
      cancelled = true
    }
  }, [deckKey, vsKey])

  // No result for the decks currently on screen yet - the effect that fetches
  // them runs immediately after this render, so this is the loading state.
  const settled = !invalid && result?.key === requestKey ? result : null
  const prediction = settled && settled.data ? settled.data : null
  const failed = Boolean(settled && settled.data === null)

  return (
    <section className="panel p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="panel-title">Pre-match prediction</h3>
        <p className="text-[10px] uppercase tracking-wide text-cyan-300/70">
          Gradient-boosted trees + exact SHAP
        </p>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Estimated from the two decks alone, as they would have looked before the match. The model
        cannot see card levels, elixir leaks or how the game was actually played.
      </p>

      {invalid ? (
        <p className="text-sm text-muted-foreground">
          Both decks need at least four known cards before anything can be predicted.
        </p>
      ) : failed ? (
        <p className="text-sm text-muted-foreground">
          The prediction service did not respond. The matchup scores below still come from the
          rules engine.
        </p>
      ) : !prediction ? (
        <div className="space-y-3" aria-busy="true">
          <div className="h-10 animate-pulse rounded-lg bg-white/[0.03]" />
          <div className="h-16 animate-pulse rounded-lg bg-white/[0.03]" />
        </div>
      ) : prediction.status === 'ok' ? (
        <>
          <div className="flex items-end gap-3">
            <p className="text-4xl font-black tabular-nums text-cyan-300">
              {prediction.probability}%
            </p>
            <p className="pb-1.5 text-xs text-muted-foreground">predicted chance to win</p>
          </div>
          <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
              style={{ width: `${Math.max(2, Math.min(100, prediction.probability))}%` }}
            />
            <div
              className="absolute inset-y-0 w-px bg-white/70"
              style={{ left: `${prediction.baseline}%` }}
              title="Model baseline"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            White marker: {prediction.baseline}% baseline — what the model says before it sees this
            matchup. Difference is driven by the cards below.
          </p>

          <h4 className="mb-2 mt-5 section-title">
            What moved it
          </h4>
          <ul className="space-y-1.5">
            {prediction.contributions
              .filter((entry) => Math.abs(entry.points) >= 0.5)
              .slice(0, 5)
              .map((entry) => (
                <li
                  key={entry.feature.key}
                  className="rounded-lg border border-border bg-white/[0.03] px-3 py-2"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-medium">{entry.feature.label}</span>
                    <span
                      className={`shrink-0 text-xs font-bold tabular-nums ${
                        entry.points > 0
                          ? 'text-emerald-300'
                          : entry.points < 0
                            ? 'text-rose-300'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {entry.points > 0 ? '+' : ''}
                      {entry.points} pts
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{entry.text}</p>
                </li>
              ))}
            {prediction.contributions.every((entry) => Math.abs(entry.points) < 0.5) && (
              <li className="text-xs text-muted-foreground">
                Nothing in this matchup moved the probability by half a point — the decks are close
                to the model baseline.
              </li>
            )}
          </ul>
          <ModelCard model={prediction.model} />
        </>
      ) : prediction.status === 'no-signal' ? (
        <>
          <p className="text-sm font-semibold text-amber-300">No usable signal yet</p>
          <p className="mt-1 text-xs text-muted-foreground">{prediction.reason}</p>
          <ModelCard model={prediction.model} />
        </>
      ) : prediction.status === 'too-small' ? (
        <>
          <p className="text-sm font-semibold text-amber-300">Sample too small</p>
          <p className="mt-1 text-xs text-muted-foreground">{prediction.reason}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{prediction.reason}</p>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

export function averageElixir(deck: string[]): number {
  if (!deck.length) return 0
  const total = deck.reduce((sum, key) => sum + (getCard(key)?.elixir ?? 0), 0)
  return Math.round((total / deck.length) * 10) / 10
}

const axisTone = (score: number) =>
  score < 4 ? 'bg-rose-400' : score < 6.5 ? 'bg-amber-400' : 'bg-emerald-400'

const SEVERITY_TEXT: Record<DiagnosisFindingData['severity'], string> = {
  critical: 'text-rose-300',
  warning: 'text-amber-300',
  good: 'text-emerald-300',
  neutral: 'text-muted-foreground',
}

/** `RankedLadder` / `pathOfLegend` / `2v2` -> something a human can read. */
function modeLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()
}

export function DeckStrip({
  cards,
  label,
  size = 'xxs',
}: {
  cards: string[]
  label?: string
  size?: 'xxs' | 'xs'
}) {
  if (!cards.length) return null
  return (
    <span className="flex items-start gap-2">
      {label && (
        <span className="w-14 shrink-0 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      )}
      <span className="flex flex-wrap gap-1">
        {cards.map((key, index) => (
          <CardTile
            key={`${key}-${index}`}
            cardKey={key}
            size={size}
            showElixir={false}
          />
        ))}
      </span>
    </span>
  )
}

function Metric({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">
        {value === null || Number.isNaN(value) ? (
          <span className="font-normal text-muted-foreground" title="Not reported by the Clash Royale API">
            —
          </span>
        ) : (
          <>
            {value}
            {suffix ? <span className="font-normal text-muted-foreground">{suffix}</span> : null}
          </>
        )}
      </dd>
    </div>
  )
}

/** Works before the diagnosis lands, so the versus screen is never blank. */
const archetypeFor = (deck: string[]): string =>
  deck.length ? archetypeLabel(detectArchetype(deck).archetype.key) : '—'

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  if (score === null) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-7 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="flex-1 text-[11px] text-muted-foreground">not measured</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
        <span
          className={`block h-full rounded-full ${axisTone(score)}`}
          style={{ width: `${score * 10}%` }}
        />
      </span>
      <span className="w-7 shrink-0 text-right text-[11px] font-bold tabular-nums">{score}</span>
    </div>
  )
}

function SidePanel({
  seat,
  name,
  archetype,
  deck,
  metrics,
}: {
  seat: string
  name: string
  archetype: string
  deck: string[]
  metrics: SideMetricsData | undefined
}) {
  return (
    <div className="rounded-xl border border-border bg-white/[0.03] p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {seat}
          </p>
          <p className="truncate text-sm font-semibold">{name}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {archetype}
        </Badge>
      </div>
      <DeckStrip cards={deck} size="xs" />
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs">
        <Metric label="Avg elixir" value={metrics?.avgElixir ?? averageElixir(deck)} />
        <Metric label="Elixir leaked" value={metrics?.elixirLeaked ?? null} />
        <Metric label="Levels below max" value={metrics?.levelDeficit ?? null} />
        <Metric label="Evolutions" value={metrics?.evolutions ?? null} />
      </dl>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail page body
// ---------------------------------------------------------------------------

interface BattleDetailProps {
  battle: BattleSummary | null
  /** `loading` = the diagnosis fetch for this tag has not resolved yet. */
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Leaves the route - the caller owns navigation so it can animate first. */
  onBack: () => void
}

export function BattleDetail({ battle, status, onBack }: BattleDetailProps) {
  const diagnosis = battle?.diagnosis
  // Skeletons only while the fetch is genuinely in flight; once it has resolved
  // without this battle, say so instead of spinning forever.
  const pending = !diagnosis && (status === 'idle' || status === 'loading')
  const unavailableNote =
    status === 'error'
      ? 'Diagnosis could not be loaded for this player.'
      : 'This battle has no stored diagnosis — it was saved without a raw payload, so there is nothing to score.'
  const when = battle
    ? new Date(battle.time).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  if (!battle) return null

  return (
    <div className="@container overflow-x-hidden">
      {/* Sticky below the site header (h-16, z-50) so the opponent and the back
          control stay reachable while the analysis scrolls - on a page the
          header no longer scrolls away with a close button pinned to it. */}
      <header className="sticky top-16 z-10 flex items-start gap-3 border-b border-border bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 shrink-0 gap-1.5"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">
            Battle intelligence
          </p>
          <h1 className="truncate text-xl font-semibold tracking-tight">
            vs {battle.opponentName}
          </h1>
          <p className="text-xs text-muted-foreground">
            {diagnosis
              ? `${diagnosis.context.ourArchetype} vs ${diagnosis.context.theirArchetype}`
              : pending
                ? 'Loading diagnosis…'
                : 'Diagnosis unavailable'}
            {' · '}
            {when}
          </p>
        </div>
      </header>

      <div className="space-y-5 px-4 pb-6">
        {status === 'error' && !diagnosis && (
          <p className="text-sm text-rose-300">
            Stored battles are unavailable for this player yet. Sync the profile once and
            try again.
          </p>
        )}

        {/* A - summary ------------------------------------------------ */}
        <section className="panel p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/80">
                Battle summary
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {diagnosis
                  ? `${diagnosis.context.ourArchetype} into ${diagnosis.context.theirArchetype}`
                  : pending
                    ? 'Waiting for the diagnosis engine'
                    : status === 'error'
                      ? 'Diagnosis unavailable'
                      : 'No stored diagnosis for this battle'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`grid size-10 place-items-center rounded-lg text-sm font-bold ${
                  battle.result === 'win'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : battle.result === 'loss'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-white/10 text-muted-foreground'
                }`}
              >
                {battle.crowns.us}–{battle.crowns.them}
              </span>
              {diagnosis && (
                <div className="text-right">
                  <p className="text-2xl font-bold tabular-nums">
                    {diagnosis.overall}
                    <span className="text-sm font-normal text-muted-foreground">/10</span>
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    deck score
                  </p>
                </div>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2 @xl:grid-cols-4">
            <div className="rounded-lg border border-border bg-white/[0.03] px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Result
              </dt>
              <dd className="text-sm font-semibold uppercase">{battle.result}</dd>
            </div>
            <div className="rounded-lg border border-border bg-white/[0.03] px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Crowns
              </dt>
              <dd className="text-sm font-semibold tabular-nums">
                {battle.crowns.us}–{battle.crowns.them}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-white/[0.03] px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Arena
              </dt>
              <dd className="truncate text-sm font-semibold">
                {battle.arena ? modeLabel(battle.arena) : '—'}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-white/[0.03] px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Mode
              </dt>
              <dd className="truncate text-sm font-semibold">
                {diagnosis
                  ? modeLabel(diagnosis.context.gameMode)
                  : battle.type
                    ? modeLabel(battle.type)
                    : '—'}
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            The Clash Royale battle log reports neither trophy change nor match duration,
            so neither is shown. Every number in this drawer is a field the API returned
            for this battle — no move-by-move timeline is invented. The scores below
            describe how the two decks were built, not how the match was played.
          </p>
        </section>

        {/* B - deck vs deck ------------------------------------------- */}
        <section className="panel p-5">
          <h3 className="mb-1 panel-title">
            Deck vs deck
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Both lists exactly as they were played, with the per-side numbers each payload
            carries.
          </p>
          {/* Container queries: the drawer is at most 56rem wide no matter
              how wide the viewport is, so viewport breakpoints would fire
              a three-column layout into a panel that cannot hold it. */}
          <div className="grid gap-3 @3xl:grid-cols-[1fr_auto_1fr]">
            <SidePanel
              seat="You"
              name="Your deck"
              archetype={diagnosis?.context.ourArchetype ?? archetypeFor(battle.deck)}
              deck={battle.deck}
              metrics={diagnosis?.sides?.you}
            />
            <div className="hidden items-center justify-center @3xl:flex">
              <span className="grid size-9 place-items-center rounded-full border border-border bg-white/[0.03] text-muted-foreground">
                <Swords className="size-4" />
              </span>
            </div>
            <SidePanel
              seat="Opponent"
              name={battle.opponentName}
              archetype={diagnosis?.context.theirArchetype ?? archetypeFor(battle.opponentDeck)}
              deck={battle.opponentDeck}
              metrics={diagnosis?.sides?.them}
            />
          </div>
        </section>

        <PredictionPanel deck={battle.deck} opponentDeck={battle.opponentDeck} />

        {/* C - matchup analysis --------------------------------------- */}
        <section className="panel p-5">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="panel-title">
              Matchup analysis
            </h3>
            {diagnosis && (
              <p className="text-xs tabular-nums text-muted-foreground">
                <span className="font-bold text-foreground">{diagnosis.overall}</span> you
                <span className="px-2">vs</span>
                <span className="font-bold text-foreground">
                  {diagnosis.opponentOverall ?? '—'}
                </span>
                opponent
              </p>
            )}
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Every axis is scored twice from the same two decks: once from your seat, once
            from theirs.
          </p>

          {!diagnosis ? (
            pending ? (
              <div className="space-y-3" aria-busy="true">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="h-10 animate-pulse rounded-lg bg-white/[0.03]" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{unavailableNote}</p>
            )
          ) : (
            <ul className="space-y-4">
              {diagnosis.axes.map((axis) => {
                const theirs = diagnosis.opponentAxes?.find(
                  (entry) => entry.key === axis.key,
                )
                return (
                  <li key={axis.key}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{axis.label}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        <span className="font-bold text-foreground">{axis.score}</span> vs{' '}
                        {theirs ? theirs.score : '—'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <ScoreBar label="You" score={axis.score} />
                      <ScoreBar label="Opp" score={theirs?.score ?? null} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">{axis.detail}</p>
                  </li>
                )
              })}
            </ul>
          )}

          {diagnosis && diagnosis.context.unavailable.length > 0 && (
            <p className="mt-4 text-[11px] text-muted-foreground">
              Not scored for this battle: {diagnosis.context.unavailable.join(', ')} — the
              raw API payload for it never sent those fields, so there is nothing to measure.
            </p>
          )}
        </section>

        {/* D - diagnosis ---------------------------------------------- */}
        <section className="panel p-5">
          <h3 className="mb-4 panel-title">
            RoyaleIQ diagnosis
          </h3>

          {!diagnosis ? (
            pending ? (
              <div className="space-y-3" aria-busy="true">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="h-14 animate-pulse rounded-lg bg-white/[0.03]" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{unavailableNote}</p>
            )
          ) : (
            <>
              <ol className="space-y-3">
                {diagnosis.findings.map((finding) => (
                  <li
                    key={finding.rank}
                    className="rounded-lg border border-border bg-white/[0.03] p-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 w-6 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                        {String(finding.rank).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-semibold ${SEVERITY_TEXT[finding.severity]}`}
                        >
                          {finding.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {finding.detail}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>

              <h4 className="mb-2 mt-6 panel-title">
                Evidence
              </h4>
              <p className="mb-3 text-xs text-muted-foreground">
                Every line below is computed from fields the Clash Royale API returned for
                this battle - the source is shown next to each value.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {diagnosis.evidence.map((item) => (
                  <li
                    key={item.label + item.value}
                    className="rounded-lg border border-border bg-white/[0.03] px-3 py-2"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="section-title">
                        {item.label}
                      </span>
                      <code className="text-[10px] text-emerald-300/70">{item.source}</code>
                    </div>
                    <p className="mt-0.5 text-sm">{item.value}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
