import JSZip from "jszip";
import type { ExtractedPage } from "./gemini";

function xmlText(xml: string): string {
  // paragraphs → newlines, runs → concatenated
  const paras = xml.split(/<\/a:p>/g);
  const out: string[] = [];
  for (const p of paras) {
    const runs = Array.from(p.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)).map((m) => m[1]);
    const line = runs.join("").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
    if (line) out.push(line);
  }
  return out.join("\n");
}

export async function extractPptx(buf: Buffer): Promise<ExtractedPage[]> {
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => parseInt(a.match(/(\d+)/)![1]) - parseInt(b.match(/(\d+)/)![1]));
  const pages: ExtractedPage[] = [];
  for (const f of slideFiles) {
    const n = parseInt(f.match(/slide(\d+)\.xml/)![1], 10);
    const xml = await zip.file(f)!.async("string");
    let text = xmlText(xml);
    const notesFile = `ppt/notesSlides/notesSlide${n}.xml`;
    if (zip.file(notesFile)) {
      const notes = xmlText(await zip.file(notesFile)!.async("string"));
      if (notes) text += `\n\nSpeaker notes: ${notes}`;
    }
    const firstLine = text.split("\n")[0] || `Slide ${n}`;
    const numbers = Array.from(text.matchAll(/(?:₹|\$|Rs\.?\s?)?\d[\d,]*(?:\.\d+)?\s?(?:%|percent|lakh|crore|cr|bn|mn|million|billion|x|×|days?|min|years?)?/gi)).map((m) => m[0].trim()).filter((s) => /\d/.test(s) && s.length > 1).slice(0, 30);
    pages.push({ page: n, title: firstLine.slice(0, 200), text: text.slice(0, 8000), numbers });
  }
  return pages;
}
