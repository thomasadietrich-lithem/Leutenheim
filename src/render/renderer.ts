import { Game } from "../core/game";
import { Point, Tile } from "../world/map";

/** Nombre de cases visibles en largeur (écran portrait) : valeur de départ et limites du zoom. */
const COLUMNS = 11;
const MIN_COLUMNS = 6;
const MAX_COLUMNS = 28;

const COLORS = {
  background: "#14121c",
  wall: "#2a2638",
  floor: "#4b4560",
  stairs: "#e0b040",
  hero: "#5fd38d",
  heroEdge: "#1d5c3a",
  path: "rgba(255,255,255,0.35)",
};

/** Dessine l'état du jeu sur le Canvas. Design volontairement minimal : des formes colorées. */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private tile = 32;
  private columns = COLUMNS;
  // Positions affichées, qui glissent vers les positions réelles pour un mouvement fluide.
  private camX = 0;
  private camY = 0;

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

  /** `hero` est la position affichée du héros (entre deux cases pendant un pas), `dt` le temps écoulé en ms. */
  draw(game: Game, hero: Point, dt: number): void {
    const { ctx, tile } = this;
    const follow = 1 - Math.exp(-dt / 140);
    this.camX += (hero.x - this.camX) * follow;
    this.camY += (hero.y - this.camY) * follow;
    const ox = this.originX();
    const oy = this.originY();

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, this.width, this.height);

    const x0 = Math.floor(-ox / tile);
    const y0 = Math.floor(-oy / tile);
    const x1 = Math.ceil((this.width - ox) / tile);
    const y1 = Math.ceil((this.height - oy) / tile);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!game.map.inBounds(x, y)) continue;
        const t = game.map.get(x, y);
        const sx = ox + x * tile;
        const sy = oy + y * tile;
        ctx.fillStyle = t === Tile.Wall ? COLORS.wall : COLORS.floor;
        ctx.fillRect(sx + 0.5, sy + 0.5, tile - 1, tile - 1);
        if (t === Tile.StairsDown) {
          // Escalier : trois marches dorées.
          ctx.fillStyle = COLORS.stairs;
          for (let i = 0; i < 3; i++) {
            const w = tile * (0.3 + i * 0.2);
            ctx.fillRect(sx + tile * 0.15, sy + tile * (0.2 + i * 0.22), w, tile * 0.14);
          }
        }
      }
    }

    // Chemin prévu : des points, et un anneau sur la destination.
    ctx.fillStyle = COLORS.path;
    game.path.forEach((p, i) => {
      const last = i === game.path.length - 1;
      ctx.beginPath();
      ctx.arc(ox + (p.x + 0.5) * tile, oy + (p.y + 0.5) * tile, tile * (last ? 0.22 : 0.08), 0, Math.PI * 2);
      ctx.fill();
    });

    // Héros : un disque vert.
    ctx.fillStyle = COLORS.hero;
    ctx.strokeStyle = COLORS.heroEdge;
    ctx.lineWidth = Math.max(2, tile * 0.08);
    ctx.beginPath();
    ctx.arc(ox + (hero.x + 0.5) * tile, oy + (hero.y + 0.5) * tile, tile * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
