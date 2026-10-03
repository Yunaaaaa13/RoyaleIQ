# RoyaleIQ

**Clash Royale player & meta intelligence.** Analyse any deck, watch the live ladder meta,
diagnose your own losses, read the archetype matchup grid and get coached on exactly what to
change - every number traceable back to a real battle.

Unofficial. Not affiliated with Supercell.

## Features

| Feature | Route | What it does |
| --- | --- | --- |
| **Deck Lab** | `/deck-lab` | Pick any 8 cards and get five scores (offense, defence, air defence, cycle, spell utility), structural findings, scored card swaps, archetype detection and a per-archetype matchup projection. Analysis runs client-side, so feedback is instant. |
| **AI Deck Coach** | `/deck-lab` → Coach tab | `POST /api/coach`. Uses an OpenAI-compatible LLM when configured, otherwise a deterministic rule engine with the same response shape. Grounded in two real datasets - the player's stored record and the latest meta aggregate - with explicit rules never to invent a statistic. |
| **Matchup Matrix** | `/matchups` | Archetype × archetype win rates folded from stored battles. Global scope mirrors every game so the grid is symmetric; player scope stays strictly your own record. Each cell shows its sample size and, on hover, the gap against the model projection. |
| **Meta** | `/meta` | Card usage and win rate, archetype share, trending cards, top performing decks and win-rate leaders. |
| **Player Tracker** | `/player` | Player profile, recent battles, archetype win-rate table, matchup analysis, monthly trend, most/least used cards. |
| **Battle Diagnosis** | `/player` → recent battles | Click any stored battle. Six axes (deck matchup, air defence, spell coverage, cycle efficiency, level parity, elixir discipline) scored 0-10, ranked findings, and an evidence list where every line carries the exact API field it came from. |
| **Data Pipeline** | `/data` | Live status of the whole path: Clash Royale key and egress IP, rate-limit budget, PostgreSQL latency and record counts, raw-payload coverage, meta freshness, per-player sync ledger, cache sizes. |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run db:migrate           # creates the schema (run npx prisma generate if the client is stale)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

| Variable | Required for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Persistence | PostgreSQL connection string. Without it the app runs stateless: nothing is written or kept between restarts. |
| `CLASH_ROYALE_API_TOKEN` | Live player profiles, battle logs, live meta | Create a key at <https://developer.clashroyale.com> and add this server's IP to the key's allowlist (`/data` shows the egress IP). Without it `/api/player` returns a 503 with an explanatory message, and the meta page falls back to its seeded **demo dataset**. |
| `OPENAI_API_KEY` | LLM coach | Any OpenAI-compatible endpoint. Without it the coach falls back to the rule engine, which still gets the same grounding data. |
| `OPENAI_BASE_URL` | optional | Defaults to `https://api.openai.com/v1`. |
| `OPENAI_MODEL` | optional | Defaults to `gpt-4o-mini`. |
| `CLASH_ROYALE_API_BASE` | optional | Defaults to `https://api.clashroyale.com/v1`. |
| `META_PLAYER_POOL` | optional | How many players' battle logs to aggregate for live meta (default 10). |
| `CR_RATE_LIMIT_PER_MINUTE` | optional | Client-side Clash Royale throttle (default 12). Raise cautiously. |
| `HTTP_RETRY_ATTEMPTS` | optional | Tries per outbound request before giving up (default 4). |
| `HTTP_TIMEOUT_MS` | optional | Socket timeout for a single attempt (default 15000). |

## Architecture

```
Browser (client components, no secrets)
   │  fetch
   ▼
Next.js route handlers  ──────────────────────────────┐
   /api/player  /api/battles  /api/matchups           │ token stays
   /api/meta    /api/cards    /api/coach  /api/status │ server-side
   │                                                     │
   ├──► Clash Royale API   in-process limiter (12/min) + memory cache
   │                    └──► PostgreSQL ApiCache (survives restarts)
   ├──► PostgreSQL        players, battles (+ raw payload), decks, cards,
   │                      meta snapshots, coach sessions, api cache
   └──► LLM (optional)    OpenAI-compatible chat completions

src/
  app/
    page.tsx               Landing + meta pulse
    deck-lab/              Deck analysis, coach, head-to-head
    matchups/              Archetype matchup matrix
    meta/                  Meta dashboard
    player/                Player tracker + battle diagnosis
    data/                  Data pipeline status
    api/                   Route handlers (server-side Clash Royale + LLM proxy)
  components/              UI; deck analysis runs in the browser
  lib/
    card-data.ts           134-card dataset (key, name, elixir, rarity, type)
    card-meta.ts           Per-card combat roles: air targeting, splash, DPS tier
    cards.ts               Lookups, combat metadata, icon URLs
    archetypes.ts          Archetype profiles, detection, baseline matchup matrix
    analysis.ts            The analysis engine: scores, findings, swaps, matchups
    diagnosis.ts           Battle diagnosis: six axes, ranked findings, sourced evidence
    matchups.ts            Archetype × archetype grid built from stored battles
    battle.ts              Battle normalisation + meta aggregation
    player.ts              Per-player statistics (byArchetype, byOpponent, trends)
    demo.ts                Seeded fallback battles for the meta page when no API token is set
    cr-api.ts              Server-only Clash Royale client with rate limiting + caching
    coach.ts / llm.ts      Prompt builder, rule engine, LLM call
    status.ts              Shape of the /api/status payload
    db.ts                  Prisma singleton, skipped cleanly when DATABASE_URL is absent
    http.ts                Retrying fetch: per-attempt timeouts, backoff, Retry-After
    sync.ts                Persistence: player/battles, meta snapshots, card catalogue,
                           coach history, database-backed API cache
public/cards/*.png         Card art, bundled locally (no third-party CDN at runtime)
prisma/schema.prisma       Players, battles, snapshots, meta, cards, clans, cache
```

### Persistence

Every pull that reaches the Clash Royale API is written to PostgreSQL: the profile row, a
`PlayerSnapshot` whenever trophies or career counters move, and each battle with both decks, their
archetypes and the untouched API payload in `Battle.raw`. `/api/player` reads Postgres first and
only re-queries the API when the stored row is older than 5 minutes, so a reload costs one query.

- `/api/meta` stores every live aggregate as a `MetaSnapshot` and serves the newest one while it is
  under 10 minutes old; if the API goes down, an older snapshot is served instead of demo data.
- `/api/cards` reconciles the bundled catalogue with the live `/cards` endpoint on each call,
  writing `Card` rows and a `CardSnapshot` only when metadata actually changes.
- `/api/coach` records every exchange as a `CoachSession` (player tag, deck, question, provider,
  model, answer).
- `/api/battles` and `/api/matchups` are pure reads over stored battles; they never call the API.

The Clash Royale API does not send CORS headers, so **every** CR request goes through a Next.js
route handler - the token never reaches the browser.

## Analytics methodology

Nothing in RoyaleIQ is simulated or borrowed from a tier list. Every number is one of three things:

1. **Observed** - counted from battles actually stored in PostgreSQL. Win rates, archetype shares,
   card usage, the matchup matrix and the player's `byOpponent` table all live here. Each of them
   ships with its own sample size; small samples are dimmed rather than hidden.
2. **Derived from observed fields** - the battle diagnosis reads `team[0].crowns`,
   `princessTowersHitPoints`, `elixirLeaked`, `cards[].level/maxLevel/evolutionLevel`,
   `gameMode` and `leagueNumber`. Each evidence line names the field it came from. The Clash Royale
   battle log has no move-by-move timeline, so RoyaleIQ never claims to know when a push happened -
   it reports what the payload actually contains.
3. **Modelled priors** - the archetype matchup projection and the deck scores. These are labelled as
   projections everywhere they appear, and wherever an observed record disagrees with them, the
   observed record wins (the coach is instructed to say so).

Supporting rules:

- Archetype detection only claims an archetype when the deck contains its defining win condition
  **and** clears a score threshold; otherwise the deck is `Hybrid / Off-Meta` and matchups fall back
  to the neutral 50% prior.
- Matchup cells are reported per cell, not pooled: `Siege into Beatdown 50% (n=6)` is a different
  claim from `overall 50%`.
- The global matrix mirrors each stored battle so both sides of the pairing are counted, with an
  unordered participant+timestamp key so a game both players stored is only counted once.
- The AI coach receives the observed record and the meta aggregate verbatim, plus grounding rules:
  quote the numbers exactly, never invent a statistic, and trust the record over the projection.

## Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm run start       # serve the production build
npm run lint        # eslint
npm run typecheck   # next typegen && tsc --noEmit
npm run db:migrate  # prisma migrate dev
npm run db:studio   # prisma studio
```

## Notes

- `npx prisma migrate dev` does not regenerate the Prisma 7 client - run `npx prisma generate`
  (also wired to `postinstall`) after schema changes.
- The meta fallback dataset is seeded, so its numbers are stable across reloads.
- Card art is bundled from [RoyaleAPI's card images](https://github.com/RoyaleAPI/cr-api-data);
  card metadata is generated from the same project's `cards.json`.
