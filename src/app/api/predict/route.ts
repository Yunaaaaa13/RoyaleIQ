import { getCard } from '@/lib/cards'
import { jsonResponse } from '@/lib/json'
import { predictMatchup, type Prediction } from '@/lib/predict'

export const dynamic = 'force-dynamic'

export type PredictResponse = Prediction

function parseDeck(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((key) => Boolean(getCard(key)))
    .slice(0, 8)
}

/**
 * `deck` and `vs` are comma-joined card keys, the same serialisation the
 * shareable Deck Lab links already use.
 *
 * A prediction that could not be made is a 200 with `status: 'too-small'`, not
 * an error: "not enough data yet" is a legitimate answer the UI has to render.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const deck = parseDeck(searchParams.get('deck'))
  const opponent = parseDeck(searchParams.get('vs'))

  if (deck.length < 4 || opponent.length < 4) {
    return jsonResponse(
      request,
      {
        status: 'unavailable',
        reason: 'Both `deck` and `vs` need at least four known card keys.',
      } satisfies Prediction,
      { status: 400 },
    )
  }

  const prediction: Prediction = await predictMatchup(deck, opponent)
  return jsonResponse(request, prediction)
}
