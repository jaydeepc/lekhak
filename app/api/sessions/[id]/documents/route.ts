import { handle, json } from "@/lib/api";
import { C } from "@/lib/db";
import { oid } from "@/lib/services";

export const GET = handle(async (_req, ctx) => {
  const { id } = await ctx.params;
  const sessionId = oid(id);
  const docs = await (await C.documents()).find({ sessionId, status: "ready" }).sort({ createdAt: 1 }).toArray();
  const chunks = await (await C.chunks()).find({ sessionId }, { projection: { documentId: 1, page: 1, title: 1, text: 1, numbers: 1 } }).sort({ page: 1 }).toArray();
  return json({
    documents: docs.map((d) => ({
      id: d._id.toString(), name: d.name, mimeType: d.mimeType, pages: d.pages || 0, size: d.size,
      slides: chunks.filter((c) => c.documentId.equals(d._id)).map((c) => ({ page: c.page, title: c.title, text: c.text.slice(0, 600), numbers: c.numbers.slice(0, 6) })),
    })),
  });
});
