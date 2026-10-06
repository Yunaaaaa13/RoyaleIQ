import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { CardMatchups } from '@/components/card-matchups'
import { CardTile } from '@/components/card-tile'
import { PageTransition } from '@/components/page-transition'
import { findCard } from '@/lib/cards'

interface CardMatchupsPageProps {
  params: Promise<{ key: string }>
}

export async function generateMetadata({ params }: CardMatchupsPageProps): Promise<Metadata> {
  const { key } = await params
  const card = findCard(decodeURIComponent(key))
  if (!card) return { title: 'Card not found' }
  return {
    title: `${card.name} - Card matchups`,
    description: `Recorded results for ${card.name} against each archetype and each opposing card, measured on the rolling meta corpus.`,
  }
}

export default async function CardMatchupsPage({ params }: CardMatchupsPageProps) {
  const { key } = await params
  const card = findCard(decodeURIComponent(key))
  if (!card) notFound()

  return (
    <PageTransition className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link
        href={`/cards/${card.key}`}
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {card.name} card intelligence
      </Link>

      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <CardTile cardKey={card.key} size="lg" showElixir />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600/80">
            Card matchups
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{card.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What it has been recorded doing against each archetype, and against each card it meets
            across the river.
          </p>
        </div>
      </header>

      <CardMatchups cardKey={card.key} cardName={card.name} />
    </PageTransition>
  )
}
