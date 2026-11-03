"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { App } from "@/components/ui";
import { Unlock } from "@/components/icons";
import { api, invalidateAccess, useSessions, type Session } from "@/components/api";
import { useRequireMe } from "@/components/guard";

function UnlockInner() {
  const me = useRequireMe();
  const { id } = useParams<{ id: string }>();
  const code = useSearchParams().get("c");
  const { data, refresh } = useSessions(0);
  const [state, setState] = useState<{ fresh: boolean; session: Session } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!me) return;
    api<{ fresh: boolean; session: Session }>("/api/unlock", { method: "POST", json: { sessionId: id, code } }).then((r) => { setState(r); invalidateAccess(); refresh(); }).catch((e) => setErr(e.message));
  }, [me, id, code, refresh]);
  const talks = (data?.sessions || []).filter((s) => s.kind !== "break");
  const open = talks.filter((s) => s.open).length;
  const s = state?.session;
  return (
    <App>
      <div className="screen">
        <div className="hero fade" style={{ backgroundImage: "url('/assets/il-unlock.jpg')", minHeight: 360, justifyContent: "flex-start" }}>
          <div className="top safe-top"><span className="chip glass">{s?.room || "…"} · {new Date().toTimeString().slice(0, 5)}</span></div>
        </div>
        <div className="pad col" style={{ paddingTop: 8, paddingBottom: 40, justifyContent: "space-between", flex: 1, gap: 24 }}>
          {err ? <div className="col" style={{ gap: 12 }}><h1>Hmm.</h1><p className="lead">{err}</p></div> : (
            <div className="col" style={{ gap: 12 }}>
              <div className="row" style={{ gap: 10 }}><span style={{ width: 36, height: 36, borderRadius: 8, background: "var(--sky)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Unlock /></span><span className="eyebrow">{state ? (state.fresh ? "Unlocked" : "Already unlocked") : "Unlocking…"}</span></div>
              <h1>{s?.title || "…"}<br />is yours.</h1>
              <p className="lead">{s?.deckPages ? `The ${s.deckPages}-slide deck, ` : ""}everything Lekhak heard in the room, and your notes in My day.</p>
            </div>
          )}
          <div className="col" style={{ gap: 18 }}>
            <div className="row" style={{ gap: 14 }}><div className="progress" style={{ flex: 1 }}><i style={{ width: `${talks.length ? Math.round((open / talks.length) * 100) : 0}%` }} /></div><b style={{ fontSize: 14, color: "var(--sky)", whiteSpace: "nowrap" }}>{open} of {talks.length}</b></div>
            <Link className="btn lg" href={s ? `/session/${s.id}` : "/home"}>Open it</Link>
          </div>
        </div>
      </div>
    </App>
  );
}
export default function UnlockPage() { return <Suspense fallback={<App><div className="screen" /></App>}><UnlockInner /></Suspense>; }
