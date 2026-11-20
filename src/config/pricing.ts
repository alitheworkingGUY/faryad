// Prices used by the live cost meter. Edit here if OpenAI changes its rates.
// Source: OpenAI pricing page, read 20 Nov 2026 (USD per 1M tokens).

export const REALTIME_PRICES_PER_1M = {
  audioIn: 32.0,
  audioInCached: 0.4,
  audioOut: 64.0,
  textIn: 4.0,
  textInCached: 0.4,
  textOut: 16.0,
};

/** gpt-4o-transcribe, estimated by OpenAI at $0.006 per minute of caller audio. */
export const TRANSCRIBE_USD_PER_MIN = 0.006;

/** USD -> PKR. An assumption for the demo; set it to the day's rate. */
export const USD_TO_PKR = 280;

/**
 * "Foreign platform" comparison shown next to the live cost.
 * This is an ASSUMPTION for the pitch, not a quoted price: a hosted voice-AI
 * platform plus international telephony, per minute of call. Replace it with
 * the figure you want to defend in front of the judges.
 */
export const FOREIGN_PLATFORM_USD_PER_MIN = 0.35;

export type RealtimeUsage = {
  input_tokens?: number;
  output_tokens?: number;
  input_token_details?: {
    text_tokens?: number;
    audio_tokens?: number;
    cached_tokens?: number;
    cached_tokens_details?: { text_tokens?: number; audio_tokens?: number };
  };
  output_token_details?: { text_tokens?: number; audio_tokens?: number };
};

/** Cost in USD of one `response.done` usage block. */
export function usageCostUsd(u: RealtimeUsage | null | undefined): number {
  if (!u) return 0;
  const p = REALTIME_PRICES_PER_1M;
  const inD = u.input_token_details ?? {};
  const outD = u.output_token_details ?? {};
  const cachedText = inD.cached_tokens_details?.text_tokens ?? 0;
  const cachedAudio = inD.cached_tokens_details?.audio_tokens ?? 0;
  // If the split of cached tokens is missing, treat them all as cached text.
  const cachedUnsplit = Math.max(0, (inD.cached_tokens ?? 0) - cachedText - cachedAudio);
  const textIn = Math.max(0, (inD.text_tokens ?? 0) - cachedText - cachedUnsplit);
  const audioIn = Math.max(0, (inD.audio_tokens ?? 0) - cachedAudio);
  const textOut = outD.text_tokens ?? 0;
  const audioOut = outD.audio_tokens ?? 0;
  const usd =
    (textIn * p.textIn +
      (cachedText + cachedUnsplit) * p.textInCached +
      audioIn * p.audioIn +
      cachedAudio * p.audioInCached +
      textOut * p.textOut +
      audioOut * p.audioOut) /
    1_000_000;
  return Number.isFinite(usd) ? usd : 0;
}

export function transcriptionCostUsd(seconds: number): number {
  return (Math.max(0, seconds) / 60) * TRANSCRIBE_USD_PER_MIN;
}

export function foreignPlatformPkr(seconds: number): number {
  return (Math.max(0, seconds) / 60) * FOREIGN_PLATFORM_USD_PER_MIN * USD_TO_PKR;
}

export function usdToPkr(usd: number): number {
  return usd * USD_TO_PKR;
}
