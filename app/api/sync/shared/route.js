import { NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { getSessionUser } from '../../../../lib/serverAuth'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  try {
    const body = await request.json()
    for (const key of ['patients','clients','procedures','auditLog','deletions']) {
      if (body[key] !== undefined && !Array.isArray(body[key])) return NextResponse.json({ error: 'Formato de sincronização inválido.' }, { status: 400 })
    }
    const user = await getSessionUser()
    const access = user?.accesses || []
    const admin = access.includes('MASTER')
    // Preserve public surgery operations, without allowing public imports,
    // configuration, deletion or arbitrary patient editing.
    const mode = !user ? 'tv' : 'sync'
    const input = { ...body,
      deletions: admin ? body.deletions : [],
      procedures: admin ? body.procedures : [],
      clients: admin || access.includes('ENTRADA') ? body.clients : [],
      patients: !user || admin || access.some(a => ['ENTRADA','PACIENTES','SAIDA','CIRURGIA'].includes(a)) ? body.patients : [],
      auditLog: !user || admin || access.some(a => ['ENTRADA','PACIENTES','SAIDA','CIRURGIA'].includes(a)) ? body.auditLog : [],
    }
    const sql = db()
    const rows = await sql`SELECT delta_apply(${mode}, ${JSON.stringify(input)}::jsonb, ${JSON.stringify(user || {})}::jsonb) AS data`
    return NextResponse.json(rows[0].data)
  } catch (error) {
    console.error('Delta Vet shared sync error:', error)
    return NextResponse.json({ error: 'Não foi possível sincronizar com o Neon. Verifique a conexão e execute a migração v1.18.0.' }, { status: 500 })
  }
}
export async function GET() {
  try {
    const sql = db()
    const rows = await sql`SELECT delta_apply('read', '{}'::jsonb) AS data`
    return NextResponse.json(rows[0].data)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Não foi possível carregar os dados compartilhados.' }, { status: 500 })
  }
}
