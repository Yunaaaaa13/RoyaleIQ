'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowRight, Sparkles, Swords, TrendingDown, TrendingUp } from 'lucide-react'
import { CardTile } from '@/components/card-tile'
import { ScoreBar, SeverityIcon, StatTile } from '@/components/metrics'
import { Badge } from '@/components/ui/badge'
import type { DeckAnalysis } from '@/lib/analysis'
import type { MetaSnapshot } from '@/lib/battle'
import { getCard } from '@/lib/cards'
import { deckStructure } from '@/lib/deck-structure'

type Tone = 'gold' | 'violet' | 'cyan' | 'green' | 'rose'

const ROLE_STATE_CLASS: Record<string, string> = {
  ok: 'text-emerald-300',
  gap: 'text-amber-300',
  info: 'text-foreground',
  unavailable: 'text-muted-foreground',
}

export function DiagnosisPanel({
  analysis,
  meta,
}: {
  analysis: DeckAnalysis
  /** Optional meta snapshot: only used for the evolution row and meta fit. */
  meta?: MetaSnapshot | null
}) {
  const grade =
    analysis.scores.overall >= 7.5
      ? 'A'
      : analysis.scores.overall >= 6.5
        ? 'B'
        : analysis.scores.overall >= 5.5
          ? 'C'
          : analysis.scores.overall >= 4.5
            ? 'D'
            : 'F'

  const critical = analysis.findings.filter((f) => f.severity === 'critical').length
  const warnings = analysis.findings.filter((f) => f.severity === 'warning').length
  const positives = analysis.findings.filter((f) => f.severity === 'good').length

  const structure = deckStructure(analysis, { evolvable: meta?.evolvable })
  const strengths = analysis.findings.filter((f) => f.severity === 'good')
  const weaknesses = analysis.findings.filter((f) => f.severity !== 'good')
  const archetypeStat = meta?.archetypes.find((entry) => entry.key === analysis.archetype)
  const checkedRows = structure.rows.filter(
    (row) => row.state === 'ok' || row.state === 'gap',
  ).length
  const coveredRows = structure.rows.filter((row) => row.state === 'ok').length

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel flex items-center gap-4 p-4 lg:col-span-1">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-yellow-300 to-amber-600 text-2xl font-black text-black">
            {grade}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Deck health
            </p>
            <p className="text-2xl font-bold tabular-nums">
              {structure.health}
              <span className="text-base text-muted-foreground">/100</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {analysis.archetypeLabel} · {analysis.avgElixir} avg elixir ·{' '}
              {analysis.scores.overall}/10 score
            </p>
            {archetypeStat && (
              <p className="text-[11px] text-muted-foreground">
                Meta fit: {archetypeStat.share}% share · {archetypeStat.winRate}% win
                rate in sample
              </p>
            )}
          </div>
        </div>

        <div className="panel space-y-3 p-4 lg:col-span-2">
          {[
            ['Offense', analysis.scores.offense, 'gold', 'Can this deck actually take a tower?'],
            ['Defense', analysis.scores.defense, 'violet', 'Does it stop committed pushes?'],
            ['Air defense', analysis.scores.airDefense, 'cyan', 'Can it answer LavaLoon and Balloon?'],
            ['Cycle', analysis.scores.cycle, 'green', 'How fast does the rotation come back?'],
            [
              'Spell utility',
              analysis.scores.spellUtility,
              'rose',
              'Swarm clear, chip and finisher coverage.',
            ],
          ].map(([label, value, tone, hint]) => (
            <ScoreBar
              key={label as string}
              label={label as string}
              value={value as number}
              tone={tone as Tone}
              hint={hint as string}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Critical" value={critical} accent={critical ? 'rose' : 'green'} />
        <StatTile label="Warnings" value={warnings} accent={warnings ? 'gold' : 'green'} />
        <StatTile label="Strengths" value={positives} accent="green" />
      </div>

      <section className="panel p-5">
        <h3 className="mb-1 flex items-center gap-2 panel-title">
          Role coverage
          <Badge variant="secondary" className="text-[10px]">
            {coveredRows}/{checkedRows} covered
          </Badge>
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Every role the analysis model checks, read from the card catalogue —
          including the Evolution and Hero (Champion) rows, which only report
          what the current data source actually carries.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {structure.rows.map((row) => (
            <div
              key={row.key}
              className={`rounded-lg border p-2.5 ${
                row.state === 'gap'
                  ? 'border-amber-400/30 bg-amber-400/5'
                  : row.state === 'unavailable'
                    ? 'border-border bg-white/[0.02] opacity-75'
                    : 'border-border bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium">{row.label}</span>
                <span
                  className={`text-xs font-bold tabular-nums ${ROLE_STATE_CLASS[row.state]}`}
                >
                  {row.value}
                </span>
              </div>
              {row.note && (
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  {row.note}
                </p>
              )}
            </div>
          ))}
        </div>
        {structure.gaps.length > 0 && (
          <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-xs text-amber-200">
            ⚠ Missing or thin: {structure.gaps.join(', ')}
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h3 className="mb-3 flex items-center gap-2 panel-title">
            Deck diagnosis
            <Badge variant="secondary" className="text-[10px]">
              {analysis.findings.length} findings
            </Badge>
          </h3>
          <div className="space-y-4">
            {strengths.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                  Strengths
                </p>
                <ul className="space-y-3">
                  {strengths.map((finding) => (
                    <li
                      key={finding.code}
                      className="flex gap-3 rounded-lg border border-border bg-white/[0.03] p-3"
                    >
                      <SeverityIcon severity={finding.severity} />
                      <div>
                        <p className="text-sm font-semibold">{finding.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {finding.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {weaknesses.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
                  Weaknesses &amp; role gaps
                </p>
                <ul className="space-y-3">
                  {weaknesses.map((finding) => (
                    <li
                      key={finding.code}
                      className="flex gap-3 rounded-lg border border-border bg-white/[0.03] p-3"
                    >
                      <SeverityIcon severity={finding.severity} />
                      <div>
                        <p className="text-sm font-semibold">{finding.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {finding.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!analysis.findings.length && (
              <p className="text-sm text-muted-foreground">
                Nothing to flag — add the remaining cards for a full diagnosis.
              </p>
            )}
          </div>
        </section>

        <section className="panel p-5">
          <h3 className="mb-3 flex items-center gap-2 panel-title">
            Elixir curve
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              avg {analysis.avgElixir}
            </span>
          </h3>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis.costCurve} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReTooltip
                  cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                  contentStyle={{
                    background: '#141a2e',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [value, String(name ?? 'cards')]}
                  labelFormatter={(label) => `${label} elixir`}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {analysis.costCurve.map((entry) => (
                    <Cell
                      key={entry.elixir}
                      fill={entry.elixir <= 2 ? '#38bdf8' : entry.elixir >= 5 ? '#fb7185' : '#a78bfa'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {[
              ['Win conditions', analysis.composition.winConditions],
              ['Small spells', analysis.composition.smallSpells],
              ['Big spells', analysis.composition.bigSpells],
              ['Buildings', analysis.composition.buildings],
              ['Air answers', analysis.composition.airDefense],
              ['Splash', analysis.composition.splash],
            ].map(([label, list]) => (
              <div key={label as string} className="rounded-lg bg-white/[0.03] p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {label as string}
                </p>
                <p className="truncate font-medium">
                  {(list as string[])
                    .map((key) => getCard(key)?.name ?? key)
                    .join(', ') || '—'}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel p-5">
        <h3 className="mb-1 flex items-center gap-2 panel-title">
          <Sparkles className="size-4 text-yellow-300" />
          Recommended changes
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Every swap is scored against your deck, not pulled from a generic tier list.
        </p>

        {!analysis.swaps.length ? (
          <p className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
            No structural swaps recommended — this deck already covers its roles well.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {analysis.swaps.map((swap) => (
              <article
                key={`${swap.from}-${swap.to}`}
                className="rounded-xl border border-border bg-white/[0.03] p-4"
              >
                <div className="flex items-center justify-center gap-3">
                  <CardTile cardKey={swap.from} size="sm" showName />
                  <ArrowRight className="size-5 shrink-0 text-yellow-300" />
                  <CardTile cardKey={swap.to} size="sm" showName />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {swap.reason}
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {swap.gains.map((gain) => (
                    <li key={gain} className="flex gap-1.5 text-emerald-300">
                      <span>+</span>
                      {gain}
                    </li>
                  ))}
                  {swap.tradeoffs.map((tradeoff) => (
                    <li key={tradeoff} className="flex gap-1.5 text-amber-300">
                      <span>−</span>
                      {tradeoff}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export function MatchupPanel({ analysis }: { analysis: DeckAnalysis }) {
  const favored = analysis.matchups.filter((line) => line.verdict === 'favored').length
  const unfavored = analysis.matchups.filter((line) => line.verdict === 'unfavored').length

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Favoured matchups" value={favored} accent="green" />
        <StatTile label="Even" value={analysis.matchups.length - favored - unfavored} />
        <StatTile label="Unfavourable" value={unfavored} accent="rose" />
      </div>

      <section className="panel p-5">
        <h3 className="mb-4 flex items-center gap-2 panel-title">
          <Swords className="size-4 text-cyan-300" />
          Projected win rate by archetype
        </h3>
        <div className="space-y-3">
          {analysis.matchups.map((line) => (
            <div key={line.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-medium">
                  {line.verdict === 'favored' && (
                    <TrendingUp className="size-3.5 text-emerald-400" />
                  )}
                  {line.verdict === 'unfavored' && (
                    <TrendingDown className="size-3.5 text-rose-400" />
                  )}
                  {line.label}
                </span>
                <span
                  className={
                    line.verdict === 'favored'
                      ? 'font-bold text-emerald-300'
                      : line.verdict === 'unfavored'
                        ? 'font-bold text-rose-300'
                        : 'font-bold text-muted-foreground'
                  }
                >
                  {line.score}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    line.verdict === 'favored'
                      ? 'bg-emerald-400'
                      : line.verdict === 'unfavored'
                        ? 'bg-rose-400'
                        : 'bg-slate-400'
                  }`}
                  style={{ width: `${line.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
