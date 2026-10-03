// Copy every table from the local Postgres to the hosted one.
//   node scripts/clone-db.mjs           # dry run: counts + bytes per table
//   node scripts/clone-db.mjs --apply   # wipe the remote, then copy
// Tables are written in FK dependency order discovered from pg_constraint.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const req = createRequire(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'))
const { Client } = req('pg')

const APPLY = process.argv.includes('--apply')
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function envFile(name) {
  const out = {}
  try {
    for (const line of readFileSync(join(ROOT, name), 'utf8').split(/\r?\n/)) {
      const i = line.indexOf('=')
      if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '')
    }
  } catch {
    /* optional file */
  }
  return out
}

const env = { ...envFile('.env.local'), ...envFile('.env') }
const localUrl = env.DATABASE_URL
const remoteUrl = env.DATABASE_URL_CLOUD
if (!localUrl || !remoteUrl) throw new Error('DATABASE_URL and DATABASE_URL_CLOUD are both required')
const ca = readFileSync(join(ROOT, 'prisma', 'supabase-ca.pem'), 'utf8')

const skip = new Set(['_prisma_migrations'])

async function connect(url, remote) {
  const clean = url.replace(/([?&])sslmode=[^&]*/g, '$1').replace(/[?&]$/, '')
  const client = new Client(
    remote ? { connectionString: clean, ssl: { ca, rejectUnauthorized: true } } : { connectionString: clean },
  )
  await client.connect()
  return client
}

async function catalogue(client) {
  const cols = await client.query(
    `select table_name, column_name, data_type from information_schema.columns
     where table_schema = 'public' order by table_name, ordinal_position`,
  )
  const tables = new Map()
  for (const row of cols.rows) {
    if (skip.has(row.table_name)) continue
    if (!tables.has(row.table_name)) tables.set(row.table_name, { cols: [], json: new Set() })
    const t = tables.get(row.table_name)
    t.cols.push({ name: row.column_name, type: row.data_type })
    if (row.data_type === 'json' || row.data_type === 'jsonb') t.json.add(row.column_name)
  }
  const fks = await client.query(
    `select pc.relname as child, pf.relname as parent
     from pg_constraint c
     join pg_class pc on pc.oid = c.conrelid
     join pg_class pf on pf.oid = c.confrelid
     where c.contype = 'f' and c.connamespace = 'public'::regnamespace`,
  )
  const deps = new Map([...tables.keys()].map((t) => [t, new Set()]))
  for (const { child, parent } of fks.rows) {
    if (skip.has(child) || skip.has(parent)) continue
    if (deps.has(child) && deps.has(parent) && child !== parent) deps.get(child).add(parent)
  }
  return { tables, deps }
}

/** Parents before children; cycles are appended as-is (none are expected). */
function order(deps) {
  const done = new Set()
  const out = []
  const pending = [...deps.keys()]
  while (pending.length) {
    const ready = pending.filter((t) => [...deps.get(t)].every((d) => done.has(d)))
    if (!ready.length) {
      out.push(...pending)
      break
    }
    for (const t of ready) {
      out.push(t)
      done.add(t)
      pending.splice(pending.indexOf(t), 1)
    }
  }
  return out
}

/** Group rows so one statement never exceeds maxBytes. */
function chunk(items, maxBytes) {
  const groups = []
  let group = []
  let bytes = 0
  for (const item of items) {
    const size = JSON.stringify(item).length
    if (group.length && bytes + size > maxBytes) {
      groups.push(group)
      group = []
      bytes = 0
    }
    group.push(item)
    bytes += size
  }
  if (group.length) groups.push(group)
  return groups
}

const local = await connect(localUrl, false)
const remote = await connect(remoteUrl, true)
console.log(`${APPLY ? 'COPY' : 'DRY '} local -> supabase`)

const { tables, deps } = await catalogue(remote)
const order_list = order(deps)

const sources = new Map()
let totalRows = 0
let totalBytes = 0
for (const table of order_list) {
  const src = await local.query(`select * from "${table}"`)
  sources.set(table, src.rows)
  totalRows += src.rows.length
  totalBytes += JSON.stringify(src.rows).length
  console.log(
    `  ${APPLY ? 'cpy ' : '    '} ${table.padEnd(20)} ${String(src.rows.length).padStart(6)} rows  ` +
      `${(JSON.stringify(src.rows).length / 1024).toFixed(1)} kB`,
  )
}
console.log(`source total: ${totalRows} rows, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`)
if (!APPLY) {
  await local.end()
  await remote.end()
  console.log('dry run only - re-run with --apply')
  process.exit(0)
}

// One wipe up front: cascading per-table truncates would erase parents we
// have already written.
const all = order_list.map((t) => `"${t}"`).join(', ')
await remote.query(`truncate table ${all} restart identity cascade`)
console.log('remote wiped')

for (const table of order_list) {
  const meta = tables.get(table)
  const rows = sources.get(table)
  if (!rows.length) {
    console.log(`  ok  ${table.padEnd(20)}      0 rows`)
    continue
  }
  const names = meta.cols.map((c) => `"${c.name}"`).join(', ')
  for (const batch of chunk(rows, 512 * 1024)) {
    const params = []
    const tuples = batch.map((row) => {
      const refs = meta.cols.map((c) => {
        let v = row[c.name]
        if (v !== null && v !== undefined && meta.json.has(c.name) && typeof v !== 'string') {
          v = JSON.stringify(v)
        }
        params.push(v === undefined ? null : v)
        return `$${params.length}`
      })
      return `(${refs.join(',')})`
    })
    await remote.query(`insert into "${table}" (${names}) values ${tuples.join(',')}`, params)
  }
  const check = await remote.query(`select count(*)::int as n from "${table}"`)
  const got = check.rows[0].n
  if (got !== rows.length) throw new Error(`${table}: copied ${got} of ${rows.length}`)
  console.log(`  ok  ${table.padEnd(20)} ${String(got).padStart(6)} rows`)
}

await local.end()
await remote.end()
console.log('done')
