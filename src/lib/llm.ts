import 'server-only'
import {
  buildCoachPrompt,
  ruleBasedCoach,
  type CoachContext,
  type CoachResponse,
} from './coach'
import { fetchWithRetry } from './http'

const BASE_URL = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
const API_KEY = process.env.OPENAI_API_KEY
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
/** The model the coach would call; exposed so sessions can record it. */
export const llmModel = MODEL

export const llmConfigured = Boolean(API_KEY && API_KEY.trim())

interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

function sanitize(raw: unknown): CoachResponse | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  if (typeof value.summary !== 'string') return null

  const asArray = <T>(input: unknown): T[] =>
    Array.isArray(input) ? (input as T[]) : []

  const fallback: null = null
  const diagnosis = asArray<Record<string, unknown>>(value.diagnosis)
    .filter((entry) => typeof entry?.title === 'string' && typeof entry?.detail === 'string')
    .map((entry) => ({
      title: String(entry.title),
      detail: String(entry.detail),
      severity:
        entry.severity === 'critical' || entry.severity === 'good'
          ? entry.severity
          : 'warning',
    })) as CoachResponse['diagnosis']

  const changes = asArray<Record<string, unknown>>(value.changes)
    .filter((entry) => typeof entry?.from === 'string' && typeof entry?.to === 'string')
    .map((entry) => ({
      from: String(entry.from),
      to: String(entry.to),
      reason: typeof entry.reason === 'string' ? entry.reason : '',
    }))

  const tips = asArray<unknown>(value.tips)
    .filter((tip): tip is string => typeof tip === 'string')
    .slice(0, 6)

  if (!diagnosis.length && !changes.length && !tips.length) return fallback

  return { summary: value.summary, diagnosis, changes, tips }
}

function extractJson(content: string): unknown {
  const cleaned = content.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

export async function runCoach(
  context: CoachContext,
): Promise<{ provider: 'llm' | 'rules'; response: CoachResponse }> {
  const rules = ruleBasedCoach(context)
  if (!llmConfigured) return { provider: 'rules', response: rules }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are RoyaleIQ, an expert Clash Royale deck analyst. You are concise, concrete and always explain the reasoning behind a change. Answer in the same language the player asks in (Indonesian or English). The user message contains observed statistics from real games - quote those numbers exactly, never invent win rates, usage shares or game counts, and when the observed record contradicts your prior, the record wins.',
    },
    { role: 'user', content: buildCoachPrompt(context) },
  ]

  try {
    const response = await fetchWithRetry(
      `${BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.4,
          response_format: { type: 'json_object' },
        }),
        cache: 'no-store',
      },
      { attempts: 3, timeoutMs: 30_000 },
    )

    if (!response.ok) throw new Error(`LLM responded with ${response.status}`)
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = payload.choices?.[0]?.message?.content ?? ''
    const parsed = sanitize(extractJson(content))
    if (!parsed) return { provider: 'rules', response: rules }
    return {
      provider: 'llm',
      response: {
        summary: parsed.summary,
        diagnosis: parsed.diagnosis.length ? parsed.diagnosis : rules.diagnosis,
        changes: parsed.changes,
        tips: parsed.tips.length ? parsed.tips : rules.tips,
      },
    }
  } catch {
    return { provider: 'rules', response: rules }
  }
}
