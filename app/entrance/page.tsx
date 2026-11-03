"use client";
import Link from "next/link";
import { App, QR } from "@/components/ui";
import { Logo } from "@/components/icons";
import { appUrl, useSessions } from "@/components/api";

export default function Entrance() {
  const { data } = useSessions(0);
  const url = `${appUrl()}/install`;
  return (
    <App wide>
      <div className="left">
        <div className="logo-chip"><Logo h={64} /></div>
        <div className="col" style={{ gap: 28 }}>
          <div className="eyebrow">{data?.event.name || "Investor Day 2026"}</div>
          <h1>Scan once.<br />Keep the<br />whole day.</h1>
          <p className="lead">The keynote, every booth, and Lekhak, an AI note-taker that listens live so you don&apos;t have to.</p>
          <img src="/brand/building-ai-for-bharat.png" alt="Building AI for Bharat" style={{ height: "clamp(40px,4vw,72px)", width: "auto", alignSelf: "flex-start", flexShrink: 0 }} />
        </div>
        <div className="row" style={{ gap: 16, fontSize: "clamp(14px,1.3vw,22px)", fontWeight: 500, color: "rgba(255,255,255,.85)" }}><span className="dot" style={{ width: 12, height: 12 }} />No app store. Ten seconds. Works on any phone.</div>
        <div className="no-print row" style={{ gap: 12, flexWrap: "wrap" }}>
          <Link href="/install" className="btn ghost" style={{ width: "auto", height: 48, padding: "0 18px", background: "rgba(255,255,255,.1)", color: "#fff", borderColor: "rgba(255,255,255,.35)" }}>Open the app on this device →</Link>
          <Link href="/admin" className="small" style={{ color: "rgba(255,255,255,.55)", fontWeight: 500 }}>Admin console</Link>
        </div>
      </div>
      <div className="right" style={{ backgroundImage: "url('/assets/hero-wide.jpg?v=3')" }}>
        <div className="qrcard"><div className="qr"><QR text={url} /></div><b>{url.replace(/^https?:\/\//, "")}</b></div>
      </div>
    </App>
  );
}
