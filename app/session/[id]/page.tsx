"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { App, Hero, Nav } from "@/components/ui";
import { Bell, Lock, Spark, Unlock } from "@/components/icons";
import { api, fmtOffset, timeHM, useSessions, type Segment } from "@/components/api";
import { useRequireMe } from "@/components/guard";
import { useToast } from "@/components/ui";

interface Doc { id: string; name: string; pages: number; slides: { page: number; title: string; text: string; numbers: string[] }[] }

export default function SessionPage() {
  const me = useRequireMe();
  const { id } = useParams<{ id: string }>();
  const { data } = useSessions(15000);
  const s = data?.sessions.find((x) => x.id === id);
  const toast = useToast();
  const [tab, setTab] = useState<"about" | "deck" | "transcript">("about");
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [segs, setSegs] = useState<Segment[] | null>(null);
  useEffect(() => { if (!s?.open) return; api<{ documents: Doc[] }>(`/api/sessions/${id}/documents`).then((r) => setDocs(r.documents)).catch(() => setDocs([])); }, [id, s?.open]);
  useEffect(() => { if (tab !== "transcript" || !s?.open) return; api<{ segments: Segment[] }>(`/api/sessions/${id}/segments?after=0`).then((r) => setSegs(r.segments)).catch(() => setSegs([])); }, [tab, id, s?.open]);
  if (!s) return <App><div className="screen"><div className="skel" style={{ height: 280 }} /></div></App>;
  if (s.status === "live" || s.status === "paused") { if (typeof window !== "undefined") window.location.replace(`/live/${s.id}`); return null; }
  if (!s.open) {
    return (
      <App><div className="screen">
        <Hero image={s.image} eyebrow={s.room} title={s.title} dim right={<span className="chip glass" style={{ border: "1px solid rgba(255,255,255,.3)" }}><Lock />Locked</span>} />
        <div className="pad col" style={{ paddingTop: 26, paddingBottom: 40, justifyContent: "space-between", flex: 1, gap: 20 }}>
          <div className="col" style={{ gap: 20 }}>
            <div><h2 style={{ fontSize: 26 }}>Be in the room to unlock it.</h2><p className="lead" style={{ fontSize: 15, marginTop: 8 }}>{s.tagline || s.description}. Attend the session and scan the QR on the last slide — the deck, the transcript and Lekhak&apos;s notes open here.</p></div>
            <div className="sess"><div className="next"><b>{timeHM(s.startAt)}</b><span>{s.status === "ended" ? "Ended" : "Starts"} · {s.room}</span></div><div><b>{timeHM(s.endAt)}</b><span>Ends{s.speaker ? ` · ${s.speaker}` : ""}</span></div></div>
          </div>
          <div className="col" style={{ gap: 12 }}><Link className="btn lg" href="/scan">I&apos;m here — scan</Link><button className="btn ghost" onClick={() => toast(`We'll nudge you 5 minutes before ${timeHM(s.startAt)}`)}><Bell />Remind me 5 minutes before</button></div>
        </div><Nav on="" />
      </div></App>
    );
  }
  const totalSlides = (docs || []).reduce((n, d) => n + d.pages, 0);
  return (
    <App><div className="screen">
      <Hero image={s.image} eyebrow={s.room} title={s.title} sub={s.speaker ? `${s.speaker}${s.speakerTitle ? `, ${s.speakerTitle}` : ""} · ${timeHM(s.startAt)}–${timeHM(s.endAt)}` : `${timeHM(s.startAt)}–${timeHM(s.endAt)}`} right={<span className="chip orange"><Unlock size={12} />Unlocked</span>} />
      <div className="tabs"><button className={tab === "about" ? "on" : ""} onClick={() => setTab("about")}>About</button><button className={tab === "deck" ? "on" : ""} onClick={() => setTab("deck")}>Deck{totalSlides ? ` · ${totalSlides}` : ""}</button><button className={tab === "transcript" ? "on" : ""} onClick={() => setTab("transcript")}>Transcript{s.lastSeq ? ` · ${s.lastSeq}` : ""}</button></div>
      <div className="pad" style={{ paddingTop: 22, paddingBottom: 22, flex: 1 }}>
        {tab === "about" && <div className="col" style={{ gap: 16 }}>{s.tagline && <p style={{ margin: 0, fontSize: 18, fontWeight: 800, lineHeight: 1.35, borderLeft: "3px solid var(--orange)", paddingLeft: 14 }}>{s.tagline}</p>}<p className="lead">{s.description || "Details to follow."}</p>{s.status === "ended" && <p className="small">This session has ended. Lekhak kept {s.lastSeq} moments — ask anything, or read the transcript.</p>}</div>}
        {tab === "deck" && (docs === null ? <div className="skel" style={{ height: 120 }} /> : !docs.length ? <p className="lead">The deck hasn&apos;t been shared yet. When the host uploads it, every slide appears here and Lekhak can quote it.</p> : (
          <div className="col" style={{ gap: 12 }}>{docs.map((d) => <div key={d.id} className="col" style={{ gap: 10 }}><div className="row between"><div className="label">{d.name}</div>{me && <a href={`/api/documents/${d.id}/file`} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800 }}>Open PDF</a>}</div>{d.slides.map((sl) => <div key={sl.page} className="slide"><div className="n">{String(sl.page).padStart(2, "0")}</div><div style={{ minWidth: 0 }}><b>{sl.title}</b><p>{sl.text}</p>{sl.numbers.length > 0 && <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 6 }}>{sl.numbers.slice(0, 3).map((n, i) => <span key={i} className="chip tint" style={{ letterSpacing: 0, textTransform: "none" }}>{n}</span>)}</div>}</div></div>)}</div>)}</div>
        ))}
        {tab === "transcript" && (segs === null ? <div className="skel" style={{ height: 120 }} /> : !segs.length ? <p className="lead">No transcript yet.</p> : <div className="col" style={{ gap: 12 }}>{segs.map((g) => <div key={g.seq} className="tline"><div className="t">{fmtOffset(g.offsetMs)}</div><p style={{ color: "var(--ink)" }}>{g.text}</p></div>)}</div>)}
      </div>
      <div className="pad" style={{ paddingBottom: 24 }}><Link className="btn" href={`/ask?session=${s.id}`}><Spark />Ask Lekhak about this session</Link></div><Nav on="" />
    </div></App>
  );
}
