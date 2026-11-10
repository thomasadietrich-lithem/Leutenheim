import { Rng } from "../core/rng";
import { FloorConfig } from "../data/floors";
import { GameMap, Point, Tile } from "./map";
import { LightSource } from "./fov";
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
  torches: LightSource[];
}

function center(r: Room): Point {
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
}

/** Vrai si les deux salles se touchent ou se chevauchent (avec une case de marge). */
function tooClose(a: Room, b: Room): boolean {
  return a.x - 1 < b.x + b.w && a.x + a.w + 1 > b.x && a.y - 1 < b.y + b.h && a.y + a.h + 1 > b.y;
}

function carveCorridor(map: GameMap, rng: Rng, a: Point, b: Point, wideChance: number): void {
  const horizontalFirst = rng.chance(0.5);
  const wide = rng.chance(wideChance);
  // Creuse une case, ou un carré de 2×2 pour un couloir double (sans jamais percer le bord).
  const dig = (cx: number, cy: number) => {
    const size = wide ? 2 : 1;
    for (let oy = 0; oy < size; oy++) {
      for (let ox = 0; ox < size; ox++) {
        if (cx + ox <= map.width - 2 && cy + oy <= map.height - 2) map.set(cx + ox, cy + oy, Tile.Floor);
      }
    }
  };
  let { x, y } = a;
  const walkX = () => {
    while (x !== b.x) {
      dig(x, y);
      x += Math.sign(b.x - x);
    }
  };
  const walkY = () => {
    while (y !== b.y) {
      dig(x, y);
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
  dig(x, y);
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
    carveCorridor(map, rng, center(room), center(linked[best.l]), cfg.wideCorridorChance);
    linked.push(room);
  }

  // 3. Quelques couloirs en plus pour créer des boucles.
  for (let i = 0; i < cfg.extraLinks && rooms.length > 2; i++) {
    const a = rooms[rng.int(0, rooms.length - 1)];
    const b = rooms[rng.int(0, rooms.length - 1)];
    if (a !== b) carveCorridor(map, rng, center(a), center(b), cfg.wideCorridorChance);
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

  // 5. Portes et torches, salle par salle.
  const torches: LightSource[] = [];
  rooms.forEach((room, index) => {
    const ring = ringCells(room);
    // Toute ouverture compte, y compris une porte déjà posée par une salle voisine.
    const entrances = ring.filter((c) => map.get(c.x, c.y) !== Tile.Wall);
    // Une « entrée étroite » : un passage d'une case, avec un mur de chaque côté.
    const doorways = entrances.filter(
      (c) => map.get(c.x + c.tx, c.y + c.ty) === Tile.Wall && map.get(c.x - c.tx, c.y - c.ty) === Tile.Wall,
    );
    const hasStairs = stairs.x >= room.x && stairs.x < room.x + room.w && stairs.y >= room.y && stairs.y < room.y + room.h;
    const deadEnd = index > 0 && !hasStairs && entrances.length === 1 && doorways.length === 1;
    // Une porte n'est posée que s'il n'y en a pas déjà une toute proche : jamais deux portes à la suite.
    const canHaveDoor = (c: { x: number; y: number }) =>
      map.get(c.x, c.y) === Tile.Floor && !doorNearby(map, c.x, c.y, cfg.doorSpacing);
    if (deadEnd && canHaveDoor(doorways[0]) && rng.chance(cfg.lockChance)) {
      map.set(doorways[0].x, doorways[0].y, Tile.DoorLocked);
    } else {
      for (const c of doorways) {
        if (canHaveDoor(c) && rng.chance(cfg.doorChance)) map.set(c.x, c.y, Tile.DoorClosed);
      }
    }
    // Torche murale : sur un mur du pourtour de la salle.
    if (index === 0 || rng.chance(cfg.torchChance)) {
      const walls = ring.filter((c) => map.get(c.x, c.y) === Tile.Wall);
      if (walls.length > 0) {
        const w = walls[rng.int(0, walls.length - 1)];
        torches.push({ x: w.x, y: w.y, radius: cfg.torchRadius });
      }
    }
  });

  return { map, rooms, start, stairs, torches };
}

/** Vrai s'il existe déjà une porte à moins de `spacing` cases (distance en pas droits). */
function doorNearby(map: GameMap, x: number, y: number, spacing: number): boolean {
  for (let dy = -spacing + 1; dy < spacing; dy++) {
    for (let dx = -spacing + 1; dx < spacing; dx++) {
      if (Math.abs(dx) + Math.abs(dy) < spacing && map.isDoor(x + dx, y + dy)) return true;
    }
  }
  return false;
}

/** Cases du pourtour d'une salle (hors coins), avec la direction qui longe le mur (tx, ty). */
function ringCells(r: Room): { x: number; y: number; tx: number; ty: number }[] {
  const cells: { x: number; y: number; tx: number; ty: number }[] = [];
  for (let x = r.x; x < r.x + r.w; x++) {
    cells.push({ x, y: r.y - 1, tx: 1, ty: 0 }, { x, y: r.y + r.h, tx: 1, ty: 0 });
  }
  for (let y = r.y; y < r.y + r.h; y++) {
    cells.push({ x: r.x - 1, y, tx: 0, ty: 1 }, { x: r.x + r.w, y, tx: 0, ty: 1 });
  }
  return cells;
}
