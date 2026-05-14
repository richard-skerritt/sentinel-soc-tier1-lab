// Voice playback client. Plays Morgan's dialogue via the /api/voice proxy.
// - Sequential queue so consecutive lines don't overlap.
// - Fails silent when voice not configured (text-only mode).
// - Respects a global mute flag and a "voice enabled" derived from settings.

import { useEffect, useState, useCallback } from "react";

const API_BASE = "";

let queue: Promise<void> = Promise.resolve();
let currentAudio: HTMLAudioElement | null = null;
let mutedState = false;
const mutedListeners = new Set<(m: boolean) => void>();

// --- Mute state (in-memory, not persisted because we may be in a sandboxed iframe) ---
export function isMuted() {
  return mutedState;
}
export function setMuted(m: boolean) {
  mutedState = m;
  if (m && currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
    currentAudio = null;
  }
  mutedListeners.forEach((fn) => fn(m));
}
export function useMuted(): [boolean, (m: boolean) => void] {
  const [m, setM] = useState(mutedState);
  useEffect(() => {
    const fn = (v: boolean) => setM(v);
    mutedListeners.add(fn);
    return () => {
      mutedListeners.delete(fn);
    };
  }, []);
  return [m, setMuted];
}

// --- Configured state (settings-driven, polled lazily by callers) ---
let configuredCache: boolean | null = null;
let configuredCachedAt = 0;
const CONFIG_TTL_MS = 30_000;

export async function isVoiceConfigured(force = false): Promise<boolean> {
  if (!force && configuredCache !== null && Date.now() - configuredCachedAt < CONFIG_TTL_MS) {
    return configuredCache;
  }
  try {
    const r = await fetch(`${API_BASE}/api/settings`);
    if (!r.ok) {
      configuredCache = false;
    } else {
      const s = await r.json();
      configuredCache = !!(s.elevenLabsKey && s.elevenLabsVoiceId);
    }
  } catch {
    configuredCache = false;
  }
  configuredCachedAt = Date.now();
  return configuredCache;
}

export function invalidateVoiceConfig() {
  configuredCache = null;
  configuredCachedAt = 0;
}

export function useVoiceConfigured(): boolean {
  const [c, setC] = useState(false);
  useEffect(() => {
    let cancelled = false;
    isVoiceConfigured().then((v) => {
      if (!cancelled) setC(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return c;
}

// --- Core speak ---
async function fetchAndPlay(text: string): Promise<void> {
  if (mutedState) return;
  if (!text || !text.trim()) return;
  // Skip if not configured (avoids needless 400s)
  const configured = await isVoiceConfigured();
  if (!configured) return;

  try {
    const res = await fetch(`${API_BASE}/api/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      // Invalidate cache on 400 so we re-check next time settings might have been saved
      if (res.status === 400) invalidateVoiceConfig();
      return;
    }
    const blob = await res.blob();
    if (mutedState) return; // muted while fetching
    const url = URL.createObjectURL(blob);
    await new Promise<void>((resolve) => {
      const audio = new Audio(url);
      currentAudio = audio;
      const cleanup = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        resolve();
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      audio.play().catch(() => cleanup());
    });
  } catch {
    // Silent failure: text-only mode.
  }
}

// Public: enqueue a line; resolves when its audio finishes (or skipped).
export function speak(text: string): Promise<void> {
  const job = queue.then(() => fetchAndPlay(text));
  queue = job.catch(() => {});
  return job;
}

// Public: speak many lines in order. Each line is also revealed via the timing
// the caller chooses (we just play; UI handles bubble reveals).
export async function speakSequence(lines: string[]): Promise<void> {
  for (const l of lines) {
    if (mutedState) return;
    await speak(l);
  }
}

// One-shot test (used by Settings test button). Returns ok/error.
export async function testVoice(text = "Hi — I'm Morgan. Looks like we're set up."): Promise<{ ok: boolean; error?: string }> {
  invalidateVoiceConfig();
  if (mutedState) return { ok: false, error: "muted" };
  try {
    const res = await fetch(`${API_BASE}/api/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = j.error || j.detail || `HTTP ${res.status}`;
      } catch {
        detail = `HTTP ${res.status}`;
      }
      return { ok: false, error: detail };
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    await new Promise<void>((resolve) => {
      const audio = new Audio(url);
      currentAudio = audio;
      audio.onended = audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        resolve();
      };
      audio.play().catch(() => resolve());
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// Stop any in-flight audio and clear the queue.
export function stopVoice() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
    currentAudio = null;
  }
  queue = Promise.resolve();
}
