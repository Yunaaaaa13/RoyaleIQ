export function normalizeTag(tag: string): string {
  const trimmed = tag.trim().toUpperCase()
  if (!trimmed) return ''
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

export function isLikelyTag(tag: string): boolean {
  return /^[#]?[0289PYLQGRJCUV]{7,14}$/i.test(tag.trim())
}
