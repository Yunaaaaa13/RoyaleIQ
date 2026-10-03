import { gzipSync } from 'node:zlib'

/**
 * Next compresses rendered pages and static assets, but a route handler's body
 * is passed through untouched - `/api/meta` and friends were shipping ~30KB of
 * raw JSON to every reload. Re-encoding the buffer here and advertising it with
 * `content-encoding` lets the browser's built-in decoder do the rest, so the
 * caller still sees plain JSON from `response.json()`.
 */
export function jsonResponse(request: Request, payload: unknown, init: ResponseInit = {}) {
  const body = Buffer.from(JSON.stringify(payload))
  const acceptsGzip = /\bgzip\b/.test(request.headers.get('accept-encoding') ?? '')
  const bytes = acceptsGzip ? gzipSync(body) : body

  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('content-length', String(bytes.byteLength))
  headers.set('vary', 'accept-encoding')
  if (acceptsGzip) headers.set('content-encoding', 'gzip')

  return new Response(bytes, { ...init, headers })
}
