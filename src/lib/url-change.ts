/**
 * The Next router moves the URL through `history.pushState`, which never fires
 * `hashchange`, while its query-only `replace` calls fire on every keystroke.
 * Wrapping the history methods yields one stream of URL moves, deduped on
 * `pathname + hash` so a `?q=` sync never re-triggers a hash deep-link.
 */

const URL_CHANGE_EVENT = 'royaleiq:url-change'

let installed = false
let lastKey = ''

function key(): string {
  if (typeof window === 'undefined') return ''
  return window.location.pathname + window.location.hash
}

function emit(): void {
  if (typeof window === 'undefined') return
  const next = key()
  if (next === lastKey) return
  lastKey = next
  window.dispatchEvent(new Event(URL_CHANGE_EVENT))
}

function install(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  lastKey = key()

  const push = history.pushState.bind(history)
  const replace = history.replaceState.bind(history)
  history.pushState = (...args: Parameters<History['pushState']>) => {
    push(...args)
    emit()
  }
  history.replaceState = (...args: Parameters<History['replaceState']>) => {
    replace(...args)
    emit()
  }
  window.addEventListener('popstate', emit)
  window.addEventListener('hashchange', emit)
}

/** Fire a (deduped) URL-change check now — a safety net when the router did
 * not go through the patched history methods. */
export function emitUrlChange(): void {
  install()
  emit()
}

export function subscribeUrlChange(listener: () => void): () => void {
  install()
  const handler = () => listener()
  window.addEventListener(URL_CHANGE_EVENT, handler)
  return () => window.removeEventListener(URL_CHANGE_EVENT, handler)
}
