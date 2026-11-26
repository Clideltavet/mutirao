import pg from "pg";
import { readFile } from "node:fs/promises";
// No .env discovery: the operator must explicitly select a target.
if (!process.env.DELTA_MIGRATION_URL || !process.env.DELTA_BACKUP_VERIFIED)
  throw new Error(
    "Defina DELTA_MIGRATION_URL e DELTA_BACKUP_VERIFIED (identificador do backup restaurado e conferido). Leia docs/BACKUP-IMPLANTACAO.md antes.",
  );
const client = new pg.Client({
  connectionString: process.env.DELTA_MIGRATION_URL,
});
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(
    "SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'",
  );
  const required = [
    "shared_records",
    "shared_tombstones",
    "system_state",
    "users",
    "roles",
    "sessions",
  ];
  for (const table of required) {
    const r = await client.query("SELECT to_regclass($1) AS name", [table]);
    if (!r.rows[0].name) throw new Error("Schema base ausente: " + table);
  }
  const migration = await readFile(
    new URL("../migrations/002_confirmed_operations.sql", import.meta.url),
    "utf8",
  );
  await client.query(migration);
  await client.query("COMMIT");
  console.log(
    "Migração 002 confirmada. Payloads, fichas e senhas existentes preservados.",
  );
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
