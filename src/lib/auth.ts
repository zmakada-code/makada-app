import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/*  Config                                                            */
/* ------------------------------------------------------------------ */

const ADMIN_EMAIL = "mzancapital@gmail.com";
const ADMIN_PASSWORD_HASH =
  "$2b$12$me.2zYiMh1V//c8j8R01BuhjCQCCenlBD7unyGLeu3WLvkq/pDF6y";

function getJwtSecret() {
  const raw =
    process.env.AUTH_JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "makada-fallback-secret-change-me";
  return new TextEncoder().encode(raw);
}

const SESSION_COOKIE = "makada_session";
const PENDING_COOKIE = "makada_2fa_pending";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const CODE_MAX_AGE = 60 * 10; // 10 minutes

/* ------------------------------------------------------------------ */
/*  Password verification                                             */
/* ------------------------------------------------------------------ */

export async function verifyCredentials(email: string, password: string) {
  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return false;
  return bcrypt.compare(password, ADMIN_PASSWORD_HASH);
}

/* ------------------------------------------------------------------ */
/*  2FA code — stateless via HMAC cookie                              */
/* ------------------------------------------------------------------ */

function getHmacKey() {
  return process.env.AUTH_JWT_SECRET || "makada-hmac-key";
}

export function generate2FACode(): {
  code: string;
  token: string;
  expiresAt: number;
} {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Math.floor(Date.now() / 1000) + CODE_MAX_AGE;
  const payload = `${code}:${expiresAt}`;
  const hmac = crypto
    .createHmac("sha256", getHmacKey())
    .update(payload)
    .digest("hex");
  const token = `${expiresAt}:${hmac}`;
  return { code, token, expiresAt };
}

export function verify2FACode(submittedCode: string, token: string): boolean {
  try {
    const [expiresAtStr, storedHmac] = token.split(":");
    const expiresAt = Number(expiresAtStr);
    if (Date.now() / 1000 > expiresAt) return false;

    const payload = `${submittedCode}:${expiresAt}`;
    const hmac = crypto
      .createHmac("sha256", getHmacKey())
      .update(payload)
      .digest("hex");

    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(storedHmac));
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Session JWT                                                       */
/* ------------------------------------------------------------------ */

export async function createSessionToken() {
  return new SignJWT({ email: ADMIN_EMAIL, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Cookie helpers                                                    */
/* ------------------------------------------------------------------ */

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function pendingCookieOptions(token: string) {
  return {
    name: PENDING_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: CODE_MAX_AGE,
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export function clearPendingCookie() {
  return {
    name: PENDING_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export { SESSION_COOKIE, PENDING_COOKIE, ADMIN_EMAIL };
