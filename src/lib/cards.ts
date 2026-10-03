import { RAW_CARDS, type RawCard } from './card-data'
import { CARD_COMBAT, type CardCombat, type CardRole } from './card-meta'

export type { RawCard, CardCombat, CardRole }

const BY_KEY = new Map(RAW_CARDS.map((card) => [card.key, card]))
const BY_NAME = new Map(RAW_CARDS.map((card) => [card.name.toLowerCase(), card]))

export const ALL_CARDS = RAW_CARDS

export function getCard(key: string): RawCard | undefined {
  return BY_KEY.get(key)
}

export function findCard(input: string): RawCard | undefined {
  const cleaned = input.trim().toLowerCase()
  if (!cleaned) return undefined
  return (
    BY_KEY.get(cleaned) ??
    BY_NAME.get(cleaned) ??
    BY_KEY.get(cleaned.replace(/\s+/g, '-')) ??
    BY_NAME.get(cleaned.replace(/[-\s]+/g, ' '))
  )
}

const slug = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Canonical key for a card name. Cards the bundled dataset does not know yet
 * still get a stable key, so a deck never silently shrinks.
 */
export function keyForName(name: string): string | undefined {
  return findCard(name)?.key || slug(name) || undefined
}

export function combatOf(key: string): CardCombat {
  return (
    CARD_COMBAT[key] ?? { roles: ['dps'], air: false, fly: false, aoe: false, dps: 1 }
  )
}

export function iconUrl(key: string): string {
  return `/cards/${key}.png`
}

export function hasRole(key: string, role: CardRole): boolean {
  return combatOf(key).roles.includes(role)
}

export function resolveDeck(keys: string[]): RawCard[] {
  return keys.map((key) => getCard(key)).filter((card): card is RawCard => Boolean(card))
}

export function cardLabel(key: string): string {
  return getCard(key)?.name ?? key
}

export const RARITY_COLORS: Record<RawCard['rarity'], string> = {
  Common: 'text-sky-300',
  Rare: 'text-orange-300',
  Epic: 'text-fuchsia-300',
  Legendary: 'text-cyan-200',
  Champion: 'text-amber-200',
}
