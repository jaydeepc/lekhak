import { handle, HttpError, requireAny } from "@/lib/api";
import { verifyFileAccess } from "@/lib/auth";
import { bucket, C } from "@/lib/db";
import { oid } from "@/lib/services";
import { Readable } from "node:stream";

export const GET = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  const signed = await verifyFileAccess(id, req.nextUrl.searchParams.get("sig"));
  if (!signed) await requireAny(req);
  const d = await (await C.documents()).findOne({ _id: oid(id) });
  if (!d || !d.fileId) throw new HttpError(404, "File not found");
  const b = await bucket();
  const nodeStream = b.openDownloadStream(d.fileId);
  const web = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new Response(web, { headers: { "Content-Type": d.mimeType, "Content-Disposition": `inline; filename="${encodeURIComponent(d.name)}"`, "Cache-Control": signed ? "public, max-age=3600, s-maxage=21600, immutable" : "private, max-age=3600", "Access-Control-Allow-Origin": "*" } });
});
