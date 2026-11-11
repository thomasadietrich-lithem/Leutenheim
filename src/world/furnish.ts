import { Rng } from "../core/rng";
import { RULES } from "../data/rules";
import { FURNITURE_KINDS } from "../data/themedRooms";
import { Floor, Room } from "./generator";
import { GameMap, Point, Tile } from "./map";

/**
 * Un meuble : `x`, `y` = sa case en haut à gauche ; il couvre `FURNITURE_KINDS[kind].w × h` cases. Ceux qui bloquent
 * transforment leurs cases en `Tile.Furniture` (on ne passe pas, la vue passe) ; les chaises debout et le tapis non.
 */
export interface Furniture {
  x: number;
  y: number;
  kind: string;
}

/** Une salle à thème : son numéro dans `rooms` et son thème (`THEMED_ROOMS`). */
export interface RoomTheme {
  room: number;
  id: string;
}

/** Nombre de cases où l'on peut marcher, atteignables depuis `from`. */
function reachable(map: GameMap, from: Point): number {
  const seen = new Uint8Array(map.width * map.height);
  const stack = [from];
  seen[map.index(from.x, from.y)] = 1;
  let count = 0;
  while (stack.length > 0) {
    const p = stack.pop()!;
    count++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (!map.inBounds(x, y) || seen[map.index(x, y)] || !map.isWalkable(x, y)) continue;
      seen[map.index(x, y)] = 1;
      stack.push({ x, y });
    }
  }
  return count;
}

/** Les cases couvertes par un meuble. */
export function furnitureCells(f: Furniture): Point[] {
  const k = FURNITURE_KINDS[f.kind] ?? { w: 1, h: 1 };
  const out: Point[] = [];
  for (let dy = 0; dy < k.h; dy++) for (let dx = 0; dx < k.w; dx++) out.push({ x: f.x + dx, y: f.y + dy });
  return out;
}

/**
 * Meuble un DORTOIR de Schrats (planche art/dortoir_v3.png) : 2 à 4 lits superposés contre le mur du haut, une cheminée
 * sur un mur de côté, un tapis usé posé de travers, une table et 1 à 3 chaises, parfois une chaise renversée.
 * Aucun meuble qui bloque ne coupe un passage : on vérifie que tout le reste de l'étage reste atteignable.
 * Rend faux si la salle ne convient pas (rien n'est alors posé).
 */
export function furnishDortoir(floor: Floor, room: Room, rng: Rng, out: Furniture[]): boolean {
  const { map } = floor;
  if (room.w < 6 || room.h < 5) return false;
  const inside = (x: number, y: number) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) if (map.get(x, y) !== Tile.Floor) return false;
  }
  const special = (x: number, y: number) =>
    (x === floor.start.x && y === floor.start.y) || (x === floor.stairs.x && y === floor.stairs.y);
  // Une case « près d'une ouverture » : une de ses voisines hors de la salle n'est pas du mur (porte, couloir).
  const nearOpening = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inside(nx, ny) && map.get(nx, ny) !== Tile.Wall) return true;
      }
    }
    return false;
  };
  const used = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  let before = reachable(map, floor.start);
  const placed: Furniture[] = [];
  const tryPlace = (f: Furniture): boolean => {
    const kind = FURNITURE_KINDS[f.kind];
    const cells = furnitureCells(f);
    if (cells.some((c) => !inside(c.x, c.y) || used.has(key(c.x, c.y)) || special(c.x, c.y))) return false;
    if (kind.blocks) {
      if (cells.some((c) => nearOpening(c.x, c.y))) return false;
      for (const c of cells) map.set(c.x, c.y, Tile.Furniture);
      const after = reachable(map, floor.start);
      if (after !== before - cells.length) {
        for (const c of cells) map.set(c.x, c.y, Tile.Floor);
        return false;
      }
      before = after;
    }
    for (const c of cells) used.add(key(c.x, c.y));
    placed.push(f);
    return true;
  };

  // Lits superposés, contre le mur du haut, une case d'écart entre deux lits.
  const wanted = rng.int(RULES.bunksMin, RULES.bunksMax);
  let bunks = 0;
  for (let x = room.x; x + 1 < room.x + room.w && bunks < wanted; ) {
    if (tryPlace({ x, y: room.y, kind: rng.chance(0.5) ? "bunkA" : "bunkB" })) {
      bunks++;
      x += 3;
    } else x++;
  }
  if (bunks < 2) {
    for (const f of placed) {
      if (FURNITURE_KINDS[f.kind].blocks) for (const c of furnitureCells(f)) map.set(c.x, c.y, Tile.Floor);
    }
    return false;
  }
  // La rangée devant les lits reste libre (on doit pouvoir y passer).
  for (let x = room.x; x < room.x + room.w; x++) used.add(key(x, room.y + 1));

  // Cheminée, au milieu d'un mur de côté, si le mur est plein à cet endroit ; elle remplace une autre cheminée de la salle.
  const hy = room.y + Math.floor(room.h / 2);
  for (const side of rng.chance(0.5) ? [-1, 1] : [1, -1]) {
    const wx = side < 0 ? room.x - 1 : room.x + room.w;
    const ok = [-1, 0, 1].every((d) => map.get(wx, hy + d) === Tile.Wall) && !floor.torches.some((t) => t.x === wx && t.y === hy);
    if (!ok) continue;
    floor.torches = floor.torches.filter(
      (t) => !(t.hearth && t.x >= room.x - 1 && t.x <= room.x + room.w && t.y >= room.y - 1 && t.y <= room.y + room.h),
    );
    floor.torches.push({ x: wx, y: hy, radius: 5, faceX: -side, faceY: 0, hearth: true, lit: true });
    break;
  }

  // Table de deux cases, à une case au moins des côtés, avec ses chaises à gauche, à droite ou dessous.
  const tableSpots: Point[] = [];
  for (let y = room.y + 2; y < room.y + room.h; y++) {
    for (let x = room.x + 1; x + 2 < room.x + room.w; x++) tableSpots.push({ x, y });
  }
  let table: Furniture | null = null;
  while (tableSpots.length > 0 && !table) {
    const p = tableSpots.splice(rng.int(0, tableSpots.length - 1), 1)[0];
    const f = { x: p.x, y: p.y, kind: rng.chance(RULES.tableAppleChance) ? "tableApple" : "table" };
    if (tryPlace(f)) table = f;
  }
  if (table) {
    const seats = [
      { x: table.x - 1, y: table.y, kind: "chairR" },
      { x: table.x + 2, y: table.y, kind: "chairL" },
      { x: table.x, y: table.y + 1, kind: "chairR" },
    ];
    const wantChairs = rng.int(RULES.chairsMin, RULES.chairsMax);
    let chairs = 0;
    for (const s of seats) if (chairs < wantChairs && tryPlace(s)) chairs++;
  }

  // Le tapis (3 × 2) : sur des cases libres, pas sur la rangée devant les lits.
  for (let attempt = 0; attempt < 30; attempt++) {
    const x = rng.int(room.x, room.x + room.w - 3);
    const y = rng.int(room.y + 2, room.y + room.h - 2);
    if (tryPlace({ x, y, kind: rng.chance(0.5) ? "rug" : "rugB" })) break;
  }

  // Une chaise renversée, parfois, qui bloque sa case.
  if (rng.chance(RULES.fallenChairChance)) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = rng.int(room.x, room.x + room.w - 1);
      const y = rng.int(room.y + 2, room.y + room.h - 1);
      if (tryPlace({ x, y, kind: "chairFallen" })) break;
    }
  }
  // 0 à 2 coffres, contre un mur de côté ou du bas, loin des ouvertures (on marche dessus pour les ouvrir).
  const chests = rng.int(RULES.dortoirChests[0], RULES.dortoirChests[1]);
  let placedChests = 0;
  for (let attempt = 0; attempt < 40 && placedChests < chests; attempt++) {
    const x = rng.int(room.x, room.x + room.w - 1);
    const y = rng.int(room.y + 2, room.y + room.h - 1);
    const onEdge = x === room.x || x === room.x + room.w - 1 || y === room.y + room.h - 1;
    if (!onEdge || used.has(key(x, y)) || special(x, y) || nearOpening(x, y)) continue;
    map.set(x, y, Tile.Chest);
    used.add(key(x, y));
    placedChests++;
  }
  out.push(...placed);
  return true;
}

/** Donjon : au plus un dortoir par étage, dans une salle ordinaire assez grande. Hasard à part. */
export function furnishFloor(floor: Floor, seed: number): { furniture: Furniture[]; themes: RoomTheme[] } {
  const rng = new Rng(seed ^ 0x6f4a1d93);
  const furniture: Furniture[] = [];
  const themes: RoomTheme[] = [];
  if (!rng.chance(RULES.dortoirChance)) return { furniture, themes };
  const candidates = floor.rooms
    .map((room, index) => ({ room, index }))
    .filter(({ room, index }) => index > 0 && room.w >= 6 && room.h >= 5);
  while (candidates.length > 0) {
    const { room, index } = candidates.splice(rng.int(0, candidates.length - 1), 1)[0];
    if (furnishDortoir(floor, room, rng, furniture)) {
      themes.push({ room: index, id: "dortoir" });
      break;
    }
  }
  return { furniture, themes };
}
