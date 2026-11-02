"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { App } from "@/components/ui";
import { api } from "@/components/api";

export default function Pass() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<{ attendee: { name: string } }>(`/api/auth/pass/${token}`, { method: "POST" }).then(() => router.replace("/home")).catch((e) => setErr(e.message));
  }, [token, router]);
  return (
    <App dark>
      <div className="screen pad" style={{ alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center" }}>
        <div className={`orb ${err ? "quiet" : ""}`} />
        {err ? <><h2>That pass didn&apos;t scan</h2><p className="lead">{err}</p><Link className="btn ghost" href="/signin">Sign in with email instead</Link></> : <><div className="eyebrow">Your pass</div><h2>Signing you in…</h2></>}
      </div>
    </App>
  );
}
