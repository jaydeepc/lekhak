"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, timeHM } from "@/components/api";
import { usd } from "@/components/admin";
import { Radio } from "@/components/icons";

interface Stats { attendees: number; online: number; signedIn: number; questions: number; segments: number; documents: number; costUsd: number; sessions: { id: string; title: string; room: string; speaker: string; status: string; startAt: string; endAt: string; lastSeq: number; inRoom: number; kind: string }[] }

export default function Overview() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { const load = () => api<Stats>("/api/admin/stats").then(setS).catch((e) => setErr(e.message)); load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);
  const live = s?.sessions.filter((x) => x.status === "live" || x.status === "paused") || [];
  const next = s?.sessions.filter((x) => x.status === "upcoming").sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))[0];
  return (
    <>
      <div className="adm-head"><div><h1>Overview</h1><div className="sub">Live view of the room, refreshed every few seconds.</div></div>
        <div className="btn-row">{next && <Link className="btn inline ghost" href={`/admin/live/${next.id}`}><Radio size={16} />Go live: {next.title}</Link>}<Link className="btn inline" href="/admin/sessions">Manage agenda</Link></div></div>
      {err && <div className="err" style={{ marginBottom: 16 }}>{err}</div>}
      <div className="kpis">
        <div className="kpi"><span>Attendees online</span><b>{s ? s.online : "–"}</b><small>{s ? `${s.signedIn} signed in · ${s.attendees} invited` : ""}</small></div>
        <div className="kpi navy"><span>Questions to Lekhak</span><b>{s ? s.questions : "–"}</b><small>{s ? `${s.segments} transcript moments kept` : ""}</small></div>
        <div className="kpi green"><span>Decks indexed</span><b>{s ? s.documents : "–"}</b><small>Uploaded PDFs & PPTX read by Gemini</small></div>
        <div className="kpi"><span>Gemini spend so far</span><b>{s ? usd(s.costUsd) : "–"}</b><small><Link href="/admin/costs">Breakdown →</Link></small></div>
      </div>
      <div className="adm-card" style={{ marginBottom: 18 }}>
        <h3>{live.length ? "Live now" : "Nothing is live"}</h3>
        {!live.length && <p className="lead" style={{ fontSize: 14 }}>Open a session in <Link href="/admin/sessions">Agenda</Link> and press <b>Go live</b>. The recorder page streams the speaker&apos;s words to every attendee in real time.</p>}
        {live.map((x) => (
          <div key={x.id} className="row between" style={{ gap: 16, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <div><div className="row" style={{ gap: 10 }}><span className={`status ${x.status}`}>{x.status === "live" && <span className="dot live-dot" />}{x.status}</span><b style={{ fontSize: 16 }}>{x.title}</b></div><div className="small" style={{ marginTop: 4 }}>{x.room}{x.speaker ? ` · ${x.speaker}` : ""} · {x.lastSeq} moments · {x.inRoom} attendee{x.inRoom === 1 ? "" : "s"} in the room</div></div>
            <Link className="btn inline" href={`/admin/live/${x.id}`}>Open recorder</Link>
          </div>
        ))}
      </div>
      <div className="adm-card">
        <h3>Today&apos;s agenda</h3>
        <table className="tbl"><thead><tr><th>Time</th><th>Session</th><th>Room</th><th>Status</th><th className="num">Moments</th><th className="num">In room</th><th></th></tr></thead>
          <tbody>{(s?.sessions || []).map((x) => <tr key={x.id}><td className="mono">{timeHM(x.startAt)}–{timeHM(x.endAt)}</td><td><b>{x.title}</b><div className="small">{x.speaker}</div></td><td>{x.room}</td><td><span className={`status ${x.status}`}>{x.status}</span></td><td className="num">{x.lastSeq}</td><td className="num">{x.inRoom}</td><td style={{ textAlign: "right" }}><Link className="btn inline ghost" href={`/admin/live/${x.id}`}>Recorder</Link></td></tr>)}</tbody></table>
      </div>
    </>
  );
}
