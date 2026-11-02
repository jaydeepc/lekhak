import { ObjectId } from "mongodb";
import { C } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { getAttendee } from "@/lib/auth";

export const GET = handle(async (req) => {
  const c = await getAttendee(req);
  if (!c) return json({ attendee: null });
  const a = await (await C.attendees()).findOne({ _id: new ObjectId(c.sub) });
  if (!a) return json({ attendee: null });
  return json({ attendee: { id: a._id.toString(), name: a.name, email: a.email, firm: a.firm || "" } });
});
