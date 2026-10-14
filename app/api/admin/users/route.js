import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { hashPassword } from '../../../../lib/password'
import { requireAccess } from '../../../../lib/serverAuth'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAccess('CADASTROS')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sql = db()
  const rows = await sql`
    SELECT
      u.id,
      u.name,
      u.username,
      u.role_id,
      u.accesses,
      u.active,
      u.created_at,
      r.name AS role_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    ORDER BY u.name ASC
  `

  return NextResponse.json({
    users: rows.map(row => ({
      id: row.id,
      name: row.name,
      username: row.username,
      roleId: row.role_id,
      roleName: row.role_name,
      accesses: Array.isArray(row.accesses) ? row.accesses : [],
      active: row.active,
      createdAt: row.created_at,
    }))
  })
}

export async function POST(request) {
  const auth = await requireAccess('CADASTROS')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const name = String(body?.name || '').trim()
  const username = String(body?.username || '').trim().toLowerCase()
  const password = String(body?.password || '')
  const roleId = body?.roleId ? String(body.roleId) : null
  const accesses = Array.isArray(body?.accesses) ? body.accesses : []

  if (!name || !username || password.length < 4) {
    return NextResponse.json({ error: 'Preencha nome, usuário e senha.' }, { status: 400 })
  }

  const sql = db()
  const exists = await sql`SELECT id FROM users WHERE LOWER(username) = ${username} LIMIT 1`
  if (exists.length) return NextResponse.json({ error: 'Esse usuário já existe.' }, { status: 409 })

  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(password)

  const rows = await sql`
    INSERT INTO users (id, name, username, password_hash, role_id, accesses, active)
    VALUES (
      ${id},
      ${name},
      ${username},
      ${passwordHash},
      ${roleId},
      ${JSON.stringify(accesses)}::jsonb,
      TRUE
    )
    RETURNING id, name, username, role_id, accesses, active
  `

  return NextResponse.json({ user: rows[0] }, { status: 201 })
}

export async function PATCH(request) {
  const auth = await requireAccess('CADASTROS')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const id = String(body?.id || '')
  if (!id) return NextResponse.json({ error: 'ID não informado.' }, { status: 400 })

  const sql = db()

  if (body?.newPassword) {
    const newPassword = String(body.newPassword)
    if (newPassword.length < 4) {
      return NextResponse.json({ error: 'A nova senha precisa ter pelo menos 4 caracteres.' }, { status: 400 })
    }
    const passwordHash = await hashPassword(newPassword)
    await sql`
      UPDATE users
      SET password_hash = ${passwordHash}, updated_at = NOW()
      WHERE id = ${id}
    `
    await sql`DELETE FROM sessions WHERE user_id = ${id}`
  }

  if (typeof body?.active === 'boolean') {
    await sql`
      UPDATE users
      SET active = ${body.active}, updated_at = NOW()
      WHERE id = ${id}
    `
    if (!body.active) await sql`DELETE FROM sessions WHERE user_id = ${id}`
  }

  if (body?.roleId !== undefined || Array.isArray(body?.accesses)) {
    const roleId = body.roleId ? String(body.roleId) : null
    const accesses = Array.isArray(body.accesses) ? body.accesses : []
    await sql`
      UPDATE users
      SET role_id = ${roleId},
          accesses = ${JSON.stringify(accesses)}::jsonb,
          updated_at = NOW()
      WHERE id = ${id}
    `
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request) {
  const auth = await requireAccess('CADASTROS')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const id = String(body?.id || '')
  if (!id) return NextResponse.json({ error: 'ID não informado.' }, { status: 400 })
  if (id === auth.user.id) return NextResponse.json({ error: 'Você não pode excluir seu próprio usuário.' }, { status: 400 })

  const sql = db()
  await sql`DELETE FROM users WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
