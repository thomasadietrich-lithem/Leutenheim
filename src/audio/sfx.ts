/** Sons synthétisés (aucun fichier audio) : de simples bips et souffles, faciles à remplacer plus tard. */
export type SoundName =
  | "step"
  | "dice"
  | "hit"
  | "miss"
  | "crit"
  | "hurt"
  | "kill"
  | "death"
  | "notice"
  | "door"
  | "unlock"
  | "break"
  | "thud"
  | "descend"
  | "click";

type Wave = OscillatorType;

export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;

  /** À appeler depuis un geste du joueur (toucher, clic) : les navigateurs n'autorisent le son qu'ainsi. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      this.ctx = null; // pas de son disponible : le jeu continue sans
    }
  }

  private tone(from: number, to: number, duration: number, wave: Wave, volume: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private noise(duration: number, volume: number, cutoff: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  play(name: SoundName): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== "running") return;
    try {
      switch (name) {
        case "step":
          this.noise(0.04, 0.05, 700);
          break;
        case "dice": // le dé qui roule : une série de petits chocs
          for (let i = 0; i < 6; i++) this.noise(0.03, 0.12, 2400 - i * 150, i * 0.06);
          break;
        case "hit":
          this.tone(170, 60, 0.13, "triangle", 0.3);
          this.noise(0.06, 0.15, 1500);
          break;
        case "miss":
          this.noise(0.14, 0.1, 900);
          break;
        case "crit":
          this.tone(170, 50, 0.18, "triangle", 0.35);
          this.tone(880, 1320, 0.22, "sine", 0.18, 0.03);
          break;
        case "hurt":
          this.tone(230, 90, 0.16, "square", 0.12);
          break;
        case "kill":
          this.tone(300, 80, 0.2, "sawtooth", 0.1);
          break;
        case "death":
          [330, 262, 196, 131].forEach((f, i) => this.tone(f, f * 0.97, 0.3, "triangle", 0.2, i * 0.18));
          break;
        case "notice":
          this.tone(520, 880, 0.09, "square", 0.07);
          break;
        case "door":
          this.tone(110, 75, 0.2, "sawtooth", 0.08);
          break;
        case "unlock":
          this.tone(1200, 1200, 0.03, "square", 0.08);
          this.tone(1600, 1600, 0.04, "square", 0.08, 0.09);
          break;
        case "break":
          this.noise(0.3, 0.4, 1200);
          this.tone(120, 40, 0.25, "square", 0.2);
          break;
        case "thud":
          this.noise(0.15, 0.3, 500);
          this.tone(100, 50, 0.12, "sine", 0.25);
          break;
        case "descend":
          [392, 330, 262].forEach((f, i) => this.tone(f, f, 0.12, "sine", 0.15, i * 0.09));
          break;
        case "click":
          this.tone(700, 700, 0.03, "square", 0.05);
          break;
      }
    } catch {
      /* un son raté ne doit jamais gêner le jeu */
    }
  }
}
