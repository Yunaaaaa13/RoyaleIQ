'use client'

import { MotionConfig } from 'motion/react'
import { EASE_OUT, DURATION } from '@/lib/motion'

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: DURATION.component, ease: EASE_OUT }}
    >
      {children}
    </MotionConfig>
  )
}
