import { C } from "./db";
import type { Pricing } from "./types";

// Gemini API list prices (USD) as published on ai.google.dev/pricing, Nov 2026.
// Editable from the admin console; this is just the seed.
export const DEFAULT_PRICING: Pricing = {
  _id: "pricing",
  chatInputPerM: 0.75,
  chatOutputPerM: 3.75,
  embedPerM: 0.2,
  liveAudioPerMin: 0.005,
  liveTextPerMin: 0.004,
  currency: "USD",
  inrPerUsd: 84,
  updatedAt: new Date(0),
};

let cache: { p: Pricing; at: number } | null = null;
export async function getPricing(): Promise<Pricing> {
  if (cache && Date.now() - cache.at < 60_000) return cache.p;
  const s = await C.settings();
  const doc = (await s.findOne({ _id: "pricing" })) as Pricing | null;
  const p = doc ? { ...DEFAULT_PRICING, ...doc } : DEFAULT_PRICING;
  cache = { p, at: Date.now() };
  return p;
}
export function invalidatePricing() { cache = null; }

export function chatCost(p: Pricing, promptTokens: number, outputTokens: number) {
  return (promptTokens * p.chatInputPerM + outputTokens * p.chatOutputPerM) / 1_000_000;
}
export function embedCost(p: Pricing, tokens: number) { return (tokens * p.embedPerM) / 1_000_000; }
export function liveCost(p: Pricing, audioSeconds: number) { return (audioSeconds / 60) * (p.liveAudioPerMin + p.liveTextPerMin); }
