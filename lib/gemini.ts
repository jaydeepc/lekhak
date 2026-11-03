import { GoogleGenAI, Modality, ThinkingLevel, AudioTranscriptionConfigMode, EndSensitivity, StartSensitivity, type Content } from "@google/genai";
import { ObjectId } from "mongodb";
import { C } from "./db";
import { chatCost, embedCost, getPricing, liveCost } from "./pricing";
import type { UsageKind } from "./types";

export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.8-flash";
export const LIVE_MODEL = process.env.GEMINI_LIVE_TRANSCRIBE_MODEL || "gemini-3.5-transcribe-live";
export const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-2";
export const EMBED_DIMS = 768;
/** Finalise a little sooner at natural pauses so attendees get frequent, timestamped lines. */
export const LIVE_VAD = { automaticActivityDetection: { disabled: false, silenceDurationMs: 600, endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH, startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH } };

let client: GoogleGenAI | null = null;
export function ai(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

type UsageMeta = { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number } | undefined;

export async function logUsage(opts: {
  kind: UsageKind; model: string; usage?: UsageMeta; audioSeconds?: number;
  attendeeId?: string | ObjectId | null; sessionId?: string | ObjectId | null;
}) {
  const p = await getPricing();
  const promptTokens = opts.usage?.promptTokenCount || 0;
  const outputTokens = (opts.usage?.candidatesTokenCount || 0) + (opts.usage?.thoughtsTokenCount || 0);
  const audioSeconds = opts.audioSeconds || 0;
  let costUsd = 0;
  if (opts.kind === "live") costUsd = liveCost(p, audioSeconds);
  else if (opts.kind === "embed") costUsd = embedCost(p, promptTokens);
  else costUsd = chatCost(p, promptTokens, outputTokens);
  const u = await C.usage();
  await u.insertOne({
    _id: new ObjectId(), kind: opts.kind, model: opts.model, promptTokens, outputTokens, audioSeconds, costUsd,
    attendeeId: opts.attendeeId ? new ObjectId(opts.attendeeId) : null,
    sessionId: opts.sessionId ? new ObjectId(opts.sessionId) : null,
    createdAt: new Date(),
  });
  return costUsd;
}

/* ---------------- embeddings ---------------- */
export async function embed(texts: string[], ctx: { attendeeId?: string | null; sessionId?: string | null } = {}): Promise<number[][]> {
  if (!texts.length) return [];
  const out: number[][] = [];
  // batch in groups of 50
  for (let i = 0; i < texts.length; i += 50) {
    const batch = texts.slice(i, i + 50).map((t) => t.slice(0, 6000));
    const r = await ai().models.embedContent({ model: EMBED_MODEL, contents: batch.map((t) => ({ parts: [{ text: t }] })), config: { outputDimensionality: EMBED_DIMS } });
    if ((r.embeddings || []).length !== batch.length) throw new Error(`Embedding count mismatch: ${(r.embeddings || []).length} for ${batch.length} inputs`);
    for (const e of r.embeddings || []) out.push(e.values || []);
    // embedContent does not return usage; estimate 1 token ≈ 4 chars
    const approxTokens = Math.ceil(batch.reduce((n, t) => n + t.length, 0) / 4);
    await logUsage({ kind: "embed", model: EMBED_MODEL, usage: { promptTokenCount: approxTokens }, ...ctx });
  }
  return out;
}

/* ---------------- ephemeral token for browser Live sessions ---------------- */
export async function createLiveToken(opts: { customVocabulary?: string[]; mode?: "SMART" | "VERBATIM" } = {}) {
  const token = await ai().authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(Date.now() + 30 * 60_000).toISOString(),
      newSessionExpireTime: new Date(Date.now() + 2 * 60_000).toISOString(),
      liveConnectConstraints: {
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.TEXT],
          inputAudioTranscription: { languageCodes: [], mode: (opts.mode || "SMART") as AudioTranscriptionConfigMode, ...(opts.customVocabulary?.length ? { customVocabulary: opts.customVocabulary.slice(0, 100) } : {}) },
          realtimeInputConfig: LIVE_VAD,
        },
      },
    },
  });
  return { token: token.name!, model: LIVE_MODEL, mode: (opts.mode || "SMART") as AudioTranscriptionConfigMode, customVocabulary: opts.customVocabulary || [] };
}

/* ---------------- document extraction ---------------- */
export interface ExtractedPage { page: number; title: string; text: string; numbers: string[] }

export async function extractPdfPages(pdf: Buffer, ctx: { sessionId?: string | null } = {}): Promise<ExtractedPage[]> {
  const prompt = `You are indexing a presentation deck for an investor-day Q&A assistant. For EVERY page/slide in this PDF, return one JSON object. Capture the slide title, ALL visible text (bullets, labels, footnotes, table cells), and describe any chart or diagram in words with the numbers it shows. List every figure, percentage, currency amount, or date separately in "numbers" (as short strings with units, e.g. "38% YoY gold loan growth"). Keep the original language of the slide. Return ONLY a JSON array in page order: [{"page":1,"title":"...","text":"...","numbers":["..."]}, ...]. Never skip a page; if a page is blank, return an empty text.`;
  const r = await ai().models.generateContent({
    model: CHAT_MODEL,
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: "application/pdf", data: pdf.toString("base64") } }, { text: prompt }] }],
    config: { responseMimeType: "application/json", thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, maxOutputTokens: 60000 },
  });
  await logUsage({ kind: "extract", model: CHAT_MODEL, usage: r.usageMetadata, sessionId: ctx.sessionId });
  const parsed = safeJson<ExtractedPage[]>(r.text || "[]") || [];
  return parsed.filter((p) => p && typeof p.page === "number").map((p) => ({
    page: p.page, title: String(p.title || "").slice(0, 200), text: String(p.text || "").slice(0, 8000),
    numbers: Array.isArray(p.numbers) ? p.numbers.map(String).slice(0, 40) : [],
  }));
}

export function safeJson<T>(s: string): T | null {
  try { return JSON.parse(s) as T; } catch { /* fallthrough */ }
  const m = s.match(/[\[{][\s\S]*[\]}]/);
  if (m) { try { return JSON.parse(m[0]) as T; } catch { return null; } }
  return null;
}

/* ---------------- chat ---------------- */
export const SOURCES_MARK = "<<<SOURCES>>>";

export interface TalkContext { sessionId: string; title: string; speaker: string; live: boolean; nowOffset: string; lines: { t: string; text: string }[] }
export interface DeckContext { documentId: string; documentName: string; sessionId: string; sessionTitle: string; page: number; title: string; text: string; numbers: string[] }

export function buildSystemPrompt(eventName: string) {
  return `You are Lekhak (लेखक), the AI note-taker inside the ${eventName} companion app. You have listened to every session the investor attended and you have read the decks the speakers presented. You answer investors' questions precisely, warmly and briefly.

LANGUAGE: Detect the language and script of the investor's question and reply in exactly that language and script. Hindi in Devanagari → reply in Devanagari Hindi. Hinglish (Hindi in Latin letters) → reply in Hinglish. Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Bengali, Punjabi, Odia → reply in that language. English → English. Quotes from the talk may stay in their original language.

TWO KINDS OF SOURCES — keep them clearly separate in your answer, every time:
1. THE TALK — the live transcript of what the speaker actually said, with timestamps (mm:ss into the session). This is the ONLY source you may attribute to the speaker ("Jairam said…", "उन्होंने कहा…").
2. THE DECK — slides the speaker is presenting. Deck facts are introduced as deck facts ("The deck says…", "On slide 7 the deck shows…", "डेक में लिखा है…"). NEVER say the speaker "said", "explained", "mentioned" or "highlighted" something that appears only in the deck.

ANSWER SHAPE — always two sections, each opened by a marker line, in this order:
<<TALK|label>>  — the label is "From the talk" written in the investor's language (e.g. "From the talk", "टॉक से", "பேச்சிலிருந்து"). Under it: what the speaker actually said about the topic, with the timestamp(s) in brackets like [12:40]. If the transcript has nothing on the topic, say so plainly, e.g. "Jairam hasn't said anything about this in the talk so far." / "अभी तक जयराम ने इस बारे में कुछ नहीं कहा है।" If there is no transcript at all yet, say the talk has not started (or has not been captured) yet.
<<DECK|label>>  — the label is "From the deck" in the investor's language. Under it: what the deck being presented says, naming slide numbers like "slide 7". If no slide covers it, say "The deck doesn't cover this either." Omit this whole section only when there is no deck at all.
Write short markdown under each marker (one to three sentences, or up to four short bullets). Never merge the two into one claim; never put the deck's facts under the talk marker.

RULES:
- Be brief: one to three sentences per part. Plain sentences, no headers; short markdown bullets are fine for lists.
- Relative-time questions ("just now", "2 minutes back", "कुछ देर पहले") are relative to the current offset given in the context of the LIVE session; quote the lines from that window.
- Never invent figures. Do not use outside knowledge about the company; stay inside the talk and the deck.
- The transcript is machine-generated speech-to-text and may contain small errors; interpret it sensibly (e.g. "how I shows up" means "how AI shows up").

OUTPUT FORMAT (strict): the two marker sections as above, then on a new line write ${SOURCES_MARK} followed by a single JSON object:
{"talk":[{"sessionId":"…","t":"mm:ss","quote":"exact or near-exact words from the transcript"}],"deck":[{"documentId":"…","page":14,"title":"slide title","excerpt":"the relevant slide text"}]}
Include at most 3 talk quotes and 3 deck references, only ones you actually used. If none, use empty arrays. Always include the ${SOURCES_MARK} line.`;
}

export function buildContextBlock(talks: TalkContext[], decks: DeckContext[]): string {
  const parts: string[] = [];
  for (const t of talks) {
    parts.push(`### TALK — ${t.title} (${t.speaker})${t.live ? ` — LIVE NOW, current offset ${t.nowOffset}` : " — ended"}\nsessionId: ${t.sessionId}`);
    if (!t.lines.length) parts.push(t.live ? "(NO TRANSCRIPT YET — the speaker has not said anything that was captured so far. Nothing can be attributed to the speaker.)" : "(no transcript was captured for this session)");
    else parts.push(t.lines.map((l) => `[${l.t}] ${l.text}`).join("\n"));
  }
  if (decks.length) {
    parts.push("### DECK SLIDES (retrieved as relevant)");
    for (const d of decks) {
      parts.push(`documentId: ${d.documentId} · ${d.documentName} · session: ${d.sessionTitle} · slide ${d.page}: ${d.title}\n${d.text}${d.numbers.length ? `\nFigures: ${d.numbers.join("; ")}` : ""}`);
    }
  } else parts.push("### DECK SLIDES\n(no deck has been uploaded for these sessions yet)");
  return parts.join("\n\n");
}

export async function* streamChat(opts: {
  eventName: string; context: string; history: { role: "user" | "assistant"; text: string }[]; question: string;
}): AsyncGenerator<{ text?: string; usage?: UsageMeta }> {
  const contents: Content[] = [];
  for (const h of opts.history.slice(-8)) contents.push({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] });
  contents.push({ role: "user", parts: [{ text: `CONTEXT (what you heard and read):\n\n${opts.context}\n\n---\nINVESTOR'S QUESTION: ${opts.question}` }] });
  const stream = await ai().models.generateContentStream({
    model: CHAT_MODEL,
    contents,
    config: { systemInstruction: buildSystemPrompt(opts.eventName), thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, temperature: 0.4, maxOutputTokens: 2048 },
  });
  for await (const chunk of stream) {
    if (chunk.text) yield { text: chunk.text };
    if (chunk.usageMetadata) yield { usage: chunk.usageMetadata };
  }
}

/* ---------------- summaries for "My day" ---------------- */
export interface SummaryOut { headline: string; points: { t: string; point: string }[]; numbers: string[] }
export async function summarise(opts: { title: string; speaker: string; lines: { t: string; text: string }[]; attendeeId?: string; sessionId?: string }): Promise<SummaryOut> {
  const prompt = `You are Lekhak, an AI note-taker at an investor day. Below is the live transcript of the part of "${opts.title}" (${opts.speaker}) that one investor was in the room for. Write their notes in English:
- "headline": one sentence (max 18 words) capturing the single most important message.
- "points": 3 to 7 key moments, each {"t":"mm:ss","point":"one crisp sentence"} using the timestamp where it was said.
- "numbers": up to 6 figures that were spoken, as short strings with context.
Return ONLY JSON: {"headline":"…","points":[…],"numbers":[…]}.

TRANSCRIPT:\n${opts.lines.map((l) => `[${l.t}] ${l.text}`).join("\n")}`;
  const r = await ai().models.generateContent({
    model: CHAT_MODEL, contents: prompt,
    config: { responseMimeType: "application/json", thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, temperature: 0.3 },
  });
  await logUsage({ kind: "summary", model: CHAT_MODEL, usage: r.usageMetadata, attendeeId: opts.attendeeId, sessionId: opts.sessionId });
  const j = safeJson<SummaryOut>(r.text || "") || { headline: "", points: [], numbers: [] };
  return { headline: String(j.headline || ""), points: Array.isArray(j.points) ? j.points.slice(0, 8) : [], numbers: Array.isArray(j.numbers) ? j.numbers.map(String).slice(0, 6) : [] };
}

export async function threeLines(opts: { notes: { title: string; headline: string; points: string[] }[]; attendeeId?: string }): Promise<string> {
  if (!opts.notes.length) return "";
  const prompt = `Combine these session notes from one investor's day into exactly three plain sentences (no bullets, no headers) that they could repeat to a colleague tonight. Be concrete, keep figures.\n\n${opts.notes.map((n) => `${n.title}: ${n.headline}\n- ${n.points.join("\n- ")}`).join("\n\n")}`;
  const r = await ai().models.generateContent({ model: CHAT_MODEL, contents: prompt, config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, temperature: 0.3, maxOutputTokens: 2048 } });
  await logUsage({ kind: "summary", model: CHAT_MODEL, usage: r.usageMetadata, attendeeId: opts.attendeeId });
  return (r.text || "").trim();
}

/* ---------------- shared session insights (themes + claims vs deck) ---------------- */
export interface SessionInsights { themes: { name: string; share: number; gist: string }[]; claims: { t: string; claim: string; slide: number | null }[] }
export async function sessionInsights(opts: { title: string; speaker: string; lines: { t: string; text: string }[]; slides: { page: number; title: string; text: string }[]; sessionId?: string }): Promise<SessionInsights> {
  const prompt = `You are Lekhak, an AI note-taker at an investor day. Analyse the transcript of "${opts.title}" (${opts.speaker || "speaker"}).

1. "themes": 3 to 6 themes the speaker actually spent time on, each {"name": 2–4 words, "share": percent of talk time (integers summing to 100), "gist": one crisp sentence in English (max 18 words) stating what was said about it, with figures if spoken}.
2. "claims": up to 5 of the most important, concrete claims the speaker made, each {"t":"mm:ss","claim": one sentence quoting or closely paraphrasing the words, "slide": the slide number from the DECK list that supports or shows the same point, or null if no slide covers it}.
Return ONLY JSON: {"themes":[…],"claims":[…]}.

DECK (slide number: title — text):
${opts.slides.length ? opts.slides.map((s) => `${s.page}: ${s.title} — ${s.text.slice(0, 220).replace(/\s+/g, " ")}`).join("\n") : "(no deck uploaded)"}

TRANSCRIPT:
${opts.lines.map((l) => `[${l.t}] ${l.text}`).join("\n")}`;
  const r = await ai().models.generateContent({ model: CHAT_MODEL, contents: prompt, config: { responseMimeType: "application/json", thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, temperature: 0.3, maxOutputTokens: 4096 } });
  await logUsage({ kind: "summary", model: CHAT_MODEL, usage: r.usageMetadata, sessionId: opts.sessionId });
  const j = safeJson<SessionInsights>(r.text || "") || { themes: [], claims: [] };
  const themes = (Array.isArray(j.themes) ? j.themes : []).map((t) => ({ name: String(t.name || "").slice(0, 40), share: Math.max(0, Math.round(Number(t.share) || 0)), gist: String(t.gist || "").slice(0, 200) })).filter((t) => t.name).slice(0, 6);
  const total = themes.reduce((n, t) => n + t.share, 0) || 1;
  for (const t of themes) t.share = Math.round((t.share / total) * 100);
  const claims = (Array.isArray(j.claims) ? j.claims : []).map((c) => ({ t: String(c.t || ""), claim: String(c.claim || "").slice(0, 240), slide: typeof c.slide === "number" && c.slide > 0 ? c.slide : null })).filter((c) => c.claim).slice(0, 5);
  return { themes, claims };
}

/* ---------------- what the whole room asked (anonymised) ---------------- */
export interface RoomAsked { topics: { topic: string; count: number; example: string }[] }
export async function roomAsked(questions: string[]): Promise<RoomAsked> {
  const prompt = `These are questions investors asked an AI note-taker during an investor day (anonymous, mixed languages). Group them into 3 to 6 topics. For each: {"topic": 2–5 words in English, "count": how many questions belong to it, "example": one representative question, translated to English if needed, max 14 words}. Order by count, descending. Return ONLY JSON: {"topics":[…]}.

QUESTIONS:
${questions.map((q, i) => `${i + 1}. ${q.slice(0, 200)}`).join("\n")}`;
  const r = await ai().models.generateContent({ model: CHAT_MODEL, contents: prompt, config: { responseMimeType: "application/json", thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, temperature: 0.3, maxOutputTokens: 2048 } });
  await logUsage({ kind: "summary", model: CHAT_MODEL, usage: r.usageMetadata });
  const j = safeJson<RoomAsked>(r.text || "") || { topics: [] };
  return { topics: (Array.isArray(j.topics) ? j.topics : []).map((t) => ({ topic: String(t.topic || "").slice(0, 60), count: Math.max(1, Math.round(Number(t.count) || 1)), example: String(t.example || "").slice(0, 160) })).filter((t) => t.topic).slice(0, 6) };
}
