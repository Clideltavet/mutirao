import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '../../../../lib/db'
import { SESSION_COOKIE } from '../../../../lib/serverAuth'
import { tokenHash } from '../../../../lib/password'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value
    if (token) {
      const sql = db()
      await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash(token)}`
    }
  } catch (error) {
    console.error(error)
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  })
  return response
}
