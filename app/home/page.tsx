"use client";
import Link from "next/link";
import { useMemo } from "react";
import { App, Nav } from "@/components/ui";
import { Lock, Logo, Unlock } from "@/components/icons";
import { timeHM, useSessions, type Session, asset } from "@/components/api";
import { useRequireMe } from "@/components/guard";

export default function HomePage() {
  const me = useRequireMe();
  const { data } = useSessions(5000);
  const sessions = data?.sessions || [];
  const live = sessions.filter((s) => s.status === "live" || s.status === "paused");
  const now = Date.now();
  const next = useMemo(() => sessions.filter((s) => s.status === "upcoming" && new Date(s.endAt).getTime() > now).sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))[0], [sessions, now]);
  const talks = sessions.filter((s) => s.kind !== "break");
  const open = talks.filter((s) => s.open).length;
  const h = new Date().getHours(); const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const first = me?.name?.split(" ")[0] || "there";
  const feature: Session | undefined = live[0] || next || talks.find((s) => s.kind === "keynote");
  return (
    <App>
      <div className="screen">
        <div className="pad safe-top row between" style={{ paddingTop: "max(24px,env(safe-area-inset-top))" }}>
          <div><div className="small" style={{ fontWeight: 500 }}>{greet}</div><div className="grad-text" style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>{first}</div></div>
          <div className="row" style={{ gap: 10 }}><Logo h={40} /></div>
        </div>
        {feature && (
          <div className="pad" style={{ paddingTop: 18 }}>
            <Link href={feature.status === "live" || feature.status === "paused" ? `/live/${feature.id}` : `/session/${feature.id}`} className="live-card" style={{ backgroundImage: `url('${asset(feature.image)}')` }}>
              {feature.status === "live" ? <span className="chip glass"><span className="dot live-dot" />Live now</span> : feature.status === "paused" ? <span className="chip glass">Paused</span> : <span className="chip glass">{feature.kind === "keynote" ? "Keynote" : "Up next"} · {timeHM(feature.startAt)}</span>}
              <div className="eyebrow">{feature.room}</div>
              <div className="title">{feature.title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.88)" }}>{feature.speaker ? `${feature.speaker}${feature.speakerTitle ? `, ${feature.speakerTitle}` : ""} · ` : ""}{feature.status === "live" ? "Lekhak is listening · tap for the live transcript" : "Tap for details"}</div>
            </Link>
          </div>
        )}
        {live.length > 1 && (
          <div className="pad col" style={{ paddingTop: 12, gap: 8 }}>
            {live.slice(1).map((s) => <Link key={s.id} href={`/live/${s.id}`} className="pill on row between" style={{ padding: "12px 14px", fontSize: 14 }}><span><span className="dot live-dot" style={{ marginRight: 8 }} />{s.title}</span><span className="small" style={{ color: "var(--sky)" }}>{s.room}</span></Link>)}
          </div>
        )}
        <div className="pad row between" style={{ alignItems: "baseline", paddingTop: 22 }}><h3 style={{ fontSize: 18 }}>Today&apos;s agenda</h3><span style={{ fontSize: 13, fontWeight: 600, color: "var(--sky)" }}>{open} of {talks.length} unlocked</span></div>
        <div className="pad" style={{ paddingTop: 8 }}><div className="progress"><i style={{ width: `${talks.length ? Math.round((open / talks.length) * 100) : 0}%` }} /></div></div>
        <div className="pad col" style={{ paddingTop: 6, paddingBottom: 24 }}>
          {!data && [1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 64, margin: "6px 0" }} />)}
          {talks.map((s) => (
            <Link key={s.id} href={s.status === "live" || s.status === "paused" ? `/live/${s.id}` : `/session/${s.id}`} className={`agenda-item ${s.status === "live" ? "live" : ""}`}>
              <div className="when">{timeHM(s.startAt)}<small>{timeHM(s.endAt)}</small></div>
              <div style={{ flex: 1, minWidth: 0 }}><b>{s.title}</b><div className="meta">{s.room}{s.speaker ? ` · ${s.speaker}` : ""}{s.status === "ended" ? " · ended" : ""}</div></div>
              <div style={{ alignSelf: "center" }}>{s.status === "live" ? <span className="chip orange"><span className="dot live-dot" style={{ background: "#fff" }} />Live</span> : s.open ? <span className="chip green"><Unlock size={12} />Open</span> : <span className="chip grey"><Lock size={12} />Scan</span>}</div>
            </Link>
          ))}
        </div>
        <div className="grow" /><Nav on="home" />
      </div>
    </App>
  );
}
