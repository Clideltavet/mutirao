import { NextResponse } from "next/server";
import { requireAccess } from "../../../../lib/serverAuth";
import { db } from "../../../../lib/db";
import { randomToken, tokenHash } from "../../../../lib/password";
export async function POST() {
  const auth = await requireAccess("MASTER");
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const token = randomToken(),
    expires = new Date(Date.now() + 90 * 86400000),
    sql = db();
  await sql`INSERT INTO delta_devices(token_hash,name,created_by,expires_at) VALUES(${tokenHash(token)},'TV Sala de Cirurgia',${auth.user.id},${expires.toISOString()})`;
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: "delta_tv_device",
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.DELTA_ISOLATED_TEST !== "1",
    path: "/",
    expires,
  });
  return response;
}
