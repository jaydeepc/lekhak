import { ObjectId } from "mongodb";
import { handle, json, body, requireAttendee, str } from "@/lib/api";
import { C } from "@/lib/db";
import { buildChatContext } from "@/lib/services";
import { buildContextBlock, logUsage, SOURCES_MARK, streamChat, CHAT_MODEL, safeJson } from "@/lib/gemini";
import type { ChatSource } from "@/lib/types";

export const maxDuration = 120;

export const GET = handle(async (req) => {
  const att = await requireAttendee(req);
  const items = await (await C.chats()).find({ attendeeId: new ObjectId(att.sub) }).sort({ createdAt: -1 }).limit(40).toArray();
  return json({ messages: items.reverse().map((m) => ({ id: m._id.toString(), role: m.role, text: m.text, sources: m.sources || [], at: m.createdAt })) });
});

/** Streams plain text; the answer is followed by a <<<SOURCES>>> JSON block the client turns into cards. */
export const POST = handle(async (req) => {
  const att = await requireAttendee(req);
  const b = await body<{ question: string; sessionId?: string | null }>(req);
  const question = str(b.question, "Question", { max: 2000 });
  const attendeeId = new ObjectId(att.sub);
  const chats = await C.chats();
  const history = (await chats.find({ attendeeId }).sort({ createdAt: -1 }).limit(8).toArray()).reverse().map((m) => ({ role: m.role, text: m.text }));
  await chats.insertOne({ _id: new ObjectId(), attendeeId, sessionId: b.sessionId && ObjectId.isValid(b.sessionId) ? new ObjectId(b.sessionId) : null, role: "user", text: question, createdAt: new Date() });

  const { talks, decks, sessions } = await buildChatContext({ attendeeId, question, focusSessionId: b.sessionId || null });
  const ev = (await (await C.settings()).findOne({ _id: "event" })) as { name?: string } | null;
  const context = buildContextBlock(talks, decks) + `\n\n### SESSIONS THIS INVESTOR CAN ASK ABOUT\n${sessions.map((s) => `- ${s.title} (${s.status})`).join("\n") || "(none yet)"}`;
  const enc = new TextEncoder();
  const titleById = new Map(sessions.map((s) => [s._id.toString(), s.title]));
  const docNames = new Map(decks.map((d) => [d.documentId, d.documentName]));

  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      let usage: Parameters<typeof logUsage>[0]["usage"];
      try {
        for await (const part of streamChat({ eventName: ev?.name || process.env.NEXT_PUBLIC_EVENT_NAME || "Investor Day", context, history, question })) {
          if (part.text) { full += part.text; controller.enqueue(enc.encode(part.text)); }
          if (part.usage) usage = part.usage;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Lekhak could not answer right now.";
        controller.enqueue(enc.encode(`\n\nSorry — ${msg}`));
      }
      controller.close();
      // persist assistant turn with parsed sources
      const idx = full.indexOf(SOURCES_MARK);
      const answer = (idx >= 0 ? full.slice(0, idx) : full).trim();
      const srcRaw = idx >= 0 ? safeJson<{ talk?: { sessionId?: string; t?: string; quote?: string }[]; deck?: { documentId?: string; page?: number; title?: string; excerpt?: string }[] }>(full.slice(idx + SOURCES_MARK.length)) : null;
      const sources: ChatSource[] = [];
      for (const t of srcRaw?.talk || []) sources.push({ kind: "talk", sessionId: t.sessionId, sessionTitle: titleById.get(t.sessionId || "") || "", t: t.t, quote: t.quote });
      for (const d of srcRaw?.deck || []) sources.push({ kind: "deck", documentId: d.documentId, documentName: docNames.get(d.documentId || "") || "Deck", page: d.page, title: d.title, excerpt: d.excerpt });
      await chats.insertOne({ _id: new ObjectId(), attendeeId, role: "assistant", text: answer, sources, createdAt: new Date() }).catch(() => {});
      await logUsage({ kind: "chat", model: CHAT_MODEL, usage, attendeeId, sessionId: b.sessionId || null }).catch(() => {});
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
});
