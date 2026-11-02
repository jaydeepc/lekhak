"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/components/api";

export default function Index() {
  const { me } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me === undefined) return;
    if (me) router.replace("/home");
    else router.replace(matchMedia("(min-width:1024px)").matches ? "/entrance" : "/install");
  }, [me, router]);
  return <main className="app dark" style={{ alignItems: "center", justifyContent: "center" }}><div className="orb" /></main>;
}
