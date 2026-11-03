"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { Home, Scan, Spark, Book, Back, Plus } from "./icons";
import { api, asset } from "./api";

/* ---------- toast ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => { setMsg(m); if (t.current) clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 2800); }, []);
  return <ToastCtx.Provider value={show}>{children}{msg && <div className="toast" role="status">{msg}</div>}</ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);

/* ---------- shell ---------- */
export function App({ children, dark, wide }: { children: ReactNode; dark?: boolean; wide?: boolean }) {
  return <main className={`app ${dark ? "dark" : ""} ${wide ? "wide" : ""}`}>{!wide && <TopBar />}{children}</main>;
}

/** Sticky app bar: the lockup and a "New chat" action, locked to the top of every attendee screen. */
function TopBar() {
  const path = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const hidden = ["/", "/install", "/signin", "/scan", "/ask"].includes(path) || path.startsWith("/pass/") || path.startsWith("/unlock/");
  if (hidden) return null;
  const go = async () => {
    if (busy) return; setBusy(true);
    try { await api("/api/chat", { method: "DELETE" }); toast("New chat started"); router.push("/ask?fresh=1"); }
    catch { router.push("/ask"); }
    finally { setBusy(false); }
  };
  return (
    <div className="topbar no-print">
      <Link href="/home" className="topbar-brand" aria-label="Home"><img src="/brand/piramal-ai-lockup.png" alt="Piramal.ai" /></Link>
      <button type="button" className="fab" onClick={go} disabled={busy} aria-label="Start a new chat with Lekhak">
        <span className="fab-ic"><Plus size={16} /><Spark size={14} /></span><span className="fab-lbl">New chat</span>
      </button>
    </div>
  );
}

export function Nav({ on }: { on: "home" | "scan" | "ask" | "myday" | "" }) {
  const items: [string, ReactNode, string, string][] = [["/home", <Home key="h" />, "Home", "home"], ["/scan", <Scan key="s" />, "Scan", "scan"], ["/ask", <Spark key="a" />, "Ask", "ask"], ["/myday", <Book key="m" />, "My day", "myday"]];
  return <nav className="nav">{items.map(([h, ic, l, k]) => <Link key={k} href={h} className={on === k ? "on" : ""}>{ic}{l}</Link>)}</nav>;
}

export function Hero({ image, title, eyebrow, sub, right, back = "/home", dim, fade, minHeight }: { image: string; title: ReactNode; eyebrow?: string; sub?: string; right?: ReactNode; back?: string; dim?: boolean; fade?: boolean; minHeight?: number }) {
  return (
    <header className={`hero ${dim ? "dim" : ""} ${fade ? "fade" : ""}`} style={{ backgroundImage: `url('${asset(image)}')`, minHeight }}>
      <div className="top safe-top"><Link className="icon-btn" href={back} aria-label="Back"><Back /></Link>{right}</div>
      <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{sub && <div className="lead" style={{ marginTop: 6, fontSize: 14 }}>{sub}</div>}</div>
    </header>
  );
}

export function QR({ text, size = 512, className }: { text: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => { let on = true; QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: "M", color: { dark: "#000b4b", light: "#FFFFFF" } }).then((u) => { if (on) setSrc(u); }); return () => { on = false; }; }, [text, size]);
  return src ? <img src={src} alt="QR code" className={className} /> : <div className={`skel ${className || ""}`} style={{ width: "100%", aspectRatio: "1" }} />;
}

/* ---------- tiny markdown (bold, bullets, paragraphs) ---------- */
export function Md({ text, className = "answer" }: { text: string; className?: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter((l) => l.trim());
        if (!lines.length) return null;
        if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</li>)}</ul>;
        return <p key={i}>{lines.map((l, j) => <span key={j}>{inline(l)}{j < lines.length - 1 && <br />}</span>)}</p>;
      })}
    </div>
  );
}

/* ---------- speech synthesis playback for quotes ---------- */
export function speak(text: string, onEnd: () => void): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) { const t = setTimeout(onEnd, Math.min(12000, 60 * text.length)); return () => clearTimeout(t); }
  const u = new SpeechSynthesisUtterance(text);
  const devanagari = /[ऀ-ॿ]/.test(text);
  const voices = speechSynthesis.getVoices();
  const v = voices.find((x) => (devanagari ? /hi-IN/i : /en-IN/i).test(x.lang)) || voices.find((x) => /^en/i.test(x.lang));
  if (v) u.voice = v; u.rate = 0.98; u.onend = onEnd; u.onerror = onEnd;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
  return () => speechSynthesis.cancel();
}

export function Spinner({ light }: { light?: boolean }) {
  return <span style={{ display: "inline-block", width: 18, height: 18, border: `2.5px solid ${light ? "rgba(0,11,75,.25)" : "rgba(255,255,255,.2)"}`, borderTopColor: light ? "#000b4b" : "#59bdfc", borderRadius: "50%", animation: "spin .8s linear infinite" }} />;
}
