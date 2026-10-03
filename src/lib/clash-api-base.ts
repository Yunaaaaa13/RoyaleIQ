const DEFAULT_BASE = 'https://api.clashroyale.com/v1'

/**
 * Clash Royale endpoints are always versioned (`/v1/players/...`), and the
 * documented base URLs carry that suffix. A base that stops at the host - which
 * is how the RoyaleAPI proxy is usually written down - sends every request to an
 * unversioned path, the proxy answers 404 with an empty body, and the app can
 * only report that as "player not found". Normalising the suffix here means a
 * missing `/v1` can never masquerade as a missing player.
 */
export function resolveClashApiBase(raw?: string): string {
  const base = (raw ?? DEFAULT_BASE).trim().replace(/\/+$/, '')
  return /\/v\d+$/i.test(base) ? base : `${base}/v1`
}

export const CLASH_API_BASE = resolveClashApiBase(process.env.CLASH_ROYALE_API_BASE)
