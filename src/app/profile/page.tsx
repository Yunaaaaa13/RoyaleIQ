import type { Metadata } from 'next'
import { Suspense } from 'react'
import { MyProfile } from '@/components/my-profile'
import { PageTransition } from '@/components/page-transition'

export const metadata: Metadata = {
  title: 'My Profile',
  description:
    'Your own Clash Royale profile: trophies, win-rate trend, favourite cards, matchup records and full battle history — kept separate from Player Analysis.',
}

function ProfileFallback() {
  return (
    <div className="space-y-4">
      <div className="panel h-20 animate-pulse" />
      <div className="panel h-40 animate-pulse" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel h-72 animate-pulse lg:col-span-2" />
        <div className="panel h-72 animate-pulse" />
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <PageTransition className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-2 border-b border-border/70 pb-5">
        <p className="eyebrow">My Profile</p>
        <h1 className="page-title">Your account, not someone else&apos;s</h1>
        <p className="page-lede">
          The player you saved as yours: trophies, win-rate trend, favourite cards,
          matchup records and battle history. Player Analysis stays the place for
          looking up any other tag.
        </p>
      </header>
      <Suspense fallback={<ProfileFallback />}>
        <MyProfile />
      </Suspense>
    </PageTransition>
  )
}
