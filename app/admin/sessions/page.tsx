"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { api, timeHM } from "@/components/api";
import { IMAGES, bytes, fromLocalInput, toLocalInput, uploadDocument, useAdminSessions, type AdminSession } from "@/components/admin";
import { useToast } from "@/components/ui";
import { Radio, Trash, Upload } from "@/components/icons";

type Form = { title: string; tagline: string; description: string; speaker: string; speakerTitle: string; room: string; kind: AdminSession["kind"]; startAt: string; endAt: string; image: string; code: string; alwaysOpen: boolean; order: number };
const blank = (): Form => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); const e = new Date(d.getTime() + 45 * 60000); return { title: "", tagline: "", description: "", speaker: "", speakerTitle: "", room: "", kind: "booth", startAt: toLocalInput(d), endAt: toLocalInput(e), image: IMAGES[0][0], code: "", alwaysOpen: false, order: 0 }; };

export default function SessionsPage() {
  const { sessions, refresh } = useAdminSessions(6000);
  const toast = useToast();
  const [editing, setEditing] = useState<{ id: string | null; f: Form } | null>(null);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<Record<string, { p: number; stage: string }>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const openNew = () => setEditing({ id: null, f: blank() });
  const openEdit = (s: AdminSession) => setEditing({ id: s.id, f: { title: s.title, tagline: s.tagline, description: s.description, speaker: s.speaker, speakerTitle: s.speakerTitle, room: s.room, kind: s.kind, startAt: toLocalInput(s.startAt), endAt: toLocalInput(s.endAt), image: s.image, code: s.code, alwaysOpen: s.alwaysOpen, order: s.order } });
  const save = async () => {
    if (!editing) return; setBusy(true);
    try {
      const payload = { ...editing.f, startAt: fromLocalInput(editing.f.startAt), endAt: fromLocalInput(editing.f.endAt) };
      if (editing.id) await api(`/api/admin/sessions/${editing.id}`, { method: "PUT", json: payload }); else await api("/api/admin/sessions", { method: "POST", json: payload });
      toast(editing.id ? "Session updated" : "Session added"); setEditing(null); refresh();
    } catch (e) { toast(e instanceof Error ? e.message : "Could not save"); } finally { setBusy(false); }
  };
  const remove = async (s: AdminSession) => { if (!confirm(`Delete "${s.title}" and its transcript, decks and unlocks?`)) return; await api(`/api/admin/sessions/${s.id}`, { method: "DELETE" }); toast("Deleted"); refresh(); };
  const upload = async (s: AdminSession, files: FileList | null) => {
    if (!files?.length) return;
    for (const f of Array.from(files)) {
      const key = `${s.id}:${f.name}`;
      setProg((p) => ({ ...p, [key]: { p: 0, stage: "Starting…" } }));
      try { await uploadDocument(s.id, f, (p, stage) => setProg((x) => ({ ...x, [key]: { p, stage } }))); toast(`${f.name} indexed`); }
      catch (e) { toast(e instanceof Error ? e.message : "Upload failed"); }
      finally { setTimeout(() => setProg((x) => { const n = { ...x }; delete n[key]; return n; }), 1500); refresh(); }
    }
  };
  const removeDoc = async (id: string, name: string) => { if (!confirm(`Remove ${name}?`)) return; await api(`/api/admin/documents/${id}`, { method: "DELETE" }); refresh(); };
  const f = editing?.f;
  const set = (k: keyof Form, v: unknown) => setEditing((e) => e && { ...e, f: { ...e.f, [k]: v } });

  return (
    <>
      <div className="adm-head"><div><h1>Agenda &amp; decks</h1><div className="sub">Every talk on the day. Upload the speaker&apos;s deck so Lekhak can quote the slides; press Go live when they walk on stage.</div></div><div className="btn-row"><button className="btn inline" onClick={openNew}>+ Add session</button></div></div>
      {!sessions && <div className="skel" style={{ height: 120 }} />}
      {sessions && !sessions.length && <div className="adm-card"><p className="lead" style={{ fontSize: 14 }}>No sessions yet. Add one, or load the demo agenda from <Link href="/admin/settings">Settings</Link>.</p></div>}
      <div className="col" style={{ gap: 14 }}>
        {sessions?.map((s) => (
          <div key={s.id} className="sess-card">
            <div className="img" style={{ backgroundImage: `url('${s.image}')` }} />
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}><h4>{s.title}</h4><span className={`status ${s.status}`}>{s.status === "live" && <span className="dot live-dot" />}{s.status}</span>{s.alwaysOpen && <span className="status upcoming">open to all</span>}</div>
              <div className="meta">{timeHM(s.startAt)}–{timeHM(s.endAt)} · {s.room}{s.speaker ? ` · ${s.speaker}${s.speakerTitle ? `, ${s.speakerTitle}` : ""}` : ""} · code <span className="mono">{s.code}</span> · {s.segments} transcript moments</div>
              {s.tagline && <div className="small" style={{ marginTop: 6, fontSize: 13 }}>{s.tagline}</div>}
              <div className="docs">
                {s.documents.map((d) => <div key={d.id} className="doc-row"><span className={`status ${d.status}`}>{d.status}</span><b title={d.name}>{d.name}</b><span className="small">{d.pages ? `${d.pages} slides · ` : ""}{bytes(d.size)}</span>{d.error && <span className="small" style={{ color: "var(--red)" }}>{d.error}</span>}<button className="icon-btn" style={{ width: 32, height: 32, background: "none" }} onClick={() => removeDoc(d.id, d.name)} aria-label="Remove"><Trash size={16} /></button></div>)}
                {Object.entries(prog).filter(([k]) => k.startsWith(`${s.id}:`)).map(([k, v]) => <div key={k} className="doc-row"><span className="status processing">{Math.round(v.p * 100)}%</span><b>{k.split(":").slice(1).join(":")}</b><span className="small">{v.stage}</span></div>)}
                <div className="drop" onClick={() => fileInputs.current[s.id]?.click()} onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("over"); }} onDragLeave={(e) => e.currentTarget.classList.remove("over")} onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("over"); upload(s, e.dataTransfer.files); }}>
                  <Upload size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Drop the deck here (PDF best, PPTX ok, up to 60 MB) or click to choose
                  <input ref={(el) => { fileInputs.current[s.id] = el; }} type="file" accept=".pdf,.pptx,.txt,.md,application/pdf" multiple hidden onChange={(e) => { upload(s, e.target.files); e.target.value = ""; }} />
                </div>
              </div>
            </div>
            <div className="col" style={{ gap: 8, minWidth: 150 }}>
              <Link className="btn inline" href={`/admin/live/${s.id}`} style={{ justifyContent: "center" }}><Radio size={16} />{s.status === "live" ? "Open recorder" : s.status === "paused" ? "Resume" : "Go live"}</Link>
              <button className="btn inline ghost" onClick={() => openEdit(s)}>Edit</button>
              <Link className="btn inline ghost" href={`/slide/${s.id}`} target="_blank">Last-slide QR ↗</Link>
              <button className="btn inline danger" onClick={() => remove(s)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {editing && f && (
        <div className="modal-bg" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing.id ? "Edit session" : "Add a session"}</h2>
            <div className="form-grid">
              <div className="field span-all"><label>Title *</label><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Keynote: AI at Piramal Finance" /></div>
              <div className="field span-all"><label>Tagline</label><input className="input" value={f.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="One line attendees see on the card" /></div>
              <div className="field"><label>Speaker</label><input className="input" value={f.speaker} onChange={(e) => set("speaker", e.target.value)} placeholder="Jairam Sridharan" /></div>
              <div className="field"><label>Speaker title</label><input className="input" value={f.speakerTitle} onChange={(e) => set("speakerTitle", e.target.value)} placeholder="MD & CEO" /></div>
              <div className="field"><label>Room *</label><input className="input" value={f.room} onChange={(e) => set("room", e.target.value)} placeholder="Main hall / Booth A" /></div>
              <div className="field"><label>Type</label><select className="input" value={f.kind} onChange={(e) => set("kind", e.target.value)}><option value="keynote">Keynote</option><option value="booth">Booth</option><option value="panel">Panel</option><option value="break">Break</option></select></div>
              <div className="field"><label>Starts (IST) *</label><input className="input" type="datetime-local" value={f.startAt} onChange={(e) => set("startAt", e.target.value)} /></div>
              <div className="field"><label>Ends (IST) *</label><input className="input" type="datetime-local" value={f.endAt} onChange={(e) => set("endAt", e.target.value)} /></div>
              <div className="field"><label>Room code (printed on the last slide)</label><input className="input" value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="auto" maxLength={8} /></div>
              <div className="field"><label>Order</label><input className="input" type="number" value={f.order} onChange={(e) => set("order", Number(e.target.value))} /></div>
              <div className="field span-all"><label>Description</label><textarea className="input" value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
              <div className="field span-all"><label>Card image</label><div className="row" style={{ gap: 8, flexWrap: "wrap" }}>{IMAGES.map(([src, name]) => <button key={src} type="button" onClick={() => set("image", src)} title={name} style={{ width: 64, height: 48, borderRadius: 6, border: f.image === src ? "3px solid var(--orange)" : "1px solid var(--line)", background: `url('${src}') center/cover`, cursor: "pointer" }} />)}<input className="input" style={{ flex: 1, minWidth: 200 }} value={f.image} onChange={(e) => set("image", e.target.value)} placeholder="or paste an image URL" /></div></div>
              <label className="row" style={{ gap: 10, fontWeight: 700, fontSize: 14 }}><input type="checkbox" checked={f.alwaysOpen} onChange={(e) => set("alwaysOpen", e.target.checked)} />Open to every attendee without scanning (keynote, plenary)</label>
            </div>
            <div className="btn-row" style={{ justifyContent: "flex-end" }}><button className="btn inline ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn inline" disabled={busy} onClick={save}>{editing.id ? "Save changes" : "Add session"}</button></div>
          </div>
        </div>
      )}
    </>
  );
}
