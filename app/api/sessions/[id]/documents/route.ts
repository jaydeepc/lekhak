import { handle, json } from "@/lib/api";
import { C } from "@/lib/db";
import { oid } from "@/lib/services";
import { signFileAccess } from "@/lib/auth";
import { appOrigin } from "@/lib/text";

export const GET = handle(async (_req, ctx) => {
  const { id } = await ctx.params;
  const sessionId = oid(id);
  const docs = await (await C.documents()).find({ sessionId, status: "ready" }).sort({ createdAt: 1 }).toArray();
  const chunks = await (await C.chunks()).find({ sessionId }, { projection: { documentId: 1, page: 1, title: 1, text: 1, numbers: 1 } }).sort({ page: 1 }).toArray();
  const origin = appOrigin(_req.nextUrl.origin);
  const withUrls = await Promise.all(docs.map(async (d) => ({ d, sig: await signFileAccess(d._id.toString()) })));
  return json({
    documents: withUrls.map(({ d, sig }) => ({
      id: d._id.toString(), name: d.name, mimeType: d.mimeType, pages: d.pages || 0, size: d.size,
      fileUrl: `/api/documents/${d._id.toString()}/file?sig=${sig}`,
      publicUrl: `${origin}/api/documents/${d._id.toString()}/file?sig=${sig}`,
      slides: chunks.filter((c) => c.documentId.equals(d._id)).map((c) => ({ page: c.page, title: c.title, text: c.text.slice(0, 600), numbers: c.numbers.slice(0, 6) })),
    })),
  }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120", "CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
});
