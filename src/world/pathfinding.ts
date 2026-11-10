import { GameMap, Point } from "./map";

// Déplacements droits d'abord : à distance égale, les chemins restent rectilignes.
const DIRS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

/** Un pas est permis si la case d'arrivée est libre et, en diagonale, si on ne coupe pas un coin de mur. */
export function canStep(map: GameMap, x: number, y: number, dx: number, dy: number): boolean {
  if (!map.isWalkable(x + dx, y + dy)) return false;
  if (dx !== 0 && dy !== 0) {
    return map.isWalkable(x + dx, y) && map.isWalkable(x, y + dy);
  }
  return true;
}

/** Distance en nombre de pas depuis `from` vers chaque case (-1 = inaccessible). */
export function distanceField(map: GameMap, from: Point): Int32Array {
  const dist = new Int32Array(map.width * map.height).fill(-1);
  const queue: number[] = [map.index(from.x, from.y)];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % map.width;
    const cy = (cur - cx) / map.width;
    for (const d of DIRS) {
      if (!canStep(map, cx, cy, d.x, d.y)) continue;
      const next = map.index(cx + d.x, cy + d.y);
      if (dist[next] !== -1) continue;
      dist[next] = dist[cur] + 1;
      queue.push(next);
    }
  }
  return dist;
}

/** Plus court chemin de `from` à `to` (sans la case de départ), ou null s'il n'existe pas. */
export function findPath(map: GameMap, from: Point, to: Point): Point[] | null {
  if (!map.isWalkable(to.x, to.y)) return null;
  // On calcule les distances depuis l'arrivée, puis on descend la pente depuis le départ.
  const dist = distanceField(map, to);
  if (dist[map.index(from.x, from.y)] === -1) return null;
  const path: Point[] = [];
  let x = from.x;
  let y = from.y;
  while (x !== to.x || y !== to.y) {
    const here = dist[map.index(x, y)];
    let moved = false;
    for (const d of DIRS) {
      if (!canStep(map, x, y, d.x, d.y)) continue;
      if (dist[map.index(x + d.x, y + d.y)] === here - 1) {
        x += d.x;
        y += d.y;
        path.push({ x, y });
        moved = true;
        break;
      }
    }
    if (!moved) return null;
  }
  return path;
}
