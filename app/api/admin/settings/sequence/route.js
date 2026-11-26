import { command } from "../../../../../lib/operations";
export { GET } from "../../../sync/shared/route";
export const runtime = "nodejs";
export async function PATCH(request) {
  return command(request, (b) => ({ ...b, op: "configure" }));
}
