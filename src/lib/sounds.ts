let sharedCtx: AudioContext | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AC();
  }
  return sharedCtx;
}

async function unlockCtx(ctx: AudioContext) {
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
}

function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
  gain = 0.08,
  type: OscillatorType = "sine"
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** Call from a user gesture (click), ideally before any await. */
export function playTaskCompleteTone() {
  try {
    const ctx = getCtx();
    if (!ctx) return;

    const play = () => {
      const t0 = ctx.currentTime;
      // C5 → E5 → G5 → C6
      tone(ctx, 523.25, t0, 0.25, 0.09);
      tone(ctx, 659.25, t0 + 0.11, 0.25, 0.08);
      tone(ctx, 783.99, t0 + 0.22, 0.3, 0.07);
      tone(ctx, 1046.5, t0 + 0.36, 0.5, 0.06);
    };

    if (ctx.state === "suspended") {
      void ctx.resume().then(play).catch(() => undefined);
    } else {
      play();
    }
  } catch {
    /* ignore autoplay / AudioContext errors */
  }
}

export function playPhaseChime(muted = false) {
  if (muted) return;
  try {
    const ctx = getCtx();
    if (!ctx) return;
    const play = () => {
      const t0 = ctx.currentTime;
      tone(ctx, 880, t0, 0.2, 0.07);
    };
    if (ctx.state === "suspended") {
      void ctx.resume().then(play).catch(() => undefined);
    } else {
      play();
    }
  } catch {
    /* ignore */
  }
}

/** Call once on first UI interaction to unlock audio for later tones. */
export function unlockAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  void unlockCtx(ctx);
}
