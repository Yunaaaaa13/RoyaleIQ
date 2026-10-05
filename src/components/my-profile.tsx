'use client'

import { useState } from 'react'
import { Check, Pencil, UserRoundCheck, X } from 'lucide-react'
import { PlayerPanel } from '@/components/player-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMyTag, writeMyTag } from '@/lib/my-profile'
import { useRecentPlayers } from '@/lib/recent-players'
import { isLikelyTag, normalizeTag } from '@/lib/tags'

/**
 * My Profile: the user's *own* player page. The tag lives in this browser
 * (falling back to the most recently opened player), and the profile below it
 * reuses the Player Analysis surface locked to that one tag — this route never
 * redirects to /player.
 */
export function MyProfile() {
  const stored = useMyTag()
  const recents = useRecentPlayers()
  const myTag = normalizeTag(stored) || normalizeTag(recents[0]?.tag ?? '')

  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  function save(event: React.FormEvent) {
    event.preventDefault()
    const clean = normalizeTag(value)
    if (!isLikelyTag(clean)) {
      setProblem('That does not look like a Clash Royale tag — try something like #2PP.')
      return
    }
    writeMyTag(clean)
    setProblem(null)
    setValue('')
    setEditing(false)
  }

  if (!myTag || editing) {
    return (
      <section className="panel mx-auto flex w-full max-w-lg flex-col gap-4 p-6">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/15">
            <UserRoundCheck className="size-5 text-primary" />
          </span>
          <h2 className="mt-3 text-lg font-semibold">
            {myTag ? 'Change your player tag' : 'Save your player tag'}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            My Profile is your own account — trophies, battle history, favourite
            cards and personal performance. The tag stays in this browser.
          </p>
        </div>
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="#PLAYERTAG"
            aria-label="Your player tag"
            className="h-10 min-w-0 flex-1 font-mono uppercase"
          />
          <Button type="submit" className="h-10 gap-2">
            <Check className="size-4" />
            Save
          </Button>
          {myTag && (
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2"
              onClick={() => {
                setEditing(false)
                setProblem(null)
              }}
            >
              <X className="size-4" />
              Cancel
            </Button>
          )}
        </form>
        {problem && (
          <p role="alert" className="text-xs text-rose-600">
            {problem}
          </p>
        )}
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15">
          <UserRoundCheck className="size-4 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            My profile
          </p>
          <p className="truncate font-mono text-sm">{myTag}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => {
            setValue(myTag)
            setEditing(true)
          }}
        >
          <Pencil className="size-3.5" />
          Change tag
        </Button>
      </div>
      <PlayerPanel defaultTag={myTag} hideSearch />
    </div>
  )
}
