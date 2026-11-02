"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { App, Nav, Spinner } from "@/components/ui";
import { Back, Logo, Spark, Unlock } from "@/components/icons";
import { api, timeHM, useSessions, type Session } from "@/components/api";
import { useRequireMe } from "@/components/guard";

interface Note { session: Session; minutes: number; unlocked: boolean; segmentsHeard: number; totalSegments: number; windows: { from: string; to: string }[]; summary: { headline: string; points: { t: string; point: string }[]; numbers: string[]; createdAt: string } | null }
interface Day { notes: Note[]; threeLines: string; questions: { id: string; text: string; at: string }[]; totals: { sessions: number; attended: number; minutes: number; questions: number } }

export default function MyDay() {
  const me = useRequireMe();
  const { data: agenda } = useSessions(30000);
  const [d, setD] = useState<Day | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!me) return;
    let on = true;
    const load = () => api<Day>("/api/myday").then((r) => { if (on) setD(r); }).catch((e) => setErr(e.message));
    // show what's already written instantly, then let Lekhak fill in anything new
    api<Day>("/api/myday?fast=1").then((r) => { if (on) setD((cur) => cur || r); }).catch(() => {}).finally(load);
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 90000);
    return () => { on = false; clearInterval(t); };
  }, [me]);
  const first = me?.name?.split(" ")[0] || "Investor";
  const talks = (agenda?.sessions || []).filter((s) => s.kind !== "break");
  const mins = d?.totals.minutes || 0;
  const scheduledMins = useMemo(() => (d?.notes || []).reduce((n, x) => n + Math.max(1, Math.round((+new Date(x.session.endAt) - +new Date(x.session.startAt)) / 60000)), 0), [d]);
  const figures = useMemo(() => pickFigures(d?.notes || []), [d]);
  const [dateLabel, setDateLabel] = useState(""); // client-only: locale formatting differs between server and browser
  useEffect(() => { setDateLabel(new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" })); }, []);

  return (
    <App>
      <div className="screen md">
        <header className="hero md-hero" style={{ backgroundImage: "url('/assets/il-expressway.jpg')" }}>
          <div className="top safe-top">
            <Link className="icon-btn" href="/home" aria-label="Back"><Back /></Link>
            <div className="row" style={{ gap: 8 }}><button className="chip glass no-print" style={{ border: "1px solid rgba(255,255,255,.4)" }} onClick={() => window.print()}>Export PDF</button><div className="logo-chip" style={{ padding: "6px 10px", alignSelf: "center" }}><Logo h={20} /></div></div>
          </div>
          <div>
            <div className="eyebrow">Lekhak&apos;s notes{dateLabel ? ` · ${dateLabel}` : ""}</div>
            <h1 style={{ fontSize: 30 }}>{first}, here&apos;s what you kept.</h1>
            <div className="lead" style={{ marginTop: 6, fontSize: 14 }}>{agenda?.event.name || "Investor Day"}{agenda?.event.venue ? ` · ${agenda.event.venue}` : ""}</div>
          </div>
        </header>

        <div className="pad col md-body">
          {err && <div className="err">{err}</div>}
          {!d && !err && <div className="col" style={{ gap: 12 }}><div className="skel" style={{ height: 150, borderRadius: 12 }} /><div className="skel" style={{ height: 110, borderRadius: 12 }} /><div className="row" style={{ gap: 10 }}><Spinner /><span className="small">Lekhak is writing up your notes…</span></div></div>}
          {d && (
            <>
              {/* ---- stat tiles ---- */}
              <section className="md-card md-stats">
                <div className="md-stat ring">
                  <Ring value={d.totals.attended} max={Math.max(1, talks.length || d.totals.sessions)} />
                  <div><b>{d.totals.attended}<span>/{talks.length || d.totals.sessions}</span></b><span className="lbl">sessions attended</span></div>
                </div>
                <div className="md-stat">
                  <b>{Math.floor(mins / 60) ? `${Math.floor(mins / 60)}h ` : ""}{String(mins % 60).padStart(2, "0")}m</b><span className="lbl">heard for you</span>
                  <div className="md-bar" title={`${mins} of ${scheduledMins} scheduled minutes`}><i style={{ width: `${scheduledMins ? Math.min(100, Math.round((mins / scheduledMins) * 100)) : 0}%` }} /></div>
                  <span className="tiny">{mins ? `${Math.min(100, Math.round((mins / Math.max(1, scheduledMins)) * 100))}% of the talks you attended` : d.notes.length ? "kept via scan · sit in a live talk to log time" : "open a live session to start"}</span>
                </div>
                <div className="md-stat">
                  <b>{d.totals.questions}</b><span className="lbl">questions asked</span>
                  <span className="tiny">{d.questions.length ? `last: “${trunc(d.questions[d.questions.length - 1].text, 34)}”` : "ask Lekhak anything, any language"}</span>
                </div>
              </section>

              {/* ---- day timeline ---- */}
              {talks.length > 0 && d.notes.length > 0 && <Timeline talks={talks} notes={d.notes} />}

              {/* ---- three lines ---- */}
              {d.threeLines && (
                <section className="md-quote">
                  <div className="qmark">“</div>
                  <div className="label" style={{ color: "rgba(255,255,255,.85)" }}>Lekhak&apos;s three lines</div>
                  <p>{d.threeLines}</p>
                  <div className="row between" style={{ fontSize: 12, fontWeight: 800, opacity: .9 }}><span>Say this to a colleague tonight</span><Spark size={16} /></div>
                </section>
              )}

              {/* ---- figures ---- */}
              {figures.length > 0 && (
                <section>
                  <div className="md-h"><span className="label">Numbers that stuck</span><span className="tiny">as spoken in the room</span></div>
                  <div className="md-figs">{figures.map((f, i) => <div key={i} className="md-fig"><b>{f.big}</b><span>{f.caption}</span><small>{f.session}</small></div>)}</div>
                </section>
              )}

              {!d.notes.length && <div className="md-card" style={{ textAlign: "center", padding: 28 }}><div className="orb quiet" style={{ width: 90, margin: "0 auto 14px" }} /><b style={{ fontSize: 17 }}>Nothing here yet.</b><p className="lead" style={{ fontSize: 14, marginTop: 6 }}>Open a live session or scan a booth&apos;s last slide, and Lekhak starts taking notes for you automatically.</p></div>}

              {/* ---- per-session notes ---- */}
              {d.notes.length > 0 && <div className="md-h"><span className="label">Your sessions</span><span className="tiny">{d.notes.length} with notes</span></div>}
              {d.notes.map((n) => <NoteCard key={n.session.id} n={n} />)}

              {/* ---- questions ---- */}
              {d.questions.length > 0 && (
                <section>
                  <div className="md-h"><span className="label">You asked Lekhak</span><span className="tiny">{d.questions.length} question{d.questions.length > 1 ? "s" : ""}</span></div>
                  <div className="col" style={{ gap: 8 }}>{d.questions.slice(-6).reverse().map((q) => <Link key={q.id} href="/ask" className="md-q"><Spark size={16} /><span>{q.text}</span><small>{timeHM(q.at)}</small></Link>)}</div>
                </section>
              )}

              <footer className="md-foot"><Logo h={22} /><div><b>Prepared by Lekhak</b><span>for {me?.name || "you"} · {agenda?.event.name || "Investor Day"}{agenda?.event.date ? ` · ${agenda.event.date}` : ""}</span></div></footer>
            </>
          )}
        </div>
        <div className="pad no-print" style={{ paddingBottom: 24 }}><Link className="btn" href="/home">{d && talks.length - d.totals.attended > 0 ? `${talks.length - d.totals.attended} session${talks.length - d.totals.attended > 1 ? "s" : ""} left today` : "Back to the agenda"}</Link></div>
        <Nav on="myday" />
      </div>
    </App>
  );
}

/* ---------------- pieces ---------------- */

function Ring({ value, max }: { value: number; max: number }) {
  const r = 30, c = 2 * Math.PI * r, pct = Math.min(1, value / max);
  return (
    <svg className="md-ring" viewBox="0 0 76 76" width="76" height="76" role="img" aria-label={`${value} of ${max} sessions attended`}>
      <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F26841" /><stop offset="1" stopColor="#EF4123" /></linearGradient></defs>
      <circle cx="38" cy="38" r={r} fill="none" stroke="#FEF0EC" strokeWidth="8" />
      <circle cx="38" cy="38" r={r} fill="none" stroke="url(#ringGrad)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 38 38)" style={{ transition: "stroke-dasharray .8s ease" }} />
      <text x="38" y="43" textAnchor="middle" fontSize="18" fontWeight="800" fill="#20303F" fontFamily="inherit">{Math.round(pct * 100)}%</text>
    </svg>
  );
}

/** Where you were, hour by hour: scheduled slot as a light track, your presence as the orange fill. */
function Timeline({ talks, notes }: { talks: Session[]; notes: Note[] }) {
  const t0 = Math.min(...talks.map((s) => +new Date(s.startAt))), t1 = Math.max(...talks.map((s) => +new Date(s.endAt)));
  const span = Math.max(1, t1 - t0);
  const W = 100; // percent-based x
  const x = (t: number) => Math.max(0, Math.min(W, ((t - t0) / span) * W));
  const rows = notes.slice(0, 8);
  const hours: number[] = [];
  const step = span > 6 * 3600_000 ? 2 : 1;
  for (let h = new Date(t0).setMinutes(0, 0, 0); h <= t1; h += step * 3600_000) if (h >= t0 - 1) hours.push(h);
  return (
    <section className="md-card">
      <div className="md-h" style={{ marginBottom: 10 }}><span className="label">Your day, hour by hour</span><span className="tiny"><i className="sw track" /> scheduled <i className="sw fill" /> you were there</span></div>
      <div className="md-tl">
        {rows.map((n) => {
          const s0 = +new Date(n.session.startAt), s1 = +new Date(n.session.endAt);
          const wins = n.windows.length ? n.windows.map((w) => [+new Date(w.from), +new Date(w.to)]) : n.unlocked ? [[s0, s1]] : [];
          return (
            <div key={n.session.id} className="md-tl-row">
              <div className="md-tl-label" title={n.session.title}>{n.session.title}</div>
              <div className="md-tl-track" title={`${n.session.title} · ${timeHM(n.session.startAt)}–${timeHM(n.session.endAt)} · ${n.minutes} min in the room`}>
                <i className="sched" style={{ left: `${x(s0)}%`, width: `${Math.max(1.5, x(s1) - x(s0))}%` }} />
                {wins.map(([a, b], i) => <i key={i} className={`was ${n.windows.length ? "" : "scan"}`} style={{ left: `${x(a)}%`, width: `${Math.max(1.2, x(Math.max(b, a + 120_000)) - x(a))}%` }} />)}
              </div>
            </div>
          );
        })}
        <div className="md-tl-axis">{hours.map((h) => <span key={h} style={{ left: `${x(h)}%` }}>{new Date(h).toLocaleTimeString("en-IN", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).replace(/^(\d+).*/, "$1h")}</span>)}</div>
      </div>
    </section>
  );
}

function NoteCard({ n }: { n: Note }) {
  const cov = n.totalSegments ? Math.round((n.segmentsHeard / n.totalSegments) * 100) : 0;
  return (
    <article className="md-note">
      <div className="md-banner" style={{ backgroundImage: `url('${n.session.image}')` }}>
        <div className="row between" style={{ alignItems: "flex-start" }}><span className="chip glass">{n.session.room}</span>{n.unlocked && <span className="chip orange"><Unlock size={12} />Unlocked</span>}</div>
        <div><div className="eyebrow" style={{ color: "var(--orange)" }}>{timeHM(n.session.startAt)}–{timeHM(n.session.endAt)}{n.session.speaker ? ` · ${n.session.speaker}` : ""}</div><h3>{n.session.title}</h3></div>
      </div>
      <div className="md-note-body">
        {n.totalSegments > 0 && (
          <div className="md-cov"><div className="row between tiny" style={{ fontWeight: 800 }}><span>{n.unlocked ? "Whole talk kept" : `You heard ${cov}% of the talk`}</span><span>{n.minutes ? `${n.minutes} min in the room` : ""}</span></div><div className="md-bar"><i style={{ width: `${n.unlocked ? 100 : cov}%` }} /></div></div>
        )}
        {n.summary ? (
          <>
            <div className="md-headline">{n.summary.headline}</div>
            <ol className="md-moments">{n.summary.points.map((p, i) => <li key={i}><span className="t">{p.t}</span><span className="dot" /><span className="txt">{p.point}</span></li>)}</ol>
            {n.summary.numbers.length > 0 && <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{n.summary.numbers.map((x, i) => <span key={i} className="chip tint" style={{ letterSpacing: 0, textTransform: "none" }}>{x}</span>)}</div>}
          </>
        ) : <p className="small" style={{ fontSize: 14, margin: 0 }}>{n.segmentsHeard ? "Lekhak is writing this up — check back in a moment." : n.session.status === "live" ? "You're in the room. Notes appear as the talk goes on." : "No transcript was captured for this session yet."}</p>}
        <div className="row no-print" style={{ gap: 8, paddingTop: 4 }}><Link href={`/session/${n.session.id}`} className="pill">Open session</Link><Link href={`/ask?session=${n.session.id}`} className="pill on"><Spark size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Ask Lekhak</Link></div>
      </div>
    </article>
  );
}

/* ---------------- helpers ---------------- */
function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function pickFigures(notes: Note[]) {
  const out: { big: string; caption: string; session: string }[] = [];
  for (const n of notes) for (const raw of n.summary?.numbers || []) {
    const m = raw.match(/^(?:about |approx\.? |~|around |over |nearly |more than )?(₹\s?[\d.,]+\s?(?:lakh|crore|cr|k|bn|mn)?\b|\$\s?[\d.,]+\s?(?:bn|mn|k)?\b|[\d.,]+\s?(?:%|percent|minutes?|mins?|hours?|years?|months?|days?|lakh|crore|cr|bn|mn|k|x|×)?\+?)(?![\w])\s*(.*)$/i);
    if (!m) continue;
    const big = m[1].replace(/\s+/g, " ").replace(/percent/i, "%").replace(/minutes?/i, "min").trim();
    const caption = (m[2] || raw).replace(/^[-–—:,+]\s*/, "").trim();
    if (!/\d/.test(big) || !caption) continue;
    out.push({ big, caption: trunc(caption.charAt(0).toUpperCase() + caption.slice(1), 60), session: n.session.title });
    if (out.length >= 6) return out;
  }
  return out;
}
