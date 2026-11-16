/**
 * Musique « Harpe et cordes » (Thomas, 2026-11-16 : « implémente C » ; maquette `art/audio/musique_v4.py`, variante C ;
 * remplace la « Crypte » v3, dont la traque tournait en boucle toutes les 8 s).
 * Fabriquée en direct, sans fichier, sans fin : en ré mineur, mesure par mesure, sur une phrase de 16 mesures (accords et
 * mélodie, avec des tenues et des silences). Elle se tend avec le NIVEAU D'ALERTE de l'étage (calme 58, agité 66,
 * alerte 76, traque 88 battements par minute) ; le changement se fait à la mesure suivante. Pas de grosse caisse :
 * c'est l'arpège de harpe qui presse (noires, puis croches), avec une timbale douce.
 * Le réglage « Musique » des Paramètres la coupe.
 */

const DM = [50, 53, 57];
const BB = [46, 50, 53];
const C = [48, 52, 55];
const A = [45, 49, 52];
const GM = [43, 46, 50];
const F = [41, 45, 48];
const PROG = [DM, BB, C, A, DM, GM, BB, A, F, C, GM, DM, BB, GM, A, A];
/** Une case par temps : note, -1 = la note d'avant tient, 0 = silence. */
const MELODY = [
  [74, -1, 72, 69], [70, -1, 69, 65], [67, -1, 69, 72], [73, -1, -1, 0],
  [74, 77, 76, 74], [70, -1, 67, 70], [74, -1, 72, 70], [69, -1, -1, 0],
  [77, -1, 76, 72], [76, -1, 72, 67], [70, -1, 74, 70], [69, -1, -1, 0],
  [65, 70, 74, -1], [67, 70, 79, -1], [76, -1, 73, -1], [69, -1, -1, 0],
];
const BPM = [58, 66, 76, 88];
/** Volume général de la musique (sous les bruitages). Relevé (Thomas : « la musique semble ne pas marcher ») : les
 *  haut-parleurs de téléphone ne rendent presque pas les graves, d'où aussi le bourdon doublé à l'octave. */
const VOLUME = 0.65;

const hz = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** « Le cœur du boss » (Thomas, 2026-11-16 : « implémente la musique boss v4 avec les battements de cœur, pour les deux
 *  boss » ; maquette `art/audio/musique_v4.py boss`) : un cœur donne le tempo, qui suit la vie du boss. */
const BOSS_BPM = [50, 66, 88];
const BOSS_PROG = [DM, BB, GM, A];
const BOSS_THEME = [62, 60, 57, 58, 57, 53, 55, 57];

export class Music {
  enabled = true;
  /** Palier voulu (0 calme … 3 traque) ; il prend effet à la mesure suivante. */
  stage = 0;
  /** Combat de boss en cours : sa phase (0 intact, 1 sous les deux tiers, 2 sous le tiers), sinon null. */
  boss: 0 | 1 | 2 | null = null;
  /** Le boss vient de mourir : la mesure suivante joue sa fin (le cœur s'arrête, puis l'accord majeur et la cloche). */
  private deathPending = false;
  bossDied(): void {
    this.deathPending = true;
  }
  private out: GainNode | null = null;
  private wet: GainNode | null = null;
  private harp: PeriodicWave | null = null;
  private nextBar = 0;
  private bar = 0;
  private playing = false;

  constructor(private readonly getContext: () => AudioContext | null) {}

  /** Volume de la musique (mélangeur à 5 niveaux) : 1 = le volume d'origine. */
  private level = 1;
  setVolume(v: number): void {
    this.level = v;
    const ctx = this.getContext();
    if (ctx && this.out && this.playing) {
      this.out.gain.cancelScheduledValues(ctx.currentTime);
      this.out.gain.setTargetAtTime(VOLUME * v, ctx.currentTime, 0.1);
    }
  }

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
      out.gain.setTargetAtTime(VOLUME * this.level, now, 1.2);
      this.nextBar = Math.max(this.nextBar, now + 0.1);
    }
    // Une mesure à la fois, préparée au plus 0,4 s avant qu'elle ne commence.
    while (this.nextBar < now + 0.4) {
      let length: number;
      if (this.deathPending) {
        this.deathPending = false;
        length = this.playBossDeath(ctx, this.nextBar);
      } else if (this.boss !== null) length = this.playBossBar(ctx, this.nextBar, this.boss);
      else length = this.playBar(ctx, this.nextBar, this.stage);
      this.nextBar += length;
      this.bar++;
    }
  }

  /** Écho de voûte (quatre échos qui se répètent en s'éteignant, filtrés) et sortie. */
  private build(ctx: AudioContext): void {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(ctx.destination);
    this.wet = ctx.createGain();
    this.wet.gain.value = 1;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 1800;
    const send = ctx.createGain();
    send.gain.value = 0.09;
    this.wet.connect(this.out);
    for (const [delay, feedback] of [
      [0.0297, 0.78],
      [0.0371, 0.76],
      [0.0411, 0.74],
      [0.0437, 0.72],
    ]) {
      const d = ctx.createDelay(0.1);
      d.delayTime.value = delay;
      const fb = ctx.createGain();
      fb.gain.value = feedback;
      this.wet.connect(d);
      d.connect(fb).connect(d);
      d.connect(tone);
    }
    tone.connect(send).connect(this.out);
    // Timbre de corde pincée : le fondamental et quatre harmoniques de plus en plus faibles.
    this.harp = ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.5, 0.25, 0.12, 0.06]));
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

  /** Une corde pincée : attaque franche, le son s'éteint tout seul et s'assourdit en s'éteignant. */
  private pluck(ctx: AudioContext, t: number, freq: number, dur: number, vol: number, fade = 0.75): void {
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.harp!);
    osc.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(Math.min(freq * 6, 9000), t);
    f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * Math.exp(-dur / fade)), t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.4);
    osc.connect(f).connect(g).connect(this.wet!);
    osc.start(t);
    osc.stop(t + dur + 0.45);
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

  /** Un battement de cœur feutré (« poum ») : une sinusoïde grave qui tombe vite. */
  private heart(ctx: AudioContext, t: number, vol: number): void {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(62, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g).connect(this.out!);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  /** Cloche grave : quelques partiels inharmoniques qui s'éteignent lentement. */
  private bellTone(ctx: AudioContext, t: number, freq: number, vol: number): void {
    for (const [ratio, g, decay] of [[1, 1, 3.5], [2.0, 0.5, 2.5], [2.76, 0.35, 1.8], [5.4, 0.15, 1.0]]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq * ratio;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol * g, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + decay);
      osc.connect(gain).connect(this.wet!);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    }
  }

  /** Une mesure du combat de boss : nappe, bourdon, le cœur sur chaque temps (« poum-poum »), le thème au violoncelle ;
   *  la harpe répond dès la 2e phase ; la cloche en 3e phase. */
  private playBossBar(ctx: AudioContext, t0: number, phase: 0 | 1 | 2): number {
    const beat = 60 / BOSS_BPM[phase];
    const chord = BOSS_PROG[this.bar % 4];
    for (const n of chord) {
      this.note(ctx, t0, hz(n), 4 * beat, "sawtooth", 0.026, 1.0, 1.2, 1000 + phase * 150, 0);
      this.note(ctx, t0, hz(n), 4 * beat, "sawtooth", 0.026, 1.0, 1.2, 1000 + phase * 150, 10);
    }
    this.note(ctx, t0, hz(38), 4 * beat, "sine", 0.16, 0.3, 0.5);
    for (let k = 0; k < 4; k++) {
      this.heart(ctx, t0 + k * beat, 0.55);
      this.heart(ctx, t0 + k * beat + Math.min(0.3, beat * 0.36), 0.32);
    }
    const n = BOSS_THEME[this.bar % 8] + (phase === 2 ? 12 : 0);
    this.note(ctx, t0, hz(n), 3.6 * beat, "sawtooth", 0.07, 0.25, 0.6, 900, 5);
    if (phase >= 1) {
      const arp = [chord[0], chord[2], chord[1] + 12, chord[2]];
      for (let k = 0; k < 4 * phase; k++) this.pluck(ctx, t0 + (k * beat) / phase, hz(arp[k % 4] + 12), beat / phase + 0.5, 0.07, 0.6);
    }
    if (phase === 2 && this.bar % 4 === 0) this.bellTone(ctx, t0, hz(50), 0.08);
    return 4 * beat;
  }

  /** La mort du boss : deux battements qui ralentissent, un demi-coup, le silence, puis la lumière (ré majeur, cloche). */
  private playBossDeath(ctx: AudioContext, t0: number): number {
    for (const [t, g] of [[0, 0.55], [0.3, 0.32], [1.1, 0.45], [1.45, 0.26], [2.7, 0.32]]) this.heart(ctx, t0 + t, g);
    const major = [50, 57, 62, 66, 69, 74, 78];
    major.forEach((m, i) => this.pluck(ctx, t0 + 5.2 + i * 0.09, hz(m), 5, 0.12, 1.6));
    for (const m of [50, 54, 57]) this.note(ctx, t0 + 5.2, hz(m), 5, "sawtooth", 0.03, 1.2, 2, 1200, 6);
    this.bellTone(ctx, t0 + 5.2, hz(62), 0.08);
    return 11;
  }

  /** Joue une mesure (4 temps) à partir de `t0` ; renvoie sa durée. Mêmes couches que la maquette v4 C. */
  private playBar(ctx: AudioContext, t0: number, stage: number): number {
    const beat = 60 / BPM[stage];
    const chord = PROG[this.bar % 16];
    const cells = MELODY[this.bar % 16];
    // Nappe de cordes (scies désaccordées, filtrées, qui enflent lentement) et bourdon grave de ré : toujours.
    const cutoff = 1100 + stage * 150;
    for (const n of chord) {
      this.note(ctx, t0, hz(n), 4 * beat, "sawtooth", 0.028, 1.0, 1.2, cutoff, 0);
      this.note(ctx, t0, hz(n), 4 * beat, "sawtooth", 0.028, 1.0, 1.2, cutoff, 10);
      this.note(ctx, t0, hz(n + 12), 4 * beat, "sawtooth", 0.012, 1.4, 1.2, cutoff, 8);
    }
    this.note(ctx, t0, hz(38), 4 * beat, "sine", 0.16, 0.3, 0.5);
    this.note(ctx, t0, hz(50), 4 * beat, "triangle", 0.05, 0.3, 0.5);
    // Mélodie pincée : calme = la première note de la mesure ; agité = temps 1 et 3 ; alerte et traque = la phrase.
    const slots = stage === 0 ? [0] : stage === 1 ? [0, 2] : [0, 1, 2, 3];
    for (const k of slots) {
      if (cells[k] <= 0) continue;
      let length = 1;
      while (k + length < 4 && cells[k + length] === -1) length++;
      if (stage === 0) length = 3;
      else if (stage === 1) length = Math.max(length, k === 0 ? 2 : 1.5);
      const dur = length * beat + 0.6;
      this.pluck(ctx, t0 + k * beat, hz(cells[k]), dur, 0.16);
      // Traque : une deuxième voix en dessous sur le premier temps (de l'harmonie, pas de la vitesse).
      if (stage === 3 && k === 0) {
        const sixth = cells[k] - 9;
        const fits = chord.some((n) => (sixth - n) % 12 === 0);
        this.pluck(ctx, t0, hz(fits ? sixth : cells[k] - 12), dur, 0.08);
      }
    }
    // Arpège de harpe : à la noire, puis en croches quand l'alerte monte.
    const arp = [chord[0], chord[2], chord[1] + 12, chord[2]];
    const div = stage < 2 ? 1 : 2;
    for (let k = 0; k < 4 * div; k++) {
      if (stage === 0 && k % 2) continue;
      const n = arp[k % 4] + (div === 2 && Math.floor(k / 4) % 2 ? 12 : 0);
      this.pluck(ctx, t0 + (k * beat) / div, hz(n), beat / div + 0.5, 0.09, 0.6);
    }
    // Basse pincée dès « agité » ; timbale douce en alerte (temps 1) et en traque (temps 1 et 3).
    if (stage >= 1) this.pluck(ctx, t0, hz(chord[0] - 12), 2 * beat, 0.28, 1.2);
    if (stage >= 2) this.tom(ctx, t0, 73, 0.4);
    if (stage === 3) this.tom(ctx, t0 + 2 * beat, 73, 0.4);
    return 4 * beat;
  }
}
