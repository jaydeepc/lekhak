import { ObjectId } from "mongodb";
import { handle, json, body, requireAdmin, str, HttpError } from "@/lib/api";
import { C } from "@/lib/db";
import { listSessions, publicSession } from "@/lib/services";
import { slugify, roomCode } from "@/lib/text";
import type { SessionDoc, SessionKind } from "@/lib/types";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const sessions = await listSessions();
  const docs = await (await C.documents()).find({}).sort({ createdAt: 1 }).toArray();
  const segCounts = await (await C.segments()).aggregate<{ _id: ObjectId; n: number }>([{ $group: { _id: "$sessionId", n: { $sum: 1 } } }]).toArray();
  const byS = new Map(segCounts.map((c) => [c._id.toString(), c.n]));
  return json({
    sessions: sessions.map((s) => ({
      ...publicSession(s), code: s.code || "", liveInterim: s.liveInterim || "", segments: byS.get(s._id.toString()) || 0,
      documents: docs.filter((d) => d.sessionId.equals(s._id)).map((d) => ({ id: d._id.toString(), name: d.name, status: d.status, pages: d.pages || 0, chunkCount: d.chunkCount || 0, size: d.size, error: d.error || "", createdAt: d.createdAt })),
    })),
  });
});

export function parseSession(b: Record<string, unknown>, existing?: SessionDoc): Omit<SessionDoc, "_id" | "createdAt" | "updatedAt" | "status" | "lastSeq" | "liveStartedAt" | "liveEndedAt"> {
  const title = str(b.title, "Title", { max: 120 });
  const kind = (["keynote", "booth", "panel", "break"].includes(String(b.kind)) ? String(b.kind) : "booth") as SessionKind;
  const startAt = new Date(String(b.startAt)), endAt = new Date(String(b.endAt));
  if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) throw new HttpError(400, "Start and end time are required");
  if (endAt <= startAt) throw new HttpError(400, "End time must be after start time");
  return {
    slug: existing?.slug || slugify(title),
    title, tagline: str(b.tagline, "Tagline", { optional: true, max: 200 }), description: str(b.description, "Description", { optional: true, max: 4000 }),
    speaker: str(b.speaker, "Speaker", { optional: true, max: 120 }), speakerTitle: str(b.speakerTitle, "Speaker title", { optional: true, max: 120 }),
    room: str(b.room, "Room", { max: 80 }), kind, startAt, endAt,
    image: str(b.image, "Image", { optional: true, max: 500 }) || "/assets/il-keynote.jpg",
    code: (str(b.code, "Code", { optional: true, max: 12 }) || existing?.code || roomCode()).toUpperCase(),
    alwaysOpen: Boolean(b.alwaysOpen),
    order: Number(b.order) || existing?.order || 0,
    liveInterim: existing?.liveInterim || "", liveInterimAt: existing?.liveInterimAt || null,
  };
}

export const POST = handle(async (req) => {
  await requireAdmin(req);
  const b = await body(req);
  const data = parseSession(b);
  const col = await C.sessions();
  // ensure unique slug
  let slug = data.slug, n = 2;
  while (await col.findOne({ slug })) slug = `${data.slug}-${n++}`;
  const count = await col.countDocuments();
  const doc: SessionDoc = { _id: new ObjectId(), ...data, slug, order: data.order || count + 1, status: "upcoming", lastSeq: 0, liveStartedAt: null, liveEndedAt: null, createdAt: new Date(), updatedAt: new Date() };
  await col.insertOne(doc);
  return json({ session: { ...publicSession(doc), code: doc.code } }, { status: 201 });
});
