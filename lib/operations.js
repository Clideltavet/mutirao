import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "./db";
import { getSessionUser } from "./serverAuth";
import { tokenHash } from "./password";
export async function actorForRequest() {
  const user = await getSessionUser();
  if (user) return { ...user, type: "FUNCIONARIO" };
  const token = (await cookies()).get("delta_tv_device")?.value;
  if (!token) return null;
  const sql = db();
  const rows =
    await sql`SELECT token_hash,name FROM delta_devices WHERE token_hash=${tokenHash(token)} AND expires_at>now() AND revoked_at IS NULL`;
  return rows.length
    ? {
        id: "tv:" + rows[0].token_hash,
        name: rows[0].name,
        username: "tv-cirurgia",
        type: "TV",
        accesses: ["CIRURGIA"],
      }
    : null;
}
export function failure(e) {
  const conflict = e.code === "40001";
  const denied = e.code === "42501";
  console.error(
    "Delta operation failed",
    e.code || "error",
    String(e.message).slice(0, 100),
  );
  return NextResponse.json(
    {
      error: conflict
        ? "O registro mudou, já existe ou foi excluído. Recarregue e revise antes de tentar novamente."
        : denied
          ? "Acesso ou campo não autorizado."
          : e.message === "PRICE_UNAVAILABLE"
            ? "Procedimento sem preço confirmado no catálogo. Revise o cadastro."
            : "Operação não confirmada. Preserve os dados e tente novamente.",
      code: conflict
        ? "CONFLICT"
        : e.code === "42501"
          ? "FORBIDDEN"
          : "NOT_CONFIRMED",
    },
    { status: conflict ? 409 : denied ? 403 : 422 },
  );
}
export function project(data, actor) {
  const financial = actor.accesses.some((x) =>
    ["MASTER", "RELATORIOS"].includes(x),
  );
  const out = structuredClone(data);
  if (!financial) {
    for (const p of [
      ...(out.patients || []),
      ...(out.record ? [out.record] : []),
    ]) {
      delete p.totalValue;
      delete p.procedureDetails;
    }
    if (!actor.accesses.includes("CADASTROS"))
      for (const p of out.procedures || []) delete p.value;
    delete out.auditLog;
  }
  if (actor.type === "TV") {
    const fields = [
      "_key",
      "_revision",
      "number",
      "patientName",
      "species",
      "sex",
      "weight",
      "location",
      "locationNumber",
      "notes",
      "surgeryNotes",
      "dischargeNotes",
      "tutorName",
      "procedures",
      "status",
      "dischargeStatus",
      "createdAt",
      "confirmedAt",
      "veterinarian",
      "dischargeVeterinarian",
      "surgeryExtras",
    ];
    const pick = (p) =>
      Object.fromEntries(fields.filter((k) => k in p).map((k) => [k, p[k]]));
    out.patients = (out.patients || [])
      .filter(
        (p) =>
          new Date(p.createdAt).toLocaleDateString("en-CA", {
            timeZone: "America/Sao_Paulo",
          }) ===
          new Date().toLocaleDateString("en-CA", {
            timeZone: "America/Sao_Paulo",
          }),
      )
      .map(pick);
    if (out.record) out.record = pick(out.record);
    delete out.clients;
    delete out.auditLog;
    delete out.procedures;
  }
  return out;
}
export async function execute(cmd, actor) {
  const sql = db();
  const rows =
    await sql`SELECT delta2_apply(${JSON.stringify(cmd)}::jsonb,${JSON.stringify(actor)}::jsonb) AS data`;
  return project(rows[0].data, actor);
}
export async function command(request, transform = (x) => x) {
  try {
    const actor = await actorForRequest();
    if (!actor)
      return NextResponse.json(
        { error: "Não autenticado. Entre no sistema ou pareie a TV." },
        { status: 401 },
      );
    const text = await request.text();
    if (text.length > 200000)
      return NextResponse.json(
        { error: "Solicitação muito grande." },
        { status: 413 },
      );
    const cmd = transform(JSON.parse(text));
    if (
      !/^[a-zA-Z0-9-]{16,100}$/.test(cmd.requestId || "") ||
      !Number.isSafeInteger(cmd.expectedRevision) ||
      cmd.expectedRevision < 0
    )
      throw new Error("INVALID_REQUEST");
    if (
      !["create", "update", "delete", "configure", "recover"].includes(cmd.op)
    )
      throw new Error("INVALID_OPERATION");
    if (
      cmd.op !== "configure" &&
      (!cmd.key ||
        cmd.key.length > 250 ||
        !["patients", "clients", "procedures", "settings"].includes(cmd.kind))
    )
      throw new Error("INVALID_RECORD");
    const p = cmd.payload || {};
    if (Array.isArray(p) || typeof p !== "object" || p === null)
      throw new Error("INVALID_PAYLOAD");
    if (cmd.op === "create" && cmd.kind === "patients") {
      if (
        !["CANINO", "FELINO"].includes(p.species) ||
        !["Macho", "Fêmea", "Não sabe"].includes(p.sex) ||
        !p.tutorName?.trim() ||
        !["Caixa", "BOX"].includes(p.location)
      )
        throw new Error("INVALID_PATIENT");
      const fields = [
        "patientName",
        "species",
        "sex",
        "tutorName",
        "phone",
        "tutorCpf",
        "tutorEmail",
        "clientId",
        "weight",
        "location",
        "locationNumber",
        "procedures",
        "notes",
      ];
      cmd.payload = Object.fromEntries(
        fields.filter((k) => k in p).map((k) => [k, p[k]]),
      );
    }
    if (cmd.kind === "patients" && cmd.op !== "delete") {
      if (p.species !== undefined && !["CANINO", "FELINO"].includes(p.species))
        throw new Error("INVALID_SPECIES");
      if (
        p.sex !== undefined &&
        !["Macho", "Fêmea", "Não sabe"].includes(p.sex)
      )
        throw new Error("INVALID_SEX");
      if (p.location !== undefined && !["Caixa", "BOX"].includes(p.location))
        throw new Error("INVALID_LOCATION");
      for (const f of ["timeline", "surgeryExtras", "procedureDetails"])
        if (p[f] != null && !Array.isArray(p[f]))
          throw new Error("INVALID_ARRAY");
    }
    if (
      cmd.op === "configure" &&
      (!Number.isSafeInteger(cmd.nextPatientNumber) ||
        cmd.nextPatientNumber < 1 ||
        cmd.nextPatientNumber > 99999999)
    )
      throw new Error("INVALID_SEQUENCE");
    if (
      p.procedures &&
      (!Array.isArray(p.procedures) ||
        p.procedures.length > 4 ||
        p.procedures.some((x) => typeof x !== "string" || x.length > 100))
    )
      throw new Error("INVALID_PROCEDURES");
    if (
      cmd.kind === "procedures" &&
      cmd.op !== "delete" &&
      (!p.name?.trim() ||
        !Number.isFinite(p.value) ||
        p.value < 0 ||
        p.value > 10000000)
    )
      throw new Error("INVALID_PRICE");
    if (cmd.op !== "recover" && cmd.payload) {
      for (const k of ["_key", "_revision", "_syncUpdatedAt"])
        delete cmd.payload[k];
    }
    if (cmd.kind === "clients" && cmd.op !== "delete" && !p.name?.trim())
      throw new Error("INVALID_CLIENT");
    if (
      cmd.kind === "settings" &&
      (!["deltaVetVeterinarians", "deltaVetSurgeryExtras"].includes(cmd.key) ||
        !Array.isArray(p.value) ||
        p.value.some((x) => typeof x !== "string" || x.length > 120))
    )
      throw new Error("INVALID_SETTING");
    return NextResponse.json(await execute(cmd, actor), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
