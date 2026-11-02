import type { NextRequest } from "next/server";
import { C } from "@/lib/db";
import { oid, sessionNowOffsetMs } from "@/lib/services";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Server-Sent Events: pushes new transcript segments, interim captions and status changes. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let sessionId;
  try { sessionId = oid(id); } catch { return new Response("bad id", { status: 400 }); }
  const url = req.nextUrl;
  let after = parseInt(req.headers.get("last-event-id") || url.searchParams.get("after") || "0", 10) || 0;
  const enc = new TextEncoder();
  const started = Date.now();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastState = "";
      let lastInterim = "";
      let lastPing = Date.now();
      const send = (event: string, data: unknown, idv?: number) => {
        if (closed) return;
        controller.enqueue(enc.encode(`${idv !== undefined ? `id: ${idv}\n` : ""}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const abort = () => { closed = true; try { controller.close(); } catch { /* already closed */ } };
      req.signal.addEventListener("abort", abort);
      send("hello", { after });
      while (!closed && Date.now() - started < (maxDuration - 10) * 1000) {
        try {
          const s = await (await C.sessions()).findOne({ _id: sessionId });
          if (!s) { send("error", { error: "Session not found" }); break; }
          const state = JSON.stringify({ status: s.status, nowOffsetMs: sessionNowOffsetMs(s), lastSeq: s.lastSeq || 0, liveStartedAt: s.liveStartedAt });
          if (state !== lastState) { lastState = state; send("state", JSON.parse(state)); }
          if ((s.lastSeq || 0) > after) {
            const segs = await (await C.segments()).find({ sessionId, seq: { $gt: after } }).sort({ seq: 1 }).limit(200).toArray();
            for (const g of segs) { after = g.seq; send("segment", { seq: g.seq, text: g.text, offsetMs: g.offsetMs }, g.seq); }
            lastInterim = "";
          }
          const interim = s.status === "live" ? s.liveInterim || "" : "";
          if (interim !== lastInterim) { lastInterim = interim; send("interim", { text: interim, at: s.liveInterimAt }); }
          if (Date.now() - lastPing > 15000) { lastPing = Date.now(); send("ping", { t: Date.now() }); }
        } catch (e) {
          send("error", { error: e instanceof Error ? e.message : "poll failed" });
        }
        await new Promise((r) => setTimeout(r, 600));
      }
      send("reconnect", { after });
      abort();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
