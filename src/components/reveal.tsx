'use client'

import { motion } from 'motion/react'
import { type ReactNode } from 'react'
import { DURATION, EASE_OUT } from '@/lib/motion'
import { isClientBooted } from '@/components/page-transition'

/** Scroll-triggered reveal for a major section — animates once, then stays. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 16,
}: {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      transition={{ duration: DURATION.page, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  )
}

/** Mount-based fade-up for content that appears when data arrives. */
export function FadeIn({
  children,
  className,
  delay = 0,
  y = 8,
}: {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
}) {
  return (
    <motion.div
      className={className}
      initial={isClientBooted() ? { opacity: 0, y } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.component, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  )
}
