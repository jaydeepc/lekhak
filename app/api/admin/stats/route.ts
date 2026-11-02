import { handle, json, requireAdmin } from "@/lib/api";
import { C } from "@/lib/db";
import { listSessions, publicSession } from "@/lib/services";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const since = new Date(Date.now() - 2 * 60_000);
  const [attendees, online, signedIn, questions, sessions, segments, costAgg, docs] = await Promise.all([
    (await C.attendees()).countDocuments(),
    (await C.attendees()).countDocuments({ lastSeenAt: { $gte: since } }),
    (await C.attendees()).countDocuments({ signedInAt: { $ne: null } }),
    (await C.chats()).countDocuments({ role: "user" }),
    listSessions(),
    (await C.segments()).countDocuments(),
    (await C.usage()).aggregate<{ _id: null; cost: number }>([{ $group: { _id: null, cost: { $sum: "$costUsd" } } }]).toArray(),
    (await C.documents()).countDocuments({ status: "ready" }),
  ]);
  const presenceNow = await (await C.presence()).aggregate<{ _id: unknown; n: number }>([{ $match: { to: { $gte: since } } }, { $group: { _id: "$sessionId", n: { $sum: 1 } } }]).toArray();
  const inRoom = new Map(presenceNow.map((p) => [String(p._id), p.n]));
  return json({
    attendees, online, signedIn, questions, segments, documents: docs, costUsd: costAgg[0]?.cost || 0,
    sessions: sessions.map((s) => ({ ...publicSession(s), inRoom: inRoom.get(s._id.toString()) || 0 })),
  });
});
