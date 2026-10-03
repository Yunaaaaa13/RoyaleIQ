import type { DeckAnalysis, Finding, SwapSuggestion } from './analysis'
import { archetypeLabel, detectArchetype } from './archetypes'
import { combatOf, getCard } from './cards'
import { ROLE_LABEL } from './card-meta'
import type { ArchetypeRecord } from './player'

export interface CoachDiagnosis {
  title: string
  detail: string
  severity: 'critical' | 'warning' | 'good'
}

export interface CoachChange {
  from: string
  to: string
  reason: string
}

export interface CoachResponse {
  summary: string
  diagnosis: CoachDiagnosis[]
  changes: CoachChange[]
  tips: string[]
}

/** The player's own stored results - observed, never modelled. */
export interface CoachRecordContext {
  tag: string
  name: string
  trophies: number
  battles: number
  winRate: number
  streak: number
  /** Last ten results, newest first, as W/L/D. */
  form: string
  byOpponent: ArchetypeRecord[]
  byArchetype: ArchetypeRecord[]
  bestMatchup?: ArchetypeRecord
  worstMatchup?: ArchetypeRecord
}

/** A stored meta aggregate - what the rest of the ladder is actually playing. */
export interface CoachMetaContext {
  generatedAt: string
  battles: number
  archetypes: { label: string; share: number; winRate: number }[]
  topCards: { name: string; usage: number; winRate: number }[]
}

export interface CoachContext {
  analysis: DeckAnalysis
  question?: string
  matchup?: { cards: string[]; label: string }
  record?: CoachRecordContext
  meta?: CoachMetaContext
}

const severityText: Record<Finding['severity'], string> = {
  critical: 'critical problem',
  warning: 'warning',
  good: 'strength',
}

function cardLine(key: string): string {
  const card = getCard(key)
  const meta = combatOf(key)
  const roles = meta.roles
    .slice(0, 3)
    .map((role) => ROLE_LABEL[role])
    .join(', ')
  return `${card?.name ?? key} (${card?.elixir ?? '?'} elixir, ${roles})`
}

const pct = (value: number) => `${Math.round(value * 10) / 10}%`

function recordBlock(record: CoachRecordContext): string {
  const lines = [
    `Player ${record.tag} (${record.name}), ${record.trophies} trophies.`,
    `${record.battles} stored battles, ${pct(record.winRate)} win rate, current streak ${record.streak}.`,
    `Recent form, newest first: ${record.form || 'n/a'}.`,
    '',
    'Your win rate when piloting each archetype:',
    ...record.byArchetype.map(
      (row) => `- ${row.label}: ${pct(row.winRate)} over ${row.battles} game(s)`,
    ),
    '',
    'Your win rate against each archetype (real results - prefer this over the projection above):',
    ...record.byOpponent.map(
      (row) => `- ${row.label}: ${pct(row.winRate)} over ${row.battles} game(s)`,
    ),
  ]
  if (record.bestMatchup && record.bestMatchup.battles >= 3)
    lines.push('', `Best matchup on record: ${record.bestMatchup.label} at ${pct(record.bestMatchup.winRate)} over ${record.bestMatchup.battles} game(s).`)
  if (record.worstMatchup && record.worstMatchup.battles >= 3)
    lines.push(`Lowest win rate on record: ${record.worstMatchup.label} at ${pct(record.worstMatchup.winRate)} over ${record.worstMatchup.battles} game(s).`)
  return lines.join('\n')
}

function metaBlock(meta: CoachMetaContext): string {
  return [
    `Sampled from ${meta.battles} ladder battles, generated ${meta.generatedAt}.`,
    'Archetypes currently on the ladder:',
    ...meta.archetypes.map(
      (row) => `- ${row.label}: ${row.share}% of battles, ${pct(row.winRate)} win rate`,
    ),
    'Cards performing best right now:',
    ...meta.topCards.map(
      (row) => `- ${row.name}: ${row.usage}% usage, ${pct(row.winRate)} win rate`,
    ),
  ].join('\n')
}

export function buildCoachPrompt(context: CoachContext): string {
  const { analysis, question, matchup, record, meta } = context
  const deck = analysis.cards
    .map((key, index) => `${index + 1}. ${cardLine(key)}`)
    .join('\n')

  const findings = analysis.findings
    .map(
      (finding) =>
        `- [${severityText[finding.severity]}] ${finding.title}: ${finding.detail}`,
    )
    .join('\n')

  const swaps = analysis.swaps
    .map(
      (swap) =>
        `- Replace ${getCard(swap.from)?.name ?? swap.from} with ${getCard(swap.to)?.name ?? swap.to} because ${swap.reason} Gains: ${swap.gains.join('; ')}. Tradeoffs: ${swap.tradeoffs.join('; ')}.`,
    )
    .join('\n')

  const matchups = analysis.matchups
    .slice(0, 5)
    .map((line) => `- ${line.label}: ${line.score}% (${line.verdict})`)
    .join('\n')

  const matchupBlock = matchup
    ? `\nOpponent deck:\n${matchup.cards
        .map((key, index) => `${index + 1}. ${cardLine(key)}`)
        .join('\n')}\n`
    : ''

  return `You are RoyaleIQ, a Clash Royale deck coach. You explain WHY, never just what.

PLAYER DECK (${analysis.archetypeLabel}, avg elixir ${analysis.avgElixir}):
${deck}
${matchupBlock}
SCORES (0-10): offense ${analysis.scores.offense}, defence ${analysis.scores.defense}, air defence ${analysis.scores.airDefense}, cycle ${analysis.scores.cycle}, spell utility ${analysis.scores.spellUtility}. Overall ${analysis.scores.overall}.

STRUCTURAL FINDINGS:
${findings || '- none'}

CANDIDATE CHANGES:
${swaps || '- none'}

MATCHUP PROJECTION (model prior, not observed):
${matchups}
${record ? `\nOBSERVED RECORD (actual games this player played):\n${recordBlock(record)}\n` : ''}${meta ? `\nCURRENT META:\n${metaBlock(meta)}\n` : ''}
${question ? `PLAYER QUESTION: ${question}\n` : ''}
GROUNDING RULES:
- Quote the numbers above exactly. Never invent win rates, usage shares, trophy counts or game counts.
- When the OBSERVED RECORD disagrees with the MATCHUP PROJECTION, trust the record and say that you are trusting it.
- If a section above is absent, do not invent it: reason from the deck structure only.
- Where the CURRENT META shows an archetype is everywhere, weigh the matchup against it more heavily.

Return strict JSON with this shape:
{
  "summary": "2-3 sentences explaining the deck's identity and its core problem",
  "diagnosis": [{"title": "short label", "detail": "one or two sentences of reasoning", "severity": "critical"|"warning"|"good"}],
  "changes": [{"from": "card name", "to": "card name", "reason": "concrete reason tied to the deck"}],
  "tips": ["actionable in-match tip"]
}
Give 2-4 diagnosis entries, 0-3 changes (only if genuinely justified), and 3-5 tips. Be specific about elixir, rotations and matchups. Never invent cards that are not in Clash Royale.`
}

export function ruleBasedCoach(context: CoachContext): CoachResponse {
  const { analysis, question, matchup, record } = context
  const strengths = analysis.findings.filter((entry) => entry.severity === 'good')
  const problems = analysis.findings.filter(
    (entry) => entry.severity !== 'good',
  )

  const summaryParts = [
    `This is a ${analysis.archetypeLabel} list at ${analysis.avgElixir} average elixir with an overall structural score of ${analysis.scores.overall}/10.`,
  ]
  if (strengths.length)
    summaryParts.push(
      `Its real strength is ${strengths[0].title.toLowerCase()} - ${strengths[0].detail}`,
    )
  if (problems.length)
    summaryParts.push(
      `The issue to fix first is ${problems[0].title.toLowerCase()}.`,
    )
  if (matchup) {
    // Look the opponent up by archetype, not by `matchup.label` - that label is
    // always the fixed string "Opponent deck" and never appears in the matrix.
    const opponent = detectArchetype(matchup.cards).proxy.key
    const line = analysis.matchups.find((entry) => entry.key === opponent)
    summaryParts.push(
      `Against ${line?.label ?? archetypeLabel(opponent)} the projected edge is ${line?.score ?? 50}%.`,
    )
  }
  if (record) {
    summaryParts.push(
      `Your own record is ${pct(record.winRate)} over ${record.battles} stored battles.`,
    )
    if (record.worstMatchup && record.worstMatchup.battles >= 3)
      summaryParts.push(
        `${record.worstMatchup.label} is your lowest-win-rate matchup at ${pct(record.worstMatchup.winRate)} over ${record.worstMatchup.battles} game(s).`,
      )
  }
  if (question) summaryParts.push(`Regarding your question: ${question}`)

  const diagnosis: CoachDiagnosis[] = analysis.findings
    .filter((finding) => finding.code !== 'incomplete')
    .slice(0, 5)
    .map((finding) => ({
      title: finding.title,
      detail: finding.detail,
      severity: finding.severity,
    }))

  const changes: CoachChange[] = analysis.swaps.map((swap: SwapSuggestion) => ({
    from: getCard(swap.from)?.name ?? swap.from,
    to: getCard(swap.to)?.name ?? swap.to,
    reason: `${swap.reason} ${swap.gains.join('. ')}.`,
  }))

  const tips: string[] = []
  const comp = analysis.composition
  if (comp.winConditions.length)
    tips.push(
      `Do not play ${getCard(comp.winConditions[0])?.name} until you know their answer to it is out of hand.`,
    )
  if (analysis.scores.cycle < 6)
    tips.push(
      'Bank elixir at the start of double elixir rather than forcing a push - your curve is too heavy to spam.',
    )
  else
    tips.push(
      'Use your cheap cards to rotate, but only after you have seen which counter they keep in hand.',
    )
  if (analysis.scores.airDefense < 6)
    tips.push(
      'Hold your air answer for their main air threat; spending it on the first Miner costs you the tower.',
    )
  if (comp.bigSpells.length)
    tips.push(
      `Save ${getCard(comp.bigSpells[0])?.name} for the finish rather than trading it early for a support troop.`,
    )
  if (analysis.matchups.length && analysis.matchups[analysis.matchups.length - 1])
    tips.push(
      `Respect ${analysis.matchups[analysis.matchups.length - 1].label} - it is your worst projected matchup at ${analysis.matchups[analysis.matchups.length - 1].score}%.`,
    )
  if (record?.worstMatchup && record.worstMatchup.battles >= 3)
    tips.push(
      `${record.worstMatchup.label} is where you win least often (${pct(record.worstMatchup.winRate)} over ${record.worstMatchup.battles} games) - expect it and keep your answer to its win condition in hand.`,
    )
  tips.push(
    'Track their counter to your win condition: once it is played and denied, your next push is the one that connects.',
  )

  return {
    summary: summaryParts.join(' '),
    diagnosis,
    changes,
    tips: tips.slice(0, 5),
  }
}
