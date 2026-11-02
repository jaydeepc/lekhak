"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> || {}) };
  let body = init?.body;
  if (init?.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(init.json); }
  const res = await fetch(path, { ...init, headers, body, credentials: "same-origin", cache: "no-store" });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error || res.statusText);
  return data as T;
}

export interface Attendee { id: string; name: string; email: string; firm: string }
export interface Session {
  id: string; slug: string; title: string; tagline: string; description: string; speaker: string; speakerTitle: string; room: string;
  kind: "keynote" | "booth" | "panel" | "break"; startAt: string; endAt: string; image: string; alwaysOpen: boolean;
  status: "upcoming" | "live" | "paused" | "ended"; liveStartedAt: string | null; liveEndedAt: string | null; lastSeq: number; order: number;
  open: boolean; deckPages: number;
}
export interface SessionsResponse { event: { name: string; date: string; venue: string }; now: string; sessions: Session[] }

export function useMe() {
  const [me, setMe] = useState<Attendee | null | undefined>(undefined);
  const refresh = useCallback(async () => { try { const r = await api<{ attendee: Attendee | null }>("/api/auth/me"); setMe(r.attendee); } catch { setMe(null); } }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { me, refresh, setMe };
}

export function useSessions(pollMs = 10000) {
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => { try { setData(await api<SessionsResponse>("/api/sessions")); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "failed"); } }, []);
  useEffect(() => {
    refresh();
    if (!pollMs) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, pollMs);
    const vis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [refresh, pollMs]);
  return { data, error, refresh };
}

export interface Segment { seq: number; text: string; offsetMs: number }
export interface LiveState { status: Session["status"]; nowOffsetMs: number; lastSeq: number; liveStartedAt?: string | null }

/** Live transcript feed: SSE with automatic reconnect, falling back to polling. */
export function useLiveTranscript(sessionId: string | null) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [interim, setInterim] = useState("");
  const [state, setState] = useState<LiveState | null>(null);
  const [connected, setConnected] = useState(false);
  const afterRef = useRef(0);
  const failures = useRef(0);

  useEffect(() => {
    if (!sessionId) return;
    let es: EventSource | null = null, poll: ReturnType<typeof setInterval> | null = null, stopped = false;
    afterRef.current = 0; setSegments([]); setInterim(""); setState(null);
    const addSegs = (segs: Segment[]) => {
      if (!segs.length) return;
      setSegments((prev) => { const have = new Set(prev.map((s) => s.seq)); const next = [...prev, ...segs.filter((s) => !have.has(s.seq))]; next.sort((a, b) => a.seq - b.seq); return next; });
      afterRef.current = Math.max(afterRef.current, ...segs.map((s) => s.seq));
    };
    const load = async () => {
      try {
        const r = await api<{ status: Session["status"]; lastSeq: number; nowOffsetMs: number; interim: string; segments: Segment[] }>(`/api/sessions/${sessionId}/segments?after=${afterRef.current}`);
        addSegs(r.segments); setInterim(r.interim); setState({ status: r.status, lastSeq: r.lastSeq, nowOffsetMs: r.nowOffsetMs });
      } catch { /* ignore */ }
    };
    const startPolling = () => { if (poll) return; poll = setInterval(load, 1500); };
    const connect = () => {
      if (stopped) return;
      es = new EventSource(`/api/sessions/${sessionId}/stream?after=${afterRef.current}`);
      es.onopen = () => { setConnected(true); failures.current = 0; if (poll) { clearInterval(poll); poll = null; } };
      es.addEventListener("segment", (e) => { addSegs([JSON.parse((e as MessageEvent).data)]); setInterim(""); });
      es.addEventListener("interim", (e) => setInterim(JSON.parse((e as MessageEvent).data).text || ""));
      es.addEventListener("state", (e) => setState(JSON.parse((e as MessageEvent).data)));
      es.addEventListener("reconnect", () => { es?.close(); setTimeout(connect, 200); });
      es.onerror = () => { setConnected(false); es?.close(); failures.current += 1; if (failures.current >= 2) startPolling(); setTimeout(connect, Math.min(8000, 1000 * failures.current)); };
    };
    load().then(connect);
    return () => { stopped = true; es?.close(); if (poll) clearInterval(poll); };
  }, [sessionId]);
  return { segments, interim, state, connected };
}

/** Heartbeat so "My day" knows which talk the attendee is in. */
export function usePresence(sessionId: string | null, active: boolean) {
  useEffect(() => {
    if (!sessionId || !active) return;
    const beat = () => { if (document.visibilityState === "visible") api("/api/presence", { method: "POST", json: { sessionId } }).catch(() => {}); };
    beat();
    const t = setInterval(beat, 20000);
    return () => clearInterval(t);
  }, [sessionId, active]);
}

export function fmtOffset(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
export function timeHM(d: string | Date) { return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }); }
export function appUrl() { return (process.env.NEXT_PUBLIC_APP_URL || (typeof location !== "undefined" ? location.origin : "")).replace(/\/$/, ""); }
