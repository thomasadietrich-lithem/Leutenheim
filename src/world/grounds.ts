import { Rng } from "../core/rng";
import { RULES } from "../data/rules";
import { Floor } from "./generator";
import { Point, Tile } from "./map";
import { MOTIF_KINDS, MOTIF_SIZE, MotifKind } from "../data/motifs";

/**
 * Sols spéciaux (2026-11-11) : quelques plaques de gravier et quelques flaques, d'une seule tenue (cases voisines),
 * posées sur du sol ordinaire, loin du point d'arrivée et des escaliers. Hasard à part, pour ne rien changer au reste.
 */
export function placeGrounds(floor: Floor, seed: number, depth = 1, avoid: { x: number; y: number; w: number; h: number }[] = []): void {
  const rng = new Rng(seed ^ 0x3a7c51e9);
  const { map } = floor;
  const far = (p: Point, q: Point) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) > 2;
  // Ni gravier ni flaque dans certaines salles (Thomas, 2026-11-13 : la salle de bain ; aussi la ferme), ni sur leur seuil.
  const avoided = (x: number, y: number) => avoid.some((r) => x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h);
  const free = (x: number, y: number) =>
    map.get(x, y) === Tile.Floor && far({ x, y }, floor.start) && far({ x, y }, floor.stairs) && !avoided(x, y);
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
  // Le gravier gagne du terrain en descendant (Thomas, 2026-11-12 : « augmente petit à petit ») :
  // une plaque de plus tous les `gravelGrowth` étages, et des plaques un peu plus grandes.
  const extra = Math.floor((depth - 1) / RULES.gravelGrowth);
  const patches = rng.int(Math.min(RULES.gravelPatches[0] + extra, RULES.gravelPatchesMax), Math.min(RULES.gravelPatches[1] + extra, RULES.gravelPatchesMax));
  for (let i = patches; i > 0; i--) patch(Tile.Gravel, rng.int(RULES.gravelSize[0] + extra, RULES.gravelSize[1] + 2 * extra));
  for (let i = rng.int(RULES.puddles[0], RULES.puddles[1]); i > 0; i--) patch(Tile.Water, rng.int(RULES.puddleSize[0], RULES.puddleSize[1]));
}

/** Un motif gravé au sol : sa case en haut à gauche, sa forme (1 ou 2 × 2 cases). */
export interface Motif {
  x: number;
  y: number;
  kind: MotifKind;
}

/**
 * Motifs au sol (2026-11-11) : de 0 à 2 par étage (C), sur du sol nu d'une salle (toutes les cases du motif), jamais
 * à l'arrivée ni sur l'escalier. Décor seulement. Hasard à part.
 */
export function placeMotifs(floor: Floor, seed: number): Motif[] {
  const rng = new Rng(seed ^ 0x51a7e0b3);
  const out: Motif[] = [];
  const taken = new Set<string>();
  const wanted = rng.int(RULES.motifsPerFloor[0], RULES.motifsPerFloor[1]);
  for (let attempt = 0; attempt < 60 && out.length < wanted; attempt++) {
    const room = floor.rooms[rng.int(0, floor.rooms.length - 1)];
    const kind = MOTIF_KINDS[rng.int(0, MOTIF_KINDS.length - 1)];
    const size = MOTIF_SIZE[kind];
    if (room.w < size + 2 || room.h < size + 2) continue;
    const x = rng.int(room.x + 1, room.x + room.w - 1 - size);
    const y = rng.int(room.y + 1, room.y + room.h - 1 - size);
    let ok = true;
    for (let dy = 0; dy < size && ok; dy++) {
      for (let dx = 0; dx < size && ok; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        if (floor.map.get(cx, cy) !== Tile.Floor || taken.has(`${cx},${cy}`)) ok = false;
        if ((cx === floor.start.x && cy === floor.start.y) || (cx === floor.stairs.x && cy === floor.stairs.y)) ok = false;
      }
    }
    if (!ok) continue;
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) taken.add(`${x + dx},${y + dy}`);
    out.push({ x, y, kind });
  }
  return out;
}
