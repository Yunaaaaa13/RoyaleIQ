import { diagnoseBattle, type BattleDiagnosis } from '@/lib/diagnosis'
import { hasApiToken } from '@/lib/cr-api'
import { fetchLiveBundle, persistPlayer, readBattles } from '@/lib/sync'
import { normalizeTag } from '@/lib/tags'
import { jsonResponse } from '@/lib/json'
import type { NormalizedBattle } from '@/lib/battle'

export const dynamic = 'force-dynamic'

export interface BattlesResponse {
  source: 'db' | 'live' | 'empty'
  requestedTag: string
  battles: (NormalizedBattle & { diagnosis: BattleDiagnosis })[]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tag = normalizeTag(searchParams.get('tag')?.trim() ?? '')
  if (!tag) {
    return Response.json({ error: 'A player tag is required.' }, { status: 400 })
  }

  // `t` narrows the response to one match. The battle route needs exactly that,
  // and diagnosing all thirty candidates to throw away twenty-nine cost ~125KB
  // per open - so a single-match request reads the whole recent window (an old
  // link must still resolve) and then keeps one row.
  const time = searchParams.get('t')?.trim() ?? ''
  const limit = time
    ? 30
    : Math.min(30, Math.max(1, Number(searchParams.get('limit')) || 20))

  let battles = await readBattles(tag, limit)
  let source: BattlesResponse['source'] = 'db'

  if (!battles.length && hasApiToken) {
    try {
      const bundle = await fetchLiveBundle(tag)
      await persistPlayer(tag, bundle.profile, bundle.battles)
      battles = bundle.battles.slice(0, limit)
      source = 'live'
    } catch {
      source = 'empty'
    }
  }

  const matches = time ? battles.filter((battle) => battle.time === time) : battles

  const payload: BattlesResponse = {
    source: battles.length ? source : 'empty',
    requestedTag: tag,
    battles: matches.map((battle) => ({
      // `raw` is dropped: the diagnosis engine consumes it server-side and the
      // full payload would multiply this response's size.
      ...battle,
      raw: undefined,
      diagnosis: diagnoseBattle(battle),
    })),
  }

  return jsonResponse(request, payload)
}
