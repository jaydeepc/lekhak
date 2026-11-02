import { NextResponse, type NextRequest } from "next/server";
import { C } from "@/lib/db";
import { oid, sessionNowOffsetMs } from "@/lib/services";

/**
 * Live transcript feed, polled by every phone in the room about once a second.
 * Cached at the CDN for 1 s per distinct `after`, so a 500-person room costs the origin ~1–2 requests/second.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const after = Math.max(0, parseInt(req.nextUrl.searchParams.get("after") || "0", 10) || 0);
  const headers = { "Cache-Control": "public, s-maxage=1, stale-while-revalidate=2", "CDN-Cache-Control": "public, s-maxage=1, stale-while-revalidate=2" };
  try {
    const s = await (await C.sessions()).findOne({ _id: oid(id) }, { projection: { status: 1, lastSeq: 1, liveStartedAt: 1, liveEndedAt: 1, liveInterim: 1 } });
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404, headers: { "Cache-Control": "public, s-maxage=10" } });
    const lastSeq = s.lastSeq || 0;
    const segs = lastSeq > after
      ? await (await C.segments()).find({ sessionId: s._id, seq: { $gt: after } }, { projection: { seq: 1, text: 1, offsetMs: 1 } }).sort({ seq: 1 }).limit(300).toArray()
      : [];
    return NextResponse.json(
      { status: s.status, lastSeq, nowOffsetMs: sessionNowOffsetMs(s as Parameters<typeof sessionNowOffsetMs>[0]), serverTime: Date.now(), interim: s.status === "live" ? s.liveInterim || "" : "", segments: segs.map((g) => ({ seq: g.seq, text: g.text, offsetMs: g.offsetMs })) },
      { headers },
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
