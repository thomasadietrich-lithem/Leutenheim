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
  | "heal"
  | "bow"
  | "knock"
  | "key"
  | "pickup"
  | "advantage"
  | "disadvantage"
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

  private crackleDebt = 0;

  /**
   * Crépitement des torches, à appeler à chaque image. `level` (0 à 1) est l'éclairage reçu par le héros :
   * plus il est près d'une torche, plus les crépitements sont forts et nombreux.
   */
  crackle(level: number, dt: number): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== "running" || level <= 0.03) return;
    // Rare et discret : quelques petits craquements sourds par seconde, jamais un grésillement continu.
    this.crackleDebt += dt * 0.0022 * (0.3 + level) * (0.4 + 1.2 * Math.random());
    while (this.crackleDebt >= 1) {
      this.crackleDebt -= 1;
      try {
        this.noise(0.03 + Math.random() * 0.05, (0.006 + Math.random() * 0.018) * level, 700 + Math.random() * 1300, Math.random() * 0.08);
      } catch {
        return;
      }
    }
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
        case "hit": // la lame entaille : choc sourd + éclat métallique bref
          this.noise(0.05, 0.22, 2600);
          this.tone(190, 70, 0.12, "triangle", 0.28);
          this.tone(1700, 1250, 0.07, "triangle", 0.06, 0.01);
          break;
        case "miss": // la lame fend l'air
          this.noise(0.07, 0.05, 1400);
          this.noise(0.1, 0.09, 3200, 0.04);
          break;
        case "crit": // coup lourd, puis tintement
          this.noise(0.08, 0.3, 2800);
          this.tone(170, 45, 0.22, "triangle", 0.38);
          this.tone(1320, 1320, 0.25, "sine", 0.12, 0.04);
          this.tone(1980, 1980, 0.3, "sine", 0.07, 0.06);
          break;
        case "hurt": // le héros encaisse : impact mat et grave
          this.noise(0.06, 0.2, 700);
          this.tone(150, 60, 0.18, "sawtooth", 0.14);
          this.tone(90, 55, 0.2, "sine", 0.2, 0.02);
          break;
        case "kill": // le monstre s'effondre
          this.tone(260, 60, 0.28, "sawtooth", 0.1);
          this.noise(0.16, 0.14, 450, 0.12);
          break;
        case "death":
          [330, 262, 196, 131].forEach((f, i) => this.tone(f, f * 0.97, 0.3, "triangle", 0.2, i * 0.18));
          break;
        case "notice":
          this.tone(520, 880, 0.09, "square", 0.07);
          break;
        case "door": // bois : le battant qui grince, puis le loquet
          this.noise(0.07, 0.16, 320);
          this.tone(150, 215, 0.17, "triangle", 0.045, 0.03);
          this.noise(0.025, 0.1, 1800, 0.21);
          break;
        case "key": // la clef entre, deux crans tournent, le pêne claque
          this.noise(0.03, 0.22, 3200);
          this.tone(950, 720, 0.03, "square", 0.05, 0.07);
          this.noise(0.04, 0.3, 1900, 0.17);
          this.tone(520, 430, 0.03, "square", 0.05, 0.17);
          this.noise(0.04, 0.3, 1600, 0.29);
          this.tone(470, 380, 0.03, "square", 0.05, 0.29);
          this.tone(190, 85, 0.1, "sine", 0.32, 0.43);
          this.noise(0.09, 0.28, 650, 0.43);
          break;
        case "unlock":
          this.tone(1200, 1200, 0.03, "square", 0.08);
          this.tone(1600, 1600, 0.04, "square", 0.08, 0.09);
          break;
        case "break": // le fracas, puis l'écho qui roule dans les couloirs
          this.noise(0.35, 0.5, 1400);
          this.tone(130, 38, 0.3, "square", 0.25);
          this.noise(0.3, 0.2, 500, 0.22);
          this.noise(0.4, 0.1, 300, 0.5);
          break;
        case "thud": // coup d'épaule : la porte tient, mais ça résonne
          this.noise(0.18, 0.4, 500);
          this.tone(100, 45, 0.16, "sine", 0.32);
          this.noise(0.3, 0.12, 280, 0.2);
          this.noise(0.35, 0.06, 220, 0.45);
          break;
        case "bow":
          this.tone(420, 180, 0.09, "triangle", 0.14);
          this.noise(0.08, 0.06, 3000, 0.02);
          break;
        case "knock":
          this.noise(0.06, 0.16, 380);
          this.tone(95, 70, 0.07, "sine", 0.12);
          break;
        case "advantage": // deux notes claires qui montent : la chance est de votre côté
          this.tone(784, 784, 0.09, "sine", 0.13);
          this.tone(1175, 1175, 0.16, "sine", 0.13, 0.08);
          break;
        case "disadvantage": // deux notes sourdes qui descendent
          this.tone(330, 330, 0.1, "triangle", 0.12);
          this.tone(233, 233, 0.18, "triangle", 0.12, 0.09);
          break;
        case "pickup":
          this.tone(660, 990, 0.07, "sine", 0.1);
          break;
        case "descend":
          [392, 330, 262].forEach((f, i) => this.tone(f, f, 0.12, "sine", 0.15, i * 0.09));
          break;
        case "heal":
          [523, 659, 784].forEach((f, i) => this.tone(f, f, 0.18, "sine", 0.12, i * 0.08));
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
