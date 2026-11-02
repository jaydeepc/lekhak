"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { inr, usd } from "@/components/admin";
import { useToast } from "@/components/ui";

interface Costs {
  pricing: { chatInputPerM: number; chatOutputPerM: number; embedPerM: number; liveAudioPerMin: number; liveTextPerMin: number; inrPerUsd: number };
  total: { cost: number; calls: number }; last24h: { cost: number; calls: number };
  byKind: { kind: string; model: string; cost: number; calls: number; promptTokens: number; outputTokens: number; audioSeconds: number }[];
  byHour: { hour: string; cost: number; calls: number }[];
  topAttendees: { name: string; cost: number; calls: number }[];
  recent: { kind: string; model: string; cost: number; promptTokens: number; outputTokens: number; audioSeconds: number; at: string }[];
}
const LABEL: Record<string, string> = { chat: "Ask Lekhak (chat)", live: "Live transcription", extract: "Deck reading", embed: "Deck search (embeddings)", summary: "My day notes", other: "Other" };

export default function CostsPage() {
  const [c, setC] = useState<Costs | null>(null);
  const [p, setP] = useState<Costs["pricing"] | null>(null);
  const toast = useToast();
  const load = () => api<Costs>("/api/admin/costs").then((r) => { setC(r); setP((prev) => prev || r.pricing); }).catch((e) => toast(e.message));
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const save = async () => { if (!p) return; try { const r = await api<{ pricing: Costs["pricing"] }>("/api/admin/costs", { method: "PUT", json: p }); setP(r.pricing); toast("Prices saved — future calls use them"); load(); } catch (e) { toast(e instanceof Error ? e.message : "Failed"); } };
  const rate = c?.pricing.inrPerUsd || 84;
  const maxHour = Math.max(0.0001, ...(c?.byHour.map((h) => h.cost) || [0]));
  const liveMin = (c?.byKind.find((k) => k.kind === "live")?.audioSeconds || 0) / 60;
  return (
    <>
      <div className="adm-head"><div><h1>Costs</h1><div className="sub">What Gemini is costing right now, computed from every call&apos;s token usage and live-audio minutes.</div></div></div>
      <div className="kpis">
        <div className="kpi"><span>Total so far</span><b>{c ? usd(c.total.cost) : "–"}</b><small>{c ? `${inr(c.total.cost, rate)} · ${c.total.calls} calls` : ""}</small></div>
        <div className="kpi navy"><span>Last 24 hours</span><b>{c ? usd(c.last24h.cost) : "–"}</b><small>{c ? `${inr(c.last24h.cost, rate)} · ${c.last24h.calls} calls` : ""}</small></div>
        <div className="kpi green"><span>Live audio transcribed</span><b>{c ? `${Math.round(liveMin)} min` : "–"}</b><small>{c ? usd(c.byKind.find((k) => k.kind === "live")?.cost || 0) : ""}</small></div>
        <div className="kpi"><span>Per question (avg)</span><b>{c && c.byKind.find((k) => k.kind === "chat")?.calls ? usd((c.byKind.find((k) => k.kind === "chat")!.cost) / c.byKind.find((k) => k.kind === "chat")!.calls) : "–"}</b><small>Ask Lekhak, including context</small></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, marginBottom: 18 }}>
        <div className="adm-card"><h3>Spend per hour (last 24h, IST)</h3>
          {c && !c.byHour.length && <p className="small">No usage yet.</p>}
          <div className="bars">{c?.byHour.map((h) => <div key={h.hour} className="bar" title={`${usd(h.cost)} · ${h.calls} calls`}><i style={{ height: `${Math.max(2, (h.cost / maxHour) * 110)}px` }} /><span>{h.hour.slice(11)}</span></div>)}</div>
        </div>
        <div className="adm-card"><h3>Top attendees</h3><table className="tbl"><tbody>{c?.topAttendees.map((t) => <tr key={t.name}><td>{t.name}</td><td className="num">{t.calls}</td><td className="num">{usd(t.cost)}</td></tr>)}{c && !c.topAttendees.length && <tr><td className="small">Nobody has asked yet.</td></tr>}</tbody></table></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="adm-card"><h3>By feature</h3>
          <table className="tbl"><thead><tr><th>Feature</th><th>Model</th><th className="num">Calls</th><th className="num">Tokens in / out</th><th className="num">Cost</th></tr></thead>
            <tbody>{c?.byKind.map((k) => <tr key={k.kind + k.model}><td><b>{LABEL[k.kind] || k.kind}</b></td><td className="mono">{k.model}</td><td className="num">{k.calls}</td><td className="num">{k.kind === "live" ? `${Math.round(k.audioSeconds / 60)} min audio` : `${k.promptTokens.toLocaleString()} / ${k.outputTokens.toLocaleString()}`}</td><td className="num"><b>{usd(k.cost)}</b></td></tr>)}</tbody></table>
        </div>
        <div className="adm-card"><h3>Price list (USD, editable)</h3>
          {p && <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="field"><label>Chat input / 1M tokens</label><input className="input" type="number" step="0.01" value={p.chatInputPerM} onChange={(e) => setP({ ...p, chatInputPerM: +e.target.value })} /></div>
            <div className="field"><label>Chat output / 1M tokens</label><input className="input" type="number" step="0.01" value={p.chatOutputPerM} onChange={(e) => setP({ ...p, chatOutputPerM: +e.target.value })} /></div>
            <div className="field"><label>Live audio / minute</label><input className="input" type="number" step="0.001" value={p.liveAudioPerMin} onChange={(e) => setP({ ...p, liveAudioPerMin: +e.target.value })} /></div>
            <div className="field"><label>Live text out / minute</label><input className="input" type="number" step="0.001" value={p.liveTextPerMin} onChange={(e) => setP({ ...p, liveTextPerMin: +e.target.value })} /></div>
            <div className="field"><label>Embeddings / 1M tokens</label><input className="input" type="number" step="0.01" value={p.embedPerM} onChange={(e) => setP({ ...p, embedPerM: +e.target.value })} /></div>
            <div className="field"><label>₹ per $</label><input className="input" type="number" step="0.1" value={p.inrPerUsd} onChange={(e) => setP({ ...p, inrPerUsd: +e.target.value })} /></div>
            <div className="span-all btn-row"><button className="btn inline" onClick={save}>Save prices</button><span className="small">Defaults are Gemini API list prices (Nov 2026). Thinking tokens count as output.</span></div>
          </div>}
        </div>
      </div>
      <div className="adm-card" style={{ marginTop: 18 }}><h3>Recent calls</h3>
        <table className="tbl"><thead><tr><th>When</th><th>Feature</th><th>Model</th><th className="num">In</th><th className="num">Out</th><th className="num">Audio</th><th className="num">Cost</th></tr></thead>
          <tbody>{c?.recent.map((r, i) => <tr key={i}><td className="mono">{new Date(r.at).toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" })}</td><td>{LABEL[r.kind] || r.kind}</td><td className="mono">{r.model}</td><td className="num">{r.promptTokens}</td><td className="num">{r.outputTokens}</td><td className="num">{r.audioSeconds ? `${Math.round(r.audioSeconds)}s` : ""}</td><td className="num">{usd(r.cost)}</td></tr>)}</tbody></table>
      </div>
    </>
  );
}
