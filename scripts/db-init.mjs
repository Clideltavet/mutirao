import dotenv from 'dotenv'
import crypto from 'crypto'
import { promisify } from 'util'
import { neon } from '@neondatabase/serverless'

dotenv.config({ path: '.env.local' })
dotenv.config()

if (!process.env.DATABASE_URL) {
  console.error('ERRO: DATABASE_URL não encontrada em .env.local ou .env')
  process.exit(1)
}

const adminUser = (process.env.ADMIN_USER || 'admin').trim().toLowerCase()
const adminName = (process.env.ADMIN_NAME || 'Administrador Delta Vet').trim()
const adminPassword = String(process.env.ADMIN_PASSWORD || '')

if (adminPassword.length < 8 || adminPassword === 'COLOQUE_UMA_SENHA_FORTE_AQUI') {
  console.error('ERRO: defina ADMIN_PASSWORD com pelo menos 8 caracteres em .env.local')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)
const scryptAsync = promisify(crypto.scrypt)

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = await scryptAsync(password, salt, 64)
  return `scrypt$${salt}$${Buffer.from(derived).toString('hex')}`
}

const roles = [
  {
    id: 'admin',
    name: 'Administrador',
    description: 'Acesso completo ao sistema e CMS.',
    accesses: ['ENTRADA','PACIENTES','SAIDA','RECEPCAO','CIRURGIA','MASTER','RELATORIOS','CADASTROS'],
  },
  {
    id: 'recepcao',
    name: 'Recepção',
    description: 'Acesso exclusivo ao painel da recepção.',
    accesses: ['RECEPCAO'],
  },
  {
    id: 'estagiario',
    name: 'Estagiário',
    description: 'Entrada, pacientes e saída no tablet.',
    accesses: ['ENTRADA','PACIENTES','SAIDA'],
  },
  {
    id: 'pos-operatorio',
    name: 'Pós-operatório',
    description: 'Acompanha pacientes e libera alta.',
    accesses: ['PACIENTES'],
  },
  {
    id: 'operacional-completo',
    name: 'Operacional completo',
    description: 'Entrada, pacientes, saída e recepção.',
    accesses: ['ENTRADA','PACIENTES','SAIDA','RECEPCAO'],
  },
]

console.log('Criando estrutura no Neon...')

await sql`
  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    accesses JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`

await sql`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id TEXT REFERENCES roles(id) ON DELETE SET NULL,
    accesses JSONB NOT NULL DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`

await sql`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`

await sql`CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions(token_hash)`
await sql`CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at)`


await sql`
  CREATE TABLE IF NOT EXISTS shared_records (
    kind TEXT NOT NULL,
    record_key TEXT NOT NULL,
    payload JSONB NOT NULL,
    version_time TIMESTAMPTZ NOT NULL,
    server_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (kind, record_key)
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS shared_records_kind_idx
  ON shared_records(kind)
`

await sql`
  CREATE TABLE IF NOT EXISTS system_state (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`


await sql`
  CREATE TABLE IF NOT EXISTS shared_tombstones (
    kind TEXT NOT NULL,
    record_key TEXT NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (kind, record_key)
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS shared_tombstones_kind_idx
  ON shared_tombstones(kind)
`

for (const role of roles) {
  await sql`
    INSERT INTO roles (id, name, description, accesses)
    VALUES (${role.id}, ${role.name}, ${role.description}, ${JSON.stringify(role.accesses)}::jsonb)
    ON CONFLICT (id)
    DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      accesses = EXCLUDED.accesses,
      updated_at = NOW()
  `
}

const passwordHash = await hashPassword(adminPassword)
const adminId = crypto.randomUUID()

await sql`
  INSERT INTO users (id, name, username, password_hash, role_id, accesses, active)
  VALUES (
    ${adminId},
    ${adminName},
    ${adminUser},
    ${passwordHash},
    'admin',
    ${JSON.stringify(roles[0].accesses)}::jsonb,
    TRUE
  )
  ON CONFLICT (username)
  DO UPDATE SET
    name = EXCLUDED.name,
    password_hash = EXCLUDED.password_hash,
    role_id = 'admin',
    accesses = EXCLUDED.accesses,
    active = TRUE,
    updated_at = NOW()
`

await sql`DELETE FROM sessions WHERE expires_at <= NOW()`

console.log('')
console.log('✅ Neon configurado com sucesso.')
console.log(`✅ Admin criado/atualizado: ${adminUser}`)
console.log('✅ Senha do admin veio de ADMIN_PASSWORD.')
console.log('')
console.log('Agora rode: npm run dev')
