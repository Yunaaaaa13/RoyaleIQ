'use client'

import { useMemo } from 'react'
import {
  CartesianGrid,
  Cell,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
  ZAxis,
  type TooltipContentProps,
} from 'recharts'
import { CardTile } from '@/components/card-tile'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { MetaSnapshot } from '@/lib/battle'

// ---------------------------------------------------------------------------
// Quadrant model
// ---------------------------------------------------------------------------

const QUADRANTS = {
  gem: {
    label: 'Hidden Gem',
    hint: 'Below-median usage, win rate at or above 50%',
    color: '#34d399',
  },
  power: {
    label: 'Meta Powerhouse',
    hint: 'Above-median usage, win rate at or above 50%',
    color: '#22d3ee',
  },
  impact: {
    label: 'Low Impact',
    hint: 'Below-median usage, win rate below 50%',
    color: '#94a3b8',
  },
  overplayed: {
    label: 'Overplayed',
    hint: 'Above-median usage, win rate below 50%',
    color: '#fb7185',
  },
} as const

type QuadrantKey = keyof typeof QUADRANTS

interface Point {
  key: string
  name: string
  usage: number
  winRate: number
  battles: number
  /** Win rate the usage trend predicts for a card at this usage. */
  expected: number
  /** Observed minus expected, in percentage points. */
  gap: number
  qualified: boolean
  quadrant: QuadrantKey
}

const round1 = (value: number): number => Math.round(value * 10) / 10

/**
 * Weighted least squares of win rate on ln(1 + usage), weighted by how many
 * battles each card was seen in. Low-usage cards carry noisy win rates, so
 * weighting keeps a card seen four times from dragging the trend line around.
 */
function fitUsageTrend(cards: { usage: number; winRate: number; battles: number }[]) {
  let sw = 0
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (const card of cards) {
    const w = card.battles
    const x = Math.log(1 + card.usage)
    const y = card.winRate
    sw += w
    sx += w * x
    sy += w * y
    sxx += w * x * x
    sxy += w * x * y
  }
  const denominator = sw * sxx - sx * sx
  if (!sw || !denominator) return (usage: number) => 50 + usage * 0
  const slope = (sw * sxy - sx * sy) / denominator
  const intercept = (sy - slope * sx) / sw
  return (usage: number) =>
    Math.max(0, Math.min(100, round1(intercept + slope * Math.log(1 + usage))))
}

function MatrixTooltip({ payload }: Partial<TooltipContentProps<number, string>>) {
  const entry = payload?.[0] as { payload?: Point } | undefined
  const point = entry?.payload
  if (!point) return null
  return (
    <div className="rounded-lg border border-border bg-[#141a2e] px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{point.name}</p>
      <p className="text-muted-foreground">
        {point.usage}% usage · {point.battles} battle{point.battles === 1 ? '' : 's'}
      </p>
      <p className={point.winRate >= 50 ? 'text-emerald-300' : 'text-rose-300'}>
        {point.winRate}% win rate
        <span className="text-muted-foreground"> vs {point.expected}% expected</span>
      </p>
      {!point.qualified && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Too few battles to judge — excluded from the detector.
        </p>
      )}
    </div>
  )
}

const SIGNAL: Record<string, { label: string; className: string }> = {
  underused: { label: 'Underused, outperforming', className: 'text-emerald-300' },
  outperforming: { label: 'Outperforming', className: 'text-emerald-300' },
  overplayed: { label: 'High usage, below expectation', className: 'text-rose-300' },
  underperforming: { label: 'Underperforming', className: 'text-rose-300' },
}

// ---------------------------------------------------------------------------

export function MetaMatrix({ snapshot }: { snapshot: MetaSnapshot }) {
  const model = useMemo(() => {
    const cards = snapshot.cards.filter((card) => card.battles >= 1 && card.usage > 0)
    // Same convention the "highest win rate" panel uses: a card has to show up
    // in roughly one battle in eight before we are willing to judge it.
    const minBattles = Math.max(3, Math.round(snapshot.battles * 0.12))
    const predict = fitUsageTrend(cards)

    const qualified = cards.filter((card) => card.battles >= minBattles)
    const sortedUsage = qualified.map((card) => card.usage).sort((a, b) => a - b)
    const usageThreshold = sortedUsage.length
      ? sortedUsage[Math.floor(sortedUsage.length / 2)]
      : 10

    const counts: Record<QuadrantKey, number> = { gem: 0, power: 0, impact: 0, overplayed: 0 }
    const points: Point[] = cards.map((card) => {
      const expected = predict(card.usage)
      const isQualified = card.battles >= minBattles
      const highUsage = card.usage >= usageThreshold
      const abovePar = card.winRate >= 50
      const quadrant: QuadrantKey = highUsage
        ? abovePar
          ? 'power'
          : 'overplayed'
        : abovePar
          ? 'gem'
          : 'impact'
      if (isQualified) counts[quadrant] += 1
      return {
        key: card.key,
        name: card.name,
        usage: card.usage,
        winRate: card.winRate,
        battles: card.battles,
        expected,
        gap: round1(card.winRate - expected),
        qualified: isQualified,
        quadrant,
      }
    })

    const anomalies = points
      .filter((point) => point.qualified && Math.abs(point.gap) >= 2)
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    const anomalyTotal = anomalies.length
    const topAnomalies = anomalies.slice(0, 10)

    const qualifiedUsages = qualified.map((card) => card.usage)
    const hasQualified = qualifiedUsages.length > 0
    const trendSwing = hasQualified
      ? round1(predict(Math.max(...qualifiedUsages)) - predict(Math.min(...qualifiedUsages)))
      : 0

    const rates = points.map((point) => point.winRate)
    const usages = points.map((point) => point.usage)
    const yMin = Math.max(0, Math.floor(Math.min(...rates, 50) - 4))
    const yMax = Math.min(100, Math.ceil(Math.max(...rates, 50) + 4))
    const xMax = Math.max(5, Math.ceil(Math.max(...usages, usageThreshold) + 2))

    return {
      points,
      anomalies: topAnomalies,
      anomalyTotal,
      trendSwing,
      hasQualified,
      counts,
      minBattles,
      usageThreshold,
      yMin,
      yMax,
      xMax,
    }
  }, [snapshot])

  const {
    points,
    anomalies,
    anomalyTotal,
    trendSwing,
    hasQualified,
    counts,
    minBattles,
    usageThreshold,
    yMin,
    yMax,
    xMax,
  } = model

  if (!points.length) {
    return (
      <section className="panel p-5">
        <h3 className="mb-2 panel-title">
          Meta vs performance
        </h3>
        <p className="text-sm text-muted-foreground">
          No card usage data in this sample yet.
        </p>
      </section>
    )
  }

  return (
    <>
      <section className="panel p-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="panel-title">
            Meta vs performance
          </h3>
          <p className="text-xs text-muted-foreground">
            {points.filter((point) => point.qualified).length} cards with at least{' '}
            {minBattles} battle{minBattles === 1 ? '' : 's'}
          </p>
        </div>
        <p className="mb-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Horizontal is how much of this sample the card appears in; vertical is its win rate
          here; bubble size is the number of battles observed. The axes split at the median
          usage of qualified cards and at 50%. These are positions inside our own sample, not
          a tier list — a card can be genuinely good and still sit low if it mostly appears in
          losing line-ups.
        </p>

        {snapshot.battles < 50 && (
          <Alert className="mb-4 border-yellow-400/30 bg-yellow-400/10">
            <AlertTitle>Small sample</AlertTitle>
            <AlertDescription>
              {snapshot.battles} battles sit behind this chart. Cards seen in fewer than{' '}
              {minBattles} battles are greyed out and excluded from the detector; treat the
              rest as directional rather than settled.
            </AlertDescription>
          </Alert>
        )}

        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <ReferenceArea
                x1={0}
                x2={usageThreshold}
                y1={50}
                y2={yMax}
                fill={QUADRANTS.gem.color}
                fillOpacity={0.06}
              />
              <ReferenceArea
                x1={usageThreshold}
                x2={xMax}
                y1={50}
                y2={yMax}
                fill={QUADRANTS.power.color}
                fillOpacity={0.06}
              />
              <ReferenceArea
                x1={0}
                x2={usageThreshold}
                y1={yMin}
                y2={50}
                fill={QUADRANTS.impact.color}
                fillOpacity={0.05}
              />
              <ReferenceArea
                x1={usageThreshold}
                x2={xMax}
                y1={yMin}
                y2={50}
                fill={QUADRANTS.overplayed.color}
                fillOpacity={0.06}
              />
              <XAxis
                type="number"
                dataKey="usage"
                name="Usage"
                unit="%"
                domain={[0, xMax]}
                tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                label={{
                  value: 'Usage in this sample',
                  position: 'insideBottom',
                  offset: -6,
                  fill: 'rgba(255,255,255,0.45)',
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="winRate"
                name="Win rate"
                unit="%"
                domain={[yMin, yMax]}
                tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                label={{
                  value: 'Win rate',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 8,
                  fill: 'rgba(255,255,255,0.45)',
                  fontSize: 11,
                }}
              />
              <ZAxis type="number" dataKey="battles" range={[20, 420]} name="Battles" />
              <ReferenceLine y={50} stroke="rgba(255,255,255,0.3)" />
              <ReferenceLine
                x={usageThreshold}
                stroke="rgba(255,255,255,0.3)"
                strokeDasharray="4 4"
              />
              <ReTooltip
                content={<MatrixTooltip />}
                cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.25)' }}
              />
              <Scatter data={points} fillOpacity={0.9} isAnimationActive={false}>
                {points.map((point) => (
                  <Cell
                    key={point.key}
                    fill={
                      point.qualified
                        ? QUADRANTS[point.quadrant].color
                        : 'rgba(255,255,255,0.22)'
                    }
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(QUADRANTS) as QuadrantKey[]).map((key) => (
            <div
              key={key}
              className="rounded-lg border border-border bg-white/[0.03] px-3 py-2"
            >
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: QUADRANTS[key].color }}
                />
                <span className="truncate">{QUADRANTS[key].label}</span>
                <span className="ml-auto tabular-nums text-xs font-normal text-muted-foreground">
                  {counts[key]}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {QUADRANTS[key].hint}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="panel-title">
            Off-meta detector
          </h3>
          <p className="text-xs text-muted-foreground">
            {anomalies.length} of {anomalyTotal} cards at least 2 points off the trend
          </p>
        </div>
        <p className="mb-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Expected win rate is a trend fitted across the cards in this sample — win rate
          against usage, weighted by how often each card was seen — not a rating from
          anywhere else. The gap is observed minus expected in percentage points, so it
          answers one narrow question: is this card winning more or less than its own
          popularity suggests? Only cards with at least {minBattles} battles are listed.
          {' '}
          {hasQualified ? (
            Math.abs(trendSwing) < 3 ? (
              <>
                Across the qualified cards, usage barely moves the needle here — the fitted
                trend shifts only {Math.abs(trendSwing)} points from the least-used card to the
                most-used, so expected sits close to the sample average and the gap is mostly
                how far a card sits from everyone else.
              </>
            ) : (
              <>
                Across the qualified cards the fitted trend shifts {Math.abs(trendSwing)} points
                from the least-used card to the most-used, so expected genuinely rises with
                popularity.
              </>
            )
          ) : (
            <>
              No card in this sample has reached {minBattles} battles yet, so there is nothing
              to list — every point in the chart above is greyed out for the same reason.
            </>
          )}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <th className="py-2 pr-3">Card</th>
                <th className="hidden py-2 pr-3 text-right sm:table-cell">Usage</th>
                <th className="py-2 pr-3 text-right">Observed</th>
                <th className="hidden py-2 pr-3 text-right sm:table-cell">Expected</th>
                <th className="py-2 pr-3 text-right">Gap</th>
                <th className="hidden py-2 pr-3 text-right sm:table-cell">Battles</th>
                <th className="hidden py-2 text-right sm:table-cell">Signal</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((point) => {
                const signal = SIGNAL[
                  point.gap > 0
                    ? point.usage < usageThreshold
                      ? 'underused'
                      : 'outperforming'
                    : point.usage >= usageThreshold
                      ? 'overplayed'
                      : 'underperforming'
                ]
                const strong = Math.abs(point.gap) >= 4
                return (
                  <tr
                    key={point.key}
                    className="border-b border-border/60 transition hover:bg-white/[0.03]"
                  >
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <CardTile cardKey={point.key} size="xs" showElixir={false} />
                        <span className="font-medium">{point.name}</span>
                      </div>
                    </td>
                    <td className="hidden py-2 pr-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                      {point.usage}%
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                      {point.winRate}%
                    </td>
                    <td className="hidden py-2 pr-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                      {point.expected}%
                    </td>
                    <td
                      className={`py-2 pr-3 text-right font-bold tabular-nums ${
                        point.gap > 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {point.gap > 0 ? '+' : ''}
                      {point.gap}
                    </td>
                    <td className="hidden py-2 pr-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                      {point.battles}
                    </td>
                    <td className="hidden py-2 text-right sm:table-cell">
                      <span
                        className={`text-xs font-semibold ${signal.className} ${
                          strong ? 'underline decoration-dotted underline-offset-4' : ''
                        }`}
                      >
                        {signal.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {!anomalies.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No card in this sample sits two or more points away from the trend —
                    nothing is punching above or below its popularity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
