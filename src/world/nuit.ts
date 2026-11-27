import { Rng } from "../core/rng";
import { Furniture, roomPlacer } from "./furnish";
import { Floor, Room } from "./generator";
import { Point, Tile } from "./map";

/**
 * SALLES DE LA NUIT DU 27-28/11 (claude/BRIEF_SECTION4_ET_S3.md, planche art/nuit_v1.png) :
 * section 3 : le CIMETIÈRE INTÉRIEUR (Pelle-Creuse), la SALLE D'EMBAUMEMENT (Dame Bandelette), le BAL MACABRE ;
 * section 2 : la CUISINE AUX SPORES (Boletus).
 * Chaque fonction meuble la salle et renvoie vrai, ou ne pose rien et renvoie faux (la salle ne convient pas).
 */

/** Le cimetière : 4 à 7 tombes en rangées (croix, dalles), 1 à 2 tombes fraîches qu'on peut creuser, la pelle, la brouette. */
export function furnishCemetery(floor: Floor, room: Room, rng: Rng, out: Furniture[]): boolean {
  const P = roomPlacer(floor, room);
  let tombs = 0;
  const want = rng.int(4, 7);
  for (let y = room.y + 1; y < room.y + room.h - 1 && tombs < want; y += 2) {
    for (let x = room.x + 1; x < room.x + room.w - 1 && tombs < want; x += 2) {
      if (rng.chance(0.25)) continue;
      if (P.tryPlace({ x, y, kind: rng.chance(0.5) ? "tombeCroix" : "tombeDalle" })) tombs++;
    }
  }
  if (tombs < 3) {
    P.undo();
    return false;
  }
  let fresh = 0;
  for (let k = 0; k < 30 && fresh < rng.int(1, 2); k++) {
    const x = rng.int(room.x + 1, room.x + room.w - 2);
    const y = rng.int(room.y + 1, room.y + room.h - 2);
    if (P.tryPlace({ x, y, kind: "tombeFraiche" })) fresh++;
  }
  if (fresh === 0) {
    P.undo();
    return false;
  }
  for (let k = 0; k < 30; k++) if (P.tryPlace({ x: rng.int(room.x, room.x + room.w - 1), y: room.y, kind: "pelleFichee" })) break;
  for (let k = 0; k < 30; k++) if (P.tryPlace({ x: rng.int(room.x, room.x + room.w - 2), y: rng.int(room.y, room.y + room.h - 1), kind: "brouetteOs" })) break;
  out.push(...P.placed);
  return true;
}

/** L'embaumement : la table au milieu, l'étagère à bocaux au mur du fond, 2 sarcophages debout, le séchoir à bandelettes. */
export function furnishEmbalming(floor: Floor, room: Room, rng: Rng, out: Furniture[]): boolean {
  const P = roomPlacer(floor, room);
  const mx = room.x + Math.floor((room.w - 2) / 2);
  const my = room.y + Math.floor(room.h / 2);
  const table = [0, -1, 1, -2, 2].some((d) => P.tryPlace({ x: mx + d, y: my, kind: "tableEmbaume" }));
  if (!table) return false;
  const shelf = [0, -2, 2, -3, 3, -1, 1].some((d) => P.tryPlace({ x: mx + d, y: room.y, kind: "etagereBocaux" }));
  if (!shelf) {
    P.undo();
    return false;
  }
  let sarcos = 0;
  for (const x of [room.x, room.x + room.w - 1, room.x + 1, room.x + room.w - 2]) {
    if (sarcos >= 2) break;
    if (P.tryPlace({ x, y: room.y, kind: "sarcoDebout" })) sarcos++;
  }
  for (let k = 0; k < 20; k++) if (P.tryPlace({ x: rng.int(room.x, room.x + room.w - 1), y: rng.int(room.y + 1, room.y + room.h - 1), kind: "sechoirBandelettes" })) break;
  out.push(...P.placed);
  return true;
}

/**
 * Le bal macabre : l'orgue contre le mur du fond ; une piste libre au milieu (rayon 2 au moins) où dansent les morts.
 * Renvoie le centre de la piste et ses cases en anneau (les places des danseurs), ou null.
 */
export function furnishBall(floor: Floor, room: Room, rng: Rng, out: Furniture[]): { center: Point; ring: Point[] } | null {
  if (room.w < 7 || room.h < 7) return null;
  const P = roomPlacer(floor, room);
  const mx = room.x + Math.floor((room.w - 2) / 2);
  const organ = [0, -1, 1, -2, 2].some((d) => P.tryPlace({ x: mx + d, y: room.y, kind: "orgueBal" }));
  if (!organ) return null;
  const center = { x: room.x + Math.floor(room.w / 2), y: room.y + 1 + Math.floor((room.h - 1) / 2) };
  // L'anneau : les 8 cases à 2 pas du centre, en ordre (on tourne dans le sens des aiguilles d'une montre).
  const ring = [[0, -2], [1, -2], [2, -1], [2, 0], [2, 1], [1, 2], [0, 2], [-1, 2], [-2, 1], [-2, 0], [-2, -1], [-1, -2]].map(([dx, dy]) => ({ x: center.x + dx, y: center.y + dy }));
  const map = floor.map;
  if (!ring.every((c) => c.x > room.x - 1 && c.x < room.x + room.w && c.y > room.y && c.y < room.y + room.h && map.get(c.x, c.y) === Tile.Floor)) {
    P.undo();
    return null;
  }
  for (const c of ring) P.reserve(c.x, c.y);
  P.reserve(center.x, center.y);
  void rng;
  out.push(...P.placed);
  return { center, ring };
}

/** La cuisine aux spores (section 2) : la marmite qui bouillonne, l'étagère à champignons au mur, la table à découper. */
export function furnishSporeKitchen(floor: Floor, room: Room, rng: Rng, out: Furniture[]): boolean {
  const P = roomPlacer(floor, room);
  const mx = room.x + Math.floor(room.w / 2);
  const shelf = [-1, 0, -2, 1, -3, 2].some((d) => P.tryPlace({ x: mx + d, y: room.y, kind: "etagereChampi" }));
  if (!shelf) return false;
  const my = room.y + Math.floor(room.h / 2);
  const pot = [0, 1, -1, 2, -2].some((d) => P.tryPlace({ x: mx + d, y: my, kind: "marmiteSpores" }));
  if (!pot) {
    P.undo();
    return false;
  }
  for (let k = 0; k < 30; k++) if (P.tryPlace({ x: rng.int(room.x, room.x + room.w - 2), y: rng.int(room.y + 1, room.y + room.h - 1), kind: "tableChampi" })) break;
  out.push(...P.placed);
  return true;
}
