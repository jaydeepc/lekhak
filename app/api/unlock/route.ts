import { ObjectId } from "mongodb";
import { handle, json, body, requireAttendee, HttpError } from "@/lib/api";
import { C } from "@/lib/db";
import { publicSession, unlock } from "@/lib/services";

export const POST = handle(async (req) => {
  const att = await requireAttendee(req);
  const b = await body<{ sessionId?: string; code?: string }>(req);
  const sessions = await C.sessions();
  let s = null;
  if (b.code) s = await sessions.findOne({ code: String(b.code).trim().toUpperCase() });
  else if (b.sessionId && ObjectId.isValid(b.sessionId)) s = await sessions.findOne({ _id: new ObjectId(b.sessionId) });
  if (!s) throw new HttpError(404, b.code ? "That code doesn't match a session." : "Session not found");
  if (b.sessionId && b.code && s.code && s.code !== String(b.code).toUpperCase()) throw new HttpError(400, "That code doesn't match this session.");
  const fresh = await unlock(new ObjectId(att.sub), s._id, b.code && !b.sessionId ? "code" : "scan");
  return json({ ok: true, fresh, session: publicSession(s) });
});
