"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { App, Hero, Nav, Spinner } from "@/components/ui";
import { api, timeHM, type Session } from "@/components/api";
import { useRequireMe } from "@/components/guard";

interface Note { session: Session; minutes: number; unlocked: boolean; segmentsHeard: number; summary: { headline: string; points: { t: string; point: string }[]; numbers: string[]; createdAt: string } | null }
interface Day { notes: Note[]; threeLines: string; questions: { id: string; text: string; at: string }[]; totals: { sessions: number; attended: number; minutes: number; questions: number } }

export default function MyDay() {
  const me = useRequireMe();
  const [d, setD] = useState<Day | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!me) return;
    let on = true;
    const load = () => api<Day>("/api/myday").then((r) => { if (on) setD(r); }).catch((e) => setErr(e.message));
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 90000);
    return () => { on = false; clearInterval(t); };
  }, [me]);
  const first = me?.name?.split(" ")[0] || "Investor";
  const mins = d?.totals.minutes || 0;
  return (
    <App><div className="screen">
      <Hero image="/assets/il-expressway.jpg" eyebrow="Your day" title={<span style={{ fontSize: 30 }}>{first}, here&apos;s what you kept.</span>} minHeight={240} right={<button className="chip glass no-print" style={{ border: "1px solid rgba(255,255,255,.4)" }} onClick={() => window.print()}>Export PDF</button>} />
      <div className="pad col" style={{ paddingTop: 24, paddingBottom: 24, gap: 22, flex: 1 }}>
        {err && <div className="err">{err}</div>}
        {!d && !err && <div className="row" style={{ gap: 12 }}><Spinner /><span className="small">Lekhak is writing up your notes…</span></div>}
        {d && (
          <>
            <div className="grid3">
              <div className="stat"><b className="o">{d.totals.attended}<span style={{ fontSize: 18, color: "var(--muted)", letterSpacing: 0 }}>/{d.totals.sessions}</span></b><span>sessions attended</span></div>
              <div className="stat"><b>{d.totals.questions}</b><span>questions asked</span></div>
              <div className="stat"><b>{Math.floor(mins / 60)}h {String(mins % 60).padStart(2, "0")}m</b><span>heard for you</span></div>
            </div>
            {d.threeLines && <div className="col" style={{ gap: 8 }}><div className="label">Lekhak&apos;s three lines</div><div style={{ fontSize: 16, lineHeight: 1.55, borderLeft: "3px solid var(--orange)", paddingLeft: 14 }}>{d.threeLines}</div></div>}
            {!d.notes.length && <p className="lead">Nothing here yet. Open a live session or scan a booth&apos;s last slide, and Lekhak will start taking notes for you automatically.</p>}
            {d.notes.map((n) => (
              <div key={n.session.id} className="note">
                <div className="nh"><img src={n.session.image} alt="" /><div style={{ flex: 1, minWidth: 0 }}><b>{n.session.title}</b><span className="small">{timeHM(n.session.startAt)} · {n.session.room}{n.minutes ? ` · ${n.minutes} min in the room` : n.unlocked ? " · unlocked by scan" : ""}</span></div><Link href={`/session/${n.session.id}`} className="small" style={{ fontWeight: 800, color: "var(--orange-deep)" }}>Open</Link></div>
                <div className="nb">
                  {n.summary ? (<>
                    <div className="headline">{n.summary.headline}</div>
                    {n.summary.points.map((p, i) => <div key={i} className="pt"><span className="t">{p.t}</span><span>{p.point}</span></div>)}
                    {n.summary.numbers.length > 0 && <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{n.summary.numbers.map((x, i) => <span key={i} className="chip tint" style={{ letterSpacing: 0, textTransform: "none" }}>{x}</span>)}</div>}
                  </>) : <p className="small" style={{ fontSize: 14 }}>{n.segmentsHeard ? "Lekhak is writing this up — check back in a moment." : n.session.status === "live" ? "You're in the room. Notes appear as the talk goes on." : "No transcript was captured for this session yet."}</p>}
                </div>
              </div>
            ))}
            {d.questions.length > 0 && <div className="col" style={{ gap: 8 }}><div className="label">You asked</div>{d.questions.slice(-6).map((q) => <Link key={q.id} href="/ask" className="pill" style={{ fontSize: 14, padding: "10px 12px" }}>{q.text}</Link>)}</div>}
          </>
        )}
      </div>
      <div className="pad" style={{ paddingBottom: 24 }}><Link className="btn" href="/home">{d && d.totals.sessions - d.totals.attended > 0 ? `${d.totals.sessions - d.totals.attended} session${d.totals.sessions - d.totals.attended > 1 ? "s" : ""} left today` : "Back to the agenda"}</Link></div>
      <Nav on="myday" />
    </div></App>
  );
}
