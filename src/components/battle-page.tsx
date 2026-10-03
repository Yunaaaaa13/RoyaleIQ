'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { BattleDetail, type BattleSummary } from '@/components/battle-detail'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { PlayerStats } from '@/lib/player'
import { normalizeTag } from '@/lib/tags'
import { cn } from '@/lib/utils'

// Wire types (mirrored from /api/battles and /api/player).
interface BattlesPayload {
  battles?: BattleSummary[]
  error?: string
}

interface PlayerPayload {
  stats?: PlayerStats
  error?: string
}

function BattleSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="panel h-24 animate-pulse" />
      <div className="panel h-40 animate-pulse" />
      <div className="panel h-64 animate-pulse" />
    </div>
  )
}

function Notice({
  title,
  body,
  action,
  onAction,
}: {
  title: string
  body: string
  action: string
  onAction: () => void
}) {
  return (
    <Alert className="border-amber-400/30 bg-amber-400/10">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{body}</p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onAction}>
          <ArrowLeft className="size-4" />
          {action}
        </Button>
      </AlertDescription>
    </Alert>
  )
}

/**
 * The battle dashboard is a route rather than a panel: the URL carries the tag
 * and the match time, so a result can be opened, bookmarked and shared, and the
 * same analysis renders full width instead of inside an overlay.
 *
 * The enter animation lives here, not on the route shell, so the same element
 * can play the exit when the back control is used - the route unmounts either
 * way, so only an in-page navigation can be seen leaving.
 */
export function BattlePage() {
  const params = useSearchParams()
  const router = useRouter()
  const tag = normalizeTag(params.get('tag')?.trim() ?? '')
  const time = params.get('t') ?? ''
  const backHref = tag ? `/player?tag=${encodeURIComponent(tag)}` : '/player'
  const requestKey = `${tag}|${time}`

  // Keyed by the battle being requested: a result for a different tag or match
  // is treated as "not answered yet", which is what the loading skeleton below
  // renders from - derived during render rather than reset inside the effect.
  const [result, setResult] = useState<{ key: string; data: BattleSummary | null } | null>(null)

  const [leaving, setLeaving] = useState(false)
  const leaveTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
    },
    [],
  )

  // Play the slide-out, then hand off. A second click while it runs is a no-op
  // so the timer can never queue two navigations.
  const leave = () => {
    if (leaving) return
    setLeaving(true)
    leaveTimer.current = window.setTimeout(() => router.push(backHref), 220)
  }

  useEffect(() => {
    if (!tag || !time) return

    let cancelled = false
    const controller = new AbortController()
    const key = `${tag}|${time}`

    const settle = (found: BattleSummary | undefined) => {
      if (cancelled) return
      setResult({ key, data: found ?? null })
    }

    // `/api/battles` carries the diagnosis, so it is the first choice. `t` asks
    // for just this match: the route reads the same window and diagnoses one
    // row instead of thirty. The profile's `recent` list is the fallback: a
    // battle synced from the live log but stored without a raw payload never
    // reaches the battle route.
    ;(async () => {
      try {
        const response = await fetch(
          `/api/battles?tag=${encodeURIComponent(tag)}&limit=30&t=${encodeURIComponent(time)}`,
          { cache: 'no-store', signal: controller.signal },
        )
        const data = (await response.json()) as BattlesPayload
        const stored = Array.isArray(data.battles) ? data.battles : []
        const hit = stored.find((entry) => entry.time === time)
        if (hit) {
          settle(hit)
          return
        }
      } catch {
        if (controller.signal.aborted) return
      }

      try {
        const response = await fetch(`/api/player?tag=${encodeURIComponent(tag)}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = (await response.json()) as PlayerPayload
        settle((data.stats?.recent ?? []).find((entry) => entry.time === time))
      } catch {
        settle(undefined)
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [tag, time])

  let body: ReactNode

  if (!tag || !time) {
    body = (
      <Notice
        title="No battle selected"
        body="Open a battle from the player tracker so the player tag and the match are both in the URL."
        action="Back to player tracker"
        onAction={leave}
      />
    )
  } else {
    const settled = result?.key === requestKey ? result : null

    if (!settled) {
      body = <BattleSkeleton />
    } else if (!settled.data) {
      body = (
        <Notice
          title="That battle is not in the list"
          body="The stored history has moved on since this link was made. Reload the profile to pull the current battle log."
          action="Back to this player"
          onAction={leave}
        />
      )
    } else {
      body = <BattleDetail battle={settled.data} status="ready" onBack={leave} />
    }
  }

  return (
    <div
      className={cn(
        leaving
          ? 'animate-out fade-out-0 slide-out-to-right-10 duration-200'
          : 'animate-in fade-in-0 slide-in-from-right-10 duration-300',
      )}
    >
      {body}
    </div>
  )
}
