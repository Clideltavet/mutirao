import { NextResponse } from 'next/server'
import { db } from '../../../../../lib/db'
import { requireAccess } from '../../../../../lib/serverAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseState(row) {
  if (!row) return null
  const raw = row.value
  const value = Number(
    typeof raw === 'object' && raw !== null
      ? raw.value
      : raw
  )

  return {
    value: Number.isFinite(value) && value > 0 ? value : 1,
    epoch:
      typeof raw === 'object' && raw !== null && raw.epoch
        ? raw.epoch
        : row.updated_at?.toISOString?.() || new Date(row.updated_at).toISOString(),
    revision: Math.max(0, Number(typeof raw === 'object' && raw !== null ? raw.revision : 0) || 0),
    updatedAt: row.updated_at?.toISOString?.() || new Date(row.updated_at).toISOString(),
  }
}

export async function GET() {
  const auth = await requireAccess('MASTER')
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const sql = db()
  const rows = await sql`
    SELECT value, updated_at
    FROM system_state
    WHERE key = 'nextPatientNumber'
    LIMIT 1
  `

  if (!rows.length) {
    return NextResponse.json({
      nextPatientNumber: 1,
      updatedAt: null,
    })
  }

  const state = parseState(rows[0])

  return NextResponse.json({
    nextPatientNumber: state.value,
    revision: state.revision,
    updatedAt: state.updatedAt,
  })
}

export async function PATCH(request) {
  const auth = await requireAccess('MASTER')
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const nextPatientNumber = Math.floor(Number(body?.nextPatientNumber))

  if (!Number.isFinite(nextPatientNumber) || nextPatientNumber < 1) {
    return NextResponse.json({ error: 'Informe um número de ficha válido.' }, { status: 400 })
  }

  const sql = db()
  const currentRows = await sql`
    SELECT value
    FROM system_state
    WHERE key = 'nextPatientNumber'
    LIMIT 1
  `

  const raw = currentRows[0]?.value
  const currentRevision = Math.max(
    0,
    Number(typeof raw === 'object' && raw !== null ? raw.revision : 0) || 0
  )
  const revision = currentRevision + 1
  const now = new Date().toISOString()

  const state = {
    value: nextPatientNumber,
    epoch: now,
    source: 'manual',
    changedBy: auth.user.username,
    revision,
  }

  await sql`
    INSERT INTO system_state (key, value, updated_at)
    VALUES ('nextPatientNumber', ${JSON.stringify(state)}::jsonb, NOW())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `

  return NextResponse.json({
    ok: true,
    nextPatientNumber,
    sequenceRevision: revision,
    updatedAt: now,
  })
}
