'use client'

import { useMemo } from 'react'
import { Network } from 'lucide-react'
import { CardTile } from '@/components/card-tile'
import { archetypeLabel } from '@/lib/archetypes'
import { getCard } from '@/lib/cards'
import { clusterDecks, type DeckFamily } from '@/lib/clusters'
import type { MetaSnapshot } from '@/lib/battle'

function cardName(key: string): string {
  return getCard(key)?.name ?? key
}

function swapText(family: DeckFamily, index: number): string {
  const variant = family.variants[index]
  const removed = variant.removed.map(cardName).join(', ')
  const added = variant.added.map(cardName).join(', ')
  if (!variant.removed.length && !variant.added.length) return 'same eight cards'
  return `swaps ${removed || 'nothing'} for ${added || 'nothing'}`
}

export function DeckFamilies({ snapshot }: { snapshot: MetaSnapshot }) {
  const clusters = useMemo(() => clusterDecks(snapshot.decks), [snapshot.decks])
  const families = clusters.families.filter((family) => family.variants.length > 1)

  if (!clusters.deckCount) return null

  return (
    <section className="panel p-5">
      <h3 className="mb-1 flex items-center gap-2 panel-title">
        <Network className="size-4 text-cyan-300" />
        Deck families
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        The deck table below keys on the exact eight cards, so the same build with one swap
        reads as two decks. Here those variants are folded back together: decks join a family
        when they share at least {clusters.minSharedCards} of their eight cards.
      </p>

      {!families.length ? (
        <p className="text-sm text-muted-foreground">
          No two decks in this sample share {clusters.minSharedCards} of their eight cards —
          all {clusters.deckCount} builds are one-offs, so there are no families to group.
        </p>
      ) : (
        <>
          <p className="mb-4 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {clusters.groupedDecks} of {clusters.deckCount}
            </span>{' '}
            distinct decks belong to {families.length} famil
            {families.length === 1 ? 'y' : 'ies'}, covering{' '}
            <span className="font-semibold text-foreground">{clusters.groupedUsage}%</span> of
            the sample. The other{' '}
            <span className="font-semibold text-foreground">
              {clusters.deckCount - clusters.groupedDecks}
            </span>{' '}
            {clusters.deckCount - clusters.groupedDecks === 1 ? 'build has' : 'builds have'} no
            sibling and sit in the deck table below as their own signature.
            {clusters.capped && (
              <>
                {' '}
                The {clusters.deckCount - clusters.considered} least-played builds were not
                grouped, so this stays instant to render.
              </>
            )}
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            {families.map((family) => (
              <article
                key={family.id}
                className="rounded-xl border border-border bg-white/[0.03] p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{family.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {archetypeLabel(family.archetype)} · {family.variants.length} decks ·{' '}
                      {family.battles} battles · {family.similarity}% mean overlap
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm font-bold tabular-nums ${
                        family.winRate >= 52
                          ? 'text-emerald-300'
                          : family.winRate <= 48
                            ? 'text-rose-300'
                            : ''
                      }`}
                    >
                      {family.winRate}%
                    </p>
                    <p className="text-[11px] text-muted-foreground">{family.usage}% usage</p>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-1">
                  {family.variants[0].cards.map((key) => (
                    <CardTile
                      key={`${family.id}-${key}`}
                      cardKey={key}
                      size="xs"
                      showElixir={false}
                    />
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground">
                  In every variant:{' '}
                  <span className="text-foreground">
                    {family.core.length
                      ? family.core.map(cardName).join(', ')
                      : 'no card survives in all of them'}
                  </span>
                </p>

                {family.variants.length > 1 && (
                  <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                    {family.variants.slice(1).map((variant, index) => (
                      <li
                        key={variant.id}
                        className="flex items-baseline justify-between gap-3 text-[11px]"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">{variant.label}</span>{' '}
                          <span className="text-muted-foreground">
                            — {swapText(family, index + 1)}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {variant.usage}% · {variant.winRate}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
