import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, readSession } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth/")) return NextResponse.next();

  const s = await readSession(req.cookies.get(COOKIE)?.value);
  if (s && s.memberId > 0) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: s ? "Pick a profile first" : "Not signed in" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
