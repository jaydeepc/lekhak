"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Renders a PPTX faithfully in the browser (shapes, text boxes, images, charts) using pptx-preview.
 * Slides are laid out at the container's width; falls back to the caller's text cards on failure.
 */
export function PptxViewer({ fileUrl, onFail, onReady }: { fileUrl: string; onFail: (reason: string) => void; onReady?: (count: number) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  useEffect(() => {
    let cancelled = false;
    let previewer: { destroy: () => void } | null = null;
    (async () => {
      try {
        const el = host.current; if (!el) return;
        const width = Math.max(280, el.clientWidth);
        const [{ init }, res] = await Promise.all([import("pptx-preview"), fetch(fileUrl, { credentials: "same-origin" })]);
        if (!res.ok) throw new Error(`file ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        el.innerHTML = "";
        const p = init(el, { width, height: Math.round((width * 9) / 16), mode: "list" }) as unknown as { preview: (b: ArrayBuffer) => Promise<unknown>; destroy: () => void; slideCount: number };
        previewer = p;
        await p.preview(buf);
        if (cancelled) return;
        setState("ready"); onReady?.(p.slideCount || 0);
      } catch (e) {
        console.error("[pptx]", e);
        if (!cancelled) { setState("failed"); onFail(e instanceof Error ? e.message : "render failed"); }
      }
    })();
    return () => { cancelled = true; try { previewer?.destroy(); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);
  return (
    <div className="pptx-host">
      {state === "loading" && <div className="col" style={{ gap: 10 }}>{[1, 2, 3].map((i) => <div key={i} className="skel" style={{ aspectRatio: "16/9" }} />)}<div className="small center">Rendering the original slides…</div></div>}
      <div ref={host} className={`pptx-render ${state === "ready" ? "" : "pending"}`} />
    </div>
  );
}
