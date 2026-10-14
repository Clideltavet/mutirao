import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { requireAccess } from '../../../../lib/serverAuth'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAccess('CADASTROS')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sql = db()
  const rows = await sql`
    SELECT id, name, description, accesses
    FROM roles
    ORDER BY name ASC
  `
  return NextResponse.json({ roles: rows })
}

export async function POST(request) {
  const auth = await requireAccess('CADASTROS')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const name = String(body?.name || '').trim()
  const description = String(body?.description || '').trim()
  const accesses = Array.isArray(body?.accesses) ? body.accesses : []

  if (!name || !accesses.length) {
    return NextResponse.json({ error: 'Informe nome e permissões.' }, { status: 400 })
  }

  const id = `role-${crypto.randomUUID()}`
  const sql = db()
  const rows = await sql`
    INSERT INTO roles (id, name, description, accesses)
    VALUES (${id}, ${name}, ${description}, ${JSON.stringify(accesses)}::jsonb)
    RETURNING id, name, description, accesses
  `
  return NextResponse.json({ role: rows[0] }, { status: 201 })
}

export async function PATCH(request) {
  const auth = await requireAccess('CADASTROS')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const id = String(body?.id || '')
  const name = String(body?.name || '').trim()
  const description = String(body?.description || '').trim()
  const accesses = Array.isArray(body?.accesses) ? body.accesses : []

  if (!id || !name || !accesses.length) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  const sql = db()
  const rows = await sql`
    UPDATE roles
    SET name = ${name},
        description = ${description},
        accesses = ${JSON.stringify(accesses)}::jsonb,
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, name, description, accesses
  `
  if (!rows.length) return NextResponse.json({ error: 'Função não encontrada.' }, { status: 404 })
  return NextResponse.json({ role: rows[0] })
}

export async function DELETE(request) {
  const auth = await requireAccess('CADASTROS')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const id = String(body?.id || '')
  if (!id) return NextResponse.json({ error: 'ID não informado.' }, { status: 400 })
  if (id === 'admin') return NextResponse.json({ error: 'A função Administrador não pode ser excluída.' }, { status: 400 })

  const sql = db()
  await sql`UPDATE users SET role_id = NULL WHERE role_id = ${id}`
  await sql`DELETE FROM roles WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
