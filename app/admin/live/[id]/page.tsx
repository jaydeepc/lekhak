"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, fmtOffset, timeHM, useLiveTranscript } from "@/components/api";
import { useAdminSessions, type AdminSession } from "@/components/admin";
import { LiveMic } from "@/components/liveMic";
import { useToast } from "@/components/ui";
import { Mic, Radio } from "@/components/icons";

/**
 * The recorder. Put this laptop near the speaker, press Start. Audio goes browser → Gemini Live; finalised
 * sentences are posted to the server and fan out to every attendee's phone within a second.
 */
export default function Recorder() {
  const { id } = useParams<{ id: string }>();
  const { sessions, refresh } = useAdminSessions(5000);
  const s: AdminSession | undefined = sessions?.find((x) => x.id === id);
  const toast = useToast();
  const { segments, interim: remoteInterim, state } = useLiveTranscript(id);
  const [mic, setMic] = useState<LiveMic | null>(null);
  const [micStatus, setMicStatus] = useState<string>("stopped");
  const [micError, setMicError] = useState<string | null>(null);
  const [stats, setStats] = useState({ interims: 0, finals: 0, saved: 0, failed: 0 });
  const [level, setLevel] = useState(0);
  const [localInterim, setLocalInterim] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const liveStartRef = useRef<number>(0);
  const interimTimer = useRef<number>(0);
  const txRef = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState("00:00");

  useEffect(() => { navigator.mediaDevices?.enumerateDevices?.().then((d) => setDevices(d.filter((x) => x.kind === "audioinput"))).catch(() => {}); }, [mic]);
  useEffect(() => { if (txRef.current) txRef.current.scrollTop = txRef.current.scrollHeight; }, [segments, localInterim, remoteInterim]);
  useEffect(() => { if (s?.liveStartedAt) liveStartRef.current = new Date(s.liveStartedAt).getTime(); }, [s?.liveStartedAt]);
  useEffect(() => {
    const t = setInterval(() => { if (s?.status === "live" && liveStartRef.current) setClock(fmtOffset(Date.now() - liveStartRef.current)); else if (state) setClock(fmtOffset(state.nowOffsetMs)); }, 1000);
    return () => clearInterval(t);
  }, [s?.status, state]);

  const control = useCallback(async (action: string) => {
    setBusy(true);
    try { const r = await api<{ session: AdminSession }>(`/api/admin/sessions/${id}/live`, { method: "POST", json: { action } }); if (r.session.liveStartedAt) liveStartRef.current = new Date(r.session.liveStartedAt).getTime(); await refresh(); return r.session; }
    catch (e) { toast(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }, [id, refresh, toast]);

  const pushInterim = (text: string) => {
    setLocalInterim(text);
    const now = Date.now();
    if (now - interimTimer.current < 350 && text) return;
    interimTimer.current = now;
    api(`/api/admin/sessions/${id}/segments`, { method: "PATCH", json: { interim: text } }).catch(() => {});
  };

  const start = async () => {
    if (mic) return;
    const sess = s?.status === "live" ? s : await control("start");
    if (!sess) return;
    const startedAt = new Date(sess.liveStartedAt || Date.now()).getTime();
    liveStartRef.current = startedAt;
    const m = new LiveMic({
      deviceId: deviceId || undefined,
      onInterim: (t) => { if (t) setStats((x) => ({ ...x, interims: x.interims + 1 })); pushInterim(t); },
      onFinal: (text, offsetMs) => {
        setLocalInterim(""); setStats((x) => ({ ...x, finals: x.finals + 1 }));
        api(`/api/admin/sessions/${id}/segments`, { method: "POST", json: { segments: [{ text, offsetMs }] } })
          .then(() => setStats((x) => ({ ...x, saved: x.saved + 1 })))
          .catch((e) => { setStats((x) => ({ ...x, failed: x.failed + 1 })); setMicError(`Could not save a line: ${e.message}`); });
        api(`/api/admin/sessions/${id}/segments`, { method: "PATCH", json: { interim: "" } }).catch(() => {});
      },
      onStatus: (st, detail) => {
        setMicStatus(st + (detail ? ` · ${detail}` : ""));
        if (st === "error") setMicError(detail || "Microphone or Gemini Live error");
        if (st === "listening") setMicError(null);
      },
      onLevel: setLevel,
      onUsage: (secs) => api("/api/gemini/live-usage", { method: "POST", json: { audioSeconds: secs, sessionId: id } }).catch(() => {}),
    });
    setMic(m); setMicError(null); setStats({ interims: 0, finals: 0, saved: 0, failed: 0 });
    try { await m.start(startedAt); } catch (e) {
      setMic(null);
      const msg = e instanceof Error ? e.message : "Could not start the microphone";
      setMicError(/denied|permission|NotAllowed/i.test(msg) ? "Microphone access was blocked. Allow the microphone for this site in the browser's address bar, then press Start again." : msg);
    }
  };
  const stopMic = async () => { if (!mic) return; await mic.stop(); setMic(null); setLocalInterim(""); api(`/api/admin/sessions/${id}/segments`, { method: "PATCH", json: { interim: "" } }).catch(() => {}); };
  const pause = async () => { await stopMic(); await control("pause"); };
  const end = async () => { if (!confirm("End this session for everyone? The transcript stays available.")) return; await stopMic(); await control("end"); };
  const reset = async () => { if (!confirm("Delete the whole transcript for this session and start over?")) return; await stopMic(); await control("reset"); };
  useEffect(() => () => { mic?.stop(); }, [mic]);

  const interim = localInterim || remoteInterim;
  const status = s?.status || "upcoming";
  return (
    <>
      <div className="adm-head">
        <div><div className="row" style={{ gap: 10 }}><Link href="/admin/sessions" className="small" style={{ fontWeight: 800 }}>← Agenda</Link></div><h1>{s?.title || "…"}</h1><div className="sub">{s ? `${s.room}${s.speaker ? ` · ${s.speaker}` : ""} · ${timeHM(s.startAt)}–${timeHM(s.endAt)} · room code ${s.code}` : ""}</div></div>
        <div className="row" style={{ gap: 10 }}><span className={`status ${status}`} style={{ fontSize: 13, padding: "10px 14px" }}>{status === "live" && <span className="dot live-dot" />}{status} · {clock}</span></div>
      </div>
      <div className="rec">
        <div className="rec-main">
          <div className="row between"><b>Transcript as attendees see it</b><span className="small">{segments.length} moments{s?.liveInterim ? " · captioning" : ""}</span></div>
          <div className="rec-tx" ref={txRef}>
            {!segments.length && !interim && <p className="lead" style={{ fontSize: 14 }}>{status === "live" ? "Listening… the first sentence appears here and on every phone as soon as it's finalised." : "Press Start listening. Attendees see words appear live, and can ask Lekhak about them immediately."}</p>}
            {segments.map((g) => <div key={g.seq} className="tline"><div className="t">{fmtOffset(g.offsetMs)}</div><p>{g.text}</p></div>)}
            {interim && <div className="tline interim"><div className="t">now</div><p>{interim}<span className="caret" /></p></div>}
          </div>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <div className="adm-card">
            <h3>Recorder</h3>
            <div className="col" style={{ gap: 12 }}>
              <div className="field"><label>Microphone</label><select className="input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} disabled={Boolean(mic)}><option value="">Default microphone</option>{devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>)}</select></div>
              <div className="meter"><i style={{ width: `${Math.min(100, level * 400)}%` }} /></div>
              <div className="small" style={{ fontWeight: 700 }}>Gemini Live: {mic ? micStatus : "idle"}{mic ? ` · ${stats.interims} captions · ${stats.finals} lines · ${stats.saved} saved${stats.failed ? ` · ${stats.failed} failed` : ""}` : ""}</div>
              {micError && <div className="err">{micError}</div>}
              {mic && micStatus.startsWith("listening") && level < 0.002 && stats.interims === 0 && <div className="err" style={{ background: "#FFF4D6", color: "#8A5A00" }}>No sound is reaching the microphone. Check the input device above and the laptop's input volume.</div>}
              {!mic ? <button className="btn bigbtn" disabled={busy} onClick={start}><Mic />{status === "live" ? "Resume listening" : status === "paused" ? "Resume session" : status === "ended" ? "Reopen & listen" : "Go live & start listening"}</button>
                : <button className="btn bigbtn stop" onClick={stopMic}>Stop microphone (stay live)</button>}
              <div className="btn-row">
                {status === "live" && <button className="btn inline ghost" disabled={busy} onClick={pause}>Pause for attendees</button>}
                {status !== "ended" && status !== "upcoming" && <button className="btn inline ghost" disabled={busy} onClick={end}>End session</button>}
                {(status === "ended" || segments.length > 0) && <button className="btn inline danger" disabled={busy} onClick={reset}>Reset transcript</button>}
              </div>
            </div>
          </div>
          <div className="adm-card">
            <h3>How it works</h3>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: "var(--muted)", fontWeight: 700 }}>
              <li>Keep this laptop within a few metres of the speaker, or feed the room mix into the mic input.</li>
              <li>Audio streams straight from this browser to <span className="mono">gemini-3.5-transcribe-live</span>; it auto-detects English and Indic languages.</li>
              <li>Each finished sentence is saved with its timestamp and pushed to every phone in under a second. Interim words show as live captions.</li>
              <li>Attendees on this session are added to its <b>My day</b> notes automatically.</li>
            </ol>
          </div>
          <div className="adm-card"><h3>Attendee view</h3><div className="btn-row"><Link className="btn inline ghost" href={`/live/${id}`} target="_blank">Open live screen ↗</Link><Link className="btn inline ghost" href={`/slide/${id}`} target="_blank">Last-slide QR ↗</Link></div></div>
        </div>
      </div>
    </>
  );
}
