import { Rng } from "../core/rng";
import { RULES } from "../data/rules";
import { Floor } from "./generator";
import { Point, Tile } from "./map";

/**
 * Sols spéciaux (2026-11-11) : quelques plaques de gravier et quelques flaques, d'une seule tenue (cases voisines),
 * posées sur du sol ordinaire, loin du point d'arrivée et des escaliers. Hasard à part, pour ne rien changer au reste.
 */
export function placeGrounds(floor: Floor, seed: number): void {
  const rng = new Rng(seed ^ 0x3a7c51e9);
  const { map } = floor;
  const far = (p: Point, q: Point) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) > 2;
  const free = (x: number, y: number) =>
    map.get(x, y) === Tile.Floor && far({ x, y }, floor.start) && far({ x, y }, floor.stairs);
  const patch = (tile: Tile, size: number) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const seedCell = { x: rng.int(1, map.width - 2), y: rng.int(1, map.height - 2) };
      if (!free(seedCell.x, seedCell.y)) continue;
      // Une tache qui pousse au hasard, case par case, sur le sol ordinaire.
      const cells: Point[] = [seedCell];
      map.set(seedCell.x, seedCell.y, tile);
      for (let tries = 0; cells.length < size && tries < size * 12; tries++) {
        const from = cells[rng.int(0, cells.length - 1)];
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][rng.int(0, 3)];
        const x = from.x + dx;
        const y = from.y + dy;
        if (!free(x, y)) continue;
        map.set(x, y, tile);
        cells.push({ x, y });
      }
      return;
    }
  };
  for (let i = rng.int(RULES.gravelPatches[0], RULES.gravelPatches[1]); i > 0; i--) patch(Tile.Gravel, rng.int(RULES.gravelSize[0], RULES.gravelSize[1]));
  for (let i = rng.int(RULES.puddles[0], RULES.puddles[1]); i > 0; i--) patch(Tile.Water, rng.int(RULES.puddleSize[0], RULES.puddleSize[1]));
}
