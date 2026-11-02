import { NextResponse } from "next/server";
import { C } from "@/lib/db";
import { handle, body, str, HttpError } from "@/lib/api";
import { sign, ATTENDEE_COOKIE, ATTENDEE_TTL, cookieOpts } from "@/lib/auth";

export const POST = handle(async (req) => {
  const b = await body(req);
  const email = str(b.email, "Email", { max: 200 }).toLowerCase();
  const a = await (await C.attendees()).findOne({ email });
  if (!a) throw new HttpError(404, "We couldn't find an invitation for that email. Ask the registration desk to add you, or scan the QR on your pass.");
  await (await C.attendees()).updateOne({ _id: a._id }, { $set: { signedInAt: new Date(), lastSeenAt: new Date() } });
  const token = await sign({ sub: a._id.toString(), name: a.name, kind: "attendee" }, ATTENDEE_TTL);
  const res = NextResponse.json({ ok: true, attendee: { id: a._id.toString(), name: a.name, email: a.email, firm: a.firm || "" } });
  res.cookies.set(ATTENDEE_COOKIE, token, cookieOpts(ATTENDEE_TTL));
  return res;
});
