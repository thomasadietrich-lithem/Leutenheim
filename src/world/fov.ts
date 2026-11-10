import { GameMap, Point } from "./map";

/** Une source de lumière fixe (torche murale). */
export interface LightSource extends Point {
  radius: number;
}

/** Vrai si rien ne bloque la vue entre deux cases (les cases de départ et d'arrivée ne comptent pas). */
export function hasLineOfSight(map: GameMap, from: Point, to: Point): boolean {
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - x);
  const dy = Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1;
  const sy = y < to.y ? 1 : -1;
  let err = dx - dy;
  while (x !== to.x || y !== to.y) {
    if ((x !== from.x || y !== from.y) && map.blocksSight(x, y)) return false;
    const e2 = 2 * err;
    const stepX = e2 > -dy;
    const stepY = e2 < dx;
    // En diagonale, la vue ne se faufile pas entre deux coins de mur qui se touchent.
    if (stepX && stepY && map.blocksSight(x + sx, y) && map.blocksSight(x, y + sy)) return false;
    if (stepX) {
      err -= dy;
      x += sx;
    }
    if (stepY) {
      err += dx;
      y += sy;
    }
  }
  return true;
}

/**
 * Champ de vision. Une case en ligne de vue est visible si elle est proche (`nearRadius`, la lueur
 * que porte le héros) ou si elle est éclairée par une source et pas trop loin (`farRadius`).
 */
export function computeFov(
  map: GameMap,
  origin: Point,
  nearRadius: number,
  farRadius: number = nearRadius,
  light?: Float32Array,
): Uint8Array {
  const visible = new Uint8Array(map.width * map.height);
  const nearLimit = nearRadius * nearRadius + nearRadius;
  const farLimit = farRadius * farRadius + farRadius;
  for (let y = origin.y - farRadius; y <= origin.y + farRadius; y++) {
    for (let x = origin.x - farRadius; x <= origin.x + farRadius; x++) {
      if (!map.inBounds(x, y)) continue;
      const i = map.index(x, y);
      const d2 = (x - origin.x) ** 2 + (y - origin.y) ** 2;
      const near = d2 <= nearLimit;
      const litAndFar = d2 <= farLimit && light !== undefined && light[i] > 0;
      if (!near && !litAndFar) continue;
      if (hasLineOfSight(map, origin, { x, y })) visible[i] = 1;
    }
  }
  return visible;
}

/** Carte d'éclairage : pour chaque case, 0 (noir) à 1 (au pied d'une torche). */
export function computeLight(map: GameMap, sources: readonly LightSource[]): Float32Array {
  const light = new Float32Array(map.width * map.height);
  for (const s of sources) {
    for (let y = s.y - s.radius; y <= s.y + s.radius; y++) {
      for (let x = s.x - s.radius; x <= s.x + s.radius; x++) {
        if (!map.inBounds(x, y)) continue;
        const d = Math.hypot(x - s.x, y - s.y);
        if (d > s.radius + 0.5 || !hasLineOfSight(map, s, { x, y })) continue;
        const i = map.index(x, y);
        light[i] = Math.max(light[i], 1 - d / (s.radius + 1));
      }
    }
  }
  return light;
}
