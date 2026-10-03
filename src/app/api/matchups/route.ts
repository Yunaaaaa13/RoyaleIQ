import { isDbConfigured, getPrisma } from '@/lib/db'
import { archetypeLabel } from '@/lib/archetypes'
import {
  buildMatchupGrid,
  edgeLists,
  type MatchupsResponse,
} from '@/lib/matchups'
import { normalizeTag } from '@/lib/tags'
import { jsonResponse } from '@/lib/json'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tag = normalizeTag(searchParams.get('tag')?.trim() ?? '')
  const scope: MatchupsResponse['scope'] =
    searchParams.get('scope') === 'player' ? 'player' : 'global'
  const mode = (searchParams.get('mode')?.trim() || 'all').slice(0, 40)

  if (scope === 'player' && !tag) {
    return Response.json(
      { error: 'A player tag is required for your own matchups.' },
      { status: 400 },
    )
  }
  if (!isDbConfigured()) {
    return jsonResponse(request, {
      scope,
      requestedTag: tag,
      modes: [],
      mode,
      minGames: 1,
      battles: 0,
      rows: [],
      cols: [],
      labels: {},
      rowTotals: {},
      colTotals: {},
      cells: [],
      best: [],
      worst: [],
      notice:
        'PostgreSQL is not configured, so there are no stored battles to build a matrix from.',
    } satisfies MatchupsResponse)
  }

  const prisma = getPrisma()

  const where = {
    ...(scope === 'player' ? { playerTag: tag } : {}),
    ...(mode !== 'all' ? { type: mode } : {}),
  }

  const [modes, battles] = await Promise.all([
    prisma.battle.groupBy({
      by: ['type'],
      where: scope === 'player' ? { playerTag: tag } : {},
      _count: { _all: true },
    }),
    prisma.battle.findMany({
      where,
      select: {
        battleTime: true,
        playerTag: true,
        opponentTag: true,
        result: true,
        decks: { select: { side: true, archetype: true } },
      },
    }),
  ])

  const grid = buildMatchupGrid(
    battles.map((battle) => ({
      result: battle.result,
      team: battle.decks.find((deck) => deck.side === 'team')?.archetype,
      opponent: battle.decks.find((deck) => deck.side === 'opponent')?.archetype,
      gameKey: `${battle.battleTime.getTime()}|${[battle.playerTag, battle.opponentTag ?? '?']
        .sort()
        .join('~')}`,
    })),
    // Only the global grid is folded: your own record stays strictly yours.
    { mirror: scope === 'global' },
  )

  const { best, worst } = edgeLists(grid, 3, archetypeLabel)

  const payload: MatchupsResponse = {
    scope,
    requestedTag: tag,
    modes: modes
      .sort((a, b) => b._count._all - a._count._all)
      .map((entry) => entry.type),
    mode,
    minGames: 1,
    battles: grid.battles,
    rows: grid.rows,
    cols: grid.cols,
    labels: Object.fromEntries(
      [...grid.rows, ...grid.cols].map((key) => [key, archetypeLabel(key)]),
    ),
    rowTotals: grid.rowTotals,
    colTotals: grid.colTotals,
    cells: grid.cells,
    best,
    worst,
    notice: grid.battles
      ? undefined
      : scope === 'player'
        ? `No stored battles for ${tag} yet - open the Player page once to sync them.`
        : 'No stored battles yet - open the Player page once to sync some.',
  }

  return jsonResponse(request, payload)
}
