export type CheckStatus = 'ok' | 'warn' | 'error' | 'off'

export interface StatusCheck {
  key: string
  label: string
  status: CheckStatus
  detail: string
}

export interface StatusResponse {
  checkedAt: string
  runtime: {
    node: string
    env: string
    uptimeSeconds: number
    timeZone: string
  }
  clashRoyaleApi: {
    status: CheckStatus
    tokenConfigured: boolean
    baseUrl: string
    egressIp: string | null
    egressIpError: string | null
    rateLimit: { limit: number; windowSeconds: number; used: number }
    cache: { memoryEntries: number; dbEntries: number }
  }
  database: {
    status: CheckStatus
    latencyMs: number | null
    error?: string
    counts: Record<string, number>
    battleRawCoverage: { total: number; withRaw: number } | null
  }
  sync: {
    playerTtlMinutes: number
    metaTtlMinutes: number
    players: {
      tag: string
      name: string
      trophies: number
      lastFetchedAt: string
      ageSeconds: number
      stale: boolean
      battles: number
      rawBattles: number
      lastBattleAt: string | null
    }[]
    meta: { capturedAt: string; ageSeconds: number; fresh: boolean; battles: number } | null
    coachSessions: number
  }
  checks: StatusCheck[]
}
