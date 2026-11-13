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

/**
 * Un pas est permis si la case d'arrivée est libre. En diagonale, on peut longer un mur, une porte ou un meuble
 * et couper le coin (Thomas, 2026-11-11) ; on ne se faufile pas seulement entre deux obstacles qui se touchent
 * par le coin (les deux côtés bouchés).
 */
export function canStep(map: GameMap, x: number, y: number, dx: number, dy: number): boolean {
  if (!map.isWalkable(x + dx, y + dy)) return false;
  if (dx !== 0 && dy !== 0) return map.isWalkable(x + dx, y) || map.isWalkable(x, y + dy);
  return true;
}

/**
 * Distance en nombre de pas depuis `from` vers chaque case (-1 = inaccessible). Avec `stop` : on s'arrête dès que
 * cette case est atteinte (audit du 2026-11-13 : les monstres calculaient tout l'étage à chaque pas ; un tour passe de
 * 1,9 à 0,7 ms). Les cases plus proches que `stop` ont alors toutes leur distance, ce qui suffit pour y descendre.
 */
export function distanceField(map: GameMap, from: Point, allowed?: (x: number, y: number) => boolean, stop?: Point): Int32Array {
  const stopAt = stop ? map.index(stop.x, stop.y) : -1;
  const dist = new Int32Array(map.width * map.height).fill(-1);
  const queue: number[] = [map.index(from.x, from.y)];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % map.width;
    const cy = (cur - cx) / map.width;
    for (const d of DIRS) {
      if (!canStep(map, cx, cy, d.x, d.y)) continue;
      if (allowed && !allowed(cx + d.x, cy + d.y)) continue;
      const next = map.index(cx + d.x, cy + d.y);
      if (dist[next] !== -1) continue;
      dist[next] = dist[cur] + 1;
      if (next === stopAt) return dist;
      queue.push(next);
    }
  }
  return dist;
}

/**
 * Plus court chemin de `from` à `to` (sans la case de départ), ou null s'il n'existe pas.
 * `allowed` restreint les cases utilisables (ex. seulement les cases déjà explorées).
 */
export function findPath(
  map: GameMap,
  from: Point,
  to: Point,
  allowed?: (x: number, y: number) => boolean,
): Point[] | null {
  if (!map.isWalkable(to.x, to.y)) return null;
  if (allowed && !allowed(to.x, to.y)) return null;
  // On calcule les distances depuis l'arrivée, puis on descend la pente depuis le départ.
  const dist = distanceField(map, to, allowed, from);
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

/**
 * Case de PASSAGE (Thomas, 2026-11-13 : « les PNJ ne doivent jamais être dans un passage ; mobilier et objets ne doivent
 * jamais bloquer un passage ») : boucher cette case couperait ses voisines praticables en plusieurs groupes (on tourne
 * autour d'elle : chaque suite de voisines praticables est un groupe). Une case au milieu d'une salle n'en est pas une ;
 * une case de couloir, un goulet entre une colonne et un mur, si.
 */
export function isChokepoint(map: GameMap, x: number, y: number, walkable: (x: number, y: number) => boolean = (a, b) => map.isWalkable(a, b)): boolean {
  const ring: [number, number][] = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  const open = ring.map(([dx, dy]) => walkable(x + dx, y + dy));
  // Une diagonale ne relie ses deux voisines droites que si l'une d'elles est praticable : sinon on la compte à part.
  let groups = 0;
  for (let i = 0; i < 8; i++) {
    if (open[i] && !open[(i + 7) % 8]) groups++;
  }
  if (groups === 0 && open.every(Boolean)) groups = 1;
  return groups >= 2;
}

