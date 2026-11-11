import { Rng } from "../core/rng";
import { RULES } from "../data/rules";
import { THEMED_ROOMS, ThemedRoomDef } from "../data/themedRooms";
import { Floor, Room } from "./generator";
import { GameMap, Point, Tile } from "./map";

/** Un meuble posé sur une case (qu'on ne traverse pas, mais qui ne cache pas la vue). */
export interface Furniture {
  x: number;
  y: number;
  kind: string;
}

/** Une salle de fouille : son numéro dans `rooms` et son thème (`THEMED_ROOMS`). */
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

/**
 * Cases où poser un meuble : le long d'un mur de la salle, jamais dans un coin ni juste à côté, jamais près d'une
 * ouverture (porte, couloir), de l'escalier ou du point d'arrivée, et seulement entourées de sol ordinaire.
 */
function wallSpots(floor: Floor, room: Room): Point[] {
  const { map } = floor;
  const spots: Point[] = [];
  const inside = (x: number, y: number) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      const onEdgeX = x === room.x || x === room.x + room.w - 1;
      const onEdgeY = y === room.y || y === room.y + room.h - 1;
      if (onEdgeX === onEdgeY) continue; // milieu de la salle, ou coin
      // Pas à côté d'un coin : à au moins deux cases des bouts du mur.
      if (onEdgeY && (x - room.x < 2 || room.x + room.w - 1 - x < 2)) continue;
      if (onEdgeX && (y - room.y < 2 || room.y + room.h - 1 - y < 2)) continue;
      if (map.get(x, y) !== Tile.Floor) continue;
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) {
        for (let dx = -1; dx <= 1 && ok; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          const t = map.get(nx, ny);
          // Dans la salle : du sol ordinaire. Autour : du mur, sinon c'est une ouverture.
          if (inside(nx, ny) ? t !== Tile.Floor && t !== Tile.Furniture : t !== Tile.Wall) ok = false;
          if ((nx === floor.start.x && ny === floor.start.y) || (nx === floor.stairs.x && ny === floor.stairs.y)) ok = false;
        }
      }
      if (ok) spots.push({ x, y });
    }
  }
  return spots;
}

/** Meuble une salle selon son thème : de `RULES.themedFurnitureMin` à `Max` meubles, sans jamais couper un passage. */
export function furnishRoom(floor: Floor, room: Room, theme: ThemedRoomDef, rng: Rng, out: Furniture[]): number {
  const { map } = floor;
  const wanted = rng.int(RULES.themedFurnitureMin, RULES.themedFurnitureMax);
  const spots = wallSpots(floor, room);
  let placed = 0;
  let before = reachable(map, floor.start);
  while (placed < wanted && spots.length > 0) {
    const spot = spots.splice(rng.int(0, spots.length - 1), 1)[0];
    if (map.get(spot.x, spot.y) !== Tile.Floor) continue;
    // On vérifie que tout le reste de l'étage reste atteignable.
    map.set(spot.x, spot.y, Tile.Furniture);
    const after = reachable(map, floor.start);
    if (after !== before - 1) {
      map.set(spot.x, spot.y, Tile.Floor);
      continue;
    }
    before = after;
    // Le premier meuble de chaque genre d'abord, pour que la salle se reconnaisse.
    const kind = theme.furniture[placed < theme.furniture.length ? placed : rng.int(0, theme.furniture.length - 1)];
    out.push({ x: spot.x, y: spot.y, kind });
    placed++;
  }
  return placed;
}

/** Donjon : quelques salles ordinaires deviennent des salles de fouille. Hasard à part, pour ne rien changer au reste. */
export function furnishFloor(floor: Floor, seed: number): { furniture: Furniture[]; themes: RoomTheme[] } {
  const rng = new Rng(seed ^ 0x6f4a1d93);
  const furniture: Furniture[] = [];
  const themes: RoomTheme[] = [];
  const total = THEMED_ROOMS.reduce((sum, t) => sum + t.weight, 0);
  floor.rooms.forEach((room, index) => {
    if (index === 0 || room.w < 5 || room.h < 5 || !rng.chance(RULES.themedRoomChance)) return;
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) if (floor.map.get(x, y) === Tile.Pillar) return;
    }
    let pick = rng.next() * total;
    const theme = THEMED_ROOMS.find((t) => (pick -= t.weight) < 0) ?? THEMED_ROOMS[0];
    if (furnishRoom(floor, room, theme, rng, furniture) > 0) themes.push({ room: index, id: theme.id });
  });
  return { furniture, themes };
}
