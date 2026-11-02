import { ObjectId } from "mongodb";
import { handle, json, body, requireAdmin, str, HttpError } from "@/lib/api";
import { C } from "@/lib/db";
import { randomToken } from "@/lib/text";
import type { AttendeeDoc } from "@/lib/types";

function pub(a: AttendeeDoc) {
  return { id: a._id.toString(), name: a.name, email: a.email, firm: a.firm || "", role: a.role || "", passToken: a.passToken, createdAt: a.createdAt, lastSeenAt: a.lastSeenAt || null, signedInAt: a.signedInAt || null };
}

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const list = await (await C.attendees()).find({}).sort({ name: 1 }).toArray();
  const asked = await (await C.chats()).aggregate<{ _id: ObjectId; n: number }>([{ $match: { role: "user" } }, { $group: { _id: "$attendeeId", n: { $sum: 1 } } }]).toArray();
  const unlocked = await (await C.unlocks()).aggregate<{ _id: ObjectId; n: number }>([{ $group: { _id: "$attendeeId", n: { $sum: 1 } } }]).toArray();
  const qa = new Map(asked.map((x) => [x._id.toString(), x.n])), un = new Map(unlocked.map((x) => [x._id.toString(), x.n]));
  return json({ attendees: list.map((a) => ({ ...pub(a), questions: qa.get(a._id.toString()) || 0, unlocked: un.get(a._id.toString()) || 0 })) });
});

/** POST one attendee {name,email,firm,role} or many {attendees:[…]} (CSV import). */
export const POST = handle(async (req) => {
  await requireAdmin(req);
  const b = await body<Record<string, unknown>>(req);
  const rows = Array.isArray(b.attendees) ? (b.attendees as Record<string, unknown>[]) : [b];
  if (!rows.length) throw new HttpError(400, "Nothing to import");
  const col = await C.attendees();
  const created: AttendeeDoc[] = [], skipped: string[] = [];
  for (const r of rows.slice(0, 2000)) {
    const email = str(r.email, "Email", { max: 200 }).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { skipped.push(email); continue; }
    const doc: AttendeeDoc = { _id: new ObjectId(), name: str(r.name, "Name", { max: 120 }), email, firm: str(r.firm, "Firm", { optional: true, max: 120 }), role: str(r.role, "Role", { optional: true, max: 120 }), passToken: randomToken(22), createdAt: new Date(), lastSeenAt: null, signedInAt: null };
    try { await col.insertOne(doc); created.push(doc); } catch { skipped.push(email); }
  }
  return json({ created: created.map(pub), skipped }, { status: 201 });
});
