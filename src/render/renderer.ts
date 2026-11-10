import { Game } from "../core/game";
import { MONSTERS } from "../data/monsters";
import { RULES } from "../data/rules";
import { Actor } from "../entities/actor";
import { Point, Tile } from "../world/map";

/** Nombre de cases visibles en largeur (écran portrait) : valeur de départ et limites du zoom. */
const COLUMNS = 11;
const MIN_COLUMNS = 6;
const MAX_COLUMNS = 28;

/** Durée de vie d'un texte flottant (dégâts, « Raté »), en ms. */
const FLOAT_MS = 900;

const COLORS = {
  background: "#0c0b12",
  mortar: "#3c3f55",
  floor: "#4b4560",
  sensed: "rgba(104,97,92,0.3)",
  stairs: "#e0b040",
  door: "#8a5a2b",
  doorEdge: "#5a3817",
  lock: "#e0b040",
  hero: "#5fd38d",
  heroEdge: "#1d5c3a",
  path: "rgba(255,255,255,0.35)",
  hpBack: "#3a1520",
  hpFill: "#e05060",
};

/** Nombre pseudo-aléatoire entre 0 et 1, toujours le même pour les mêmes entrées (décor uniquement). */
function noise(a: number, b: number, c: number): number {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Durée d'un coup (élan de l'attaquant + trace de la lame), en ms. */
const SLASH_MS = 220;

/** Un coup porté de (fromX, fromY) vers (x, y). */
interface Slash {
  attackerId: number;
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  color: string;
  age: number;
  /** Faux : simple élan sans trace de lame (rebond contre une porte). */
  arc: boolean;
}

/** Une flèche en vol. */
interface Projectile {
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  age: number;
  /** Vrai : la flèche tournoie (après un rebond). */
  tumble: boolean;
}
const PROJECTILE_MS = 170;

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
}

/** Dessine l'état du jeu sur le Canvas. Design volontairement minimal : des formes colorées. */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private tile = 32;
  private columns = COLUMNS;
  private camX = 0;
  private camY = 0;
  /** Décalage de la vue par rapport au héros, en cases (quand le joueur a fait glisser la carte). */
  private panX = 0;
  private panY = 0;
  private time = 0;
  private floats: FloatingText[] = [];
  private slashes: Slash[] = [];
  private projectiles: Projectile[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.tile = this.width / this.columns;
  }

  /** Zoom : facteur > 1 pour agrandir les cases, < 1 pour en voir davantage. */
  zoomBy(factor: number): void {
    this.columns = Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, this.columns / factor));
    this.tile = this.width / this.columns;
  }

  /** Fait glisser la vue de quelques pixels ; elle reste décalée jusqu'au recentrage. */
  panBy(dxPixels: number, dyPixels: number): void {
    const limit = 24;
    const nx = Math.max(-limit, Math.min(limit, this.panX - dxPixels / this.tile));
    const ny = Math.max(-limit, Math.min(limit, this.panY - dyPixels / this.tile));
    // On déplace aussi la caméra tout de suite, pour que la carte suive le doigt sans retard.
    this.camX += nx - this.panX;
    this.camY += ny - this.panY;
    this.panX = nx;
    this.panY = ny;
  }

  /** Ramène la vue sur le héros (en douceur). */
  recenter(): void {
    this.panX = 0;
    this.panY = 0;
  }

  isPanned(): boolean {
    return Math.abs(this.panX) > 0.5 || Math.abs(this.panY) > 0.5;
  }

  /** Recentre immédiatement la vue (nouvel étage). */
  snapTo(game: Game): void {
    this.panX = 0;
    this.panY = 0;
    this.camX = game.hero.x;
    this.camY = game.hero.y;
    this.floats = [];
    this.slashes = [];
    this.projectiles = [];
  }

  /** Affiche un petit texte qui s'élève au-dessus d'une case (dégâts, « Raté »). */
  addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floats.push({ x, y, text, color, age: 0 });
  }

  /** Anime une attaque : l'attaquant s'élance vers sa cible et une lame balaie la case visée. */
  addSlash(attackerId: number, fromX: number, fromY: number, x: number, y: number, color: string, arc = true): void {
    this.slashes.push({ attackerId, fromX, fromY, x, y, color, age: 0, arc });
  }

  /** Fait voler une flèche d'une case à une autre. */
  addProjectile(fromX: number, fromY: number, x: number, y: number, delay = 0, tumble = false): void {
    this.projectiles.push({ fromX, fromY, x, y, age: -delay, tumble }); // un âge négatif : elle partira après ce délai
  }

  /** Dessine une flèche centrée en (cx, cy), pointe vers `angle`. */
  private drawArrow(cx: number, cy: number, angle: number, length: number, part: "whole" | "front" | "back" = "whole"): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const w = Math.max(1.5, length * 0.09);
    const L = length;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#120d08";
    ctx.lineWidth = Math.max(1, L * 0.045);
    const shape = (color: string, pts: number[][]): void => {
      ctx.fillStyle = color;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    };
    if (part !== "front") {
      // Empennage : une petite feuille bleue autour de la queue, la hampe passe par-dessus.
      shape("#4a8fd0", [[-L * 0.2, 0], [-L * 0.36, -w * 2.3], [-L * 0.52, 0], [-L * 0.36, w * 2.3]]);
    }
    // Hampe fine (entière, ou seulement la moitié avant ou arrière pour une flèche brisée).
    const [x0, x1] = part === "whole" ? [-L * 0.46, L * 0.26] : part === "front" ? [-L * 0.05, L * 0.26] : [-L * 0.46, -L * 0.08];
    shape("#b9824a", [[x0, -w / 2], [x1, -w / 2], [x1, w / 2], [x0, w / 2]]);
    if (part !== "back") {
      // Petite pointe d'acier compacte : c'est elle qui dit où va la flèche.
      shape("#eef2ff", [[L / 2, 0], [L * 0.2, -w * 2.3], [L * 0.2, w * 2.3]]);
    }
    ctx.restore();
  }

  private originX(): number {
    return this.width / 2 - (this.camX + 0.5) * this.tile;
  }

  private originY(): number {
    return this.height / 2 - (this.camY + 0.5) * this.tile;
  }

  /** Convertit un point de l'écran (en pixels dans le canvas) en case de la carte. */
  screenToTile(px: number, py: number): Point {
    return {
      x: Math.floor((px - this.originX()) / this.tile),
      y: Math.floor((py - this.originY()) / this.tile),
    };
  }

  /**
   * `progress` (0 à 1) est l'avancement de l'animation du tour en cours : chaque acteur glisse
   * de sa case de début de tour vers sa case actuelle. `dt` est le temps écoulé en ms.
   * `ghosts` : monstres déjà vaincus dans les règles mais dont la mort n'a pas encore été montrée.
   */
  draw(game: Game, progress: number, dt: number, ghosts: readonly Actor[] = [], aimRange: number | null = null, aimTarget: Actor | null = null): void {
    const { ctx, tile } = this;
    this.time += dt;
    this.slashes = this.slashes.filter((s) => (s.age += dt) < SLASH_MS);
    const shown = (a: Actor): Point => {
      const p = { x: a.fromX + (a.x - a.fromX) * progress, y: a.fromY + (a.y - a.fromY) * progress };
      // Élan : l'attaquant avance d'un tiers de case vers sa cible, puis revient.
      const s = this.slashes.find((sl) => sl.attackerId === a.id);
      if (s) {
        const push = 0.32 * Math.sin((Math.PI * s.age) / SLASH_MS);
        p.x += Math.sign(s.x - s.fromX) * push;
        p.y += Math.sign(s.y - s.fromY) * push;
      }
      return p;
    };
    const hero = shown(game.hero);
    const follow = 1 - Math.exp(-dt / 140);
    this.camX += (hero.x + this.panX - this.camX) * follow;
    this.camY += (hero.y + this.panY - this.camY) * follow;
    const ox = this.originX();
    const oy = this.originY();
    // Vacillement des torches : deux ondes lentes superposées.
    const flicker = 0.85 + 0.1 * Math.sin(this.time / 110) + 0.05 * Math.sin(this.time / 37);

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, this.width, this.height);

    const x0 = Math.floor(-ox / tile);
    const y0 = Math.floor(-oy / tile);
    const x1 = Math.ceil((this.width - ox) / tile);
    const y1 = Math.ceil((this.height - oy) / tile);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!game.map.inBounds(x, y)) continue;
        const sx = ox + x * tile;
        const sy = oy + y * tile;
        if (!game.isExplored(x, y)) {
          // Passage deviné mais jamais vu : une trace très estompée.
          if (game.isSensed(x, y)) {
            ctx.fillStyle = COLORS.sensed;
            ctx.fillRect(sx + tile * 0.12, sy + tile * 0.12, tile * 0.76, tile * 0.76);
          }
          continue;
        }
        const t = game.map.get(x, y);
        const wall = t === Tile.Wall;
        if (t === Tile.Pillar) {
          // Colonne : une dalle de sol, et un fût de pierre rond vu du dessus.
          this.drawFloor(x, y, sx, sy);
          ctx.fillStyle = "rgba(12,11,18,0.45)";
          ctx.beginPath();
          ctx.arc(sx + tile * 0.54, sy + tile * 0.56, tile * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#6e7290";
          ctx.beginPath();
          ctx.arc(sx + tile * 0.5, sy + tile * 0.5, tile * 0.38, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#9296b6";
          ctx.beginPath();
          ctx.arc(sx + tile * 0.46, sy + tile * 0.45, tile * 0.25, 0, Math.PI * 2);
          ctx.fill();
        } else
        if (wall) {
          this.drawWall(game, x, y, sx, sy);
        } else {
          this.drawFloor(x, y, sx, sy);
        }
        this.drawFeature(game, t, x, y, sx, sy);
        // Les murs restent lisibles même dans l'ombre : on les assombrit moins que le sol.
        const shade = wall || t === Tile.Pillar ? 0.6 : 1;

        if (game.isVisible(x, y)) {
          // Luminosité : la lueur du héros, qui décroît avec la distance, ou l'éclairage d'une torche.
          const lit = game.light[game.map.index(x, y)];
          const glow = Math.max(0, 1 - Math.hypot(x - hero.x, y - hero.y) / (game.race.darkVision + 1.5));
          const brightness = Math.min(1, Math.max(lit * flicker, glow));
          ctx.fillStyle = `rgba(12,11,18,${((1 - brightness) * 0.55 * shade).toFixed(3)})`;
          ctx.fillRect(sx, sy, tile, tile);
          if (lit > 0) {
            ctx.fillStyle = `rgba(255,150,60,${(lit * flicker * 0.2).toFixed(3)})`;
            ctx.fillRect(sx, sy, tile, tile);
          }
        } else {
          // Déjà visité mais hors de vue : un voile nettement plus sombre que la pénombre de ce qu'on voit,
          // pour distinguer d'un coup d'œil le souvenir du présent (les murs restent devinables).
          ctx.fillStyle = `rgba(8,7,14,${(wall || t === Tile.Pillar ? 0.72 : 0.82).toFixed(3)})`;
          ctx.fillRect(sx, sy, tile, tile);
        }
      }
    }

    // Torches murales : une flamme qui vacille.
    for (const torch of game.torches) {
      if (!game.isExplored(torch.x, torch.y)) continue;
      const fx = torch.faceX;
      const fy = torch.faceY;
      // La tige part de la limite du mur (côté salle) et la flamme brûle vers l'intérieur du mur.
      const baseX = ox + (torch.x + 0.5 + fx * 0.47) * tile;
      const baseY = oy + (torch.y + 0.5 + fy * 0.47) * tile;
      const cx = ox + (torch.x + 0.5 + fx * 0.22) * tile;
      const cy = oy + (torch.y + 0.5 + fy * 0.22) * tile;
      ctx.strokeStyle = "#6b4a2a";
      ctx.lineWidth = Math.max(2, tile * 0.09);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(ox + (torch.x + 0.5 + fx * 0.32) * tile, oy + (torch.y + 0.5 + fy * 0.32) * tile);
      ctx.stroke();
      ctx.lineCap = "butt";
      ctx.fillStyle = "#ff8a2a";
      ctx.beginPath();
      ctx.arc(cx, cy, tile * 0.16 * flicker, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffe08a";
      ctx.beginPath();
      ctx.arc(cx, cy + tile * 0.02, tile * 0.08 * flicker, 0, Math.PI * 2);
      ctx.fill();
    }

    // Porte verrouillée en attente de décision : un cadre doré.
    if (game.pendingDoor) {
      ctx.strokeStyle = COLORS.lock;
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + game.pendingDoor.x * tile + 1, oy + game.pendingDoor.y * tile + 1, tile - 2, tile - 2);
    }

    // Chemin prévu : des points, et un rond sur la destination.
    ctx.fillStyle = COLORS.path;
    game.path.forEach((p, i) => {
      const last = i === game.path.length - 1;
      ctx.beginPath();
      ctx.arc(ox + (p.x + 0.5) * tile, oy + (p.y + 0.5) * tile, tile * (last ? 0.22 : 0.08), 0, Math.PI * 2);
      ctx.fill();
    });

    // Flèches brisées : deux morceaux qui s'effacent doucement au fil des tours.
    for (const d of game.debris) {
      if (!game.isExplored(d.x, d.y)) continue;
      const left = d.until - game.turn + (1 - progress);
      ctx.globalAlpha = Math.max(0, Math.min(1, left / RULES.brokenArrowFadeTurns));
      const cx = ox + (d.x + 0.5) * tile;
      const cy = oy + (d.y + 0.5) * tile;
      this.drawArrow(cx + Math.cos(d.angle) * tile * 0.16, cy + Math.sin(d.angle) * tile * 0.16, d.angle + 0.5, tile * 0.7, "front");
      this.drawArrow(cx - Math.cos(d.angle) * tile * 0.16, cy - Math.sin(d.angle) * tile * 0.16, d.angle - 0.35, tile * 0.7, "back");
    }
    ctx.globalAlpha = 1;

    // Objets au sol : flèches à ramasser, clef.
    for (const g of game.ground) {
      if (!game.isExplored(g.x, g.y)) continue;
      const gx = ox + g.x * tile;
      const gy = oy + g.y * tile;
      if (g.item === "clef") {
        ctx.fillStyle = COLORS.lock;
        ctx.beginPath();
        ctx.arc(gx + tile * 0.36, gy + tile * 0.4, tile * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(gx + tile * 0.45, gy + tile * 0.37, tile * 0.3, tile * 0.07);
        ctx.fillRect(gx + tile * 0.66, gy + tile * 0.4, tile * 0.07, tile * 0.13);
        ctx.fillStyle = COLORS.floor;
        ctx.beginPath();
        ctx.arc(gx + tile * 0.36, gy + tile * 0.4, tile * 0.05, 0, Math.PI * 2);
        ctx.fill();
      } else if (g.item === "or") {
        // Pièces d'or : deux ou trois petits disques brillants.
        for (const [dx, dy] of g.count > 1 ? [[0.38, 0.56], [0.6, 0.48], [0.5, 0.66]] : [[0.5, 0.56]]) {
          ctx.fillStyle = "#a87c1c";
          ctx.beginPath();
          ctx.arc(gx + dx * tile, gy + dy * tile + tile * 0.03, tile * 0.12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#f0c050";
          ctx.beginPath();
          ctx.arc(gx + dx * tile, gy + dy * tile, tile * 0.12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff3c8";
          ctx.fillRect(gx + (dx - 0.05) * tile, gy + (dy - 0.06) * tile, tile * 0.05, tile * 0.05);
        }
      } else {
        // Flèche au sol, tournée dans le sens où elle est tombée ou s'est plantée.
        this.drawArrow(gx + tile / 2, gy + tile / 2, g.angle ?? -Math.PI / 4, tile * 0.8);
      }
    }

    // Monstres en vue : un losange de la couleur de leur fiche.
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const m of [...game.visibleMonsters(), ...ghosts]) {
      const p = shown(m);
      const cx = ox + (p.x + 0.5) * tile;
      const cy = oy + (p.y + 0.5) * tile;
      const r = tile * 0.36;
      ctx.fillStyle = MONSTERS[m.defId as keyof typeof MONSTERS]?.color ?? "#c04040";
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
      // Liseré doré qui palpite : le héros aurait l'avantage en l'attaquant maintenant.
      if (game.heroHasAdvantageOn(m)) {
        ctx.strokeStyle = `rgba(255,215,94,${(0.55 + 0.4 * Math.sin(this.time / 160)).toFixed(2)})`;
        ctx.lineWidth = Math.max(2, tile * 0.07);
        ctx.stroke();
      }
      if (!m.alerted) {
        // « z » : il dort. « ? » : il se promène sans avoir remarqué le héros.
        ctx.fillStyle = "#ffffff";
        ctx.font = `${Math.round(tile * 0.55)}px "VT323", "Courier New", monospace`;
        ctx.fillText(m.asleep ? "z" : "?", cx + tile * 0.3, cy - tile * 0.3);
      }
      if (m.hp < m.maxHp) {
        ctx.fillStyle = COLORS.hpBack;
        ctx.fillRect(cx - tile * 0.35, cy - tile * 0.48, tile * 0.7, tile * 0.08);
        ctx.fillStyle = COLORS.hpFill;
        ctx.fillRect(cx - tile * 0.35, cy - tile * 0.48, tile * 0.7 * Math.max(0, m.hp / m.maxHp), tile * 0.08);
      }
    }

    // Mode arc : un viseur encadre chaque monstre à portée de tir.
    if (aimRange !== null) {
      for (const m of game.visibleMonsters()) {
        if (Math.max(Math.abs(m.x - game.hero.x), Math.abs(m.y - game.hero.y)) > aimRange) continue;
        const p = shown(m);
        // La cible visée d'office (celle que le second appui sur la flèche touchera) : viseur épais, rouge, qui palpite.
        const locked = m === aimTarget;
        ctx.strokeStyle = locked ? "#ff5a4a" : "#ffd75e";
        ctx.lineWidth = Math.max(2, tile * (locked ? 0.12 + 0.03 * Math.sin(this.time / 120) : 0.06));
        const x0 = ox + p.x * tile + 1;
        const y0 = oy + p.y * tile + 1;
        const s = tile - 2;
        const c = tile * 0.28;
        ctx.beginPath();
        for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x0 + s, y0, -1, 1], [x0, y0 + s, 1, -1], [x0 + s, y0 + s, -1, -1]]) {
          ctx.moveTo(cx + dx * c, cy);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx, cy + dy * c);
        }
        ctx.stroke();
      }
    }

    // Héros : un disque vert.
    ctx.fillStyle = COLORS.hero;
    ctx.strokeStyle = COLORS.heroEdge;
    ctx.lineWidth = Math.max(2, tile * 0.08);
    ctx.beginPath();
    ctx.arc(ox + (hero.x + 0.5) * tile, oy + (hero.y + 0.5) * tile, tile * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Liseré rouge : le héros se tient dans une porte, les ennemis ont l'avantage sur lui.
    if (game.heroExposed()) {
      ctx.strokeStyle = `rgba(255,90,100,${(0.55 + 0.4 * Math.sin(this.time / 160)).toFixed(2)})`;
      ctx.lineWidth = Math.max(2, tile * 0.07);
      ctx.beginPath();
      ctx.arc(ox + (hero.x + 0.5) * tile, oy + (hero.y + 0.5) * tile, tile * 0.44, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Coups d'épée ou de griffe : un arc qui balaie la case visée, perpendiculaire à la direction du coup.
    // Flèches en vol : un trait qui file de l'archer vers sa cible.
    this.projectiles = this.projectiles.filter((p) => (p.age += dt) < PROJECTILE_MS);
    for (const p of this.projectiles) {
      if (p.age < 0) continue;
      const t = p.age / PROJECTILE_MS;
      const px = ox + (p.fromX + (p.x - p.fromX) * t + 0.5) * tile;
      const py = oy + (p.fromY + (p.y - p.fromY) * t + 0.5) * tile;
      const heading = Math.atan2(p.y - p.fromY, p.x - p.fromX);
      // En vol, la pointe suit la trajectoire ; après un rebond, la flèche tournoie en retombant.
      if (!p.tumble) {
        // Traînée claire derrière la flèche : on lit d'un coup d'œil d'où elle vient.
        const trail = Math.min(tile * 1.4, Math.hypot(p.x - p.fromX, p.y - p.fromY) * tile * t);
        const grad = ctx.createLinearGradient(px, py, px - Math.cos(heading) * trail, py - Math.sin(heading) * trail);
        grad.addColorStop(0, "rgba(255,244,214,0.55)");
        grad.addColorStop(1, "rgba(255,244,214,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1.5, tile * 0.07);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - Math.cos(heading) * trail, py - Math.sin(heading) * trail);
        ctx.stroke();
      }
      this.drawArrow(px, py, p.tumble ? heading + Math.PI + t * 7 : heading, tile * 0.8);
    }

    for (const s of this.slashes) {
      if (!s.arc) continue;
      const t = s.age / SLASH_MS;
      const cx = ox + (s.x + 0.5) * tile;
      const cy = oy + (s.y + 0.5) * tile;
      const facing = Math.atan2(s.y - s.fromY, s.x - s.fromX);
      const sweep = Math.min(1, t * 1.6); // la lame parcourt l'arc pendant les deux premiers tiers
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = 1 - t * t;
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(2, tile * 0.11 * (1 - t * 0.6));
      ctx.beginPath();
      ctx.arc(cx - Math.cos(facing) * tile * 0.25, cy - Math.sin(facing) * tile * 0.25, tile * 0.42, facing - 1.1, facing - 1.1 + 2.2 * sweep);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";

    // Textes flottants.
    ctx.font = `${Math.round(Math.max(18, tile * 0.6))}px "VT323", "Courier New", monospace`;
    this.floats = this.floats.filter((f) => (f.age += dt) < FLOAT_MS);
    for (const f of this.floats) {
      const t = f.age / FLOAT_MS;
      ctx.globalAlpha = 1 - t * t;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      const fx = ox + (f.x + 0.5) * tile;
      const fy = oy + (f.y + 0.1 - t * 0.8) * tile;
      ctx.strokeText(f.text, fx, fy);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, fx, fy);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Sol en dalles de pierre : chaque case est une dalle de teinte légèrement différente ; quelques-unes sont
   * fissurées ou parsemées de gravillons. Le tirage est fixe pour une case donnée.
   */
  private drawFloor(x: number, y: number, sx: number, sy: number): void {
    const { ctx, tile } = this;
    const u = tile / 16; // le dessin est pensé sur une grille de 16 « pixels »
    const px = (gx: number, gy: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(sx + gx * u, sy + gy * u, w * u + 0.5, h * u + 0.5);
    };
    // Joint sombre, puis la dalle de pierre grise, d'une teinte un peu différente à chaque case.
    px(0, 0, 16, 16, "#37312e");
    const light = 0.9 + 0.2 * noise(x, y, 20);
    const tint = (r: number, g: number, b: number) => `rgb(${Math.round(r * light)},${Math.round(g * light)},${Math.round(b * light)})`;
    px(0.5, 0.5, 15, 15, tint(104, 97, 92));
    // Arêtes : un filet clair en haut et à gauche, sombre en bas et à droite.
    px(0.5, 0.5, 15, 1, tint(124, 117, 110));
    px(0.5, 0.5, 1, 15, tint(118, 111, 105));
    px(0.5, 14.5, 15, 1, tint(80, 74, 70));
    px(14.5, 0.5, 1, 15, tint(86, 80, 76));
    // Coins ébréchés, au hasard.
    for (const [i, cx, cy] of [[0, 0.5, 0.5], [1, 14.5, 0.5], [2, 0.5, 14.5], [3, 14.5, 14.5]]) {
      if (noise(x, y, 50 + i) < 0.4) px(cx, cy, 1, 1, "#37312e");
    }
    // Stries en biais sur la pierre : quelques éraflures claires (gris-bleu), une plus chaude, une sombre.
    const streaks = 3 + Math.floor(noise(x, y, 21) * 3);
    for (let i = 0; i < streaks; i++) {
      const ax = 2 + Math.floor(noise(x, y, 60 + i) * 9);
      const ay = 5 + Math.floor(noise(x, y, 70 + i) * 8);
      const len = 2 + Math.floor(noise(x, y, 80 + i) * 4);
      const color = i === 0 ? tint(150, 140, 104) : i === 1 ? tint(78, 72, 68) : tint(128, 136, 142);
      for (let k = 0; k < len; k++) {
        if (ay - k >= 2 && ax + k <= 13) px(ax + k, ay - k, 1, 1, color);
      }
    }
    const kind = noise(x, y, 22);
    if (kind < 0.05) {
      // Dalle fêlée, rare : une fissure en biais d'un bord à l'autre.
      let cy = 3 + Math.floor(noise(x, y, 24) * 4);
      for (let cx = 1; cx <= 14; cx++) {
        px(cx, cy, 1, 1, "#2e2926");
        if (noise(x + cx, y, 25) < 0.55) cy = Math.min(13, cy + 1);
        if (cy > 12 && cx > 9) break;
      }
    } else if (kind < 0.065) {
      // Dalle brisée, très rare : un trou sombre et un éclat de pierre de travers.
      px(4, 6, 8, 6, "#2e2926");
      px(3, 8, 2, 3, "#2e2926");
      px(6, 5, 4, 1, "#2e2926");
      px(7, 8, 5, 3, tint(118, 111, 105));
      px(8, 7, 3, 1, tint(118, 111, 105));
      px(5, 10, 2, 1, tint(96, 90, 85));
    }
  }

  /**
   * Mur de pierres : trois assises de hauteurs inégales, des joints placés au hasard (mais toujours au même
   * endroit pour une case donnée), des pierres aux coins décalés et de teintes légèrement différentes. Les murs voisins se raccordent :
   * pas de bordure entre deux cases de mur, un rebord clair seulement là où le mur s'arrête.
   */
  private drawWall(game: Game, x: number, y: number, sx: number, sy: number): void {
    const { ctx, tile } = this;
    const gap = Math.max(1, tile * 0.05);
    ctx.fillStyle = COLORS.mortar;
    ctx.fillRect(sx, sy, tile + 0.5, tile + 0.5);
    // Trois assises de hauteurs inégales (les mêmes sur toute la ligne de la carte, pour que les murs se raccordent).
    const levels = [0, 0.29 + 0.1 * noise(y, 0, 4), 0.62 + 0.1 * noise(y, 0, 5), 1];
    ctx.lineJoin = "round";
    for (let r = 0; r < 3; r++) {
      const row = y * 3 + r;
      const cuts = [0, 0.2 + 0.14 * noise(x, row, 1), 0.64 + 0.14 * noise(x, row, 3), 1];
      for (let i = 0; i + 1 < cuts.length; i++) {
        const first = i === 0;
        const last = i + 2 === cuts.length;
        // Les pierres du bord continuent dans la case voisine : même teinte des deux côtés, pas de joint.
        const tint = first ? noise(x, row, 9) : last ? noise(x + 1, row, 9) : noise(x, row, 10 + i);
        const light = 0.84 + 0.3 * tint;
        const color = `rgb(${Math.round(103 * light)},${Math.round(107 * light)},${Math.round(136 * light)})`;
        const left = sx + cuts[i] * tile + (first ? 0 : gap / 2);
        const right = sx + cuts[i + 1] * tile - (last ? -0.5 : gap / 2);
        const top = sy + levels[r] * tile + gap / 2;
        const bottom = sy + levels[r + 1] * tile - gap / 2;
        // Pierre taillée à la main : chaque coin est légèrement décalé, et les arêtes sont adoucies.
        const j = (k: number) => (noise(x * 4 + i, row, 50 + k) - 0.5) * tile * 0.07;
        const soft = Math.max(1, tile * 0.05);
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = soft;
        ctx.beginPath();
        ctx.moveTo(left + (first ? 0 : soft / 2 + Math.abs(j(0))), top + soft / 2 + Math.abs(j(1)));
        ctx.lineTo(right - (last ? 0 : soft / 2 + Math.abs(j(2))), top + soft / 2 + Math.abs(j(3)));
        ctx.lineTo(right - (last ? 0 : soft / 2 + Math.abs(j(4))), bottom - soft / 2 - Math.abs(j(5)));
        ctx.lineTo(left + (first ? 0 : soft / 2 + Math.abs(j(6))), bottom - soft / 2 - Math.abs(j(7)));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.lineJoin = "miter";
    // Rebord clair en haut et ombre en bas, uniquement là où le mur s'arrête.
    if (game.map.inBounds(x, y - 1) && game.map.get(x, y - 1) !== Tile.Wall) {
      ctx.fillStyle = "rgba(190,196,230,0.35)";
      ctx.fillRect(sx, sy, tile + 0.5, tile * 0.1);
    }
    if (game.map.inBounds(x, y + 1) && game.map.get(x, y + 1) !== Tile.Wall) {
      ctx.fillStyle = "rgba(12,11,18,0.4)";
      ctx.fillRect(sx, sy + tile * 0.88, tile + 0.5, tile * 0.12 + 0.5);
    }
  }

  /**
   * Porte : battant de planches cerclé de fer, avec anneau de poignée ou cadenas doré. Le battant est le même
   * partout ; ce qui suit le mur, ce sont les montants de pierre et le côté où le battant se rabat en s'ouvrant.
   */
  private drawDoor(game: Game, t: Tile, x: number, y: number, sx: number, sy: number): void {
    const { ctx, tile } = this;
    // Si les murs sont au-dessus et en dessous, la porte est dans un mur latéral.
    const sideways = !game.map.isWalkable(x, y - 1) && !game.map.isWalkable(x, y + 1);
    ctx.save();
    ctx.translate(sx + tile / 2, sy + tile / 2);
    const u = tile / 16; // le dessin est pensé sur une grille de 16 « pixels »
    const px = (gx: number, gy: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect((gx - 8) * u, (gy - 8) * u, w * u + 0.5, h * u + 0.5);
    };
    // Seuil sombre, puis montants de pierre du côté des murs : en haut et en bas pour un mur latéral,
    // à gauche et à droite sinon.
    px(0, 0, 16, 16, "#2a2533");
    if (sideways) {
      px(0, 0, 16, 2, "#8b90b0");
      px(0, 14, 16, 2, "#8b90b0");
    } else {
      px(0, 0, 2, 16, "#8b90b0");
      px(14, 0, 2, 16, "#8b90b0");
    }
    // Le battant occupe l'espace entre les montants.
    const x0 = sideways ? 1 : 2;
    const y0 = sideways ? 2 : 1;
    const w = sideways ? 14 : 12;
    const h = sideways ? 12 : 14;
    if (t === Tile.DoorOpen) {
      // Ouverte : le battant est rabattu contre un montant, dans le sens du passage.
      if (sideways) {
        px(x0, y0, w, 3, "#8a5a2b");
        px(x0, y0, w, 1, "#b9824a");
        px(x0 + 3, y0, 1, 3, "#4a4e5e");
        px(x0 + w - 4, y0, 1, 3, "#4a4e5e");
      } else {
        px(x0, y0, 3, h, "#8a5a2b");
        px(x0, y0, 1, h, "#b9824a");
        px(x0, y0 + 3, 3, 1, "#4a4e5e");
        px(x0, y0 + h - 4, 3, 1, "#4a4e5e");
      }
    } else {
      // Fermée : le même battant partout. Planches verticales et leurs joints.
      px(x0, y0, w, h, "#8a5a2b");
      for (let gx = x0; gx < x0 + w; gx += 3) px(gx, y0, 1, h, "#b9824a");
      for (let gx = x0 + 2; gx < x0 + w; gx += 3) px(gx, y0, 1, h, "#5a3817");
      // Deux ferrures et leurs rivets.
      for (const gy of [y0 + 2, y0 + h - 4]) {
        px(x0, gy, w, 2, "#4a4e5e");
        px(x0, gy, w, 1, "#7a7f94");
        for (const gx of [x0 + 1, x0 + Math.floor(w / 2), x0 + w - 2]) px(gx, gy, 1, 1, "#c3cbe0");
      }
      if (t === Tile.DoorLocked) {
        // Cadenas doré.
        px(6, 6, 4, 1, "#f0c050");
        px(6, 6, 1, 2, "#f0c050");
        px(9, 6, 1, 2, "#f0c050");
        px(5, 8, 6, 3, "#f0c050");
        px(5, 10, 6, 1, "#a87c1c");
        px(7, 8, 2, 2, "#1c1410");
      } else {
        // Anneau de poignée.
        px(10, 7, 2, 1, "#c3cbe0");
        px(10, 9, 2, 1, "#c3cbe0");
        px(10, 7, 1, 3, "#c3cbe0");
        px(12, 8, 1, 1, "#c3cbe0");
      }
    }
    ctx.restore();
  }

  /** Escalier, fontaine et coffre, dessinés par-dessus le sol. */
  private drawFeature(game: Game, t: Tile, x: number, y: number, sx: number, sy: number): void {
    const { ctx, tile } = this;
    if (t === Tile.StairsDown) {
      ctx.fillStyle = COLORS.stairs;
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(sx + tile * 0.15, sy + tile * (0.2 + i * 0.22), tile * (0.3 + i * 0.2), tile * 0.14);
      }
    } else if (t === Tile.StairsUp) {
      // Escalier qui remonte : marches claires qui se resserrent vers le haut.
      ctx.fillStyle = "#b9c0dc";
      for (let i = 0; i < 3; i++) {
        const w = tile * (0.7 - i * 0.2);
        ctx.fillRect(sx + tile * 0.85 - w, sy + tile * (0.64 - i * 0.22), w, tile * 0.14);
      }
    } else if (t === Tile.DoorClosed || t === Tile.DoorLocked || t === Tile.DoorOpen) {
      this.drawDoor(game, t, x, y, sx, sy);
    } else if (t === Tile.Fountain || t === Tile.FountainDry) {
      // Fontaine : une vasque de pierre, pleine d'eau claire ou à sec.
      const cx = sx + tile / 2;
      const cy = sy + tile / 2;
      ctx.fillStyle = "#8a8ea8";
      ctx.beginPath();
      ctx.arc(cx, cy, tile * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t === Tile.Fountain ? "#4fb4e8" : "#3a3c4e";
      ctx.beginPath();
      ctx.arc(cx, cy, tile * 0.28, 0, Math.PI * 2);
      ctx.fill();
      if (t === Tile.Fountain) {
        ctx.fillStyle = "#c8ecff";
        ctx.beginPath();
        ctx.arc(cx - tile * 0.08, cy - tile * 0.08, tile * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (t === Tile.Chest || t === Tile.ChestOpen) {
      // Coffre : fermé avec sa ferrure dorée, ou ouvert et sombre.
      ctx.fillStyle = COLORS.doorEdge;
      ctx.fillRect(sx + tile * 0.18, sy + tile * 0.3, tile * 0.64, tile * 0.46);
      ctx.fillStyle = t === Tile.Chest ? COLORS.door : "#1c1410";
      ctx.fillRect(sx + tile * 0.22, sy + tile * 0.34, tile * 0.56, t === Tile.Chest ? tile * 0.38 : tile * 0.2);
      if (t === Tile.Chest) {
        ctx.fillStyle = COLORS.lock;
        ctx.fillRect(sx + tile * 0.18, sy + tile * 0.47, tile * 0.64, tile * 0.06);
        ctx.fillRect(sx + tile * 0.45, sy + tile * 0.44, tile * 0.1, tile * 0.14);
      }
    }
  }
}
