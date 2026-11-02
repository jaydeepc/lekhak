import { ObjectId } from "mongodb";
import { handle, json, body, requireAttendee, str } from "@/lib/api";
import { heartbeat, oid } from "@/lib/services";

export const POST = handle(async (req) => {
  const att = await requireAttendee(req);
  const b = await body(req);
  const sessionId = oid(str(b.sessionId, "sessionId"));
  await heartbeat(new ObjectId(att.sub), sessionId);
  return json({ ok: true });
});
