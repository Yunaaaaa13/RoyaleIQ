/**
 * Validates src/lib/meta-decks.ts against the bundled card catalogue:
 *   - >= 100 decks
 *   - exactly 8 cards, all keys known, no repeats inside a deck
 *   - at most 3 spells and at most 1 champion
 *   - at least one win condition (wc / wc2 role)
 *   - no duplicate decks (order-insensitive)
 *
 * Run: node scripts/validate-meta-decks.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// --- card catalogue ---------------------------------------------------------
const cardsRaw = readFileSync(join(root, 'src/lib/card-data.ts'), 'utf8')
const cards = new Map()
for (const match of cardsRaw.matchAll(
  /\{\s*key:\s*'([^']+)',\s*name:\s*'([^']+)',\s*elixir:\s*([\d.]+),\s*type:\s*'(Troop|Building|Spell)',\s*rarity:\s*'(Common|Rare|Epic|Legendary|Champion)'/g,
)) {
  cards.set(match[1], {
    name: match[2],
    elixir: Number(match[3]),
    type: match[4],
    rarity: match[5],
  })
}
if (cards.size === 0) {
  console.error('FATAL: no cards parsed from card-data.ts')
  process.exit(1)
}

// --- win-condition roles ----------------------------------------------------
const combatRaw = readFileSync(join(root, 'src/lib/card-meta.ts'), 'utf8')
const winConditions = new Set()
for (const match of combatRaw.matchAll(/'?([a-z0-9-]+)'?:\s*c\(\[([^\]]*)\]/g)) {
  const roles = match[2]
  if (/'wc'/.test(roles) || /'wc2'/.test(roles)) winConditions.add(match[1])
}
if (winConditions.size === 0) {
  console.error('FATAL: no win conditions parsed from card-meta.ts')
  process.exit(1)
}

// --- meta deck library ------------------------------------------------------
const decksRaw = readFileSync(join(root, 'src/lib/meta-decks.ts'), 'utf8')
const decks = []
for (const line of decksRaw.split('\n')) {
  const match = line.match(/^\s*\[('[a-z0-9-]+',\s*){7}'[a-z0-9-]+'\],\s*$/)
  if (match) {
    const inner = line.trim().slice(1, -2).replace(/'/g, '"')
    decks.push(JSON.parse(`[${inner}]`))
  }
}
if (decks.length === 0) {
  console.error('FATAL: no decks parsed from meta-decks.ts')
  process.exit(1)
}

const errors = []
const seen = new Map()
let elixirTotal = 0
let minElixir = Infinity
let maxElixir = -Infinity

decks.forEach((deck, index) => {
  const id = index + 1
  const where = `deck #${id} [${deck.join(', ')}]`

  if (deck.length !== 8) errors.push(`${where}: has ${deck.length} cards, expected 8`)

  const unique = new Set(deck)
  if (unique.size !== deck.length) errors.push(`${where}: duplicate cards inside deck`)

  let spells = 0
  let champions = 0
  let elixir = 0
  for (const key of deck) {
    const card = cards.get(key)
    if (!card) {
      errors.push(`${where}: unknown card key '${key}'`)
      continue
    }
    if (card.type === 'Spell') spells += 1
    if (card.rarity === 'Champion') champions += 1
    elixir += card.elixir
  }
  if (spells > 3) errors.push(`${where}: ${spells} spells (max 3)`)
  if (champions > 1) errors.push(`${where}: ${champions} champions (max 1)`)

  const hasWinCondition = deck.some((key) => winConditions.has(key))
  if (!hasWinCondition) errors.push(`${where}: no win condition (wc/wc2)`)

  const avg = elixir / deck.length
  elixirTotal += avg
  minElixir = Math.min(minElixir, avg)
  maxElixir = Math.max(maxElixir, avg)
  if (avg < 2.6 || avg > 4.6) {
    errors.push(`${where}: avg elixir ${avg.toFixed(2)} outside sane range [2.6, 4.6]`)
  }

  const canonical = [...deck].sort().join('|')
  if (seen.has(canonical)) {
    errors.push(`${where}: duplicate of deck #${seen.get(canonical)}`)
  } else {
    seen.set(canonical, id)
  }
})

if (decks.length < 100) errors.push(`library has ${decks.length} decks, expected >= 100`)

if (errors.length) {
  console.error(`FAIL: ${errors.length} problem(s) in ${decks.length} decks`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log(`PASS: ${decks.length} decks validated`)
console.log(
  `  cards known: ${cards.size} | win conditions: ${winConditions.size} | ` +
    `unique decks: ${seen.size}`,
)
console.log(
  `  avg elixir: ${(elixirTotal / decks.length).toFixed(2)} ` +
    `(per-deck range ${minElixir.toFixed(2)}-${maxElixir.toFixed(2)})`,
)
