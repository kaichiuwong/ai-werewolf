
// Simple synthesizer using Web Audio API
const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
let audioCtx: AudioContext | null = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

export const playVoteSound = () => {
  try {
    const ctx = initAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // "Wood block" type sound
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

export const playDeathSound = () => {
  try {
    const ctx = initAudio();
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    // Low dissonant toll
    osc.type = 'triangle';
    osc2.type = 'sawtooth';

    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc2.frequency.setValueAtTime(110, ctx.currentTime); // Tritone-ish

    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 2);
    osc2.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 2);

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);

    osc.start();
    osc2.start();
    osc.stop(ctx.currentTime + 2.5);
    osc2.stop(ctx.currentTime + 2.5);
  } catch (e) {
    console.error("Audio play failed", e);
  }
};
