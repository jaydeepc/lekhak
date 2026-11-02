import { NextResponse } from "next/server";
import { handle, body, HttpError } from "@/lib/api";
import { sign, ADMIN_COOKIE, ADMIN_TTL, cookieOpts } from "@/lib/auth";

export const POST = handle(async (req) => {
  const b = await body<{ username?: string; password?: string }>(req);
  const u = process.env.ADMIN_USERNAME || "admin", p = process.env.ADMIN_PASSWORD;
  if (!p) throw new HttpError(500, "ADMIN_PASSWORD is not configured");
  if ((b.username || "").trim() !== u || b.password !== p) throw new HttpError(401, "Wrong username or password");
  const token = await sign({ sub: u, kind: "admin" }, ADMIN_TTL);
  const res = NextResponse.json({ ok: true, username: u });
  res.cookies.set(ADMIN_COOKIE, token, cookieOpts(ADMIN_TTL));
  return res;
});

export const GET = handle(async (req) => {
  const { getAdmin } = await import("@/lib/auth");
  const a = await getAdmin(req);
  return NextResponse.json({ admin: a ? { username: a.sub } : null });
});
