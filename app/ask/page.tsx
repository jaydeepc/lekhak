"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { App, Md, Nav, speak, useToast } from "@/components/ui";
import { Back, Mic, Pause, Play, Send } from "@/components/icons";
import { api, useSessions } from "@/components/api";
import { useRequireMe } from "@/components/guard";
import { LiveMic } from "@/components/liveMic";

interface Source { kind: "talk" | "deck"; sessionId?: string; sessionTitle?: string; t?: string; quote?: string; documentId?: string; documentName?: string; page?: number; title?: string; excerpt?: string }
interface Msg { id: string; role: "user" | "assistant"; text: string; sources: Source[]; pending?: boolean }
const MARK = "<<<SOURCES>>>";

function parse(full: string): { text: string; sources: Source[]; done: boolean } {
  const i = full.indexOf(MARK);
  if (i < 0) { const partial = full.lastIndexOf("<<<"); return { text: partial > full.length - 12 && partial >= 0 ? full.slice(0, partial) : full, sources: [], done: false }; }
  let sources: Source[] = [];
  try {
    const j = JSON.parse(full.slice(i + MARK.length).trim().match(/\{[\s\S]*\}/)?.[0] || "{}");
    for (const t of j.talk || []) sources.push({ kind: "talk", ...t });
    for (const d of j.deck || []) sources.push({ kind: "deck", ...d });
  } catch { sources = []; }
  return { text: full.slice(0, i).trim(), sources, done: true };
}

function AskInner() {
  const me = useRequireMe();
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get("session");
  const preset = params.get("q");
  const { data } = useSessions(10000);
  const toast = useToast();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const micRef = useRef<LiveMic | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const openTitles = (data?.sessions || []).filter((s) => s.open).map((s) => s.title);
  const focus = data?.sessions.find((s) => s.id === sessionId);

  useEffect(() => { api<{ messages: Msg[] }>("/api/chat").then((r) => setMsgs(r.messages.map((m) => ({ ...m, sources: m.sources || [] })))).catch(() => {}); }, []);
  useEffect(() => { logRef.current?.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [msgs]);
  useEffect(() => { if (preset && !busy) { void ask(preset); router.replace(sessionId ? `/ask?session=${sessionId}` : "/ask"); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [preset]);

  async function ask(question: string) {
    const text = question.trim(); if (!text || busy) return;
    setQ(""); setBusy(true);
    const uid = `u${Date.now()}`, aid = `a${Date.now()}`;
    setMsgs((m) => [...m, { id: uid, role: "user", text, sources: [] }, { id: aid, role: "assistant", text: "", sources: [], pending: true }]);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text, sessionId }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({})))?.error || "Lekhak is unavailable right now");
      const reader = res.body.getReader(); const dec = new TextDecoder(); let full = "";
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        full += dec.decode(value, { stream: true });
        const p = parse(full);
        setMsgs((m) => m.map((x) => x.id === aid ? { ...x, text: p.text, sources: p.sources, pending: !p.text } : x));
      }
      const p = parse(full);
      setMsgs((m) => m.map((x) => x.id === aid ? { ...x, text: p.text || full.trim(), sources: p.sources, pending: false } : x));
    } catch (e) {
      setMsgs((m) => m.map((x) => x.id === aid ? { ...x, text: e instanceof Error ? e.message : "Something went wrong", pending: false } : x));
    } finally { setBusy(false); }
  }

  async function toggleMic() {
    if (listening) { await micRef.current?.stop(); micRef.current = null; setListening(false); if (interim) { setQ((v) => (v ? v + " " : "") + interim); setInterim(""); } return; }
    try {
      const mic = new LiveMic({
        onInterim: (t) => setInterim(t),
        onFinal: (t) => { setQ((v) => (v ? v + " " : "") + t.trim()); setInterim(""); },
        onStatus: (s, d) => { if (s === "error") toast(d || "Microphone error"); },
        onUsage: (secs) => api("/api/gemini/live-usage", { method: "POST", json: { audioSeconds: secs, sessionId } }).catch(() => {}),
      });
      micRef.current = mic; setListening(true);
      await mic.start();
    } catch (e) { setListening(false); micRef.current = null; toast(e instanceof Error ? e.message : "Microphone unavailable"); }
  }
  useEffect(() => () => { micRef.current?.stop(); }, []);

  const suggestions = focus
    ? [`What did ${focus.speaker?.split(" ")[0] || "the speaker"} say in the last 2 minutes?`, `Summarise ${focus.title} so far`, "कौन से आंकड़े बताए गए?"]
    : ["What did Jairam say about gold loan growth?", "Is LLM usage expensive?", "STP रेट क्या है?", "What does the deck say about BYOT?"];

  return (
    <App>
      <div className="screen">
        <div className="pad safe-top row" style={{ gap: 12, paddingTop: "max(24px,env(safe-area-inset-top))", paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
          <Link className="icon-btn" href={sessionId ? `/live/${sessionId}` : "/home"} aria-label="Back"><Back /></Link><div className="orb sm" />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 17, fontWeight: 800 }}>Lekhak</div><div className="small" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{focus ? `Focused on ${focus.title}` : openTitles.length ? `Can answer from: ${openTitles.join(", ")}` : "Sign in to ask"}</div></div>
        </div>
        <div ref={logRef} className="pad col" style={{ gap: 20, paddingTop: 20, paddingBottom: 20, flex: 1 }}>
          {!msgs.length && <div className="col" style={{ gap: 14 }}><p className="answer">Ask me about anything said in the room, in any language — I&apos;ll quote the moment, tell you what the deck adds, and you can hear it again.</p><div className="row" style={{ gap: 8, flexWrap: "wrap" }}>{suggestions.map((s) => <button key={s} type="button" className="pill" onClick={() => ask(s)}>{s}</button>)}</div></div>}
          {msgs.map((m) => m.role === "user" ? <div key={m.id} className="bubble">{m.text}</div> : (
            <div key={m.id} className="col" style={{ gap: 14 }}>
              {m.pending && !m.text ? <div className="typing"><i /><i /><i /></div> : <Md text={m.text} />}
              {m.sources.filter((s) => s.kind === "talk" && s.quote).map((s, i) => <TalkQuote key={i} s={s} />)}
              {m.sources.filter((s) => s.kind === "deck").map((s, i) => (
                <div key={`d${i}`} className="deckref"><div className="hd"><span>From the deck · slide {s.page ?? "?"}</span>{s.documentId && me && <a href={`/api/documents/${s.documentId}/file#page=${s.page || 1}`} target="_blank" rel="noreferrer" style={{ color: "var(--orange-deep)", letterSpacing: 0, textTransform: "none" }}>Open</a>}</div><b>{s.title || s.documentName}</b>{s.excerpt && <p>{s.excerpt}</p>}</div>
              ))}
            </div>
          ))}
          {msgs.length > 0 && !busy && <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>{suggestions.slice(0, 2).map((s) => <button key={s} type="button" className="pill" onClick={() => ask(s)}>{s}</button>)}</div>}
        </div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            {listening && <div className="listening"><span className="dot live-dot" />{interim || "Listening… speak in any language"}</div>}
            <textarea className="input" rows={1} value={q} onChange={(e) => setQ(e.target.value)} placeholder={listening ? "Your words appear here…" : "Ask anything said in the room…"} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }} />
          </div>
          {q.trim() && !listening ? <button className="mic" type="submit" aria-label="Send" disabled={busy}><Send /></button> : <button className={`mic ${listening ? "on" : ""}`} type="button" onClick={toggleMic} aria-label={listening ? "Stop listening" : "Ask by voice"}><Mic /></button>}
        </form>
        <Nav on="ask" />
      </div>
    </App>
  );
}

function TalkQuote({ s }: { s: Source }) {
  const [playing, setPlaying] = useState(false);
  const [pct, setPct] = useState(0);
  const stopRef = useRef<(() => void) | null>(null);
  const toggle = () => {
    if (playing) { stopRef.current?.(); stopRef.current = null; setPlaying(false); setPct(0); return; }
    const t0 = performance.now(), dur = Math.min(16000, 65 * (s.quote?.length || 20));
    setPlaying(true);
    const tick = () => { if (!stopRef.current) return; setPct(Math.min(100, ((performance.now() - t0) / dur) * 100)); requestAnimationFrame(tick); };
    stopRef.current = speak(s.quote || "", () => { stopRef.current = null; setPlaying(false); setPct(100); });
    requestAnimationFrame(tick);
  };
  useEffect(() => () => { stopRef.current?.(); }, []);
  return (
    <div className="quote">
      <div className="q">“{s.quote}”</div>
      <div className="row" style={{ gap: 12 }}>
        <button className="play" aria-label="Play this moment" onClick={toggle}>{playing ? <Pause /> : <Play />}</button>
        <div className="col" style={{ flex: 1, gap: 6 }}><div className="row between" style={{ fontSize: 13, fontWeight: 800 }}><span>{s.t ? `Said at ${s.t}` : "From the talk"}</span><span style={{ opacity: .92 }}>{s.sessionTitle}</span></div><div className="bar"><i style={{ width: `${pct}%` }} /></div></div>
      </div>
    </div>
  );
}

export default function AskPage() { return <Suspense fallback={<App><div className="screen" /></App>}><AskInner /></Suspense>; }
