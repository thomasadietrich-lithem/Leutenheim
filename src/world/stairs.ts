import { Floor, Room } from "./generator";
import { GameMap, Point, Tile } from "./map";

/**
 * Escalier « enchâssé dans un U de mur » (Thomas, 2026-11-14 : « Sur tous les étages ») : l'escalier quitte le milieu de
 * sa salle pour une niche creusée dans un de ses murs ; la niche a du mur à gauche, à droite et au fond, et s'ouvre sur
 * la salle. On essaie d'abord le mur du haut (la niche s'ouvre vers le bas, face au joueur), puis la gauche, la droite et
 * le bas, au plus près de l'ancienne place. Sans place possible, l'escalier reste où il était.
 * Rend la nouvelle position (déjà posée sur la carte, avec `tile`) ; l'ancienne case redevient du sol.
 */
export function encaseStairs(floor: Floor, at: Point, tile: Tile): Point {
  const map = floor.map;
  const room = floor.rooms.find((r) => at.x >= r.x && at.x < r.x + r.w && at.y >= r.y && at.y < r.y + r.h);
  if (!room) return at;
  const spot = findNiche(map, room, at, floor);
  if (!spot) return at;
  if (map.get(at.x, at.y) === tile) map.set(at.x, at.y, Tile.Floor);
  map.set(spot.x, spot.y, tile);
  return spot;
}

/** Les quatre murs : la case de la niche (dans le mur), et le sens de la salle (vers où elle s'ouvre). */
function sides(room: Room): { cells: Point[]; dx: number; dy: number }[] {
  const xs = [];
  for (let x = room.x + 1; x <= room.x + room.w - 2; x++) xs.push(x);
  const ys = [];
  for (let y = room.y + 1; y <= room.y + room.h - 2; y++) ys.push(y);
  return [
    { cells: xs.map((x) => ({ x, y: room.y - 1 })), dx: 0, dy: 1 },
    { cells: ys.map((y) => ({ x: room.x - 1, y })), dx: 1, dy: 0 },
    { cells: ys.map((y) => ({ x: room.x + room.w, y })), dx: -1, dy: 0 },
    { cells: xs.map((x) => ({ x, y: room.y + room.h })), dx: 0, dy: -1 },
  ];
}

function findNiche(map: GameMap, room: Room, at: Point, floor: Floor): Point | null {
  for (const side of sides(room)) {
    const order = side.cells.slice().sort((a, b) => Math.abs(a.x - at.x) + Math.abs(a.y - at.y) - (Math.abs(b.x - at.x) + Math.abs(b.y - at.y)));
    for (const c of order) {
      // Toutes les voisines de la niche, sauf la case devant (dans la salle), sont du mur plein.
      let ok = map.get(c.x, c.y) === Tile.Wall && map.get(c.x + side.dx, c.y + side.dy) === Tile.Floor;
      for (let dy = -1; dy <= 1 && ok; dy++) {
        for (let dx = -1; dx <= 1 && ok; dx++) {
          if (dx === 0 && dy === 0) continue;
          const x = c.x + dx;
          const y = c.y + dy;
          // Devant (et en diagonale vers la salle) : c'est la salle.
          if (dx * side.dx + dy * side.dy > 0) continue;
          if (x <= 0 || y <= 0 || x >= map.width - 1 || y >= map.height - 1 || map.get(x, y) !== Tile.Wall) ok = false;
        }
      }
      if (!ok) continue;
      // Pas sur une torche, ni contre la porte d'une salle spéciale.
      if (floor.torches.some((t) => t.x === c.x && t.y === c.y)) continue;
      return c;
    }
  }
  return null;
}
