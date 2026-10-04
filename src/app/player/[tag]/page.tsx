import { redirect } from 'next/navigation'
import { normalizeTag } from '@/lib/tags'

interface PlayerTagPageProps {
  params: Promise<{ tag: string }>
}

/**
 * Canonical player deep link: Player Analysis owns `?tag=` as its single
 * source of truth, so `/player/[tag]` hands the tag over instead of keeping a
 * second copy of the same view.
 */
export default async function PlayerTagPage({ params }: PlayerTagPageProps) {
  const { tag } = await params
  let raw = tag
  try {
    raw = decodeURIComponent(tag)
  } catch {
    // A malformed escape can only mean the segment was the raw tag.
  }
  const clean = normalizeTag(raw)
  redirect(clean ? `/player?tag=${encodeURIComponent(clean)}` : '/player')
}
