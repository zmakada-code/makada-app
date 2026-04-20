import { NextResponse } from "next/server";
import {
  verifyCredentials,
  generate2FACode,
  pendingCookieOptions,
  ADMIN_EMAIL,
} from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 * Step 1: verify email + password, then send 2FA code via email.
 */
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const valid = await verifyCredentials(email, password);
    if (!valid) {
      // Generic error — don't reveal which field is wrong
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Generate 2FA code
    const { code, token } = generate2FACode();

    // Send the code via email
    try {
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `MZAN Capital — Login Code: ${code}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e293b; margin: 0 0 16px;">Login Verification</h2>
            <p style="color: #475569; font-size: 15px; margin: 0 0 24px;">
              Your verification code for MZAN Capital admin:
            </p>
            <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1e293b;">${code}</span>
            </div>
            <p style="color: #94a3b8; font-size: 13px; margin: 0;">
              This code expires in 10 minutes. If you didn't request this, ignore this email.
            </p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("[auth/login] Failed to send 2FA email:", emailErr);
      return NextResponse.json(
        { error: "Could not send verification email. Check Resend configuration." },
        { status: 500 }
      );
    }

    // Set the pending 2FA cookie (contains HMAC of the code)
    const response = NextResponse.json({
      success: true,
      message: "Verification code sent to your email",
    });
    const cookie = pendingCookieOptions(token);
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      maxAge: cookie.maxAge,
    });

    return response;
  } catch (err) {
    console.error("[auth/login] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
