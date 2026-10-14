import { neon } from '@neondatabase/serverless'

let sqlClient

export function db() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada.')
  }
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL)
  return sqlClient
}
