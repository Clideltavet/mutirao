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
    return NextResponse.json(
      { error: 'Informe um número de ficha válido.' },
      { status: 400 }
    )
  }

  const sql = db()
  const now = new Date().toISOString()

  // "epoch" marca o início desta nova sequência.
  // Assim é possível reiniciar em 1 mesmo existindo fichas 1,2,3 de mutirões antigos.
  const state = {
    value: nextPatientNumber,
    epoch: now,
    source: 'manual',
    changedBy: auth.user.username,
  }

  await sql`
    INSERT INTO system_state (key, value, updated_at)
    VALUES (
      'nextPatientNumber',
      ${JSON.stringify(state)}::jsonb,
      NOW()
    )
    ON CONFLICT (key)
    DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `

  return NextResponse.json({
    ok: true,
    nextPatientNumber,
    updatedAt: now,
  })
}
