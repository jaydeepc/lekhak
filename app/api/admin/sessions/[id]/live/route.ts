import { handle, json, body, requireAdmin, HttpError } from "@/lib/api";
import { C } from "@/lib/db";
import { oid, publicSession } from "@/lib/services";

/** Live control: start | pause | resume | end | reset */
export const POST = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const { action } = await body<{ action: string }>(req);
  const col = await C.sessions();
  const s = await col.findOne({ _id: oid(id) });
  if (!s) throw new HttpError(404, "Session not found");
  const now = new Date();
  const set: Record<string, unknown> = { updatedAt: now };
  if (action === "start") {
    if (s.status === "ended" && s.lastSeq > 0) {
      // resume an ended session: keep transcript, shift the clock so offsets stay continuous
      const elapsed = (s.liveEndedAt?.getTime() || now.getTime()) - (s.liveStartedAt?.getTime() || now.getTime());
      set.liveStartedAt = new Date(now.getTime() - elapsed);
    } else if (!s.liveStartedAt || s.status === "ended") set.liveStartedAt = now;
    set.status = "live"; set.liveEndedAt = null; set.liveInterim = "";
  } else if (action === "pause") { set.status = "paused"; set.liveInterim = ""; }
  else if (action === "resume") { set.status = "live"; }
  else if (action === "end") { set.status = "ended"; set.liveEndedAt = now; set.liveInterim = ""; }
  else if (action === "reset") {
    await (await C.segments()).deleteMany({ sessionId: s._id });
    await (await C.summaries()).deleteMany({ sessionId: s._id });
    set.status = "upcoming"; set.lastSeq = 0; set.liveStartedAt = null; set.liveEndedAt = null; set.liveInterim = "";
  } else throw new HttpError(400, "Unknown action");
  await col.updateOne({ _id: s._id }, { $set: set });
  const fresh = (await col.findOne({ _id: s._id }))!;
  return json({ session: { ...publicSession(fresh), code: fresh.code } });
});
