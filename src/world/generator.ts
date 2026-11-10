import { Rng } from "../core/rng";
import { FloorConfig } from "../data/floors";
import { GameMap, Point, Tile } from "./map";
import { distanceField } from "./pathfinding";

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Floor {
  map: GameMap;
  rooms: Room[];
  start: Point;
  stairs: Point;
}

function center(r: Room): Point {
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
}

/** Vrai si les deux salles se touchent ou se chevauchent (avec une case de marge). */
function tooClose(a: Room, b: Room): boolean {
  return a.x - 1 < b.x + b.w && a.x + a.w + 1 > b.x && a.y - 1 < b.y + b.h && a.y + a.h + 1 > b.y;
}

function carveCorridor(map: GameMap, rng: Rng, a: Point, b: Point): void {
  const horizontalFirst = rng.chance(0.5);
  let { x, y } = a;
  const walkX = () => {
    while (x !== b.x) {
      map.set(x, y, Tile.Floor);
      x += Math.sign(b.x - x);
    }
  };
  const walkY = () => {
    while (y !== b.y) {
      map.set(x, y, Tile.Floor);
      y += Math.sign(b.y - y);
    }
  };
  if (horizontalFirst) {
    walkX();
    walkY();
  } else {
    walkY();
    walkX();
  }
  map.set(x, y, Tile.Floor);
}

/** Génère un étage : des salles, reliées par des couloirs, un départ et un escalier. */
export function generateFloor(seed: number, cfg: FloorConfig): Floor {
  const rng = new Rng(seed);
  const map = new GameMap(cfg.width, cfg.height);

  // 1. Placer des salles qui ne se touchent pas.
  const rooms: Room[] = [];
  for (let i = 0; (i < cfg.roomAttempts || rooms.length < cfg.minRooms) && i < 2000; i++) {
    const w = rng.int(cfg.roomMinSize, cfg.roomMaxSize);
    const h = rng.int(cfg.roomMinSize, cfg.roomMaxSize);
    const room: Room = {
      x: rng.int(1, cfg.width - w - 1),
      y: rng.int(1, cfg.height - h - 1),
      w,
      h,
    };
    if (rooms.some((r) => tooClose(r, room))) continue;
    rooms.push(room);
  }
  for (const r of rooms) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) map.set(x, y, Tile.Floor);
    }
  }

  // 2. Relier chaque salle à la salle déjà reliée la plus proche : tout l'étage est accessible.
  const linked: Room[] = [rooms[0]];
  const pending = rooms.slice(1);
  while (pending.length > 0) {
    let best = { p: 0, l: 0, d: Infinity };
    pending.forEach((pr, p) => {
      linked.forEach((lr, l) => {
        const a = center(pr);
        const b = center(lr);
        const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        if (d < best.d) best = { p, l, d };
      });
    });
    const room = pending.splice(best.p, 1)[0];
    carveCorridor(map, rng, center(room), center(linked[best.l]));
    linked.push(room);
  }

  // 3. Quelques couloirs en plus pour créer des boucles.
  for (let i = 0; i < cfg.extraLinks && rooms.length > 2; i++) {
    const a = rooms[rng.int(0, rooms.length - 1)];
    const b = rooms[rng.int(0, rooms.length - 1)];
    if (a !== b) carveCorridor(map, rng, center(a), center(b));
  }

  // 4. Départ dans la première salle, escalier dans la salle la plus éloignée.
  const start = center(rooms[0]);
  const dist = distanceField(map, start);
  let stairs = start;
  let far = 0;
  for (const r of rooms.slice(1)) {
    const c = center(r);
    const d = dist[map.index(c.x, c.y)];
    if (d > far) {
      far = d;
      stairs = c;
    }
  }
  map.set(stairs.x, stairs.y, Tile.StairsDown);

  return { map, rooms, start, stairs };
}
