import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "makada_session";

function getJwtSecret() {
  const raw =
    process.env.AUTH_JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "makada-fallback-secret-change-me";
  return new TextEncoder().encode(raw);
}

/**
 * Routes that should NEVER require auth:
 *  - /login            — the login page itself
 *  - /api/auth/*       — login & 2FA endpoints
 *  - /api/sign/*       — tenant signing links (token-based)
 *  - /api/tenant/*     — tenant portal API calls
 *  - /api/webhooks/*   — Stripe webhooks
 *  - /api/inquiry      — public inquiry intake
 *  - /sign/*           — tenant signing page (if it exists as a page route)
 */
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/sign",
  "/api/tenant",
  "/api/tenant-invite",
  "/api/webhooks",
  "/api/inquiry",
  "/api/inquiries",
  "/sign",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for session cookie
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Verify JWT
  try {
    await jwtVerify(token, getJwtSecret());
    return NextResponse.next();
  } catch {
    // Invalid or expired token — redirect to login
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match everything except static files and images.
     * This ensures API routes, pages, and all other paths go through auth.
     */
    "/((?!_next/static|_next/image|favicon.ico|property-photos|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
