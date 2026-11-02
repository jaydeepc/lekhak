import { ObjectId } from "mongodb";
import { handle, json, requireAdmin, HttpError } from "@/lib/api";
import { bucket, C } from "@/lib/db";
import { oid } from "@/lib/services";

/** PUT raw bytes for part N (query ?part=N). Each part is stored as its own GridFS file and stitched at finalize. */
export const PUT = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const part = parseInt(req.nextUrl.searchParams.get("part") || "", 10);
  if (isNaN(part) || part < 0) throw new HttpError(400, "part required");
  const d = await (await C.documents()).findOne({ _id: oid(id) });
  if (!d) throw new HttpError(404, "Document not found");
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) throw new HttpError(400, "Empty part");
  const b = await bucket();
  const partName = `${d._id.toString()}.part.${part}`;
  // replace if re-sent
  for await (const f of b.find({ filename: partName })) await b.delete(f._id).catch(() => {});
  await new Promise<void>((resolve, reject) => {
    const up = b.openUploadStream(partName, { metadata: { documentId: d._id, part, kind: "part" } });
    up.on("error", reject); up.on("finish", () => resolve());
    up.end(buf);
  });
  return json({ ok: true, part, bytes: buf.length, id: new ObjectId().toString() });
});
