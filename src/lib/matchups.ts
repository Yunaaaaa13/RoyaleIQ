import { matchupMatrix } from './archetypes'

export type MatchupOutcome = 'win' | 'loss' | 'draw'

/** One stored battle reduced to the two facts the matrix needs. */
export interface MatchupSample {
  result: MatchupOutcome
  /** Archetype of the deck on the `team` side of the battle. */
  team: string | null | undefined
  /** Archetype of the deck on the `opponent` side. */
  opponent: string | null | undefined
  /**
   * Unordered identity of the physical game - both participants plus the
   * timestamp. Only read when the grid is mirrored, so a battle that both
   * players happened to store is still counted once.
   */
  gameKey?: string
}

export interface BuildOptions {
  minGames?: number
  /**
   * Count every battle from both sides. The battle log only hands us one
   * perspective per stored player, so folding the opponent's side back in is
   * what turns a lopsided sample into a real archetype-versus-archetype grid.
   */
  mirror?: boolean
}

export interface MatchupCell {
  from: string
  to: string
  games: number
  wins: number
  losses: number
  draws: number
  /** 0-100. Draws count as half a win. */
  winRate: number
  /** Baseline win rate the archetype model projects for this pairing. */
  projected: number | null
}

export interface MatchupGrid {
  rows: string[]
  cols: string[]
  cells: MatchupCell[]
  /** Battles behind each row / column, so headers can show their sample size. */
  rowTotals: Record<string, number>
  colTotals: Record<string, number>
  /** Battles that actually contributed a cell. */
  battles: number
}

const UNKNOWN = 'hybrid'

const rate = (wins: number, draws: number, games: number) =>
  games ? Math.round(((wins + draws * 0.5) / games) * 1000) / 10 : 0

/**
 * Folds a list of battles into an archetype x archetype grid.
 *
 * Only observed battles are counted - nothing here is simulated - so every
 * cell carries its own sample size. Rows and columns are ordered by how much
 * data they have, which keeps the populated corner of the matrix top-left.
 */
export function buildMatchupGrid(
  samples: MatchupSample[],
  options: BuildOptions = {},
): MatchupGrid {
  const { minGames = 1, mirror = false } = options
  const cells = new Map<string, MatchupCell>()
  const rowTotals = new Map<string, number>()
  const colTotals = new Map<string, number>()

  const entries: { result: MatchupOutcome; from: string; to: string }[] = []
  const seen = new Set<string>()
  let accepted = 0

  for (const sample of samples) {
    if (sample.gameKey) {
      if (seen.has(sample.gameKey)) continue
      seen.add(sample.gameKey)
    }
    accepted += 1

    const team = sample.team?.trim() || UNKNOWN
    const opponent = sample.opponent?.trim() || UNKNOWN
    entries.push({ result: sample.result, from: team, to: opponent })
    if (mirror) {
      entries.push({
        result: sample.result === 'win' ? 'loss' : sample.result === 'loss' ? 'win' : 'draw',
        from: opponent,
        to: team,
      })
    }
  }

  for (const entry of entries) {
    const { result, from, to } = entry
    const key = `${from}\u0000${to}`
    let cell = cells.get(key)
    if (!cell) {
      cell = {
        from,
        to,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        projected: projectedRate(from, to),
      }
      cells.set(key, cell)
    }
    cell.games += 1
    if (result === 'win') cell.wins += 1
    else if (result === 'loss') cell.losses += 1
    else cell.draws += 1

    rowTotals.set(from, (rowTotals.get(from) ?? 0) + 1)
    colTotals.set(to, (colTotals.get(to) ?? 0) + 1)
  }

  for (const cell of cells.values()) {
    cell.winRate = rate(cell.wins, cell.draws, cell.games)
  }

  const rank = (totals: Map<string, number>) =>
    [...totals.entries()]
      .filter(([, total]) => total >= minGames)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key)

  const rows = rank(rowTotals)
  const cols = rank(colTotals)
  const kept = new Set([...rows, ...cols])
  const pick = (keys: string[], totals: Map<string, number>) =>
    Object.fromEntries(keys.map((key) => [key, totals.get(key) ?? 0]))

  return {
    rows,
    cols,
    cells: [...cells.values()].filter((cell) => kept.has(cell.from) && kept.has(cell.to)),
    rowTotals: pick(rows, rowTotals),
    colTotals: pick(cols, colTotals),
    battles: accepted,
  }
}

/**
 * The model's prior for a pairing. Read straight from the same baseline the
 * Deck Lab and the battle diagnosis use, so the grid can show what was
 * expected next to what was actually recorded. Off-meta decks and mirrors have
 * no prior of their own, so they fall back to the neutral 50.
 */
export function projectedRate(from: string, to: string): number | null {
  if (from === 'hybrid' || to === 'hybrid' || from === to) return 50
  const line = matchupMatrix(from, []).find((entry) => entry.key === to)
  return line ? line.score : 50
}

export interface MatchupEdge extends MatchupCell {
  fromLabel: string
  toLabel: string
}

export interface MatchupsResponse {
  scope: 'global' | 'player'
  requestedTag: string
  /** Battle types actually present in the sample, for the mode filter. */
  modes: string[]
  mode: string
  minGames: number
  battles: number
  rows: string[]
  cols: string[]
  /** Archetype key -> display label, covering both axes. */
  labels: Record<string, string>
  rowTotals: Record<string, number>
  colTotals: Record<string, number>
  cells: MatchupCell[]
  best: MatchupEdge[]
  worst: MatchupEdge[]
  notice?: string
}

/** Pairings that have at least `minGames` behind them, split by who came out ahead. */
export function edgeLists(
  grid: MatchupGrid,
  minGames: number,
  label: (key: string) => string,
  take = 4,
): { best: MatchupEdge[]; worst: MatchupEdge[] } {
  const withLabels = (cell: MatchupCell): MatchupEdge => ({
    ...cell,
    fromLabel: label(cell.from),
    toLabel: label(cell.to),
  })

  const enough = grid.cells.filter((cell) => cell.games >= minGames)

  return {
    best: enough
      .filter((cell) => cell.winRate > 50)
      .sort((a, b) => b.winRate - a.winRate || b.games - a.games)
      .slice(0, take)
      .map(withLabels),
    worst: enough
      .filter((cell) => cell.winRate < 50)
      .sort((a, b) => a.winRate - b.winRate || b.games - a.games)
      .slice(0, take)
      .map(withLabels),
  }
}
