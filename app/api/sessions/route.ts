import { ObjectId } from "mongodb";
import { handle, json } from "@/lib/api";
import { getAttendee } from "@/lib/auth";
import { C } from "@/lib/db";
import { accessibleSessionIds, listSessions, publicSession } from "@/lib/services";

export const GET = handle(async (req) => {
  const [sessions, att] = await Promise.all([listSessions(), getAttendee(req)]);
  let access = new Set<string>();
  if (att) access = await accessibleSessionIds(new ObjectId(att.sub));
  const docs = await (await C.documents()).find({ status: "ready" }, { projection: { sessionId: 1, pages: 1 } }).toArray();
  const deckPages = new Map<string, number>();
  for (const d of docs) deckPages.set(d.sessionId.toString(), (deckPages.get(d.sessionId.toString()) || 0) + (d.pages || 0));
  const ev = (await (await C.settings()).findOne({ _id: "event" })) as { name?: string; date?: string; venue?: string } | null;
  return json({
    event: { name: ev?.name || process.env.NEXT_PUBLIC_EVENT_NAME || "Investor Day", date: ev?.date || "", venue: ev?.venue || "" },
    now: new Date(),
    sessions: sessions.map((s) => ({ ...publicSession(s), open: att ? access.has(s._id.toString()) : s.alwaysOpen, deckPages: deckPages.get(s._id.toString()) || 0 })),
  });
});
