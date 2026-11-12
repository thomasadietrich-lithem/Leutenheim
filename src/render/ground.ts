import { GameMap, Tile } from "../world/map";
import { MOTIF_SIZE } from "../data/motifs";
import { Motif } from "../world/grounds";
import { MOTIFS } from "./motifs";

/**
 * Dessin du sol, pixel par pixel (planche `art/sols_v1.png`, validée par Thomas le 2026-11-11) : sol B, des dalles
 * qu'une terre poussiéreuse recouvre par plaques ; gravier et flaques en formes naturelles qui suivent leurs cases.
 * Mêmes calculs que `art/pix.py` et `art/sols_v1.py` : une case = 16 × 16 pixels, toujours le même dessin pour une case.
 */

type RGB = [number, number, number];

/** Hasard fixe par point entier, entre 0 et 1 (identique à `hash2` de `art/pix.py`). */
function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519 | 0)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h & 0xffff) / 65535;
}

function valueNoise(px: number, py: number, scale: number, seed: number): number {
  const fx = px / scale;
  const fy = py / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

function fbm(px: number, py: number, scale: number, seed: number, octaves: number): number {
  let total = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    total += amp * valueNoise(px, py, scale / 2 ** o, seed + 17 * o);
    norm += amp;
    amp *= 0.5;
  }
  return total / norm;
}

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const EARTH = [hex("#352c38"), hex("#3e3442"), hex("#473c4a")];
const STONE = hex("#4b4560");
const STONE_HI = hex("#5a5372");
const JOINT = hex("#221d2c");
const PEBBLES = [hex("#9c94a8"), hex("#766e84"), hex("#4e4758")];
const WATER = hex("#2f4f7e");
const WATER_DEEP = hex("#24365a");
const WATER_RIM = hex("#6a9ad0");
const WATER_SPARK = hex("#a8d0f0");
const WATER_RIPPLE = hex("#3d6596");
const T = 16;

const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

function earth(px: number, py: number, seed: number): RGB {
  const n = fbm(px, py, 6, seed, 2);
  const c = EARTH[n < 1 / 3 ? 0 : n < 2 / 3 ? 1 : 2];
  return hash2(px, py, seed + 5) > 0.93 ? scale(c, 0.75) : c;
}

function slab(px: number, py: number, seed: number): RGB {
  const cx = Math.floor(px / T);
  const cy = Math.floor(py / T);
  const lx = px - cx * T;
  const ly = py - cy * T;
  if (lx === 0 || ly === 0) return JOINT;
  const crack = hash2(cx, cy, seed + 3) < 0.12 && Math.abs(lx - ly * (0.6 + hash2(cx, cy, seed + 4))) < 0.6 && lx > 3 && lx < 13;
  if (crack) return JOINT;
  const tint = 0.9 + 0.2 * hash2(cx, cy, seed);
  let c = scale(lx === 1 || ly === 1 ? STONE_HI : STONE, tint);
  if (fbm(px, py, 5, seed + 9, 2) > 0.62) c = scale(c, 0.9);
  return c;
}

/** Sol B : dalles, recouvertes par plaques d'une terre poussiéreuse. */
function floorB(px: number, py: number): RGB {
  const dust = fbm(px, py, 36, 51, 2) + 0.2 * (valueNoise(px, py, 3, 52) - 0.5);
  if (dust < 0.4) return earth(px, py, 61);
  const s = slab(px, py, 41);
  if (dust < 0.47) {
    const e = earth(px, py, 61);
    return [s[0] * 0.55 + e[0] * 0.45, s[1] * 0.55 + e[1] * 0.45, s[2] * 0.55 + e[2] * 0.45];
  }
  return s;
}

/** Part de « zone » (gravier ou eau) au pixel : taches rondes centrées sur les cases de ce sol (σ = 0,6 case). */
function coverage(cells: readonly [number, number][], px: number, py: number): number {
  let cov = 0;
  for (const [cx, cy] of cells) {
    const dx = (px + 0.5 - (cx + 0.5) * T) / T;
    const dy = (py + 0.5 - (cy + 0.5) * T) / T;
    cov += Math.exp(-(dx * dx + dy * dy) / 0.72);
  }
  return Math.min(cov, 1.4);
}

/** Les cases d'un sol donné autour de (x, y), jusqu'à deux cases. */
function around(map: GameMap, x: number, y: number, tile: Tile): [number, number][] {
  const out: [number, number][] = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (map.get(x + dx, y + dy) === tile) out.push([x + dx, y + dy]);
  return out;
}

const GROOVE: RGB = [30, 26, 38];
const LIP: RGB = [104, 98, 126];
const INLAY: RGB = [122, 96, 58];
const INLAY_HI: RGB = [168, 136, 76];
const MOTIF_STONE: RGB = [86, 80, 104];

/**
 * Un pixel d'un motif gravé (comme `stamp` dans art/motifs_sol_v1.py) : une seule grande dalle un peu plus claire sous
 * le motif, son joint autour, le trait gravé ou le laiton ; la poussière du sol B recouvre une partie du motif.
 */
function engrave(m: Motif, px: number, py: number, base: RGB): RGB {
  const size = MOTIF_SIZE[m.kind] * T;
  const lx = px - m.x * T;
  const ly = py - m.y * T;
  const dust = fbm(px, py, 36, 51, 2) + 0.2 * (valueNoise(px, py, 3, 52) - 0.5);
  if (dust < 0.36) return base;
  let c: RGB;
  if (lx === 0 || ly === 0) c = GROOVE;
  else if (lx === 1 || ly === 1) c = LIP;
  else c = scale(MOTIF_STONE, 0.85 * (0.95 + 0.1 * valueNoise(px, py, 6, 79)));
  const u = ((lx + 0.5) / size) * 2 - 1;
  const v = ((ly + 0.5) / size) * 2 - 1;
  const k = MOTIFS[m.kind](u, v);
  if (k === 0 || hash2(px, py, 77) > 0.94) {
    // Arête claire sous un trait gravé (le pixel du dessus est un creux).
    const vu = ((ly - 0.5) / size) * 2 - 1;
    if (ly > 0 && MOTIFS[m.kind](u, vu) === 1 && hash2(px, py - 1, 77) <= 0.94) return [Math.max(c[0], LIP[0] * 0.9), Math.max(c[1], LIP[1] * 0.9), Math.max(c[2], LIP[2] * 0.9)];
    return c;
  }
  if (k === 1) return GROOVE;
  return hash2(px, py, 78) > 0.75 ? INLAY_HI : INLAY;
}

/**
 * Sols des salles à thème (planches art/cuisine_v2.png et art/torture_v1.png) : carrelage clair et fendu de la cuisine
 * (carreaux d'une demi-case), dalles sombres et rougies de la salle de torture. Mêmes calculs que les planches.
 */
export type FloorStyle = "kitchen" | "torture" | "forge" | "bath";

function kitchenTiles(px: number, py: number): RGB {
  const cell = 8;
  const cx = Math.floor(px / cell);
  const cy = Math.floor(py / cell);
  const lx = px % cell;
  const ly = py % cell;
  if (lx === 0 || ly === 0) return hex("#4e4c58");
  if (hash2(cx, cy, 602) < 0.14 && Math.abs(lx - ly * (0.4 + hash2(cx, cy, 603))) < 0.6 && lx > 1) return hex("#46444e");
  let c = scale(hex("#7a7886"), 0.92 + 0.12 * hash2(cx, cy, 601));
  if (lx === 1 || ly === 1) c = scale(c, 1.08);
  if (fbm(px, py, 20, 604, 2) < 0.38) c = scale(c, 0.82);
  // Un peu plus sombre que la planche : la salle est éclairée comme le reste du donjon.
  return scale(c, 0.78);
}

/** Carrelage noir et blanc de la salle de bain du Kobold (planche art/salle_bain_v1.png). */
function bathTiles(px: number, py: number): RGB {
  const cell = 8;
  const cx = Math.floor(px / cell);
  const cy = Math.floor(py / cell);
  const lx = px % cell;
  const ly = py % cell;
  if (lx === 0 || ly === 0) return hex("#55505e");
  const white = (cx + cy) % 2 === 0;
  if (white && hash2(cx, cy, 91) > 0.86 && lx === ly) return hex("#8a8490");
  let c = scale(hex(white ? "#d8d4cc" : "#2a2630"), 0.94 + 0.08 * hash2(cx, cy, 77));
  if (lx === 1 || ly === 1) c = scale(c, 1.06);
  if (hash2(Math.floor(px / 2), Math.floor(py / 2), 13) > 0.93) c = scale(c, 0.82);
  return scale(c, 0.8);
}

function tortureFloor(px: number, py: number): RGB {
  const c = floorB(px, py);
  let out: RGB = [c[0] * 0.62, c[1] * 0.55, c[2] * 0.6];
  if (fbm(px, py, 14, 970, 2) < 0.3) out = [out[0] * 0.6 + 74 * 0.4, out[1] * 0.6 + 26 * 0.4, out[2] * 0.6 + 28 * 0.4];
  return out;
}

/** Dalles de la forge : le sol B noirci de suie (planche art/forge_v1.png). */
function forgeFloor(px: number, py: number): RGB {
  const c = floorB(px, py);
  let out: RGB = [c[0] * 0.6, c[1] * 0.58, c[2] * 0.62];
  if (fbm(px, py, 12, 990, 2) < 0.35) out = scale(out, 0.7);
  return out;
}

const canvases = new Map<string, HTMLCanvasElement>();

/**
 * L'image 16 × 16 du sol d'une case (sol B, plus le gravier et l'eau qui la touchent). Gardée en mémoire : le sol ne
 * change jamais. Sert à toute case où l'on marche (et sous les meubles, les colonnes, les escaliers).
 */
export function groundImage(map: GameMap, x: number, y: number, motifs: readonly Motif[] = [], style?: FloorStyle): HTMLCanvasElement {
  const gravel = around(map, x, y, Tile.Gravel);
  const water = around(map, x, y, Tile.Water);
  const motif = motifs.find((m) => x >= m.x && y >= m.y && x < m.x + MOTIF_SIZE[m.kind] && y < m.y + MOTIF_SIZE[m.kind]);
  const key = `${x},${y}|${gravel.join(";")}|${water.join(";")}|${motif ? `${motif.kind}@${motif.x},${motif.y}` : ""}|${style ?? ""}`;
  const cached = canvases.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = T;
  canvas.height = T;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(T, T);
  const ox = x * T;
  const oy = y * T;
  const gravelEdge = (px: number, py: number) => coverage(gravel, px, py) + 0.5 * (fbm(px, py, 8, 81, 2) - 0.5);
  const waterEdge = (px: number, py: number) => coverage(water, px, py) + 0.45 * (fbm(px, py, 9, 91, 2) - 0.5);
  const wet = (px: number, py: number) => water.length > 0 && waterEdge(px, py) > 0.5;
  const pixels: RGB[] = [];
  for (let j = 0; j < T; j++) {
    for (let i = 0; i < T; i++) {
      const px = ox + i;
      const py = oy + j;
      let c = style === "kitchen" ? kitchenTiles(px, py) : style === "torture" ? tortureFloor(px, py) : style === "forge" ? forgeFloor(px, py) : style === "bath" ? bathTiles(px, py) : floorB(px, py);
      if (motif) c = engrave(motif, px, py, c);
      if (gravel.length > 0 && gravelEdge(px, py) > 0.5) c = scale(c, 0.8);
      pixels.push(c);
    }
  }
  // Gravier : petits cailloux de 2 × 2 sur une grille de 3 pixels décalée au hasard (comme la planche).
  if (gravel.length > 0) {
    const start = (v: number) => Math.floor((v - 3) / 3) * 3;
    for (let by = start(oy); by < oy + T; by += 3) {
      for (let bx = start(ox); bx < ox + T; bx += 3) {
        const px = bx + Math.floor(hash2(bx, by, 83) * 2);
        const py = by + Math.floor(hash2(bx, by, 84) * 2);
        const edge = gravelEdge(px, py);
        if (edge <= 0.5) continue;
        if (hash2(bx, by, 82) > Math.min(0.85, 0.25 + (edge - 0.5) * 2.5)) continue;
        const light = hash2(bx, by, 85) > 0.5;
        const put = (qx: number, qy: number, c: RGB) => {
          if (qx >= ox && qx < ox + T && qy >= oy && qy < oy + T) pixels[(qy - oy) * T + (qx - ox)] = c;
        };
        put(px, py, light ? PEBBLES[0] : PEBBLES[1]);
        put(px + 1, py, light ? PEBBLES[1] : PEBBLES[2]);
        put(px, py + 1, light ? PEBBLES[1] : PEBBLES[2]);
        put(px + 1, py + 1, PEBBLES[2]);
      }
    }
  }
  // Eau : sombre au cœur, reflet clair sur le bord du haut, sol mouillé (plus sombre) tout autour.
  if (water.length > 0) {
    for (let j = 0; j < T; j++) {
      for (let i = 0; i < T; i++) {
        const px = ox + i;
        const py = oy + j;
        const k = j * T + i;
        if (!wet(px, py)) {
          const near1 = wet(px + 1, py) || wet(px - 1, py) || wet(px, py + 1) || wet(px, py - 1);
          const near2 = near1 || wet(px + 2, py) || wet(px - 2, py) || wet(px, py + 2) || wet(px, py - 2) || wet(px + 1, py + 1) || wet(px - 1, py - 1) || wet(px + 1, py - 1) || wet(px - 1, py + 1);
          if (near2) pixels[k] = scale(pixels[k], 0.62);
          continue;
        }
        const edge = waterEdge(px, py);
        const deep = edge > 0.85;
        let c = deep ? WATER_DEEP : WATER;
        if (!wet(px, py - 1)) c = WATER_RIM;
        else if (hash2(px, py, 94) > 0.996) c = WATER_SPARK;
        else if (!deep && Math.abs(Math.sin((px * 0.7 + py * 1.3) * 0.5 + 3 * valueNoise(px, py, 8, 95))) < 0.08) c = WATER_RIPPLE;
        pixels[k] = c;
      }
    }
  }
  for (let k = 0; k < pixels.length; k++) {
    img.data[k * 4] = pixels[k][0];
    img.data[k * 4 + 1] = pixels[k][1];
    img.data[k * 4 + 2] = pixels[k][2];
    img.data[k * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (canvases.size > 6000) canvases.clear();
  canvases.set(key, canvas);
  return canvas;
}
