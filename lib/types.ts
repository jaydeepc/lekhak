import type { ObjectId } from "mongodb";

export type SessionKind = "keynote" | "booth" | "panel" | "break";
export type SessionStatus = "upcoming" | "live" | "paused" | "ended";

export interface SessionDoc {
  _id: ObjectId;
  slug: string;
  title: string;
  tagline?: string;
  description?: string;
  speaker?: string;
  speakerTitle?: string;
  room: string;
  kind: SessionKind;
  startAt: Date;
  endAt: Date;
  image: string; // /assets/… or https URL
  code?: string; // room / booth code printed on the last slide
  alwaysOpen: boolean; // keynote: everyone can ask about it without scanning
  status: SessionStatus;
  liveStartedAt?: Date | null;
  liveEndedAt?: Date | null;
  liveInterim?: string; // current interim caption from the recorder
  liveInterimAt?: Date | null;
  lastSeq: number; // last transcript segment sequence number
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SegmentDoc {
  _id: ObjectId;
  sessionId: ObjectId;
  seq: number;
  text: string;
  offsetMs: number; // ms since liveStartedAt
  createdAt: Date;
}

export interface AttendeeDoc {
  _id: ObjectId;
  name: string;
  email: string;
  firm?: string;
  role?: string;
  passToken: string;
  createdAt: Date;
  lastSeenAt?: Date | null;
  signedInAt?: Date | null;
}

export interface PresenceDoc {
  _id: ObjectId;
  attendeeId: ObjectId;
  sessionId: ObjectId;
  from: Date;
  to: Date;
}

export interface UnlockDoc {
  _id: ObjectId;
  attendeeId: ObjectId;
  sessionId: ObjectId;
  via: "scan" | "code" | "live" | "admin";
  at: Date;
}

export interface DocumentDoc {
  _id: ObjectId;
  sessionId: ObjectId;
  name: string;
  mimeType: string;
  size: number;
  fileId?: ObjectId | null; // GridFS
  status: "uploading" | "uploaded" | "processing" | "ready" | "error";
  error?: string;
  pages?: number;
  chunkCount?: number;
  createdAt: Date;
  processedAt?: Date | null;
}

export interface ChunkDoc {
  _id: ObjectId;
  documentId: ObjectId;
  sessionId: ObjectId;
  page: number;
  title: string;
  text: string;
  numbers: string[];
  embedding: number[];
}

export interface ChatSource {
  kind: "talk" | "deck";
  sessionId?: string;
  sessionTitle?: string;
  t?: string; // HH:MM:SS into the talk
  quote?: string;
  documentId?: string;
  documentName?: string;
  page?: number;
  title?: string;
  excerpt?: string;
}

export interface ChatDoc {
  _id: ObjectId;
  attendeeId: ObjectId;
  sessionId?: ObjectId | null;
  role: "user" | "assistant";
  text: string;
  sources?: ChatSource[];
  lang?: string;
  createdAt: Date;
}

export type UsageKind = "chat" | "embed" | "extract" | "summary" | "live" | "other";
export interface UsageDoc {
  _id: ObjectId;
  kind: UsageKind;
  model: string;
  promptTokens: number;
  outputTokens: number;
  audioSeconds: number;
  costUsd: number;
  attendeeId?: ObjectId | null;
  sessionId?: ObjectId | null;
  createdAt: Date;
}

export interface SummaryDoc {
  _id: ObjectId;
  attendeeId: ObjectId;
  sessionId: ObjectId;
  upToSeq: number;
  headline: string;
  points: { t: string; point: string }[];
  numbers: string[];
  createdAt: Date;
}

export interface Pricing {
  _id: "pricing";
  chatInputPerM: number;
  chatOutputPerM: number;
  embedPerM: number;
  liveAudioPerMin: number;
  liveTextPerMin: number;
  currency: "USD";
  inrPerUsd: number;
  updatedAt: Date;
}

export interface EventSettings {
  _id: "event";
  name: string;
  date: string;
  venue: string;
  updatedAt: Date;
}
