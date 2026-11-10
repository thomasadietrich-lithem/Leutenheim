import { Game } from "../core/game";
import { MONSTERS } from "../data/monsters";
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

/** Un coup porté de (fromX, fromY) vers (x, y). */
interface Slash {
  attackerId: number;
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  color: string;
  age: number;
}

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
  private time = 0;
  private floats: FloatingText[] = [];
  private slashes: Slash[] = [];

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

  /** Recentre immédiatement la vue (nouvel étage). */
  snapTo(game: Game): void {
    this.camX = game.hero.x;
    this.camY = game.hero.y;
    this.floats = [];
    this.slashes = [];
  }

  /** Affiche un petit texte qui s'élève au-dessus d'une case (dégâts, « Raté »). */
  addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floats.push({ x, y, text, color, age: 0 });
  }

  /** Anime une attaque : l'attaquant s'élance vers sa cible et une lame balaie la case visée. */
  addSlash(attackerId: number, fromX: number, fromY: number, x: number, y: number, color: string): void {
    this.slashes.push({ attackerId, fromX, fromY, x, y, color, age: 0 });
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
  draw(game: Game, progress: number, dt: number, ghosts: readonly Actor[] = []): void {
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
    this.camX += (hero.x - this.camX) * follow;
    this.camY += (hero.y - this.camY) * follow;
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
        if (wall) {
          this.drawWall(game, x, y, sx, sy);
        } else {
          ctx.fillStyle = COLORS.floor;
          ctx.fillRect(sx + 0.5, sy + 0.5, tile - 1, tile - 1);
        }
        this.drawFeature(t, sx, sy);
        // Les murs restent lisibles même dans l'ombre : on les assombrit moins que le sol.
        const shade = wall ? 0.6 : 1;

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
          ctx.fillStyle = `rgba(12,11,18,${(0.74 * shade).toFixed(3)})`;
          ctx.fillRect(sx, sy, tile, tile);
        }
      }
    }

    // Torches murales : une flamme qui vacille.
    for (const torch of game.torches) {
      if (!game.isExplored(torch.x, torch.y)) continue;
      // Accrochée à la face du mur qui donne sur la salle, pas au milieu de la case.
      let fx = 0;
      let fy = 0;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        if (game.map.isWalkable(torch.x + dx, torch.y + dy)) {
          fx = dx;
          fy = dy;
          break;
        }
      }
      const cx = ox + (torch.x + 0.5 + fx * 0.36) * tile;
      const cy = oy + (torch.y + 0.5 + fy * 0.36) * tile;
      // Support de la torche.
      ctx.fillStyle = "#3a2a1a";
      ctx.fillRect(cx - tile * 0.05 - fx * tile * 0.1, cy - tile * 0.05 - fy * tile * 0.1 + tile * 0.08, tile * 0.1, tile * 0.16);
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
      if (!m.alerted) {
        // « z » : le monstre n'a pas remarqué le héros.
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.round(tile * 0.36)}px system-ui, sans-serif`;
        ctx.fillText("z", cx + tile * 0.3, cy - tile * 0.3);
      }
      if (m.hp < m.maxHp) {
        ctx.fillStyle = COLORS.hpBack;
        ctx.fillRect(cx - tile * 0.35, cy - tile * 0.48, tile * 0.7, tile * 0.08);
        ctx.fillStyle = COLORS.hpFill;
        ctx.fillRect(cx - tile * 0.35, cy - tile * 0.48, tile * 0.7 * Math.max(0, m.hp / m.maxHp), tile * 0.08);
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

    // Coups d'épée ou de griffe : un arc qui balaie la case visée, perpendiculaire à la direction du coup.
    for (const s of this.slashes) {
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
    ctx.font = `bold ${Math.round(Math.max(13, tile * 0.42))}px system-ui, sans-serif`;
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
   * Mur de briques : trois rangées par case, des joints placés au hasard (mais toujours au même endroit
   * pour une case donnée) et des briques de teintes légèrement différentes. Les murs voisins se raccordent :
   * pas de bordure entre deux cases de mur, un rebord clair seulement là où le mur s'arrête.
   */
  private drawWall(game: Game, x: number, y: number, sx: number, sy: number): void {
    const { ctx, tile } = this;
    const rows = 3;
    const rowH = tile / rows;
    const gap = Math.max(1, tile * 0.05);
    ctx.fillStyle = COLORS.mortar;
    ctx.fillRect(sx, sy, tile + 0.5, tile + 0.5);
    for (let r = 0; r < rows; r++) {
      const row = y * rows + r;
      // Deux joints par rangée : aucune brique ne dépasse environ deux tiers de case, même à cheval sur deux cases.
      const cuts = [0, 0.2 + 0.14 * noise(x, row, 1), 0.64 + 0.14 * noise(x, row, 3), 1];
      for (let i = 0; i + 1 < cuts.length; i++) {
        const first = i === 0;
        const last = i + 2 === cuts.length;
        // Les briques du bord continuent dans la case voisine : même teinte des deux côtés, pas de joint.
        const tint = first ? noise(x, row, 9) : last ? noise(x + 1, row, 9) : noise(x, row, 10 + i);
        const light = 0.86 + 0.28 * tint;
        ctx.fillStyle = `rgb(${Math.round(103 * light)},${Math.round(107 * light)},${Math.round(136 * light)})`;
        const left = sx + cuts[i] * tile + (first ? 0 : gap / 2);
        const right = sx + cuts[i + 1] * tile - (last ? -0.5 : gap / 2);
        ctx.fillRect(left, sy + r * rowH + gap / 2, right - left, rowH - gap);
      }
    }
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

  /** Escalier et portes, dessinés par-dessus le sol. */
  private drawFeature(t: Tile, sx: number, sy: number): void {
    const { ctx, tile } = this;
    if (t === Tile.StairsDown) {
      ctx.fillStyle = COLORS.stairs;
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(sx + tile * 0.15, sy + tile * (0.2 + i * 0.22), tile * (0.3 + i * 0.2), tile * 0.14);
      }
    } else if (t === Tile.DoorClosed || t === Tile.DoorLocked) {
      ctx.fillStyle = COLORS.door;
      ctx.fillRect(sx + tile * 0.1, sy + tile * 0.1, tile * 0.8, tile * 0.8);
      ctx.fillStyle = COLORS.doorEdge;
      ctx.fillRect(sx + tile * 0.47, sy + tile * 0.1, tile * 0.06, tile * 0.8);
      if (t === Tile.DoorLocked) {
        // Serrure dorée.
        ctx.fillStyle = COLORS.lock;
        ctx.fillRect(sx + tile * 0.36, sy + tile * 0.38, tile * 0.28, tile * 0.24);
        ctx.fillStyle = COLORS.doorEdge;
        ctx.fillRect(sx + tile * 0.47, sy + tile * 0.45, tile * 0.06, tile * 0.12);
      }
    } else if (t === Tile.DoorOpen) {
      // Porte ouverte : seuls les montants restent.
      ctx.fillStyle = COLORS.door;
      ctx.fillRect(sx + 0.5, sy + 0.5, tile * 0.14, tile - 1);
      ctx.fillRect(sx + tile * 0.86, sy + 0.5, tile * 0.14 - 0.5, tile - 1);
    }
  }
}
