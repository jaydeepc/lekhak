"use client";
import { useEffect } from "react";
export function SW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {});
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); (window as unknown as { __installPrompt?: Event }).__installPrompt = e; });
    if ("speechSynthesis" in window) speechSynthesis.getVoices();
  }, []);
  return null;
}
