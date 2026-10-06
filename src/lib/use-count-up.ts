'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'

interface ParsedNumber {
  prefix: string
  suffix: string
  target: number
  decimals: number
  grouped: boolean
}

/**
 * Recognises numeric KPI values — `1234`, `"1,234"`, `"52.4%"`, `"3.1"` —
 * and leaves anything else (labels, ranges, JSX) untouched.
 */
function parseNumeric(value: ReactNode): ParsedNumber | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const text = String(value)
    const decimals = text.includes('.') ? text.split('.')[1].length : 0
    return { prefix: '', suffix: '', target: value, decimals, grouped: Number.isInteger(value) }
  }
  if (typeof value !== 'string') return null

  const match = value.match(/^([^0-9]*)(-?[0-9][0-9.,]*)(.*)$/)
  if (!match) return null
  const [, prefix, num, suffix] = match
  if (/[a-z]/i.test(prefix) || /[a-z]/i.test(suffix)) return null

  const grouped = num.match(/^(-?)(\d{1,3}(?:,\d{3})+)(?:\.(\d+))?$/)
  if (grouped) {
    const [, sign, intPart, dec] = grouped
    const target = Number(`${sign}${intPart.replace(/,/g, '')}${dec ? `.${dec}` : ''}`)
    if (!Number.isFinite(target)) return null
    return { prefix, suffix, target, decimals: dec ? dec.length : 0, grouped: true }
  }
  if (/^-?\d+(\.\d+)?$/.test(num)) {
    const target = Number(num)
    if (!Number.isFinite(target)) return null
    return {
      prefix,
      suffix,
      target,
      decimals: num.includes('.') ? num.split('.')[1].length : 0,
      grouped: false,
    }
  }
  return null
}

function format(value: number, parsed: ParsedNumber): string {
  let body =
    parsed.decimals > 0
      ? Math.abs(value).toFixed(parsed.decimals)
      : String(Math.round(Math.abs(value)))
  if (parsed.grouped) {
    const [intPart, decPart] = body.split('.')
    body = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (decPart ? `.${decPart}` : '')
  }
  return `${parsed.prefix}${value < 0 ? '-' : ''}${body}${parsed.suffix}`
}

/**
 * Counts from the previously shown value to `value` whenever the value
 * actually changes (once per data refresh — never on every render).
 * Renders the original node when it is not a plain numeric value.
 */
export function useCountUp(value: ReactNode, duration = 800): ReactNode {
  const parsed = useMemo(() => parseNumeric(value), [value])
  const reduced = useReducedMotion()
  const [shown, setShown] = useState<number | null>(null)
  const shownRef = useRef(0)

  useEffect(() => {
    if (!parsed) return
    const target = parsed.target
    if (reduced) {
      shownRef.current = target
      return
    }
    const from = shownRef.current
    if (from === target) return

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 4)
      const current = from + (target - from) * eased
      shownRef.current = current
      setShown(current)
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        shownRef.current = target
        setShown(target)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [parsed, reduced, duration])

  if (!parsed) return value
  if (reduced) return format(parsed.target, parsed)
  return format(shown ?? 0, parsed)
}
