/** Sons synthétisés (aucun fichier audio) : de simples bips et souffles, faciles à remplacer plus tard. */
export type SoundName =
  | "bell"
  | "cowbell"
  | "gravel"
  | "splash"
  | "puff"
  | "glass"
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
  | "click"
  | "coin"
  | "heavy"
  | "shoulder"
  | "stairStep"
  | "tumble"
  | "flute"
  | "whoosh"
  | "slide"
  | "squeak"
  | "record";

type Wave = OscillatorType;

export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  /** Où en est l'air de flûte (passage d'escalier) : une note par marche. */
  private fluteAt = 0;
  private recordAt = 0;

  /** Le contexte audio (partagé avec la musique), une fois débloqué par un geste du joueur. */
  context(): AudioContext | null {
    return this.ctx;
  }

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

  /** Bruit filtré à bande étroite (passe-bande) : un claquement de bois, une braise qui éclate. */
  private snap(duration: number, volume: number, freq: number, q: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Attaque sèche puis décroissance rapide, directement dans l'onde : un vrai « clac », pas un souffle.
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp((-6 * i) / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  private fireDebt = 0;
  private fireBedDebt = 0;

  /**
   * Feu de cheminée (les torches sont muettes, demande de Thomas), à appeler à chaque image. `level` (0 à 1) :
   * proximité d'une cheminée allumée en vue. Un souffle grave à peine audible, des petits claquements de bois
   * irréguliers, parfois en rafale, et de temps en temps une braise qui éclate plus fort.
   */
  fireplace(level: number, dt: number): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== "running" || level <= 0.02) return;
    try {
      // Le souffle : des nappes graves qui se chevauchent.
      this.fireBedDebt += dt / 450;
      while (this.fireBedDebt >= 1) {
        this.fireBedDebt -= 1;
        this.noise(0.9, 0.012 * level, 260 + Math.random() * 120);
      }
      // Les claquements : environ 4 à 7 par seconde près du feu, par petites rafales.
      this.fireDebt += dt * 0.0055 * level * (0.3 + 1.4 * Math.random());
      while (this.fireDebt >= 1) {
        this.fireDebt -= 1;
        const burst = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 3) : 1;
        for (let k = 0; k < burst; k++) {
          const delay = k * (0.015 + Math.random() * 0.05);
          this.snap(0.008 + Math.random() * 0.02, (0.05 + Math.random() * 0.12) * level, 1800 + Math.random() * 3500, 1.5 + Math.random() * 3, delay);
        }
        // Une braise qui éclate, plus grave et plus forte.
        if (Math.random() < 0.06) this.snap(0.05, 0.22 * level, 500 + Math.random() * 400, 1.2, Math.random() * 0.1);
      }
    } catch {
      return;
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
        case "heavy": // arme lourde : choc grave et long, éclat de métal plus sourd
          this.noise(0.09, 0.3, 1500);
          this.tone(120, 40, 0.26, "triangle", 0.4);
          this.tone(900, 700, 0.12, "triangle", 0.07, 0.02);
          break;
        case "thud": // assommé : un « bong » mat
          this.tone(110, 70, 0.3, "sine", 0.3);
          this.tone(660, 640, 0.35, "sine", 0.06, 0.03);
          break;
        case "stairStep": // un pas sur une marche de pierre, avec le cliquetis de l'équipement
          this.noise(0.04, 0.09, 600);
          this.noise(0.03, 0.03, 4200, 0.02);
          break;
        case "flute": { // le héros joue de la flûte dans l'escalier : une petite mélodie, une note par marche
          const tune = [784, 880, 988, 880, 784, 659, 587, 659, 784];
          const f = tune[this.fluteAt++ % tune.length];
          this.tone(f, f * 1.01, 0.2, "sine", 0.13);
          this.tone(f * 2, f * 2, 0.12, "sine", 0.025, 0.01);
          break;
        }
        case "record": { // le tourne-disque de la salle de bain : une note douce et grave, un peu de craquement
          const tune = [392, 440, 494, 440, 392, 330, 294, 330, 392, 494, 523, 494];
          const f = tune[this.recordAt++ % tune.length];
          this.tone(f, f, 0.5, "triangle", 0.05);
          this.tone(f / 2, f / 2, 0.6, "sine", 0.04);
          this.noise(0.05, 0.012, 3000);
          break;
        }
        case "whoosh": // une liane qui fend l'air
          this.noise(0.22, 0.07, 900);
          this.noise(0.16, 0.04, 2200, 0.05);
          break;
        case "slide": // la bassine qui racle une marche
          this.noise(0.06, 0.1, 1800);
          this.tone(320, 240, 0.06, "square", 0.025);
          break;
        case "squeak": // le Kobold surpris : un petit couinement
          this.tone(900, 1500, 0.09, "square", 0.05);
          this.tone(1500, 1100, 0.08, "square", 0.04, 0.1);
          break;
        case "tumble": // la dégringolade : chocs en cascade qui s'éloignent
          for (let i = 0; i < 7; i++) this.noise(0.05, 0.22 - i * 0.025, 900 - i * 60, i * 0.11);
          for (let i = 0; i < 4; i++) this.tone(180 - i * 20, 60, 0.12, "triangle", 0.12 - i * 0.02, i * 0.15 + 0.03);
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
        case "coin": // deux pièces qui tintent (achat, vente)
          this.tone(1900, 1900, 0.05, "triangle", 0.12);
          this.tone(2500, 2500, 0.07, "triangle", 0.1, 0.07);
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
        case "shoulder": // coup d'épaule : la porte tient, mais ça résonne
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
        case "bell": // le tocsin : une cloche grave et lointaine, avec ses harmoniques qui s'éteignent lentement
          for (const [f, v, d] of [[220, 0.16, 2.2], [440, 0.07, 1.6], [587, 0.05, 1.2], [880, 0.03, 0.8]] as const) this.tone(f, f * 0.995, d, "sine", v);
          this.noise(0.05, 0.06, 1200);
          break;
        case "cowbell": // CLONC : une cloche à vache, creuse et sèche, qui ne résonne presque pas (Thomas, 2026-11-13)
          for (const [f, v, d] of [[540, 0.11, 0.32], [810, 0.07, 0.24], [1180, 0.03, 0.14]] as const) this.tone(f, f * 0.98, d, "square", v);
          this.noise(0.04, 0.07, 2200);
          this.tone(540, 520, 0.18, "triangle", 0.05, 0.28);
          break;
        case "gravel": // crac, crac : des petits cailloux qui roulent et crissent sous la botte
          for (let i = 0; i < 5; i++) this.noise(0.02 + Math.random() * 0.02, 0.1 + Math.random() * 0.08, 3000 + Math.random() * 2500, i * (0.025 + Math.random() * 0.03));
          this.noise(0.06, 0.06, 900, 0.01);
          break;
        case "glass": // une fiole qui se brise : tintements aigus et un éclat
          this.noise(0.06, 0.08, 5200);
          this.tone(2600, 2100, 0.08, "triangle", 0.06);
          this.tone(3400, 2900, 0.07, "triangle", 0.045, 0.05);
          this.tone(2100, 1800, 0.1, "triangle", 0.04, 0.1);
          break;
        case "puff": // « Pouf ! » : un souffle bref et doux, et un petit « plop »
          this.noise(0.22, 0.07, 1100);
          this.tone(520, 180, 0.12, "sine", 0.08, 0.02);
          break;
        case "splash": // plic, ploc : une goutte qui tombe dans une flaque, et le clapotis
          this.tone(900 + Math.random() * 300, 380, 0.12, "sine", 0.12);
          this.noise(0.08, 0.06, 1800, 0.02);
          this.tone(1300 + Math.random() * 200, 700, 0.07, "sine", 0.05, 0.09);
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
