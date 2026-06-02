// ============================================================================
// QUANTIX CORE — Notification Sounds
// Web Audio API — no external audio files required.
// All sounds are synthesised at runtime using oscillators.
// ============================================================================

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

function beep(
  ac: AudioContext,
  freq: number,
  start: number,
  duration: number,
  volume = 0.35,
  type: OscillatorType = 'square',
): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

async function resume(ac: AudioContext): Promise<void> {
  if (ac.state === 'suspended') await ac.resume();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Three urgent ascending beeps — played once then silent. */
export async function playNewOrderSound(): Promise<void> {
  const ac = ctx();
  if (!ac) return;
  try {
    await resume(ac);
    const t = ac.currentTime;
    // First burst
    beep(ac, 880, t + 0.00, 0.12);
    beep(ac, 1100, t + 0.17, 0.12);
    beep(ac, 1320, t + 0.34, 0.18);
    // Second burst after short gap
    beep(ac, 880, t + 0.65, 0.12);
    beep(ac, 1100, t + 0.82, 0.12);
    beep(ac, 1320, t + 0.99, 0.20);
  } catch {
    // Silently ignore — browser may block audio before first user interaction
  }
}

/** Rising two-tone chime — order accepted. */
export async function playOrderAcceptedSound(): Promise<void> {
  const ac = ctx();
  if (!ac) return;
  try {
    await resume(ac);
    const t = ac.currentTime;
    beep(ac, 523, t + 0.00, 0.10, 0.3, 'sine'); // C5
    beep(ac, 659, t + 0.12, 0.10, 0.3, 'sine'); // E5
    beep(ac, 784, t + 0.24, 0.22, 0.3, 'sine'); // G5
  } catch {
    // ignore
  }
}

/** Falling two-tone tone — order cancelled/rejected. */
export async function playOrderCancelledSound(): Promise<void> {
  const ac = ctx();
  if (!ac) return;
  try {
    await resume(ac);
    const t = ac.currentTime;
    beep(ac, 440, t + 0.00, 0.14, 0.3, 'sine'); // A4
    beep(ac, 330, t + 0.20, 0.14, 0.3, 'sine'); // E4
    beep(ac, 220, t + 0.40, 0.24, 0.3, 'sine'); // A3
  } catch {
    // ignore
  }
}
