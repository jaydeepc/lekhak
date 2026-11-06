# Lekhak · Piramal Finance Investor Day companion

**Lekhak (लेखक)** is the AI note-taker for Investor Day: it listens to every talk live, relays the transcript to every attendee's phone within a second, reads the speakers' decks, and answers investors' questions in their own language, clearly separating *what the speaker said* from *what the deck says*.

Production: **https://lekhak-piramal.vercel.app** · Admin console: `/admin` · Entrance QR screen: `/entrance`
Repository: https://github.com/jaydeepc/lekhak

## What's inside

| Surface | Route | What it does |
|---|---|---|
| Attendee PWA | `/install → /signin → /home` | Installable phone app. Sign in with the invitation email or by scanning the QR on the printed pass. |
| Live session | `/live/[id]` | Word-by-word captions (interim) and finalised, timestamped lines pushed over Server-Sent Events. Presence is recorded while the attendee is on this screen. |
| Ask Lekhak | `/ask` | Streaming answers from `gemini-3.8-flash` over the attended transcripts plus retrieved deck slides. Replies in the language of the question (Hindi, Hinglish, Tamil, …). Talk quotes get a timestamp and play-back; deck facts get a slide card. Mic button dictates via Gemini Live and shows words as you speak. |
| Scan / unlock | `/scan`, `/unlock/[id]` | Camera QR scan of a booth's last slide (or room code) unlocks that session. |
| My day | `/myday` | Auto-written notes for every session the attendee was in the room for (headline, key moments with timestamps, figures), Lekhak's three-line digest, questions asked. Export as PDF. |
| Admin console | `/admin` | Overview, agenda & deck uploads, live recorder, attendees & printable QR passes, questions feed, live cost dashboard, settings & demo data. |
| Wide screens | `/entrance`, `/slide/[id]` | Install QR for the entrance; per-booth last-slide QR. |

### Real-time architecture (Vercel-friendly, no WebSocket server)

```
speaker ─mic─▶ admin browser ──PCM 16k over WebSocket──▶ Gemini Live (gemini-3.5-transcribe-live)
                     │  interim captions (PATCH) + finalised lines (POST, with offset)
                     ▼
                 Next.js API ──▶ MongoDB Atlas (segments, sessions)
                     │  SSE /api/sessions/[id]/stream (polls Mongo every 600 ms, auto-reconnect, polling fallback)
                     ▼
            every attendee phone  ──▶  /ask → gemini-3.8-flash (transcript + deck slides via gemini-embedding-2)
```

- The browser gets a **30-minute ephemeral token** from `/api/gemini/token` (the API key never leaves the server). Live sessions are capped at 10 minutes by Google, so the recorder rotates sessions every 8.5 minutes and forces a commit after 20 s of unbroken speech.
- Decks: PDF pages are read by `gemini-3.8-flash` (title, text, chart descriptions, figures per slide); PPTX text is extracted per slide. Each slide is embedded and retrieved by cosine similarity at question time.
- Costs: every call logs tokens / audio seconds to the `usage` collection and is priced with the editable table in **Admin → Costs**.

## Run locally

```bash
cp .env.example .env.local   # fill in MONGODB_URI, GEMINI_API_KEY, ADMIN_PASSWORD, AUTH_SECRET
npm install
npm run dev                  # http://localhost:3100
npm run seed                 # demo agenda, 12 attendees, a finished booth transcript, indexed sample deck
```

Microphone and camera need HTTPS or `localhost`.

## Deploy

The project is linked to Vercel (`vercel --prod`). Environment variables live in the Vercel project; `NEXT_PUBLIC_APP_URL` is the origin baked into QR codes.

## `lekhak.piramalfinance.com` on your laptop

We don't own that DNS, so for the showcase laptop:

```bash
sudo scripts/local-domain.sh lekhak-piramal.vercel.app
```

This adds a `/etc/hosts` entry, issues a locally-trusted certificate with mkcert, and runs a Caddy reverse proxy to the Vercel deployment. Phones keep using the Vercel URL (that's what the QR codes encode). `sudo scripts/local-domain.sh --remove` undoes it.

## Day-of runbook

1. **Admin → Attendees**: import the guest list (CSV: name, email, firm, role) → **Print all passes**.
2. **Admin → Agenda & decks**: check times, upload each speaker's deck (PDF preferred).
3. Entrance screen on a laptop: `/entrance`.
4. When Jairam walks on: **Admin → Agenda → Go live** on the keynote, choose the microphone, **Start listening**. Keep the laptop near the speaker or feed the room mix.
5. Booths: open `/slide/[id]` on the booth screen as the last slide; attendees scan to unlock.
6. **Admin → Costs** for the live spend; **Questions** for what the room is asking.

## Theme

The app follows the **Piramal.ai** design system, Light theme (white ground with a peach haze top-left and a pale-blue haze bottom-right, a navy-to-flame foot bar, orange-led accents with blue as secondary, navy text, Open Sans, 1px edges, no shadows). Tokens live at the top of `app/globals.css`; brand lockups and backdrops under `public/brand/`; screen illustrations under `public/assets/` were generated to match (GPT Image 2.5 "sunburst" via Higgsfield).

## Data (MongoDB)

`sessions`, `segments`, `attendees`, `presence`, `unlocks`, `documents` + `uploads` (GridFS), `chunks` (slide text + embeddings), `chats`, `summaries`, `usage`, `settings`.
