import { buildCardMatchups, getMatchupIndex, type CardMatchupsResult } from '@/lib/card-matchups'
import { findCard } from '@/lib/cards'
import { jsonResponse } from '@/lib/json'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const card = findCard(decodeURIComponent(key))
  if (!card) {
    return jsonResponse(
      request,
      { available: false, reason: `Unknown card "${key}".` } satisfies CardMatchupsResult,
      { status: 404 },
    )
  }

  try {
    const index = await getMatchupIndex()
    return jsonResponse(request, buildCardMatchups(index, card))
  } catch (error) {
    const reason =
      error instanceof Error && error.message
        ? error.message
        : 'The matchup sample could not be read right now.'
    return jsonResponse(request, {
      available: false,
      reason,
      card: { key: card.key, name: card.name },
    } satisfies CardMatchupsResult)
  }
}
