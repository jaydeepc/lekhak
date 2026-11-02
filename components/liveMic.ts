"use client";
import { GoogleGenAI, Modality, type Session } from "@google/genai";

/**
 * Streams microphone audio from the browser straight to Gemini Live transcription using a short-lived token
 * minted by /api/gemini/token. Sessions are capped at 10 min by the API, so we rotate them seamlessly.
 */
export interface LiveMicOptions {
  onInterim: (text: string) => void;
  onFinal: (text: string, offsetMs: number) => void;
  onStatus?: (s: "connecting" | "listening" | "rotating" | "stopped" | "error", detail?: string) => void;
  onLevel?: (rms: number) => void;
  onUsage?: (audioSeconds: number) => void;
  rotateAfterMs?: number;
  /** Force a finalised line if the speaker hasn't paused for this long (the model keeps listening). */
  maxUtteranceMs?: number;
  deviceId?: string;
}

const TARGET_RATE = 16000;
const CHUNK_MS = 100;

export class LiveMic {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: ScriptProcessorNode | AudioWorkletNode | null = null;
  private session: Session | null = null;
  private sessionOpenedAt = 0;
  private startedAt = 0;
  private stopped = true;
  private rotating = false;
  private pending: string[] = [];
  private buf: Float32Array[] = [];
  private bufLen = 0;
  private usageAcc = 0;
  private usageTimer: ReturnType<typeof setInterval> | null = null;
  private lastInterim = "";
  private interimStartedAt = 0;
  private lastForceAt = 0;
  constructor(private opts: LiveMicOptions) {}

  get running() { return !this.stopped; }
  get elapsedMs() { return this.startedAt ? Date.now() - this.startedAt : 0; }

  async start(startedAt?: number) {
    this.stopped = false;
    this.startedAt = startedAt || Date.now();
    this.opts.onStatus?.("connecting");
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: this.opts.deviceId ? { exact: this.opts.deviceId } : undefined, channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
    this.ctx = new AudioContext({ sampleRate: TARGET_RATE }); // browsers that can't do 16k will give their native rate; we resample below
    const src = this.ctx.createMediaStreamSource(this.stream);
    const proc = this.ctx.createScriptProcessor(4096, 1, 1);
    this.node = proc;
    const inRate = this.ctx.sampleRate;
    const perChunk = Math.round((TARGET_RATE * CHUNK_MS) / 1000);
    proc.onaudioprocess = (e) => {
      if (this.stopped) return;
      const data = e.inputBuffer.getChannelData(0);
      let rms = 0; for (let i = 0; i < data.length; i += 8) rms += data[i] * data[i];
      this.opts.onLevel?.(Math.sqrt(rms / (data.length / 8)));
      const mono = inRate === TARGET_RATE ? new Float32Array(data) : resample(data, inRate, TARGET_RATE);
      this.buf.push(mono); this.bufLen += mono.length;
      while (this.bufLen >= perChunk) {
        const out = new Float32Array(perChunk);
        let filled = 0;
        while (filled < perChunk) {
          const head = this.buf[0];
          const take = Math.min(head.length, perChunk - filled);
          out.set(head.subarray(0, take), filled); filled += take;
          if (take === head.length) this.buf.shift(); else this.buf[0] = head.subarray(take);
        }
        this.bufLen -= perChunk;
        this.send(pcm16b64(out));
      }
    };
    src.connect(proc); proc.connect(this.ctx.destination);
    this.usageTimer = setInterval(() => { if (this.usageAcc >= 30) { this.opts.onUsage?.(this.usageAcc); this.usageAcc = 0; } }, 5000);
    await this.openSession();
  }

  private send(b64: string) {
    this.usageAcc += CHUNK_MS / 1000;
    if (!this.session || this.rotating) { if (this.pending.length < 60) this.pending.push(b64); return; }
    try { this.session.sendRealtimeInput({ audio: { data: b64, mimeType: `audio/pcm;rate=${TARGET_RATE}` } }); }
    catch { this.pending.push(b64); }
    const rotateAfter = this.opts.rotateAfterMs ?? 8.5 * 60_000;
    if (Date.now() - this.sessionOpenedAt > rotateAfter) void this.rotate();
    // Long unbroken speech: ask the model to commit what it has so attendees get a timestamped line now.
    const maxUtt = this.opts.maxUtteranceMs ?? 20_000;
    if (this.lastInterim && this.interimStartedAt && Date.now() - this.startedAt - this.interimStartedAt > maxUtt && Date.now() - this.lastForceAt > maxUtt) {
      this.lastForceAt = Date.now();
      try { this.session.sendRealtimeInput({ audioStreamEnd: true }); } catch { /* ignore */ }
    }
  }

  private async openSession() {
    const tok = await fetch("/api/gemini/token", { method: "POST" }).then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Could not get a live token"); return r.json(); });
    const ai = new GoogleGenAI({ apiKey: tok.token, httpOptions: { apiVersion: "v1alpha" } });
    const config: Record<string, unknown> = { responseModalities: [Modality.TEXT], inputAudioTranscription: { languageCodes: [], mode: tok.mode, ...(tok.customVocabulary?.length ? { customVocabulary: tok.customVocabulary } : {}) }, ...(tok.vad ? { realtimeInputConfig: tok.vad } : {}) };
    const session = await ai.live.connect({
      model: tok.model, config,
      callbacks: {
        onopen: () => { this.opts.onStatus?.("listening"); },
        onmessage: (m) => {
          const c = m.serverContent;
          if (c?.interimInputTranscription?.text !== undefined) {
            const t = c.interimInputTranscription.text || "";
            if (!this.lastInterim && t) this.interimStartedAt = Date.now() - this.startedAt;
            this.lastInterim = t; this.opts.onInterim(t);
          }
          if (c?.inputTranscription?.text) {
            const off = this.interimStartedAt || Math.max(0, Date.now() - this.startedAt - 3000);
            this.opts.onFinal(c.inputTranscription.text, off);
            this.lastInterim = ""; this.interimStartedAt = 0; this.opts.onInterim("");
          }
          if (m.goAway && !this.stopped) void this.rotate();
        },
        onerror: (e) => { this.opts.onStatus?.("error", e.message); },
        onclose: (e) => { if (!this.stopped && this.session === session) { this.opts.onStatus?.("rotating", e.reason || "reconnecting"); void this.rotate(true); } },
      },
    });
    this.session = session; this.sessionOpenedAt = Date.now();
    for (const b of this.pending.splice(0)) { try { session.sendRealtimeInput({ audio: { data: b, mimeType: `audio/pcm;rate=${TARGET_RATE}` } }); } catch { /* drop */ } }
  }

  private async rotate(force = false) {
    if (this.rotating || this.stopped) return;
    this.rotating = true;
    this.opts.onStatus?.("rotating");
    const old = this.session;
    this.session = null;
    try {
      if (old && !force) { try { old.sendRealtimeInput({ audioStreamEnd: true }); } catch { /* ignore */ } setTimeout(() => { try { old.close(); } catch { /* ignore */ } }, 4000); }
      await this.openSession();
    } catch (e) {
      this.opts.onStatus?.("error", e instanceof Error ? e.message : "reconnect failed");
      setTimeout(() => { this.rotating = false; if (!this.stopped) void this.rotate(true); }, 2000);
      return;
    }
    this.rotating = false;
  }

  async stop() {
    this.stopped = true;
    if (this.usageTimer) clearInterval(this.usageTimer);
    if (this.usageAcc > 0) { this.opts.onUsage?.(this.usageAcc); this.usageAcc = 0; }
    const s = this.session; this.session = null;
    if (s) { try { s.sendRealtimeInput({ audioStreamEnd: true }); } catch { /* ignore */ } setTimeout(() => { try { s.close(); } catch { /* ignore */ } }, 1500); }
    this.node?.disconnect(); this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close().catch(() => {});
    this.ctx = null; this.stream = null; this.node = null;
    this.opts.onStatus?.("stopped");
  }
}

function resample(input: Float32Array, from: number, to: number): Float32Array {
  const ratio = from / to;
  const n = Math.floor(input.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const pos = i * ratio, i0 = Math.floor(pos), i1 = Math.min(input.length - 1, i0 + 1), frac = pos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

function pcm16b64(f: Float32Array): string {
  const buf = new ArrayBuffer(f.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(bin);
}
