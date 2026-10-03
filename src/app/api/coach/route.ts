import { analyzeDeck, compareDecks } from '@/lib/analysis'
import { findCard } from '@/lib/cards'
import type { CoachMetaContext, CoachRecordContext } from '@/lib/coach'
import { jsonResponse } from '@/lib/json'
import { runCoach, llmConfigured, llmModel } from '@/lib/llm'
import { normalizeTag } from '@/lib/tags'
import { readLatestMetaSnapshot, readPlayer, recordCoachSession } from '@/lib/sync'

export const dynamic = 'force-dynamic'

interface CoachBody {
  cards?: unknown
  question?: unknown
  matchup?: unknown
  tag?: unknown
}

const toKeys = (input: unknown): string[] =>
  Array.isArray(input)
    ? input
        .map((entry) =>
          typeof entry === 'string'
            ? entry
            : typeof entry === 'object' && entry && 'key' in entry
              ? String((entry as { key: unknown }).key)
              : '',
        )
        .map((key) => findCard(key)?.key ?? key)
        .filter((key) => Boolean(findCard(key)))
        .slice(0, 8)
    : []

const RESULT_LETTER: Record<string, string> = { win: 'W', loss: 'L', draw: 'D' }

/**
 * The player's stored results, read straight from PostgreSQL. Deliberately
 * DB-only: asking the coach a question must never burn Clash Royale rate limit.
 */
async function readRecord(tag: string): Promise<CoachRecordContext | null> {
  const bundle = await readPlayer(tag)
  if (!bundle) return null
  const { stats, profile } = bundle
  return {
    tag,
    name: profile.name,
    trophies: profile.trophies,
    battles: stats.battles,
    winRate: stats.winRate,
    streak: stats.currentStreak,
    form: stats.recent
      .slice(0, 10)
      .map((battle) => RESULT_LETTER[battle.result] ?? '?')
      .join(''),
    byOpponent: stats.byOpponent,
    byArchetype: stats.byArchetype,
    bestMatchup: stats.bestMatchup,
    worstMatchup: stats.worstMatchup,
  }
}

/** The most recent stored meta aggregate, also DB-only. */
async function readMetaContext(): Promise<CoachMetaContext | null> {
  const snapshot = await readLatestMetaSnapshot(Number.MAX_SAFE_INTEGER)
  if (!snapshot) return null
  return {
    generatedAt: snapshot.generatedAt,
    battles: snapshot.battles,
    archetypes: snapshot.archetypes.slice(0, 6).map((row) => ({
      label: row.label,
      share: row.share,
      winRate: row.winRate,
    })),
    topCards: snapshot.topWinRate.slice(0, 6).map((row) => ({
      name: row.name,
      usage: row.usage,
      winRate: row.winRate,
    })),
  }
}

export async function POST(request: Request) {
  let body: CoachBody
  try {
    body = (await request.json()) as CoachBody
  } catch {
    return jsonResponse(request, { error: 'Invalid JSON body.' }, { status: 400 })
  }

  const cards = toKeys(body.cards)
  if (cards.length < 4) {
    return jsonResponse(
      request,
      { error: 'Pick at least 4 cards before asking the coach.' },
      { status: 400 },
    )
  }

  const analysis = analyzeDeck(cards)
  const matchupCards = toKeys(body.matchup)
  const question =
    typeof body.question === 'string' && body.question.trim()
      ? body.question.trim().slice(0, 600)
      : undefined
  const tag = typeof body.tag === 'string' ? normalizeTag(body.tag) : ''

  const matchup =
    matchupCards.length >= 4
      ? { cards: matchupCards, label: 'Opponent deck' }
      : undefined

  const [record, meta] = await Promise.all([
    tag ? readRecord(tag) : Promise.resolve(null),
    readMetaContext(),
  ])

  const { provider, response } = await runCoach({
    analysis,
    question,
    matchup,
    record: record ?? undefined,
    meta: meta ?? undefined,
  })

  const headToHead =
    matchupCards.length >= 4 ? compareDecks(cards, matchupCards) : undefined

  await recordCoachSession({
    playerTag: record?.tag ?? null,
    deck: cards,
    question,
    provider,
    model: provider === 'llm' ? llmModel : null,
    answer: response,
  })

  return jsonResponse(request, {
    provider,
    llmConfigured,
    analysis,
    coach: response,
    headToHead,
    grounding: {
      record: record
        ? { tag: record.tag, name: record.name, battles: record.battles, winRate: record.winRate }
        : null,
      metaBattles: meta?.battles ?? null,
      metaGeneratedAt: meta?.generatedAt ?? null,
      note: record
        ? 'Advice is grounded in your stored battles.'
        : 'Add your player tag to ground advice in your own results.',
    },
  })
}
