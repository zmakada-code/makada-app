import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware — no auth required.
 *
 * Makada Properties is a private internal tool. Anyone with access to the
 * deployed URL can use it. The tenant-facing Replit site handles its own
 * Supabase auth separately.
 *
 * Public API routes are still served normally.
 */
export async function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
