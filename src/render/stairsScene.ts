import { GUERRIER, GUERRIER_PALETTE } from "./sprites/guerrier";

/**
 * Passage d'un étage à l'autre (Thomas, 2026-11-12) : dans le noir, le héros, torche en main, descend (ou monte)
 * un escalier de pierre en rebondissant de marche en marche. De temps en temps, en descendant, il se prend les
 * pieds dans une marche et dégringole jusqu'en bas, hors du cadre. Pur décor : ni tour, ni dégâts.
 *
 * Tout est peint en basse définition (96 × 64 pixels) puis agrandi sans lissage, pour rester en pixel art.
 */

const W = 96;
/** Hauteur de la scène : adaptée à la forme du canevas (au moins 64). */
let H = 64;
/** Une marche : largeur et hauteur en pixels de la scène. */
const STEP_W = 12;
const STEP_H = 6;
const HOP_MS = 210;
const HOPS = 7;
const FADE_IN = 220;
const FADE_OUT = 380;
/** Le héros tient debout sur sa marche à cet endroit de l'écran. */
const HERO_X = 36;
let HERO_Y = 34;

type Phase = "walk" | "tumble" | "dark" | "out";

export class StairsScene {
  readonly direction: "down" | "up";
  private fall: boolean;
  /** Vrai si le héros a vraiment dégringolé (pour le journal). */
  tumbled = false;
  private readonly label: string;
  private readonly buffer: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private readonly sprites = new Map<readonly string[], HTMLCanvasElement>();
  private time = 0;
  private phase: Phase = "walk";
  private phaseTime = 0;
  /** Marche atteinte (fractionnaire pendant un saut). */
  private hop = 0;
  private landed = 0;
  /** Chute : position et rotation du héros, et de la torche qui lui échappe. */
  private tumble = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, bounces: 0 };
  private torch = { x: 0, y: 0, vx: 0, vy: 0, angle: 0 };
  private cameraStep = 0;
  done = false;
  /** Sons demandés depuis le dernier appel à `update` (« marche » à chaque marche, « chute » au début de la chute). */
  sounds: ("stairStep" | "tumble")[] = [];

  constructor(direction: "down" | "up", fall: boolean, label: string) {
    this.direction = direction;
    this.fall = fall && direction === "down";
    this.label = label;
    this.buffer = document.createElement("canvas");
    this.buffer.width = W;
    this.buffer.height = H;
    this.resize(H);
    this.g = this.buffer.getContext("2d")!;
  }

  private resize(height: number): void {
    H = Math.max(64, Math.min(160, height));
    HERO_Y = Math.round(H / 2) - 12;
    if (this.buffer.height !== H) this.buffer.height = H;
  }

  /** Toucher l'écran pendant le passage : on file directement au fondu de fin. */
  skip(): void {
    if (this.phase !== "out") {
      if (this.phase === "walk") this.fall = false;
      this.phase = "out";
      this.phaseTime = 0;
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.phaseTime += dt;
    if (this.phase === "walk") {
      const hopsDone = Math.floor(this.phaseTime / HOP_MS);
      while (this.landed < hopsDone) {
        this.landed++;
        this.sounds.push("stairStep");
      }
      this.hop = Math.min(HOPS, this.phaseTime / HOP_MS);
      this.cameraStep = this.hop;
      // Chute : à la 4e marche, le pied glisse.
      if (this.fall && this.hop >= 3.6) {
        this.phase = "tumble";
        this.tumbled = true;
        this.phaseTime = 0;
        this.sounds.push("tumble");
        this.tumble = { x: HERO_X, y: HERO_Y, vx: 0.03, vy: -0.05, angle: 0, bounces: 0 };
        this.torch = { x: HERO_X + 13, y: HERO_Y + 5, vx: -0.02, vy: -0.09, angle: 0 };
      } else if (this.hop >= HOPS) {
        this.phase = "out";
        this.phaseTime = 0;
      }
    } else if (this.phase === "tumble") {
      // Le héros roule de marche en marche, de plus en plus vite ; la caméra, elle, s'arrête.
      const t = this.tumble;
      t.vy += 0.0003 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.angle += 0.012 * dt;
      const floorY = this.stairTopAt(t.x + 8) - 15;
      if (t.y >= floorY && t.vy > 0) {
        t.y = floorY;
        t.vy = -0.06 - Math.min(0.04, t.bounces * 0.005);
        t.vx = 0.035 + t.bounces * 0.006;
        t.bounces++;
        this.sounds.push("stairStep");
      }
      const o = this.torch;
      o.vy += 0.0004 * dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.angle -= 0.012 * dt;
      if (o.y >= this.stairTopAt(o.x) - 1 && o.vy > 0) {
        o.y = this.stairTopAt(o.x) - 1;
        o.vy = -0.04;
        o.vx = 0.035;
      }
      if (t.x > W + 24 || t.y > H + 24) {
        this.phase = "dark";
        this.phaseTime = 0;
      }
    } else if (this.phase === "dark") {
      if (this.phaseTime > 700) {
        this.phase = "out";
        this.phaseTime = 0;
      }
    } else if (this.phase === "out" && this.phaseTime >= FADE_OUT) {
      this.done = true;
    }
  }

  /** Haut de la marche sous l'abscisse `x` (pixels de la scène), compte tenu de la caméra. */
  private stairTopAt(x: number): number {
    const s = Math.floor((x - this.originX()) / STEP_W);
    return this.originY() + s * (this.direction === "down" ? STEP_H : -STEP_H);
  }

  /** Coin haut-gauche de la marche 0, placé pour que la marche courante soit sous les pieds du héros. */
  private originX(): number {
    return HERO_X + 2 - this.cameraStep * STEP_W;
  }

  private originY(): number {
    const sign = this.direction === "down" ? 1 : -1;
    return HERO_Y + 16 - sign * this.cameraStep * STEP_H;
  }

  private spriteOf(rows: readonly string[]): HTMLCanvasElement {
    let c = this.sprites.get(rows);
    if (!c) {
      c = document.createElement("canvas");
      c.width = rows[0].length;
      c.height = rows.length;
      const g = c.getContext("2d")!;
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const color = GUERRIER_PALETTE[row[x]];
          if (color) {
            g.fillStyle = color;
            g.fillRect(x, y, 1, 1);
          }
        }
      });
      this.sprites.set(rows, c);
    }
    return c;
  }

  /** La scène, peinte sur tout le canevas du jeu. */
  draw(target: HTMLCanvasElement): void {
    this.resize(Math.round((W * target.height) / Math.max(1, target.width)));
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#050307";
    g.fillRect(0, 0, W, H);
    this.drawStairs();

    // Où est la flamme (la lumière suit la torche).
    let light = { x: HERO_X + 13, y: HERO_Y + 4 };
    let flame = light;
    const flicker = Math.sin(this.time / 70) * 1.2 + Math.sin(this.time / 23) * 0.6;
    const fallen = this.fall && this.phase !== "walk";
    if (!fallen) light = flame = this.drawWalkingHero();
    else {
      this.drawTorch(this.torch.x, this.torch.y, this.torch.angle);
      this.drawTumblingHero();
      // Tant qu'on le voit rouler, la lueur le suit ; ensuite il ne reste que la torche tombée sur les marches.
      const t = this.tumble;
      flame = this.flameOfTorch();
      light = this.phase === "tumble" && t.x < W + 4 ? { x: (t.x + 8 + flame.x) / 2, y: (t.y + 8 + flame.y) / 2 } : flame;
    }

    // Le noir tout autour, sauf le halo de la torche.
    const radius = 42 + flicker;
    const halo = g.createRadialGradient(light.x, light.y, 2, light.x, light.y, radius);
    halo.addColorStop(0, "rgba(5,3,7,0)");
    halo.addColorStop(0.5, "rgba(5,3,7,0.2)");
    halo.addColorStop(1, "rgba(5,3,7,1)");
    g.fillStyle = halo;
    g.fillRect(0, 0, W, H);
    // Lueur chaude, un peu orangée, au cœur du halo.
    g.globalCompositeOperation = "lighter";
    const warm = g.createRadialGradient(light.x, light.y, 0, light.x, light.y, 16 + flicker);
    warm.addColorStop(0, "rgba(255,150,60,0.22)");
    warm.addColorStop(1, "rgba(255,150,60,0)");
    g.fillStyle = warm;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    // La flamme par-dessus le noir.
    this.drawFlame(flame.x, flame.y + 3);

    // Fondus d'entrée et de sortie.
    let fade = 0;
    if (this.time < FADE_IN) fade = 1 - this.time / FADE_IN;
    if (this.phase === "out") fade = Math.min(1, this.phaseTime / FADE_OUT);
    if (fade > 0) {
      g.fillStyle = `rgba(0,0,0,${fade})`;
      g.fillRect(0, 0, W, H);
    }

    // Agrandi sans lissage, centré, sur tout le canevas.
    const ctx = target.getContext("2d")!;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, target.width, target.height);
    const scale = Math.max(1, Math.floor(Math.min(target.width / W, target.height / H)));
    const dw = W * scale;
    const dh = H * scale;
    const dx = Math.floor((target.width - dw) / 2);
    const dy = Math.floor((target.height - dh) / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buffer, dx, dy, dw, dh);
    // Le numéro de l'étage où l'on arrive, en bas, sur le fondu de fin.
    if (this.phase === "out" || this.phase === "dark") {
      const alpha = this.phase === "dark" ? 0.9 : Math.min(1, 0.4 + this.phaseTime / FADE_OUT);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#e8c070";
      ctx.font = `${Math.round(scale * 7)}px VT323, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.label, target.width / 2, dy + dh - scale * 6);
    }
    ctx.restore();
  }

  /** Les marches de pierre : dessus clair, contremarche plus sombre, joints, quelques éclats. */
  private drawStairs(): void {
    const g = this.g;
    const sign = this.direction === "down" ? 1 : -1;
    const ox = this.originX();
    const oy = this.originY();
    for (let i = -6; i < 16; i++) {
      const x = Math.round(ox + i * STEP_W);
      const y = Math.round(oy + i * sign * STEP_H);
      if (x > W + STEP_W || x < -STEP_W * 2) continue;
      // Le bloc de la marche descend jusqu'en bas de l'écran (on ne voit pas sous l'escalier).
      g.fillStyle = "#463e4e";
      g.fillRect(x, y + 2, STEP_W, H - y + 10);
      // Contremarche : face avant de la marche, du côté où l'on va.
      g.fillStyle = "#332c3a";
      g.fillRect(x, y + 2, STEP_W, STEP_H);
      // Dessus de la marche, usé au milieu.
      g.fillStyle = "#8a8092";
      g.fillRect(x, y, STEP_W, 2);
      g.fillStyle = "#a69cae";
      g.fillRect(x + 3, y, STEP_W - 6, 1);
      // Joints des pierres.
      g.fillStyle = "#1e1a24";
      g.fillRect(x, y, 1, STEP_H + 2);
      g.fillRect(x + ((i * 5) & 7) + 2, y + 4, 1, STEP_H - 2);
      // Un éclat ici et là.
      if ((i * 7) % 3 === 0) {
        g.fillStyle = "#4e4656";
        g.fillRect(x + 7, y + 3, 2, 1);
      }
    }
    // Le mur du fond, à peine deviné : quelques briques.
    g.fillStyle = "#1c1722";
    for (let r = 0; r < Math.ceil(H / 7) + 1; r++) {
      for (let c = -1; c < 10; c++) {
        const bx = ((c * 14 + (r & 1) * 7 - Math.round(this.cameraStep * STEP_W * 0.5)) % 140 + 140) % 140 - 14;
        const by = r * 7 - Math.round(sign * this.cameraStep * STEP_H * 0.5) % 7;
        g.fillRect(bx, by, 13, 1);
        g.fillRect(bx, by, 1, 6);
      }
    }
  }

  /** Le héros qui saute de marche en marche. Renvoie la position de la flamme. */
  private drawWalkingHero(): { x: number; y: number } {
    const g = this.g;
    const u = this.hop - Math.floor(this.hop);
    const rising = this.direction === "up";
    // Un petit bond : plus haut en montant.
    const lift = this.hop >= HOPS ? 0 : Math.sin(Math.PI * u) * (rising ? 6 : 4);
    // Pendant le saut, la caméra suit : le héros reste au même endroit de l'écran, l'escalier défile.
    const x = HERO_X;
    const y = HERO_Y - lift;
    const frames = GUERRIER.walkSide;
    const frame = this.hop >= HOPS ? GUERRIER.idleSide[0] : frames[Math.floor(this.hop * 2) % frames.length];
    // Ombre sur la marche.
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.fillRect(x + 4, HERO_Y + 15, 8, 1);
    g.drawImage(this.spriteOf(frame), Math.round(x), Math.round(y));
    const tx = x + 12;
    const ty = y + 9;
    this.drawTorch(tx, ty, -0.35 + Math.sin(this.time / 90) * 0.08);
    return { x: tx + 1, y: ty - 6 };
  }

  /** Le héros qui dégringole, en tournant sur lui-même. */
  private drawTumblingHero(): void {
    const t = this.tumble;
    if (t.x > W + 24) return;
    const g = this.g;
    g.save();
    g.translate(Math.round(t.x + 8), Math.round(t.y + 8));
    g.rotate(Math.round(t.angle / (Math.PI / 4)) * (Math.PI / 4));
    g.drawImage(this.spriteOf(GUERRIER.hurt[0]), -8, -8);
    g.restore();
  }

  /** Bout du manche de la torche tombée, là où brûle la flamme. */
  private flameOfTorch(): { x: number; y: number } {
    const o = this.torch;
    return { x: o.x + 1 + Math.sin(o.angle) * 6, y: o.y - Math.cos(o.angle) * 6 };
  }

  /** Le manche de la torche (la flamme est peinte à part, par-dessus le noir). */
  private drawTorch(x: number, y: number, angle: number): void {
    const g = this.g;
    g.save();
    g.translate(Math.round(x), Math.round(y));
    g.rotate(angle);
    g.fillStyle = "#5a3817";
    g.fillRect(0, -5, 2, 6);
    g.fillStyle = "#9a6a34";
    g.fillRect(0, -5, 1, 6);
    g.fillStyle = "#3a2410";
    g.fillRect(-1, -6, 4, 2);
    g.restore();
  }

  private drawFlame(x: number, y: number): void {
    const g = this.g;
    const f = Math.floor(this.time / 90) % 3;
    const cx = Math.round(x);
    const cy = Math.round(y);
    g.fillStyle = "#c03a1a";
    g.fillRect(cx - 1, cy - 5 - (f === 1 ? 1 : 0), 3, 4);
    g.fillStyle = "#ff9a3a";
    g.fillRect(cx - 1, cy - 4, 3, 3);
    g.fillRect(cx + (f === 2 ? 1 : 0), cy - 6 - (f === 0 ? 1 : 0), 1, 2);
    g.fillStyle = "#ffe27a";
    g.fillRect(cx, cy - 3, 1, 2);
  }
}
