import { handle, json, body, requireAdmin, str } from "@/lib/api";
import { C } from "@/lib/db";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const ev = (await (await C.settings()).findOne({ _id: "event" })) as { name?: string; date?: string; venue?: string } | null;
  return json({ event: { name: ev?.name || process.env.NEXT_PUBLIC_EVENT_NAME || "Investor Day", date: ev?.date || "", venue: ev?.venue || "" } });
});
export const PUT = handle(async (req) => {
  await requireAdmin(req);
  const b = await body(req);
  const ev = { _id: "event" as const, name: str(b.name, "Name", { max: 120 }), date: str(b.date, "Date", { optional: true, max: 60 }), venue: str(b.venue, "Venue", { optional: true, max: 160 }), updatedAt: new Date() };
  await (await C.settings()).replaceOne({ _id: "event" }, ev, { upsert: true });
  return json({ event: ev });
});
