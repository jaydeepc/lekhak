import { handle, json, HttpError } from "@/lib/api";
import { C } from "@/lib/db";
import { oid, sessionNowOffsetMs } from "@/lib/services";

export const GET = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  const after = parseInt(req.nextUrl.searchParams.get("after") || "0", 10) || 0;
  const s = await (await C.sessions()).findOne({ _id: oid(id) });
  if (!s) throw new HttpError(404, "Session not found");
  const segs = await (await C.segments()).find({ sessionId: s._id, seq: { $gt: after } }).sort({ seq: 1 }).limit(500).toArray();
  return json({
    status: s.status, lastSeq: s.lastSeq || 0, nowOffsetMs: sessionNowOffsetMs(s), interim: s.status === "live" ? s.liveInterim || "" : "",
    segments: segs.map((g) => ({ seq: g.seq, text: g.text, offsetMs: g.offsetMs })),
  });
});
