import { NextResponse } from "next/server";
import { C } from "@/lib/db";
import { listSessions, publicSession } from "@/lib/services";

/**
 * Public agenda. No cookies read, no per-user data, so Vercel's CDN caches it for a few seconds:
 * 500 phones polling every 3 s cost the origin roughly one request per 3 s.
 */
export async function GET() {
  try {
    const [sessions, docs, ev] = await Promise.all([
      listSessions(),
      (await C.documents()).find({ status: "ready" }, { projection: { sessionId: 1, pages: 1, processedAt: 1 } }).toArray(),
      (await C.settings()).findOne({ _id: "event" }) as Promise<{ name?: string; date?: string; venue?: string } | null>,
    ]);
    const deckPages = new Map<string, number>(), deckVersion = new Map<string, number>();
    for (const d of docs) {
      const k = d.sessionId.toString();
      deckPages.set(k, (deckPages.get(k) || 0) + (d.pages || 0));
      deckVersion.set(k, Math.max(deckVersion.get(k) || 0, d.processedAt ? new Date(d.processedAt).getTime() : 0) + (d.pages || 0));
    }
    return NextResponse.json(
      {
        event: { name: ev?.name || process.env.NEXT_PUBLIC_EVENT_NAME || "Investor Day", date: ev?.date || "", venue: ev?.venue || "" },
        now: new Date(),
        sessions: sessions.map((s) => ({ ...publicSession(s), deckPages: deckPages.get(s._id.toString()) || 0, deckVersion: deckVersion.get(s._id.toString()) || 0 })),
      },
      { headers: { "Cache-Control": "public, s-maxage=3, stale-while-revalidate=15", "CDN-Cache-Control": "public, s-maxage=3, stale-while-revalidate=15" } },
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
