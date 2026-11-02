"use client";
import { useState } from "react";
import { Logo } from "@/components/icons";
import { api } from "@/components/api";
import { Spinner } from "@/components/ui";

export default function AdminLogin() {
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api("/api/admin/login", { method: "POST", json: { username: u, password: p } }); window.location.assign("/admin"); }
    catch (x) { setErr(x instanceof Error ? x.message : "Sign-in failed"); setBusy(false); }
  };
  return (
    <main className="app" style={{ justifyContent: "center", minHeight: "100dvh" }}>
      <form onSubmit={submit} className="pad col" style={{ gap: 20, padding: "48px 32px" }}>
        <Logo h={34} />
        <div><div className="eyebrow">Lekhak console</div><h1 style={{ fontSize: 30 }}>Host sign-in</h1><p className="lead" style={{ fontSize: 15 }}>Run the agenda, go live with the transcript, print passes, watch costs.</p></div>
        <div className="field"><label htmlFor="u">Username</label><input className="input" id="u" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required /></div>
        <div className="field"><label htmlFor="p">Password</label><input className="input" id="p" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required /></div>
        {err && <div className="err">{err}</div>}
        <button className="btn lg" disabled={busy}>{busy ? <Spinner light /> : "Sign in"}</button>
        <a href="/" className="btn text">← Back to the app</a>
      </form>
    </main>
  );
}
