import { ObjectId } from "mongodb";
import { C } from "./db";
import { randomToken } from "./text";
import type { AttendeeDoc, SessionDoc } from "./types";

/** Dummy data for the demo. `eventDate` is the day the agenda is placed on (IST). */
export async function seed(opts: { eventDate?: string; origin?: string; wipe?: boolean } = {}) {
  const day = opts.eventDate || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  const at = (hm: string) => new Date(`${day}T${hm}:00+05:30`);
  const sessions = await C.sessions();
  const attendees = await C.attendees();
  if (opts.wipe) {
    await Promise.all([
      sessions.deleteMany({}), attendees.deleteMany({}), (await C.segments()).deleteMany({}), (await C.presence()).deleteMany({}),
      (await C.unlocks()).deleteMany({}), (await C.chats()).deleteMany({}), (await C.summaries()).deleteMany({}), (await C.chunks()).deleteMany({}), (await C.documents()).deleteMany({}),
    ]);
  }
  const now = new Date();
  const base = (o: Partial<SessionDoc> & Pick<SessionDoc, "slug" | "title" | "room" | "kind" | "startAt" | "endAt" | "image">): SessionDoc => ({
    _id: new ObjectId(), tagline: "", description: "", speaker: "", speakerTitle: "", code: "", alwaysOpen: false, status: "upcoming",
    liveStartedAt: null, liveEndedAt: null, liveInterim: "", liveInterimAt: null, lastSeq: 0, order: 0, createdAt: now, updatedAt: now, ...o,
  });
  const agenda: SessionDoc[] = [
    base({ slug: "keynote", title: "Keynote: AI at Piramal Finance", tagline: "Through the people who serve Bharat", kind: "keynote", room: "Main hall", speaker: "Jairam Sridharan", speakerTitle: "MD & CEO", startAt: at("10:00"), endAt: at("11:15"), image: "/assets/il-keynote.jpg", alwaysOpen: true, code: "KEY001", order: 1,
      description: "The opening narrative: how AI shows up through underwriters, sales teams and branch staff rather than as something handed to the customer." }),
    base({ slug: "everyday-ai", title: "Everyday.AI", tagline: "Helping the people who serve Bharat's customers work smarter", kind: "booth", room: "Booth A", speaker: "Everyday.AI team", startAt: at("11:30"), endAt: at("12:15"), image: "/assets/il-converge.jpg", code: "EVDAY1", order: 2,
      description: "Tools almost anyone at Piramal can use — Prastuti, BYOT and BYOA — told through one credit underwriter's morning." }),
    base({ slug: "voice-bot", title: "Voice Bot", tagline: "Hiring, sales, collections and CX — in 11 languages", kind: "booth", room: "Booth B", speaker: "Voice platform team", startAt: at("11:30"), endAt: at("12:15"), image: "/assets/il-rings.jpg", code: "VOICE1", order: 3,
      description: "One voice platform under many agentic use cases: screening candidates, first-contact sales, collections reminders and customer care." }),
    base({ slug: "ai-expressway", title: "AI Expressway → STP", tagline: "The lane is AI. The exit is straight-through processing.", kind: "booth", room: "Booth C", speaker: "Credit & risk team", startAt: at("12:15"), endAt: at("13:00"), image: "/assets/il-expressway.jpg", code: "EXPWY1", order: 4,
      description: "STC, ABCD, Sampling and DTD — the sequence of AI checks that lets a small-ticket file move from application to sanction without a human hand." }),
    base({ slug: "piramal-mind", title: "Piramal Mind", tagline: "One connected brain over our code and our knowledge", kind: "booth", room: "Booth D", speaker: "Engineering platform team", startAt: at("12:15"), endAt: at("13:00"), image: "/assets/il-map.jpg", code: "MIND01", order: 5,
      description: "A context layer that engineers and AI assistants read from across PRD, design, code, debug and test." }),
    base({ slug: "margdarshak", title: "AI Margdarshak & Hindsighting", tagline: "Guidance before the decision, honesty after it", kind: "booth", room: "Booth E", speaker: "Analytics team", startAt: at("13:00"), endAt: at("14:00"), image: "/assets/il-unlock.jpg", code: "MARG01", order: 6,
      description: "Guidance for frontline teams at the moment of decision, and a structured look-back at what the portfolio actually did." }),
    base({ slug: "gpu-slm", title: "GPU infra & SLMs", tagline: "Enterprise models where they matter, our own where they don't", kind: "booth", room: "Booth F", speaker: "Infra team", startAt: at("13:00"), endAt: at("14:00"), image: "/assets/il-frame.jpg", code: "GPU001", order: 7,
      description: "A routing layer sends trivial tasks to small self-hosted models and keeps top-tier models for hard reasoning." }),
    base({ slug: "aryaverse", title: "Aryaverse", tagline: "The customer-facing universe", kind: "booth", room: "Booth G", speaker: "Product team", startAt: at("14:00"), endAt: at("14:45"), image: "/assets/il-map.jpg", code: "ARYA01", order: 8,
      description: "How the customer meets Piramal across app, branch and voice." }),
    base({ slug: "closing-qa", title: "Closing Q&A with leadership", tagline: "Your questions, answered on stage", kind: "panel", room: "Main hall", speaker: "Leadership panel", startAt: at("15:00"), endAt: at("15:45"), image: "/assets/hero.jpg", code: "QA0001", order: 9, alwaysOpen: true,
      description: "Open floor for investors." }),
  ];
  for (const s of agenda) {
    const existing = await sessions.findOne({ slug: s.slug });
    if (!existing) await sessions.insertOne(s);
    else { s._id = existing._id; }
  }

  // Everyday.AI booth: an already-finished talk with a transcript so the chat has something to answer from.
  const everyday = (await sessions.findOne({ slug: "everyday-ai" }))!;
  if (!(everyday.lastSeq > 0)) {
    const lines = [
      [0, "Welcome to the Everyday.AI booth. We're going to tell this story through one morning in the life of a credit underwriter."],
      [22, "She used to spend her first forty minutes on every file just finding out who the customer is: the email domain, the registered address, how the company is doing."],
      [58, "With BYOA, Build Your Own Agent, she described that check in plain English. The agent now does first-level due diligence before she even opens the file. Forty minutes became six."],
      [96, "That's three times the files per underwriter per day, and over twelve hundred files checked since the pilot."],
      [130, "Prastuti 2.0 lets you talk a deck into existence, or start from the MFR template and talk to slide seven. People stopped dreading the monthly review. We estimate about sixty percent of storytelling time saved."],
      [175, "BYOT is our citizen developer platform. Last year about twenty projects. This year about three hundred and forty engineering-grade applications built by HR, admin and ops people who had never coded. Gartner noticed."],
      [220, "BYOT plus plus is the same platform one step further: a DPM creates her own fields and pages on the Namma journey by chatting. No ticket, no sprint."],
      [255, "And agents everywhere: Steno takes notes in OKR meetings, and forty plus SmartHelp agents resolve support tickets at source."],
      [290, "The last slide has a QR code. Scan it and this booth unlocks in your Lekhak app with the deck and everything we just said."],
    ] as [number, string][];
    const start = new Date(at("11:30").getTime());
    await sessions.updateOne({ _id: everyday._id }, { $set: { status: "ended", liveStartedAt: start, liveEndedAt: new Date(start.getTime() + 320_000), lastSeq: lines.length } });
    await (await C.segments()).deleteMany({ sessionId: everyday._id });
    await (await C.segments()).insertMany(lines.map(([sec, text], i) => ({ _id: new ObjectId(), sessionId: everyday._id, seq: i + 1, text, offsetMs: sec * 1000, createdAt: new Date(start.getTime() + sec * 1000) })));
  }

  const people: Omit<AttendeeDoc, "_id" | "passToken" | "createdAt">[] = [
    { name: "Priya Sharma", email: "priya.sharma@example.com", firm: "Meridian Capital", role: "Portfolio Manager" },
    { name: "Arjun Mehta", email: "arjun.mehta@example.com", firm: "Harbor Point Partners", role: "Analyst, Financials" },
    { name: "Kavya Iyer", email: "kavya.iyer@example.com", firm: "Sundaram Asset Management", role: "Fund Manager" },
    { name: "Rohan Desai", email: "rohan.desai@example.com", firm: "Lighthouse Advisors", role: "Managing Director" },
    { name: "Ananya Bose", email: "ananya.bose@example.com", firm: "Kolkata Value Fund", role: "Research Head" },
    { name: "Vikram Nair", email: "vikram.nair@example.com", firm: "Oakridge Global", role: "Partner" },
    { name: "Sneha Kulkarni", email: "sneha.kulkarni@example.com", firm: "Deccan Equity", role: "Senior Analyst" },
    { name: "Aditya Rao", email: "aditya.rao@example.com", firm: "Bluewater Securities", role: "Head of NBFC Coverage" },
    { name: "Meera Krishnan", email: "meera.krishnan@example.com", firm: "Chennai Growth Partners", role: "CIO" },
    { name: "Dev Patel", email: "dev.patel@example.com", firm: "Westbridge Research", role: "Analyst" },
    { name: "Jaydeep Chakrabarty", email: "jaydeep.c1@gmail.com", firm: "Piramal Finance", role: "Host" },
    { name: "Guest Investor", email: "guest@lekhak.demo", firm: "Walk-in", role: "Guest" },
  ];
  let created = 0;
  for (const p of people) {
    const exists = await attendees.findOne({ email: p.email });
    if (!exists) { await attendees.insertOne({ _id: new ObjectId(), ...p, passToken: randomToken(22), createdAt: now, lastSeenAt: null, signedInAt: null }); created++; }
  }
  await (await C.settings()).updateOne({ _id: "event" }, { $setOnInsert: { name: process.env.NEXT_PUBLIC_EVENT_NAME || "Piramal Finance Investor Day 2026", date: day, venue: "Mumbai", updatedAt: now } }, { upsert: true });
  return { sessions: agenda.length, attendeesCreated: created, day };
}
