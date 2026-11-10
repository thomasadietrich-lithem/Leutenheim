import { Rng } from "../core/rng";
import { FloorConfig } from "../data/floors";
import { SPECIAL_ROOMS, SpecialRoomDef } from "../data/specialRooms";
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
  /** Salles spéciales : en cul-de-sac, derrière une porte verrouillée. */
  specials: { room: Room; kind: SpecialRoomDef }[];
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
        if (cx + ox <= map.width - 2 && cy + oy <= map.height - 2 && map.get(cx + ox, cy + oy) === Tile.Wall) {
          map.set(cx + ox, cy + oy, Tile.Floor); // on ne creuse que dans le mur : ni escalier ni porte écrasés
        }
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

/**
 * Génère un étage : des salles reliées par des couloirs, un départ, un escalier, et une à trois salles spéciales.
 * Si aucune salle spéciale n'a pu être placée (étage trop encombré), on retire un étage avec une graine dérivée.
 */
export function generateFloor(seed: number, cfg: FloorConfig): Floor {
  let floor = buildFloor(seed, cfg);
  for (let retry = 1; floor.specials.length === 0 && retry <= 30; retry++) {
    floor = buildFloor((seed + Math.imul(retry, 0x9e3779b1)) >>> 0, cfg);
  }
  return floor;
}

function buildFloor(seed: number, cfg: FloorConfig): Floor {
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

  // 5. Salles spéciales : petites salles en cul-de-sac, reliées par un seul couloir, fermées à clé.
  const specials: { room: Room; kind: SpecialRoomDef }[] = [];
  let pickCount = rng.next() * cfg.specialRoomCounts.reduce((sum, c) => sum + c.weight, 0);
  const wanted = (cfg.specialRoomCounts.find((c) => (pickCount -= c.weight) < 0) ?? cfg.specialRoomCounts[0]).count;
  for (let attempt = 0; attempt < 300 && specials.length < wanted; attempt++) {
    const w = rng.int(cfg.specialRoomMinSize, cfg.specialRoomMaxSize);
    const h = rng.int(cfg.specialRoomMinSize, cfg.specialRoomMaxSize);
    const room: Room = { x: rng.int(2, cfg.width - w - 2), y: rng.int(2, cfg.height - h - 2), w, h };
    // L'emplacement et son pourtour doivent être de la roche pleine.
    let free = true;
    for (let y = room.y - 1; y <= room.y + h && free; y++) {
      for (let x = room.x - 1; x <= room.x + w; x++) {
        if (map.get(x, y) !== Tile.Wall) {
          free = false;
          break;
        }
      }
    }
    if (!free) continue;

    const backup = map.tiles.slice();
    for (let y = room.y; y < room.y + h; y++) {
      for (let x = room.x; x < room.x + w; x++) map.set(x, y, Tile.Floor);
    }
    const c = center(room);
    const nearest = rooms.reduce((a, b) => {
      const da = Math.abs(center(a).x - c.x) + Math.abs(center(a).y - c.y);
      const db = Math.abs(center(b).x - c.x) + Math.abs(center(b).y - c.y);
      return db < da ? b : a;
    });
    carveCorridor(map, rng, c, center(nearest), 0);
    // La salle ne doit avoir qu'une seule entrée, étroite, loin de toute autre porte.
    const openings = ringCells(room).filter((r) => map.get(r.x, r.y) !== Tile.Wall);
    const door = openings[0];
    const valid =
      openings.length === 1 &&
      map.get(door.x + door.tx, door.y + door.ty) === Tile.Wall &&
      map.get(door.x - door.tx, door.y - door.ty) === Tile.Wall &&
      !doorNearby(map, door.x, door.y, cfg.doorSpacing) &&
      // Le nouveau couloir ne doit pas avoir percé une salle spéciale déjà posée.
      specials.every((sp) => ringCells(sp.room).filter((r) => map.get(r.x, r.y) !== Tile.Wall).length === 1);
    if (!valid) {
      map.tiles.set(backup);
      continue;
    }
    map.set(door.x, door.y, Tile.DoorLocked);
    let pickKind = rng.next() * SPECIAL_ROOMS.reduce((sum, k) => sum + k.weight, 0);
    const kind = SPECIAL_ROOMS.find((k) => (pickKind -= k.weight) < 0) ?? SPECIAL_ROOMS[0];
    map.set(c.x, c.y, kind.feature);
    specials.push({ room, kind });
  }

  // 6. Portes et torches des salles ordinaires.
  const torches: LightSource[] = [];
  // Ouvertures de chaque salle (une case de pourtour peut appartenir à deux salles voisines).
  const outlines = rooms.map((room) => {
    const cells = ringCells(room);
    return { cells, openings: cells.filter((c) => map.get(c.x, c.y) !== Tile.Wall) };
  });
  const bypassed = (c: { x: number; y: number }) =>
    outlines.some(
      (o) =>
        o.cells.some((k) => k.x === c.x && k.y === c.y) &&
        o.openings.some((k) => (k.x !== c.x || k.y !== c.y) && Math.abs(k.x - c.x) + Math.abs(k.y - c.y) <= 3),
    );
  rooms.forEach((room, index) => {
    const ring = ringCells(room);
    // Une « entrée étroite » : un passage d'une case, avec un mur de chaque côté.
    const doorways = ring.filter(
      (c) =>
        map.get(c.x, c.y) === Tile.Floor &&
        map.get(c.x + c.tx, c.y + c.ty) === Tile.Wall &&
        map.get(c.x - c.tx, c.y - c.ty) === Tile.Wall,
    );
    // Une porte doit avoir un sens : pas de porte s'il y en a déjà une toute proche (jamais deux à la suite),
    // ni si un autre passage s'ouvre dans le même mur juste à côté (on la contournerait).
    for (const c of doorways) {
      if (!bypassed(c) && !doorNearby(map, c.x, c.y, cfg.doorSpacing) && rng.chance(cfg.doorChance)) {
        map.set(c.x, c.y, Tile.DoorClosed);
      }
    }
    // Colonnes : aux quatre « coins intérieurs » d'une grande salle, parfois seulement une partie d'entre elles.
    if (room.w >= 5 && room.h >= 5 && rng.chance(cfg.pillarChance)) {
      const spots = [
        { x: room.x + 1, y: room.y + 1 },
        { x: room.x + room.w - 2, y: room.y + 1 },
        { x: room.x + 1, y: room.y + room.h - 2 },
        { x: room.x + room.w - 2, y: room.y + room.h - 2 },
      ];
      const all = rng.chance(0.5);
      for (const p of spots) {
        if (map.get(p.x, p.y) === Tile.Floor && (all || rng.chance(0.5))) map.set(p.x, p.y, Tile.Pillar);
      }
    }
    // Torche murale : sur un mur du pourtour de la salle.
    if (index === 0 || rng.chance(cfg.torchChance)) {
      const walls = ring.filter((c) => map.get(c.x, c.y) === Tile.Wall);
      if (walls.length > 0) {
        const w = walls[rng.int(0, walls.length - 1)];
        torches.push({ x: w.x, y: w.y, radius: cfg.torchRadius, faceX: w.nx, faceY: w.ny });
      }
    }
  });

  return { map, rooms, start, stairs, torches, specials };
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

interface RingCell {
  x: number;
  y: number;
  /** Direction qui longe le mur. */
  tx: number;
  ty: number;
  /** Direction vers l'intérieur de la salle. */
  nx: number;
  ny: number;
}

/** Cases du pourtour d'une salle (hors coins). */
function ringCells(r: Room): RingCell[] {
  const cells: RingCell[] = [];
  for (let x = r.x; x < r.x + r.w; x++) {
    cells.push({ x, y: r.y - 1, tx: 1, ty: 0, nx: 0, ny: 1 }, { x, y: r.y + r.h, tx: 1, ty: 0, nx: 0, ny: -1 });
  }
  for (let y = r.y; y < r.y + r.h; y++) {
    cells.push({ x: r.x - 1, y, tx: 0, ty: 1, nx: 1, ny: 0 }, { x: r.x + r.w, y, tx: 0, ty: 1, nx: -1, ny: 0 });
  }
  return cells;
}
