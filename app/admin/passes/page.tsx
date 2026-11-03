"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, appUrl } from "@/components/api";
import type { AdminAttendee } from "@/components/admin";
import { QR } from "@/components/ui";
import { Logo } from "@/components/icons";

function PassesInner() {
  const only = useSearchParams().get("only");
  const [list, setList] = useState<AdminAttendee[]>([]);
  const [ev, setEv] = useState<{ name: string; date: string; venue: string } | null>(null);
  useEffect(() => { api<{ attendees: AdminAttendee[] }>("/api/admin/attendees").then((r) => setList(only ? r.attendees.filter((a) => a.id === only) : r.attendees)); api<{ event: { name: string; date: string; venue: string } }>("/api/admin/event").then((r) => setEv(r.event)); }, [only]);
  return (
    <>
      <div className="adm-head no-print"><div><h1>Passes</h1><div className="sub">{list.length} pass{list.length === 1 ? "" : "es"}. Scanning the QR opens Lekhak already signed in.</div></div><div className="btn-row"><button className="btn inline" onClick={() => window.print()}>Print</button></div></div>
      <div className="passes">
        {list.map((a) => (
          <div key={a.id} className="pass">
            <div className="ph"><div><div className="ev">{ev?.name || "Investor Day"}</div><div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,.8)" }}>{ev?.date}{ev?.venue ? ` · ${ev.venue}` : ""}</div></div><Logo h={22} /></div>
            <div className="pb"><div><b>{a.name}</b><div className="firm">{a.firm}</div><div className="role">{a.role}</div></div><QR text={`${appUrl()}/pass/${a.passToken}`} size={256} /></div>
            <div className="pf"><span>Scan to open Lekhak</span><span>{appUrl().replace(/^https?:\/\//, "")}</span></div>
          </div>
        ))}
      </div>
    </>
  );
}
export default function PassesPage() { return <Suspense fallback={null}><PassesInner /></Suspense>; }
