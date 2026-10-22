import { NextResponse } from 'next/server'
import { db } from '../../../../../lib/db'
import { requireAccess } from '../../../../../lib/serverAuth'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
async function execute(request) {
  try {
    const auth = await requireAccess('MASTER')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const body = request ? await request.json() : {}
    if (request && (!Number.isInteger(body.nextPatientNumber) || body.nextPatientNumber < 1 || body.nextPatientNumber > 99999999)) {
      return NextResponse.json({ error: 'Informe uma ficha inteira entre 1 e 99999999.' }, { status: 400 })
    }
    const sql = db()
    const rows = await sql`SELECT delta_apply(${request ? 'configure' : 'sequence'}, ${JSON.stringify(body)}::jsonb, ${JSON.stringify(auth.user)}::jsonb) AS data`
    return NextResponse.json(rows[0].data)
  } catch (e) {
    console.error('sequence', e)
    return NextResponse.json({ error: 'Falha ao acessar a sequência. Verifique a conexão e a migração do banco.' }, { status: 500 })
  }
}
export async function GET() { return execute() }
export async function PATCH(request) { return execute(request) }
