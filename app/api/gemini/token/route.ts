import { handle, json, requireAny } from "@/lib/api";
import { createLiveToken } from "@/lib/gemini";
import { C } from "@/lib/db";

/** Mints a short-lived Gemini Live token so the browser can stream audio straight to the transcription model. */
export const POST = handle(async (req) => {
  const who = await requireAny(req);
  // Bias recognition toward names and products that will be spoken in the room.
  const sessions = await (await C.sessions()).find({}, { projection: { title: 1, speaker: 1 } }).toArray();
  const vocab = new Set<string>(["Piramal Finance", "Lekhak", "Bharat", "Prastuti", "BYOT", "BYOA", "Aryaverse", "Margdarshak", "Piramal Mind", "STP", "LAP", "NBFC", "AUM", "crore", "lakh"]);
  for (const s of sessions) { if (s.speaker) vocab.add(s.speaker); if (s.title) vocab.add(s.title); }
  const mode = who.admin ? "SMART" : "VERBATIM"; // admin recorder gets cleaned-up transcript; attendee dictation stays literal & fast
  const t = await createLiveToken({ customVocabulary: Array.from(vocab), mode });
  return json(t);
});
