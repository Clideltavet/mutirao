import { chromium } from "playwright";
import chromiumBinary from "@sparticuz/chromium";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import crypto from "node:crypto";
const base = "http://127.0.0.1:3000";
for (let i = 0; i < 120; i++) {
  try {
    await fetch(base);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROMIUM_PATH || (await chromiumBinary.executablePath()),
  args: chromiumBinary.args.filter(
    (x) =>
      ![
        "--single-process",
        "--disable-web-security",
        "--allow-running-insecure-content",
      ].includes(x),
  ),
});
const results = [],
  errors = [];
async function check(name, fn) {
  await fn();
  results.push(name);
  console.log("PASS", name);
}
async function device(user = "admin") {
  const c = await browser.newContext();
  const p = await c.newPage();
  p.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("BROWSER ERROR", e.message);
  });
  await p.goto(base);
  await p.waitForTimeout(1500);
  await p.getByPlaceholder("Digite seu usuário").fill(user);
  await p.getByPlaceholder("Digite sua senha").fill("DeltaTest123!");
  await p.getByRole("button", { name: "ENTRAR", exact: true }).click();
  await p.waitForFunction(
    () => !!sessionStorage.getItem("deltaVetTabletSession"),
  );
  return { c, p };
}
async function snap(c) {
  const r = await c.request.get(base + "/api/sync/shared");
  assert.equal(r.status(), 200);
  return r.json();
}
async function api(c, cmd) {
  return c.request.post(base + "/api/records", {
    data: { requestId: crypto.randomUUID(), expectedRevision: 0, ...cmd },
  });
}
async function fill(p, name) {
  await p.getByPlaceholder("Ex.: Thor, Mel, Sem nome...").fill(name);
  await p.getByRole("button", { name: "FELINO", exact: true }).click();
  await p.getByLabel("Macho", { exact: true }).check();
  await p.locator(".client-select-row select").selectOption("tutor-teste");
  await p.getByLabel("Caixa", { exact: true }).check();
  await p.locator(".procedures-grid select").first().selectOption("Castração");
}
try {
  const a = await device(),
    b = await device();
  await check(
    "real login, HttpOnly session and authenticated read",
    async () => {
      const cookies = await a.c.cookies();
      assert.ok(
        cookies.some((c) => c.name === "delta_vet_session" && c.httpOnly),
      );
      assert.ok((await snap(a.c)).patients.length);
      const bad = await a.c.request.post(base + "/api/auth/login", {
        data: { username: "admin", password: "invalid" },
      });
      assert.equal(bad.status(), 401);
    },
  );
  await check(
    "anonymous and reception cannot write; snapshot POST disabled; CSRF origin blocked",
    async () => {
      const anon = await browser.newContext();
      assert.equal(
        (await anon.request.get(base + "/api/sync/shared")).status(),
        401,
      );
      assert.equal(
        (
          await anon.request.post(base + "/api/sync/shared", {
            data: { patients: [] },
          })
        ).status(),
        410,
      );
      const rec = await device("recepcao");
      const p = (await snap(a.c)).patients[0];
      const denied = await api(rec.c, {
        op: "delete",
        kind: "patients",
        key: p._key,
        expectedRevision: p._revision,
        reason: "Unauthorized test",
      });
      assert.equal(denied.status(), 403);
      const data = await snap(rec.c);
      assert.equal(data.auditLog, undefined);
      assert.ok(data.patients.every((p) => !("totalValue" in p)));
      assert.equal(
        (
          await a.c.request.post(base + "/api/records", {
            headers: { Origin: "https://invalid.example" },
            data: {},
          })
        ).status(),
        403,
      );
      await rec.c.close();
      await anon.close();
    },
  );
  await check(
    "two independent browser devices submit simultaneously through real Next API",
    async () => {
      await Promise.all([
        a.p.goto(base + "/entrada"),
        b.p.goto(base + "/entrada"),
      ]);
      await Promise.all([fill(a.p, "Browser A"), fill(b.p, "Browser B")]);
      await Promise.all([
        a.p.getByRole("button", { name: "ENVIAR", exact: true }).click(),
        b.p.getByRole("button", { name: "ENVIAR", exact: true }).click(),
      ]);
      await a.p.getByText(/enviado com sucesso/).waitFor();
      await b.p.getByText(/enviado com sucesso/).waitFor();
      const ps = (await snap(a.c)).patients.filter((p) =>
        /^Browser [AB]$/.test(p.patientName || ""),
      );
      assert.equal(ps.length, 2);
      assert.notEqual(ps[0].number, ps[1].number);
    },
  );
  await check(
    "offline save has no success; persisted draft survives reload and reconnect without duplication",
    async () => {
      await fill(a.p, "Offline draft");
      await a.c.setOffline(true);
      await a.p.getByRole("button", { name: "ENVIAR", exact: true }).click();
      await a.p
        .getByRole("button", { name: "RETOMAR ENVIO", exact: true })
        .waitFor();
      assert.ok(
        !(await snap(b.c)).patients.some(
          (p) => p.patientName === "Offline draft",
        ),
      );
      await a.c.setOffline(false);
      await a.p.reload();
      await a.p
        .getByRole("button", { name: "RETOMAR ENVIO", exact: true })
        .click();
      await a.p.getByText(/enviado com sucesso/).waitFor();
      assert.equal(
        (await snap(b.c)).patients.filter(
          (p) => p.patientName === "Offline draft",
        ).length,
        1,
      );
    },
  );
  await check(
    "committed response lost: browser retries same persisted request after refresh",
    async () => {
      await fill(a.p, "Lost response");
      let lost = false;
      await a.p.route("**/api/records", async (route) => {
        if (!lost) {
          lost = true;
          await route.fetch();
          await route.abort("failed");
        } else await route.continue();
      });
      await a.p.getByRole("button", { name: "ENVIAR", exact: true }).click();
      await a.p
        .getByRole("button", { name: "RETOMAR ENVIO", exact: true })
        .waitFor();
      await a.p.unroute("**/api/records");
      await a.p.reload();
      await a.p
        .getByRole("button", { name: "RETOMAR ENVIO", exact: true })
        .click();
      await a.p.getByText(/enviado com sucesso/).waitFor();
      assert.equal(
        (await snap(b.c)).patients.filter(
          (p) => p.patientName === "Lost response",
        ).length,
        1,
      );
    },
  );
  await check(
    "legacy localStorage retained and never imported by automatic/manual synchronization",
    async () => {
      await a.p.evaluate(() =>
        localStorage.setItem(
          "deltaVetPatients",
          JSON.stringify([
            { id: "local-only", number: 888, notes: "Preservar" },
          ]),
        ),
      );
      await a.p.reload();
      await a.p.waitForTimeout(5500);
      assert.equal(
        await a.p.evaluate(
          () => JSON.parse(localStorage.getItem("deltaVetPatients"))[0].id,
        ),
        "local-only",
      );
      assert.ok(!(await snap(a.c)).patients.some((p) => p.id === "local-only"));
    },
  );
  await check(
    "edit route addresses identity; finance price survives editing old patient",
    async () => {
      await a.p.goto(base + "/pacientes/legacy-a/editar");
      await a.p.getByPlaceholder("Nome do paciente").fill("Antigo A editado");
      await a.p
        .getByRole("button", { name: "SALVAR ALTERAÇÕES", exact: true })
        .click();
      await a.p.waitForURL("**/pacientes/legacy-a");
      const d = await snap(a.c);
      assert.equal(
        d.patients.find((p) => p._key === "legacy-a").totalValue,
        80,
      );
      assert.equal(
        d.patients.find((p) => p._key === "legacy-b").patientName,
        "Antigo B",
      );
    },
  );
  await check(
    "CMS reports, export, permissions and all existing screens render",
    async () => {
      for (const path of [
        "/master",
        "/master/cadastros",
        "/master/cadastros/clientes",
        "/master/cadastros/procedimentos",
        "/master/cadastros/veterinarios",
        "/master/cadastros/adicionais",
        "/master/cadastros/funcionarios",
        "/master/cadastros/funcoes",
        "/master/configuracoes",
        "/master/relatorios",
        "/configuracoes",
        "/saida",
        "/pacientes",
        "/recepcao",
        "/cirurgia",
      ]) {
        await a.p.goto(base + path);
        await a.p.locator("main").waitFor();
      }
      await a.p.goto(base + "/master/relatorios");
      await a.p.getByRole("button", { name: "TODO HISTÓRICO" }).click();
      const download = a.p.waitForEvent("download");
      await a.p.getByRole("button", { name: "EXPORTAR CSV" }).click();
      const f = await download;
      assert.ok(f.suggestedFilename().endsWith(".csv"));
    },
  );
  await check(
    "admin user/role operations require revisions and block privilege escalation",
    async () => {
      const low = await device("cadastros");
      const denied = await low.c.request.post(base + "/api/admin/users", {
        data: {
          name: "Escalation",
          username: "escalation",
          password: "FakeTest123!",
          roleId: "admin",
          accesses: ["MASTER"],
        },
      });
      assert.equal(denied.status(), 403);
      const r = await b.c.request.post(base + "/api/admin/users", {
        data: {
          name: "Temp user",
          username: "temp-user",
          password: "FakeTest123!",
          roleId: "entrada",
          accesses: ["ENTRADA"],
        },
      });
      assert.equal(r.status(), 200);
      const u = (await r.json()).record;
      const changes = await Promise.all(
        [true, false].map((active) =>
          b.c.request.patch(base + "/api/admin/users", {
            data: { id: u.id, active, expectedRevision: Number(u.revision) },
          }),
        ),
      );
      assert.deepEqual(changes.map((r) => r.status()).sort(), [200, 409]);
      const users = await (
          await b.c.request.get(base + "/api/admin/users")
        ).json(),
        v = users.users.find((x) => x.id === u.id);
      assert.equal(
        (
          await b.c.request.delete(base + "/api/admin/users", {
            data: { id: u.id, expectedRevision: Number(v.revision) },
          })
        ).status(),
        200,
      );
      const role = await b.c.request.post(base + "/api/admin/roles", {
        data: {
          name: "Test role",
          description: "Isolated",
          accesses: ["ENTRADA"],
        },
      });
      assert.equal(role.status(), 200);
      const ro = (await role.json()).record;
      assert.equal(
        (
          await b.c.request.patch(base + "/api/admin/roles", {
            data: {
              id: ro.id,
              name: "Test role revised",
              description: "Isolated",
              accesses: ["ENTRADA"],
              expectedRevision: Number(ro.revision),
            },
          })
        ).status(),
        200,
      );
      assert.equal(
        (
          await b.c.request.delete(base + "/api/admin/roles", {
            data: { id: ro.id, expectedRevision: Number(ro.revision) },
          })
        ).status(),
        409,
      );
      await low.c.close();
    },
  );
  await check(
    "financial CSV matches confirmed historical total; no current-price repricing",
    async () => {
      await b.p.goto(base + "/master/relatorios");
      await b.p.getByRole("button", { name: "TODO HISTÓRICO" }).click();
      const download = b.p.waitForEvent("download");
      await b.p.getByRole("button", { name: "EXPORTAR CSV" }).click();
      const f = await download;
      const stream = await f.createReadStream();
      let csv = "";
      for await (const chunk of stream) csv += chunk.toString();
      assert.ok(csv.includes("Antigo A editado"));
      assert.ok(csv.includes("80,00"));
      const rows = csv
        .replace(/^\ufeff/, "")
        .trim()
        .split("\n")
        .slice(1);
      const total = rows.reduce((n, row) => {
        const fields = row.match(/"(?:[^"]|"")*"/g) || [];
        const value = (fields[8] || "").slice(1, -1).replace(",", ".");
        return (
          n +
          (Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : 0)
        );
      }, 0);
      const official = (await snap(b.c)).patients.reduce(
        (sum, p) =>
          sum +
          (p.totalValue != null ? Math.round(Number(p.totalValue) * 100) : 0),
        0,
      );
      assert.equal(total, official);
    },
  );
  await check(
    "paired TV works after logout, cannot edit finance or create patients",
    async () => {
      assert.equal(
        (await a.c.request.post(base + "/api/tv/pair", { data: {} })).status(),
        200,
      );
      assert.equal(
        (
          await a.c.request.post(base + "/api/auth/logout", { data: {} })
        ).status(),
        200,
      );
      const d = await snap(a.c);
      assert.equal(d.clients, undefined);
      assert.ok(
        d.patients.every((p) => !("phone" in p) && !("totalValue" in p)),
      );
      await a.p.goto(base + "/cirurgia");
      await a.p
        .getByRole("heading", { name: "PAINEL CIRÚRGICO DELTA VET" })
        .waitFor();
      const denied = await api(a.c, {
        op: "create",
        kind: "patients",
        key: crypto.randomUUID(),
        payload: {
          species: "FELINO",
          sex: "Macho",
          tutorName: "x",
          location: "BOX",
        },
      });
      assert.equal(denied.status(), 403);
    },
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "tests/evidence/browser.json",
    JSON.stringify(
      {
        passed: results,
        errors,
        date: new Date().toISOString(),
        note: "No API/auth/database mocks. Only network fault injection uses route interception after real commit.",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
