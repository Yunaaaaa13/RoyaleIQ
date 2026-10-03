import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

const TONE: Record<string, string> = {
  gold: 'bg-yellow-400',
  cyan: 'bg-cyan-400',
  violet: 'bg-violet-400',
  green: 'bg-emerald-400',
  rose: 'bg-rose-400',
}

export function ScoreBar({
  label,
  value,
  max = 10,
  tone = 'gold',
  hint,
}: {
  label: string
  value: number
  max?: number
  tone?: keyof typeof TONE
  hint?: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-sm font-bold tabular-nums">
          {value}
          <span className="text-muted-foreground">/{max}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn('h-full rounded-full transition-all duration-700', TONE[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: ReactNode
  sub?: string
  accent?: 'gold' | 'rose' | 'green' | 'cyan'
}) {
  const accentClass = {
    gold: 'text-yellow-300',
    rose: 'text-rose-300',
    green: 'text-emerald-300',
    cyan: 'text-cyan-300',
  }[accent ?? 'gold']

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('text-xl font-bold tabular-nums', accentClass)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function SeverityIcon({ severity }: { severity: string }) {
  if (severity === 'good')
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
  if (severity === 'critical')
    return <ShieldAlert className="size-4 shrink-0 text-rose-400" />
  return <AlertTriangle className="size-4 shrink-0 text-amber-400" />
}

export function BarList({
  items,
}: {
  items: { label: string; value: number; display: string; tone?: string }[]
}) {
  const max = Math.max(...items.map((item) => item.value), 1)
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="truncate pr-2 text-muted-foreground">{item.label}</span>
            <span className="font-semibold tabular-nums">{item.display}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn('h-full rounded-full', item.tone ?? 'bg-violet-400')}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
