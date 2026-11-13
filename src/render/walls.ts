import { GameMap, Tile } from "../world/map";

/**
 * Murs v3 (planche `art/murs_v3.png`, validée par Thomas le 2026-11-12 : « on valide, implémente ») : vue de dessus,
 * en pixels 16 × 16 par case, mêmes calculs que `art/murs_v3.py`.
 *
 * - Les briques ne sont pas dessinées case par case mais sur tout le mur : chaque assise (3 par épaisseur de mur) est
 *   une longue rangée de briques de longueurs tirées au hasard (toujours les mêmes pour une position donnée). Une brique
 *   chevauche souvent deux cases : aucune case ne ressemble à une autre, et le mur se lit d'un seul tenant.
 * - Aux angles, aux T et aux X, pas de pilier : les assises se croisent en harpe (une sur deux passe dessus).
 * - Bout de mur et mur qui touche une porte : pierres de harpe plus claires (longue, courte, longue), jamais coupées.
 * - Joints gris foncé (Thomas : « des jonctions en gris foncé plutôt que noir ») ; mousse en taches continues.
 * - Mur épais (deux salles dos à dos) : chaque parement est un pan à part, ils ne se « relient » pas l'un à l'autre.
 *
 * Le dessin d'une case ne dépend que de la carte autour d'elle : il est gardé en mémoire (clé : position + voisinage).
 */

const T = 16;
type RGB = [number, number, number];
const MORTAR: RGB = [66, 62, 78];
const HI: RGB = [176, 180, 208];
const SH: RGB = [28, 25, 36];
const ROCK: RGB = [20, 18, 26];
const MOSS: RGB[] = [
  [44, 70, 30],
  [74, 112, 40],
  [118, 160, 56],
];

function hsh(...a: number[]): number {
  let n = 2166136261;
  for (const v of a) n = Math.imul(n ^ (v | 0), 16777619) >>> 0;
  n ^= n >>> 13;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) & 0xffff) / 0xffff;
}

function strHash(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (Math.imul(n, 31) + s.charCodeAt(i)) | 0;
  return hsh(n);
}

const band = (k: number): number => (k < 5 ? 0 : k < 11 ? 1 : 2);

/** Bruit lissé : des taches qui débordent d'une case à l'autre (mousse). */
function smooth(X: number, Y: number, scale: number, seed: number): number {
  const gx = X / scale;
  const gy = Y / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  let fx = gx - x0;
  let fy = gy - y0;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hsh(x0, y0, seed);
  const b = hsh(x0 + 1, y0, seed);
  const c = hsh(x0, y0 + 1, seed);
  const d = hsh(x0 + 1, y0 + 1, seed);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/** Coupures d'une assise (positions, en pixels du monde, où une brique finit). Gardées en mémoire. */
const breaksCache = new Map<string, number[]>();
function breaks(axis: string, line: number, course: number): number[] {
  const key = `${axis}${line}:${course}`;
  let cuts = breaksCache.get(key);
  if (!cuts) {
    cuts = [];
    let p = -Math.floor(12 * hsh(line, course, 7));
    for (let i = 0; p < 4096; i++) {
      p += 6 + Math.floor(7 * hsh(line, course, i, 3));
      cuts.push(p);
    }
    breaksCache.set(key, cuts);
  }
  return cuts;
}

/** Numéro de la brique d'une assise qui couvre cette position (recherche dans les coupures). */
function brickIndex(cuts: number[], pos: number): number {
  let lo = 0;
  let hi = cuts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cuts[mid] <= pos) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

interface CellInfo {
  face: boolean;
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}

/** Les colonnes se dessinent comme des blocs de mur, raccordés aux murs voisins (Thomas, 2026-11-13 : « remplace les
 *  colonnes par des blocs de murs adaptés »). Elles restent des colonnes pour le jeu (abri, vue). */
function isWallLike(t: Tile): boolean {
  return t === Tile.Wall || t === Tile.Pillar;
}

class WallReader {
  private readonly info = new Map<number, CellInfo>();
  constructor(private readonly map: GameMap) {}

  isWall(x: number, y: number): boolean {
    return !this.map.inBounds(x, y) || isWallLike(this.map.get(x, y));
  }

  open(x: number, y: number): boolean {
    return this.map.inBounds(x, y) && !isWallLike(this.map.get(x, y));
  }

  /** Un parement : un mur qui touche (même en diagonale) autre chose que du mur. L'intérieur de la roche reste noir. */
  private face(x: number, y: number): boolean {
    if (!this.isWall(x, y)) return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.open(x + dx, y + dy)) return true;
    return false;
  }

  cell(x: number, y: number): CellInfo {
    const key = (y + 8) * 4096 + (x + 8);
    let c = this.info.get(key);
    if (c) return c;
    const face = this.face(x, y);
    const o = (dx: number, dy: number) => this.open(x + dx, y + dy);
    // Deux parements dos à dos (mur épais entre deux salles) ne se relient pas : chacun est un pan à part.
    c = {
      face,
      n: face && this.face(x, y - 1) && !(this.open(x, y - 2) && o(0, 1)),
      s: face && this.face(x, y + 1) && !(this.open(x, y + 2) && o(0, -1)),
      e: face && this.face(x + 1, y) && !(this.open(x + 2, y) && o(-1, 0)),
      w: face && this.face(x - 1, y) && !(this.open(x - 2, y) && o(1, 0)),
    };
    this.info.set(key, c);
    return c;
  }

  /** Quelle brique couvre ce pixel du monde ? `null` : pas de mur, ou roche (intérieur d'un massif). */
  brickAt(X: number, Y: number): string | null {
    const x = Math.floor(X / T);
    const y = Math.floor(Y / T);
    if (!this.isWall(x, y)) return null;
    const c = this.cell(x, y);
    if (!c.face) return null;
    const i = X - x * T;
    const j = Y - y * T;
    const { n, e, s, w } = c;
    const H = () => `h${y}:${band(j)}:${brickIndex(breaks("h", y, band(j)), X)}`;
    const V = () => `v${x}:${band(i)}:${brickIndex(breaks("v", x, band(i)), Y)}`;
    const links = +n + +e + +s + +w;
    const horiz = (e || w) && !(n || s);
    const vert = (n || s) && !(e || w);
    if (links <= 1 || horiz || vert) {
      if (horiz || (links === 1 && (e || w)) || links === 0) {
        // Pan horizontal (ou bout de mur) : extrémités en pierres de harpe, longue / courte / longue.
        const rb = band(j);
        const depth = rb % 2 === 0 ? 9 : 5;
        if (!e && i >= T - depth) return `j${x},${y}:${rb}e`;
        if (!w && i < depth) return `j${x},${y}:${rb}w`;
        return H();
      }
      const cb = band(i);
      const depth = cb % 2 === 0 ? 9 : 5;
      if (!s && j >= T - depth) return `j${x},${y}:${cb}s`;
      if (!n && j < depth) return `j${x},${y}:${cb}n`;
      return V();
    }
    if (links === 2) {
      // Angle : on ramène la case à « vers l'est et vers le sud » ; les assises font des L emboîtés, et au coin de
      // chaque L la brique appartient une fois sur deux à chaque pan (harpe).
      const fi = e ? i : T - 1 - i;
      const fj = s ? j : T - 1 - j;
      const r = band(fj);
      const k = band(fi);
      if (r === k) return (r + x + y) % 2 === 0 ? H() : V();
      return r < k ? H() : V();
    }
    if (links === 3) {
      // T : le pan qui continue reste entier ; la branche vient mordre dedans, une assise sur deux.
      const deep = (x + y) % 2 === 1;
      if (!(n && s)) {
        const fj = s ? j : T - 1 - j;
        const r = band(fj);
        const k = band(i);
        if (r === 2 && k === 1) return V();
        if (r === 1 && k === 1 && deep) return V();
        return H();
      }
      const fi = e ? i : T - 1 - i;
      const r = band(j);
      const k = band(fi);
      if (k === 2 && r === 1) return H();
      if (k === 1 && r === 1 && deep) return H();
      return V();
    }
    // X : l'assise du milieu de l'un des deux murs passe tout droit, l'autre vient buter dessus en harpe.
    const rb = band(j);
    const cb = band(i);
    if ((x + y) % 2 === 0) {
      if (cb === 1) return V();
      if (rb === 1) return H();
      return (rb + cb) % 4 === 0 ? H() : V();
    }
    if (rb === 1) return H();
    if (cb === 1) return V();
    return (rb + cb) % 4 === 0 ? V() : H();
  }
}

function stoneColor(id: string): RGB {
  const t0 = strHash(id);
  const jamb = id.charCodeAt(0) === 106; // « j »
  const base: RGB = jamb ? [132, 136, 166] : [100, 104, 134];
  const t = jamb ? 0.5 + t0 * 0.4 : t0;
  const k = 0.82 + 0.34 * t;
  return [Math.min(255, base[0] * k), Math.min(255, base[1] * k), Math.min(255, base[2] * k)];
}

const mul = (c: RGB, k: number): RGB => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];

const canvases = new Map<string, HTMLCanvasElement>();

/** Le dessin 16 × 16 de la case de mur (x, y). */
export function wallImage(map: GameMap, x: number, y: number): HTMLCanvasElement {
  // Le dessin dépend des murs jusqu'à 3 cases autour (liens entre parements, extrémités) : c'est la clé.
  let sig = "";
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) sig += !map.inBounds(x + dx, y + dy) || isWallLike(map.get(x + dx, y + dy)) ? "1" : "0";
  const key = `${x},${y}|${sig}`;
  const cached = canvases.get(key);
  if (cached) return cached;
  const reader = new WallReader(map);
  const canvas = document.createElement("canvas");
  canvas.width = T;
  canvas.height = T;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(T, T);
  const ox = x * T;
  const oy = y * T;
  const open = (cx: number, cy: number) => reader.open(cx, cy);
  for (let j = 0; j < T; j++) {
    for (let i = 0; i < T; i++) {
      const X = ox + i;
      const Y = oy + j;
      const b = reader.brickAt(X, Y);
      let c: RGB;
      let mortar = false;
      if (b === null) c = ROCK;
      else {
        const left = reader.brickAt(X - 1, Y);
        const up = reader.brickAt(X, Y - 1);
        if ((left !== null && left !== b) || (up !== null && up !== b)) {
          c = MORTAR;
          mortar = true;
        } else {
          c = stoneColor(b);
          const right = reader.brickAt(X + 1, Y);
          const down = reader.brickAt(X, Y + 1);
          // Arête claire en haut à gauche de la pierre, ombre en bas à droite.
          if ((left === b && reader.brickAt(X - 2, Y) !== b) || (up === b && reader.brickAt(X, Y - 2) !== b)) c = mul(c, 1.18);
          if ((right !== null && right !== b) || (down !== null && down !== b)) c = mul(c, 0.72);
          if (hsh(X, Y, 9) < 0.05) c = mul(c, 0.85);
        }
        // Mousse : taches continues, plus fournies au pied des murs ; dans les joints surtout.
        const n = smooth(X, Y, 9, 21);
        const nearOpen = open(Math.floor(X / T), Math.floor((Y + 3) / T)) || open(Math.floor(X / T), Math.floor((Y - 3) / T)) ||
          open(Math.floor((X + 3) / T), Math.floor(Y / T)) || open(Math.floor((X - 3) / T), Math.floor(Y / T));
        const thr = 0.74 - (nearOpen ? 0.06 : 0);
        if (n > thr) {
          const r = hsh(X, Y, 22);
          if (mortar || r < (n - thr) * 4) c = r < 0.55 ? MOSS[1] : r < 0.85 ? MOSS[0] : MOSS[2];
        }
      }
      // Bords côté salle : clair en haut et à droite, ombre en bas et à gauche (comme la lumière du jeu).
      if (b !== null) {
        if (j === 0 && open(x, y - 1)) c = HI;
        if (i === T - 1 && open(x + 1, y)) c = HI;
        if (j === T - 1 && open(x, y + 1)) c = SH;
        if (i === 0 && open(x - 1, y)) c = SH;
      }
      const o = (j * T + i) * 4;
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (canvases.size > 6000) canvases.clear();
  canvases.set(key, canvas);
  return canvas;
}
