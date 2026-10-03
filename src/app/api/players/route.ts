import { getPrisma, isDbConfigured } from '@/lib/db'
import { jsonResponse } from '@/lib/json'
import { isLikelyTag, normalizeTag } from '@/lib/tags'

export const dynamic = 'force-dynamic'

export interface TrackedPlayerRow {
  tag: string
  name: string
  trophies: number
  bestTrophies: number
  winRate: number | null
  battles: number
  arena: string | null
  clanName: string | null
  lastFetchedAt: string
}

interface PlayersBody {
  tag?: unknown
  action?: unknown
}

export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return jsonResponse(
      request,
      { error: 'Tracking a player needs a database. Set DATABASE_URL first.' },
      { status: 503 },
    )
  }

  try {
    const prisma = getPrisma()
    const rows = await prisma.player.findMany({
      where: { tracked: true },
      orderBy: { lastFetchedAt: 'asc' },
      select: {
        tag: true,
        name: true,
        trophies: true,
        bestTrophies: true,
        arena: true,
        clanName: true,
        lastFetchedAt: true,
      },
    })

    const tags = rows.map((row) => row.tag)
    const results = tags.length
      ? await prisma.battle.groupBy({
          by: ['playerTag', 'result'],
          where: { playerTag: { in: tags } },
          _count: { _all: true },
        })
      : []

    const perPlayer = new Map<string, { battles: number; wins: number }>()
    for (const row of results) {
      const bucket = perPlayer.get(row.playerTag) ?? { battles: 0, wins: 0 }
      bucket.battles += row._count._all
      if (row.result === 'win') bucket.wins += row._count._all
      perPlayer.set(row.playerTag, bucket)
    }

    const players: TrackedPlayerRow[] = rows.map((row) => {
      const record = perPlayer.get(row.tag)
      const battles = record?.battles ?? 0
      return {
        tag: row.tag,
        name: row.name,
        trophies: row.trophies,
        bestTrophies: row.bestTrophies,
        winRate: battles ? Math.round(((record?.wins ?? 0) / battles) * 1000) / 10 : null,
        battles,
        arena: row.arena,
        clanName: row.clanName,
        lastFetchedAt: row.lastFetchedAt.toISOString(),
      }
    })

    return jsonResponse(request, { players, total: players.length })
  } catch (error) {
    return jsonResponse(
      request,
      { error: error instanceof Error ? error.message : 'Could not read tracked players.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  let body: PlayersBody
  try {
    body = (await request.json()) as PlayersBody
  } catch {
    return jsonResponse(request, { error: 'Invalid JSON body.' }, { status: 400 })
  }

  const tag = normalizeTag(typeof body.tag === 'string' ? body.tag : '')
  if (!tag || !isLikelyTag(tag)) {
    return jsonResponse(request, { error: 'Enter a valid player tag.' }, { status: 400 })
  }

  const action = body.action
  if (action !== 'track' && action !== 'untrack') {
    return jsonResponse(
      request,
      { error: 'Action must be "track" or "untrack".' },
      { status: 400 },
    )
  }

  if (!isDbConfigured()) {
    return jsonResponse(
      request,
      { error: 'Tracking a player needs a database. Set DATABASE_URL first.' },
      { status: 503 },
    )
  }

  try {
    const prisma = getPrisma()
    const existing = await prisma.player.findUnique({
      where: { tag },
      select: { tag: true },
    })

    if (action === 'track' && !existing) {
      return jsonResponse(
        request,
        { error: `Load ${tag}'s profile once before tracking it.` },
        { status: 404 },
      )
    }

    if (existing) {
      await prisma.player.update({ where: { tag }, data: { tracked: action === 'track' } })
    }

    return jsonResponse(request, { tag, tracked: action === 'track' })
  } catch (error) {
    return jsonResponse(
      request,
      { error: error instanceof Error ? error.message : 'Could not update that player.' },
      { status: 500 },
    )
  }
}
