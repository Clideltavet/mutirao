import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import {
  hashPassword as _unused,
  randomToken,
  tokenHash,
  verifyPassword,
} from "../../../../lib/password";
import { SESSION_COOKIE } from "../../../../lib/serverAuth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "")
      .trim()
      .toLowerCase();
    const password = String(body?.password || "");
    const requiredAccess = body?.requiredAccess
      ? String(body.requiredAccess)
      : null;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Informe usuário e senha." },
        { status: 400 },
      );
    }

    const sql = db();
    if (username.length > 100 || password.length > 128)
      return NextResponse.json(
        { error: "Credenciais inválidas." },
        { status: 400 },
      );
    const limitKey = tokenHash("login:" + username);
    const limit =
      await sql`INSERT INTO delta_login_limits(key,attempts,window_start) VALUES(${limitKey},1,now())
      ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN delta_login_limits.window_start<now()-interval '10 minutes' THEN 1 ELSE delta_login_limits.attempts+1 END,
       window_start=CASE WHEN delta_login_limits.window_start<now()-interval '10 minutes' THEN now() ELSE delta_login_limits.window_start END RETURNING attempts`;
    if (limit[0].attempts > 20)
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde 10 minutos." },
        { status: 429 },
      );
    const rows = await sql`
      SELECT
        u.id,
        u.name,
        u.username,
        u.password_hash,
        u.active,
        u.accesses,
        u.role_id,
        r.name AS role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE LOWER(u.username) = ${username}
      LIMIT 1
    `;

    const user = rows[0];
    if (
      !user ||
      !user.active ||
      !(await verifyPassword(password, user.password_hash))
    ) {
      return NextResponse.json(
        { error: "Usuário ou senha inválidos." },
        { status: 401 },
      );
    }

    const accesses = Array.isArray(user.accesses) ? user.accesses : [];
    if (requiredAccess && !accesses.includes(requiredAccess)) {
      return NextResponse.json(
        { error: "Este usuário não possui acesso a esta área." },
        { status: 403 },
      );
    }

    const rawToken = randomToken();
    const hash = tokenHash(rawToken);
    const sessionId = crypto.randomUUID();
    const expires = new Date(Date.now() + 12 * 60 * 60 * 1000);

    await sql`DELETE FROM sessions WHERE expires_at <= NOW()`;
    await sql`
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES (${sessionId}, ${user.id}, ${hash}, ${expires.toISOString()})
    `;

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        roleId: user.role_id,
        roleName: user.role_name,
        accesses,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE,
      value: rawToken,
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production" &&
        process.env.DELTA_ISOLATED_TEST !== "1",
      path: "/",
      expires,
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Erro ao autenticar no banco." },
      { status: 500 },
    );
  }
}
