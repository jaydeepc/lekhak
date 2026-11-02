"use client";
import { useEffect, useState } from "react";
import { api, appUrl } from "@/components/api";
import { useToast } from "@/components/ui";

export default function SettingsPage() {
  const [ev, setEv] = useState({ name: "", date: "", venue: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [seedDate, setSeedDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const toast = useToast();
  useEffect(() => { api<{ event: typeof ev }>("/api/admin/event").then((r) => setEv(r.event)).catch(() => {}); }, []);
  const save = async () => { setBusy("ev"); try { await api("/api/admin/event", { method: "PUT", json: ev }); toast("Saved"); } catch (e) { toast(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); } };
  const seed = async (wipe: boolean) => {
    if (wipe && !confirm("Wipe ALL sessions, attendees, transcripts, chats and decks, then load the demo data?")) return;
    setBusy("seed");
    try { const r = await api<{ sessions: number; attendeesCreated: number; deck: string | null }>("/api/admin/seed", { method: "POST", json: { wipe, withDeck: true, eventDate: seedDate } }); toast(`Demo loaded: ${r.sessions} sessions, ${r.attendeesCreated} new attendees${r.deck ? `, ${r.deck}` : ""}`); }
    catch (e) { toast(e instanceof Error ? e.message : "Seeding failed"); } finally { setBusy(null); }
  };
  return (
    <>
      <div className="adm-head"><div><h1>Settings</h1><div className="sub">Event details, demo data and where things live.</div></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="adm-card"><h3>Event</h3>
          <div className="col" style={{ gap: 12 }}>
            <div className="field"><label>Event name</label><input className="input" value={ev.name} onChange={(e) => setEv({ ...ev, name: e.target.value })} /></div>
            <div className="field"><label>Date</label><input className="input" value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} placeholder="2026-11-20" /></div>
            <div className="field"><label>Venue</label><input className="input" value={ev.venue} onChange={(e) => setEv({ ...ev, venue: e.target.value })} placeholder="Mumbai" /></div>
            <div><button className="btn inline" disabled={busy === "ev"} onClick={save}>Save</button></div>
          </div>
        </div>
        <div className="adm-card"><h3>Demo data</h3>
          <p className="small" style={{ fontSize: 13, marginBottom: 12 }}>Loads the Investor Day agenda (keynote + 7 booths + Q&amp;A), 12 attendees with passes, a finished Everyday.AI booth with a transcript, and indexes the sample keynote deck so Ask Lekhak has something to answer from.</p>
          <div className="field" style={{ marginBottom: 12 }}><label>Place the agenda on (IST date)</label><input className="input" type="date" value={seedDate} onChange={(e) => setSeedDate(e.target.value)} /></div>
          <div className="btn-row"><button className="btn inline" disabled={busy === "seed"} onClick={() => seed(false)}>{busy === "seed" ? "Loading…" : "Add demo data"}</button><button className="btn inline danger" disabled={busy === "seed"} onClick={() => seed(true)}>Wipe &amp; reload</button></div>
        </div>
        <div className="adm-card" style={{ gridColumn: "1/-1" }}><h3>Links &amp; models</h3>
          <table className="tbl"><tbody>
            <tr><td>Public app URL (in QR codes)</td><td className="mono">{appUrl()}</td></tr>
            <tr><td>Entrance screen</td><td className="mono"><a href="/entrance" target="_blank">{appUrl()}/entrance</a></td></tr>
            <tr><td>Live transcription</td><td className="mono">gemini-3.5-transcribe-live · browser → Gemini via 30-minute ephemeral tokens, sessions rotate every 8.5 min</td></tr>
            <tr><td>Chat, deck reading, notes</td><td className="mono">gemini-3.8-flash (thinking: low)</td></tr>
            <tr><td>Deck search</td><td className="mono">gemini-embedding-2 · 768 dims · cosine in MongoDB documents</td></tr>
            <tr><td>Database</td><td className="mono">MongoDB Atlas · collections: sessions, segments, attendees, presence, unlocks, documents, chunks, chats, usage, summaries, settings, uploads (GridFS)</td></tr>
          </tbody></table>
        </div>
      </div>
    </>
  );
}
