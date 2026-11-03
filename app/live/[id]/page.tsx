"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { App } from "@/components/ui";
import { Back, Mic } from "@/components/icons";
import { fmtOffset, useLiveTranscript, usePresence, useSessions } from "@/components/api";
import { useRequireMe } from "@/components/guard";

export default function LivePage() {
  const me = useRequireMe();
  const { id } = useParams<{ id: string }>();
  const { data } = useSessions(5000);
  const s = data?.sessions.find((x) => x.id === id);
  const { segments, interim, state, connected } = useLiveTranscript(id);
  const isLive = (state?.status || s?.status) === "live";
  usePresence(id, Boolean(me) && isLive);
  const [clock, setClock] = useState("00:00");
  const stateAt = useRef(Date.now());
  useEffect(() => { stateAt.current = Date.now(); }, [state?.nowOffsetMs]);
  useEffect(() => {
    const t = setInterval(() => { if (!state) return; const base = state.nowOffsetMs + (state.status === "live" ? Date.now() - stateAt.current : 0); setClock(fmtOffset(base)); }, 1000);
    return () => clearInterval(t);
  }, [state]);
  const txRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  useEffect(() => { if (follow && txRef.current) txRef.current.scrollTop = txRef.current.scrollHeight; }, [segments, interim, follow]);
  const onScroll = () => { const el = txRef.current; if (!el) return; setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 60); };
  const recent = useMemo(() => segments.slice(-80), [segments]);
  const status = state?.status || s?.status || "upcoming";
  if (data && !s) return <App dark><div className="screen pad" style={{ justifyContent: "center", gap: 16, textAlign: "center" }}><div className="orb quiet" /><h2>This session isn&apos;t on the agenda any more.</h2><Link className="btn ghost" href="/home">Back to the agenda</Link></div></App>;
  return (
    <App dark>
      <div className="screen">
        <div className="pad safe-top row between" style={{ paddingTop: "max(24px,env(safe-area-inset-top))" }}>
          <Link className="icon-btn" href="/home" aria-label="Back"><Back /></Link>
          <span className="chip glass" style={{ background: "rgba(255,255,255,.1)" }}>
            {status === "live" ? <><span className="dot live-dot" />Live · {clock}</> : status === "paused" ? <>Paused · {clock}</> : status === "ended" ? <>Ended · {clock}</> : <>Starts soon</>}
          </span>
        </div>
        <div className="col center" style={{ alignItems: "center", gap: 14, padding: "18px 28px 0" }}>
          <div className={`orb ${status === "live" ? "" : "quiet"}`} style={{ width: "min(130px,32vw)" }} />
          <div>
            <div className="eyebrow">{status === "live" ? "Lekhak is listening" : status === "paused" ? "Paused by the host" : status === "ended" ? "Lekhak kept every word" : "Waiting for the host to go live"}</div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.5, marginTop: 4 }}>{s?.speaker || s?.title || "…"}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,.7)", marginTop: 4 }}>{s?.title}{s?.room ? ` · ${s.room}` : ""}</div>
          </div>
        </div>
        <div className="sheet">
          <div className="row between"><b style={{ fontSize: 13 }}>Live transcript</b><span className="small" style={{ fontWeight: 500 }}>{connected ? `${segments.length} moments` : "reconnecting…"}</span></div>
          <div className="tx" ref={txRef} onScroll={onScroll}>
            {!segments.length && !interim && <p className="lead" style={{ fontSize: 14 }}>{status === "live" ? "Listening… the first words will appear here in a moment." : status === "upcoming" ? "The transcript will appear here, word by word, the moment the session goes live." : "No transcript was recorded for this session."}</p>}
            {recent.map((g, i) => <div key={g.seq} className={`tline ${i === recent.length - 1 && !interim ? "now" : ""}`}><div className="t">{fmtOffset(g.offsetMs)}</div><p>{g.text}{i === recent.length - 1 && !interim && status === "live" && <span className="caret" />}</p></div>)}
            {interim && <div className="tline now interim"><div className="t">now</div><p>{interim}<span className="caret" /></p></div>}
          </div>
          {!follow && <button className="btn text" style={{ height: 36 }} onClick={() => { setFollow(true); if (txRef.current) txRef.current.scrollTop = txRef.current.scrollHeight; }}>Jump to live ↓</button>}
        </div>
        <div className="sheet-foot"><Link className="btn" href={`/ask?session=${id}`}><Mic />Ask about anything {s?.speaker ? s.speaker.split(" ")[0] : "they"} said</Link></div>
      </div>
    </App>
  );
}
