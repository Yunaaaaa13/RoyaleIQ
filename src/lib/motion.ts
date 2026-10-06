import type { Variants } from 'motion/react'

/**
 * Shared motion language: fast, precise, confident. Ease-out only — no
 * overshoot, no bouncy springs, never linear for UI elements.
 */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]
export const EASE_IN_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1]

/** Duration tiers in seconds. */
export const DURATION = {
  micro: 0.18,
  component: 0.26,
  page: 0.38,
  signature: 0.56,
} as const

/** Page/section entrance: opacity 0→1 with a 6px rise. */
export const pageTransition = { duration: DURATION.page, ease: EASE_OUT }

/** Container variant: children stagger in 40ms apart. */
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.04 } },
}

/** Child variant: small fade-up for grid items and list rows. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.component, ease: EASE_OUT } },
}

/** Table-row variant: lighter rise so dense rows stay subtle. */
export const rowReveal: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
}

/** Attach to a motion parent to reveal once when it scrolls into view. */
export const scrollParent = {
  initial: 'hidden',
  whileInView: 'show',
  viewport: { once: true, margin: '0px 0px -60px 0px' },
} as const

/**
 * Recharts mount reveal policy: one consistent draw on load, then still.
 * Line charts draw, bars rise, donut segments sweep — nothing loops.
 */
export const CHART_MOTION = {
  animationDuration: 700,
  animationEasing: 'ease-out',
} as const
