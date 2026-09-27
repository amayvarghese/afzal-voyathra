import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { timingSafeEqual, createHash } from "node:crypto";
import { env } from "./env";

export const SESSION_COOKIE = "fc_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secretKey() {
  const s = env.authSecret();
  if (s.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
  return new TextEncoder().encode(s);
}

function safeEqual(a: string, b: string) {
  // Hash first so lengths always match and nothing leaks through timing.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkCredentials(email: string, password: string): boolean {
  const adminEmail = env.adminEmail();
  const adminPassword = env.adminPassword();
  if (!adminEmail || !adminPassword) return false;
  const emailOk = safeEqual(email.trim().toLowerCase(), adminEmail);
  const passOk = safeEqual(password, adminPassword);
  return emailOk && passOk;
}

export async function createSession(email: string) {
  const token = await new SignJWT({ sub: email, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.role === "admin" && payload.sub === env.adminEmail();
  } catch {
    return false;
  }
}

export async function isAdmin(): Promise<boolean> {
  return verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Use at the top of every admin route handler (defence in depth behind proxy.ts). */
export async function requireAdmin(): Promise<Response | null> {
  if (await isAdmin()) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
