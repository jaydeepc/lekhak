import { ObjectId } from "mongodb";
import { handle, json, body, requireAdmin } from "@/lib/api";
import { C } from "@/lib/db";
import { DEFAULT_PRICING, getPricing, invalidatePricing } from "@/lib/pricing";
import type { Pricing } from "@/lib/types";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const u = await C.usage();
  const pricing = await getPricing();
  const since = new Date(Date.now() - 24 * 3600_000);
  const [byKind, byHour, total, today, topAttendees, recent] = await Promise.all([
    u.aggregate<{ _id: { kind: string; model: string }; cost: number; calls: number; promptTokens: number; outputTokens: number; audioSeconds: number }>([
      { $group: { _id: { kind: "$kind", model: "$model" }, cost: { $sum: "$costUsd" }, calls: { $sum: 1 }, promptTokens: { $sum: "$promptTokens" }, outputTokens: { $sum: "$outputTokens" }, audioSeconds: { $sum: "$audioSeconds" } } },
      { $sort: { cost: -1 } },
    ]).toArray(),
    u.aggregate<{ _id: string; cost: number; calls: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%dT%H:00", date: "$createdAt", timezone: "Asia/Kolkata" } }, cost: { $sum: "$costUsd" }, calls: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    u.aggregate<{ _id: null; cost: number; calls: number }>([{ $group: { _id: null, cost: { $sum: "$costUsd" }, calls: { $sum: 1 } } }]).toArray(),
    u.aggregate<{ _id: null; cost: number; calls: number }>([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: null, cost: { $sum: "$costUsd" }, calls: { $sum: 1 } } }]).toArray(),
    u.aggregate<{ _id: ObjectId; cost: number; calls: number }>([{ $match: { attendeeId: { $ne: null } } }, { $group: { _id: "$attendeeId", cost: { $sum: "$costUsd" }, calls: { $sum: 1 } } }, { $sort: { cost: -1 } }, { $limit: 8 }]).toArray(),
    u.find({}).sort({ createdAt: -1 }).limit(25).toArray(),
  ]);
  const names = new Map((await (await C.attendees()).find({ _id: { $in: topAttendees.map((t) => t._id) } }, { projection: { name: 1 } }).toArray()).map((a) => [a._id.toString(), a.name]));
  return json({
    pricing,
    total: total[0] || { cost: 0, calls: 0 },
    last24h: today[0] || { cost: 0, calls: 0 },
    byKind: byKind.map((k) => ({ kind: k._id.kind, model: k._id.model, cost: k.cost, calls: k.calls, promptTokens: k.promptTokens, outputTokens: k.outputTokens, audioSeconds: k.audioSeconds })),
    byHour: byHour.map((h) => ({ hour: h._id, cost: h.cost, calls: h.calls })),
    topAttendees: topAttendees.map((t) => ({ name: names.get(t._id.toString()) || "Unknown", cost: t.cost, calls: t.calls })),
    recent: recent.map((r) => ({ kind: r.kind, model: r.model, cost: r.costUsd, promptTokens: r.promptTokens, outputTokens: r.outputTokens, audioSeconds: r.audioSeconds, at: r.createdAt })),
  });
});

export const PUT = handle(async (req) => {
  await requireAdmin(req);
  const b = await body<Partial<Pricing>>(req);
  const num = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : d);
  const p: Pricing = {
    ...DEFAULT_PRICING,
    chatInputPerM: num(b.chatInputPerM, DEFAULT_PRICING.chatInputPerM), chatOutputPerM: num(b.chatOutputPerM, DEFAULT_PRICING.chatOutputPerM),
    embedPerM: num(b.embedPerM, DEFAULT_PRICING.embedPerM), liveAudioPerMin: num(b.liveAudioPerMin, DEFAULT_PRICING.liveAudioPerMin), liveTextPerMin: num(b.liveTextPerMin, DEFAULT_PRICING.liveTextPerMin),
    inrPerUsd: num(b.inrPerUsd, DEFAULT_PRICING.inrPerUsd), updatedAt: new Date(),
  };
  await (await C.settings()).replaceOne({ _id: "pricing" }, p, { upsert: true });
  invalidatePricing();
  return json({ pricing: p });
});
