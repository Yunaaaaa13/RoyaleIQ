/**
 * Compact "8m ago" label for an ISO timestamp. Returns an empty string for a
 * value that cannot be parsed, so a broken timestamp never renders as "NaN".
 *
 * Lives apart from `lib/utils` because API routes import it too and should not
 * pull the class-name helpers into their bundle.
 */
export function relativeAge(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (!Number.isFinite(minutes) || minutes < 0) return ""
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
