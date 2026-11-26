import { NextResponse } from "next/server";
export function middleware(request) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (
      origin &&
      origin !== request.nextUrl.origin &&
      new URL(origin).host !== request.headers.get("host")
    )
      return NextResponse.json(
        { error: "Origem não autorizada." },
        { status: 403 },
      );
    if (
      !(request.headers.get("content-type") || "").startsWith(
        "application/json",
      )
    )
      return NextResponse.json({ error: "Use JSON." }, { status: 415 });
  }
  return NextResponse.next();
}
export const config = { matcher: "/api/:path*" };
