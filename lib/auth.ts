import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
export const ATTENDEE_COOKIE = "lekhak_att";
export const ADMIN_COOKIE = "lekhak_admin";

export async function sign(payload: Record<string, unknown>, ttlSeconds: number) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds).sign(secret);
}

export async function verify<T = Record<string, unknown>>(token: string | undefined | null): Promise<T | null> {
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, secret); return payload as T; } catch { return null; }
}

export type AttendeeClaims = { sub: string; name: string; kind: "attendee" };
export type AdminClaims = { sub: string; kind: "admin" };

function tokenFrom(req: NextRequest | undefined, name: string, jar?: Awaited<ReturnType<typeof cookies>>) {
  if (req) return req.cookies.get(name)?.value;
  return jar?.get(name)?.value;
}

export async function getAttendee(req?: NextRequest): Promise<AttendeeClaims | null> {
  const jar = req ? undefined : await cookies();
  const c = await verify<AttendeeClaims>(tokenFrom(req, ATTENDEE_COOKIE, jar));
  return c && c.kind === "attendee" ? c : null;
}

export async function getAdmin(req?: NextRequest): Promise<AdminClaims | null> {
  const jar = req ? undefined : await cookies();
  const c = await verify<AdminClaims>(tokenFrom(req, ADMIN_COOKIE, jar));
  return c && c.kind === "admin" ? c : null;
}

export function cookieOpts(maxAge: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge };
}

export const ATTENDEE_TTL = 60 * 60 * 24 * 30; // 30 days
export const ADMIN_TTL = 60 * 60 * 12; // 12 hours

/** HMAC-signed, expiring access token for one document (lets an external viewer fetch the file without a cookie). */
export async function signFileAccess(documentId: string, ttlSeconds = 6 * 3600): Promise<string> {
  // Expiry snaps to the next bucket boundary so every attendee gets the same URL (one CDN cache entry per deck).
  const exp = (Math.floor(Date.now() / 1000 / ttlSeconds) + 2) * ttlSeconds;
  const data = new TextEncoder().encode(`${documentId}.${exp}`);
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = Buffer.from(await crypto.subtle.sign("HMAC", key, data)).toString("base64url");
  return `${exp}.${mac}`;
}
export async function verifyFileAccess(documentId: string, sig: string | null): Promise<boolean> {
  if (!sig) return false;
  const [expStr, mac] = sig.split(".");
  const exp = parseInt(expStr, 10);
  if (!exp || !mac || exp < Math.floor(Date.now() / 1000)) return false;
  const data = new TextEncoder().encode(`${documentId}.${exp}`);
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, Buffer.from(mac, "base64url"), data);
}
