import { cookies } from 'next/headers'
import { db } from './db'
import { tokenHash } from './password'

export const SESSION_COOKIE = 'delta_vet_session'

export async function getSessionUser() {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (!token) return null

  const sql = db()
  const hash = tokenHash(token)

  const rows = await sql`
    SELECT
      u.id,
      u.name,
      u.username,
      u.active,
      u.accesses,
      u.role_id,
      r.name AS role_name
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE s.token_hash = ${hash}
      AND s.expires_at > NOW()
      AND u.active = TRUE
    LIMIT 1
  `

  if (!rows.length) return null

  const user = rows[0]
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    active: user.active,
    roleId: user.role_id,
    roleName: user.role_name,
    accesses: Array.isArray(user.accesses) ? user.accesses : [],
  }
}

export async function requireAccess(access) {
  const user = await getSessionUser()
  if (!user) return { ok: false, status: 401, error: 'Não autenticado.' }
  if (access && !user.accesses.includes(access)) {
    return { ok: false, status: 403, error: 'Acesso não autorizado.' }
  }
  return { ok: true, user }
}
