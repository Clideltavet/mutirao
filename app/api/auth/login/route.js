import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { hashPassword as _unused, randomToken, tokenHash, verifyPassword } from '../../../../lib/password'
import { SESSION_COOKIE } from '../../../../lib/serverAuth'

export const runtime = 'nodejs'

export async function POST(request) {
  try {
    const body = await request.json()
    const username = String(body?.username || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const requiredAccess = body?.requiredAccess ? String(body.requiredAccess) : null

    if (!username || !password) {
      return NextResponse.json({ error: 'Informe usuário e senha.' }, { status: 400 })
    }

    const sql = db()
    const rows = await sql`
      SELECT
        u.id,
        u.name,
        u.username,
        u.password_hash,
        u.active,
        u.accesses,
        u.role_id,
        r.name AS role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE LOWER(u.username) = ${username}
      LIMIT 1
    `

    const user = rows[0]
    if (!user || !user.active || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 })
    }

    const accesses = Array.isArray(user.accesses) ? user.accesses : []
    if (requiredAccess && !accesses.includes(requiredAccess)) {
      return NextResponse.json({ error: 'Este usuário não possui acesso a esta área.' }, { status: 403 })
    }

    const rawToken = randomToken()
    const hash = tokenHash(rawToken)
    const sessionId = crypto.randomUUID()
    const expires = new Date(Date.now() + 12 * 60 * 60 * 1000)

    await sql`DELETE FROM sessions WHERE expires_at <= NOW()`
    await sql`
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES (${sessionId}, ${user.id}, ${hash}, ${expires.toISOString()})
    `

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        roleId: user.role_id,
        roleName: user.role_name,
        accesses,
      }
    })

    response.cookies.set({
      name: SESSION_COOKIE,
      value: rawToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires,
    })

    return response
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao autenticar no banco.' }, { status: 500 })
  }
}
