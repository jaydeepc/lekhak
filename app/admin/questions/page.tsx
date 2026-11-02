"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { Md } from "@/components/ui";

interface Q { id: string; attendee: string; firm: string; question: string; answer: string; sources: number; at: string }

export default function QuestionsPage() {
  const [qs, setQs] = useState<Q[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { const load = () => api<{ questions: Q[] }>("/api/admin/questions").then((r) => setQs(r.questions)).catch(() => {}); load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);
  return (
    <>
      <div className="adm-head"><div><h1>Questions</h1><div className="sub">What investors are asking Lekhak, live. A good read on what the room cares about.</div></div></div>
      <div className="adm-card">
        {!qs && <div className="skel" style={{ height: 80 }} />}
        {qs && !qs.length && <p className="lead" style={{ fontSize: 14 }}>No questions yet.</p>}
        {qs?.map((q) => (
          <div key={q.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line)", cursor: "pointer" }} onClick={() => setOpen(open === q.id ? null : q.id)}>
            <div className="row between" style={{ gap: 12 }}><div><b style={{ fontSize: 15 }}>{q.question}</b><div className="small" style={{ marginTop: 3 }}>{q.attendee}{q.firm ? ` · ${q.firm}` : ""} · {new Date(q.at).toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" })}{q.sources ? ` · ${q.sources} source${q.sources > 1 ? "s" : ""}` : ""}</div></div><span className="small" style={{ fontWeight: 800 }}>{open === q.id ? "Hide" : "Answer"}</span></div>
            {open === q.id && <div style={{ marginTop: 10, background: "var(--surface)", borderRadius: 8, padding: "12px 14px" }}>{q.answer ? <Md text={q.answer} className="answer" /> : <span className="small">No answer recorded.</span>}</div>}
          </div>
        ))}
      </div>
    </>
  );
}
