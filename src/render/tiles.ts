import { Game } from "../core/game";
import { Tile } from "../world/map";
import { AUTEL, AUTEL_PALETTE } from "./sprites/autel";
import { DECOR, DECOR_PALETTE } from "./sprites/decor";
import { groundImage } from "./ground";
import { wallImage } from "./walls";
import { DORTOIR } from "./sprites/dortoir";
import { TRAINARDS } from "./sprites/trainards";
import { FURNITURE_KINDS, isFlat } from "../data/themedRooms";
import { SALLES } from "./sprites/salles";
import { ATELIERS } from "./sprites/atelier";
import { BOSS } from "./sprites/boss";

/**
 * Dessin des cases de la carte (sol, murs en briques, colonnes, portes, escaliers, coffres, fontaine), sans ombre
 * ni lumière. Le renderer garde chaque case dessinée en mémoire et ne la redessine que si elle change.
 */
export const COLORS = {
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
export function noise(a: number, b: number, c: number): number {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class TilePainter {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly tile: number,
    /** Image d'un dessin en pixels (lignes de lettres + palette), gardée en mémoire par le renderer. */
    private readonly sprite: (rows: readonly string[], palette: Record<string, string>) => HTMLCanvasElement,
  ) {}

  /** Le dessin d'une case : sol, mur, colonne, porte, escalier, coffre… (sans ombre ni lumière). */
  paintCell(game: Game, t: Tile, x: number, y: number, sx: number, sy: number): void {
    // Colonne : dessinée comme un bloc de mur (voir `walls.ts`).
    const wall = t === Tile.Wall || t === Tile.Pillar;
    if (wall) this.drawWall(game, x, y, sx, sy);
    else {
      this.drawFloor(game, x, y, sx, sy);
      this.drawRugs(game, x, y, sx, sy);
    }
    this.drawFeature(game, t, x, y, sx, sy);
  }

  /**
   * La part de tapis qui tombe sur cette case, et les toiles d'araignée (une case, dans un coin) : dessinées avec le sol,
   * elles prennent la même ombre et la même lumière.
   */
  drawRugs(game: Game, x: number, y: number, sx: number, sy: number): void {
    const { ctx, tile } = this;
    const u = tile / 16;
    for (const f of game.furnitureList()) {
      if (isFlat(f.kind) && !f.kind.startsWith("rug")) {
        // Une case : toile d'araignée, rigole, évacuation, morceau de tapis de velours.
        if (f.x !== x || f.y !== y) continue;
        const web = TRAINARDS[f.kind] ?? SALLES[f.kind] ?? ATELIERS[f.kind] ?? BOSS[f.kind];
        if (!web) continue;
        const smooth = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.sprite(web.rows, web.palette), sx, sy, 16 * u, 16 * u);
        ctx.imageSmoothingEnabled = smooth;
        continue;
      }
      if (!f.kind.startsWith("rug")) continue;
      const def = FURNITURE_KINDS[f.kind];
      const art = DORTOIR[f.kind];
      const w = art.rows[0].length;
      const h = art.rows.length;
      const px = (f.x + def.w / 2) * 16 - w / 2;
      const py = (f.y + def.h / 2) * 16 - h / 2;
      if (px >= (x + 1) * 16 || px + w <= x * 16 || py >= (y + 1) * 16 || py + h <= y * 16) continue;
      const smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.sprite(art.rows, art.palette), sx + (px - x * 16) * u, sy + (py - y * 16) * u, w * u, h * u);
      ctx.imageSmoothingEnabled = smooth;
    }
  }

  /**
   * Sol B (planche `art/sols_v1.png`, validée le 2026-11-11) : dalles qu'une terre poussiéreuse recouvre par plaques,
   * dessinées pixel par pixel ; gravier et flaques par-dessus (`render/ground.ts`). Toujours le même dessin pour une case.
   */
  drawFloor(game: Game, x: number, y: number, sx: number, sy: number): void {
    const { ctx, tile } = this;
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(groundImage(game.map, x, y, game.motifs(), game.floorStyle(x, y)), Math.round(sx), Math.round(sy), Math.round(tile), Math.round(tile));
    ctx.imageSmoothingEnabled = smooth;
  }

  /**
   * Mur v3 (planche `art/murs_v3.png`, validée le 2026-11-12) : dessin en pixels calculé sur tout le mur (`render/walls.ts`) :
   * briques qui chevauchent les cases, assises croisées aux angles, T et X, pierres de harpe aux extrémités, mousse.
   */
  drawWall(game: Game, mx: number, my: number, screenX: number, screenY: number): void {
    const { ctx, tile } = this;
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(wallImage(game.map, mx, my), Math.round(screenX), Math.round(screenY), Math.round(tile), Math.round(tile));
    ctx.imageSmoothingEnabled = smooth;
  }

  /**
   * Porte : battant de planches cerclé de fer entre deux montants de pierre, avec anneau de poignée ou cadenas
   * doré. Il n'y a qu'un seul dessin : dans un mur vertical, la case entière est pivotée d'un quart de tour,
   * exactement comme les cases de mur qui l'entourent.
   */
  drawDoor(game: Game, t: Tile, x: number, y: number, sx: number, sy: number): void {
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
      if (t === Tile.DoorLocked && game.counterAt(x, y)) {
        // La porte du Kobold qui compte : pas de cadenas, un petit trou dans le bois, à hauteur d'œil.
        px(7, 6, 2, 2, "#0a0806");
        px(7, 8, 2, 1, "#3a2410");
        px(10, 7, 2, 1, "#c3cbe0");
        px(10, 9, 2, 1, "#c3cbe0");
        px(10, 7, 1, 3, "#c3cbe0");
      } else if (t === Tile.DoorLocked) {
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

  /** Escalier, autel et coffre, dessinés par-dessus le sol. */
  drawFeature(game: Game, t: Tile, x: number, y: number, sx: number, sy: number): void {
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
      // L'autel de pierre à la pomme dorée (Thomas, 2026-11-12, à la place de la fontaine) ; vide une fois croquée.
      const smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.sprite(t === Tile.Fountain ? AUTEL.full : AUTEL.dry, AUTEL_PALETTE), Math.round(sx), Math.round(sy), Math.round(tile), Math.round(tile));
      ctx.imageSmoothingEnabled = smooth;
    }
  }
}
