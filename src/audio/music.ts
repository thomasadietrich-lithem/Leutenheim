/**
 * Musique « Crypte » (Thomas, 2026-11-12 : « j'aime la crypte », « implémente » ; maquette `art/audio/musique_v3.py`).
 * Fabriquée en direct, sans fichier, sans fin : en ré mineur, mesure par mesure. Elle se tend avec le NIVEAU D'ALERTE de
 * l'étage (calme 72, agité 84, alerte 100, traque 120 battements par minute) ; le changement se fait à la mesure suivante.
 * Le réglage « Musique » des Paramètres la coupe.
 */

const PROG = [
  [50, 53, 57],
  [46, 50, 53],
  [48, 52, 55],
  [45, 49, 52],
];
const MELODY = [74, 72, 69, 70, 69, 65, 67, 69, 74, 77, 76, 74, 73, 69, 70, 69];
const BPM = [72, 84, 100, 120];
/** Volume général de la musique (sous les bruitages). */
const VOLUME = 0.22;

const hz = (n: number) => 440 * 2 ** ((n - 69) / 12);

export class Music {
  enabled = true;
  /** Palier voulu (0 calme … 3 traque) ; il prend effet à la mesure suivante. */
  stage = 0;
  private out: GainNode | null = null;
  private wet: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private nextBar = 0;
  private bar = 0;
  private playing = false;

  constructor(private readonly getContext: () => AudioContext | null) {}

  /** À appeler à chaque image : prépare les mesures un peu à l'avance ; coupe en douceur si la musique est désactivée. */
  update(): void {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== "running") return;
    if (!this.out) this.build(ctx);
    const out = this.out!;
    const now = ctx.currentTime;
    if (!this.enabled) {
      if (this.playing) {
        out.gain.cancelScheduledValues(now);
        out.gain.setTargetAtTime(0, now, 0.4);
        this.playing = false;
      }
      return;
    }
    if (!this.playing) {
      this.playing = true;
      out.gain.cancelScheduledValues(now);
      out.gain.setTargetAtTime(VOLUME, now, 1.2);
      this.nextBar = Math.max(this.nextBar, now + 0.1);
    }
    // Une mesure à la fois, préparée au plus 0,4 s avant qu'elle ne commence.
    while (this.nextBar < now + 0.4) {
      const length = this.playBar(ctx, this.nextBar, this.stage);
      this.nextBar += length;
      this.bar++;
    }
  }

  /** Réverbération de cave (quelques échos filtrés) et sortie. */
  private build(ctx: AudioContext): void {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(ctx.destination);
    this.wet = ctx.createGain();
    this.wet.gain.value = 1;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2500;
    this.wet.connect(this.out);
    for (const [delay, g] of [
      [0.083, 0.25],
      [0.137, 0.18],
      [0.211, 0.12],
      [0.31, 0.08],
    ]) {
      const d = ctx.createDelay(1);
      d.delayTime.value = delay;
      const gain = ctx.createGain();
      gain.gain.value = g;
      this.wet.connect(d).connect(gain).connect(tone);
    }
    tone.connect(this.out);
    const length = Math.floor(ctx.sampleRate * 0.3);
    this.noiseBuf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Une note : oscillateur, enveloppe (attaque, maintien, relâche), filtre éventuel. */
  private note(ctx: AudioContext, t: number, freq: number, dur: number, type: OscillatorType, vol: number, attack = 0.01, release = 0.2, cutoff = 0, detune = 0): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur));
    g.gain.linearRampToValueAtTime(0, t + dur + release);
    let node: AudioNode = osc;
    if (cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = cutoff;
      node = node.connect(f);
    }
    node.connect(g).connect(this.wet!);
    osc.start(t);
    osc.stop(t + dur + release + 0.05);
  }

  private kick(ctx: AudioContext, t: number, vol: number): void {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g).connect(this.wet!);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  private tick(ctx: AudioContext, t: number, vol: number): void {
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f).connect(g).connect(this.wet!);
    src.start(t);
    src.stop(t + 0.06);
  }

  private tom(ctx: AudioContext, t: number, freq: number, vol: number): void {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq * 0.9, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g).connect(this.wet!);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  /** Joue une mesure (4 temps) à partir de `t0` ; renvoie sa durée. Mêmes couches que la maquette v3. */
  private playBar(ctx: AudioContext, t0: number, stage: number): number {
    const beat = 60 / BPM[stage];
    const bar = this.bar;
    const chord = PROG[bar % 4];
    // Nappe sombre (trois scies filtrées) et bourdon grave de ré : toujours.
    for (const n of chord) this.note(ctx, t0, hz(n), 4 * beat, "sawtooth", 0.05, 0.6, 0.8, 500 + Math.min(stage, 2) * 400, (n % 3) * 4);
    this.note(ctx, t0, hz(38), 4 * beat, "sine", 0.2, 0.3, 0.5);
    if (stage <= 1) {
      // Calme : une note sur deux temps ; agité : une par temps.
      const step = stage === 0 ? 2 : 1;
      for (let k = 0; k < 4 / step; k++) {
        if (stage === 0 && k % 2) continue;
        const note = MELODY[(bar * (4 / step) + k) % MELODY.length];
        this.note(ctx, t0 + k * step * beat, hz(note), step * beat * 0.9, "triangle", 0.1, 0.005, 0.4);
      }
      if (stage === 1) {
        for (let k = 0; k < 4; k++) this.note(ctx, t0 + k * beat, hz(chord[0] - 12), beat * 0.8, "sawtooth", 0.12, 0.01, 0.1, 700);
        this.kick(ctx, t0, 0.5);
        this.kick(ctx, t0 + 2 * beat, 0.5);
        this.kick(ctx, t0 + 0.35 * beat, 0.2);
      }
      return 4 * beat;
    }
    // Alerte et traque, allégés (Thomas : « trop dense ») : la mélodie à la noire (une mesure sur deux en alerte).
    if (stage === 3 || bar % 2 === 0) {
      for (let k = 0; k < 4; k++) this.note(ctx, t0 + k * beat, hz(MELODY[(bar * 4 + k) % MELODY.length]), beat * 0.85, "triangle", 0.1, 0.005, 0.35);
    }
    if (stage === 2) {
      for (let k = 0; k < 4; k++) {
        this.note(ctx, t0 + k * beat, hz(chord[0] - 12), beat * 0.8, "sawtooth", 0.11, 0.01, 0.1, 650);
        this.tick(ctx, t0 + (k + 0.5) * beat, 0.05);
      }
      this.kick(ctx, t0, 0.5);
      this.kick(ctx, t0 + 2 * beat, 0.5);
      this.kick(ctx, t0 + 2.35 * beat, 0.25);
      if (bar % 2 === 1) this.note(ctx, t0 + 2.5 * beat, hz(63), beat * 1.5, "triangle", 0.06, 0.05, 0.3);
    } else {
      for (let k = 0; k < 8; k++) this.note(ctx, t0 + (k * beat) / 2, hz(chord[0] - 12), beat * 0.4, "sawtooth", 0.1, 0.005, 0.05, 600);
      for (let k = 0; k < 4; k++) {
        this.kick(ctx, t0 + k * beat, 0.45);
        this.tick(ctx, t0 + (k + 0.5) * beat, 0.045);
      }
      if (bar % 4 === 3) [150, 130, 115, 100].forEach((f, j) => this.tom(ctx, t0 + (3 + j / 4) * beat, f, 0.22));
    }
    return 4 * beat;
  }
}
