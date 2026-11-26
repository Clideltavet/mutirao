import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { requireAccess } from '../../../../lib/serverAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseState(row) {
  if (!row) return { nextPatientNumber: 1, revision: 0, updatedAt: null }
  const raw = row.value
  return {
    nextPatientNumber: Math.max(1, Number(typeof raw === 'object' && raw !== null ? raw.value : raw) || 1),
    revision: Math.max(0, Number(typeof raw === 'object' && raw !== null ? raw.revision : 0) || 0),
    updatedAt: row.updated_at?.toISOString?.() || new Date(row.updated_at).toISOString(),
  }
}

export async function GET() {
  const auth = await requireAccess('ENTRADA')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sql = db()
  const rows = await sql`
    SELECT *
    FROM delta_vet_get_next_patient_number()
  `

  const row = rows[0]
  return NextResponse.json({
    nextPatientNumber: Math.max(1, Number(row?.next_number) || 1),
    revision: Math.max(0, Number(row?.sequence_revision) || 0),
    updatedAt: row?.sequence_updated_at?.toISOString?.() || (row?.sequence_updated_at ? new Date(row.sequence_updated_at).toISOString() : null),
  })
}

export async function POST(request) {
  const auth = await requireAccess('ENTRADA')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const incoming = body?.patient

    if (!incoming || typeof incoming !== 'object') {
      return NextResponse.json({ error: 'Dados do paciente não informados.' }, { status: 400 })
    }

    const createdAt = incoming.createdAt || new Date().toISOString()
    const id = incoming.id || crypto.randomUUID()
    const patient = {
      ...incoming,
      id,
      createdAt,
      createdBy: incoming.createdBy || {
        id: auth.user.id,
        name: auth.user.name,
        username: auth.user.username,
        type: 'FUNCIONARIO',
      },
    }

    const sql = db()
    const rows = await sql`
      SELECT *
      FROM delta_vet_create_patient(${JSON.stringify(patient)}::jsonb)
    `

    if (!rows.length) {
      return NextResponse.json({ error: 'Não foi possível reservar a ficha.' }, { status: 500 })
    }

    const row = rows[0]

    return NextResponse.json({
      ok: true,
      patient: row.patient,
      assignedNumber: Number(row.assigned_number),
      nextPatientNumber: Number(row.next_number),
      sequenceRevision: Number(row.sequence_revision),
      sequenceUpdatedAt: row.sequence_updated_at?.toISOString?.() || new Date(row.sequence_updated_at).toISOString(),
    })
  } catch (error) {
    console.error('Erro ao criar entrada:', error)
    return NextResponse.json({ error: 'Não foi possível salvar a entrada no Neon.' }, { status: 500 })
  }
}
