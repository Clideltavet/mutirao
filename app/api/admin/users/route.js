import { adminCommand } from "../../../../lib/adminOperations";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { hashPassword } from "../../../../lib/password";
import { requireAccess } from "../../../../lib/serverAuth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAccess("CADASTROS");
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sql = db();
  const rows = await sql`
    SELECT
      u.id,
      u.name,
      u.username,
      u.role_id,
      u.accesses,
      u.active,
      u.created_at,
      u.revision,
      r.name AS role_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    ORDER BY u.name ASC
  `;

  return NextResponse.json({
    users: rows.map((row) => ({
      id: row.id,
      revision: row.revision,
      name: row.name,
      username: row.username,
      roleId: row.role_id,
      roleName: row.role_name,
      accesses: Array.isArray(row.accesses) ? row.accesses : [],
      active: row.active,
      createdAt: row.created_at,
    })),
  });
}

export async function POST(request) {
  return adminCommand(request, "users");
}

export async function PATCH(request) {
  return adminCommand(request, "users");
}

export async function DELETE(request) {
  return adminCommand(request, "users");
}
