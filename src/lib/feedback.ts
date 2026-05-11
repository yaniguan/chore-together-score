// Tiny haptic + click sound utilities. Both honor a user-toggleable
// preference stored in localStorage. Default both on.

const HAPTIC_KEY = 'homepace_haptic_enabled';
const SOUND_KEY = 'homepace_sound_enabled';

const readFlag = (key: string): boolean => {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return true;
  return raw === '1';
};

const writeFlag = (key: string, value: boolean) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value ? '1' : '0');
};

export const getHapticEnabled = () => readFlag(HAPTIC_KEY);
export const getSoundEnabled = () => readFlag(SOUND_KEY);
export const setHapticEnabled = (v: boolean) => writeFlag(HAPTIC_KEY, v);
export const setSoundEnabled = (v: boolean) => writeFlag(SOUND_KEY, v);

export const haptic = (ms: number = 30) => {
  if (!getHapticEnabled()) return;
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try { navigator.vibrate(ms); } catch { /* ignore */ }
};

// Web Audio "click" — short blip generated on the fly so no asset to ship.
// Re-uses one AudioContext between calls; first call may need a user gesture
// (which task completion always is).
let audioCtx: AudioContext | null = null;
export const playClick = () => {
  if (!getSoundEnabled()) return;
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.09);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } catch {
    /* ignore — older browsers without Web Audio */
  }
};
