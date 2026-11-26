import pg from "pg";
import fs from "node:fs/promises";
import crypto from "node:crypto";
const url = process.env.DELTA_TEST_URL;
if (
  !url ||
  new URL(url).hostname !== "127.0.0.1" ||
  !/^\/delta_test[a-z0-9_]*$/.test(new URL(url).pathname)
)
  throw new Error("Isolated local test URL required");
const u = new URL(url),
  dbname = u.pathname.slice(1);
u.pathname = "/postgres";
const root = new pg.Client({ connectionString: u.toString() });
await root.connect();
await root.query("CREATE DATABASE " + dbname);
await root.end();
const c = new pg.Client({ connectionString: url });
await c.connect();
await c.query(await fs.readFile("tests/schema.sql", "utf8"));
const hash =
  "scrypt$test$" +
  crypto.scryptSync("DeltaTest123!", "test", 64).toString("hex");
for (const [id, acc] of [
  [
    "admin",
    [
      "MASTER",
      "CADASTROS",
      "RELATORIOS",
      "ENTRADA",
      "PACIENTES",
      "SAIDA",
      "CIRURGIA",
    ],
  ],
  ["recepcao", ["RECEPCAO"]],
  ["entrada", ["ENTRADA"]],
  ["cadastros", ["CADASTROS"]],
]) {
  await c.query("INSERT INTO roles(id,name,accesses) VALUES($1,$1,$2)", [
    id,
    JSON.stringify(acc),
  ]);
  await c.query(
    "INSERT INTO users(id,name,username,password_hash,role_id,accesses) VALUES($1,$1,$1,$2,$1,$3)",
    [id, hash, JSON.stringify(acc)],
  );
}
for (const p of [
  {
    id: "legacy-a",
    number: 1,
    createdAt: "2025-01-01",
    patientName: "Antigo A",
    timeline: null,
    tutorName: "Tutor A",
    totalValue: 80,
    procedureDetails: [{ name: "Castração", value: 80 }],
    procedures: ["Castração"],
  },
  {
    id: "legacy-b",
    number: 1,
    createdAt: "2025-02-01",
    patientName: "Antigo B",
    tutorName: "Tutor B",
    totalValue: 90,
  },
])
  await c.query(
    "INSERT INTO shared_records VALUES('patients',$1,$2,now(),now())",
    [p.id, p],
  );
await c.end();
