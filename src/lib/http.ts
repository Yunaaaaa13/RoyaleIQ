/**
 * Small retrying fetch used by every outbound call (Clash Royale, OpenAI,
 * the IP lookup).
 *
 * Node occasionally fails the first connection after a process starts with a
 * bare `TypeError: fetch failed`, and any long-lived server will see socket
 * resets. Retrying with exponential backoff + jitter turns both into a normal
 * response instead of a failed request.
 */

/** Rate limits and transient server errors are worth retrying. */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

function intFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name])
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : fallback
}

const DEFAULT_ATTEMPTS = intFromEnv('HTTP_RETRY_ATTEMPTS', 4)
const DEFAULT_TIMEOUT_MS = intFromEnv('HTTP_TIMEOUT_MS', 15_000)
const BASE_DELAY_MS = 250
const MAX_DELAY_MS = 4_000

export interface RetryOptions {
  /** Total tries, first one included. Default `HTTP_RETRY_ATTEMPTS` (4). */
  attempts?: number
  /** Per-attempt socket timeout. Default `HTTP_TIMEOUT_MS` (15000). */
  timeoutMs?: number
  baseDelayMs?: number
  maxDelayMs?: number
}

/** Node hides the real reason behind `TypeError: fetch failed`. */
export function describeNetworkError(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown network error'
  const cause = (error as { cause?: unknown }).cause
  if (cause instanceof Error && cause.message) return `${error.message} (${cause.message})`
  return error.message
}

function backoffDelay(attempt: number, base: number, max: number): number {
  return Math.min(max, Math.round(base * 2 ** (attempt - 1) + Math.random() * base))
}

function retryAfterMs(response: Response, max: number): number | null {
  const header = response.headers.get('retry-after')
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(max, Math.round(seconds * 1000))
  const at = Date.parse(header)
  if (Number.isFinite(at)) return Math.min(max, Math.max(0, at - Date.now()))
  return null
}

function buildSignal(
  userSignal: AbortSignal | null | undefined,
  timeoutMs: number,
): AbortSignal | undefined {
  const timeout = timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined
  if (!timeout) return userSignal ?? undefined
  if (!userSignal) return timeout
  return AbortSignal.any([userSignal, timeout])
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * `fetch` with per-attempt timeouts and bounded retries.
 *
 * - Network failures (refused, reset, DNS, timeout) are retried.
 * - 408/429/5xx are retried, honouring `Retry-After` when it is short enough.
 * - Other 4xx are returned immediately: retrying a 403 or 404 never helps.
 *
 * When attempts are exhausted the last error is thrown; when a retryable HTTP
 * status is exhausted the final response is returned so the caller can build a
 * specific message.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: RetryOptions = {},
): Promise<Response> {
  const attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const base = options.baseDelayMs ?? BASE_DELAY_MS
  const maxDelay = options.maxDelayMs ?? MAX_DELAY_MS
  const userSignal = init.signal ?? null

  let lastError: unknown = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (userSignal?.aborted) throw lastError ?? new Error('Request was aborted.')

    let response: Response
    try {
      response = await fetch(url, {
        ...init,
        signal: buildSignal(userSignal, timeoutMs),
      })
    } catch (error) {
      lastError = error
      if (attempt >= attempts) break
      await pause(backoffDelay(attempt, base, maxDelay))
      continue
    }

    const retryable = RETRYABLE_STATUS.has(response.status)
    if (response.ok || !retryable || attempt >= attempts) return response

    const wait = retryAfterMs(response, maxDelay)
    // A long Retry-After means we would only burn attempts: surface the status.
    if (wait !== null && wait >= maxDelay) return response

    try {
      await response.arrayBuffer()
    } catch {
      // draining a body we are about to discard is best-effort
    }
    await pause(wait ?? backoffDelay(attempt, base, maxDelay))
  }

  throw new Error(
    `Request to ${url} failed after ${attempts} attempt${attempts === 1 ? '' : 's'}: ${describeNetworkError(lastError)}`,
  )
}
