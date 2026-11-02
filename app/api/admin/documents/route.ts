import { ObjectId } from "mongodb";
import { handle, json, body, requireAdmin, str, HttpError } from "@/lib/api";
import { C } from "@/lib/db";
import { oid } from "@/lib/services";
import type { DocumentDoc } from "@/lib/types";

const ALLOWED = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "text/plain", "text/markdown"]);

/** Step 1 of an upload: register the document. The browser then PUTs ≤3 MB parts, then POSTs finalize. */
export const POST = handle(async (req) => {
  await requireAdmin(req);
  const b = await body<Record<string, unknown>>(req);
  const sessionId = oid(str(b.sessionId, "sessionId"));
  const name = str(b.name, "File name", { max: 200 });
  let mimeType = str(b.mimeType, "mimeType", { optional: true, max: 100 });
  if (!mimeType) mimeType = name.toLowerCase().endsWith(".pptx") ? "application/vnd.openxmlformats-officedocument.presentationml.presentation" : name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "text/plain";
  if (!ALLOWED.has(mimeType)) throw new HttpError(400, "Upload a PDF, PPTX or text file. For the richest understanding (charts, images), export your deck as PDF.");
  const size = Number(b.size) || 0;
  if (size > 60 * 1024 * 1024) throw new HttpError(400, "File is larger than 60 MB");
  const doc: DocumentDoc = { _id: new ObjectId(), sessionId, name, mimeType, size, fileId: null, status: "uploading", createdAt: new Date(), processedAt: null };
  await (await C.documents()).insertOne(doc);
  return json({ id: doc._id.toString(), partSize: 3 * 1024 * 1024 }, { status: 201 });
});

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const docs = await (await C.documents()).find({}).sort({ createdAt: -1 }).toArray();
  return json({ documents: docs.map((d) => ({ id: d._id.toString(), sessionId: d.sessionId.toString(), name: d.name, status: d.status, pages: d.pages || 0, chunkCount: d.chunkCount || 0, size: d.size, error: d.error || "" })) });
});
