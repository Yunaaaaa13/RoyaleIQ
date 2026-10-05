import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

const TONE: Record<string, string> = {
  gold: 'bg-amber-500',
  cyan: 'bg-sky-500',
  violet: 'bg-blue-500',
  green: 'bg-emerald-500',
  rose: 'bg-rose-500',
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
        <span className="section-title">{label}</span>
        <span className="text-sm font-bold tabular-nums">
          {value}
          <span className="text-muted-foreground">/{max}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all duration-700', TONE[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}

/**
 * KPI card: quiet label, value-forward, supporting context underneath.
 * Flat white surface with a hairline border — no glow, no gradient.
 */
export function StatTile({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string
  value: ReactNode
  sub?: string
  accent?: 'gold' | 'rose' | 'green' | 'cyan'
  icon?: ReactNode
}) {
  const accentClass = accent
    ? {
        gold: 'text-amber-600',
        rose: 'text-rose-600',
        green: 'text-emerald-600',
        cyan: 'text-sky-600',
      }[accent]
    : 'text-foreground'

  return (
    <div className="kpi">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        {icon && <span className="text-primary/70">{icon}</span>}
      </div>
      <p
        className={cn(
          'mt-1.5 text-[28px] font-bold leading-none tracking-tight tabular-nums',
          accentClass,
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function SeverityIcon({ severity }: { severity: string }) {
  if (severity === 'good')
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
  if (severity === 'critical')
    return <ShieldAlert className="size-4 shrink-0 text-rose-500" />
  return <AlertTriangle className="size-4 shrink-0 text-amber-500" />
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
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-muted-foreground">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{item.display}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn('h-full rounded-full transition-all duration-700', item.tone ?? 'bg-primary')}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
