import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "./db";
import { requireAccess } from "./serverAuth";
import { hashPassword } from "./password";
import { failure } from "./operations";
const accesses = [
  "ENTRADA",
  "PACIENTES",
  "SAIDA",
  "RECEPCAO",
  "CIRURGIA",
  "MASTER",
  "RELATORIOS",
  "CADASTROS",
];
export async function adminCommand(request, entity) {
  try {
    const auth = await requireAccess("CADASTROS");
    if (!auth.ok)
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json(),
      verb = request.method;
    if (verb === "POST") body.id = crypto.randomUUID();
    if (!body.id) throw new Error("INVALID_ID");
    if (
      body.accesses &&
      (!Array.isArray(body.accesses) ||
        body.accesses.some((a) => !accesses.includes(a)))
    )
      throw new Error("INVALID_ACCESS");
    if (verb !== "DELETE" && entity === "roles" && !body.name?.trim())
      throw new Error("INVALID_NAME");
    if (
      verb === "POST" &&
      entity === "users" &&
      (!body.name?.trim() || !body.username?.trim() || !body.password)
    )
      throw new Error("INVALID_USER");
    const password = body.newPassword || body.password;
    if (password) {
      if (password.length < 8 || password.length > 128)
        throw new Error("Senha nova deve ter entre 8 e 128 caracteres.");
      body.passwordHash = await hashPassword(password);
    }
    delete body.password;
    delete body.newPassword;
    const sql = db();
    const rows =
      await sql`SELECT delta2_admin(${entity},${verb},${JSON.stringify(body)}::jsonb,${JSON.stringify(auth.user)}::jsonb) AS data`;
    return NextResponse.json(rows[0].data);
  } catch (e) {
    return failure(e);
  }
}
