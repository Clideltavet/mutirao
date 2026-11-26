import { adminCommand } from "../../../../lib/adminOperations";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { requireAccess } from "../../../../lib/serverAuth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAccess("CADASTROS");
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sql = db();
  const rows = await sql`
    SELECT id, name, description, accesses, revision
    FROM roles
    ORDER BY name ASC
  `;
  return NextResponse.json({ roles: rows });
}

export async function POST(request) {
  return adminCommand(request, "roles");
}

export async function PATCH(request) {
  return adminCommand(request, "roles");
}

export async function DELETE(request) {
  return adminCommand(request, "roles");
}
