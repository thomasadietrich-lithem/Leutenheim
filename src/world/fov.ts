import { GameMap, Point } from "./map";

/** Vrai si rien ne bloque la vue entre deux cases (les murs bloquent, la case d'arrivée ne compte pas). */
export function hasLineOfSight(map: GameMap, from: Point, to: Point): boolean {
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - x);
  const dy = Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1;
  const sy = y < to.y ? 1 : -1;
  let err = dx - dy;
  while (x !== to.x || y !== to.y) {
    if ((x !== from.x || y !== from.y) && !map.isWalkable(x, y)) return false;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return true;
}

/** Champ de vision : 1 pour chaque case visible depuis `origin` dans un rayon donné. */
export function computeFov(map: GameMap, origin: Point, radius: number): Uint8Array {
  const visible = new Uint8Array(map.width * map.height);
  const limit = radius * radius + radius;
  for (let y = origin.y - radius; y <= origin.y + radius; y++) {
    for (let x = origin.x - radius; x <= origin.x + radius; x++) {
      if (!map.inBounds(x, y)) continue;
      const d2 = (x - origin.x) ** 2 + (y - origin.y) ** 2;
      if (d2 > limit) continue;
      if (hasLineOfSight(map, origin, { x, y })) visible[map.index(x, y)] = 1;
    }
  }
  return visible;
}
