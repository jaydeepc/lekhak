import { handle, json, body, requireAdmin, HttpError } from "@/lib/api";
import { C, bucket } from "@/lib/db";
import { oid, publicSession } from "@/lib/services";
import { parseSession } from "../route";

export const PUT = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const col = await C.sessions();
  const existing = await col.findOne({ _id: oid(id) });
  if (!existing) throw new HttpError(404, "Session not found");
  const data = parseSession(await body(req), existing);
  await col.updateOne({ _id: existing._id }, { $set: { ...data, updatedAt: new Date() } });
  const s = (await col.findOne({ _id: existing._id }))!;
  return json({ session: { ...publicSession(s), code: s.code } });
});

export const DELETE = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const sessionId = oid(id);
  const docs = await (await C.documents()).find({ sessionId }).toArray();
  const b = await bucket();
  for (const d of docs) if (d.fileId) await b.delete(d.fileId).catch(() => {});
  await Promise.all([
    (await C.documents()).deleteMany({ sessionId }), (await C.chunks()).deleteMany({ sessionId }),
    (await C.segments()).deleteMany({ sessionId }), (await C.presence()).deleteMany({ sessionId }),
    (await C.unlocks()).deleteMany({ sessionId }), (await C.summaries()).deleteMany({ sessionId }),
  ]);
  await (await C.sessions()).deleteOne({ _id: sessionId });
  return json({ ok: true });
});
