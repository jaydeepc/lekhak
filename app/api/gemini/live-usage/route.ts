import { handle, json, body, requireAny } from "@/lib/api";
import { logUsage, LIVE_MODEL } from "@/lib/gemini";

export const POST = handle(async (req) => {
  const who = await requireAny(req);
  const b = await body<{ audioSeconds?: number; sessionId?: string }>(req);
  const secs = Math.min(600, Math.max(0, Number(b.audioSeconds) || 0));
  if (secs > 0) await logUsage({ kind: "live", model: LIVE_MODEL, audioSeconds: secs, attendeeId: who.attendee?.sub || null, sessionId: b.sessionId || null });
  return json({ ok: true });
});
