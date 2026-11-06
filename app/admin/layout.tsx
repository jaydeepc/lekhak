"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import "./admin.css";
import { Calendar, Coin, Logo, Question, Radio, Settings, Users, Home } from "@/components/icons";
import { useAdminMe } from "@/components/admin";
import { api } from "@/components/api";

const NAV = [
  ["/admin", "Overview", <Home key="o" size={18} />],
  ["/admin/sessions", "Agenda & decks", <Calendar key="a" size={18} />],
  ["/admin/attendees", "Attendees & passes", <Users key="u" size={18} />],
  ["/admin/questions", "Questions", <Question key="q" size={18} />],
  ["/admin/costs", "Costs", <Coin key="c" size={18} />],
  ["/admin/settings", "Settings", <Settings key="s" size={18} />],
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const admin = useAdminMe();
  const isLogin = path === "/admin/login";
  useEffect(() => { if (admin === null && !isLogin) router.replace("/admin/login"); }, [admin, isLogin, router]);
  if (isLogin) return <>{children}</>;
  if (!admin) return <div className="adm" style={{ gridTemplateColumns: "1fr" }}><div className="adm-main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><div className="orb quiet" /></div></div>;
  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="brand"><div className="logo"><Logo h={36} /></div><div><b>Lekhak console</b><span>Investor &amp; Analyst Day</span></div></div>
        <nav>{NAV.map(([href, label, icon]) => <Link key={href} href={href} className={(href === "/admin" ? path === href : path.startsWith(href)) || (href === "/admin/sessions" && path.startsWith("/admin/live")) ? "on" : ""}>{icon}{label}</Link>)}</nav>
        <div className="foot">
          <Link href="/entrance" target="_blank" style={{ fontWeight: 700 }}>Open entrance QR screen ↗</Link>
          <Link href="/home" target="_blank" style={{ fontWeight: 700 }}>Open attendee app ↗</Link>
          <button className="btn text" style={{ height: 32, justifyContent: "flex-start", padding: 0 }} onClick={async () => { await api("/api/admin/logout", { method: "POST" }); router.replace("/admin/login"); }}>Sign out ({admin.username})</button>
        </div>
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}
