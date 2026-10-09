/**
 * Procedural sound (Web Audio): no audio files, so nothing to download or license.
 *
 *   Synth        one shared AudioContext behind a master gain. Muted by default; `enable()` must be
 *                called from a user gesture (browsers refuse to start audio otherwise). Every method
 *                is a safe no-op when audio is unsupported or off (jsdom, old browsers, muted).
 *   Engine voice a continuous engine hum plus tyre / gravel noise driven by speed (used by Drive mode).
 *   one-shots    tick, chime, blip, whoosh, thud.
 */

/** Engine pitch for a speed in 0…1: it rises through four "gears", dropping a little at each shift. */
export function engineFreq(speed01: number): number {
  const s = Math.min(1, Math.max(0, speed01)) * 4;
  const gear = Math.min(3, Math.floor(s));
  return 46 + gear * 9 + (s - gear) * 58;
}

type AudioCtor = typeof AudioContext;
const getCtor = (): AudioCtor | null =>
  typeof window === "undefined" ? null : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext ?? null);

export class EngineVoice {
  private nodes: { stop(): void; saw: OscillatorNode; sub: OscillatorNode; lp: BiquadFilterNode; body: GainNode; hiss: GainNode; hissF: BiquadFilterNode } | null = null;

  constructor(private readonly synth: Synth) {}

  start() {
    const ctx = this.synth.context;
    const out = this.synth.output;
    if (!ctx || !out || this.nodes) return;
    const saw = ctx.createOscillator();
    saw.type = "sawtooth";
    const sub = ctx.createOscillator();
    sub.type = "sine";
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 300;
    const body = ctx.createGain();
    body.gain.value = 0;
    saw.connect(lp);
    sub.connect(lp);
    lp.connect(body).connect(out);

    // Tyre hiss / gravel rumble from looped noise.
    const noise = ctx.createBufferSource();
    noise.buffer = this.synth.noise();
    noise.loop = true;
    const hissF = ctx.createBiquadFilter();
    hissF.type = "bandpass";
    hissF.frequency.value = 700;
    const hiss = ctx.createGain();
    hiss.gain.value = 0;
    noise.connect(hissF).connect(hiss).connect(out);

    saw.start();
    sub.start();
    noise.start();
    this.nodes = {
      saw,
      sub,
      lp,
      body,
      hiss,
      hissF,
      stop: () => {
        for (const n of [saw, sub, noise]) {
          try {
            n.stop();
          } catch {
            /* already stopped */
          }
        }
        for (const n of [saw, sub, lp, body, noise, hissF, hiss]) n.disconnect();
      },
    };
  }

  /** Update from the game: speed 0…1, whether boosting, whether on gravel. Smoothed, so ~10 calls/s is plenty. */
  set(speed01: number, boosting: boolean, offRoad: boolean, idle = false) {
    const ctx = this.synth.context;
    const n = this.nodes;
    if (!ctx || !n) return;
    const t = ctx.currentTime;
    const f = engineFreq(speed01) * (boosting ? 1.12 : 1);
    n.saw.frequency.setTargetAtTime(f, t, 0.06);
    n.sub.frequency.setTargetAtTime(f / 2, t, 0.06);
    n.lp.frequency.setTargetAtTime(260 + speed01 * 1100 + (boosting ? 500 : 0), t, 0.08);
    n.body.gain.setTargetAtTime(idle ? 0.035 : 0.075 + speed01 * 0.05, t, 0.1);
    n.hissF.frequency.setTargetAtTime(offRoad ? 380 : 700 + speed01 * 900, t, 0.1);
    n.hiss.gain.setTargetAtTime(idle ? 0 : (offRoad ? 0.1 : 0.012 + speed01 * 0.05) * (boosting ? 1.4 : 1), t, 0.1);
  }

  stop() {
    this.nodes?.stop();
    this.nodes = null;
  }
}

export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private on = false;
  readonly engine = new EngineVoice(this);

  get supported(): boolean {
    return getCtor() !== null;
  }
  get enabled(): boolean {
    return this.on;
  }
  get context(): AudioContext | null {
    return this.on ? this.ctx : null;
  }
  get output(): GainNode | null {
    return this.on ? this.master : null;
  }

  /** Turn sound on. Call from a click / key handler. Returns false if audio isn't available. */
  enable(): boolean {
    const Ctor = getCtor();
    if (!Ctor) return false;
    try {
      if (!this.ctx) {
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.ctx.destination);
      }
      void this.ctx.resume();
      this.master!.gain.setTargetAtTime(0.7, this.ctx.currentTime, 0.04);
      this.on = true;
      return true;
    } catch {
      return false;
    }
  }

  disable() {
    this.on = false;
    this.engine.stop();
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      const ctx = this.ctx;
      window.setTimeout(() => !this.on && void ctx.suspend(), 250); // stop burning CPU while muted
    }
  }

  /** Pause / resume with the tab so a hidden page is silent. */
  setHidden(hidden: boolean) {
    if (!this.ctx || !this.on) return;
    void (hidden ? this.ctx.suspend() : this.ctx.resume());
  }

  noise(): AudioBuffer {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = "sine", slideTo?: number, delay = 0) {
    const ctx = this.context;
    const out = this.output;
    if (!ctx || !out) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(dur: number, gain: number, from: number, to: number) {
    const ctx = this.context;
    const out = this.output;
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** Small UI click. */
  tick() {
    this.tone(1400, 0.035, 0.07, "square");
  }
  /** A gate comes into view. */
  blip() {
    this.tone(880, 0.09, 0.08, "triangle");
  }
  /** Arrived at a gate: two rising notes. */
  chime() {
    this.tone(660, 0.18, 0.12, "triangle");
    this.tone(990, 0.3, 0.1, "triangle", undefined, 0.11);
  }
  /** Engine start: a quick rev. */
  ignite() {
    this.tone(60, 0.5, 0.14, "sawtooth", 150);
  }
  /** Boost pad. */
  whoosh() {
    this.burst(0.6, 0.18, 400, 3200);
  }
  /** Guard rail or car. */
  thud() {
    this.tone(120, 0.28, 0.25, "sine", 40);
    this.burst(0.18, 0.12, 900, 200);
  }
}

/** The one shared instance. */
export const sound = new Synth();
