"use client";
import Link from "next/link";
import { App } from "@/components/ui";
import { Back, Check, Download, Lock, Spark } from "@/components/icons";
import { timeHM, useSessions } from "@/components/api";
import { useRequireMe } from "@/components/guard";

export default function Notifications() {
  useRequireMe();
  const { data } = useSessions(0);
  const sessions = data?.sessions || [];
  const now = Date.now();
  const items: { kind: "lock" | "spark" | "check" | "download"; from: string; when: string; title: string; body: string; href: string }[] = [];
  for (const s of sessions.filter((x) => x.status === "live")) items.push({ kind: "spark", from: "Lekhak", when: "now", title: `${s.title} is live.`, body: `Lekhak is listening in ${s.room}. Ask anything ${s.speaker ? s.speaker.split(" ")[0] : "they"} said.`, href: `/live/${s.id}` });
  for (const s of sessions.filter((x) => x.status === "upcoming" && +new Date(x.startAt) - now > 0 && +new Date(x.startAt) - now < 45 * 60000)) items.push({ kind: "lock", from: data?.event.name || "Investor Day", when: timeHM(s.startAt), title: `${s.title} starts at ${timeHM(s.startAt)}.`, body: `${s.room}. Scan the last slide when it ends to keep it.`, href: `/session/${s.id}` });
  for (const s of sessions.filter((x) => x.status === "ended" && x.open && x.lastSeq > 0).slice(-3)) items.push({ kind: "check", from: "Lekhak", when: timeHM(s.endAt), title: `${s.title} transcript is complete — ${s.lastSeq} moments.`, body: "Ask about anything that was said.", href: `/ask?session=${s.id}` });
  items.push({ kind: "download", from: data?.event.name || "Investor Day", when: "tonight", title: "Your digest is building.", body: "Everything you heard, in My day — export it as PDF any time.", href: "/myday" });
  const Icon = { lock: <Lock size={22} />, spark: <Spark />, check: <Check />, download: <Download /> };
  const cls = { lock: "", spark: "navy", check: "steel", download: "steel" };
  return (
    <App dark>
      <div className="screen" style={{ background: "url('/assets/hero.jpg') center/cover" }}>
        <div style={{ background: "linear-gradient(180deg,rgba(29,53,74,.5),rgba(29,53,74,.8))", flex: 1, display: "flex", flexDirection: "column" }}>
          <div className="pad safe-top row between" style={{ paddingTop: "max(24px,env(safe-area-inset-top))" }}><Link className="icon-btn" href="/home" aria-label="Back"><Back /></Link><span className="chip glass">Nudges</span><span style={{ width: 44 }} /></div>
          <div className="center" style={{ padding: "40px 20px 0" }}><div style={{ fontSize: "clamp(56px,18vw,80px)", lineHeight: 1, fontWeight: 800, letterSpacing: -3 }}>{new Date().toTimeString().slice(0, 5)}</div><div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,.88)", marginTop: 4 }}>{data?.event.name || "Investor Day"}{data?.event.venue ? ` · ${data.event.venue}` : ""}</div></div>
          <div className="col" style={{ padding: "48px 16px 24px", gap: 12 }}>{items.map((n, i) => <Link key={i} href={n.href} className="notif"><div className={`ic ${cls[n.kind]}`}>{Icon[n.kind]}</div><div style={{ flex: 1 }}><div className="hd">{n.from}<span>{n.when}</span></div><p>{n.title}</p><small>{n.body}</small></div></Link>)}</div>
          <div className="grow" /><p className="small center" style={{ color: "rgba(255,255,255,.75)", paddingBottom: 36 }}>Nudges refresh with the agenda · at most one per session</p>
        </div>
      </div>
    </App>
  );
}
