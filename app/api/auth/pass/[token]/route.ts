import { NextResponse } from "next/server";
import { C } from "@/lib/db";
import { handle, HttpError } from "@/lib/api";
import { sign, ATTENDEE_COOKIE, ATTENDEE_TTL, cookieOpts } from "@/lib/auth";

export const POST = handle(async (_req, ctx) => {
  const { token } = await ctx.params;
  const a = await (await C.attendees()).findOne({ passToken: token });
  if (!a) throw new HttpError(404, "This pass isn't recognised. Please check with the registration desk.");
  await (await C.attendees()).updateOne({ _id: a._id }, { $set: { signedInAt: new Date(), lastSeenAt: new Date() } });
  const jwt = await sign({ sub: a._id.toString(), name: a.name, kind: "attendee" }, ATTENDEE_TTL);
  const res = NextResponse.json({ ok: true, attendee: { id: a._id.toString(), name: a.name, email: a.email, firm: a.firm || "" } });
  res.cookies.set(ATTENDEE_COOKIE, jwt, cookieOpts(ATTENDEE_TTL));
  return res;
});
