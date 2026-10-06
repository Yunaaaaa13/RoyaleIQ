import Image from 'next/image'
import type { ReactNode } from 'react'
import { getCard, iconUrl } from '@/lib/cards'

const FRAME: Record<string, string> = {
  Common: 'from-sky-400/70 to-sky-700/40',
  Rare: 'from-orange-400/70 to-orange-700/40',
  Epic: 'from-fuchsia-400/70 to-purple-700/40',
  Legendary: 'from-cyan-300/70 to-teal-700/40',
  Champion: 'from-amber-300/80 to-yellow-700/40',
}

interface CardTileProps {
  cardKey: string
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
  showName?: boolean
  showElixir?: boolean
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  overlay?: ReactNode
}

const SIZES = {
  // `xxs` is what deck strips use: eight cards have to stay on one line in a
  // dense list, so the 40px `xs` frame is one step too large there.
  xxs: { box: 'size-7', image: 28, radius: 'rounded-sm' },
  xs: { box: 'size-10', image: 40, radius: 'rounded-md' },
  sm: { box: 'size-14', image: 56, radius: 'rounded-lg' },
  md: { box: 'size-20', image: 80, radius: 'rounded-xl' },
  lg: { box: 'size-24', image: 96, radius: 'rounded-xl' },
} as const

export function CardTile({
  cardKey,
  size = 'md',
  showName = false,
  showElixir = true,
  selected = false,
  disabled = false,
  onClick,
  overlay,
}: CardTileProps) {
  const card = getCard(cardKey)
  if (!card) return null
  const frame = SIZES[size]
  const interactive = Boolean(onClick) && !disabled

  const tile = (
    <div
      className={`group relative mx-auto ${frame.box} shrink-0 ${frame.radius} transition-[transform,box-shadow,opacity] duration-200 ease-out ${
        selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
      } ${disabled ? 'opacity-35' : ''} ${
        interactive
          ? 'cursor-pointer hover:scale-[1.02] hover:shadow-[0_6px_16px_-8px_rgb(23_32_51/35%)]'
          : ''
      }`}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      aria-label={interactive ? `Add ${card.name}` : card.name}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${FRAME[card.rarity]} ${frame.radius}`}
      />
      <Image
        src={iconUrl(cardKey)}
        alt={card.name}
        width={frame.image}
        height={frame.image}
        sizes={`${frame.image}px`}
        className={`relative ${frame.radius} h-full w-full object-contain transition-transform duration-200 ease-out group-hover/cell:scale-[1.04] group-hover/row:scale-[1.04]`}
      />
      {showElixir && (
        <span className="absolute -bottom-1.5 -left-1.5 grid size-5 place-items-center rounded-full border border-white/60 bg-gradient-to-b from-blue-500 to-blue-700 text-[10px] font-bold text-white shadow">
          {card.elixir}
        </span>
      )}
      {overlay}
    </div>
  )

  if (!showName) return tile

  return (
    <div className="flex w-full flex-col items-center gap-1.5">
      {tile}
      <span className="w-full truncate text-center text-[11px] leading-tight text-muted-foreground">
        {card.name}
      </span>
    </div>
  )
}
