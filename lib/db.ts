import { MongoClient, Db, GridFSBucket, type Collection } from "mongodb";
import type {
  AttendeeDoc, ChatDoc, ChunkDoc, DocumentDoc, PresenceDoc, SegmentDoc, SessionDoc,
  SummaryDoc, UnlockDoc, UsageDoc, Pricing, EventSettings,
} from "./types";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "lekhak";
if (!uri) throw new Error("MONGODB_URI is not set");

declare global {
  // eslint-disable-next-line no-var
  var __lekhakMongo: { client: MongoClient; promise: Promise<MongoClient>; indexed?: Promise<void> } | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  if (!global.__lekhakMongo) {
    const client = new MongoClient(uri!, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000 });
    global.__lekhakMongo = { client, promise: client.connect() };
  }
  return global.__lekhakMongo.promise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  const db = client.db(dbName);
  if (!global.__lekhakMongo!.indexed) global.__lekhakMongo!.indexed = ensureIndexes(db).catch(() => {});
  return db;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("sessions").createIndex({ slug: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ startAt: 1 }),
    db.collection("segments").createIndex({ sessionId: 1, seq: 1 }, { unique: true }),
    db.collection("attendees").createIndex({ email: 1 }, { unique: true }),
    db.collection("attendees").createIndex({ passToken: 1 }, { unique: true }),
    db.collection("presence").createIndex({ attendeeId: 1, sessionId: 1, to: -1 }),
    db.collection("unlocks").createIndex({ attendeeId: 1, sessionId: 1 }, { unique: true }),
    db.collection("chunks").createIndex({ sessionId: 1 }),
    db.collection("chunks").createIndex({ documentId: 1 }),
    db.collection("chats").createIndex({ attendeeId: 1, createdAt: 1 }),
    db.collection("usage").createIndex({ createdAt: 1 }),
    db.collection("summaries").createIndex({ attendeeId: 1, sessionId: 1 }, { unique: true }),
  ]);
}

export async function col<T extends { _id: unknown } = never>(name: string): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}

export const C = {
  sessions: () => col<SessionDoc>("sessions"),
  segments: () => col<SegmentDoc>("segments"),
  attendees: () => col<AttendeeDoc>("attendees"),
  presence: () => col<PresenceDoc>("presence"),
  unlocks: () => col<UnlockDoc>("unlocks"),
  documents: () => col<DocumentDoc>("documents"),
  chunks: () => col<ChunkDoc>("chunks"),
  chats: () => col<ChatDoc>("chats"),
  usage: () => col<UsageDoc>("usage"),
  summaries: () => col<SummaryDoc>("summaries"),
  settings: () => col<Pricing | EventSettings>("settings"),
};

export async function bucket(): Promise<GridFSBucket> {
  const db = await getDb();
  return new GridFSBucket(db, { bucketName: "uploads" });
}
