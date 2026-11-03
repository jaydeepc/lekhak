import { ObjectId } from "mongodb";
import { handle, json, requireAdmin } from "@/lib/api";
import { C } from "@/lib/db";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const limit = Math.min(200, parseInt(req.nextUrl.searchParams.get("limit") || "60", 10) || 60);
  const items = await (await C.chats()).find({}).sort({ createdAt: -1 }).limit(limit * 2).toArray();
  const names = new Map((await (await C.attendees()).find({ _id: { $in: Array.from(new Set(items.map((i) => i.attendeeId.toString()))).map((x) => new ObjectId(x)) } }, { projection: { name: 1, firm: 1 } }).toArray()).map((a) => [a._id.toString(), { name: a.name, firm: a.firm || "" }]));
  // pair user→assistant
  const asc = items.reverse();
  const pairs: { id: string; attendee: string; firm: string; question: string; answer: string; sources: unknown[]; at: Date }[] = [];
  for (let i = 0; i < asc.length; i++) {
    const m = asc[i];
    if (m.role !== "user") continue;
    const a = asc.slice(i + 1).find((x) => x.role === "assistant" && x.attendeeId.equals(m.attendeeId));
    const who = names.get(m.attendeeId.toString());
    pairs.push({ id: m._id.toString(), attendee: who?.name || "Unknown", firm: who?.firm || "", question: m.text, answer: a?.text || "", sources: a?.sources || [], at: m.createdAt });
  }
  return json({ questions: pairs.reverse().slice(0, limit) });
});
