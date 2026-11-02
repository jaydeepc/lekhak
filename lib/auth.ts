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
