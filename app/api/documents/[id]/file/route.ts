import { handle, HttpError, requireAny } from "@/lib/api";
import { bucket, C } from "@/lib/db";
import { oid } from "@/lib/services";
import { Readable } from "node:stream";

export const GET = handle(async (req, ctx) => {
  await requireAny(req);
  const { id } = await ctx.params;
  const d = await (await C.documents()).findOne({ _id: oid(id) });
  if (!d || !d.fileId) throw new HttpError(404, "File not found");
  const b = await bucket();
  const nodeStream = b.openDownloadStream(d.fileId);
  const web = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new Response(web, { headers: { "Content-Type": d.mimeType, "Content-Disposition": `inline; filename="${encodeURIComponent(d.name)}"`, "Cache-Control": "private, max-age=3600" } });
});
