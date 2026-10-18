// Vibration with different strengths per moment. Silently does nothing where unsupported (e.g. iOS Safari).
const PATTERNS = {
  tick: 6,               // tiny: each pickup
  pick_heavy: 18,        // chest / driftwood
  combo: [6, 30, 8],
  full: [12, 40, 12],
  wet: 10,
  heartbeat: [22, 90, 14],
  bell: [30, 60, 30],
  arrive: [25, 40, 25, 40, 70],
  close_call: [40, 30, 40, 30, 120],
  swept: [90, 50, 160],
  build: [30, 50, 50, 50, 90],
  ui: 5,
};

const H = { enabled: true, supported: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function', last: 0 };
export const haptics = H;

export function setHaptics(on) { H.enabled = !!on; if (!on) stopHaptics(); }

export function buzz(kind) {
  if (!H.enabled || !H.supported) return;
  // browsers refuse (and log) vibration before the first tap on the page
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  const now = performance.now();
  // never queue faster than the motor can render distinct pulses
  if (kind === 'tick' && now - H.last < 45) return;
  H.last = now;
  const p = PATTERNS[kind];
  if (p === undefined) return;
  try { navigator.vibrate(p); } catch (_) { H.supported = false; }
}

export function stopHaptics() {
  if (!H.supported) return;
  try { navigator.vibrate(0); } catch (_) { /* ignore */ }
}
