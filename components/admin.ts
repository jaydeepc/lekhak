"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export interface AdminSession {
  id: string; slug: string; title: string; tagline: string; description: string; speaker: string; speakerTitle: string; room: string;
  kind: "keynote" | "booth" | "panel" | "break"; startAt: string; endAt: string; image: string; alwaysOpen: boolean; code: string;
  status: "upcoming" | "live" | "paused" | "ended"; liveStartedAt: string | null; liveEndedAt: string | null; lastSeq: number; order: number;
  liveInterim: string; segments: number;
  documents: { id: string; name: string; status: "uploading" | "uploaded" | "processing" | "ready" | "error"; pages: number; chunkCount: number; size: number; error: string; createdAt: string }[];
}
export interface AdminAttendee { id: string; name: string; email: string; firm: string; role: string; passToken: string; createdAt: string; lastSeenAt: string | null; signedInAt: string | null; questions: number; unlocked: number }

export function useAdminMe() {
  const [admin, setAdmin] = useState<{ username: string } | null | undefined>(undefined);
  useEffect(() => { api<{ admin: { username: string } | null }>("/api/admin/login").then((r) => setAdmin(r.admin)).catch(() => setAdmin(null)); }, []);
  return admin;
}

export function useAdminSessions(pollMs = 0) {
  const [sessions, setSessions] = useState<AdminSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => { try { const r = await api<{ sessions: AdminSession[] }>("/api/admin/sessions"); setSessions(r.sessions); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "failed"); } }, []);
  useEffect(() => { refresh(); if (!pollMs) return; const t = setInterval(refresh, pollMs); return () => clearInterval(t); }, [refresh, pollMs]);
  return { sessions, error, refresh, setSessions };
}

export const IMAGES = [
  ["/assets/il-keynote.jpg", "Keynote"], ["/assets/il-converge.jpg", "Converge"], ["/assets/il-rings.jpg", "Rings"], ["/assets/il-expressway.jpg", "Expressway"],
  ["/assets/il-map.jpg", "Map"], ["/assets/il-unlock.jpg", "Unlock"], ["/assets/il-frame.jpg", "Frame"], ["/assets/hero.jpg", "Hero"],
];

export function toLocalInput(d: string | Date) {
  // yyyy-MM-ddTHH:mm in IST for <input type=datetime-local>
  const s = new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata", hour12: false });
  return s.slice(0, 16).replace(" ", "T");
}
export function fromLocalInput(v: string) { return new Date(`${v}:00+05:30`).toISOString(); }
export function usd(n: number) { return `$${n.toFixed(n < 1 ? 4 : 2)}`; }
export function inr(n: number, rate: number) { return `₹${(n * rate).toLocaleString("en-IN", { maximumFractionDigits: n * rate < 100 ? 2 : 0 })}`; }
export function bytes(n: number) { return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`; }

/** Chunked upload (≤3 MB parts) then finalize/process. Reports progress 0..1. */
export async function uploadDocument(sessionId: string, file: File, onProgress: (p: number, stage: string) => void) {
  const init = await api<{ id: string; partSize: number }>("/api/admin/documents", { method: "POST", json: { sessionId, name: file.name, mimeType: file.type, size: file.size } });
  const parts = Math.max(1, Math.ceil(file.size / init.partSize));
  for (let i = 0; i < parts; i++) {
    const blob = file.slice(i * init.partSize, (i + 1) * init.partSize);
    const r = await fetch(`/api/admin/documents/${init.id}/part?part=${i}`, { method: "PUT", body: blob, headers: { "content-type": "application/octet-stream" } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || `Upload failed at part ${i + 1}`);
    onProgress(((i + 1) / parts) * 0.6, `Uploading ${i + 1}/${parts}`);
  }
  onProgress(0.65, "Reading every slide with Gemini…");
  const fin = await api<{ pages: number }>(`/api/admin/documents/${init.id}/finalize`, { method: "POST", json: { parts } });
  onProgress(1, `${fin.pages} slides indexed`);
  return fin;
}
