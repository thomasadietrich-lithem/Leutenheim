import { Game } from "../core/game";
import { Tile } from "../world/map";
import { DECOR, DECOR_PALETTE } from "./sprites/decor";

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
    const { ctx, tile } = this;
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
  }

  /**
   * Sol en dalles de pierre : chaque case est une dalle de teinte légèrement différente ; quelques-unes sont
   * fissurées ou parsemées de gravillons. Le tirage est fixe pour une case donnée.
   */
  drawFloor(x: number, y: number, sx: number, sy: number): void {
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
  drawWall(game: Game, mx: number, my: number, screenX: number, screenY: number): void {
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

  /**
   * Coin de mur en briques : les trois assises du pan horizontal tournent l'angle et deviennent les trois assises
   * du pan vertical, en trois « L » emboîtés. À chaque assise, la brique d'angle appartient tantôt au pan
   * horizontal, tantôt au pan vertical : les briques se croisent comme dans un vrai mur. Les hauteurs d'assise
   * sont celles des deux pans voisins, pour que tout se raccorde.
   * Dessiné dans un repère où le pan horizontal part vers la droite et le pan vertical vers le bas, puis retourné.
   */
  drawCornerBricks(mx: number, my: number, sx: number, sy: number, hdir: number, vdir: number, open: (dx: number, dy: number) => boolean): void {
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
