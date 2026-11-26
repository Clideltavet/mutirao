import { command } from "../../../lib/operations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request) {
  return command(request, (b) => ({ ...b, op: "create", kind: "patients" }));
}
