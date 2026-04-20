import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */
export async function POST() {
  const cookie = clearSessionCookie();
  const response = NextResponse.json({ success: true });
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    maxAge: cookie.maxAge,
  });
  return response;
}
