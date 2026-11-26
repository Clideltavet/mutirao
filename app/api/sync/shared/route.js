import { NextResponse } from "next/server";
import { actorForRequest, execute, failure } from "../../../../lib/operations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const actor = await actorForRequest();
    if (!actor)
      return NextResponse.json(
        { error: "Entre no sistema ou pareie a TV." },
        { status: 401 },
      );
    if (!actor.accesses?.length)
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    return NextResponse.json(await execute({ op: "read" }, actor), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Envio de snapshots desativado. Atualize esta página. Dados locais foram preservados.",
    },
    { status: 410 },
  );
}
