import { GUERRIER, GUERRIER_PALETTE } from "./sprites/guerrier";
import { SCHRAT, SCHRAT_PALETTE } from "./sprites/schrat";

/**
 * Ce qui arrive dans l'escalier (Thomas, 2026-11-12) : la descente ordinaire, ou une scène rare : la dégringolade,
 * un Kobold croisé qui monte, la flûte, les lianes au-dessus des marches, la bassine qui glisse.
 */
export type StairsVariant = "normal" | "tumble" | "kobold" | "flute" | "vines" | "basin" | "rain";

/**
 * Le héros sans son équipement (Thomas, 2026-11-12 : « ça alourdit l'image ») : ni épée, ni carquois, ni sangle ;
 * le contour sombre est refait autour de ce qui reste.
 */
function stripGear(rows: readonly string[]): string[] {
  const g = rows.map((r) => r.split(""));
  const H = g.length;
  const W = g[0].length;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = g[y][x];
      if (c === "U" || c === "u") g[y][x] = ".";
      else if ((c === "M" || c === "m" || c === "b") && x >= 11) g[y][x] = ".";
      else if (c === "Q") g[y][x] = "W";
      // L'image « blessé » a une tunique rouge : dans l'escalier, la tunique reste blanche (Thomas, 2026-11-12).
      else if (c === "R") g[y][x] = "W";
      else if (c === "r") g[y][x] = "w";
    }
  const colored = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && g[y][x] !== "." && g[y][x] !== "O";
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (g[y][x] !== "O") continue;
      let near = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && colored(x + dx, y + dy)) near = true;
      if (!near) g[y][x] = ".";
    }
  const add: [number, number][] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (g[y][x] === "." && (colored(x + 1, y) || colored(x - 1, y) || colored(x, y + 1) || colored(x, y - 1))) add.push([x, y]);
  for (const [x, y] of add) g[y][x] = "O";
  return g.map((r) => r.join(""));
}
const STRIPPED = new Map<readonly string[], string[]>();
function bare(rows: readonly string[]): string[] {
  let r = STRIPPED.get(rows);
  if (!r) STRIPPED.set(rows, (r = stripGear(rows)));
  return r;
}

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
/** La bassine glisse plus vite, sur plus de marches. */
const BASIN_HOP_MS = 120;
const BASIN_HOPS = 10;
const FADE_IN = 220;
const FADE_OUT = 380;
/** Le héros tient debout sur sa marche à cet endroit de l'écran. */
const HERO_X = 36;
let HERO_Y = 34;

type Phase = "walk" | "tumble" | "dark" | "out";

export class StairsScene {
  readonly direction: "down" | "up";
  readonly variant: StairsVariant;
  private fall: boolean;
  /** Notes de musique (flûte) : elles montent et s'effacent. */
  private notes: { x: number; y: number; age: number; drift: number }[] = [];
  /** Le Kobold croisé : instant de la rencontre (le « ! » s'affiche un moment). */
  private metAt = -1;
  /** Vrai si le héros a vraiment dégringolé (pour le journal). */
  tumbled = false;
  private readonly label: string;
  /** Calque du devant (héros, torche, noir autour, fondus) : fixe à l'écran. */
  private readonly buffer: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  /** Calque du décor (mur, marches) : une marge d'un pixel, posé au sous-pixel près pour glisser sans trembler. */
  private readonly backBuffer: HTMLCanvasElement;
  private readonly b: CanvasRenderingContext2D;
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
  sounds: ("stairStep" | "tumble" | "flute" | "whoosh" | "slide" | "squeak")[] = [];

  constructor(direction: "down" | "up", variant: StairsVariant, label: string) {
    this.direction = direction;
    // Lianes, bassine et dégringolade : seulement en descendant.
    this.variant = direction === "up" && (variant === "vines" || variant === "basin" || variant === "tumble") ? "normal" : variant;
    this.fall = this.variant === "tumble";
    this.label = label;
    this.buffer = document.createElement("canvas");
    this.buffer.width = W;
    this.buffer.height = H;
    this.resize(H);
    this.g = this.buffer.getContext("2d")!;
    this.backBuffer = document.createElement("canvas");
    this.backBuffer.width = W + 2;
    this.b = this.backBuffer.getContext("2d")!;
  }

  private resize(height: number): void {
    H = Math.max(64, Math.min(160, height));
    HERO_Y = Math.round(H / 2) - 12;
    if (this.buffer.height !== H) this.buffer.height = H;
    if (this.backBuffer && this.backBuffer.height !== H + 2) this.backBuffer.height = H + 2;
  }

  /** Toucher l'écran pendant le passage : on file directement au fondu de fin. */
  skip(): void {
    if (this.phase !== "out") {
      if (this.phase === "walk") this.fall = false;
      this.phase = "out";
      this.phaseTime = 0;
    }
  }

  /** Nombre de marches du passage. */
  private hops(): number {
    return this.variant === "basin" ? BASIN_HOPS : HOPS;
  }

  /** Le Kobold qui monte (en marches, comme `hop`) : il part loin devant et vient à la rencontre du héros. */
  private koboldStep(): number {
    return 8.5 - 1.3 * this.hop;
  }

  update(dt: number): void {
    this.time += dt;
    this.phaseTime += dt;
    for (const n of this.notes) n.age += dt;
    this.notes = this.notes.filter((n) => n.age < 1400);
    if (this.phase === "walk") {
      const hopMs = this.variant === "basin" ? BASIN_HOP_MS : HOP_MS;
      const hops = this.hops();
      const hopsDone = Math.floor(this.phaseTime / hopMs);
      while (this.landed < hopsDone && this.landed < hops) {
        this.landed++;
        if (this.variant === "flute") {
          this.sounds.push("flute");
          this.notes.push({ x: HERO_X + 15, y: HERO_Y + 4, age: 0, drift: this.landed % 2 ? 0.006 : -0.004 });
        } else if (this.variant === "vines") {
          if (this.landed % 2 === 1) this.sounds.push("whoosh");
        } else if (this.variant === "basin") this.sounds.push("slide");
        else this.sounds.push("stairStep");
      }
      this.hop = Math.min(hops, this.phaseTime / hopMs);
      if (this.variant === "kobold" && this.metAt < 0 && Math.abs(this.koboldStep() - this.hop) < 0.6) {
        this.metAt = this.time;
        this.sounds.push("squeak");
      }
      this.cameraStep = this.hop;
      // Chute : à la 4e marche, le pied glisse.
      if (this.fall && this.hop >= 3.6) {
        this.phase = "tumble";
        this.tumbled = true;
        this.phaseTime = 0;
        this.sounds.push("tumble");
        this.tumble = { x: HERO_X, y: HERO_Y, vx: 0.03, vy: -0.05, angle: 0, bounces: 0 };
        this.torch = { x: HERO_X + 13, y: HERO_Y + 5, vx: -0.02, vy: -0.09, angle: 0 };
      } else if (this.hop >= hops) {
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

  private spriteOf(rows: readonly string[], palette: Record<string, string> = GUERRIER_PALETTE): HTMLCanvasElement {
    let c = this.sprites.get(rows);
    if (!c) {
      c = document.createElement("canvas");
      c.width = rows[0].length;
      c.height = rows.length;
      const g = c.getContext("2d")!;
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const color = palette[row[x]];
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
    // Décor : caméra arrondie au pixel de la scène ; le reste (la fraction) est rattrapé au moment de l'agrandir.
    const sign = this.direction === "down" ? 1 : -1;
    const camX = this.cameraStep * STEP_W;
    const camY = this.cameraStep * STEP_H;
    const ix = Math.floor(camX);
    const iy = Math.floor(camY);
    const b = this.b;
    b.setTransform(1, 0, 0, 1, 1, 1);
    b.fillStyle = "#050307";
    b.fillRect(-1, -1, W + 2, H + 2);
    this.drawWall(b, ix, iy * sign);
    this.drawStairs(b, HERO_X + 2 - ix, HERO_Y + 16 - sign * iy);

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, W, H);

    // Où est la flamme (la lumière suit la torche).
    let light = { x: HERO_X + 13, y: HERO_Y + 4 };
    let flame = light;
    const flicker = Math.sin(this.time / 70) * 1.2 + Math.sin(this.time / 23) * 0.6;
    const fallen = this.fall && this.phase !== "walk";
    if (!fallen) {
      const held = this.drawWalkingHero();
      light = flame = held ?? { x: HERO_X + 9, y: HERO_Y + 4 };
      if (!held) flame = { x: -99, y: -99 }; // la flûte : pas de torche, une petite lueur autour de lui
    }
    else {
      this.drawTorch(this.torch.x, this.torch.y, this.torch.angle);
      this.drawTumblingHero();
      // Tant qu'on le voit rouler, la lueur le suit ; ensuite il ne reste que la torche tombée sur les marches.
      const t = this.tumble;
      flame = this.flameOfTorch();
      light = this.phase === "tumble" && t.x < W + 4 ? { x: (t.x + 8 + flame.x) / 2, y: (t.y + 8 + flame.y) / 2 } : flame;
    }

    // Le noir tout autour, sauf le halo de la torche.
    const radius = (this.variant === "flute" ? 32 : this.variant === "rain" ? 46 : 42) + flicker;
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
    if (flame.x > -50) this.drawFlame(flame.x, flame.y + 3);
    if (this.variant === "rain") this.drawRain(light);
    // Notes de musique dorées, qui montent en ondulant et luisent dans le noir.
    for (const n of this.notes) this.drawNote(n.x + n.age * 0.012 + Math.sin(n.age / 160) * 2, n.y - n.age * 0.02, 1 - n.age / 1400);
    // Le « ! » du Kobold surpris.
    if (this.metAt >= 0 && this.time - this.metAt < 700) {
      const kx = Math.round(HERO_X + (this.koboldStep() - this.hop) * STEP_W + 6);
      g.fillStyle = "#ffe27a";
      g.fillRect(kx, HERO_Y - 9, 1, 4);
      g.fillRect(kx, HERO_Y - 4, 1, 1);
    }

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
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, dy, dw, dh);
    ctx.clip();
    // Le décor glisse au pixel d'écran près (et non au gros pixel de la scène) : plus de tremblement.
    const fx = (camX - ix) * scale;
    const fy = -sign * (camY - iy) * scale;
    ctx.drawImage(this.backBuffer, Math.round(dx - scale - fx), Math.round(dy - scale + fy), (W + 2) * scale, (H + 2) * scale);
    ctx.restore();
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

  /** Le mur du fond, à peine deviné : des briques régulières qui défilent avec l'escalier. */
  private drawWall(b: CanvasRenderingContext2D, ix: number, iy: number): void {
    b.fillStyle = "#1c1722";
    const ox = ((-ix % 14) + 14) % 14;
    const oy = ((-iy % 14) + 14) % 14;
    for (let r = -2; r < Math.ceil(H / 7) + 2; r++) {
      const shift = ((r % 2) + 2) % 2 === 0 ? 0 : 7;
      for (let c = -2; c < 10; c++) {
        const bx = ox + c * 14 + shift;
        const by = oy + r * 7;
        b.fillRect(bx, by, 14, 1);
        b.fillRect(bx, by, 1, 7);
      }
    }
  }

  /** Les marches de pierre, toutes pareilles : dessus clair usé au milieu, contremarche sombre, un joint au milieu. */
  private drawStairs(b: CanvasRenderingContext2D, ox: number, oy: number): void {
    const sign = this.direction === "down" ? 1 : -1;
    for (let i = -6; i < 16; i++) {
      const x = ox + i * STEP_W;
      const y = oy + i * sign * STEP_H;
      if (x > W + STEP_W || x < -STEP_W * 2) continue;
      // Le bloc de la marche descend jusqu'en bas de l'écran (on ne voit pas sous l'escalier).
      b.fillStyle = "#463e4e";
      b.fillRect(x, y + 2, STEP_W, H - y + 10);
      b.fillStyle = "#332c3a";
      b.fillRect(x, y + 2, STEP_W, STEP_H);
      b.fillStyle = "#8a8092";
      b.fillRect(x, y, STEP_W, 2);
      b.fillStyle = "#a69cae";
      b.fillRect(x + 3, y, STEP_W - 6, 1);
      b.fillStyle = "#1e1a24";
      b.fillRect(x, y, 1, STEP_H + 2);
      b.fillRect(x + STEP_W / 2, y + 4, 1, STEP_H - 2);
    }
  }

  /** Le héros qui saute de marche en marche (ou glisse, ou se balance). Renvoie la position de la flamme (sans torche : null). */
  private drawWalkingHero(): { x: number; y: number } | null {
    const g = this.g;
    const hops = this.hops();
    const u = this.hop - Math.floor(this.hop);
    const rising = this.direction === "up";
    const frames = GUERRIER.walkSide;
    const still = this.hop >= hops;
    const frame = bare(still ? GUERRIER.idleSide[0] : frames[Math.floor(this.hop * 2) % frames.length]);
    if (this.variant === "kobold") this.drawKobold();
    if (this.variant === "vines") return this.drawSwinging();
    if (this.variant === "basin") return this.drawBasin(u);
    // Un petit bond : plus haut en montant.
    const lift = still ? 0 : Math.sin(Math.PI * u) * (rising ? 6 : 4);
    // Pendant le saut, la caméra suit : le héros reste au même endroit de l'écran, l'escalier défile.
    const x = HERO_X;
    const y = HERO_Y - lift;
    // Ombre sur la marche.
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.fillRect(x + 4, HERO_Y + 15, 8, 1);
    g.drawImage(this.spriteOf(frame), Math.round(x), Math.round(y));
    if (this.variant === "rain") {
      // Il pleut dans l'escalier (Thomas, 2026-11-14 : « il pleut, avec un parapluie ») : le parapluie rouge à la main,
      // la lanterne… non : la torche, elle, est rangée. Une petite lueur suffit.
      this.drawUmbrella(Math.round(x), Math.round(y));
      return null;
    }
    if (this.variant === "flute") {
      // La flûte, tenue à la bouche, pointée vers l'avant et un peu vers le bas.
      const fx = Math.round(x) + 11;
      const fy = Math.round(y) + 8;
      g.fillStyle = "#18121e";
      g.fillRect(fx - 1, fy - 1, 8, 4);
      g.fillStyle = "#c89a5a";
      g.fillRect(fx, fy, 6, 1);
      g.fillStyle = "#8a6238";
      g.fillRect(fx, fy + 1, 6, 1);
      g.fillStyle = "#3a2410";
      g.fillRect(fx + 2, fy, 1, 1);
      g.fillRect(fx + 4, fy, 1, 1);
      return null;
    }
    const tx = x + 12;
    const ty = y + 9;
    this.drawTorch(tx, ty, -0.35 + Math.sin(this.time / 90) * 0.08);
    return { x: tx + 1, y: ty - 6 };
  }

  /** Le parapluie : un dôme rouge à baleines, la tige et la poignée en crosse tenues devant. */
  private drawUmbrella(x: number, y: number): void {
    const g = this.g;
    const cx = x + 8;
    const top = y - 9;
    const sway = Math.round(Math.sin(this.time / 260));
    // La tige, de la main au sommet du dôme.
    g.fillStyle = "#3a2410";
    g.fillRect(cx + sway, top + 1, 1, 18);
    g.fillRect(cx + sway + 1, top + 18, 1, 1);
    g.fillRect(cx + sway + 2, top + 17, 1, 1);
    // Le dôme : rangées de plus en plus larges, contour sombre, baleines plus claires.
    const rows = [3, 7, 11, 13, 15];
    rows.forEach((w, i) => {
      const left = cx + sway - Math.floor(w / 2);
      g.fillStyle = "#18121e";
      g.fillRect(left - 1, top + i, w + 2, 1);
      g.fillStyle = i < 2 ? "#e0505a" : "#c0303c";
      g.fillRect(left, top + i, w, 1);
    });
    g.fillStyle = "#18121e";
    g.fillRect(cx + sway - 8, top + 5, 17, 1);
    g.fillStyle = "#8e1f28";
    for (const dx of [-7, -3, 1, 5]) g.fillRect(cx + sway + dx, top + 5, 2, 1);
    g.fillStyle = "#ff9aa0";
    g.fillRect(cx + sway - 1, top + 1, 1, 1);
    g.fillRect(cx + sway, top - 1, 1, 1);
  }

  /** La pluie : des traits fins qui tombent en biais ; ils s'arrêtent sur le parapluie et rebondissent en gouttelettes. */
  private drawRain(light: { x: number; y: number }): void {
    const g = this.g;
    const cx = HERO_X + 8;
    const top = HERO_Y - 9;
    for (let i = 0; i < 90; i++) {
      const speed = 0.11 + (i % 5) * 0.012;
      const x0 = (i * 53 + Math.floor(this.time * 0.03)) % (W + 30) - 15;
      const y = ((i * 97 + this.time * speed) % (H + 20)) - 10;
      const x = x0 - (y + 10) * 0.25;
      // Sous le parapluie, pas de pluie.
      if (Math.abs(x - cx) <= 8 && y > top - 1 && y < HERO_Y + 18) {
        if (y < top + 4 && i % 3 === 0) {
          g.fillStyle = "rgba(200,220,255,0.8)";
          g.fillRect(Math.round(x) + (i % 2 ? 2 : -2), top - 2, 1, 1);
        }
        continue;
      }
      const d = Math.hypot(x - light.x, y - light.y);
      const a = Math.max(0.12, 0.7 - d / 90);
      g.fillStyle = `rgba(170,200,240,${a.toFixed(2)})`;
      g.fillRect(Math.round(x), Math.round(y), 1, 3);
      g.fillRect(Math.round(x) - 1, Math.round(y) + 3, 1, 1);
    }
    // Des ronds dans les flaques, sur les marches éclairées.
    for (let i = 0; i < 6; i++) {
      const age = (this.time + i * 170) % 900;
      const sx = HERO_X - 20 + i * 11;
      const sy = this.stairTopAt(sx) - 1;
      const r = 1 + age / 300;
      g.fillStyle = `rgba(170,200,240,${(0.5 * (1 - age / 900)).toFixed(2)})`;
      g.fillRect(Math.round(sx - r), Math.round(sy), Math.round(r * 2), 1);
    }
  }

  /** Le Kobold croisé : il monte en sautillant à la rencontre du héros, tourné vers lui, et file derrière lui. */
  private drawKobold(): void {
    const k = this.koboldStep();
    const rel = k - this.hop;
    if (rel > 6 || rel < -5) return;
    const sign = this.direction === "down" ? 1 : -1;
    const u = k - Math.floor(k);
    const x = HERO_X + rel * STEP_W + 1;
    const y = HERO_Y + 1 + sign * rel * STEP_H - Math.abs(Math.sin(Math.PI * u)) * 3;
    const frames = SCHRAT.walkSide;
    const frame = frames[Math.floor(this.time / 120) % frames.length];
    const g = this.g;
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.fillRect(Math.round(x) + 4, Math.round(HERO_Y + 16 + sign * rel * STEP_H) - 1, 8, 1);
    g.save();
    // Vu de profil, tourné vers la gauche (vers le héros).
    g.translate(Math.round(x) + 16, Math.round(y));
    g.scale(-1, 1);
    g.drawImage(this.spriteOf(frame, SCHRAT_PALETTE), 0, 0);
    g.restore();
  }

  /** Les lianes : le héros se balance de l'une à l'autre au-dessus des marches, torche à la main. */
  private drawSwinging(): { x: number; y: number } {
    const g = this.g;
    // Une liane toutes les deux marches, accrochée au plafond (hors cadre).
    const vineX = (i: number) => HERO_X + 10 + (i - this.hop) * STEP_W;
    const held = 2 * Math.round(this.hop / 2);
    const off = (this.hop - held) / 1; // -1 … 1
    const hx = HERO_X + 9;
    const hy = HERO_Y - 14 + 4 * (1 - off * off);
    for (let i = held - 6; i <= held + 8; i += 2) {
      const ax = vineX(i);
      if (ax < -10 || ax > W + 10) continue;
      const toX = i === held ? hx : ax + Math.sin(this.time / 400 + i) * 2;
      const toY = i === held ? hy : HERO_Y - 4 + ((i * 7) % 5);
      this.drawVine(ax, -2, toX, toY);
    }
    // Le héros pend sous sa main, incliné comme la liane.
    const angle = Math.atan2(hx - vineX(held), hy + 2);
    g.save();
    g.translate(Math.round(hx), Math.round(hy));
    g.rotate(-angle * 0.8);
    // Le bras levé qui tient la liane (peau, contour sombre), puis le héros qui pend dessous.
    g.drawImage(this.spriteOf(bare(GUERRIER.idleSide[0])), -9, 4);
    g.fillStyle = "#18121e";
    g.fillRect(-1, -1, 3, 8);
    g.fillStyle = "#eebe91";
    g.fillRect(0, 0, 1, 7);
    g.restore();
    const tx = hx + 3 + Math.sin(-angle) * 9;
    const ty = hy + 14;
    this.drawTorch(tx, ty, -0.5 - angle * 0.8);
    return { x: tx + 1, y: ty - 6 };
  }

  /** Une liane : une corde verte qui ondule un peu, avec des feuilles. */
  private drawVine(ax: number, ay: number, bx: number, by: number): void {
    const g = this.g;
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(ax + (bx - ax) * t + Math.sin(t * 6 + this.time / 300) * 0.6);
      const y = Math.round(ay + (by - ay) * t);
      g.fillStyle = "#2e5a1e";
      g.fillRect(x, y, 1, 1);
      if (i % 7 === 3) {
        g.fillStyle = "#5e9a32";
        g.fillRect(x + (i % 2 ? 1 : -2), y, 2, 1);
      }
    }
  }

  /** La bassine : le héros, assis dedans, glisse de marche en marche, torche levée. */
  private drawBasin(u: number): { x: number; y: number } {
    const g = this.g;
    // À chaque rebord, la bassine pique du nez et rebondit d'un pixel.
    const bump = this.hop >= this.hops() ? 0 : u < 0.25 ? 1 : 0;
    const x = HERO_X;
    const y = HERO_Y + 3 + bump;
    // Le héros assis : seulement le haut du corps dépasse.
    const sprite = this.spriteOf(bare(GUERRIER.idleSide[0]));
    g.drawImage(sprite, 0, 0, 16, 10, Math.round(x), Math.round(y - 1), 16, 10);
    // La bassine de bois cerclée de fer, vue de profil.
    const bx = Math.round(x) - 1;
    const by = Math.round(y) + 8;
    g.fillStyle = "#18121e";
    g.fillRect(bx, by - 1, 18, 7);
    g.fillStyle = "#8a6238";
    g.fillRect(bx + 1, by, 16, 5);
    g.fillStyle = "#b0824a";
    g.fillRect(bx + 1, by, 16, 1);
    g.fillStyle = "#6e7594";
    g.fillRect(bx + 1, by + 2, 16, 1);
    g.fillStyle = "#5a3a1c";
    for (let i = 3; i < 17; i += 4) g.fillRect(bx + i, by + 3, 1, 2);
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.fillRect(bx + 2, HERO_Y + 15, 14, 1);
    // Des étincelles quand le fer racle la pierre.
    if (bump && this.hop < this.hops()) {
      g.fillStyle = "#ffe27a";
      g.fillRect(bx - 1, by + 5, 1, 1);
      g.fillRect(bx - 3, by + 4, 1, 1);
    }
    const tx = x + 12;
    const ty = y + 2;
    this.drawTorch(tx, ty, -0.15 + Math.sin(this.time / 90) * 0.1);
    return { x: tx + 1, y: ty - 6 };
  }

  /** Une croche dorée qui luit (flûte). */
  private drawNote(x: number, y: number, alpha: number): void {
    const g = this.g;
    const cx = Math.round(x);
    const cy = Math.round(y);
    g.globalAlpha = Math.max(0, alpha);
    g.fillStyle = "#ffd84a";
    g.fillRect(cx, cy, 2, 2);
    g.fillRect(cx + 1, cy - 4, 1, 4);
    g.fillRect(cx + 2, cy - 4, 1, 1);
    g.fillRect(cx + 3, cy - 3, 1, 1);
    g.globalAlpha = 1;
  }

  /** Le héros qui dégringole, en tournant sur lui-même. */
  private drawTumblingHero(): void {
    const t = this.tumble;
    if (t.x > W + 24) return;
    const g = this.g;
    g.save();
    g.translate(Math.round(t.x + 8), Math.round(t.y + 8));
    g.rotate(Math.round(t.angle / (Math.PI / 4)) * (Math.PI / 4));
    g.drawImage(this.spriteOf(bare(GUERRIER.hurt[0])), -8, -8);
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
