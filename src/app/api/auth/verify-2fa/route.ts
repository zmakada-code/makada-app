import { NextRequest, NextResponse } from "next/server";
import {
  verify2FACode,
  createSessionToken,
  sessionCookieOptions,
  clearPendingCookie,
  PENDING_COOKIE,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify-2fa
 * Step 2: verify the 6-digit code, then issue a session cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Verification code is required" },
        { status: 400 }
      );
    }

    // Get the pending 2FA token from the cookie
    const pendingToken = request.cookies.get(PENDING_COOKIE)?.value;
    if (!pendingToken) {
      return NextResponse.json(
        { error: "No pending verification. Please log in again." },
        { status: 400 }
      );
    }

    // Verify the code against the HMAC
    const valid = verify2FACode(code.trim(), pendingToken);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid or expired code. Please try again." },
        { status: 401 }
      );
    }

    // Issue session token
    const sessionToken = await createSessionToken();
    const sessionCookie = sessionCookieOptions(sessionToken);
    const clearPending = clearPendingCookie();

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
    });

    // Set session cookie
    response.cookies.set(sessionCookie.name, sessionCookie.value, {
      httpOnly: sessionCookie.httpOnly,
      secure: sessionCookie.secure,
      sameSite: sessionCookie.sameSite,
      path: sessionCookie.path,
      maxAge: sessionCookie.maxAge,
    });

    // Clear the pending cookie
    response.cookies.set(clearPending.name, clearPending.value, {
      httpOnly: clearPending.httpOnly,
      secure: clearPending.secure,
      sameSite: clearPending.sameSite,
      path: clearPending.path,
      maxAge: clearPending.maxAge,
    });

    return response;
  } catch (err) {
    console.error("[auth/verify-2fa] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
