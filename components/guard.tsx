"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe, type Attendee } from "./api";

/** Renders children only for a signed-in attendee; otherwise sends them to sign in. */
export function useRequireMe(): Attendee | null | undefined {
  const { me } = useMe();
  const router = useRouter();
  useEffect(() => { if (me === null) router.replace("/signin"); }, [me, router]);
  return me;
}
