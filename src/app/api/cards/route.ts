import { ALL_CARDS, combatOf, iconUrl } from '@/lib/cards'
import { ROLE_LABEL } from '@/lib/card-meta'
import { jsonResponse } from '@/lib/json'
import { syncCards } from '@/lib/sync'

export async function GET(request: Request) {
  // Reconcile the bundled catalogue with the live API and record any metadata
  // change as a CardSnapshot. Best effort: a missing API/database never breaks
  // the response, which still serves the bundled dataset.
  await syncCards()

  return jsonResponse(request, {
    source: 'bundled' as const,
    count: ALL_CARDS.length,
    cards: ALL_CARDS.map((card) => {
      const meta = combatOf(card.key)
      return {
        key: card.key,
        name: card.name,
        elixir: card.elixir,
        type: card.type,
        rarity: card.rarity,
        arena: card.arena,
        icon: iconUrl(card.key),
        air: meta.air,
        fly: meta.fly,
        aoe: meta.aoe,
        dps: meta.dps,
        roles: meta.roles,
        roleLabels: meta.roles.map((role) => ROLE_LABEL[role]),
      }
    }),
  })
}
