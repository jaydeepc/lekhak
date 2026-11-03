"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { App, Hero, Spinner } from "@/components/ui";
import { Scan } from "@/components/icons";
import { api, invalidateAccess } from "@/components/api";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try { await api("/api/auth/signin", { method: "POST", json: { email } }); invalidateAccess(); router.push("/home"); }
    catch (x) { setErr(x instanceof Error ? x.message : "Could not sign in"); setBusy(false); }
  };
  return (
    <App>
      <div className="screen">
        <Hero image="/brand/backdrop-portrait.jpg" eyebrow="Investor Day 2026" title="Welcome, investor." back="/install" />
        <form className="pad col" onSubmit={submit} style={{ paddingTop: 28, paddingBottom: 32, gap: 20, flex: 1 }}>
          <p className="lead">Enter the email your invitation came to. Your pass is already waiting.</p>
          <div className="field"><label htmlFor="email">Invitation email <span className="req">*</span></label><input className="input" id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@firm.com" /></div>
          {err && <div className="err">{err}</div>}
          <button className="btn lg" type="submit" disabled={busy}>{busy ? <Spinner light /> : "Continue"}</button>
          <div className="row" style={{ gap: 12, color: "var(--ink-muted)", fontSize: 13, fontWeight: 500 }}><span style={{ flex: 1, height: 1, background: "var(--line)" }} />or<span style={{ flex: 1, height: 1, background: "var(--line)" }} /></div>
          <Link className="btn ghost" href="/scan?mode=pass" style={{ color: "var(--ink)" }}><Scan />&nbsp;Scan the QR on your pass</Link>
          <div className="grow" />
          <p className="small center">Private to invited investors. What you ask Lekhak stays yours.</p>
        </form>
      </div>
    </App>
  );
}
