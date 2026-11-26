import { neon } from "@neondatabase/serverless";
import pg from "pg";
let sqlClient;
export function db() {
  if (sqlClient) return sqlClient;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  // The local adapter runs the SAME route SQL against real isolated PostgreSQL.
  if (process.env.DELTA_ISOLATED_TEST === "1") {
    const u = new URL(url);
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) ||
      !u.pathname.startsWith("/delta_test")
    )
      throw new Error("Test database must be local and named delta_test*");
    const pool = new pg.Pool({ connectionString: url, max: 12 });
    sqlClient = (strings, ...args) =>
      pool
        .query(
          strings.reduce((s, x, i) => s + (i ? "$" + i : "") + x, ""),
          args,
        )
        .then((r) => r.rows);
    sqlClient.query = (s, args) => pool.query(s, args).then((r) => r.rows);
  } else sqlClient = neon(url);
  return sqlClient;
}
