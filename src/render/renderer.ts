import { LightSource } from "../world/fov";
import { Game } from "../core/game";
import { MONSTERS } from "../data/monsters";
import { RULES } from "../data/rules";
import { Actor } from "../entities/actor";
import { Point, Tile } from "../world/map";
import { GUERRIER, GUERRIER_PALETTE } from "./sprites/guerrier";
import { PALETTE as ICON_PALETTE, uiIconRows } from "../ui/icons";
import { DECOR, DECOR_PALETTE } from "./sprites/decor";

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
  sensed: "rgba(75,69,96,0.3)",
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
/** Durée du geste de tir à l'arc, et de la grimace quand le héros est blessé. */
const BOW_MS = 320;
const HURT_MS = 260;
type Facing = "down" | "up" | "left" | "right";

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
  /** Animation du héros : de quel côté il regarde, et depuis combien de temps il tire ou encaisse. */
  private heroFacing: Facing = "down";
  private bowAge = Infinity;
  private hurtAge = Infinity;
  private heroDown = false;
  private readonly spriteCache = new Map<readonly string[], HTMLCanvasElement>();

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
    this.bowAge = Infinity;
    this.hurtAge = Infinity;
    this.heroDown = game.over && game.hero.hp <= 0;
  }

  /** Le héros tire à l'arc dans cette direction : il se tourne et tend son arc. */
  heroShoots(dx: number, dy: number): void {
    this.face(dx, dy);
    this.bowAge = 0;
  }

  /** Le héros vient d'être blessé. */
  heroHurt(): void {
    this.hurtAge = 0;
  }

  /** Le héros est tombé : il reste étendu au sol. */
  heroFalls(): void {
    this.heroDown = true;
  }

  private face(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    this.heroFacing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  }

  /** Une image de sprite (rangées de lettres) peinte une fois pour toutes sur un petit canevas 16×16. */
  private sprite(rows: readonly string[], palette: Record<string, string> = GUERRIER_PALETTE): HTMLCanvasElement {
    let c = this.spriteCache.get(rows);
    if (!c) {
      c = document.createElement("canvas");
      c.width = rows[0].length;
      c.height = rows.length;
      const g = c.getContext("2d")!;
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const color = palette[row[x]];
          if (!color) continue;
          g.fillStyle = color;
          g.fillRect(x, y, 1, 1);
        }
      });
      this.spriteCache.set(rows, c);
    }
    return c;
  }

  /** Le héros : son sprite selon ce qu'il fait (repos, marche, coup d'épée, tir, blessure, mort) et où il regarde. */
  private drawHero(game: Game, at: Point, ox: number, oy: number, progress: number): void {
    const { ctx, tile } = this;
    const h = game.hero;
    const mdx = h.x - h.fromX;
    const mdy = h.y - h.fromY;
    const moving = progress < 1 && (mdx !== 0 || mdy !== 0);
    const slash = this.slashes.find((sl) => sl.attackerId === h.id);
    if (slash) this.face(slash.x - slash.fromX, slash.y - slash.fromY);
    else if (moving && this.bowAge >= BOW_MS) this.face(mdx, mdy);
    const dir = this.heroFacing === "down" ? "Down" : this.heroFacing === "up" ? "Up" : "Side";
    let rows: readonly string[];
    if (this.heroDown) rows = GUERRIER.dead[0];
    else if (this.hurtAge < HURT_MS) rows = GUERRIER.hurt[0];
    else if (slash) rows = GUERRIER[`sword${dir}`][Math.min(2, Math.floor((3 * slash.age) / SLASH_MS))];
    else if (this.bowAge < BOW_MS) rows = GUERRIER[`bow${dir}`][this.bowAge < BOW_MS * 0.5 ? 0 : 1];
    else if (moving) rows = GUERRIER[`walk${dir}`][(((h.x + h.y) & 1) * 2 + (progress < 0.5 ? 0 : 1)) % 4];
    else {
      const idle = GUERRIER[`idle${dir}`];
      // Le temps peut être très légèrement négatif à la toute première image : on prend sa valeur absolue.
      rows = idle[Math.floor(Math.abs(this.time) / 520) % idle.length];
    }
    const cx = ox + (at.x + 0.5) * tile;
    const cy = oy + (at.y + 0.5) * tile;
    // Ombre au sol.
    ctx.fillStyle = "rgba(10,8,16,0.45)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + tile * 0.4, tile * 0.3, tile * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    // Le sprite dépasse un peu de sa case pour que le personnage ait la taille d'un occupant, armes comprises.
    const size = Math.round(tile * 1.3);
    const top = Math.round(cy - size / 2 - tile * 0.12);
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(Math.round(cx), 0);
    if (this.heroFacing === "left") ctx.scale(-1, 1);
    // Caché : le héros devient gris et à demi effacé.
    if (game.hidden) {
      ctx.globalAlpha = 0.55;
      ctx.filter = "grayscale(1) brightness(0.8)";
    }
    ctx.drawImage(this.sprite(rows), -size / 2, top, size, size);
    ctx.restore();
    ctx.imageSmoothingEnabled = smooth;
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
      // Empennage : deux pennes bleues couchées vers l'arrière, qui laissent une encoche en V au talon.
      for (const side of [-1, 1]) {
        shape(side < 0 ? "#6aa8e0" : "#3a6fb0", [[-L * 0.2, (side * w) / 2], [-L * 0.34, side * w * 2.4], [-L * 0.56, side * w * 2.4], [-L * 0.44, (side * w) / 2]]);
      }
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

  /** Fouille : une vague dorée balaie les cases de la salle depuis le héros, puis les trouvailles scintillent. */
  private scan: { cells: { x: number; y: number; d: number }[]; age: number; found: Point[] } | null = null;

  scanRoom(room: { x: number; y: number; w: number; h: number }, from: Point, found: Point[]): void {
    const cells: { x: number; y: number; d: number }[] = [];
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) cells.push({ x, y, d: Math.hypot(x - from.x, y - from.y) });
    }
    this.scan = { cells, age: 0, found };
  }

  /** Cases proposées pour se dégager (roue d'actions) : encadrées en doré tant qu'on n'a pas choisi. */
  jumpCells: Point[] = [];

  /** Centre d'une case de la carte, en pixels dans le canvas. */
  tileCenter(x: number, y: number): Point {
    return { x: this.originX() + (x + 0.5) * this.tile, y: this.originY() + (y + 0.5) * this.tile };
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
    this.bowAge += dt;
    this.hurtAge += dt;
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
        // Les voiles d'ombre et de lumière sont calés sur les pixels entiers : deux cases voisines ne laissent
        // ni jour ni recouvrement, donc aucune ligne claire ou sombre à leur jonction.
        const rx = Math.round(sx);
        const ry = Math.round(sy);
        const rw = Math.round(sx + tile) - rx;
        const rh = Math.round(sy + tile) - ry;
        // Chaque case est dessinée découpée sur ces mêmes pixels entiers : rien ne déborde sur une voisine déjà ombrée.
        ctx.save();
        ctx.beginPath();
        ctx.rect(rx, ry, rw, rh);
        ctx.clip();
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
        ctx.restore();
        // Les murs restent lisibles même dans l'ombre : on les assombrit moins que le sol.
        const shade = wall || t === Tile.Pillar ? 0.6 : 1;

        if (game.isVisible(x, y)) {
          // Luminosité : la lueur du héros, qui décroît avec la distance, ou l'éclairage d'une torche.
          // Un mur ne montre que la lumière qui tombe sur la face qu'on regarde : celle des cases dégagées
          // en vue qui le touchent. Le feu d'une salle qu'on ne voit pas ne colore pas l'autre côté du mur.
          const lit = wall ? this.wallLight(game, x, y) : game.light[game.map.index(x, y)];
          const glow = Math.max(0, 1 - Math.hypot(x - hero.x, y - hero.y) / (game.race.darkVision + 1.5));
          const brightness = Math.min(1, Math.max(lit * flicker, glow));
          ctx.fillStyle = `rgba(12,11,18,${((1 - brightness) * 0.55 * shade).toFixed(3)})`;
          ctx.fillRect(rx, ry, rw, rh);
          if (lit > 0) {
            ctx.fillStyle = `rgba(255,150,60,${(lit * flicker * 0.2).toFixed(3)})`;
            ctx.fillRect(rx, ry, rw, rh);
          }
        } else {
          // Déjà visité mais hors de vue : un voile nettement plus sombre que la pénombre de ce qu'on voit,
          // pour distinguer d'un coup d'œil le souvenir du présent (les murs restent devinables).
          ctx.fillStyle = `rgba(8,7,14,${(wall || t === Tile.Pillar ? 0.72 : 0.82).toFixed(3)})`;
          ctx.fillRect(rx, ry, rw, rh);
        }
      }
    }

    // Torches murales : une flamme qui vacille.
    for (const torch of game.torches) {
      if (!game.isExplored(torch.x, torch.y)) continue;
      if (torch.hearth) {
        // Tant qu'on n'a pas vu la salle qu'elle chauffe, on ne voit que le dos du mur : ni foyer ni flammes.
        if (!game.isExplored(torch.x + torch.faceX, torch.y + torch.faceY)) continue;
        this.drawHearth(game, torch, ox + torch.x * tile, oy + torch.y * tile, flicker);
        continue;
      }
      const fx = torch.faceX;
      const fy = torch.faceY;
      // Une torche est accrochée du côté de sa salle : depuis l'autre côté du mur, on ne voit ni tige ni flamme.
      if (!game.isExplored(torch.x + fx, torch.y + fy)) continue;
      const burning = game.isVisible(torch.x + fx, torch.y + fy);
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
      // La flamme ne se voit danser que si l'on a la salle sous les yeux.
      if (!burning) continue;
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
        // Or : une petite bourse de cuir fermée par une cordelette.
        const u = tile / 16;
        const px = (bx: number, by: number, w: number, h: number, color: string) => {
          ctx.fillStyle = color;
          ctx.fillRect(gx + bx * u, gy + by * u, w * u + 0.5, h * u + 0.5);
        };
        px(5, 7, 7, 7, "#120d08"); // contour
        px(4, 8, 9, 5, "#120d08");
        px(6, 4, 5, 3, "#120d08");
        px(5, 8, 7, 5, "#9a6a34"); // panse
        px(6, 7, 5, 7, "#9a6a34");
        px(10, 9, 2, 4, "#5a3817"); // ombre
        px(7, 13, 4, 1, "#5a3817");
        px(6, 9, 1, 3, "#b9824a"); // reflet
        px(7, 8, 1, 1, "#b9824a");
        px(7, 4, 3, 2, "#9a6a34"); // col froncé
        px(6, 6, 5, 1, "#e6dcc0"); // cordelette
        px(11, 7, 1, 2, "#e6dcc0");
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

    // Se dégager : les cases d'arrivée possibles, encadrées d'un doré qui palpite.
    if (this.jumpCells.length > 0) {
      ctx.fillStyle = `rgba(255,215,94,${(0.16 + 0.1 * Math.sin(this.time / 140)).toFixed(2)})`;
      ctx.strokeStyle = "#ffd75e";
      ctx.lineWidth = Math.max(2, tile * 0.07);
      for (const c of this.jumpCells) {
        const x0 = Math.round(ox + c.x * tile);
        const y0 = Math.round(oy + c.y * tile);
        ctx.fillRect(x0 + 2, y0 + 2, Math.round(tile) - 4, Math.round(tile) - 4);
        ctx.strokeRect(x0 + 3, y0 + 3, Math.round(tile) - 6, Math.round(tile) - 6);
      }
    }

    // Héros : son sprite animé.
    this.drawHero(game, hero, ox, oy, progress);
    // Repos en cours : petite jauge au-dessus du héros.
    // Fouille en cours : la loupe oscille au-dessus de la tête du héros, comme s'il examinait le sol.
    const searching = game.searchProgress();
    if (searching > 0) {
      const s = Math.round(tile * 0.55);
      const wobble = Math.sin(this.time / 160) * tile * 0.18;
      const lx = Math.round(ox + (hero.x + 0.5) * tile - s / 2 + wobble);
      const ly = Math.round(oy + hero.y * tile - tile * 0.5 - s);
      const smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.sprite(uiIconRows("search"), ICON_PALETTE), lx, ly, s, s);
      ctx.imageSmoothingEnabled = smooth;
    }
    // Balayage de la fouille : chaque case s'illumine quand la vague l'atteint, puis s'éteint.
    if (this.scan) {
      this.scan.age += dt;
      const front = this.scan.age / 70; // cases parcourues par la vague
      for (const c of this.scan.cells) {
        const behind = front - c.d;
        if (behind < 0 || behind > 2.5) continue;
        ctx.fillStyle = `rgba(255,224,130,${(0.35 * (1 - behind / 2.5)).toFixed(2)})`;
        ctx.fillRect(Math.round(ox + c.x * tile), Math.round(oy + c.y * tile), Math.round(tile), Math.round(tile));
      }
      const maxD = Math.max(...this.scan.cells.map((c) => c.d), 0);
      const sparkle = this.scan.age - maxD * 70;
      if (sparkle > 0) {
        // Les trouvailles scintillent : une étoile dorée à quatre branches qui pulse.
        for (const f of this.scan.found) {
          const cx = ox + (f.x + 0.5) * tile;
          const cy = oy + (f.y + 0.5) * tile;
          const r = tile * (0.25 + 0.15 * Math.abs(Math.sin(sparkle / 120)));
          ctx.fillStyle = "#fff3a0";
          ctx.fillRect(Math.round(cx - r), Math.round(cy - tile * 0.05), Math.round(2 * r), Math.max(2, Math.round(tile * 0.1)));
          ctx.fillRect(Math.round(cx - tile * 0.05), Math.round(cy - r), Math.max(2, Math.round(tile * 0.1)), Math.round(2 * r));
        }
      }
      if (sparkle > 1600) this.scan = null;
    }
    const rest = Math.max(game.restProgress(), searching);
    if (rest > 0) {
      const gx = Math.round(ox + hero.x * tile + tile * 0.1);
      const gy = Math.round(oy + hero.y * tile - tile * 0.5);
      const gw = Math.round(tile * 0.8);
      const gh = Math.max(4, Math.round(tile * 0.14));
      ctx.fillStyle = "#120d08";
      ctx.fillRect(gx - 1, gy - 1, gw + 2, gh + 2);
      ctx.fillStyle = "#3b2f20";
      ctx.fillRect(gx, gy, gw, gh);
      ctx.fillStyle = searching > 0 ? "#9fd0f4" : "#f0c050";
      ctx.fillRect(gx, gy, Math.round(gw * rest), gh);
    }
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
    const light = 0.92 + 0.16 * noise(x, y, 20);
    ctx.fillStyle = `rgb(${Math.round(75 * light)},${Math.round(69 * light)},${Math.round(96 * light)})`;
    ctx.fillRect(sx + 0.5, sy + 0.5, tile - 1, tile - 1);
    const kind = noise(x, y, 21);
    ctx.fillStyle = "rgba(20,18,30,0.45)";
    ctx.strokeStyle = "rgba(20,18,30,0.45)";
    ctx.lineWidth = Math.max(1, tile * 0.03);
    if (kind < 0.09) {
      // Fissure : une ligne brisée, rare.
      const ax = 0.15 + 0.3 * noise(x, y, 24);
      const ay = 0.15 + 0.7 * noise(x, y, 25);
      ctx.beginPath();
      ctx.moveTo(sx + ax * tile, sy + ay * tile);
      ctx.lineTo(sx + (ax + 0.2) * tile, sy + (0.3 + 0.4 * noise(x, y, 26)) * tile);
      ctx.lineTo(sx + (ax + 0.42) * tile, sy + (0.2 + 0.6 * noise(x, y, 27)) * tile);
      ctx.stroke();
    } else if (kind < 0.2) {
      // Gravillons.
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(sx + (0.2 + 0.6 * noise(x, y, 30 + i)) * tile, sy + (0.2 + 0.6 * noise(x, y, 40 + i)) * tile, tile * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Mur de pierres : trois assises de hauteurs inégales, des joints placés au hasard (mais toujours au même
   * endroit pour une case donnée), des pierres aux coins décalés et de teintes légèrement différentes. Les murs voisins se raccordent :
   * pas de bordure entre deux cases de mur, un rebord clair seulement là où le mur s'arrête.
   */
  private drawWall(game: Game, mx: number, my: number, screenX: number, screenY: number): void {
    const { ctx, tile } = this;
    // « Ouvert » = ni mur ni porte : une porte fait partie du mur, elle ne crée ni coin ni changement de sens.
    const isOpen = (cx: number, cy: number) => game.map.inBounds(cx, cy) && game.map.get(cx, cy) !== Tile.Wall && !game.map.isDoor(cx, cy);
    const wallAt = (cx: number, cy: number) => game.map.inBounds(cx, cy) && game.map.get(cx, cy) === Tile.Wall;
    const open = (dx: number, dy: number) => isOpen(mx + dx, my + dy);
    // Première lecture d'une case, d'après le vide qui l'entoure :
    //  - pan vertical s'il borde un passage par la gauche ou la droite (et pas par le haut ni le bas) ;
    //  - coin si elle donne sur le vide par deux côtés perpendiculaires, ou seulement par une diagonale ;
    //  - pan horizontal sinon.
    const sideways = (cx: number, cy: number) => (isOpen(cx - 1, cy) || isOpen(cx + 1, cy)) && !isOpen(cx, cy - 1) && !isOpen(cx, cy + 1);
    const cornerLike = (cx: number, cy: number) => {
      const h = isOpen(cx - 1, cy) || isOpen(cx + 1, cy);
      const v = isOpen(cx, cy - 1) || isOpen(cx, cy + 1);
      const diagonal = isOpen(cx - 1, cy - 1) || isOpen(cx + 1, cy - 1) || isOpen(cx - 1, cy + 1) || isOpen(cx + 1, cy + 1);
      return (h && v) || (!h && !v && diagonal);
    };
    const hRun = (cx: number, cy: number) => wallAt(cx, cy) && !cornerLike(cx, cy) && !sideways(cx, cy) && (isOpen(cx, cy - 1) || isOpen(cx, cy + 1));
    const vRun = (cx: number, cy: number) => wallAt(cx, cy) && !cornerLike(cx, cy) && sideways(cx, cy);
    // Lecture finale, qui reconnaît les jonctions en « T » : un pan qui continue tout droit pendant qu'un pan
    // perpendiculaire vient s'y accrocher. La case appartient alors au pan qui continue.
    const kind = (cx: number, cy: number): "h" | "v" | "corner" => {
      if (!cornerLike(cx, cy)) return sideways(cx, cy) ? "v" : "h";
      const [l, r, u, d] = [hRun(cx - 1, cy), hRun(cx + 1, cy), vRun(cx, cy - 1), vRun(cx, cy + 1)];
      if (l && r && (u || d)) return "h";
      if (u && d && (l || r)) return "v";
      return "corner";
    };
    const mine = kind(mx, my);
    // (La case est déjà découpée sur ses pixels par l'appelant : rien ne déborde sur les voisines.)
    ctx.save();
    if (mine === "corner") {
      // De quel côté part le pan horizontal, de quel côté part le pan vertical ? On préfère le voisin qui est
      // vraiment un pan de ce sens ; à défaut n'importe quel mur ; à défaut le côté opposé au vide.
      const hScore = (d: number) => (!wallAt(mx + d, my) ? 0 : hRun(mx + d, my) ? 2 : 1);
      const vScore = (d: number) => (!wallAt(mx, my + d) ? 0 : vRun(mx, my + d) ? 2 : 1);
      const hdir = hScore(1) >= hScore(-1) ? 1 : -1;
      const vdir = vScore(1) >= vScore(-1) ? 1 : -1;
      this.drawCornerBricks(mx, my, screenX, screenY, hdir, vdir, open);
      ctx.restore();
      return;
    }
    const vertical = mine === "v";
    // Les pierres du bord ne se prolongent dans la case voisine que si c'est un mur de même sens ;
    // sinon le pan se termine proprement par un joint (contre un coin, un pan de l'autre sens ou une porte).
    const sameRun = (cx: number, cy: number) => wallAt(cx, cy) && kind(cx, cy) === mine;
    const joinBefore = vertical ? sameRun(mx, my - 1) : sameRun(mx - 1, my);
    const joinAfter = vertical ? sameRun(mx, my + 1) : sameRun(mx + 1, my);
    // Jonction en « T » : un pan de l'autre sens arrive par le « haut » ou le « bas » du dessin. Sa brique du
    // milieu vient alors mordre dans l'assise voisine de ce pan-ci, comme une brique en harpe.
    const stemAbove = vertical ? hRun(mx + 1, my) : vRun(mx, my - 1);
    const stemBelow = vertical ? hRun(mx - 1, my) : vRun(mx, my + 1);
    // Où passe la brique du milieu du pan qui arrive, le long de ce pan-ci.
    const stemLevels = vertical
      ? [0.29 + 0.1 * noise(my, 0, 4), 0.62 + 0.1 * noise(my, 0, 5)]
      : [1 - (0.62 + 0.1 * noise(-mx, 0, 5)), 1 - (0.29 + 0.1 * noise(-mx, 0, 4))];
    // Repère du dessin : pour un pan vertical, « à droite » veut dire « vers le bas de l'écran ».
    const x = vertical ? my : mx;
    const y = vertical ? -mx : my;
    const sx = vertical ? -tile / 2 : screenX;
    const sy = vertical ? -tile / 2 : screenY;
    const openAbove = vertical ? open(1, 0) : open(0, -1);
    const openBelow = vertical ? open(-1, 0) : open(0, 1);
    if (vertical) {
      ctx.translate(screenX + tile / 2, screenY + tile / 2);
      ctx.rotate(Math.PI / 2);
    }
    const gap = Math.max(1, tile * 0.05);
    const soft = Math.max(1, tile * 0.05);
    ctx.fillStyle = COLORS.mortar;
    // Le fond de mortier dépasse largement : la découpe de la case le ramène à sa place.
    ctx.fillRect(sx - 1, sy - 1, tile + 2, tile + 2);
    // Trois assises de hauteurs inégales (les mêmes sur toute la ligne de la carte, pour que les murs se raccordent).
    const levels = [0, 0.29 + 0.1 * noise(y, 0, 4), 0.62 + 0.1 * noise(y, 0, 5), 1];
    ctx.lineJoin = "round";
    /**
     * Une pierre taillée à la main : chaque coin est légèrement décalé, les arêtes sont adoucies. Un côté
     * « ouvert » (flush) se prolonge sans joint dans la case voisine.
     */
    const stone = (x0: number, x1: number, y0: number, y1: number, tint: number, seed: number, flush: { l?: boolean; r?: boolean; t?: boolean; b?: boolean }) => {
      const light = 0.84 + 0.3 * tint;
      const color = `rgb(${Math.round(103 * light)},${Math.round(107 * light)},${Math.round(136 * light)})`;
      const j = (k: number) => Math.abs(noise(seed, y * 3, 50 + k) - 0.5) * tile * 0.07;
      const edge = (open: boolean | undefined, k: number) => (open ? 0 : soft / 2 + j(k));
      const left = sx + x0 * tile + (flush.l ? 0 : gap / 2);
      const right = sx + x1 * tile - (flush.r ? -0.5 : gap / 2);
      const top = sy + y0 * tile + (flush.t ? -0.5 : gap / 2);
      const bottom = sy + y1 * tile - (flush.b ? -0.5 : gap / 2);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = soft;
      ctx.beginPath();
      ctx.moveTo(left + edge(flush.l, 0), top + edge(flush.t, 1));
      ctx.lineTo(right - edge(flush.r, 2), top + edge(flush.t, 3));
      ctx.lineTo(right - edge(flush.r, 4), bottom - edge(flush.b, 5));
      ctx.lineTo(left + edge(flush.l, 6), bottom - edge(flush.b, 7));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };
    for (let r = 0; r < 3; r++) {
      const row = y * 3 + r;
      const stem = (r === 0 && stemAbove) || (r === 2 && stemBelow);
      // Assise ordinaire : trois pierres. Assise en harpe : une pierre, la brique du pan qui arrive, une pierre.
      const cuts = stem ? [0, stemLevels[0], stemLevels[1], 1] : [0, 0.2 + 0.14 * noise(x, row, 1), 0.64 + 0.14 * noise(x, row, 3), 1];
      for (let i = 0; i < 3; i++) {
        // Les pierres du bord continuent dans la case voisine : même teinte des deux côtés, pas de joint.
        const tint = i === 0 ? noise(x, row, 9) : i === 2 ? noise(x + 1, row, 9) : noise(x, row, stem ? 13 : 11);
        const harp = stem && i === 1;
        stone(cuts[i], cuts[i + 1], levels[r], levels[r + 1], tint, x * 4 + i + r * 17, {
          l: i === 0 && joinBefore,
          r: i === 2 && joinAfter,
          t: harp && r === 0,
          b: harp && r === 2,
        });
      }
    }
    ctx.lineJoin = "miter";
    // Rebord clair en haut et ombre en bas, uniquement là où le mur s'arrête.
    if (openAbove) {
      ctx.fillStyle = "rgba(190,196,230,0.35)";
      ctx.fillRect(sx, sy, tile + 0.5, tile * 0.1);
    }
    if (openBelow) {
      ctx.fillStyle = "rgba(12,11,18,0.4)";
      ctx.fillRect(sx, sy + tile * 0.88, tile + 0.5, tile * 0.12 + 0.5);
    }
    ctx.restore();
  }

  /** Lumière visible sur un mur : la plus forte parmi les cases dégagées en vue qui le touchent. */
  private wallLight(game: Game, x: number, y: number): number {
    let best = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if ((dx === 0 && dy === 0) || !game.map.inBounds(nx, ny) || !game.map.isWalkable(nx, ny) || !game.isVisible(nx, ny)) continue;
        best = Math.max(best, game.light[game.map.index(nx, ny)]);
      }
    }
    return best;
  }

  /**
   * Cheminée encastrée dans un mur : un manteau de pierre claire, un foyer sombre ouvert vers la salle, des bûches,
   * et des flammes si elle est allumée. Le dessin est tourné pour que le foyer regarde la salle.
   */
  private drawHearth(game: Game, hearth: LightSource, sx: number, sy: number, flicker: number): void {
    const { ctx, tile } = this;
    ctx.save();
    ctx.beginPath();
    ctx.rect(Math.round(sx), Math.round(sy), Math.round(sx + tile) - Math.round(sx), Math.round(sy + tile) - Math.round(sy));
    ctx.clip();
    ctx.translate(sx + tile / 2, sy + tile / 2);
    // Dessiné foyer vers le bas, puis tourné vers la salle.
    ctx.rotate(Math.atan2(hearth.faceY, hearth.faceX) - Math.PI / 2);
    const u = tile / 16;
    const px = (gx: number, gy: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect((gx - 8) * u, (gy - 8) * u, w * u + 0.5, h * u + 0.5);
    };
    // Manteau : deux jambages et un linteau plus clair, autour du foyer noir.
    px(0, 0, 16, 16, "#5d6180");
    px(0, 0, 16, 4, "#a4abc8");
    px(0, 3, 16, 1, "#7f88a6");
    px(0, 4, 3, 12, "#8b90b0");
    px(13, 4, 3, 12, "#8b90b0");
    px(3, 4, 10, 12, "#120d08");
    px(3, 4, 10, 1, "#2a2118");
    // Bûches.
    // Le feu ne se voit brûler que si l'on a la salle sous les yeux ; de mémoire, le foyer est sombre.
    const inView = game.isVisible(hearth.x + hearth.faceX, hearth.y + hearth.faceY);
    const lit = hearth.lit !== false && inView;
    px(4, 13, 8, 2, lit ? "#7a5230" : "#4a3a2c");
    px(5, 12, 6, 1, lit ? "#9a6a34" : "#5a4a3a");
    if (lit) {
      // Flammes qui dansent avec le vacillement des torches, et braises.
      const tall = flicker > 0.92 ? 1 : 0;
      px(5, 9 - tall, 6, 4 + tall, "#ff8a2a");
      px(6, 7 - tall, 3, 3, "#ff8a2a");
      px(6, 10 - tall, 4, 3, "#ffb040");
      px(7, 11, 2, 2, "#ffe08a");
      px(4, 14, 1, 1, "#ff5a2a");
      px(11, 14, 1, 1, "#ff5a2a");
    } else {
      // Cendres froides.
      px(4, 15, 8, 1, "#6e7594");
      px(6, 14, 3, 1, "#4a4e5e");
    }
    ctx.restore();
    // Hors de vue, elle prend le même voile que le mur qui la porte.
    if (!inView) {
      ctx.fillStyle = "rgba(8,7,14,0.72)";
      ctx.fillRect(Math.round(sx), Math.round(sy), Math.round(sx + tile) - Math.round(sx), Math.round(sy + tile) - Math.round(sy));
    }
  }

  /**
   * Coin de mur en briques : les trois assises du pan horizontal tournent l'angle et deviennent les trois assises
   * du pan vertical, en trois « L » emboîtés. À chaque assise, la brique d'angle appartient tantôt au pan
   * horizontal, tantôt au pan vertical : les briques se croisent comme dans un vrai mur. Les hauteurs d'assise
   * sont celles des deux pans voisins, pour que tout se raccorde.
   * Dessiné dans un repère où le pan horizontal part vers la droite et le pan vertical vers le bas, puis retourné.
   */
  private drawCornerBricks(mx: number, my: number, sx: number, sy: number, hdir: number, vdir: number, open: (dx: number, dy: number) => boolean): void {
    const { ctx, tile } = this;
    const gap = Math.max(1, tile * 0.05);
    const soft = Math.max(1, tile * 0.05);
    ctx.save();
    ctx.translate(sx + tile / 2, sy + tile / 2);
    ctx.scale(hdir, vdir);
    ctx.translate(-tile / 2, -tile / 2);
    ctx.fillStyle = COLORS.mortar;
    ctx.fillRect(-1, -1, tile + 2, tile + 2);
    // Assises du pan horizontal (mesurées depuis le haut de l'écran) et du pan vertical (depuis la droite de l'écran).
    const lh = [0, 0.29 + 0.1 * noise(my, 0, 4), 0.62 + 0.1 * noise(my, 0, 5), 1];
    const lv = [0, 0.29 + 0.1 * noise(-mx, 0, 4), 0.62 + 0.1 * noise(-mx, 0, 5), 1];
    const rows = vdir > 0 ? lh : [0, 1 - lh[2], 1 - lh[1], 1];
    const cols = hdir > 0 ? [0, 1 - lv[2], 1 - lv[1], 1] : lv;
    ctx.lineJoin = "round";
    let n = 0;
    /** Une brique taillée à la main, comme celles des pans : coins un peu décalés, arêtes adoucies. */
    const brick = (x0: number, y0: number, x1: number, y1: number) => {
      if (x1 - x0 < 0.06 || y1 - y0 < 0.06) return;
      const id = n++;
      const light = 0.84 + 0.3 * noise(mx * 7 + id, my, 61);
      const color = `rgb(${Math.round(103 * light)},${Math.round(107 * light)},${Math.round(136 * light)})`;
      const j = (k: number) => Math.abs(noise(mx * 5 + id, my, 70 + k) - 0.5) * tile * 0.07;
      const l = x0 * tile + (x0 <= 0 ? 0 : gap / 2 + soft / 2);
      const r = x1 * tile - (x1 >= 1 ? -0.5 : gap / 2 + soft / 2);
      const t = y0 * tile + (y0 <= 0 ? 0 : gap / 2 + soft / 2);
      const b = y1 * tile - (y1 >= 1 ? -0.5 : gap / 2 + soft / 2);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = soft;
      ctx.beginPath();
      ctx.moveTo(l + j(0), t + j(1));
      ctx.lineTo(r - j(2), t + j(3));
      ctx.lineTo(r - j(4), b - j(5));
      ctx.lineTo(l + j(6), b - j(7));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };
    for (let k = 0; k < 3; k++) {
      const [x0, x1] = [cols[k], cols[k + 1]];
      const [y0, y1] = [rows[k], rows[k + 1]];
      if (k % 2 === 0) {
        // La brique d'angle court le long du pan horizontal ; le pan vertical vient buter dessous.
        const cut = Math.min(1, x1 + 0.3 + 0.12 * noise(mx, my, 80 + k));
        brick(x0, y0, cut, y1);
        brick(cut, y0, 1, y1);
        const mid = y1 + (1 - y1) * (0.45 + 0.15 * noise(mx, my, 83 + k));
        brick(x0, y1, x1, 1 - y1 > 0.5 ? mid : 1);
        if (1 - y1 > 0.5) brick(x0, mid, x1, 1);
      } else {
        // La brique d'angle court le long du pan vertical ; le pan horizontal vient buter contre elle.
        const cut = Math.min(1, y1 + 0.3 + 0.12 * noise(mx, my, 86 + k));
        brick(x0, y0, x1, cut);
        brick(x0, cut, x1, 1);
        const mid = x1 + (1 - x1) * (0.45 + 0.15 * noise(mx, my, 89 + k));
        brick(x1, y0, 1 - x1 > 0.5 ? mid : 1, y1);
        if (1 - x1 > 0.5) brick(mid, y0, 1, y1);
      }
    }
    ctx.lineJoin = "miter";
    ctx.restore();
    // Côtés donnant sur le vide : même convention que les pans de mur (clair en haut et à droite, ombre en bas et à gauche).
    ctx.fillStyle = "rgba(190,196,230,0.35)";
    if (open(0, -1)) ctx.fillRect(sx, sy, tile + 0.5, tile * 0.1);
    if (open(1, 0)) ctx.fillRect(sx + tile * 0.9, sy, tile * 0.1 + 0.5, tile + 0.5);
    ctx.fillStyle = "rgba(12,11,18,0.4)";
    if (open(0, 1)) ctx.fillRect(sx, sy + tile * 0.88, tile + 0.5, tile * 0.12 + 0.5);
    if (open(-1, 0)) ctx.fillRect(sx, sy, tile * 0.12, tile + 0.5);
  }

  /**
   * Porte : battant de planches cerclé de fer entre deux montants de pierre, avec anneau de poignée ou cadenas
   * doré. Il n'y a qu'un seul dessin : dans un mur vertical, la case entière est pivotée d'un quart de tour,
   * exactement comme les cases de mur qui l'entourent.
   */
  private drawDoor(game: Game, t: Tile, x: number, y: number, sx: number, sy: number): void {
    const { ctx, tile } = this;
    // Murs au-dessus et en dessous : la porte est dans un pan de mur vertical.
    const vertical = !game.map.isWalkable(x, y - 1) && !game.map.isWalkable(x, y + 1);
    ctx.save();
    ctx.translate(sx + tile / 2, sy + tile / 2);
    if (vertical) ctx.rotate(Math.PI / 2);
    const u = tile / 16; // le dessin est pensé sur une grille de 16 « pixels »
    const px = (gx: number, gy: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect((gx - 8) * u, (gy - 8) * u, w * u + 0.5, h * u + 0.5);
    };
    // Seuil sombre, puis un montant de pierre de chaque côté, contre les murs.
    px(0, 0, 16, 16, "#2a2533");
    px(0, 0, 2, 16, "#8b90b0");
    px(14, 0, 2, 16, "#8b90b0");
    const x0 = 2;
    const y0 = 1;
    const w = 12;
    const h = 14;
    if (t === Tile.DoorOpen) {
      // Ouverte : le battant est rabattu contre un montant, dans le sens du passage.
      px(x0, y0, 3, h, "#8a5a2b");
      px(x0, y0, 1, h, "#b9824a");
      px(x0, y0 + 3, 3, 1, "#4a4e5e");
      px(x0, y0 + h - 4, 3, 1, "#4a4e5e");
    } else {
      // Fermée : planches et leurs joints.
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
    // Escaliers et coffres : dessins en pixels validés par Thomas (`src/render/sprites/decor.ts`).
    const decor =
      t === Tile.StairsDown ? DECOR.stairsDown
      : t === Tile.StairsUp ? DECOR.stairsUp
      : t === Tile.Chest ? DECOR.chest
      : t === Tile.ChestOpen ? DECOR.chestOpen
      : null;
    if (decor) {
      const smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.sprite(decor, DECOR_PALETTE), Math.round(sx), Math.round(sy), Math.round(tile), Math.round(tile));
      ctx.imageSmoothingEnabled = smooth;
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
    }
  }
}
