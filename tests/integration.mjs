import assert from "node:assert/strict";
import pg from "pg";
import { readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
const url = process.env.DELTA_TEST_URL;
if (
  !url ||
  new URL(url).hostname !== "127.0.0.1" ||
  !new URL(url).pathname.startsWith("/delta_test")
)
  throw new Error("Isolated local test URL required");
const pool = new pg.Pool({ connectionString: url, max: 16 });
const actor = {
  id: "admin",
  name: "Admin teste",
  username: "admin",
  roleId: "admin",
  accesses: [
    "MASTER",
    "CADASTROS",
    "RELATORIOS",
    "ENTRADA",
    "PACIENTES",
    "CIRURGIA",
    "SAIDA",
  ],
};
const call = async (cmd, a = actor) =>
  (await pool.query("SELECT delta2_apply($1,$2) data", [cmd, a])).rows[0].data;
const command = (x) => ({
  requestId: crypto.randomUUID(),
  expectedRevision: 0,
  ...x,
});
const create = (name) =>
  command({
    op: "create",
    kind: "patients",
    key: crypto.randomUUID(),
    payload: {
      patientName: name,
      tutorName: "Tutor",
      species: "FELINO",
      sex: "Macho",
      location: "Caixa",
      procedures: ["Castração"],
    },
  });
const evidence = [];
async function test(name, fn) {
  await fn();
  evidence.push(name);
  console.log("PASS", name);
}
try {
  await test("incremental migration repeatable; all existing payloads and passwords unchanged", async () => {
    const before = (
      await pool.query(
        "SELECT kind,record_key,payload FROM shared_records ORDER BY kind,record_key",
      )
    ).rows;
    const users = (
      await pool.query("SELECT id,password_hash FROM users ORDER BY id")
    ).rows;
    const sql = await readFile(
      "migrations/002_confirmed_operations.sql",
      "utf8",
    );
    await pool.query("BEGIN;" + sql + "COMMIT;");
    await pool.query("BEGIN;" + sql + "COMMIT;");
    assert.deepEqual(
      (
        await pool.query(
          "SELECT kind,record_key,payload FROM shared_records ORDER BY kind,record_key",
        )
      ).rows,
      before,
    );
    assert.deepEqual(
      (await pool.query("SELECT id,password_hash FROM users ORDER BY id")).rows,
      users,
    );
  });
  await test("catalog and configuration confirmed", async () => {
    await call(
      command({
        op: "create",
        kind: "procedures",
        key: "castracao",
        payload: { id: "castracao", name: "Castração", value: 100.1 },
      }),
    );
    await call(
      command({
        op: "create",
        kind: "clients",
        key: "tutor-teste",
        payload: {
          id: "tutor-teste",
          name: "Tutor teste",
          phone: "51999999999",
        },
      }),
    );
    await call(
      command({
        op: "create",
        kind: "settings",
        key: "deltaVetVeterinarians",
        payload: { value: ["Dra. Teste"] },
      }),
    );
  });
  await test("continuous 500/501 and 16 concurrent connections, no duplicate allocation", async () => {
    const before = await call({ op: "read" });
    await call(
      command({
        op: "configure",
        expectedRevision: before.sequenceRevision,
        nextPatientNumber: 500,
      }),
    );
    const results = await Promise.all(
      Array.from({ length: 16 }, (_, i) => call(create("Simultâneo " + i))),
    );
    assert.deepEqual(
      results.map((r) => r.record.number).sort((a, b) => a - b),
      Array.from({ length: 16 }, (_, i) => 500 + i),
    );
    assert.equal((await call({ op: "read" })).nextPatientNumber, 516);
  });
  await test("lost acknowledgement retry uses same receipt and number", async () => {
    const cmd = create("Resposta perdida");
    const a = await call(cmd);
    const b = await call(cmd);
    assert.deepEqual(a, b);
    assert.equal(
      (await call({ op: "read" })).patients.filter((p) => p._key === cmd.key)
        .length,
      1,
    );
    await assert.rejects(
      call({ ...cmd, payload: { ...cmd.payload, notes: "different" } }),
      (e) => e.code === "40001",
    );
  });
  await test("two edits to same revision: exactly one committed; obsolete clocks irrelevant", async () => {
    const p = (await call(create("Concorrência"))).record;
    const results = await Promise.allSettled(
      ["A", "B"].map((notes) =>
        call(
          command({
            op: "update",
            kind: "patients",
            key: p._key,
            expectedRevision: p._revision,
            action: "PACIENTE_EDITADO",
            payload: { notes },
          }),
        ),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      results.filter(
        (r) => r.status === "rejected" && r.reason.code === "40001",
      ).length,
      1,
    );
  });
  await test("duplicate old numbers: edit affects only selected identity, history price preserved", async () => {
    const old = (await call({ op: "read" })).patients.find(
      (p) => p._key === "legacy-a",
    );
    const b = (await call({ op: "read" })).patients.find(
      (p) => p._key === "legacy-b",
    );
    const edited = await call(
      command({
        op: "update",
        kind: "patients",
        key: old._key,
        expectedRevision: old._revision,
        action: "PACIENTE_EDITADO",
        payload: { notes: "Editado com identidade" },
      }),
    );
    assert.equal(edited.record.totalValue, 80);
    assert.equal(edited.record.number, 1);
    assert.deepEqual(
      (await call({ op: "read" })).patients.find((p) => p._key === "legacy-b"),
      b,
    );
    await assert.rejects(
      call(
        command({
          op: "update",
          kind: "patients",
          key: old._key,
          expectedRevision: edited.record._revision,
          action: "PACIENTE_EDITADO",
          payload: { number: 999 },
        }),
      ),
      (e) => e.code === "42501",
    );
  });
  await test("admin sequence revision rejects stale config; reset preserves old numbers", async () => {
    const before = await call({ op: "read" });
    await call(
      command({
        op: "configure",
        expectedRevision: before.sequenceRevision,
        nextPatientNumber: 1,
      }),
    );
    await assert.rejects(
      call(
        command({
          op: "configure",
          expectedRevision: before.sequenceRevision,
          nextPatientNumber: 900,
        }),
      ),
      (e) => e.code === "40001",
    );
    assert.equal((await call(create("Novo mutirão"))).record.number, 1);
    assert.equal(
      (await call({ op: "read" })).patients.filter((p) => p.number === 1)
        .length,
      3,
    );
  });
  await test("authorized soft delete persists payload; stale update and recovery cannot resurrect", async () => {
    const p = (await call(create("TESTE EXCLUIR"))).record;
    await assert.rejects(
      call(
        command({
          op: "delete",
          kind: "patients",
          key: p._key,
          expectedRevision: p._revision,
          reason: "Teste autorizado",
        }),
        { id: "low", accesses: ["ENTRADA"] },
      ),
      (e) => e.code === "42501",
    );
    await call(
      command({
        op: "delete",
        kind: "patients",
        key: p._key,
        expectedRevision: p._revision,
        reason: "Registro exclusivo de teste isolado",
      }),
    );
    assert.ok(
      !(await call({ op: "read" })).patients.some((x) => x._key === p._key),
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*) FROM shared_records WHERE kind='patients' AND record_key=$1",
          [p._key],
        )
      ).rows[0].count,
      "1",
    );
    await assert.rejects(
      call(
        command({
          op: "recover",
          kind: "patients",
          key: p._key,
          payload: p,
          reason: "Tentativa de ressurreição",
        }),
      ),
      (e) => e.code === "40001",
    );
  });
  await test("recovery inserts missing record without overwriting, renumbering or importing snapshots", async () => {
    const p = {
      id: "recovered-test",
      number: 42,
      createdAt: "2024-01-01",
      tutorName: "Recuperado",
    };
    await call(
      command({
        op: "recover",
        kind: "patients",
        key: p.id,
        payload: p,
        reason: "Recuperação revisada de cópia de teste",
      }),
    );
    assert.equal(
      (await call({ op: "read" })).patients.find((x) => x._key === p.id).number,
      42,
    );
    await assert.rejects(
      call(
        command({
          op: "recover",
          kind: "patients",
          key: p.id,
          payload: { ...p, number: 43 },
          reason: "Segunda tentativa de recuperação",
        }),
      ),
      (e) => e.code === "40001",
    );
  });
  await test("surgery, separate discharge, delivery and rehospitalization with audit", async () => {
    let p = (await call(create("Fluxo completo"))).record;
    for (const [action, payload] of [
      [
        "CIRURGIA_CONFIRMADA",
        { veterinarian: "Dra. Teste", surgeryNotes: "OK" },
      ],
      ["ALTA", { dischargeVeterinarian: "", dischargeNotes: "Orientar tutor" }],
      ["ENTREGUE", { deliveryNotes: "Orientado" }],
      [
        "REINTERNADO_APOS_ENTREGA",
        { location: "BOX", locationNumber: "4", reinternedNotes: "Retorno" },
      ],
    ]) {
      p = (
        await call(
          command({
            op: "update",
            kind: "patients",
            key: p._key,
            expectedRevision: p._revision,
            action,
            payload,
          }),
        )
      ).record;
    }
    assert.equal(p.timeline.length, 5);
    assert.equal(p.dischargeStatus, null);
    assert.ok(p.deliveredAt);
  });
  await test("legacy bulk writers blocked at database; failed transaction consumes no number", async () => {
    await assert.rejects(
      pool.query(
        "UPDATE shared_records SET payload=payload||'{\"number\":999}' WHERE record_key='legacy-a'",
      ),
      (e) => e.code === "42501",
    );
    const before = await call({ op: "read" });
    const bad = create("Falha");
    bad.payload.procedures = ["INEXISTENTE"];
    await assert.rejects(call(bad));
    const after = await call({ op: "read" });
    assert.equal(after.nextPatientNumber, before.nextPatientNumber);
    assert.equal(after.patients.length, before.patients.length);
  });
  await test("catalog price change never rewrites patient snapshot; exact stored decimal", async () => {
    const before = await call({ op: "read" }),
      p = before.patients.find((x) => x.patientName === "Fluxo completo"),
      catalog = before.procedures.find((p) => p._key === "castracao");
    await call(
      command({
        op: "update",
        kind: "procedures",
        key: catalog._key,
        expectedRevision: catalog._revision,
        payload: { name: "Castração", value: 150.2 },
      }),
    );
    assert.equal(
      (await call({ op: "read" })).patients.find((x) => x._key === p._key)
        .totalValue,
      100.1,
    );
    assert.equal((await call(create("Preço novo"))).record.totalValue, 150.2);
  });
  await writeFile(
    "tests/evidence/database.json",
    JSON.stringify(
      {
        postgres: (await pool.query("SELECT version()")).rows[0].version,
        passed: evidence,
        date: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
