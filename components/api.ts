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
  open: boolean; deckPages: number; deckVersion: number; updatedAt: string;
}
export interface SessionsResponse { event: { name: string; date: string; venue: string }; now: string; sessions: Session[] }

export function useMe() {
  const [me, setMe] = useState<Attendee | null | undefined>(undefined);
  const refresh = useCallback(async () => { try { const r = await api<{ attendee: Attendee | null }>("/api/auth/me"); setMe(r.attendee); } catch { setMe(null); } }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { me, refresh, setMe };
}

type AgendaResponse = { event: SessionsResponse["event"]; now: string; sessions: Omit<Session, "open">[] };

// Shared across components on a page so N hooks don't mean N timers.
let agendaCache: { data: AgendaResponse | null; at: number } = { data: null, at: 0 };
let accessCache: { ids: Set<string> | null; at: number } = { ids: null, at: 0 };
const listeners = new Set<() => void>();
let agendaInflight: Promise<void> | null = null;
let accessInflight: Promise<void> | null = null;
async function loadAgenda() {
  if (agendaInflight) return agendaInflight;
  agendaInflight = api<AgendaResponse>("/api/agenda").then((d) => { agendaCache = { data: d, at: Date.now() }; }).finally(() => { agendaInflight = null; listeners.forEach((l) => l()); });
  return agendaInflight;
}
async function loadAccess() {
  if (accessInflight) return accessInflight;
  accessInflight = api<{ sessionIds: string[] }>("/api/me/access").then((d) => { accessCache = { ids: new Set(d.sessionIds), at: Date.now() }; }).catch(() => { accessCache = { ids: new Set(), at: Date.now() }; }).finally(() => { accessInflight = null; listeners.forEach((l) => l()); });
  return accessInflight;
}
/** Call after an unlock or sign-in so the agenda reflects the new access immediately. */
export function invalidateAccess() { accessCache = { ids: null, at: 0 }; void loadAccess(); }

export function useSessions(pollMs = 5000) {
  const [, force] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { await Promise.all([loadAgenda(), Date.now() - accessCache.at > 60_000 ? loadAccess() : Promise.resolve()]); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "failed"); }
  }, []);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    if (Date.now() - agendaCache.at > 2000) refresh(); else if (!accessCache.ids) void loadAccess();
    let t: ReturnType<typeof setInterval> | null = null;
    if (pollMs) t = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, pollMs);
    const vis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", vis); window.addEventListener("focus", vis);
    return () => { listeners.delete(l); if (t) clearInterval(t); document.removeEventListener("visibilitychange", vis); window.removeEventListener("focus", vis); };
  }, [refresh, pollMs]);
  const a = agendaCache.data;
  const ids = accessCache.ids;
  const data: SessionsResponse | null = a ? { event: a.event, now: a.now, sessions: a.sessions.map((s) => ({ ...s, open: s.alwaysOpen || Boolean(ids?.has(s.id)) })) } : null;
  return { data, error, refresh };
}

export interface Segment { seq: number; text: string; offsetMs: number }
export interface LiveState { status: Session["status"]; nowOffsetMs: number; lastSeq: number; liveStartedAt?: string | null }

/** Live transcript feed: polls the CDN-cached feed about once a second while live, slower otherwise. */
export function useLiveTranscript(sessionId: string | null) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [interim, setInterim] = useState("");
  const [state, setState] = useState<LiveState | null>(null);
  const [connected, setConnected] = useState(false);
  const afterRef = useRef(0);
  const statusRef = useRef<string>("upcoming");

  useEffect(() => {
    if (!sessionId) return;
    let stopped = false, timer: ReturnType<typeof setTimeout> | null = null, failures = 0;
    afterRef.current = 0; setSegments([]); setInterim(""); setState(null);
    const tick = async () => {
      if (stopped) return;
      let delay = statusRef.current === "live" ? 1000 : 4000;
      if (document.visibilityState !== "visible") delay = 5000;
      else {
        try {
          const r = await api<{ status: Session["status"]; lastSeq: number; nowOffsetMs: number; interim: string; segments: Segment[] }>(`/api/sessions/${sessionId}/feed?after=${afterRef.current}`);
          if (stopped) return;
          if (r.segments.length) {
            setSegments((prev) => { const have = new Set(prev.map((s) => s.seq)); const next = [...prev, ...r.segments.filter((s) => !have.has(s.seq))]; next.sort((a, b) => a.seq - b.seq); return next; });
            afterRef.current = Math.max(afterRef.current, ...r.segments.map((s) => s.seq));
          }
          setInterim(r.segments.length ? "" : r.interim);
          setState({ status: r.status, lastSeq: r.lastSeq, nowOffsetMs: r.nowOffsetMs });
          statusRef.current = r.status; setConnected(true); failures = 0;
          if (r.lastSeq > afterRef.current) delay = 150; // catch up quickly
        } catch { failures += 1; setConnected(false); delay = Math.min(8000, 1000 * failures); }
      }
      timer = setTimeout(tick, delay);
    };
    tick();
    const vis = () => { if (document.visibilityState === "visible") { if (timer) clearTimeout(timer); tick(); } };
    document.addEventListener("visibilitychange", vis);
    return () => { stopped = true; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", vis); };
  }, [sessionId]);
  return { segments, interim, state, connected };
}

/** Heartbeat so "My day" knows which talk the attendee is in. */
export function usePresence(sessionId: string | null, active: boolean) {
  useEffect(() => {
    if (!sessionId || !active) return;
    const beat = () => { if (document.visibilityState === "visible") api("/api/presence", { method: "POST", json: { sessionId } }).catch(() => {}); };
    beat();
    const t = setInterval(beat, 45000);
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
