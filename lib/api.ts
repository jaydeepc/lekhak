import { NextResponse, type NextRequest } from "next/server";
import { getAdmin, getAttendee, type AdminClaims, type AttendeeClaims } from "./auth";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers || {}) } });
}

export function handle(fn: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>) {
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, { status: e.status });
      console.error("[api]", e);
      const msg = e instanceof Error ? e.message : "Unexpected error";
      return json({ error: msg }, { status: 500 });
    }
  };
}

export async function requireAdmin(req: NextRequest): Promise<AdminClaims> {
  const a = await getAdmin(req);
  if (!a) throw new HttpError(401, "Admin sign-in required");
  return a;
}

export async function requireAttendee(req: NextRequest): Promise<AttendeeClaims> {
  const a = await getAttendee(req);
  if (!a) throw new HttpError(401, "Please sign in");
  return a;
}

export async function requireAny(req: NextRequest): Promise<{ admin?: AdminClaims; attendee?: AttendeeClaims }> {
  const [admin, attendee] = await Promise.all([getAdmin(req), getAttendee(req)]);
  if (!admin && !attendee) throw new HttpError(401, "Sign-in required");
  return { admin: admin || undefined, attendee: attendee || undefined };
}

export async function body<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try { return (await req.json()) as T; } catch { throw new HttpError(400, "Invalid JSON body"); }
}

export function str(v: unknown, name: string, opts: { max?: number; optional?: boolean } = {}): string {
  if (v === undefined || v === null || v === "") { if (opts.optional) return ""; throw new HttpError(400, `${name} is required`); }
  if (typeof v !== "string") throw new HttpError(400, `${name} must be a string`);
  const s = v.trim();
  if (opts.max && s.length > opts.max) throw new HttpError(400, `${name} is too long`);
  return s;
}
