import 'server-only'

import { round1 } from './analysis'
import { matchupMatrix, detectArchetype } from './archetypes'
import { combatOf, getCard } from './cards'
import type { NormalizedBattle } from './battle'
import { fetchTrainingBattles } from './cr-api'
import { readAllStoredBattles } from './sync'

/**
 * Win prediction.
 *
 * A gradient-boosted tree ensemble trained in-process on battles the Clash
 * Royale API actually returned - no Python sidecar, no external service.
 *
 * Three rules the rest of the app depends on:
 *
 *  1. Below `MIN_DECIDED` decided battles the model refuses to answer and the
 *     caller falls back to the rules engine. A model trained on 40 games is
 *     worse than no model.
 *  2. Every number it reports is cross-validated. Training accuracy is never
 *     quoted as if it were predictive.
 *  3. Contributions come from exact Shapley values over the model's own
 *     coalition function, not from a heuristic. They add up to the prediction
 *     minus the baseline, and the units are stated.
 */

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

/**
 * Deck-construction features only. Card levels, elixir leaks and tower hit
 * points are deliberately excluded: they exist for just 32 of 75 stored
 * battles, and a model that only works on some rows would have to impute the
 * rest - which is a quieter way of inventing data.
 */
export interface FeatureDef {
  key: string
  label: string
}

export const FEATURES: FeatureDef[] = [
  { key: 'avg-elixir', label: 'Average elixir' },
  { key: 'cycle', label: 'Cycle of 4' },
  { key: 'air-supply', label: 'Air defence supply' },
  { key: 'air-threat', label: 'Flying threats faced' },
  { key: 'small-spells', label: 'Small spell cover' },
  { key: 'big-spells', label: 'Big spell cover' },
  { key: 'swarm', label: 'Swarm pressure' },
  { key: 'tank', label: 'Tank pressure' },
  { key: 'matchup-prior', label: 'Matchup prior' },
]

const elixirOf = (key: string): number => getCard(key)?.elixir ?? 4
const isSpell = (key: string): boolean => getCard(key)?.type?.toLowerCase() === 'spell'
const isFlyer = (key: string): boolean => combatOf(key).fly
const isAirTargeting = (key: string): boolean => combatOf(key).air

function cheapestCycle(deck: string[], size = 4): number {
  return round1(
    [...deck]
      .sort((a, b) => elixirOf(a) - elixirOf(b))
      .slice(0, size)
      .reduce((sum, key) => sum + elixirOf(key), 0),
  )
}

const meanElixir = (deck: string[]): number =>
  deck.length ? round1(deck.reduce((sum, key) => sum + elixirOf(key), 0) / deck.length) : 0

const count = (deck: string[], test: (key: string) => boolean): number =>
  deck.filter(test).length

export interface FeatureVector {
  /** Model input, same order as `FEATURES`. */
  values: number[]
  /** Human-readable reading of each value, same order. */
  texts: string[]
}

export function buildFeatures(our: string[], their: string[]): FeatureVector {
  const ourAvg = meanElixir(our)
  const theirAvg = meanElixir(their)
  const ourCycle = cheapestCycle(our)
  const theirCycle = cheapestCycle(their)
  const ourAir = count(our, isAirTargeting)
  const theirAir = count(their, isAirTargeting)
  const ourFliers = count(our, isFlyer)
  const theirFliers = count(their, isFlyer)
  const ourSmall = count(our, (k) => isSpell(k) && elixirOf(k) <= 3)
  const theirSmall = count(their, (k) => isSpell(k) && elixirOf(k) <= 3)
  const ourBig = count(our, (k) => isSpell(k) && elixirOf(k) >= 4)
  const theirBig = count(their, (k) => isSpell(k) && elixirOf(k) >= 4)
  const ourSwarm = count(our, (k) => !isSpell(k) && elixirOf(k) <= 3)
  const theirSwarm = count(their, (k) => !isSpell(k) && elixirOf(k) <= 3)
  const ourTank = count(our, (k) => !isSpell(k) && elixirOf(k) >= 5)
  const theirTank = count(their, (k) => !isSpell(k) && elixirOf(k) >= 5)

  const ourArch = detectArchetype(our).archetype.key
  const theirArch = detectArchetype(their).archetype.key
  const prior =
    matchupMatrix(ourArch, our).find((entry) => entry.key === theirArch)?.score ?? 50

  return {
    values: [
      round1(ourAvg - theirAvg),
      round1(ourCycle - theirCycle),
      ourAir - theirAir,
      theirFliers - ourFliers,
      ourSmall - theirSmall,
      ourBig - theirBig,
      theirSwarm - ourSwarm,
      theirTank - ourTank,
      round1((prior - 50) / 25),
    ],
    texts: [
      `${ourAvg} vs ${theirAvg} elixir on average`,
      `cycle of 4 costs ${ourCycle} vs ${theirCycle}`,
      `${ourAir} air-targeting card${ourAir === 1 ? '' : 's'} vs ${theirAir}`,
      `${theirFliers} flying threat${theirFliers === 1 ? '' : 's'} against your ${ourFliers}`,
      `${ourSmall} small spell${ourSmall === 1 ? '' : 's'} vs ${theirSmall}`,
      `${ourBig} big spell${ourBig === 1 ? '' : 's'} vs ${theirBig}`,
      `${theirSwarm} cheap troop${theirSwarm === 1 ? '' : 's'} vs your ${ourSwarm}`,
      `${theirTank} tank${theirTank === 1 ? '' : 's'} vs your ${ourTank}`,
      `${prior}% historical line for ${matchupLabel(ourArch, theirArch)}`,
    ],
  }
}

function matchupLabel(from: string, to: string): string {
  return `${shortName(from)} into ${shortName(to)}`
}

function shortName(key: string): string {
  return key
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

// ---------------------------------------------------------------------------
// Gradient-boosted trees
// ---------------------------------------------------------------------------

interface TreeNode {
  /** Splits on `values[feature] <= threshold`; leaves have neither. */
  feature?: number
  threshold?: number
  left?: TreeNode
  right?: TreeNode
  value: number
  /** Training rows that reached this node - the marginal weights for SHAP. */
  n: number
}

interface WinModel {
  base: number
  learningRate: number
  trees: TreeNode[]
  featureCount: number
}

// Tuned against the resubstitution-vs-cross-validated gap: 345 rows cannot
// support a deep forest, so the ensemble stays shallow and heavily shrunk
// rather than memorising the sample it was fitted on.
const MAX_DEPTH = 2
const TREE_COUNT = 30
const LEARNING_RATE = 0.06
const MIN_LEAF = 25
const MIN_GAIN = 1e-6

const sigmoid = (logit: number): number => 1 / (1 + Math.exp(-logit))
const logit = (p: number): number => Math.log(Math.max(1e-6, Math.min(1 - 1e-6, p)) / (1 - p))

interface Split {
  feature: number
  threshold: number
  gain: number
}

function bestSplit(
  rows: number[],
  x: number[][],
  gradient: number[],
  minLeaf: number,
): Split | null {
  const n = rows.length
  if (n < minLeaf * 2) return null

  let sumAll = 0
  let sumSqAll = 0
  for (const row of rows) {
    sumAll += gradient[row]
    sumSqAll += gradient[row] * gradient[row]
  }
  const parentSse = sumSqAll - (sumAll * sumAll) / n

  let best: Split | null = null
  const order = rows.slice()

  for (let feature = 0; feature < x[0].length; feature += 1) {
    order.sort((a, b) => x[a][feature] - x[b][feature])

    let nLeft = 0
    let sumLeft = 0
    let sumSqLeft = 0
    for (let k = 0; k < n - 1; k += 1) {
      const row = order[k]
      nLeft += 1
      sumLeft += gradient[row]
      sumSqLeft += gradient[row] * gradient[row]

      const nRight = n - nLeft
      if (nLeft < minLeaf) continue
      if (nRight < minLeaf) break
      const valueLeft = x[row][feature]
      const valueRight = x[order[k + 1]][feature]
      if (valueLeft === valueRight) continue

      const sseLeft = sumSqLeft - (sumLeft * sumLeft) / nLeft
      const sumRight = sumAll - sumLeft
      const sseRight = sumSqAll - sumSqLeft - (sumRight * sumRight) / nRight
      const gain = parentSse - sseLeft - sseRight
      if (gain > MIN_GAIN && (!best || gain > best.gain)) {
        best = { feature, threshold: (valueLeft + valueRight) / 2, gain }
      }
    }
  }
  return best
}

function buildTree(
  rows: number[],
  x: number[][],
  gradient: number[],
  depth: number,
): TreeNode {
  let sum = 0
  for (const row of rows) sum += gradient[row]
  const node: TreeNode = { value: sum / rows.length, n: rows.length }

  if (depth >= MAX_DEPTH) return node
  const split = bestSplit(rows, x, gradient, MIN_LEAF)
  if (!split) return node

  const leftRows: number[] = []
  const rightRows: number[] = []
  for (const row of rows) {
    if (x[row][split.feature] <= split.threshold) leftRows.push(row)
    else rightRows.push(row)
  }
  if (leftRows.length < MIN_LEAF || rightRows.length < MIN_LEAF) return node

  node.feature = split.feature
  node.threshold = split.threshold
  node.left = buildTree(leftRows, x, gradient, depth + 1)
  node.right = buildTree(rightRows, x, gradient, depth + 1)
  return node
}

function treeValue(node: TreeNode, row: number[]): number {
  let current = node
  while (current.feature !== undefined) {
    current = (row[current.feature] <= current.threshold!
      ? current.left!
      : current.right!)
  }
  return current.value
}

function fitModel(x: number[][], y: number[]): WinModel {
  const n = x.length
  const base = logit(y.reduce((sum, value) => sum + value, 0) / n)
  const raw = new Array<number>(n).fill(0)
  const rows = Array.from({ length: n }, (_, index) => index)
  const trees: TreeNode[] = []

  for (let iteration = 0; iteration < TREE_COUNT; iteration += 1) {
    const gradient = new Array<number>(n)
    for (let i = 0; i < n; i += 1) {
      gradient[i] = sigmoid(base + raw[i]) - y[i]
    }
    const tree = buildTree(rows, x, gradient, 0)
    trees.push(tree)
    for (let i = 0; i < n; i += 1) {
      raw[i] += LEARNING_RATE * treeValue(tree, x[i])
    }
  }

  return { base, learningRate: LEARNING_RATE, trees, featureCount: x[0]?.length ?? 0 }
}

function modelScore(model: WinModel, row: number[]): number {
  let score = model.base
  for (const tree of model.trees) score += model.learningRate * treeValue(tree, row)
  return score
}

/**
 * Expected model output given only the features in `mask`.
 *
 * A split whose feature is known is followed; a split whose feature is still
 * unknown is averaged over both branches, weighted by how many training rows
 * took each one. That is the standard path-dependent marginal and it is what
 * makes the coalition values below a genuine Shapley decomposition.
 */
function expectation(node: TreeNode, row: number[], mask: number): number {
  const feature = node.feature
  if (feature === undefined) return node.value
  if ((mask >> feature) & 1) {
    return expectation(row[feature] <= node.threshold! ? node.left! : node.right!, row, mask)
  }
  const left = node.left!
  const right = node.right!
  return (left.n * expectation(left, row, mask) + right.n * expectation(right, row, mask)) / node.n
}

// ---------------------------------------------------------------------------
// Exact Shapley values
// ---------------------------------------------------------------------------

const FACTORIAL: number[] = (() => {
  const values = [1]
  for (let i = 1; i <= 12; i += 1) values.push(values[i - 1] * i)
  return values
})()

export interface Contribution {
  feature: FeatureDef
  /** Change in win probability, in percentage points, versus the baseline. */
  points: number
  value: number
  text: string
}

export interface ShapExplanation {
  /** 0-100. */
  probability: number
  /** 0-100 - what the model says before seeing this matchup. */
  baseline: number
  contributions: Contribution[]
}

function shapFor(model: WinModel, row: number[], vector: FeatureVector): ShapExplanation {
  const m = model.featureCount
  const total = 1 << m
  const coalition = new Array<number>(total)

  for (let mask = 0; mask < total; mask += 1) {
    let score = model.base
    for (const tree of model.trees) {
      score += model.learningRate * expectation(tree, row, mask)
    }
    coalition[mask] = sigmoid(score)
  }

  const full = total - 1
  const baseline = coalition[0]
  const weight = (subsetSize: number): number =>
    (FACTORIAL[subsetSize] * FACTORIAL[m - subsetSize - 1]) / FACTORIAL[m]

  const contributions: Contribution[] = []
  for (let i = 0; i < m; i += 1) {
    const bit = 1 << i
    let phi = 0
    for (let mask = 0; mask < total; mask += 1) {
      if (mask & bit) continue
      const size = popcount(mask)
      const withFeature = coalition[mask | bit]
      phi += weight(size) * (withFeature - coalition[mask])
    }
    contributions.push({
      feature: FEATURES[i],
      points: round1(phi * 100),
      value: vector.values[i],
      text: vector.texts[i],
    })
  }

  return {
    probability: round1(coalition[full] * 100),
    baseline: round1(baseline * 100),
    contributions: contributions.sort((a, b) => Math.abs(b.points) - Math.abs(a.points)),
  }
}

function popcount(value: number): number {
  let count = 0
  let rest = value
  while (rest) {
    rest &= rest - 1
    count += 1
  }
  return count
}

// ---------------------------------------------------------------------------
// Training set
// ---------------------------------------------------------------------------

/** Refusing to answer needs a number the rest of the app can point at. */
export const MIN_DECIDED = 150

interface Sample {
  x: number[]
  y: number
}

function battleKeyOf(battle: NormalizedBattle): string {
  return `${battle.time}|${[...battle.deck].sort().join(',')}|${
    battle.opponentTag ?? battle.opponentName
  }`
}

async function collectBattles(): Promise<NormalizedBattle[]> {
  const [live, stored] = await Promise.all([
    fetchTrainingBattles().catch(() => [] as NormalizedBattle[]),
    readAllStoredBattles().catch(() => [] as NormalizedBattle[]),
  ])
  const seen = new Set<string>()
  const merged: NormalizedBattle[] = []
  for (const battle of [...stored, ...live]) {
    const key = battleKeyOf(battle)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(battle)
  }
  return merged
}

async function buildSamples(): Promise<Sample[]> {
  const battles = await collectBattles()
  const samples: Sample[] = []
  for (const battle of battles) {
    if (battle.result === 'draw') continue
    samples.push({
      x: buildFeatures(battle.deck, battle.opponentDeck).values,
      y: battle.result === 'win' ? 1 : 0,
    })
  }
  return samples
}

// ---------------------------------------------------------------------------
// Cross-validation
// ---------------------------------------------------------------------------

/** Deterministic so the reported metrics do not move between requests. */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const result = items.slice()
  let state = seed
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function auc(labels: number[], scores: number[]): number {
  const order = labels.map((label, index) => ({ label, score: scores[index] }))
  order.sort((a, b) => a.score - b.score)
  let rankSum = 0
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && order[j + 1].score === order[i].score) j += 1
    const averageRank = (i + j + 2) / 2
    for (let k = i; k <= j; k += 1) if (order[k].label === 1) rankSum += averageRank
    i = j + 1
  }
  const positives = labels.filter((label) => label === 1).length
  const negatives = labels.length - positives
  if (!positives || !negatives) return 0.5
  return (rankSum - (positives * (positives + 1)) / 2) / (positives * negatives)
}

interface ModelMetrics {
  folds: number
  accuracy: number
  /** What accuracy the same folds score without any model: always call the majority class. */
  baselineAccuracy: number
  logLoss: number
  /** Loss of predicting only the training-fold win rate - the hurdle a model has to clear. */
  baselineLogLoss: number
  auc: number
}

function crossValidate(samples: Sample[], folds = 5): ModelMetrics {
  const positives = seededShuffle(
    samples.map((sample, index) => (sample.y === 1 ? index : -1)).filter((index) => index >= 0),
    20260927,
  )
  const negatives = seededShuffle(
    samples.map((sample, index) => (sample.y === 0 ? index : -1)).filter((index) => index >= 0),
    731113,
  )
  // Stratified round-robin: every fold gets a slice of each class, so no
  // training split ever sees a single outcome and no held-out fold is empty.
  const foldCount = Math.max(
    2,
    Math.min(folds, positives.length, negatives.length),
  )
  const foldOf = new Array<number>(samples.length).fill(-1)
  positives.forEach((index, position) => {
    foldOf[index] = position % foldCount
  })
  negatives.forEach((index, position) => {
    foldOf[index] = position % foldCount
  })

  const predicted = new Array<number>(samples.length).fill(0)
  const baseRate = new Array<number>(samples.length).fill(0)
  const labels = samples.map((sample) => sample.y)
  const positiveRate = positives.length / samples.length

  for (let fold = 0; fold < foldCount; fold += 1) {
    const train: number[] = []
    const test: number[] = []
    for (let i = 0; i < samples.length; i += 1) {
      if (foldOf[i] === fold) test.push(i)
      else train.push(i)
    }
    if (!test.length || !train.length) continue
    // The baseline for a held-out row must only use that row's training split,
    // otherwise it would peek at the label it is being judged against.
    const foldRate =
      train.reduce((sum, index) => sum + samples[index].y, 0) / train.length
    const model = fitModel(
      train.map((index) => samples[index].x),
      train.map((index) => samples[index].y),
    )
    for (const index of test) {
      predicted[index] = sigmoid(modelScore(model, samples[index].x))
      baseRate[index] = foldRate
    }
  }

  let correct = 0
  let baseCorrect = 0
  let loss = 0
  let baseLoss = 0
  for (let i = 0; i < samples.length; i += 1) {
    const p = Math.max(1e-6, Math.min(1 - 1e-6, predicted[i] || positiveRate))
    const b = Math.max(1e-6, Math.min(1 - 1e-6, baseRate[i] || positiveRate))
    if ((p >= 0.5 ? 1 : 0) === labels[i]) correct += 1
    if ((b >= 0.5 ? 1 : 0) === labels[i]) baseCorrect += 1
    loss += -(labels[i] * Math.log(p) + (1 - labels[i]) * Math.log(1 - p))
    baseLoss += -(labels[i] * Math.log(b) + (1 - labels[i]) * Math.log(1 - b))
  }

  return {
    folds: foldCount,
    accuracy: Math.round((correct / samples.length) * 1000) / 10,
    baselineAccuracy: Math.round((baseCorrect / samples.length) * 1000) / 10,
    logLoss: Math.round((loss / samples.length) * 1000) / 1000,
    baselineLogLoss: Math.round((baseLoss / samples.length) * 1000) / 1000,
    auc: Math.round(auc(labels, predicted) * 1000) / 1000,
  }
}

// ---------------------------------------------------------------------------
// Cache + public entry points
// ---------------------------------------------------------------------------

const MODEL_TTL_MS = 10 * 60_000

interface TrainedBundle {
  model: WinModel
  metrics: ModelMetrics
  /** Accuracy on the rows the model was fitted on - the overfit check. */
  trainAccuracy: number
  decided: number
  wins: number
  expires: number
}

interface LoadResult {
  trained: TrainedBundle | null
  /** Decided battles the last training pass could see. */
  available: number
}

let bundle: TrainedBundle | null = null
let inFlight: Promise<LoadResult> | null = null

async function loadModel(): Promise<LoadResult> {
  if (bundle && bundle.expires > Date.now()) {
    return { trained: bundle, available: bundle.decided }
  }
  if (inFlight) return inFlight

  inFlight = (async () => {
    const samples = await buildSamples()
    if (samples.length < MIN_DECIDED) return { trained: null, available: samples.length }

    const metrics = crossValidate(samples)
    const model = fitModel(
      samples.map((sample) => sample.x),
      samples.map((sample) => sample.y),
    )
    let trainCorrect = 0
    for (const sample of samples) {
      if ((sigmoid(modelScore(model, sample.x)) >= 0.5 ? 1 : 0) === sample.y) trainCorrect += 1
    }
    const trained: TrainedBundle = {
      model,
      metrics,
      trainAccuracy: Math.round((trainCorrect / samples.length) * 1000) / 10,
      decided: samples.length,
      wins: samples.filter((sample) => sample.y === 1).length,
      expires: Date.now() + MODEL_TTL_MS,
    }
    bundle = trained
    return { trained, available: trained.decided }
  })().finally(() => {
    inFlight = null
  })

  return inFlight
}

export interface PredictionModelInfo {
  decidedBattles: number
  wins: number
  losses: number
  folds: number
  accuracy: number
  baselineAccuracy: number
  trainAccuracy: number
  logLoss: number
  baselineLogLoss: number
  auc: number
}

/**
 * The bar a fitted model has to clear before its numbers are shown as a
 * prediction. Cross-validated ranking has to be meaningfully better than a coin
 * flip and the log loss has to beat the win rate alone; below that the honest
 * answer is "this sample does not support a prediction".
 */
export const MIN_AUC = 0.55

export type Prediction =
  | {
      status: 'ok'
      model: PredictionModelInfo
      probability: number
      baseline: number
      contributions: Contribution[]
    }
  | { status: 'no-signal'; reason: string; model: PredictionModelInfo }
  | { status: 'too-small'; reason: string; available: number }
  | { status: 'unavailable'; reason: string }

export async function predictMatchup(our: string[], their: string[]): Promise<Prediction> {
  if (our.length < 4 || their.length < 4) {
    return { status: 'unavailable', reason: 'Both decks need at least four cards.' }
  }

  const { trained, available } = await loadModel()
  if (!trained) {
    return {
      status: 'too-small',
      available,
      reason: `The model needs at least ${MIN_DECIDED} decided battles and only ${available} are available. Falling back to the rules engine.`,
    }
  }

  const model: PredictionModelInfo = {
    decidedBattles: trained.decided,
    wins: trained.wins,
    losses: trained.decided - trained.wins,
    folds: trained.metrics.folds,
    accuracy: trained.metrics.accuracy,
    baselineAccuracy: trained.metrics.baselineAccuracy,
    trainAccuracy: trained.trainAccuracy,
    logLoss: trained.metrics.logLoss,
    baselineLogLoss: trained.metrics.baselineLogLoss,
    auc: trained.metrics.auc,
  }

  const { auc: aucValue, logLoss, baselineLogLoss, accuracy, baselineAccuracy } = trained.metrics
  if (aucValue < MIN_AUC || logLoss >= baselineLogLoss) {
    return {
      status: 'no-signal',
      model,
      reason: `Trained on ${trained.decided} decided battles, but held-out accuracy is ${accuracy}% against a ${baselineAccuracy}% win-rate baseline and ranking quality is ${aucValue.toFixed(3)} AUC (below ${MIN_AUC.toFixed(2)}). The sample does not support a win probability yet, so this falls back to the rules engine.`,
    }
  }

  const vector = buildFeatures(our, their)
  const explanation = shapFor(trained.model, vector.values, vector)

  return {
    status: 'ok',
    model,
    probability: explanation.probability,
    baseline: explanation.baseline,
    contributions: explanation.contributions,
  }
}
