import { useCallback, useEffect, useState } from 'react'
import type { MetaSnapshot } from './battle'

/**
 * One shared `/api/meta` reader for the client. The module-level cache means
 * Deck Recommendation, the catalog and the dashboards reuse a single request per
 * mount wave instead of re-fetching per component, and every consumer sees the
 * same snapshot while it is fresh.
 */

interface CacheEntry {
  data: MetaSnapshot
  at: number
}

const TTL_MS = 60_000

let cache: CacheEntry | null = null

const fresh = (): MetaSnapshot | null =>
  cache && Date.now() - cache.at < TTL_MS ? cache.data : null

export function primeMetaCache(data: MetaSnapshot) {
  cache = { data, at: Date.now() }
}

export interface MetaState {
  snapshot: MetaSnapshot | null
  loading: boolean
  error: boolean
  reload: () => void
}

export function useMetaSnapshot(): MetaState {
  const [snapshot, setSnapshot] = useState<MetaSnapshot | null>(() => fresh())
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(() =>
    fresh() ? 'ready' : 'loading',
  )

  useEffect(() => {
    if (snapshot) return
    let alive = true
    const controller = new AbortController()

    fetch('/api/meta', { cache: 'no-store', signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`meta ${response.status}`))))
      .then((data: MetaSnapshot) => {
        primeMetaCache(data)
        if (!alive) return
        setSnapshot(data)
        setStatus('ready')
      })
      .catch(() => {
        if (!alive) return
        setStatus('error')
      })

    return () => {
      alive = false
      controller.abort()
    }
  }, [snapshot])

  const reload = useCallback(() => {
    cache = null
    setSnapshot(null)
    setStatus('loading')
  }, [])

  return { snapshot, loading: status === 'loading', error: status === 'error', reload }
}
