import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/serverAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ user: null }, { status: 401 })
    return NextResponse.json({ user })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ user: null, error: 'Erro ao validar sessão.' }, { status: 500 })
  }
}
