import { handle, json, body, requireAdmin, str, HttpError } from "@/lib/api";
import { C } from "@/lib/db";
import { oid } from "@/lib/services";
import { randomToken } from "@/lib/text";

export const PUT = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const b = await body<Record<string, unknown>>(req);
  const set: Record<string, unknown> = {};
  if (b.name !== undefined) set.name = str(b.name, "Name", { max: 120 });
  if (b.email !== undefined) set.email = str(b.email, "Email", { max: 200 }).toLowerCase();
  if (b.firm !== undefined) set.firm = str(b.firm, "Firm", { optional: true, max: 120 });
  if (b.role !== undefined) set.role = str(b.role, "Role", { optional: true, max: 120 });
  if (b.regenerateToken) set.passToken = randomToken(22);
  const col = await C.attendees();
  const r = await col.findOneAndUpdate({ _id: oid(id) }, { $set: set }, { returnDocument: "after" });
  if (!r) throw new HttpError(404, "Attendee not found");
  return json({ attendee: { id: r._id.toString(), name: r.name, email: r.email, firm: r.firm || "", role: r.role || "", passToken: r.passToken } });
});

export const DELETE = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const attendeeId = oid(id);
  await Promise.all([
    (await C.presence()).deleteMany({ attendeeId }), (await C.unlocks()).deleteMany({ attendeeId }),
    (await C.chats()).deleteMany({ attendeeId }), (await C.summaries()).deleteMany({ attendeeId }),
  ]);
  await (await C.attendees()).deleteOne({ _id: attendeeId });
  return json({ ok: true });
});
