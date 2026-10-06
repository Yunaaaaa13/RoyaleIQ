'use client'

import { motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { pageTransition } from '@/lib/motion'

let clientBooted = false

/**
 * True once the app has mounted in the browser. Persistent shell elements
 * (header, sidebar) use this so their keyed entrance animations only run on
 * navigation — never on first paint.
 */
export function isClientBooted(): boolean {
  return clientBooted
}

/**
 * Route change transition: fade + 6px rise on navigation. The first render
 * after a full page load never animates, so server HTML is never invisible
 * waiting for hydration.
 */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    clientBooted = true
  }, [])

  return (
    <motion.div
      className={className}
      initial={clientBooted ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={pageTransition}
    >
      {children}
    </motion.div>
  )
}
