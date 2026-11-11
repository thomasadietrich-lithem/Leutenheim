import { Actor } from "../entities/actor";
import { GameMap, Point } from "../world/map";

/**
 * Outils pour les grands monstres (la Tisseuse, 2 × 2 cases) : quelles cases ils couvrent, à quelle distance ils sont
 * d'un autre personnage, et le prochain pas pour approcher d'une case. Leur case `x, y` est celle du haut à gauche.
 */

export function sizeOf(a: { size?: number }): number {
  return a.size ?? 1;
}

/** Le personnage couvre-t-il cette case ? */
export function occupies(a: Actor, x: number, y: number): boolean {
  const s = sizeOf(a);
  return x >= a.x && x < a.x + s && y >= a.y && y < a.y + s;
}

/** Les cases qu'il couvre. */
export function cellsOf(a: { x: number; y: number; size?: number }): Point[] {
  const s = sizeOf(a);
  const out: Point[] = [];
  for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) out.push({ x: a.x + dx, y: a.y + dy });
  return out;
}

/** Écart entre deux personnages, en cases (0 : ils se chevauchent ; 1 : ils se touchent, y compris en diagonale). */
export function gapBetween(a: { x: number; y: number; size?: number }, b: { x: number; y: number; size?: number }): number {
  const dx = Math.max(0, b.x - (a.x + sizeOf(a) - 1), a.x - (b.x + sizeOf(b) - 1));
  const dy = Math.max(0, b.y - (a.y + sizeOf(a) - 1), a.y - (b.y + sizeOf(b) - 1));
  return Math.max(dx, dy);
}

/**
 * Prochain pas d'un grand monstre vers `goal` (case du haut à gauche visée), ou, si `touch` est donné, jusqu'à toucher
 * cette case (le héros). `free(x, y)` : la case peut être couverte (ni mur, ni meuble, ni autre personnage).
 * Renvoie null s'il n'y a pas de chemin.
 */
export function bigStep(
  map: GameMap,
  m: { x: number; y: number; size?: number },
  free: (x: number, y: number) => boolean,
  goal: Point | null,
  touch: Point | null,
): Point | null {
  const s = sizeOf(m);
  const fits = (x: number, y: number) => {
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (!free(x + dx, y + dy)) return false;
    return true;
  };
  const done = (x: number, y: number) =>
    touch ? gapBetween({ x, y, size: s }, { x: touch.x, y: touch.y }) === 1 : goal !== null && x === goal.x && y === goal.y;
  if (done(m.x, m.y)) return null;
  const W = map.width;
  const prev = new Int32Array(W * map.height).fill(-1);
  const start = m.y * W + m.x;
  prev[start] = start;
  const queue = [start];
  const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
  for (let head = 0; head < queue.length && head < 4000; head++) {
    const cur = queue[head];
    const cx = cur % W;
    const cy = (cur - cx) / W;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!map.inBounds(nx, ny) || !map.inBounds(nx + s - 1, ny + s - 1)) continue;
      const ni = ny * W + nx;
      if (prev[ni] !== -1 || !fits(nx, ny)) continue;
      // En diagonale, il faut aussi pouvoir glisser de côté (pas de coin coupé à travers un mur).
      if (dx !== 0 && dy !== 0 && !fits(cx + dx, cy) && !fits(cx, cy + dy)) continue;
      prev[ni] = cur;
      if (done(nx, ny)) {
        let k = ni;
        while (prev[k] !== start) k = prev[k];
        return { x: k % W, y: Math.floor(k / W) };
      }
      queue.push(ni);
    }
  }
  return null;
}
