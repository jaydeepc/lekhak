import { handle, json, requireAdmin, HttpError } from "@/lib/api";
import { bucket, C } from "@/lib/db";
import { oid } from "@/lib/services";

export const DELETE = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const docs = await C.documents();
  const d = await docs.findOne({ _id: oid(id) });
  if (!d) throw new HttpError(404, "Document not found");
  const b = await bucket();
  if (d.fileId) await b.delete(d.fileId).catch(() => {});
  for await (const f of b.find({ "metadata.documentId": d._id })) await b.delete(f._id).catch(() => {});
  await (await C.chunks()).deleteMany({ documentId: d._id });
  await docs.deleteOne({ _id: d._id });
  await (await C.sessions()).updateOne({ _id: d.sessionId }, { $set: { updatedAt: new Date() } });
  return json({ ok: true });
});
