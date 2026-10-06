import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { CardDetail } from '@/components/card-detail'
import { CardTile } from '@/components/card-tile'
import { PageTransition } from '@/components/page-transition'
import { Badge } from '@/components/ui/badge'
import { combatOf, findCard } from '@/lib/cards'
import { ROLE_LABEL } from '@/lib/card-meta'

interface CardPageProps {
  params: Promise<{ key: string }>
}

/** Arena 0 is the training camp; the rest are numbered in the card dataset. */
const arenaLabel = (arena: number) => (arena === 0 ? 'Training Camp' : `Arena ${arena}`)

export async function generateMetadata({ params }: CardPageProps): Promise<Metadata> {
  const { key } = await params
  const card = findCard(decodeURIComponent(key))
  if (!card) return { title: 'Card not found' }
  return {
    title: `${card.name} - Card Intelligence`,
    description: `Usage rate, win rate, recommended decks, synergy pairs and a rules-written read of ${card.name}.`,
  }
}

export default async function CardPage({ params }: CardPageProps) {
  const { key } = await params
  const card = findCard(decodeURIComponent(key))
  if (!card) notFound()

  const combat = combatOf(card.key)

  return (
    <PageTransition className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link
        href="/cards"
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All cards
      </Link>

      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <CardTile cardKey={card.key} size="lg" showElixir />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600/80">
            Card Intelligence
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{card.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{card.rarity}</Badge>
            <Badge variant="outline">{card.elixir} elixir</Badge>
            <Badge variant="outline">{card.type}</Badge>
            <Badge variant="outline">{arenaLabel(card.arena)}</Badge>
            {combat.roles.map((role) => (
              <Badge key={role} variant="outline" className="border-amber-300 text-amber-700">
                {ROLE_LABEL[role]}
              </Badge>
            ))}
          </div>
        </div>
      </header>

      <CardDetail cardKey={card.key} />
    </PageTransition>
  )
}
