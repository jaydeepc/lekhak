import { handle, json, body, requireAdmin, HttpError } from "@/lib/api";
import { C } from "@/lib/db";
import { appendSegments, oid } from "@/lib/services";

/** POST finalised transcript segments from the recorder; PATCH the interim caption. */
export const POST = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const b = await body<{ segments: { text: string; offsetMs: number }[] }>(req);
  if (!Array.isArray(b.segments)) throw new HttpError(400, "segments[] required");
  const lastSeq = await appendSegments(oid(id), b.segments.slice(0, 50).map((s) => ({ text: String(s.text || "").slice(0, 4000), offsetMs: Number(s.offsetMs) || 0 })));
  return json({ ok: true, lastSeq });
});

export const PATCH = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const b = await body<{ interim: string }>(req);
  await (await C.sessions()).updateOne({ _id: oid(id) }, { $set: { liveInterim: String(b.interim || "").slice(0, 1500), liveInterimAt: new Date() } });
  return json({ ok: true });
});

export const GET = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const segs = await (await C.segments()).find({ sessionId: oid(id) }).sort({ seq: 1 }).toArray();
  return json({ segments: segs.map((g) => ({ seq: g.seq, text: g.text, offsetMs: g.offsetMs, at: g.createdAt })) });
});

export const DELETE = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const seq = parseInt(req.nextUrl.searchParams.get("seq") || "", 10);
  if (!seq) throw new HttpError(400, "seq required");
  await (await C.segments()).deleteOne({ sessionId: oid(id), seq });
  return json({ ok: true });
});
