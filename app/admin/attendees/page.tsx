"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, appUrl, timeHM } from "@/components/api";
import type { AdminAttendee } from "@/components/admin";
import { QR, useToast } from "@/components/ui";
import { Printer, Trash } from "@/components/icons";

export default function AttendeesPage() {
  const [list, setList] = useState<AdminAttendee[] | null>(null);
  const [f, setF] = useState({ name: "", email: "", firm: "", role: "" });
  const [q, setQ] = useState("");
  const [show, setShow] = useState<AdminAttendee | null>(null);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const load = () => api<{ attendees: AdminAttendee[] }>("/api/admin/attendees").then((r) => setList(r.attendees)).catch((e) => toast(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const add = async (e: React.FormEvent) => { e.preventDefault(); try { await api("/api/admin/attendees", { method: "POST", json: f }); setF({ name: "", email: "", firm: "", role: "" }); toast("Added — their pass QR is ready"); load(); } catch (x) { toast(x instanceof Error ? x.message : "Failed"); } };
  const importCsv = async (file: File) => {
    const text = await file.text();
    const rows = text.split(/\r?\n/).map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))).filter((r) => r.length >= 2 && r[1]);
    const head = rows[0].map((h) => h.toLowerCase());
    const idx = (k: string, fallback: number) => { const i = head.indexOf(k); return i >= 0 ? i : fallback; };
    const hasHeader = head.includes("email") || head.includes("name");
    const body = (hasHeader ? rows.slice(1) : rows).map((r) => ({ name: r[idx("name", 0)], email: r[idx("email", 1)], firm: r[idx("firm", 2)] || "", role: r[idx("role", 3)] || "" }));
    try { const res = await api<{ created: unknown[]; skipped: string[] }>("/api/admin/attendees", { method: "POST", json: { attendees: body } }); toast(`${res.created.length} added${res.skipped.length ? `, ${res.skipped.length} skipped (duplicates/invalid)` : ""}`); load(); } catch (x) { toast(x instanceof Error ? x.message : "Import failed"); }
  };
  const remove = async (a: AdminAttendee) => { if (!confirm(`Remove ${a.name}?`)) return; await api(`/api/admin/attendees/${a.id}`, { method: "DELETE" }); load(); };
  const regen = async (a: AdminAttendee) => { if (!confirm("Issue a new pass QR? The old one stops working.")) return; await api(`/api/admin/attendees/${a.id}`, { method: "PUT", json: { regenerateToken: true } }); toast("New pass issued"); load(); setShow(null); };
  const filtered = (list || []).filter((a) => !q || `${a.name} ${a.email} ${a.firm}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="adm-head"><div><h1>Attendees &amp; passes</h1><div className="sub">Everyone invited. Each gets a QR that signs them straight in — print it on their pass.</div></div>
        <div className="btn-row"><button className="btn inline ghost" onClick={() => fileRef.current?.click()}>Import CSV</button><input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { if (e.target.files?.[0]) importCsv(e.target.files[0]); e.target.value = ""; }} /><Link className="btn inline" href="/admin/passes"><Printer size={16} />Print all passes</Link></div></div>
      <div className="adm-card" style={{ marginBottom: 18 }}>
        <h3>Add an attendee</h3>
        <form className="form-grid" onSubmit={add}>
          <div className="field"><label>Full name *</label><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label>Email *</label><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="field"><label>Firm</label><input className="input" value={f.firm} onChange={(e) => setF({ ...f, firm: e.target.value })} /></div>
          <div className="field"><label>Role</label><input className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></div>
          <div className="field" style={{ justifyContent: "flex-end" }}><button className="btn inline">Add &amp; create pass</button></div>
        </form>
        <p className="small" style={{ marginTop: 10 }}>CSV columns: name, email, firm, role (header row optional).</p>
      </div>
      <div className="adm-card">
        <div className="row between" style={{ marginBottom: 12, gap: 12 }}><h3 style={{ margin: 0 }}>{list ? `${list.length} invited` : "Loading…"}</h3><input className="input" style={{ maxWidth: 280 }} placeholder="Search name, email, firm" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <table className="tbl"><thead><tr><th>Name</th><th>Firm</th><th>Email</th><th>Signed in</th><th className="num">Asked</th><th className="num">Unlocked</th><th></th></tr></thead>
          <tbody>{filtered.map((a) => <tr key={a.id}><td><b>{a.name}</b><div className="small">{a.role}</div></td><td>{a.firm}</td><td className="mono">{a.email}</td><td>{a.signedInAt ? <span className="status ready">{timeHM(a.signedInAt)}</span> : <span className="status upcoming">not yet</span>}</td><td className="num">{a.questions}</td><td className="num">{a.unlocked}</td><td style={{ textAlign: "right", whiteSpace: "nowrap" }}><button className="btn inline ghost" onClick={() => setShow(a)}>Pass QR</button> <button className="icon-btn" style={{ width: 36, height: 36, background: "none", display: "inline-flex" }} onClick={() => remove(a)} aria-label="Remove"><Trash size={16} /></button></td></tr>)}</tbody></table>
      </div>
      {show && (
        <div className="modal-bg" onClick={() => setShow(null)}><div className="modal" style={{ maxWidth: 440, alignItems: "center", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
          <h2>{show.name}</h2><div className="small">{show.firm}{show.role ? ` · ${show.role}` : ""}</div>
          <div style={{ width: 260 }}><QR text={`${appUrl()}/pass/${show.passToken}`} /></div>
          <div className="mono small" style={{ wordBreak: "break-all" }}>{appUrl()}/pass/{show.passToken}</div>
          <div className="btn-row" style={{ justifyContent: "center" }}><Link className="btn inline" href={`/admin/passes?only=${show.id}`}>Print this pass</Link><button className="btn inline ghost" onClick={() => regen(show)}>Issue new QR</button></div>
        </div></div>
      )}
    </>
  );
}
