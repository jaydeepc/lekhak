"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { App, QR } from "@/components/ui";
import { Logo } from "@/components/icons";
import { api, appUrl, type Session, asset } from "@/components/api";

/** Wide "last slide" for a booth: the QR that unlocks it in the app. Open on the room's screen. */
export default function Slide() {
  const { id } = useParams<{ id: string }>();
  const [s, setS] = useState<(Session & { code?: string }) | null>(null);
  const [code, setCode] = useState<string>("");
  useEffect(() => {
    api<{ sessions: Session[] }>("/api/sessions").then((r) => setS(r.sessions.find((x) => x.id === id) || null));
    // the code is admin-only; show it if the admin is signed in on this screen
    api<{ sessions: { id: string; code: string }[] }>("/api/admin/sessions").then((r) => setCode(r.sessions.find((x) => x.id === id)?.code || "")).catch(() => {});
  }, [id]);
  const url = `${appUrl()}/unlock/${id}${code ? `?c=${code}` : ""}`;
  return (
    <App wide>
      <div className="left">
        <div className="row between" style={{ gap: 16, flexWrap: "wrap" }}><div className="logo-chip"><Logo h={64} /></div><div className="eyebrow">Investor Day 2026</div></div>
        <div className="col" style={{ gap: 28 }}><span className="chip orange" style={{ alignSelf: "flex-start", fontSize: "clamp(12px,1.1vw,22px)", padding: "12px 20px" }}>{s?.room} · {s?.title}</span><h1><span className="act">Take it</span><br />with you.</h1><p className="lead">Scan to unlock this session in Lekhak — the deck, the transcript and everything you just heard.</p></div>
        <div style={{ fontSize: "clamp(14px,1.3vw,22px)", fontWeight: 400, color: "var(--ink-muted)" }}>{code ? <>Can&apos;t scan? Room code <span style={{ letterSpacing: 4, fontWeight: 700, color: "var(--flame-ink)" }}>{code}</span></> : "Can't scan? Ask the host for the room code."}</div>
      </div>
      <div className="right" style={{ backgroundImage: `url('${asset(s?.image || "/assets/hero.jpg")}')` }}><div className="qrcard"><div className="qr"><QR text={url} /></div><b>Scan to unlock</b></div></div>
    </App>
  );
}
