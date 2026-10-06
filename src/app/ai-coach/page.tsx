import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AiCoachWorkspace } from '@/components/ai-coach-workspace'
import { PageTransition } from '@/components/page-transition'

export const metadata: Metadata = {
  title: 'AI Recommendation',
  description:
    'Ask the RoyaleIQ deck coach: LLM-backed reasoning over your eight cards, grounded in your real results, with a deterministic rule-engine fallback.',
}

function CoachFallback() {
  return (
    <div className="space-y-4">
      <div className="panel h-56 animate-pulse" />
      <div className="panel h-72 animate-pulse" />
    </div>
  )
}

export default function AiCoachPage() {
  return (
    <PageTransition className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-2 border-b border-border/70 pb-5">
        <p className="eyebrow">AI Recommendation</p>
        <h1 className="page-title">Ask the coach what your deck is doing wrong</h1>
        <p className="page-lede">
          Pick the deck, ask a real question — “I lose to Golem every time” — and get
          the reasoning back: which role is missing, which card fixes it and what it
          costs you. Answers can be grounded in your own stored battles.
        </p>
      </header>
      <Suspense fallback={<CoachFallback />}>
        <AiCoachWorkspace />
      </Suspense>
    </PageTransition>
  )
}
