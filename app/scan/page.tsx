"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { App, useToast } from "@/components/ui";
import { Chev, Close, Unlock } from "@/components/icons";
import { api, useMe, useSessions } from "@/components/api";

function ScanInner() {
  const router = useRouter();
  const params = useSearchParams();
  const passMode = params.get("mode") === "pass";
  const { me } = useMe();
  const { data } = useSessions(0);
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "off">("starting");
  const [found, setFound] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null, raf = 0, done = false;
    const video = videoRef.current!;
    const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const handle = async (text: string) => {
      if (done) return;
      const pass = text.match(/\/pass\/([a-z0-9]+)/i);
      const unlock = text.match(/\/unlock\/([a-f0-9]{24})(?:\?c=([A-Z0-9]+))?/i);
      if (pass) { done = true; setFound("Your pass"); setTimeout(() => router.push(`/pass/${pass[1]}`), 600); return; }
      if (unlock) { done = true; const s = data?.sessions.find((x) => x.id === unlock[1]); setFound(s?.title || "Session"); setTimeout(() => router.push(`/unlock/${unlock[1]}${unlock[2] ? `?c=${unlock[2]}` : ""}`), 600); return; }
      const m = text.match(/^[A-Z0-9]{6}$/); if (m) { done = true; setCode(text); void submitCode(text); }
    };
    if (navigator.mediaDevices?.getUserMedia && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((st) => {
        stream = st; video.srcObject = st; setCamera("on"); return video.play();
      }).then(() => {
        const loop = () => {
          if (done) return;
          if (video.readyState === 4) {
            canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx.drawImage(video, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const r = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (r?.data) void handle(r.data);
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      }).catch(() => setCamera("off"));
    } else setCamera("off");
    return () => { done = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function submitCode(c: string) {
    const v = c.trim().toUpperCase(); if (!v) return;
    if (!me) { toast("Sign in first, then scan to unlock"); router.push("/signin"); return; }
    setBusy(true);
    try { const r = await api<{ session: { id: string } }>("/api/unlock", { method: "POST", json: { code: v } }); router.push(`/unlock/${r.session.id}?c=${v}`); }
    catch (e) { toast(e instanceof Error ? e.message : "That code didn't match"); setBusy(false); }
  }

  return (
    <App dark>
      <div className="screen">
        <div className="viewport">
          <video ref={videoRef} playsInline muted style={{ display: camera === "on" ? "block" : "none" }} />
          <div className="top safe-top"><Link className="icon-btn" href={me ? "/home" : "/signin"} aria-label="Close"><Close /></Link><span className="chip glass">{passMode ? "Scan your pass" : "Scan to unlock"}</span><span style={{ width: 44 }} /></div>
          <div className="finder"><i /><i /><i /><i /><div className="line" /></div>
        </div>
        <div style={{ background: "#fff", color: "var(--ink)", padding: "24px 24px max(36px,env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 14 }}>
          <div><div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{passMode ? "Point at the QR on your pass" : "Point at the last slide"}</div><div className="small" style={{ fontSize: 14 }}>{camera === "on" ? "Camera on. Hold steady for a second." : camera === "starting" ? "Starting the camera…" : "Camera unavailable here — type the room code instead."}</div></div>
          {found && <div className="found"><span className="ic"><Unlock /></span><div style={{ flex: 1 }}><small>Code found</small><b>{found}</b></div><Chev /></div>}
          {!passMode && (
            <form className="row" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); submitCode(code); }}>
              <label className="sr" htmlFor="code">Room code</label>
              <input className="input" id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Or type the room code" style={{ textTransform: "uppercase", letterSpacing: 2 }} autoCapitalize="characters" />
              <button className="btn" type="submit" disabled={busy} style={{ width: "auto", padding: "0 18px" }}>Unlock</button>
            </form>
          )}
          {passMode && <Link href="/signin" className="btn text">Sign in with email instead</Link>}
        </div>
      </div>
    </App>
  );
}
export default function ScanPage() { return <Suspense fallback={<App dark><div className="screen" /></App>}><ScanInner /></Suspense>; }
