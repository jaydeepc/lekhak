import { ObjectId } from "mongodb";
import { C } from "./db";
import type { SessionDoc, SegmentDoc, SummaryDoc } from "./types";
import { fmtOffset, cosine } from "./text";
import { embed, summarise, threeLines, type DeckContext, type TalkContext } from "./gemini";

export function oid(id: string): ObjectId {
  if (!ObjectId.isValid(id)) throw new Error("Invalid id");
  return new ObjectId(id);
}

export function publicSession(s: SessionDoc) {
  return {
    id: s._id.toString(), slug: s.slug, title: s.title, tagline: s.tagline || "", description: s.description || "",
    speaker: s.speaker || "", speakerTitle: s.speakerTitle || "", room: s.room, kind: s.kind,
    startAt: s.startAt, endAt: s.endAt, image: s.image, alwaysOpen: s.alwaysOpen, status: s.status,
    liveStartedAt: s.liveStartedAt || null, liveEndedAt: s.liveEndedAt || null, lastSeq: s.lastSeq || 0, order: s.order,
  };
}
export type PublicSession = ReturnType<typeof publicSession>;

export async function listSessions(): Promise<SessionDoc[]> {
  const s = await C.sessions();
  return s.find({}).sort({ order: 1, startAt: 1 }).toArray();
}

/** Sessions this attendee may ask Lekhak about: alwaysOpen ones, unlocked ones, and ones they were present in. */
export async function accessibleSessionIds(attendeeId: ObjectId): Promise<Set<string>> {
  const [sessions, unlocks, presence] = await Promise.all([
    (await C.sessions()).find({}, { projection: { _id: 1, alwaysOpen: 1 } }).toArray(),
    (await C.unlocks()).find({ attendeeId }, { projection: { sessionId: 1 } }).toArray(),
    (await C.presence()).find({ attendeeId }, { projection: { sessionId: 1 } }).toArray(),
  ]);
  const set = new Set<string>();
  for (const s of sessions) if (s.alwaysOpen) set.add(s._id.toString());
  for (const u of unlocks) set.add(u.sessionId.toString());
  for (const p of presence) set.add(p.sessionId.toString());
  return set;
}

export async function heartbeat(attendeeId: ObjectId, sessionId: ObjectId) {
  const p = await C.presence();
  const now = new Date();
  // extend the latest window if it ended < 90s ago, else start a new one
  const last = await p.findOne({ attendeeId, sessionId }, { sort: { to: -1 } });
  if (last && now.getTime() - last.to.getTime() < 90_000) await p.updateOne({ _id: last._id }, { $set: { to: now } });
  else await p.insertOne({ _id: new ObjectId(), attendeeId, sessionId, from: now, to: now });
  await (await C.attendees()).updateOne({ _id: attendeeId }, { $set: { lastSeenAt: now } });
}

export async function unlock(attendeeId: ObjectId, sessionId: ObjectId, via: "scan" | "code" | "live" | "admin") {
  const u = await C.unlocks();
  try { await u.insertOne({ _id: new ObjectId(), attendeeId, sessionId, via, at: new Date() }); return true; }
  catch { return false; } // already unlocked
}

export async function appendSegments(sessionId: ObjectId, items: { text: string; offsetMs: number }[]): Promise<number> {
  const s = await C.sessions();
  const seg = await C.segments();
  let last = 0;
  for (const it of items) {
    const text = it.text.trim();
    if (!text) continue;
    const r = await s.findOneAndUpdate({ _id: sessionId }, { $inc: { lastSeq: 1 }, $set: { updatedAt: new Date() } }, { returnDocument: "after" });
    if (!r) throw new Error("Session not found");
    last = r.lastSeq;
    await seg.insertOne({ _id: new ObjectId(), sessionId, seq: last, text, offsetMs: Math.max(0, Math.round(it.offsetMs)), createdAt: new Date() });
  }
  return last;
}

export function sessionNowOffsetMs(s: SessionDoc): number {
  if (!s.liveStartedAt) return 0;
  const end = s.status === "live" ? Date.now() : (s.liveEndedAt?.getTime() || Date.now());
  return end - s.liveStartedAt.getTime();
}

/* ---------------- chat context ---------------- */
export async function buildChatContext(opts: { attendeeId: ObjectId; question: string; focusSessionId?: string | null }) {
  const allowed = await accessibleSessionIds(opts.attendeeId);
  const sessions = (await listSessions()).filter((s) => allowed.has(s._id.toString()));
  // Prioritise: focus session, then live sessions, then by recency of live start
  const focus = opts.focusSessionId || null;
  sessions.sort((a, b) => {
    const fa = a._id.toString() === focus ? 0 : 1, fb = b._id.toString() === focus ? 0 : 1;
    if (fa !== fb) return fa - fb;
    const la = a.status === "live" ? 0 : 1, lb = b.status === "live" ? 0 : 1;
    if (la !== lb) return la - lb;
    return (b.liveStartedAt?.getTime() || 0) - (a.liveStartedAt?.getTime() || 0);
  });
  const withTranscript = sessions.filter((s) => (s.lastSeq || 0) > 0);
  const seg = await C.segments();
  const talks: TalkContext[] = [];
  let budget = 90_000; // chars of transcript across sessions
  for (const s of withTranscript.slice(0, 6)) {
    const lines = await seg.find({ sessionId: s._id }).sort({ seq: 1 }).toArray();
    let txt = lines.map((l) => ({ t: fmtOffset(l.offsetMs), text: l.text }));
    let size = txt.reduce((n, l) => n + l.text.length + 10, 0);
    if (size > budget) {
      // keep the most recent part
      const keep: typeof txt = [];
      let acc = 0;
      for (let i = txt.length - 1; i >= 0 && acc < budget; i--) { keep.unshift(txt[i]); acc += txt[i].text.length + 10; }
      txt = keep; size = acc;
    }
    budget -= size;
    talks.push({ sessionId: s._id.toString(), title: s.title, speaker: s.speaker || "", live: s.status === "live", nowOffset: fmtOffset(sessionNowOffsetMs(s)), lines: txt });
    if (budget <= 0) break;
  }
  // Deck retrieval across accessible sessions
  const chunks = await C.chunks();
  const sessionIds = sessions.map((s) => s._id);
  const decks: DeckContext[] = [];
  if (sessionIds.length) {
    const total = await chunks.countDocuments({ sessionId: { $in: sessionIds } });
    if (total > 0) {
      const [qv] = await embed([opts.question], { attendeeId: opts.attendeeId.toString() });
      const all = await chunks.find({ sessionId: { $in: sessionIds } }, { projection: { embedding: 1, documentId: 1, sessionId: 1, page: 1, title: 1, text: 1, numbers: 1 } }).toArray();
      const scored = all.map((c) => ({ c, score: cosine(qv, c.embedding) })).sort((a, b) => b.score - a.score).slice(0, 8).filter((x) => x.score > 0.35);
      const docs = await (await C.documents()).find({ _id: { $in: scored.map((x) => x.c.documentId) } }, { projection: { name: 1 } }).toArray();
      const byDoc = new Map(docs.map((d) => [d._id.toString(), d.name]));
      const bySess = new Map(sessions.map((s) => [s._id.toString(), s.title]));
      for (const { c } of scored) decks.push({ documentId: c.documentId.toString(), documentName: byDoc.get(c.documentId.toString()) || "Deck", sessionId: c.sessionId.toString(), sessionTitle: bySess.get(c.sessionId.toString()) || "", page: c.page, title: c.title, text: c.text.slice(0, 2500), numbers: c.numbers });
    }
  }
  return { talks, decks, sessions };
}

/* ---------------- My day ---------------- */
export async function myDay(attendeeId: ObjectId) {
  const [sessions, presence, unlocks, chats, existing] = await Promise.all([
    listSessions(),
    (await C.presence()).find({ attendeeId }).toArray(),
    (await C.unlocks()).find({ attendeeId }).toArray(),
    (await C.chats()).find({ attendeeId, role: "user" }).sort({ createdAt: -1 }).limit(50).toArray(),
    (await C.summaries()).find({ attendeeId }).toArray(),
  ]);
  const seg = await C.segments();
  const sumCol = await C.summaries();
  const byId = new Map(existing.map((s) => [s.sessionId.toString(), s]));
  const attended: { session: SessionDoc; minutes: number; windows: { from: Date; to: Date }[]; unlocked: boolean }[] = [];
  for (const s of sessions) {
    const wins = presence.filter((p) => p.sessionId.equals(s._id)).map((p) => ({ from: p.from, to: p.to }));
    const minutes = Math.round(wins.reduce((n, w) => n + (w.to.getTime() - w.from.getTime()), 0) / 60000);
    const unlocked = unlocks.some((u) => u.sessionId.equals(s._id));
    if (wins.length || unlocked) attended.push({ session: s, minutes, windows: wins, unlocked });
  }
  const notes: { session: ReturnType<typeof publicSession>; minutes: number; unlocked: boolean; summary: SummaryDoc | null; segmentsHeard: number }[] = [];
  for (const a of attended) {
    const s = a.session;
    if (!s.liveStartedAt || !(s.lastSeq > 0)) { notes.push({ session: publicSession(s), minutes: a.minutes, unlocked: a.unlocked, summary: byId.get(s._id.toString()) || null, segmentsHeard: 0 }); continue; }
    // Segments the attendee was in the room for (±2 min slack). If they unlocked by scanning, give them the whole talk.
    const all = await seg.find({ sessionId: s._id }).sort({ seq: 1 }).toArray();
    const start = s.liveStartedAt.getTime();
    const heard: SegmentDoc[] = a.unlocked ? all : all.filter((g) => {
      const at = start + g.offsetMs;
      return a.windows.some((w) => at >= w.from.getTime() - 120_000 && at <= w.to.getTime() + 120_000);
    });
    const prev = byId.get(s._id.toString()) || null;
    const latestSeq = heard.length ? heard[heard.length - 1].seq : 0;
    const stale = !prev || (latestSeq - prev.upToSeq >= 4) || (s.status === "ended" && latestSeq > prev.upToSeq) || (Date.now() - prev.createdAt.getTime() > 4 * 60_000 && latestSeq > prev.upToSeq);
    const recent = prev && Date.now() - prev.createdAt.getTime() < 45_000;
    let summary = prev;
    const heardChars = heard.reduce((n, g) => n + g.text.length, 0);
    if (heard.length >= 1 && heardChars >= 160 && stale && !recent) {
      try {
        const out = await summarise({ title: s.title, speaker: s.speaker || "", lines: heard.map((g) => ({ t: fmtOffset(g.offsetMs), text: g.text })), attendeeId: attendeeId.toString(), sessionId: s._id.toString() });
        const doc: SummaryDoc = { _id: prev?._id || new ObjectId(), attendeeId, sessionId: s._id, upToSeq: latestSeq, headline: out.headline, points: out.points, numbers: out.numbers, createdAt: new Date() };
        await sumCol.replaceOne({ attendeeId, sessionId: s._id }, doc, { upsert: true });
        summary = doc;
      } catch (e) { console.error("summarise failed", e); }
    }
    notes.push({ session: publicSession(s), minutes: a.minutes, unlocked: a.unlocked, summary, segmentsHeard: heard.length });
  }
  notes.sort((x, y) => new Date(x.session.startAt).getTime() - new Date(y.session.startAt).getTime());
  const withSummary = notes.filter((n) => n.summary);
  let lines = "";
  if (withSummary.length) {
    try { lines = await threeLines({ notes: withSummary.map((n) => ({ title: n.session.title, headline: n.summary!.headline, points: n.summary!.points.map((p) => p.point) })), attendeeId: attendeeId.toString() }); } catch { /* ignore */ }
  }
  return {
    notes,
    threeLines: lines,
    questions: chats.reverse().map((c) => ({ id: c._id.toString(), text: c.text, at: c.createdAt })),
    totals: { sessions: sessions.length, attended: notes.length, minutes: notes.reduce((n, x) => n + x.minutes, 0), questions: chats.length },
  };
}
