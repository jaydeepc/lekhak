import { ObjectId } from "mongodb";
import { handle, json, requireAttendee } from "@/lib/api";
import { myDay } from "@/lib/services";

export const maxDuration = 120;
export const GET = handle(async (req) => {
  const att = await requireAttendee(req);
  // ?fast=1 returns whatever is already written up (instant); the full call generates missing notes.
  const d = await myDay(new ObjectId(att.sub), { generate: req.nextUrl.searchParams.get("fast") !== "1" });
  return json(d);
});
