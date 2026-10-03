/**
 * Thresholds for the card-synergy panel - one source of truth for both ends.
 *
 * The meta aggregator ships exactly the pairs these rules accept, because
 * every extra row costs JSON the browser downloads twice (the meta page and
 * the home-page pulse both fetch `/api/meta`). The panel then filters the same
 * set again before rendering, so loosening a number here widens both sides
 * together and nothing drifts.
 *
 * Cards are picked as whole eight-card packages, so almost every within-build
 * pair beats a naive independence estimate - lift alone is not news.
 */

/** A pair below this many decided team battles can satisfy neither table. */
export const MIN_PACKAGE_BATTLES = 20
/** Only a pair landing several times the expected overlap reads as a package. */
export const MIN_PACKAGE_LIFT = 4
/** And it must be a real overlap, not one lucky co-occurrence. */
export const MIN_PACKAGE_EXPECTED = 5
/**
 * A win rate on 60 battles carries roughly 6 points of sampling noise, so
 * anything smaller cannot separate a pair from the deck it sits in.
 */
export const MIN_RESULT_BATTLES = 60
/** One build's record is not the pair's record - see `CardSynergy`. */
export const MIN_RESULT_DECKS = 3
/**
 * The table reports winners and losers, so it must not print a sub-point wobble
 * as a lead. This is only a tie-breaker: sampling noise at 60 battles is far
 * larger, which is what `MIN_RESULT_BATTLES` is for.
 */
export const MIN_DELTA = 1

/** The fields a synergy row must carry for these rules to judge it. */
export interface SynergyMetrics {
  battles: number
  decks: number
  expected: number
  lift: number
  delta: number
}

/** A pair that travels together far more often than independence predicts. */
export function isPackage(pair: SynergyMetrics): boolean {
  return (
    pair.battles >= MIN_PACKAGE_BATTLES &&
    pair.lift >= MIN_PACKAGE_LIFT &&
    pair.expected >= MIN_PACKAGE_EXPECTED
  )
}

/** A pair with enough spread across builds to read a win-rate gap at all. */
export function isResult(pair: SynergyMetrics): boolean {
  return (
    pair.battles >= MIN_RESULT_BATTLES &&
    pair.decks >= MIN_RESULT_DECKS &&
    Math.abs(pair.delta) >= MIN_DELTA
  )
}

/** Either table - this is the whole set the meta endpoint is allowed to ship. */
export function isPublished(pair: SynergyMetrics): boolean {
  return isPackage(pair) || isResult(pair)
}
