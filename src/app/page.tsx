import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Bot,
  Crosshair,
  Database,
  Sparkles,
  Swords,
  Target,
  Workflow,
} from 'lucide-react'
import { HomeMetaPulse } from '@/components/home-meta-pulse'
import { Button } from '@/components/ui/button'
import { ARCHETYPES } from '@/lib/archetypes'
import { ALL_CARDS } from '@/lib/cards'

const FEATURES = [
  {
    href: '/deck-lab',
    icon: Crosshair,
    title: 'Deck Analyzer',
    accent: 'text-yellow-300',
    body: 'Average elixir is the start, not the answer. Offense, defence, air defence, cycle and spell utility get scored independently, then the structural weaknesses are named.',
    points: ['Role classification', 'Structural diagnosis', 'Scored card swaps'],
  },
  {
    href: '/meta',
    icon: BarChart3,
    title: 'Meta Analytics',
    accent: 'text-cyan-300',
    body: 'Usage, win rate and archetype share aggregated from real ladder battle logs, with filters for rarity, sort order and momentum over the sample window.',
    points: ['Card analytics', 'Archetype share', 'Trending cards'],
  },
  {
    href: '/ai-coach',
    icon: Bot,
    title: 'AI Deck Coach',
    accent: 'text-violet-300',
    body: 'Ask a real question — "I lose to Golem every time" — and get the reasoning back: which role is missing, which card fixes it, and what it costs you.',
    points: ['LLM reasoning', 'Rule-engine fallback', 'Matchup game plan'],
  },
  {
    href: '/player',
    icon: Swords,
    title: 'Player Tracker',
    accent: 'text-emerald-300',
    body: 'Win rate over time, performance split by opponent archetype, best and worst matchups, and the single card that quietly drags your win rate down.',
    points: ['Battle history', 'Matchup records', 'Worst card report'],
  },
]

const FLOW = [
  {
    step: '1',
    title: 'Input',
    body: 'Player tag, or eight cards straight from the card pool.',
    icon: Target,
  },
  {
    step: '2',
    title: 'Fetch',
    body: 'Profile, battle log and rankings pulled from the official Supercell API server-side.',
    icon: Database,
  },
  {
    step: '3',
    title: 'Classify',
    body: 'Every card gets roles, air/ground flags, splash and dps tiers.',
    icon: Workflow,
  },
  {
    step: '4',
    title: 'Score',
    body: 'Five independent dimensions plus archetype detection and matchup projection.',
    icon: Sparkles,
  },
  {
    step: '5',
    title: 'Explain',
    body: 'Findings, scored swaps and an LLM verdict that says why, not just what.',
    icon: Bot,
  },
]

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-4 pt-12 sm:px-6 sm:pt-16">
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-white/[0.06] to-transparent px-6 py-14 sm:px-10 sm:py-20">
        <div className="grid-noise pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 size-72 rounded-full bg-violet-600/15 blur-3xl" />

        <div className="relative mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Clash Royale Intelligence Platform
          </p>
          <h1 className="text-balance text-4xl font-black tracking-tight sm:text-6xl">
            Master your deck.
            <br />
            <span className="gold-text">Understand the meta.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            RoyaleIQ reads your eight cards, scores them on the five dimensions that
            decide games, tells you exactly where the deck is structurally broken, and
            explains the fix — using live Supercell data plus an AI coach.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="h-11 gap-2 px-6 font-semibold">
              <Link href="/deck-lab">
                Analyze my deck
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 gap-2 px-6 font-semibold"
            >
              <Link href="/meta">Explore the meta</Link>
            </Button>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [String(ALL_CARDS.length), 'cards classified'],
              ['5', 'independent scores'],
              [String(ARCHETYPES.length), 'archetype profiles'],
              ['3', 'ways to get coached'],
            ].map(([value, label]) => (
              <div key={label} className="kpi px-3 py-4">
                <dt className="text-2xl font-black tabular-nums text-foreground">{value}</dt>
                <dd className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mt-8">
        <HomeMetaPulse />
      </section>

      <section className="mt-16">
        <div className="mb-6 flex flex-col gap-2">
          <p className="eyebrow">Modules</p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Four tools, one platform
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="panel group flex flex-col gap-3 p-6 transition hover:-translate-y-1 hover:border-primary/40"
            >
              <span
                className={`grid size-11 place-items-center rounded-xl border border-border bg-white/[0.03] ${feature.accent}`}
              >
                <feature.icon className="size-5" />
              </span>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
              <ul className="mt-auto flex flex-wrap gap-1.5 pt-2">
                {feature.points.map((point) => (
                  <li
                    key={point}
                    className="rounded-full border border-border bg-white/[0.03] px-2.5 py-1 text-[11px] text-muted-foreground"
                  >
                    {point}
                  </li>
                ))}
              </ul>
              <span className="mt-2 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition group-hover:opacity-100">
                Open <ArrowRight className="size-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <div className="mb-6 flex flex-col gap-2">
          <p className="eyebrow">Data flow</p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            From player tag to verdict
          </h2>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FLOW.map((item) => (
            <li key={item.step} className="panel relative p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground">
                  {item.step}
                </span>
                <item.icon className="size-4 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-wide">
                {item.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel mt-16 flex flex-col items-center gap-4 p-8 text-center sm:p-12">
        <h2 className="text-balance text-2xl font-bold sm:text-3xl">
          Stop guessing why you lost
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Pick eight cards and get a scored, explained diagnosis in seconds — the same
          analysis you would ask a coach for, but backed by numbers you can check.
        </p>
        <Button asChild size="lg" className="h-11 gap-2 px-6 font-semibold">
          <Link href="/deck-lab">
            Open Deck Lab
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>
    </div>
  )
}
