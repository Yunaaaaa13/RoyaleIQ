import { useSyncExternalStore } from 'react'

export interface SavedDeck {
  /** The eight card keys joined by commas — also the `/decks/[id]` route id. */
  id: string
  label: string
  cards: string[]
  savedAt: string
}

const STORAGE_KEY = 'royaleiq:saved-decks'
/** Fired on every local write so subscribers in this tab refresh too. */
const CHANGE_EVENT = 'royaleiq:saved-decks-changed'
const LIMIT = 24

const EMPTY: SavedDeck[] = []

export function deckId(cards: string[]): string {
  return cards.join(',')
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isSavedDeck(entry: unknown): entry is SavedDeck {
  if (!entry || typeof entry !== 'object') return false
  const candidate = entry as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    Array.isArray(candidate.cards) &&
    candidate.cards.every((key) => typeof key === 'string') &&
    typeof candidate.savedAt === 'string'
  )
}

/**
 * Parsing has to hand back the same array until the stored string actually
 * moves — `useSyncExternalStore` treats a new reference as a new store.
 */
let rawCache: string | null = null
let parsedCache: SavedDeck[] = EMPTY

function parse(raw: string): SavedDeck[] {
  if (raw === rawCache) return parsedCache
  let next: SavedDeck[] = EMPTY
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) next = parsed.filter(isSavedDeck).slice(0, LIMIT)
  } catch {
    next = EMPTY
  }
  rawCache = raw
  parsedCache = next
  return next
}

export function readSavedDecks(): SavedDeck[] {
  const store = storage()
  if (!store) return EMPTY
  try {
    return parse(store.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return EMPTY
  }
}

function notify(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
}

function write(entries: SavedDeck[]): SavedDeck[] {
  const next = entries.slice(0, LIMIT)
  const store = storage()
  if (store) {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      return next
    }
  }
  notify()
  return next
}

/** Upsert by deck signature: saving the same eight cards refreshes its entry. */
export function saveDeck({ label, cards }: { label: string; cards: string[] }): SavedDeck[] {
  const id = deckId(cards)
  if (!id) return readSavedDecks()
  const entry: SavedDeck = {
    id,
    label,
    cards: [...cards],
    savedAt: new Date().toISOString(),
  }
  return write([entry, ...readSavedDecks().filter((deck) => deck.id !== id)])
}

export function removeSavedDeck(id: string): SavedDeck[] {
  return write(readSavedDecks().filter((deck) => deck.id !== id))
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CHANGE_EVENT, onStoreChange)
  window.addEventListener('storage', onStoreChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange)
    window.removeEventListener('storage', onStoreChange)
  }
}

export function useSavedDecks(): SavedDeck[] {
  return useSyncExternalStore(subscribe, readSavedDecks, () => EMPTY)
}
