import { ObjectId } from "mongodb";
import { handle, json, body, requireAdmin } from "@/lib/api";
import { seed } from "@/lib/seed";
import { C } from "@/lib/db";
import type { DocumentDoc } from "@/lib/types";

export const maxDuration = 300;

/** Seeds demo data. With {withDeck:true} it also uploads and indexes the bundled sample keynote PDF. */
export const POST = handle(async (req) => {
  await requireAdmin(req);
  const b = await body<{ eventDate?: string; wipe?: boolean; withDeck?: boolean }>(req).catch(() => ({} as { eventDate?: string; wipe?: boolean; withDeck?: boolean }));
  const r = await seed({ eventDate: b.eventDate, wipe: Boolean(b.wipe) });
  let deck: string | null = null;
  if (b.withDeck) {
    const keynote = await (await C.sessions()).findOne({ slug: "keynote" });
    const existing = keynote ? await (await C.documents()).findOne({ sessionId: keynote._id, name: "keynote-deck-sample.pdf" }) : null;
    if (keynote && !existing) {
      const origin = req.nextUrl.origin;
      const res = await fetch(`${origin}/samples/keynote-deck.pdf`);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const { bucket } = await import("@/lib/db");
        const { extractPdfPages, embed } = await import("@/lib/gemini");
        const docs = await C.documents();
        const doc: DocumentDoc = { _id: new ObjectId(), sessionId: keynote._id, name: "keynote-deck-sample.pdf", mimeType: "application/pdf", size: buf.length, fileId: null, status: "processing", createdAt: new Date(), processedAt: null };
        await docs.insertOne(doc);
        try {
          const bk = await bucket();
          const fileId = await new Promise<ObjectId>((resolve, reject) => { const up = bk.openUploadStream(doc.name, { metadata: { documentId: doc._id, sessionId: keynote._id, contentType: doc.mimeType } }); up.on("error", reject); up.on("finish", () => resolve(up.id as ObjectId)); up.end(buf); });
          const pages = await extractPdfPages(buf, { sessionId: keynote._id.toString() });
          const vectors = await embed(pages.map((p) => `${p.title}\n${p.text}\n${p.numbers.join("; ")}`), { sessionId: keynote._id.toString() });
          await (await C.chunks()).insertMany(pages.map((p, i) => ({ _id: new ObjectId(), documentId: doc._id, sessionId: keynote._id, page: p.page, title: p.title || `Slide ${p.page}`, text: p.text, numbers: p.numbers, embedding: vectors[i] || [] })));
          await docs.updateOne({ _id: doc._id }, { $set: { fileId, status: "ready", pages: pages.length, chunkCount: pages.length, processedAt: new Date() } });
          deck = `${pages.length} slides indexed`;
        } catch (e) {
          await docs.updateOne({ _id: doc._id }, { $set: { status: "error", error: e instanceof Error ? e.message : "failed" } });
          deck = "deck indexing failed";
        }
      }
    } else deck = "sample deck already present";
  }
  return json({ ...r, deck });
});
