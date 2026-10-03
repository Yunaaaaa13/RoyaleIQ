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
import { getCard } from '@/lib/cards'

type Tone = 'gold' | 'violet' | 'cyan' | 'green' | 'rose'

export function DiagnosisPanel({ analysis }: { analysis: DeckAnalysis }) {
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel flex items-center gap-4 p-4 lg:col-span-1">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-yellow-300 to-amber-600 text-2xl font-black text-black">
            {grade}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Deck score
            </p>
            <p className="text-2xl font-bold tabular-nums">
              {analysis.scores.overall}
              <span className="text-base text-muted-foreground">/10</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {analysis.archetypeLabel} · {analysis.avgElixir} avg elixir
            </p>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
            Deck diagnosis
            <Badge variant="secondary" className="text-[10px]">
              {analysis.findings.length} findings
            </Badge>
          </h3>
          <ul className="space-y-3">
            {analysis.findings.map((finding) => (
              <li
                key={finding.code}
                className="flex gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
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
            {!analysis.findings.length && (
              <li className="text-sm text-muted-foreground">
                Nothing to flag — add the remaining cards for a full diagnosis.
              </li>
            )}
          </ul>
        </section>

        <section className="panel p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
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
              <div key={label as string} className="rounded-lg bg-white/5 p-2">
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
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
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
                className="rounded-xl border border-white/10 bg-white/5 p-4"
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
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
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
