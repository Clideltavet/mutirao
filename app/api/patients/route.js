import { NextResponse } from 'next/server'
import { db } from '../../../lib/db'
import { requireAccess } from '../../../lib/serverAuth'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  try {
    const auth = await requireAccess('ENTRADA')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const body = await request.json()
    const p = body?.patient
    if (!p || !/^[a-zA-Z0-9-]{16,100}$/.test(p.id || '') || !['CANINO','FELINO'].includes(p.species) || !p.sex || !p.tutorName?.trim() || !['Caixa','BOX'].includes(p.location)) {
      return NextResponse.json({ error: 'Dados de entrada inválidos.' }, { status: 400 })
    }
    const sql = db()
    const rows = await sql`SELECT delta_apply('create', ${JSON.stringify(body)}::jsonb, ${JSON.stringify(auth.user)}::jsonb) AS data`
    return NextResponse.json(rows[0].data)
  } catch (e) {
    console.error('patient create', e)
    return NextResponse.json({ error: 'Não foi possível confirmar a entrada. Tente novamente; a mesma solicitação não gera outra ficha.' }, { status: 500 })
  }
}
