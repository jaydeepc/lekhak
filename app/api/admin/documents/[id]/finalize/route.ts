import { ObjectId } from "mongodb";
import { handle, json, body, requireAdmin, HttpError } from "@/lib/api";
import { bucket, C } from "@/lib/db";
import { oid } from "@/lib/services";
import { embed, extractPdfPages, type ExtractedPage } from "@/lib/gemini";
import { extractPptx } from "@/lib/pptx";

export const maxDuration = 300;

/** Stitch parts → one GridFS file → extract slides with Gemini → embed → ready. */
export const POST = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const { parts } = await body<{ parts: number }>(req);
  const docs = await C.documents();
  const d = await docs.findOne({ _id: oid(id) });
  if (!d) throw new HttpError(404, "Document not found");
  const b = await bucket();
  await docs.updateOne({ _id: d._id }, { $set: { status: "processing", error: "" } });
  try {
    // 1. stitch
    const chunks: Buffer[] = [];
    for (let i = 0; i < parts; i++) {
      const files = await b.find({ filename: `${d._id.toString()}.part.${i}` }).toArray();
      if (!files.length) throw new Error(`Missing part ${i + 1} of ${parts}`);
      const data = await new Promise<Buffer>((resolve, reject) => {
        const bufs: Buffer[] = [];
        b.openDownloadStream(files[0]._id).on("data", (c) => bufs.push(c as Buffer)).on("error", reject).on("end", () => resolve(Buffer.concat(bufs)));
      });
      chunks.push(data);
      await b.delete(files[0]._id).catch(() => {});
    }
    const file = Buffer.concat(chunks);
    if (d.fileId) await b.delete(d.fileId).catch(() => {});
    const fileId = await new Promise<ObjectId>((resolve, reject) => {
      const up = b.openUploadStream(d.name, { metadata: { documentId: d._id, sessionId: d.sessionId, contentType: d.mimeType } });
      up.on("error", reject); up.on("finish", () => resolve(up.id as ObjectId));
      up.end(file);
    });
    await docs.updateOne({ _id: d._id }, { $set: { fileId, size: file.length, status: "processing" } });

    // 2. extract
    let pages: ExtractedPage[] = [];
    if (d.mimeType === "application/pdf") pages = await extractPdfPages(file, { sessionId: d.sessionId.toString() });
    else if (d.mimeType.includes("presentation")) pages = await extractPptx(file);
    else {
      const text = file.toString("utf8");
      const paras = text.split(/\n\s*\n/).filter((p) => p.trim());
      pages = paras.map((p, i) => ({ page: i + 1, title: p.split("\n")[0].slice(0, 120), text: p.slice(0, 6000), numbers: [] }));
    }
    pages = pages.filter((p) => (p.text || p.title || "").trim());
    if (!pages.length) throw new Error("No readable text found in this file");

    // 3. embed + store
    const vectors = await embed(pages.map((p) => `${p.title}\n${p.text}\n${p.numbers.join("; ")}`), { sessionId: d.sessionId.toString() });
    const col = await C.chunks();
    await col.deleteMany({ documentId: d._id });
    await col.insertMany(pages.map((p, i) => ({ _id: new ObjectId(), documentId: d._id, sessionId: d.sessionId, page: p.page, title: p.title || `Slide ${p.page}`, text: p.text, numbers: p.numbers, embedding: vectors[i] || [] })));
    await docs.updateOne({ _id: d._id }, { $set: { status: "ready", pages: pages.length, chunkCount: pages.length, processedAt: new Date() } });
    return json({ ok: true, pages: pages.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Processing failed";
    await docs.updateOne({ _id: d._id }, { $set: { status: "error", error: msg } });
    throw new HttpError(500, msg);
  }
});
