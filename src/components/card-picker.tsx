'use client'

import { useMemo, useState } from 'react'
import type { Variants } from 'motion/react'
import { motion } from 'motion/react'
import { Search } from 'lucide-react'
import { CardTile } from '@/components/card-tile'
import { Input } from '@/components/ui/input'
import { ALL_CARDS, combatOf, type RawCard } from '@/lib/cards'
import type { CardRole } from '@/lib/card-meta'
import { DURATION, EASE_OUT } from '@/lib/motion'

const poolStagger: Variants = {
  hidden: {},
  show: { transition: { delayChildren: (index: number) => Math.min(index * 0.03, 0.45) } },
}

const cellVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: (blocked: boolean) => ({
    opacity: blocked ? 0.3 : 1,
    y: 0,
    transition: { duration: DURATION.component, ease: EASE_OUT },
  }),
}

type FilterKey = 'all' | 'troop' | 'building' | 'spell' | 'wc' | 'air' | 'cheap' | 'defense'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'wc', label: 'Win con' },
  { key: 'troop', label: 'Troops' },
  { key: 'building', label: 'Buildings' },
  { key: 'spell', label: 'Spells' },
  { key: 'air', label: 'Hits air' },
  { key: 'defense', label: 'Defense' },
  { key: 'cheap', label: '≤2 elixir' },
]

const DEFENSE_ROLES: CardRole[] = [
  'tank',
  'tankKiller',
  'splash',
  'building',
  'swarm',
  'reset',
]

function matches(card: RawCard, filter: FilterKey) {
  const meta = combatOf(card.key)
  switch (filter) {
    case 'troop':
      return card.type === 'Troop'
    case 'building':
      return card.type === 'Building'
    case 'spell':
      return card.type === 'Spell'
    case 'wc':
      return meta.roles.includes('wc') || meta.roles.includes('wc2')
    case 'air':
      return meta.air && card.type !== 'Spell'
    case 'cheap':
      return card.elixir <= 2
    case 'defense':
      return meta.roles.some((role) => DEFENSE_ROLES.includes(role))
    default:
      return true
  }
}

interface CardPickerProps {
  selected: string[]
  onToggle: (key: string) => void
  max: number
  disabledTitle?: string
}

export function CardPicker({ selected, onToggle, max, disabledTitle }: CardPickerProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')

  const cards = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return ALL_CARDS.filter(
      (card) =>
        matches(card, filter) &&
        (!needle ||
          card.name.toLowerCase().includes(needle) ||
          card.key.includes(needle.replace(/\s+/g, '-'))),
    )
  }, [query, filter])

  const full = selected.length >= max

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cards…"
            className="h-9 pl-9"
            aria-label="Search cards"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setFilter(entry.key)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                filter === entry.key
                  ? 'border-amber-400 bg-amber-50 text-amber-700'
                  : 'border-border bg-slate-50 text-muted-foreground hover:text-foreground'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {full && (
        <p className="text-xs text-amber-700">
          {disabledTitle ?? 'Deck is full — remove a card to swap it.'}
        </p>
      )}

      <motion.div
        className="grid max-h-[26rem] grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-border bg-slate-100 p-3 sm:grid-cols-6 md:grid-cols-8"
        initial="hidden"
        animate="show"
        variants={poolStagger}
      >
        {cards.map((card) => {
          const active = selected.includes(card.key)
          const blocked = full && !active
          return (
            <motion.button
              key={card.key}
              type="button"
              disabled={blocked}
              onClick={() => onToggle(card.key)}
              title={`${card.name} · ${card.elixir} elixir`}
              variants={cellVariants}
              custom={blocked}
              className={`group/cell flex flex-col items-center gap-1 rounded-lg p-1 transition-[background-color,box-shadow] duration-150 ${
                active ? 'bg-amber-500/10 ring-1 ring-amber-500/50' : 'hover:bg-slate-50'
              }`}
            >
              <CardTile cardKey={card.key} size="sm" showElixir={false} selected={active} />
              <span className="w-full truncate text-center text-[10px] leading-tight text-muted-foreground">
                {card.name}
              </span>
            </motion.button>
          )
        })}
        {!cards.length && (
          <motion.p
            className="col-span-full py-8 text-center text-sm text-muted-foreground"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.component, ease: EASE_OUT }}
          >
            No cards match that filter.
          </motion.p>
        )}
      </motion.div>
    </div>
  )
}
