"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { App } from "@/components/ui";
import { Logo } from "@/components/icons";

export default function Install() {
  const [how, setHow] = useState<string | null>(null);
  const router = useRouter();
  const install = async () => {
    const p = (window as unknown as { __installPrompt?: { prompt: () => void; userChoice: Promise<{ outcome: string }> } }).__installPrompt;
    if (p) { p.prompt(); await p.userChoice; router.push("/signin"); return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setHow(ios ? 'Tap the Share button in Safari, then "Add to Home Screen". Lekhak opens full-screen, like any other app.' : 'Open the browser menu (⋮) and choose "Add to Home screen" or "Install app".');
  };
  return (
    <App>
      <div className="screen">
        <div className="hero fade" style={{ backgroundImage: "url('/assets/hero.jpg?v=4')", minHeight: 360, justifyContent: "flex-start" }}>
          <div className="top safe-top"><div className="logo-chip"><Logo h={34} /></div></div>
        </div>
        <div className="pad col" style={{ paddingTop: 28, paddingBottom: 32, gap: 24, flex: 1, justifyContent: "space-between" }}>
          <div className="col" style={{ gap: 14 }}>
            <div className="eyebrow">Investor Day 2026</div>
            <h1><span className="act">Every word.</span><br />Kept for you.</h1>
            <p className="lead">The keynote, every booth, and Lekhak, an AI note-taker you can ask anything, in your language. One tap to install, no app store.</p>
            <div className="tagline" style={{ fontSize: 28, lineHeight: 1.1, marginTop: 4 }}>Building <span className="act">AI</span> <span className="join">for</span> <span className="who">Bharat</span></div>
          </div>
          <div className="col" style={{ gap: 14 }}>
            <button className="btn lg" onClick={install}>Add to home screen</button>
            <Link href="/signin" className="btn text">Continue in the browser</Link>
          </div>
        </div>
        {how && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,11,75,.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 40 }} onClick={() => setHow(null)}>
            <div style={{ background: "var(--card)", boxShadow: "var(--glow-card)", width: "100%", maxWidth: 480, padding: "24px 24px 36px", borderRadius: "28px 28px 0 0", display: "flex", flexDirection: "column", gap: 14 }} onClick={(e) => e.stopPropagation()}>
              <h2>Add it to your home screen</h2><p className="lead">{how}</p>
              <Link href="/signin" className="btn">Got it — continue</Link>
            </div>
          </div>
        )}
      </div>
    </App>
  );
}
