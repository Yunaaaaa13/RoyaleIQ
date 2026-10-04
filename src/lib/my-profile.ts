import { useSyncExternalStore } from 'react'

/**
 * The tag behind "My Profile": the user's own Clash Royale account, kept in
 * this browser. Distinct from Player Analysis, which is only ever a transient
 * `?tag=` lookup of someone else.
 */

const STORAGE_KEY = 'royaleiq:my-tag'
const CHANGE_EVENT = 'royaleiq:my-tag-changed'

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readMyTag(): string {
  const store = storage()
  if (!store) return ''
  try {
    return store.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function writeMyTag(tag: string): void {
  const store = storage()
  if (!store) return
  try {
    if (tag) store.setItem(STORAGE_KEY, tag)
    else store.removeItem(STORAGE_KEY)
  } catch {
    // A blocked storage quota just means the tag stays session-only.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
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

export function useMyTag(): string {
  return useSyncExternalStore(subscribe, readMyTag, () => '')
}
