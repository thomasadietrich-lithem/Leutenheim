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
export type FloorStyle = "kitchen" | "torture" | "forge" | "bath" | "prison" | "champi" | "champiFelt";

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

/** Carreaux sombres de la prison (Thomas, 2026-11-14) : grandes dalles carrées d'ardoise, joints noirs, un peu d'humidité. */
function prisonTiles(px: number, py: number): RGB {
  const cell = 8;
  const cx = Math.floor(px / cell);
  const cy = Math.floor(py / cell);
  const lx = px % cell;
  const ly = py % cell;
  if (lx === 0 || ly === 0) return hex("#16141c");
  let c = scale(hex("#3a3846"), 0.85 + 0.2 * hash2(cx, cy, 711));
  if (lx === 1 || ly === 1) c = scale(c, 1.12);
  if (hash2(cx, cy, 712) < 0.12 && lx + ly === 7) c = hex("#24222c");
  if (fbm(px, py, 16, 713, 2) < 0.33) c = [c[0] * 0.8, c[1] * 0.86, c[2] * 0.9];
  return c;
}

/** Dalles de la forge : le sol B noirci de suie (planche art/forge_v1.png). */
function forgeFloor(px: number, py: number): RGB {
  const c = floorB(px, py);
  let out: RGB = [c[0] * 0.6, c[1] * 0.58, c[2] * 0.62];
  if (fbm(px, py, 12, 990, 2) < 0.35) out = scale(out, 0.7);
  return out;
}

/**
 * SECTION 2, la champignonnière (planches art/champi_v1 option C, v3 à v5) : terre brun-violet, flaques sombres qui
 * brillent, rares dalles ; mycélium qui rampe depuis le pied des murs ; ÉBOULIS (tas de terre en relief : bord net,
 * flanc avant sombre, dessus clair, mottes, racines lumineuses) et TERRE MEUBLE (mottes et cailloux).
 */
const C_EARTH: RGB[] = [[40, 32, 38], [48, 38, 44], [56, 45, 50]];

/**
 * SOL B « pavés ronds moussus » (Thomas, 2026-11-14 : « essaie d'implémenter le sol B » ; planche art/champi_sols_v1.png) :
 * des galets ronds serrés (cellules de Voronoï sur une grille de 7 pixels), plus clairs au centre, joints sombres pleins
 * de mousse bleu-vert, quelques brins lumineux. Mêmes calculs que `floor_cobbles` de la planche.
 */
function cobbles(px: number, py: number, burnt = false): RGB {
  const cell = 7;
  const gx = Math.floor(px / cell);
  const gy = Math.floor(py / cell);
  let best = 1e9;
  let second = 1e9;
  let seed = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = gx + dx;
      const cy = gy + dy;
      const sx = (cx + 0.2 + 0.6 * hash2(cx, cy, 911)) * cell;
      const sy = (cy + 0.2 + 0.6 * hash2(cx, cy, 912)) * cell;
      const d = Math.hypot(px - sx, py - sy);
      if (d < best) {
        second = best;
        best = d;
        seed = hash2(cx, cy, 913);
      } else if (d < second) second = d;
    }
  }
  if (second - best < 1.4) {
    // Mousse brûlée : les veines passent au gris-noir de la cendre, quelques braises éteintes.
    if (fbm(px, py, 10, 914, 2) > 0.5) return burnt ? (hash2(px, py, 915) > 0.9 ? [70, 50, 40] : [34, 30, 30]) : hash2(px, py, 915) > 0.9 ? [90, 200, 170] : [40, 110, 96];
    return [22, 20, 26];
  }
  const k = (0.8 + 0.35 * seed) * Math.min(1.15, Math.max(0.75, 1.15 - best / cell));
  return [60 * k, 56 * k, 70 * k];
}

/** SOL D « feutre de mycélium » (planche art/champi_sols_v1.png ; Thomas : « fais une salle B et une D ») : fibres
 * gris-bleu entrecroisées, taches plus sombres, spores lumineuses. Mêmes calculs que `floor_felt` de la planche. */
function felt(px: number, py: number): RGB {
  const n = fbm(px, py, 5, 931, 3);
  let c: RGB = scale([70, 76, 88], 0.75 + 0.5 * n);
  const mod = (v: number, m: number) => ((Math.trunc(v) % m) + m) % m;
  if (mod(px + py * 0.5 + 6 * valueNoise(px, py, 6, 932), 5) === 0 || mod(px * 0.4 - py + 6 * valueNoise(px, py, 7, 933), 6) === 0) c = scale(c, 1.22);
  if (fbm(px, py, 24, 934, 2) < 0.36) c = scale(c, 0.6);
  if (hash2(px, py, 935) > 0.992) c = [150, 255, 220];
  return c;
}

/** L'ancien sol de la section 2 (terre, flaques, rares dalles), gardé pour comparer. */
export function champiEarthFloor(px: number, py: number): RGB {
  const n = fbm(px, py, 6, 13, 2);
  let c = C_EARTH[n < 1 / 3 ? 0 : n < 2 / 3 ? 1 : 2];
  if (hash2(px, py, 18) > 0.93) c = scale(c, 0.75);
  if (fbm(px, py, 40, 23, 2) > 0.66) {
    const cx = Math.floor(px / T);
    const cy = Math.floor(py / T);
    const lx = px - cx * T;
    const ly = py - cy * T;
    if (lx === 0 || ly === 0) c = [20, 18, 26];
    else c = scale(lx === 1 || ly === 1 ? [70, 62, 76] : [58, 50, 62], 0.88 + 0.2 * hash2(cx, cy, 33));
  }
  const pud = (qx: number, qy: number) => fbm(qx, qy, 22, 91, 3) < 0.3;
  if (pud(px, py)) {
    c = hash2(px, py, 93) > 0.94 ? [120, 150, 170] : [26, 34, 44];
    if (!pud(px + 1, py) || !pud(px - 1, py) || !pud(px, py + 1) || !pud(px, py - 1)) c = [60, 74, 86];
  }
  return c;
}

/** erf (approximation d'Abramowitz et Stegun) : pour flouter le carré des cases d'éboulis. */
function erf(v: number): number {
  const s = Math.sign(v);
  const a = Math.abs(v);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}

const E_TOP: RGB = [168, 128, 100];
const E_MID: RGB = [130, 96, 78];
const E_DK: RGB = [96, 70, 60];
const E_FACE: RGB = [62, 44, 42];
const E_RIM: RGB = [30, 22, 24];

const canvases = new Map<string, HTMLCanvasElement>();

/**
 * L'image 16 × 16 du sol d'une case (sol B, plus le gravier et l'eau qui la touchent). Gardée en mémoire : le sol ne
 * change jamais. Sert à toute case où l'on marche (et sous les meubles, les colonnes, les escaliers).
 */
export function groundImage(
  map: GameMap,
  x: number,
  y: number,
  motifs: readonly Motif[] = [],
  style?: FloorStyle,
  earthAt?: (x: number, y: number) => "E" | "B" | "e" | null,
  /** Section 2 : la mousse de la case a brûlé (veines noircies). */
  burnt = false,
): HTMLCanvasElement {
  const gravel = around(map, x, y, Tile.Gravel);
  const water = around(map, x, y, Tile.Water);
  const motif = motifs.find((m) => x >= m.x && y >= m.y && x < m.x + MOTIF_SIZE[m.kind] && y < m.y + MOTIF_SIZE[m.kind]);
  // Section 2 : éboulis jusqu'à 2 cases (leur tas déborde), terre meuble de la case, murs voisins (mycélium).
  const champi = style === "champi" || style === "champiFelt";
  const mounds: [number, number][] = [];
  const breaches: [number, number][] = [];
  let loose = false;
  let walls = "";
  if (champi) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const e = earthAt?.(x + dx, y + dy);
      if (e === "E" || e === "B") mounds.push([x + dx, y + dy]);
      if (e === "B") breaches.push([x + dx, y + dy]);
    }
    loose = earthAt?.(x, y) === "e";
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) walls += map.get(x + dx, y + dy) === Tile.Wall ? "1" : "0";
  }
  const key = `${x},${y}|${gravel.join(";")}|${water.join(";")}|${motif ? `${motif.kind}@${motif.x},${motif.y}` : ""}|${style ?? ""}|${mounds.join(";")}|${breaches.join(";")}|${loose ? "e" : ""}|${walls}|${burnt ? "b" : ""}`;
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
      let c = style === "champi" ? cobbles(px, py, burnt) : style === "champiFelt" ? felt(px, py) : style === "kitchen" ? kitchenTiles(px, py) : style === "torture" ? tortureFloor(px, py) : style === "forge" ? forgeFloor(px, py) : style === "bath" ? bathTiles(px, py) : style === "prison" ? prisonTiles(px, py) : floorB(px, py);
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
  if (champi) champiOverlay(map, x, y, pixels, mounds, loose, breaches);
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

/** Section 2 : mycélium au pied des murs, puis l'éboulis (tas en relief) et la terre meuble, par-dessus le sol. */
function champiOverlay(map: GameMap, x: number, y: number, pixels: RGB[], mounds: [number, number][], loose: boolean, breaches: [number, number][]): void {
  const ox = x * T;
  const oy = y * T;
  const wallCells: [number, number][] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (map.get(x + dx, y + dy) === Tile.Wall) wallCells.push([x + dx, y + dy]);
  const sig = 5 * Math.SQRT2;
  const soft = (px: number, py: number): number => {
    let v = 0;
    for (const [mx, my] of mounds) {
      const ax = (erf((px + 0.5 - mx * T) / sig) - erf((px + 0.5 - (mx + 1) * T) / sig)) / 2;
      const ay = (erf((py + 0.5 - my * T) / sig) - erf((py + 0.5 - (my + 1) * T) / sig)) / 2;
      v += ax * ay;
    }
    v += 0.25 * (fbm(px, py, 7, 501, 2) - 0.5);
    // La case de mur éventrée est pleine de terre jusqu'à la roche : l'éboulement est tranché net à la rangée du mur.
    const cx = Math.floor(px / T);
    const cy = Math.floor(py / T);
    if (breaches.some(([bx, by]) => bx === cx && by === cy)) v = Math.max(v, 0.62);
    return v;
  };
  const inMound = (px: number, py: number) => mounds.length > 0 && soft(px, py) > 0.5;
  for (let j = 0; j < T; j++) {
    for (let i = 0; i < T; i++) {
      const px = ox + i;
      const py = oy + j;
      const k = j * T + i;
      // Mycélium : filaments qui rampent depuis le pied des murs.
      if (wallCells.length > 0) {
        let d = 99;
        for (const [wx, wy] of wallCells) d = Math.min(d, Math.hypot(Math.max(wx * T - px, 0, px - (wx * T + T - 1)), Math.max(wy * T - py, 0, py - (wy * T + T - 1))));
        if (d < 7 + 9 * fbm(px, py, 18, 311, 2) && fbm(px, py, 20, 312, 2) > 0.52 && (hash2(px, py, 313) > 0.93 || (px + py * 2) % 11 === 0)) {
          const c = pixels[k];
          pixels[k] = [c[0] * 0.45 + 200 * 0.55, c[1] * 0.45 + 206 * 0.55, c[2] * 0.45 + 214 * 0.55];
        }
      }
      if (mounds.length === 0) continue;
      const v = soft(px, py);
      if (v > 0.5) {
        const h = Math.min(1, Math.max(0, (v - 0.5) / 0.45));
        const h2 = Math.min(1, Math.max(0, (soft(px - 1, py - 1) - 0.5) / 0.45));
        let c: RGB = h < 0.5 ? mix(E_DK, E_MID, h * 2) : mix(E_MID, E_TOP, h * 2 - 1);
        c = scale(c, 1 + 0.6 * Math.max(-0.3, Math.min(0.3, (h - h2) * 8)));
        const clod = hash2(Math.floor(px / 2), Math.floor(py / 2), 511);
        if (clod > 0.9) c = scale(c, 1.15);
        else if (clod < 0.08) c = scale(c, 0.8);
        if (h > 0.3 && Math.abs(fbm(px, py, 14, 341, 3) - 0.5) < 0.011) c = [120, 255, 220];
        pixels[k] = c;
        continue;
      }
      // Flanc avant (4 pixels sous le tas) et bord sombre.
      let face = false;
      for (let s = 1; s <= 4 && !face; s++) face = inMound(px, py - s);
      if (face) pixels[k] = scale(E_FACE, 0.9 + 0.2 * hash2(px, py, 512));
      const edge = inMound(px + 1, py) || inMound(px - 1, py) || inMound(px, py - 1) || (face && !inMound(px, py + 1) && ![1, 2, 3, 4].some((s) => inMound(px, py + 1 - s)));
      if (edge) pixels[k] = E_RIM;
    }
  }
  if (!loose) return;
  // Terre meuble : quelques mottes et cailloux bien séparés.
  for (let n = 0; n < 6; n++) {
    const X = Math.floor(hash2(x, y, 520 + n) * 13);
    const Y = Math.floor(hash2(x, y, 540 + n) * 13);
    const w = 2 + Math.floor(hash2(x, y, 560 + n) * 2);
    const h = 1 + Math.floor(hash2(x, y, 580 + n) * 2);
    const pebble = hash2(x, y, 600 + n) < 0.3;
    for (let j = 0; j <= h; j++) for (let i = 0; i < w; i++) {
      const qx = X + i;
      const qy = Y + j;
      if (qx >= T || qy >= T) continue;
      pixels[qy * T + qx] = j === h ? E_RIM : j === 0 ? (pebble ? [140, 126, 136] : E_TOP) : pebble ? [100, 88, 96] : E_MID;
    }
  }
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
