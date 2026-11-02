import { ObjectId } from "mongodb";
import { handle, json, requireAttendee } from "@/lib/api";
import { accessibleSessionIds } from "@/lib/services";

/** Which sessions this attendee may open. Fetched rarely (on load, after an unlock, every minute). */
export const GET = handle(async (req) => {
  const att = await requireAttendee(req);
  const ids = await accessibleSessionIds(new ObjectId(att.sub));
  return json({ sessionIds: Array.from(ids) });
});
