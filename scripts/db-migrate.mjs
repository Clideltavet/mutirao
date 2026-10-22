import dotenv from 'dotenv'
import { neon } from '@neondatabase/serverless'
import { readFile } from 'node:fs/promises'
dotenv.config({ path: '.env.local' }); dotenv.config()
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada')
const sql = neon(process.env.DATABASE_URL)
const migration = await readFile(new URL('../migrations/001_atomic_sync.sql', import.meta.url), 'utf8')
// One transactional query, additive and safe to run repeatedly.
const statements = migration.split(/\n(?=CREATE )/).filter(s => s.trim())
await sql.transaction(statements.map(statement => sql.query(statement)))
console.log('Migração v1.18.0 aplicada. Dados, usuários e senhas preservados.')
