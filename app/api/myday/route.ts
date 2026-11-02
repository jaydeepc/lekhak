import { ObjectId } from "mongodb";
import { handle, json, requireAttendee } from "@/lib/api";
import { myDay } from "@/lib/services";

export const maxDuration = 120;
export const GET = handle(async (req) => {
  const att = await requireAttendee(req);
  const d = await myDay(new ObjectId(att.sub));
  return json(d);
});
