import { GameMap, Tile } from "../world/map";

/**
 * SECTION 3, L'OSSUAIRE : le dessin des murs de CRAIE et du sol en LOSANGES bleu nuit sous la BRUME, pixel par pixel
 * (mêmes calculs que `art/ossuaire_da_v4.py`, planche validée par Thomas le 2026-11-19).
 *
 * Murs : grands blocs de craie qui suivent le sens du mur (couchés le long d'un mur horizontal, debout le long d'un mur
 * vertical) ; aux angles, T et X, en haut l'assise couchée qui traverse, en bas les pierres debout (sans pilier) ; usure
 * (blocs gris, fissures, humidité). Alcôves d'ossuaire et plaques funéraires peintes dans le mur.
 * Sol : dalles en losange, fêlées, écornées, quelques-unes manquantes ; pierres tombales encastrées à tous les angles ;
 * brume violette en nappes.
 */

type RGB = [number, number, number];
const T = 16;

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

const mul = (c: RGB, k: number): RGB => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------------------------------------------------------------- sol

const FOG: RGB = [150, 116, 196];

/** Le sol nu de l'Ossuaire en (px, py), brume comprise. */
export function ossFloor(px: number, py: number): RGB {
  const u = (px + py) / 16;
  const v = (px - py) / 16;
  const cu = Math.floor(u);
  const cv = Math.floor(v);
  const fu = u - cu;
  const fv = v - cv;
  let c = mix([40, 42, 66], [52, 54, 82], hash2(cu, cv, 41));
  const j = fu < 0.07 || fv < 0.07;
  if (j) c = [20, 20, 34];
  else if (fu < 0.13 || fv < 0.13) c = mul(c, 1.18);
  if (fbm(px, py, 20, 43, 2) > 0.66 && hash2(px, py, 44) > 0.93) c = [110, 110, 124];
  // usure : fêlure, coin écorné, dalle manquante (la terre dessous), passage plus sombre
  if (hash2(cu, cv, 45) < 0.18 && Math.abs(fu - fv * 0.7 - 0.15) < 0.04 && fu > 0.12 && fv > 0.12) c = [18, 18, 30];
  if (hash2(cu, cv, 46) < 0.22 && fu + fv < 0.42 && !j) c = mul(c, 0.62);
  if (hash2(cu, cv, 47) < 0.035) c = hash2(px, py, 49) > 0.9 ? [90, 86, 96] : mul([44, 36, 40], 0.85 + 0.3 * hash2(px, py, 48));
  if (fbm(px, py, 30, 50, 2) > 0.6) c = mul(c, 0.85);
  return c;
}

/** La brume par-dessus le sol (et les pierres tombales). */
function fogged(c: RGB, px: number, py: number): RGB {
  const dens = Math.max(0, Math.min(1, (fbm(px, py * 2.2, 40, 7, 2) - 0.3) * 2.2));
  const band = (Math.round(dens * 3) / 3) * 0.5;
  return band > 0 ? mix(c, mul(FOG, 0.6), band) : c;
}

// ---------------------------------------------------------------- pierres tombales

const STONE: RGB = [112, 114, 132];
const STONE_HI: RGB = [140, 142, 160];
const STONE_D: RGB = [46, 46, 62];
const CARVE: RGB = [70, 72, 92];
const SKULL = [".###.", "#####", "#o#o#", "##n##", ".jjj."];
const XBONES = ["k...k", ".k.k.", "..k..", ".k.k.", "k...k"];

/** Une pierre tombale à plat (avant rotation) : ses couleurs, ou null hors de la pierre. */
const slabs = new Map<string, { w: number; h: number; px: (RGB | null)[] }>();
function slab(kind: string): { w: number; h: number; px: (RGB | null)[] } {
  const got = slabs.get(kind);
  if (got) return got;
  const w = kind === "petite" ? 8 : kind === "double" ? 28 : 12;
  const h = kind === "petite" ? 8 : 14;
  const px: (RGB | null)[] = new Array(w * h).fill(null);
  const set = (x: number, y: number, c: RGB) => {
    if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = c;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, STONE);
  if (kind === "ins" || kind === "double") {
    [4, 7, 10].forEach((yy, k) => {
      for (let xx = 3; xx < w - 3; xx++) if (hash2(xx >> 1, k * 9, 92) > 0.25 && (kind !== "double" || Math.abs(xx - w / 2) > 1)) set(xx, yy, CARVE);
    });
    if (kind === "double") for (let yy = 2; yy < h - 2; yy++) set(w >> 1, yy, STONE_D);
  } else if (kind === "crane" || kind === "os") {
    const g = kind === "crane" ? SKULL : XBONES;
    for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 5; dx++) {
      const ch = g[dy][dx];
      if (ch !== ".") set((w >> 1) - 2 + dx, 4 + dy, kind === "os" || "onj".includes(ch) ? CARVE : STONE_HI);
    }
  } else if (kind === "anneau") {
    for (const [dx, dy] of [[5, 5], [6, 4], [7, 4], [8, 5], [8, 6], [7, 7], [6, 7], [5, 6]]) set(dx, dy + 1, [40, 36, 34]);
  } else if (kind === "brisee") {
    for (let k = 0; k < w; k++) {
      const yy = Math.floor(3 + k * 0.6) + (k % 3 === 0 ? 1 : 0);
      if (yy > 0 && yy < h - 1) set(k, yy, STONE_D);
    }
    for (let y = h - 4; y < h; y++) for (let x = w - 4; x < w; x++) set(x, y, [44, 36, 40]);
  } else if (kind === "petite") {
    for (let y = 3; y < 5; y++) for (let x = 3; x < 5; x++) set(x, y, CARVE);
  }
  const out = { w, h, px };
  slabs.set(kind, out);
  return out;
}

export interface OssTomb {
  cx: number;
  cy: number;
  angle: number;
  variant: string;
}

/** Le pixel d'une pierre tombale pivotée en (px, py), ou null ; `rim` : juste autour (la terre de l'encastrement). */
function tombAt(t: OssTomb, px: number, py: number): RGB | "rim" | null {
  const s = slab(t.variant);
  const th = (t.angle * Math.PI) / 180;
  const c = Math.cos(th);
  const sn = Math.sin(th);
  const inside = (x: number, y: number): RGB | null => {
    const dx = x - t.cx + 0.5;
    const dy = y - t.cy + 0.5;
    const u = Math.floor(c * dx + sn * dy + s.w / 2);
    const v = Math.floor(-sn * dx + c * dy + s.h / 2);
    return u >= 0 && v >= 0 && u < s.w && v < s.h ? s.px[v * s.w + u] : null;
  };
  const here = inside(px, py);
  if (!here) return inside(px + 1, py) || inside(px - 1, py) || inside(px, py + 1) || inside(px, py - 1) ? "rim" : null;
  // relief : la lumière vient toujours d'en haut à gauche, quelle que soit l'orientation
  if (!inside(px, py - 1) || !inside(px - 1, py)) return STONE_HI;
  if (!inside(px, py + 1) || !inside(px + 1, py)) return STONE_D;
  return here;
}

// ---------------------------------------------------------------- images de sol

const floorCache = new Map<string, HTMLCanvasElement>();

export function ossGroundImage(map: GameMap, x: number, y: number, tombs: readonly OssTomb[]): HTMLCanvasElement {
  const wallAbove = map.get(x, y - 1) === Tile.Wall || map.get(x, y - 1) === Tile.Pillar;
  const key = `${x},${y}|${wallAbove ? 1 : 0}|${tombs.map((t) => `${t.cx},${t.cy},${t.angle},${t.variant}`).join(";")}`;
  const cached = floorCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = T;
  canvas.height = T;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(T, T);
  for (let j = 0; j < T; j++) {
    for (let i = 0; i < T; i++) {
      const px = x * T + i;
      const py = y * T + j;
      let c = ossFloor(px, py);
      for (const t of tombs) {
        const s = tombAt(t, px, py);
        if (s === "rim") c = mul(c, 0.5);
        else if (s) c = s;
      }
      c = fogged(c, px, py);
      // ombre portée du mur du haut (les murs sont hauts)
      if (wallAbove && j < 6) c = mul(c, 0.55 + 0.075 * j);
      const k = (j * T + i) * 4;
      img.data[k] = c[0];
      img.data[k + 1] = c[1];
      img.data[k + 2] = c[2];
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (floorCache.size > 4000) floorCache.clear();
  floorCache.set(key, canvas);
  return canvas;
}

// ---------------------------------------------------------------- murs

const CHALK_A: RGB = [194, 188, 172];
const CHALK_B: RGB = [224, 218, 202];
const JOINT: RGB = [118, 114, 112];
const ROCK: RGB = [6, 5, 8];

export type OssDecor = { kind: "alcove"; side: string; x0: number; y0: number; len: number } | { kind: "tablet"; side: string; variant: string } | null;

const wallish = (map: GameMap, x: number, y: number) => {
  if (!map.inBounds(x, y)) return true;
  const t = map.get(x, y);
  return t === Tile.Wall || t === Tile.Pillar;
};

/** Un mur qu'on voit : une de ses 8 voisines n'est pas du mur. */
function face(map: GameMap, x: number, y: number): boolean {
  if (!wallish(map, x, y)) return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && map.inBounds(x + dx, y + dy) && !wallish(map, x + dx, y + dy)) return true;
  return false;
}

/**
 * H : le mur court de gauche à droite ; V : de haut en bas ; J : jonction (angle, T, X).
 * On lit le sens du mur d'après le côté où l'on voit du sol (Thomas, 2026-11-19 : « quand deux murs sont collés, il n'y a
 * que des X ») : du sol au-dessus ou au-dessous = un mur couché ; à gauche ou à droite = un mur debout ; sol seulement en
 * diagonale (un angle) ou des deux côtés = jonction.
 */
function kindOf(map: GameMap, x: number, y: number): "H" | "V" | "J" {
  const openUD = !wallish(map, x, y - 1) || !wallish(map, x, y + 1);
  const openLR = !wallish(map, x - 1, y) || !wallish(map, x + 1, y);
  if (openUD && !openLR) return "H";
  if (openLR && !openUD) return "V";
  if (openUD && openLR) return "J";
  // sol seulement en diagonale : un angle, ou le croisement de deux murs (X) ; un mur épais qui continue tout droit
  // garde son sens.
  const h = face(map, x - 1, y) && face(map, x + 1, y);
  const v = face(map, x, y - 1) && face(map, x, y + 1);
  return h && !v ? "H" : v && !h ? "V" : "J";
}

function chalkAt(X: number, Y: number, k: "H" | "V" | "J", ly: number): RGB {
  let bid0: number;
  let bid1: number;
  let a: number;
  let b: number;
  let jnt: boolean;
  let hi: boolean;
  let sh: boolean;
  const horiz = k === "H" || (k === "J" && ly < 8);
  if (horiz) {
    const row = Math.floor(Y / 8);
    const u = X + (row % 2) * 8;
    bid0 = Math.floor(u / 16);
    bid1 = row;
    a = ((u % 16) + 16) % 16;
    b = Y % 8;
    jnt = a === 0 || b === 0;
    hi = b === 1 && a > 0;
    sh = b === 7 || a === 15;
  } else {
    const col = Math.floor(X / 8);
    const u = Y + (col % 2) * 8;
    bid0 = col;
    bid1 = Math.floor(u / 16) + 1000;
    a = X % 8;
    b = ((u % 16) + 16) % 16;
    jnt = a === 0 || b === 0 || (k === "J" && ly === 8);
    hi = a === 1 && b > 0;
    sh = a === 7 || b === 15;
  }
  let c = mul(mix(CHALK_A, CHALK_B, hash2(bid0, bid1, 3)), 0.93 + 0.1 * fbm(X, Y, 3, 4, 2));
  if (hash2(X, Y, 5) > 0.9 && (X + Y) % 3 === 0) c = mul(c, 0.86);
  if (hash2(bid0, bid1, 13) < 0.16) c = mul(c, 0.8); // bloc plus gris
  if (hash2(bid0, bid1, 14) < 0.12 && Math.abs(a - 2 - b * 1.4) < 0.7 && a > 1 && a < 12) c = mul(c, 0.55); // fissure
  if (fbm(X, Y * 0.35, 9, 15, 2) > 0.68) c = mul(c, (X + Y) % 2 ? 0.86 : 0.8); // humidité qui coule
  if (hi) c = mul(c, 1.07);
  if (sh) c = mul(c, 0.8);
  if (jnt) c = JOINT;
  return c;
}

// ------- alcôves et plaques (dessinées une fois par sorte, puis lues pixel par pixel)

const BONE: RGB = [222, 212, 186];
const BONE_D: RGB = [168, 156, 130];
const BONE_S: RGB = [60, 52, 44];
const RECESS: RGB = [22, 20, 28];
const FRAME: RGB = [236, 230, 214];
const FRAME_HI: RGB = [250, 246, 234];
const FRAME_D: RGB = [96, 92, 92];
const BIG_SKULL = ["..###..", ".#####.", "#######", "#oo#oo#", "#oo#oo#", "###n###", ".#jjj#.", "..jjj.."];

/** Le dessin de face (mâchoire en bas), tourné pour que la mâchoire regarde la salle. */
function turned(rows: readonly string[], side: string): string[] {
  let g = rows.map((r) => r.split(""));
  const k = side === "S" ? 0 : side === "N" ? 2 : side === "W" ? 3 : 1; // quarts de tour, sens inverse des aiguilles
  for (let i = 0; i < k; i++) {
    const n = g[0].length;
    g = Array.from({ length: n }, (_, r) => g.map((row) => row[n - 1 - r]));
  }
  return g.map((r) => r.join(""));
}

interface Patch {
  x0: number;
  y0: number;
  w: number;
  h: number;
  px: (RGB | null)[];
}

const alcoves = new Map<string, Patch>();

/** L'alcôve entière (en pixels du monde) : creux à fond arrondi, encadrement de craie, crânes, os croisés. */
function alcovePatch(side: string, cx0: number, cy0: number, len: number): Patch {
  const key = `${side},${cx0},${cy0},${len}`;
  const got = alcoves.get(key);
  if (got) return got;
  const horiz = side === "S" || side === "N";
  let X0: number, X1: number, Y0: number, Y1: number;
  if (horiz) {
    X0 = cx0 * T + 2;
    X1 = (cx0 + len) * T - 2;
    [Y0, Y1] = side === "S" ? [cy0 * T + 1, (cy0 + 1) * T] : [cy0 * T, (cy0 + 1) * T - 1];
  } else {
    Y0 = cy0 * T + 2;
    Y1 = (cy0 + len) * T - 2;
    [X0, X1] = side === "W" ? [cx0 * T, (cx0 + 1) * T - 1] : [cx0 * T + 1, (cx0 + 1) * T];
  }
  const w = X1 - X0;
  const h = Y1 - Y0;
  const px: (RGB | null)[] = new Array(w * h).fill(null);
  const kind = new Uint8Array(w * h); // 0 rien, 1 creux, 2 encadrement, 3 rebord
  const local = (y: number, x: number): [number, number, number] =>
    side === "S" ? [h - 1 - y, x, w] : side === "N" ? [y, x, w] : side === "W" ? [x, y, h] : [w - 1 - x, y, h];
  const depthMax = (horiz ? h : w) - 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [d, t, L] = local(y, x);
      const end = Math.min(t, L - 1 - t);
      const back = depthMax - d;
      let k = 1;
      if (d <= 1) k = 3;
      else if (end < 2 || back < 2) k = 2;
      else {
        const r = 4;
        const e2 = end - 2;
        const b2 = back - 2;
        if (b2 < r && e2 < r && (r - b2) ** 2 + (r - e2) ** 2 > r * r) k = 2;
      }
      kind[y * w + x] = k;
    }
  }
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? kind[y * w + x] : 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = at(x, y);
      const nearHole = at(x + 1, y) === 1 || at(x - 1, y) === 1 || at(x, y + 1) === 1 || at(x, y - 1) === 1;
      let c: RGB;
      if (k === 1) {
        const border = at(x + 1, y) !== 1 || at(x - 1, y) !== 1 || at(x, y + 1) !== 1 || at(x, y - 1) !== 1;
        c = border ? mul(RECESS, 0.6) : RECESS;
      } else if (nearHole) c = FRAME_D;
      else if (at(x, y - 1) < 2) c = FRAME_HI;
      else c = FRAME;
      if (k !== 1 && local(y, x)[0] === 0) c = mul(FRAME_D, 0.8);
      px[y * w + x] = c;
    }
  }
  // Le contenu, le long du mur.
  const seed = cx0 * 7 + cy0;
  const span = horiz ? w : h;
  const mid = Math.floor(span / 2);
  const place = (rows: readonly string[], tPos: number, dPos: number, shade: number) => {
    const g = turned(rows, side);
    const gh = g.length;
    const gw = g[0].length;
    const [sx, sy] = side === "S" ? [tPos, h - 1 - dPos - gh + 1] : side === "N" ? [tPos, dPos] : side === "W" ? [dPos, tPos] : [w - 1 - dPos - gw + 1, tPos];
    for (let dy = 0; dy < gh; dy++) for (let dx = 0; dx < gw; dx++) if (at(sx + dx, sy + dy) !== 1) return;
    for (let dy = 0; dy < gh; dy++)
      for (let dx = 0; dx < gw; dx++) {
        const ch = g[dy][dx];
        if (ch === ".") continue;
        px[(sy + dy) * w + sx + dx] = ch === "#" ? mul(BONE, shade) : ch === "o" ? BONE_S : ch === "n" ? mul(BONE_S, 1.4) : ch === "j" ? mul(BONE_D, shade) : mul(BONE, shade * 0.95);
      }
  };
  const big = span >= 70;
  if (big) place(BIG_SKULL, mid - 3, 2, 1);
  for (let t = 3; t < span - 6; ) {
    if (big && Math.abs(t + 2 - mid) < 7) {
      t++;
      continue;
    }
    place(hash2(t, seed, 90) < 0.18 ? XBONES : SKULL, t, 2, 0.8 + 0.25 * hash2(t, seed, 78));
    place(SKULL, t + 3, 7, 0.7 + 0.2 * hash2(t, seed, 79));
    t += 6;
  }
  const out = { x0: X0, y0: Y0, w, h, px };
  alcoves.set(key, out);
  return out;
}

const TABLET: RGB = [92, 94, 110];
const TABLET_HI: RGB = [122, 124, 140];
const TABLET_D: RGB = [40, 40, 52];
const TABLET_C: RGB = [58, 60, 76];

/** Plaque funéraire scellée dans le mur, tournée vers la salle ; « glissee » : elle a coulissé (passage secret ouvert). */
function tabletPixel(side: string, variant: string, i: number, j: number): RGB | "ring" | null {
  // repère de face (plaque vue du mur du haut), tourné selon le côté
  const k = side === "S" ? 0 : side === "N" ? 2 : side === "W" ? 3 : 1;
  let x = i;
  let y = j;
  for (let r = 0; r < k; r++) [x, y] = [15 - y, x]; // inverse d'un quart de tour (sens inverse des aiguilles)
  const x0 = variant === "glissee" ? 7 : 3;
  const y0 = 2;
  const w = 10;
  const h = 12;
  const inside = (a: number, b: number) => a >= x0 && b >= y0 && a < x0 + w && b < y0 + h && a < 16;
  if (!inside(x, y)) return inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1) ? "ring" : null;
  if (y === y0 || x === x0) return TABLET_HI;
  if (y === y0 + h - 1 || x === x0 + w - 1) return TABLET_D;
  if (variant === "crane") {
    const sy = y - (y0 + 2);
    const sx = x - (x0 + 3);
    if (sy >= 0 && sy < 5 && sx >= 0 && sx < 5 && SKULL[sy][sx] !== ".") return "onj".includes(SKULL[sy][sx]) ? TABLET_C : TABLET_HI;
    if (y === y0 + 9 && x >= x0 + 2 && x < x0 + w - 2) return TABLET_C;
  } else if ((y === 5 || y === 8 || y === 11) && x >= x0 + 2 && x < x0 + w - 2) return TABLET_C;
  return TABLET;
}

const wallCache = new Map<string, HTMLCanvasElement>();

export function ossWallImage(map: GameMap, x: number, y: number, decorAt: (x: number, y: number) => OssDecor): HTMLCanvasElement {
  let sig = "";
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) sig += wallish(map, x + dx, y + dy) ? "1" : "0";
  const decor = decorAt(x, y);
  const dk = decor ? (decor.kind === "alcove" ? `a${decor.side}${decor.x0},${decor.y0},${decor.len}` : `t${decor.side}${decor.variant}`) : "";
  const key = `${x},${y}|${sig}|${dk}`;
  const cached = wallCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = T;
  canvas.height = T;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(T, T);
  const isFace = face(map, x, y);
  const k = kindOf(map, x, y);
  const patch = decor?.kind === "alcove" ? alcovePatch(decor.side, decor.x0, decor.y0, decor.len) : null;
  const openPx = (X: number, Y: number) => !wallish(map, Math.floor(X / T), Math.floor(Y / T));
  for (let j = 0; j < T; j++) {
    for (let i = 0; i < T; i++) {
      const X = x * T + i;
      const Y = y * T + j;
      let c: RGB;
      if (!isFace) c = ROCK;
      else {
        c = chalkAt(X, Y, k, j);
        // liseré sombre là où le mur touche le sol
        if (openPx(X + 1, Y) || openPx(X - 1, Y) || openPx(X, Y + 1) || openPx(X, Y - 1)) c = mul(c, 0.45);
        if (patch) {
          const px = X - patch.x0;
          const py = Y - patch.y0;
          if (px >= 0 && py >= 0 && px < patch.w && py < patch.h) c = patch.px[py * patch.w + px] ?? c;
        } else if (decor?.kind === "tablet") {
          const t = tabletPixel(decor.side, decor.variant, i, j);
          if (t === "ring") c = mul(c, 0.55);
          else if (t) c = t;
        }
      }
      const q = (j * T + i) * 4;
      img.data[q] = c[0];
      img.data[q + 1] = c[1];
      img.data[q + 2] = c[2];
      img.data[q + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (wallCache.size > 4000) wallCache.clear();
  wallCache.set(key, canvas);
  return canvas;
}
