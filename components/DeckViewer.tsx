"use client";
import { useEffect, useRef, useState } from "react";
import { PptxViewer } from "./PptxViewer";

export interface DeckDoc { id: string; name: string; mimeType: string; pages: number; fileUrl?: string; publicUrl?: string; slides: { page: number; title: string; text: string; numbers: string[] }[] }

/** Renders a deck: real page images for PDFs (pdf.js, lazily), slide-styled cards for PPTX/text. */
export function DeckViewer({ doc, canOpen, initialPage }: { doc: DeckDoc; canOpen: boolean; initialPage?: number }) {
  const isPdf = doc.mimeType === "application/pdf";
  const isPptx = doc.mimeType.includes("presentation");
  const [full, setFull] = useState<number | null>(initialPage || null);
  const [pptxFailed, setPptxFailed] = useState<string | null>(null);
  const fileHref = doc.fileUrl || `/api/documents/${doc.id}/file`;
  const officeHref = doc.publicUrl ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(doc.publicUrl)}` : null;
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row between" style={{ gap: 10 }}>
        <div className="label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div>
        {canOpen && <div className="row" style={{ gap: 12, flexShrink: 0 }}>{isPptx && officeHref && <a href={officeHref} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600 }}>Open in PowerPoint viewer</a>}<a href={fileHref} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600 }}>Download</a></div>}
      </div>
      {isPptx && !pptxFailed && <PptxViewer fileUrl={fileHref} onFail={setPptxFailed} />}
      {isPptx && pptxFailed && <p className="small">Couldn&apos;t render the original slides here ({pptxFailed}). Showing the slide text instead{officeHref ? ", or open the PowerPoint viewer above" : ""}.</p>}
      {(!isPptx || pptxFailed) && <div className="col" style={{ gap: 14 }}>
        {doc.slides.map((sl) => (
          <button key={sl.page} type="button" className="deck-slide" onClick={() => setFull(sl.page)} aria-label={`Open slide ${sl.page}`}>
            {isPdf ? <PdfPage url={`/api/documents/${doc.id}/file`} page={sl.page} /> : <TextSlide title={sl.title} text={sl.text} page={sl.page} />}
            <div className="deck-cap"><span>{String(sl.page).padStart(2, "0")}</span><b>{sl.title}</b></div>
          </button>
        ))}
      </div>}
      {full !== null && (
        <div className="deck-full" onClick={() => setFull(null)}>
          <div className="deck-full-inner" onClick={(e) => e.stopPropagation()}>
            <div className="row between" style={{ color: "#fff", padding: "0 4px 10px" }}><b>Slide {full} of {doc.pages || doc.slides.length}</b><button className="chip glass" onClick={() => setFull(null)}>Close</button></div>
            {isPdf ? <PdfPage url={`/api/documents/${doc.id}/file`} page={full} scale={2} eager /> : (() => { const sl = doc.slides.find((x) => x.page === full); return sl ? <TextSlide title={sl.title} text={sl.text} page={sl.page} large /> : null; })()}
            <div className="row between" style={{ paddingTop: 10 }}>
              <button className="btn ghost sm" disabled={full <= 1} onClick={() => setFull(full - 1)}>← Previous</button>
              <button className="btn ghost sm" disabled={full >= (doc.pages || doc.slides.length)} onClick={() => setFull(full + 1)}>Next →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TextSlide({ title, text, page, large }: { title: string; text: string; page: number; large?: boolean }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).filter((l) => l !== title).slice(0, large ? 14 : 6);
  return (
    <div className={`text-slide ${page === 1 ? "cover" : ""} ${large ? "large" : ""}`}>
      <div className="ts-bar" /><div className="ts-title">{title}</div>
      <ul>{lines.map((l, i) => <li key={i}>{l.replace(/^Speaker notes:/, "📝 ")}</li>)}</ul>
      <div className="ts-foot">{page}</div>
    </div>
  );
}

// pdf.js is loaded once, on demand, only in the browser.
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
function pdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import("pdfjs-dist").then((m) => { m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"; return m; });
  return pdfjsPromise;
}
const docCache = new Map<string, Promise<import("pdfjs-dist").PDFDocumentProxy>>();
function loadDoc(url: string) {
  if (!docCache.has(url)) docCache.set(url, pdfjs().then((m) => m.getDocument({ url, withCredentials: true }).promise));
  return docCache.get(url)!;
}

function PdfPage({ url, page, scale = 1, eager }: { url: string; page: number; scale?: number; eager?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(Boolean(eager));
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (visible || !ref.current) return;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: "400px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const pdf = await loadDoc(url);
        const p = await pdf.getPage(page);
        const canvas = ref.current; if (!canvas || cancelled) return;
        const cssWidth = canvas.parentElement?.clientWidth || 400;
        const base = p.getViewport({ scale: 1 });
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const vp = p.getViewport({ scale: (cssWidth / base.width) * dpr * scale });
        canvas.width = vp.width; canvas.height = vp.height;
        canvas.style.width = "100%"; canvas.style.height = "auto";
        await p.render({ canvas, viewport: vp }).promise;
      } catch (e) { console.error("[pdf]", e); if (!cancelled) setErr(true); }
    })();
    return () => { cancelled = true; };
  }, [visible, url, page, scale]);
  if (err) return <div className="text-slide"><div className="ts-title">Slide {page}</div><ul><li>Couldn&apos;t render this page.</li></ul></div>;
  return <canvas ref={ref} className="pdf-canvas" />;
}
