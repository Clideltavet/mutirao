import { NextResponse } from 'next/server'
import { db } from '../../../../lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function validDate(value) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function latestTimelineDate(patient) {
  let latest = null
  for (const event of Array.isArray(patient?.timeline) ? patient.timeline : []) {
    const d = validDate(event?.at)
    if (d && (!latest || d > latest)) latest = d
  }
  return latest
}

function recordVersion(kind, payload) {
  if (kind === 'audit') return validDate(payload?.at) || new Date(0)

  const candidates = [
    payload?._syncUpdatedAt,
    payload?.updatedAt,
    payload?.deliveredAt,
    payload?.dischargedAt,
    payload?.confirmedAt,
    payload?.reinternedAt,
    payload?.returnedToInternedAt,
    payload?.createdAt,
  ]

  if (kind === 'patients') {
    const timeline = latestTimelineDate(payload)
    if (timeline) candidates.unshift(timeline.toISOString())
  }

  for (const value of candidates) {
    const date = validDate(value)
    if (date) return date
  }

  return new Date(0)
}

function patientKey(item) {
  if (item?.id) return String(item.id)
  return `${item?.number ?? 'sem-ficha'}::${item?.createdAt || 'sem-data'}`
}

function clientKey(item) {
  if (item?.id) return String(item.id)
  const cpf = String(item?.cpf || '').replace(/\D/g, '')
  if (cpf) return `cpf:${cpf}`
  const phone = String(item?.phone || '').replace(/\D/g, '')
  if (phone) return `phone:${phone}`
  return `name:${String(item?.name || '').trim().toLowerCase()}`
}

function procedureKey(item) {
  return String(item?.id || item?.name || '').trim().toLowerCase()
}

function auditKey(item) {
  return String(item?.id || `${item?.at || ''}:${item?.action || ''}:${item?.patientNumber ?? ''}`)
}

const DEFINITIONS = {
  patients: { kind: 'patients', key: patientKey },
  clients: { kind: 'clients', key: clientKey },
  procedures: { kind: 'procedures', key: procedureKey },
  auditLog: { kind: 'audit', key: auditKey },
}

async function upsertItems(sql, inputName, items) {
  const def = DEFINITIONS[inputName]
  if (!def || !Array.isArray(items)) return

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const key = def.key(item)
    if (!key) continue

    const versionDate = recordVersion(def.kind, item)
    const version = versionDate.toISOString()
    const payload = JSON.stringify(item)

    const tombstones = await sql`
      SELECT deleted_at
      FROM shared_tombstones
      WHERE kind = ${def.kind}
        AND record_key = ${key}
      LIMIT 1
    `

    if (tombstones.length) {
      const deletedAt = new Date(tombstones[0].deleted_at)
      if (!Number.isNaN(deletedAt.getTime()) && deletedAt >= versionDate) {
        continue
      }

      await sql`
        DELETE FROM shared_tombstones
        WHERE kind = ${def.kind}
          AND record_key = ${key}
      `
    }

    await sql`
      INSERT INTO shared_records (kind, record_key, payload, version_time, server_updated_at)
      VALUES (${def.kind}, ${key}, ${payload}::jsonb, ${version}, NOW())
      ON CONFLICT (kind, record_key)
      DO UPDATE SET
        payload = EXCLUDED.payload,
        version_time = EXCLUDED.version_time,
        server_updated_at = NOW()
      WHERE EXCLUDED.version_time >= shared_records.version_time
    `
  }
}

async function applyDeletions(sql, deletions) {
  if (!Array.isArray(deletions)) return
  const allowed = new Set(['patients','clients','procedures','audit'])

  for (const deletion of deletions) {
    const kind = String(deletion?.kind || '')
    const key = String(deletion?.recordKey || '')
    if (!allowed.has(kind) || !key) continue

    const deletedAt = validDate(deletion?.at) || new Date()

    await sql`
      INSERT INTO shared_tombstones (kind, record_key, deleted_at)
      VALUES (${kind}, ${key}, ${deletedAt.toISOString()})
      ON CONFLICT (kind, record_key)
      DO UPDATE SET deleted_at = GREATEST(shared_tombstones.deleted_at, EXCLUDED.deleted_at)
    `

    await sql`
      DELETE FROM shared_records
      WHERE kind = ${kind}
        AND record_key = ${key}
        AND version_time <= ${deletedAt.toISOString()}
    `
  }
}

async function updateNextNumber(sql, localNext) {
  const patientMaxRows = await sql`
    SELECT COALESCE(MAX(
      CASE
        WHEN (payload->>'number') ~ '^[0-9]+$'
        THEN (payload->>'number')::INTEGER
        ELSE 0
      END
    ), 0) AS max_number
    FROM shared_records
    WHERE kind = 'patients'
  `

  const patientMax = Number(patientMaxRows[0]?.max_number || 0)
  const localValue = Math.max(1, Number(localNext) || 1)

  const stateRows = await sql`
    SELECT value FROM system_state
    WHERE key = 'nextPatientNumber'
    LIMIT 1
  `

  let remoteValue = 1
  if (stateRows.length) {
    const value = stateRows[0].value
    remoteValue = Number(typeof value === 'object' && value !== null ? value.value : value) || 1
  }

  // REGRA:
  // Se já existem pacientes, a próxima ficha é SEMPRE a maior ficha existente + 1.
  // Não aceitamos um número local antigo/alto de outro aparelho, pois isso fazia
  // o sistema "pular" fichas quando um tablet ou PC possuía localStorage antigo.
  //
  // localValue/remoteValue só são usados quando ainda NÃO existe nenhum paciente,
  // preservando a possibilidade de definir uma numeração inicial.
  const next = patientMax > 0
    ? patientMax + 1
    : Math.max(localValue, remoteValue, 1)

  await sql`
    INSERT INTO system_state (key, value, updated_at)
    VALUES ('nextPatientNumber', ${JSON.stringify({ value: next })}::jsonb, NOW())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `

  return next
}

async function readAll(sql, nextPatientNumber) {
  const rows = await sql`
    SELECT kind, payload
    FROM shared_records
    ORDER BY server_updated_at ASC
  `

  const result = {
    patients: [],
    clients: [],
    procedures: [],
    auditLog: [],
    nextPatientNumber,
  }

  for (const row of rows) {
    if (row.kind === 'patients') result.patients.push(row.payload)
    if (row.kind === 'clients') result.clients.push(row.payload)
    if (row.kind === 'procedures') result.procedures.push(row.payload)
    if (row.kind === 'audit') result.auditLog.push(row.payload)
  }

  result.patients.sort((a,b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
  result.clients.sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
  result.procedures.sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
  result.auditLog.sort((a,b) => new Date(a.at || 0) - new Date(b.at || 0))

  return result
}

export async function POST(request) {
  try {
    const body = await request.json()
    const sql = db()

    // Primeiro importa tudo que já existe no dispositivo.
    await upsertItems(sql, 'patients', body?.patients)
    await upsertItems(sql, 'clients', body?.clients)
    await upsertItems(sql, 'procedures', body?.procedures)
    await upsertItems(sql, 'auditLog', body?.auditLog)

    await applyDeletions(sql, body?.deletions)

    const nextPatientNumber = await updateNextNumber(sql, body?.nextPatientNumber)
    const snapshot = await readAll(sql, nextPatientNumber)

    return NextResponse.json({ ...snapshot, syncedAt: new Date().toISOString() })
  } catch (error) {
    console.error('Delta Vet shared sync error:', error)
    return NextResponse.json({ error: 'Não foi possível sincronizar os dados com o Neon.' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const sql = db()
    const nextPatientNumber = await updateNextNumber(sql, 1)
    return NextResponse.json(await readAll(sql, nextPatientNumber))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Não foi possível carregar os dados compartilhados.' }, { status: 500 })
  }
}
