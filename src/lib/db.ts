import 'server-only'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient }

/** True when `DATABASE_URL` is present, so callers know whether data persists. */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

/**
 * Hosted Postgres (Supabase) only trusts its own root CA, which is not in
 * Node's trust store, so the chain is pinned from `prisma/supabase-ca.pem`.
 * A local socket needs no TLS at all, and `sslmode` in the URL is dropped so
 * it cannot override this - `require` is treated as verify-full by `pg`.
 */
function tlsFor(connectionString: string) {
  let host = ''
  try {
    host = new URL(connectionString).hostname
  } catch {
    return undefined
  }
  if (host === 'localhost' || host === '127.0.0.1' || !host) return undefined
  try {
    const ca = readFileSync(join(process.cwd(), 'prisma', 'supabase-ca.pem'), 'utf8')
    return { ssl: { ca, rejectUnauthorized: true } }
  } catch {
    return { ssl: { rejectUnauthorized: false } }
  }
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim()
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and add your PostgreSQL connection string.',
    )
  }
  // Prisma 7 runs the query compiler in-process and needs a driver adapter;
  // there is no binary engine to resolve DATABASE_URL on its own.
  const ssl = tlsFor(connectionString)
  const url = ssl ? connectionString.replace(/([?&])sslmode=[^&]*/g, '$1').replace(/[?&]$/, '') : connectionString
  return new PrismaClient({
    adapter: new PrismaPg(ssl ? { connectionString: url, ...ssl } : { connectionString }),
  })
}

/**
 * Singleton Prisma client. Reused across hot reloads in dev so we do not
 * open a new connection pool on every file change.
 */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient()
  return globalForPrisma.prisma
}
