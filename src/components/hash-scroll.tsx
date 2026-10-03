'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { emitUrlChange, subscribeUrlChange } from '@/lib/url-change'
import { isLikelyTag } from '@/lib/tags'

const RETRY_MS = 60
const RETRY_WINDOW_MS = 3000
/** Sticky header (56px) plus the mobile strip, kept clear of the target. */
const SCROLL_MARGIN = '6.5rem'

/**
 * Deep-link executor for `#hash` nav targets. Their anchors live inside
 * Suspense/client trees, so a single scroll at navigation time lands on
 * nothing — keep looking for the element for a couple of seconds instead.
 */
export function HashScroll() {
  const pathname = usePathname()

  useEffect(() => {
    let attempts = 0
    let timer: number | undefined

    function reset() {
      if (timer !== undefined) window.clearTimeout(timer)
      timer = undefined
      attempts = 0
    }

    function attempt(): void {
      const raw = window.location.hash.replace(/^#/, '')
      if (!raw) {
        reset()
        return
      }
      const id = decodeURIComponent(raw)
      // The player panel claims bare `#TAG` fragments as a tag, not a section.
      if (isLikelyTag(id)) {
        reset()
        return
      }
      const el = document.getElementById(id)
      if (el) {
        el.style.scrollMarginTop = SCROLL_MARGIN
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        if (id === 'profile') {
          el.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
        }
        reset()
        return
      }
      attempts += 1
      if (attempts * RETRY_MS <= RETRY_WINDOW_MS) {
        timer = window.setTimeout(attempt, RETRY_MS)
      } else {
        reset()
      }
    }

    const unsubscribe = subscribeUrlChange(attempt)
    emitUrlChange()
    attempt()

    return () => {
      unsubscribe()
      reset()
    }
  }, [])

  // Cross-page navigation is a URL change even if pushState went unseen.
  useEffect(() => {
    emitUrlChange()
  }, [pathname])

  return null
}
