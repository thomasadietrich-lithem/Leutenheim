import { Rng } from "../core/rng";
import { RULES } from "../data/rules";
import { FURNITURE_KINDS } from "../data/themedRooms";
import { Floor, Room } from "./generator";
import { GameMap, Point, Tile } from "./map";
import { isChokepoint } from "./pathfinding";

/**
 * Un meuble : `x`, `y` = sa case en haut à gauche ; il couvre `FURNITURE_KINDS[kind].w × h` cases. Ceux qui bloquent
 * transforment leurs cases en `Tile.Furniture` (on ne passe pas, la vue passe) ; les chaises debout et le tapis non.
 */
export interface Furniture {
  x: number;
  y: number;
  kind: string;
  /** Panier à fruits : nombre de pommes posées dedans à la création de l'étage. */
  count?: number;
  /** Table de cuisine (Thomas, 2026-11-13) : une assiette posée dessus ; 1 = la cuisse y est encore, 0 = assiette vide. */
  plate?: number;
  /** Statue creuse (Thomas, 2026-11-12) : elle cache quelque chose ; `hinted` : Gluck l'a dit (la fissure se voit). */
  hollow?: boolean;
  hinted?: boolean;
}

/** Une salle à thème : son numéro dans `rooms` et son thème (`THEMED_ROOMS`). */
export interface RoomTheme {
  room: number;
  id: string;
}

/** Nombre de cases où l'on peut marcher, atteignables depuis `from`. */
/**
 * Case de passage DE LA SALLE NUE (Thomas, 2026-11-13 : « les mobilier et objets ne doivent jamais bloquer un passage ») :
 * un goulet entre murs, colonnes ou portes, comme si aucun meuble n'était encore posé. Les rangées de meubles voulues
 * (bancs de la chapelle, établi et chaise) restent permises : seul le plan de la pièce compte.
 */
function bareChokepoint(map: GameMap, x: number, y: number): boolean {
  return isChokepoint(map, x, y, (a, b) => {
    const t = map.get(a, b);
    return t !== Tile.Wall && t !== Tile.Pillar && t !== Tile.DoorLocked;
  });
}

function blocksPassage(map: GameMap, cells: Point[]): boolean {
  return cells.some((c) => bareChokepoint(map, c.x, c.y));
}

export function reachable(map: GameMap, from: Point): number {
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

/** Une torche (ou une cheminée) est-elle fixée dans le mur juste au-dessus de cette case ? Un meuble haut la cacherait. */
export function underTorch(floor: Floor, x: number, y: number): boolean {
  return floor.torches.some((t) => t.x === x && t.y === y - 1);
}

/**
 * Devant une cheminée (Thomas, 2026-11-12 : « empêche les objets à proximité des cheminées ») : les 2 cases qui la
 * suivent dans la salle, sur 3 de large. Aucun meuble ni trainard n'y est posé.
 */
export function nearHearth(floor: Floor, x: number, y: number): boolean {
  return floor.torches.some((t) => {
    if (!t.hearth) return false;
    const fx = t.faceX ?? 0;
    const fy = t.faceY ?? 0;
    const along = fx !== 0 ? (x - t.x) * fx : (y - t.y) * fy; // cases devant elle (1, 2)
    const across = fx !== 0 ? Math.abs(y - t.y) : Math.abs(x - t.x);
    return along >= 1 && along <= 2 && across <= 1;
  });
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
    if (cells.some((c) => !inside(c.x, c.y) || used.has(key(c.x, c.y)) || special(c.x, c.y) || nearHearth(floor, c.x, c.y))) return false;
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

  // Lits superposés, contre le mur du haut, une case d'écart entre deux lits. Jamais sous une torche du mur
  // (Thomas : « torche derrière un meuble, c'est bizarre »).
  const wanted = rng.int(RULES.bunksMin, RULES.bunksMax);
  let bunks = 0;
  for (let x = room.x; x + 1 < room.x + room.w && bunks < wanted; ) {
    const kind = rng.chance(0.5) ? "bunkA" : "bunkB";
    if (!underTorch(floor, x, room.y) && !underTorch(floor, x + 1, room.y) && tryPlace({ x, y: room.y, kind })) {
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

/**
 * Donjon : 0 à 2 salles à thème par étage (dortoir, cuisine, salle de prière, salle de torture ; jamais deux fois la même),
 * dans des salles ordinaires assez grandes ; puis des trainards (tonneaux, caisses) dans les salles ordinaires, et dès
 * l'étage 3 des toiles dans les coins des salles sans torche. Hasards à part.
 */
export function furnishFloor(floor: Floor, seed: number, depth = 1, bell = false, bath = false): { furniture: Furniture[]; themes: RoomTheme[] } {
  const rng = new Rng(seed ^ 0x6f4a1d93);
  const furniture: Furniture[] = [];
  const themes: RoomTheme[] = [];
  const pool = ["dortoir", "cuisine", "priere", "torture", "forge", "alchimiste", "ferme"];
  for (const chance of RULES.themedRoomChances) {
    if (!rng.chance(chance)) break;
    const id = pool.splice(rng.int(0, pool.length - 1), 1)[0];
    const candidates = floor.rooms
      .map((room, index) => ({ room, index }))
      .filter(({ room, index }) => index > 0 && !themes.some((t) => t.room === index) && fits(id, room));
    while (candidates.length > 0) {
      const { room, index } = candidates.splice(rng.int(0, candidates.length - 1), 1)[0];
      if (FURNISHERS[id](floor, room, rng, furniture)) {
        themes.push({ room: index, id });
        break;
      }
    }
  }
  // Salle de bain du Kobold (truc fun, Thomas 2026-11-13) : la plus petite salle qui convient (4 × 4 au moins).
  if (bath) {
    const candidates = floor.rooms
      .map((room, index) => ({ room, index }))
      .filter(({ room, index }) => index > 0 && !themes.some((t) => t.room === index) && room.w >= 4 && room.h >= 4)
      .sort((a, b) => a.room.w * a.room.h - b.room.w * b.room.h);
    for (const { room, index } of candidates) {
      if (furnishBath(floor, room, new Rng(seed ^ 0xba7b), furniture)) {
        themes.push({ room: index, id: "bain" });
        break;
      }
    }
  }
  const special = new Set(themes.map((t) => t.room));
  placeClutter(floor, new Rng(seed ^ 0x1c3a5e77), furniture, special);
  // Pas de salle qui convienne au bain : la cloche prend sa place (il y a toujours un truc fun dans la section).
  if (bath && !themes.some((t) => t.id === "bain")) bell = true;
  if (bell) placeBell(floor, new Rng(seed ^ 0x5b311e7d), furniture, special);
  if (depth >= RULES.websFromDepth) placeWebs(floor, new Rng(seed ^ 0x3e5b7d19), furniture, special);
  return { furniture, themes };
}

/** Taille minimale de chaque salle à thème. */
const MIN_SIZE: Record<string, [number, number]> = { dortoir: [6, 5], cuisine: [7, 5], priere: [7, 7], torture: [6, 5], forge: [7, 5], alchimiste: [7, 6], ferme: [8, 7] };
function fits(id: string, room: Room): boolean {
  return room.w >= MIN_SIZE[id][0] && room.h >= MIN_SIZE[id][1];
}

type Furnisher = (floor: Floor, room: Room, rng: Rng, out: Furniture[]) => boolean;
const FURNISHERS: Record<string, Furnisher> = {
  dortoir: furnishDortoir,
  cuisine: furnishKitchen,
  priere: furnishChapel,
  torture: furnishTorture,
  forge: furnishForge,
  alchimiste: furnishAlchemist,
  ferme: furnishFarm,
};

/**
 * Outil commun des salles à thème : pose un meuble s'il tient dans la salle, sur des cases libres, loin des ouvertures
 * s'il bloque, et sans rien rendre inaccessible ; `undo` retire tout ce qui a été posé (la salle ne convient pas).
 */
function roomPlacer(floor: Floor, room: Room) {
  const { map } = floor;
  const inside = (x: number, y: number) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
  const special = (x: number, y: number) =>
    (x === floor.start.x && y === floor.start.y) || (x === floor.stairs.x && y === floor.stairs.y);
  const used = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  let before = reachable(map, floor.start);
  const placed: Furniture[] = [];
  const chests: Point[] = [];
  const free = (x: number, y: number) => inside(x, y) && !used.has(key(x, y)) && !special(x, y) && map.get(x, y) === Tile.Floor && !nearHearth(floor, x, y);
  const tryPlace = (f: Furniture): boolean => {
    const kind = FURNITURE_KINDS[f.kind];
    const cells = furnitureCells(f);
    if (cells.some((c) => !free(c.x, c.y))) return false;
    if (kind.blocks) {
      if (cells.some((c) => besideOpening(floor, room, c.x, c.y))) return false;
      for (const c of cells) map.set(c.x, c.y, Tile.Furniture);
      const after = reachable(map, floor.start);
      // Jamais dans un passage (goulet entre deux obstacles), ni en fermant un avec un meuble voisin : Thomas, 2026-11-13.
      if (after !== before - cells.length || blocksPassage(map, cells)) {
        for (const c of cells) map.set(c.x, c.y, Tile.Floor);
        return false;
      }
      before = after;
    }
    for (const c of cells) used.add(key(c.x, c.y));
    placed.push(f);
    return true;
  };
  const reserve = (x: number, y: number) => used.add(key(x, y));
  const chest = (x: number, y: number): boolean => {
    if (!free(x, y)) return false;
    map.set(x, y, Tile.Chest);
    used.add(key(x, y));
    chests.push({ x, y });
    // Un coffre se prend en marchant dessus : il doit rester atteignable (il compte comme du sol).
    return true;
  };
  const undo = () => {
    for (const f of placed) if (FURNITURE_KINDS[f.kind].blocks) for (const c of furnitureCells(f)) map.set(c.x, c.y, Tile.Floor);
    for (const c of chests) map.set(c.x, c.y, Tile.Floor);
    placed.length = 0;
  };
  const allFloor = () => {
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) if (map.get(x, y) !== Tile.Floor) return false;
    return true;
  };
  /** Le long du mur du fond (rangée du haut), de gauche à droite, en sautant les cases sous une torche. */
  const alongBackWall = (kinds: string[]) => {
    let x = room.x;
    for (const kind of kinds) {
      const w = FURNITURE_KINDS[kind].w;
      while (x + w <= room.x + room.w) {
        const torch = [...Array(w).keys()].some((i) => underTorch(floor, x + i, room.y));
        if (!torch && tryPlace({ x, y: room.y, kind })) {
          x += w;
          break;
        }
        x++;
      }
    }
  };
  /**
   * Rigole v2 (Thomas, 2026-11-11 : « moins régulière, et atteindre les évacuations ») : un tracé qui serpente de `from`
   * jusqu'à la grille `to`, case par case (pas de diagonale), sur des cases libres ; chemin le moins cher avec un coût
   * tiré au hasard par case, d'où les détours. Chaque case reçoit le morceau qui la relie à ses voisines.
   */
  const gutter = (rng: Rng, prefix: "gut" | "bgut", from: Point, to: Point): boolean => {
    if (!free(from.x, from.y) || !free(to.x, to.y)) return false;
    const cost = new Map<string, number>();
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) cost.set(key(x, y), 1 + rng.int(0, 4));
    const dist = new Map<string, number>([[key(from.x, from.y), 0]]);
    const prev = new Map<string, Point>();
    const open: Point[] = [from];
    while (open.length > 0) {
      open.sort((p, q) => dist.get(key(p.x, p.y))! - dist.get(key(q.x, q.y))!);
      const p = open.shift()!;
      if (p.x === to.x && p.y === to.y) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = { x: p.x + dx, y: p.y + dy };
        if (!free(n.x, n.y)) continue;
        const d = dist.get(key(p.x, p.y))! + cost.get(key(n.x, n.y))!;
        if (d < (dist.get(key(n.x, n.y)) ?? Infinity)) {
          dist.set(key(n.x, n.y), d);
          prev.set(key(n.x, n.y), p);
          open.push(n);
        }
      }
    }
    if (!prev.has(key(to.x, to.y)) && !(from.x === to.x && from.y === to.y)) return false;
    const path: Point[] = [to];
    while (path[0].x !== from.x || path[0].y !== from.y) path.unshift(prev.get(key(path[0].x, path[0].y))!);
    const side = (a: Point, b: Point) => (b.y < a.y ? "N" : b.y > a.y ? "S" : b.x > a.x ? "E" : "W");
    path.forEach((p, i) => {
      const sides = [i > 0 ? side(p, path[i - 1]) : "", i < path.length - 1 ? side(p, path[i + 1]) : ""].filter(Boolean);
      let kind: string;
      if (i === path.length - 1) kind = `${prefix}Drain_${sides[0] ?? "N"}`;
      else if (sides.length < 2) kind = `${prefix}_${sides[0]}`;
      else {
        const m = "NESW".split("").filter((c) => sides.includes(c)).join("");
        kind = m === "NS" || m === "EW" ? `${prefix}_${m}${rng.chance(0.5) ? "a" : "b"}` : `${prefix}_${m === "ES" ? "SE" : m === "SW" ? "SW" : m === "EW" ? "EW" : m === "NW" ? "NW" : m === "NE" ? "NE" : m}`;
      }
      tryPlace({ x: p.x, y: p.y, kind });
    });
    return true;
  };
  return { tryPlace, reserve, chest, undo, allFloor, alongBackWall, placed, free, inside, gutter };
}

/**
 * SALLE DE BAIN DU KOBOLD (Thomas, 2026-11-13 ; planche art/salle_bain_v1.png) : la baignoire (2 cases) et le
 * porte-serviettes le long du mur du fond, le tourne-disque contre le mur aussi, la table basse à bougies devant, le tapis
 * de bain devant la baignoire. Carrelage noir et blanc (voir `Game.floorStyle`). Le Kobold endormi est géré par la partie.
 */
export function furnishBath(floor: Floor, room: Room, rng: Rng, out: Furniture[]): boolean {
  const P = roomPlacer(floor, room);
  if (!P.allFloor()) return false;
  P.alongBackWall(rng.chance(0.5) ? ["tub", "towelRack", "gramophone"] : ["gramophone", "tub", "towelRack"]);
  const tub = P.placed.find((f) => f.kind === "tub");
  if (!tub || !P.placed.some((f) => f.kind === "gramophone")) {
    P.undo();
    return false;
  }
  P.tryPlace({ x: tub.x, y: tub.y + 1, kind: "bathMat" });
  for (const x of [tub.x + 2, tub.x - 1, tub.x + 1]) if (P.tryPlace({ x, y: tub.y + 1, kind: "lowTable" })) break;
  out.push(...P.placed);
  return true;
}

function shuffle<T>(rng: Rng, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * CUISINE v2 (planche art/cuisine_v2.png) : le long du mur du fond, 1 à 2 étagères de 2 cases, le plan de travail
 * ensanglanté et 0 à 2 jambons au crochet ; la rangée devant reste libre ; une barrique de vin contre un mur de côté ;
 * une table et ses chaises ; 1 à 3 tonneaux, caisses ou sacs de céréales ; une rigole jusqu'à une évacuation sur la
 * rangée du bas. Carrelage clair (voir `Game.floorStyle`).
 */
export function furnishKitchen(floor: Floor, room: Room, rng: Rng, out: Furniture[]): boolean {
  const P = roomPlacer(floor, room);
  if (!P.allFloor()) return false;
  const back = ["counter", ...Array(rng.int(1, 2)).fill("shelf2"), ...Array(rng.int(0, 2)).fill("ham")];
  P.alongBackWall(shuffle(rng, back));
  if (!P.placed.some((f) => f.kind === "counter") || !P.placed.some((f) => f.kind === "shelf2")) {
    P.undo();
    return false;
  }
  for (let x = room.x; x < room.x + room.w; x++) P.reserve(x, room.y + 1);
  // Rigole (v2) : elle part d'une petite flaque sous le plan de travail et serpente jusqu'à la grille, sur la rangée du
  // bas, d'un côté ou de l'autre.
  const gy = room.y + room.h - 1;
  const leftDrain = rng.chance(0.5);
  const drainAt = { x: leftDrain ? room.x + rng.int(0, 1) : room.x + room.w - 1 - rng.int(0, 1), y: gy };
  const srcX = leftDrain ? room.x + room.w - 1 - rng.int(1, Math.max(1, Math.floor(room.w / 3))) : room.x + rng.int(1, Math.max(1, Math.floor(room.w / 3)));
  P.gutter(rng, "gut", { x: srcX, y: room.y + 2 }, drainAt);
  // Barrique couchée contre un mur de côté.
  for (let attempt = 0; attempt < 12; attempt++) {
    const left = rng.chance(0.5);
    const y = rng.int(room.y + 2, gy - 1);
    if (P.tryPlace({ x: left ? room.x : room.x + room.w - 2, y, kind: "barrique" })) break;
  }
  placeTableWithChairs(P, room, rng);
  // Tonneaux, caisses, sacs de céréales contre un mur.
  const wanted = rng.int(1, 3);
  let put = 0;
  for (let attempt = 0; attempt < 30 && put < wanted; attempt++) {
    const x = rng.int(room.x, room.x + room.w - 1);
    const y = rng.int(room.y + 2, gy - 1);
    if (x !== room.x && x !== room.x + room.w - 1) continue;
    const kind = (["barrel", "crate", "crateStack", "grainSack"] as const)[rng.int(0, 3)];
    if (P.tryPlace({ x, y, kind })) put++;
  }
  // Un panier à fruits avec 2 à 3 pommes (Thomas), sur une case libre au bord de la salle.
  for (let attempt = 0; attempt < 30; attempt++) {
    const x = rng.int(room.x, room.x + room.w - 1);
    const y = rng.int(room.y + 2, gy - 1);
    if (P.tryPlace({ x, y, kind: "basket", count: rng.int(2, 3) })) break;
  }
  // Une assiette avec une cuisse de poulet SUR LA TABLE (Thomas, 2026-11-13 : « place l'assiette sur la table ») ; sans
  // table, au sol comme avant.
  const table = P.placed.find((f) => f.kind === "table" || f.kind === "tableApple");
  if (table) {
    table.kind = "table";
    table.plate = 1;
  } else {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = rng.int(room.x, room.x + room.w - 1);
      const y = rng.int(room.y + 2, gy - 1);
      if (P.tryPlace({ x, y, kind: "plate", count: 1 })) break;
    }
  }
  out.push(...P.placed);
  return true;
}

/** Une table (avec ou sans pomme) et 1 à 3 chaises, au milieu de la salle (comme au dortoir). */
function placeTableWithChairs(P: ReturnType<typeof roomPlacer>, room: Room, rng: Rng): void {
  const spots: Point[] = [];
  for (let y = room.y + 2; y < room.y + room.h - 1; y++) for (let x = room.x + 1; x + 2 < room.x + room.w; x++) spots.push({ x, y });
  while (spots.length > 0) {
    const p = spots.splice(rng.int(0, spots.length - 1), 1)[0];
    const table = { x: p.x, y: p.y, kind: rng.chance(RULES.tableAppleChance) ? "tableApple" : "table" };
    if (!P.tryPlace(table)) continue;
    const wantChairs = rng.int(RULES.chairsMin, RULES.chairsMax);
    let chairs = 0;
    for (const s of [
      { x: table.x - 1, y: table.y, kind: "chairR" },
      { x: table.x + 2, y: table.y, kind: "chairL" },
      { x: table.x, y: table.y + 1, kind: "chairR" },
    ]) {
      if (chairs < wantChairs && P.tryPlace(s)) chairs++;
    }
    return;
  }
}

/**
 * SALLE DE PRIÈRE v1 (planche art/priere_v1.png) : une allée au milieu, couverte d'un tapis de velours déchiré ; 2 à 6
 * bancs de 2 cases de part et d'autre (0 à 3 cassés ; autant que la salle en tient), une rangée libre entre deux rangs ;
 * l'autel (3 cases) en haut de l'allée ; derrière lui, une rangée libre et un coffre contre le mur ; 0 à 2 candélabres ;
 * 2 à 6 vitraux dans le mur du fond.
 */
export function furnishChapel(floor: Floor, room: Room, rng: Rng, out: Furniture[]): boolean {
  // Pas de cheminée dans une salle de prière : on l'éteint (on la remet si la salle ne s'y prête pas).
  const torches = floor.torches;
  floor.torches = torches.filter((t) => !(t.hearth && t.x >= room.x - 1 && t.x <= room.x + room.w && t.y >= room.y - 1 && t.y <= room.y + room.h));
  const ok = furnishChapelInner(floor, room, rng, out);
  if (!ok) floor.torches = torches;
  return ok;
}

function furnishChapelInner(floor: Floor, room: Room, rng: Rng, out: Furniture[]): boolean {
  const P = roomPlacer(floor, room);
  if (!P.allFloor()) return false;
  const ax = room.x + Math.floor(room.w / 2);
  // Le coffre contre le mur du fond, une rangée libre, puis l'autel : on voit le coffre derrière le pupitre et on y accède.
  if (!P.tryPlace({ x: ax - 1, y: room.y + 2, kind: "altar" })) return false;
  P.chest(ax, room.y);
  for (let x = room.x; x < room.x + room.w; x++) P.reserve(x, room.y + 1);
  // Allée : le tapis, puis les bancs de part et d'autre.
  for (let y = room.y + 3; y < room.y + room.h; y++) P.tryPlace({ x: ax, y, kind: (["runnerA", "runnerB", "runnerC"] as const)[(y - room.y) % 3] });
  const rows: number[] = [];
  for (let y = room.y + 4; y < room.y + room.h - 1; y += 2) rows.push(y);
  const slots = shuffle(rng, rows.flatMap((y) => [{ x: ax - 2, y }, { x: ax + 1, y }]));
  const wanted = rng.int(2, 6);
  let broken = rng.int(0, 3);
  let pews = 0;
  for (const s of slots) {
    if (pews >= wanted) break;
    const kind = broken > 0 && rng.chance(0.4) ? "pewBroken" : "pew";
    if (P.tryPlace({ ...s, kind })) {
      pews++;
      if (kind === "pewBroken") broken--;
    }
  }
  if (pews < 2) {
    P.undo();
    floor.map.set(ax, room.y, Tile.Floor);
    return false;
  }
  // Candélabres (0 à 2) de 0 à 3 bougies, de part et d'autre de l'autel, jamais sous une torche.
  const candles = rng.int(0, 2);
  const spots = shuffle(rng, [{ x: ax - 2, y: room.y + 2 }, { x: ax + 2, y: room.y + 2 }, { x: room.x, y: room.y }, { x: room.x + room.w - 1, y: room.y }]);
  let lit = 0;
  for (const s of spots) {
    if (lit >= candles) break;
    if (underTorch(floor, s.x, s.y)) continue;
    if (P.tryPlace({ ...s, kind: (["candelBare", "candelA", "candelB", "candelC"] as const)[rng.int(0, 3)] })) lit++;
  }
  // 2 à 6 vitraux abîmés dans le mur du fond (Thomas), sur des cases de mur qui ne se touchent pas, sans torche.
  const wy = room.y - 1;
  const wallSpots = shuffle(
    rng,
    [...Array(room.w).keys()].map((i) => room.x + i).filter((x) => floor.map.get(x, wy) === Tile.Wall && !floor.torches.some((t) => t.x === x && t.y === wy)),
  );
  const windows = rng.int(2, 6);
  const glassAt: number[] = [];
  for (const x of wallSpots) {
    if (glassAt.length >= windows) break;
    if (glassAt.some((g) => Math.abs(g - x) < 2)) continue;
    glassAt.push(x);
    P.placed.push({ x, y: wy, kind: `vitrail${glassAt.length % 2}` });
  }
  out.push(...P.placed);
  return true;
}

/**
 * SALLE DE TORTURE v1 (planche art/torture_v1.png) : contre le mur du fond, 1 à 2 râteliers d'outils, 0 à 1 planche au
 * mur et 0 à 2 grappes de cordes ; la table à chaînes au milieu, une rigole de sang qui descend jusqu'à une grille ;
 * 0 à 2 sarcophages à pointes contre les murs de côté. Dalles sombres (voir `Game.floorStyle`).
 */
export function furnishTorture(floor: Floor, room: Room, rng: Rng, out: Furniture[]): boolean {
  const P = roomPlacer(floor, room);
  if (!P.allFloor()) return false;
  const back = [...Array(rng.int(1, 2)).fill("toolRack"), ...Array(rng.int(0, 1)).fill("wallBoard"), ...Array(rng.int(0, 2)).fill("rope")].map((k) => (k === "rope" ? ["ropeA", "ropeB", "ropeC"][rng.int(0, 2)] : k));
  P.alongBackWall(shuffle(rng, back));
  if (!P.placed.some((f) => f.kind === "toolRack")) {
    P.undo();
    return false;
  }
  for (let x = room.x; x < room.x + room.w; x++) P.reserve(x, room.y + 1);
  // La table, au milieu de la salle, puis la rigole qui part de dessous jusqu'au bas de la salle.
  const spots: Point[] = [];
  for (let y = room.y + 2; y < room.y + room.h - 2; y++) for (let x = room.x + 1; x + 2 < room.x + room.w; x++) spots.push({ x, y });
  let table: Furniture | null = null;
  while (spots.length > 0 && !table) {
    const p = spots.splice(rng.int(0, spots.length - 1), 1)[0];
    const f = { x: p.x, y: p.y, kind: "rackTable" };
    if (P.tryPlace(f)) table = f;
  }
  if (!table) {
    P.undo();
    return false;
  }
  // Rigole de sang (v2) : de sous la table, elle serpente jusqu'à la grille sur la rangée du bas.
  const gx = table.x + rng.int(0, 1);
  const drainX = Math.max(room.x + 1, Math.min(room.x + room.w - 2, gx + rng.int(-3, 3)));
  if (!P.gutter(rng, "bgut", { x: gx, y: table.y + 1 }, { x: drainX, y: room.y + room.h - 1 })) P.gutter(rng, "bgut", { x: gx, y: table.y + 1 }, { x: gx, y: room.y + room.h - 1 });
  // Sarcophages contre les murs de côté.
  const maidens = rng.int(0, 2);
  let put = 0;
  for (let attempt = 0; attempt < 20 && put < maidens; attempt++) {
    const x = rng.chance(0.5) ? room.x : room.x + room.w - 1;
    const y = rng.int(room.y + 2, room.y + room.h - 1);
    if (P.tryPlace({ x, y, kind: "maiden" })) put++;
  }
  out.push(...P.placed);
  return true;
}

/** Case de sol libre (ni meuble, ni départ, ni escalier) ? */
function freeCell(floor: Floor, furniture: Furniture[], x: number, y: number): boolean {
  if (floor.map.get(x, y) !== Tile.Floor) return false;
  if ((x === floor.start.x && y === floor.start.y) || (x === floor.stairs.x && y === floor.stairs.y)) return false;
  return !furniture.some((f) => furnitureCells(f).some((c) => c.x === x && c.y === y));
}

/** Une voisine (8 directions) hors de la salle qui n'est pas du mur : porte ou couloir. */
function besideOpening(floor: Floor, room: Room, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      const inside = nx >= room.x && nx < room.x + room.w && ny >= room.y && ny < room.y + room.h;
      if (!inside && floor.map.get(nx, ny) !== Tile.Wall) return true;
    }
  }
  return false;
}

/**
 * Trainards (Thomas : « des items génériques qui traînent dans le donjon ») : un tonneau, une caisse ou deux caisses
 * empilées, contre un mur d'une salle ordinaire, loin des ouvertures et jamais sous une torche. Ils bloquent leur case
 * (on vérifie que rien ne devient inaccessible) et l'on peut se cacher derrière.
 */
export function placeClutter(floor: Floor, rng: Rng, furniture: Furniture[], special: Set<number>): void {
  const { map } = floor;
  const wanted = rng.int(RULES.clutterPerFloor[0], RULES.clutterPerFloor[1]);
  let before = reachable(map, floor.start);
  let placed = 0;
  for (let attempt = 0; attempt < wanted * 15 && placed < wanted; attempt++) {
    const index = rng.int(1, Math.max(1, floor.rooms.length - 1));
    const room = floor.rooms[index];
    if (!room || special.has(index)) continue;
    const x = rng.int(room.x, room.x + room.w - 1);
    const y = rng.int(room.y, room.y + room.h - 1);
    const kind = (["barrel", "crate", "crateStack"] as const)[rng.int(0, 2)];
    const againstWall = x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1;
    if (!againstWall || !freeCell(floor, furniture, x, y) || besideOpening(floor, room, x, y) || underTorch(floor, x, y) || nearHearth(floor, x, y)) continue;
    map.set(x, y, Tile.Furniture);
    const after = reachable(map, floor.start);
    if (after !== before - 1 || blocksPassage(map, [{ x, y }])) {
      map.set(x, y, Tile.Floor);
      continue;
    }
    before = after;
    furniture.push({ x, y, kind });
    placed++;
  }
}

/**
 * La cloche d'alarme (Thomas, 2026-11-12), le « truc fun » de certaines sections : sur son support de bois, au milieu d'une salle
 * ordinaire, loin des ouvertures. Elle bloque sa case (rien ne devient inaccessible) et brûle.
 */
export function placeBell(floor: Floor, rng: Rng, furniture: Furniture[], special: Set<number>, kind = "bell", avoid?: (x: number, y: number) => boolean): boolean {
  const { map } = floor;
  const before = reachable(map, floor.start);
  const specials = (floor as Floor & { specials?: { room: Room }[] }).specials ?? [];
  for (let attempt = 0; attempt < 40; attempt++) {
    const index = rng.int(1, Math.max(1, floor.rooms.length - 1));
    const room = floor.rooms[index];
    if (!room || special.has(index) || specials.some((s) => s.room === room) || room.w < 4 || room.h < 4) continue;
    const x = rng.int(room.x + 1, room.x + room.w - 2);
    const y = rng.int(room.y + 1, room.y + room.h - 2);
    if (!freeCell(floor, furniture, x, y) || besideOpening(floor, room, x, y) || nearHearth(floor, x, y)) continue;
    if ((x === floor.stairs.x && y === floor.stairs.y) || (x === floor.start.x && y === floor.start.y)) continue;
    if (avoid?.(x, y)) continue;
    map.set(x, y, Tile.Furniture);
    if (reachable(map, floor.start) !== before - 1 || blocksPassage(map, [{ x, y }])) {
      map.set(x, y, Tile.Floor);
      continue;
    }
    furniture.push({ x, y, kind });
    return true;
  }
  return false;
}

/**
 * Toiles d'araignée (dès l'étage 3) : dans les coins des salles qui n'ont ni torche ni cheminée. Une toile ne bloque
 * pas : elle colle (voir `Game.enterWeb`) et brûle.
 */
export function placeWebs(floor: Floor, rng: Rng, furniture: Furniture[], special: Set<number>): void {
  floor.rooms.forEach((room, index) => {
    if (index === 0 || special.has(index) || !rng.chance(RULES.webRoomChance)) return;
    const lit = floor.torches.some((t) => t.x >= room.x - 1 && t.x <= room.x + room.w && t.y >= room.y - 1 && t.y <= room.y + room.h);
    if (lit) return;
    const corners = [
      { x: room.x, y: room.y, kind: "webTL" },
      { x: room.x + room.w - 1, y: room.y, kind: "webTR" },
      { x: room.x, y: room.y + room.h - 1, kind: "webBL" },
      { x: room.x + room.w - 1, y: room.y + room.h - 1, kind: "webBR" },
    ];
    let wanted = rng.int(RULES.webCorners[0], RULES.webCorners[1]);
    while (wanted > 0 && corners.length > 0) {
      const c = corners.splice(rng.int(0, corners.length - 1), 1)[0];
      if (!freeCell(floor, furniture, c.x, c.y) || besideOpening(floor, room, c.x, c.y)) continue;
      furniture.push(c);
      wanted--;
    }
  });
}

/** Pose de 0 à `max` meubles de cette sorte sur des cases au hasard d'une zone de la salle ; rend le nombre posé. */
function scatter(P: ReturnType<typeof roomPlacer>, rng: Rng, kinds: string[], count: number, zone: () => Point): number {
  let put = 0;
  for (let attempt = 0; attempt < count * 25 && put < count; attempt++) {
    const p = zone();
    if (P.tryPlace({ ...p, kind: kinds[rng.int(0, kinds.length - 1)] })) put++;
  }
  return put;
}

/** Des coffres contre un mur de côté ou du bas, loin des ouvertures. */
function edgeChests(P: ReturnType<typeof roomPlacer>, floor: Floor, room: Room, rng: Rng, count: number): void {
  let put = 0;
  for (let attempt = 0; attempt < 40 && put < count; attempt++) {
    const x = rng.int(room.x, room.x + room.w - 1);
    const y = rng.int(room.y + 2, room.y + room.h - 1);
    const edge = x === room.x || x === room.x + room.w - 1 || y === room.y + room.h - 1;
    if (!edge || besideOpening(floor, room, x, y)) continue;
    if (P.chest(x, y)) put++;
  }
}

/**
 * FORGE v2 (Thomas, 2026-11-13 : « redesigne la forge » ; mêmes dessins, nouvelle disposition) : un atelier lisible.
 * Au mur du fond, la FORGE AU MILIEU, un tas de charbon contre elle, puis étagères à outils, râteliers d'armes et
 * armures rouillées de part et d'autre ; la rangée devant reste libre ; l'ENCLUME juste devant la forge ; l'ÉTABLI
 * contre le mur du bas avec une chaise ; la MEULE à l'écart ; tonneaux dans les coins du bas ; 0 à 2 coffres. Aucun
 * outil (enclume, meule) collé à un autre meuble : leurs dessins se superposaient. Plus d'épée rouillée au sol.
 */
export function furnishForge(floor: Floor, room: Room, rng: Rng, out: Furniture[]): boolean {
  const P = roomPlacer(floor, room);
  if (!P.allFloor()) return false;
  // La forge, au plus près du milieu du mur du fond.
  const mid = room.x + Math.floor((room.w - 2) / 2);
  let forgeX = -1;
  for (const dx of [0, -1, 1, -2, 2, -3, 3]) {
    const x = mid + dx;
    if (x < room.x || x + 1 >= room.x + room.w || underTorch(floor, x, room.y) || underTorch(floor, x + 1, room.y)) continue;
    if (P.tryPlace({ x, y: room.y, kind: "forge" })) {
      forgeX = x;
      break;
    }
  }
  if (forgeX < 0) {
    P.undo();
    return false;
  }
  // Un tas de charbon contre la forge, d'un côté.
  const coalSide = rng.chance(0.5) ? [forgeX - 1, forgeX + 2] : [forgeX + 2, forgeX - 1];
  for (const x of coalSide) if (!underTorch(floor, x, room.y) && P.tryPlace({ x, y: room.y, kind: rng.chance(0.5) ? "coalL" : "coalM" })) break;
  // De part et d'autre, en alternant gauche et droite depuis la forge : étagères, râteliers, armures.
  const wall = shuffle(rng, [
    ...Array(rng.int(1, 2)).fill("toolShelf"),
    ...Array(rng.int(1, 2)).fill("weaponRack"),
    ...Array.from({ length: rng.int(0, 1) }, () => (rng.chance(0.5) ? "armorStand" : "armorStandB")),
  ]);
  const left: number[] = [];
  const right: number[] = [];
  for (let x = forgeX - 1; x >= room.x; x--) left.push(x);
  for (let x = forgeX + 2; x < room.x + room.w; x++) right.push(x);
  const sides = rng.chance(0.5) ? [left, right] : [right, left];
  wall.forEach((kind, i) => {
    const cells = sides[i % 2];
    while (cells.length > 0) {
      const x = cells.shift()!;
      if (!underTorch(floor, x, room.y) && P.tryPlace({ x, y: room.y, kind })) break;
    }
  });
  for (let x = room.x; x < room.x + room.w; x++) P.reserve(x, room.y + 1);
  // Rien de collé (8 voisines) à ce qu'on pose : pour l'enclume et la meule.
  const alone = (x: number, y: number) => !P.placed.some((f) => furnitureCells(f).some((c) => Math.abs(c.x - x) <= 1 && Math.abs(c.y - y) <= 1));
  // L'enclume, juste devant la forge (on ne regarde pas le mur du fond, la rangée libre l'en sépare).
  const nearBack = (x: number, y: number) => !P.placed.some((f) => f.y > room.y && furnitureCells(f).some((c) => Math.abs(c.x - x) <= 1 && Math.abs(c.y - y) <= 1));
  for (const x of rng.chance(0.5) ? [forgeX, forgeX + 1] : [forgeX + 1, forgeX]) {
    if (nearBack(x, room.y + 2) && P.tryPlace({ x, y: room.y + 2, kind: "anvil" })) break;
  }
  // L'établi contre le mur du bas, d'un côté, et sa chaise à côté.
  const bottom = room.y + room.h - 1;
  const benchXs = rng.chance(0.5) ? [room.x + 1, room.x + room.w - 3] : [room.x + room.w - 3, room.x + 1];
  for (const x of benchXs) {
    if (!P.tryPlace({ x, y: bottom, kind: "workbench" })) continue;
    const seat = x === room.x + 1 ? { x: x + 2, y: bottom, kind: "chairL" } : { x: x - 1, y: bottom, kind: "chairR" };
    if (rng.chance(0.7)) P.tryPlace(seat);
    break;
  }
  // La meule, seule dans un coin libre du milieu de la salle.
  for (let attempt = 0; attempt < 30; attempt++) {
    const x = rng.int(room.x + 1, room.x + room.w - 2);
    const y = rng.int(room.y + 2, room.y + room.h - 2);
    if (alone(x, y) && P.tryPlace({ x, y, kind: "grindstone" })) break;
  }
  // Coffres, puis tonneaux dans les coins du bas (pas sous un meuble ni un coffre : le haut du tonneau le cacherait),
  // un petit tas de charbon contre un mur.
  edgeChests(P, floor, room, rng, rng.int(0, 2));
  const above = (x: number, y: number) => floor.map.get(x, y - 1) === Tile.Chest || P.placed.some((f) => furnitureCells(f).some((c) => c.x === x && c.y === y - 1));
  for (const x of shuffle(rng, [room.x, room.x + room.w - 1]).slice(0, rng.int(0, 2))) if (!above(x, bottom)) P.tryPlace({ x, y: bottom, kind: "barrel" });
  if (rng.chance(0.5)) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = rng.chance(0.5) ? room.x : room.x + room.w - 1;
      if (P.tryPlace({ x, y: rng.int(room.y + 2, bottom - 1), kind: "coalS" })) break;
    }
  }
  out.push(...P.placed);
  return true;
}

/**
 * LA FERME (Thomas, 2026-11-13, planches ferme_v1 / ferme_v2) : contre le mur du fond, un pré de terre battue de 16 à 30
 * cases, fermé par une clôture pleine (on n'y entre pas ; on voit par-dessus) ; dedans, l'épouvantail, 1 ou 2 bottes de
 * paille, et 1 à 3 poules qui se promènent (voir `Game` : `farm`). Autour, un passage d'une case ; la houe et la fourche
 * contre le mur du fond, 1 ou 2 bottes de paille et 1 ou 2 caisses dehors. Les ouvertures de la salle ne donnent jamais
 * sur le pré ni sur la clôture.
 */
export function furnishFarm(floor: Floor, room: Room, rng: Rng, out: Furniture[]): boolean {
  const P = roomPlacer(floor, room);
  if (!P.allFloor()) return false;
  // Le pré : collé au mur du fond ; un passage à gauche, à droite et en bas.
  let fw = room.w - 4;
  let fh = room.h - 3;
  while (fw * fh > 30 && fw > 4) fw--;
  while (fw * fh > 30 && fh > 3) fh--;
  if (fw * fh < 16 || fw * fh > 30) return false;
  const fx = room.x + 2 + Math.floor((room.w - 4 - fw) / 2);
  const fy = room.y;
  const inField = (x: number, y: number) => x >= fx && x < fx + fw && y >= fy && y < fy + fh;
  const inFence = (x: number, y: number) =>
    ((x === fx - 1 || x === fx + fw) && y >= fy && y <= fy + fh) || (y === fy + fh && x >= fx - 1 && x <= fx + fw);
  // Aucune ouverture de la salle ne donne sur le pré ou sur la clôture.
  for (let x = room.x - 1; x <= room.x + room.w; x++) {
    for (let y = room.y - 1; y <= room.y + room.h; y++) {
      const ring = x === room.x - 1 || x === room.x + room.w || y === room.y - 1 || y === room.y + room.h;
      if (!ring || floor.map.get(x, y) === Tile.Wall) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ix = x + dx;
        const iy = y + dy;
        if (ix >= room.x && ix < room.x + room.w && iy >= room.y && iy < room.y + room.h && (inField(ix, iy) || inFence(ix, iy))) return false;
      }
    }
  }
  // Le pré d'abord (case par case), puis la clôture : sinon la fermer couperait le pré de l'arrivée.
  const field: Point[] = [];
  for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) field.push({ x, y });
  for (const c of field) {
    if (!P.tryPlace({ x: c.x, y: c.y, kind: rng.chance(0.3) ? "soil2" : "soil" })) {
      P.undo();
      return false;
    }
  }
  for (let y = fy; y <= fy + fh; y++) {
    for (const x of [fx - 1, fx + fw]) {
      const kind = y < fy + fh ? "fenceV" : x < fx ? "fenceCornerL" : "fenceCornerR";
      if (!P.tryPlace({ x, y, kind })) {
        P.undo();
        return false;
      }
    }
  }
  for (let x = fx; x < fx + fw; x++) {
    if (!P.tryPlace({ x, y: fy + fh, kind: "fenceH" })) {
      P.undo();
      return false;
    }
  }
  // Dans le pré (sur la terre déjà posée) : l'épouvantail au milieu, 1 ou 2 bottes de paille.
  const inside: Furniture[] = [];
  const mid = { x: fx + Math.floor(fw / 2), y: fy + Math.floor(fh / 2) };
  inside.push({ x: mid.x, y: mid.y, kind: "scarecrow" });
  const spots = field.filter((c) => Math.max(Math.abs(c.x - mid.x), Math.abs(c.y - mid.y)) >= 2);
  for (let k = rng.int(1, 2); k > 0 && spots.length > 0; k--) {
    const c = spots.splice(rng.int(0, spots.length - 1), 1)[0];
    inside.push({ x: c.x, y: c.y, kind: "hayBale" });
  }
  // Dehors : la houe et la fourche contre le mur du fond (dans les coins), paille et caisses dans le passage.
  P.tryPlace({ x: room.x, y: room.y, kind: rng.chance(0.5) ? "hoe" : "fork" });
  P.tryPlace({ x: room.x + room.w - 1, y: room.y, kind: P.placed.some((f) => f.kind === "hoe") ? "fork" : "hoe" });
  const edge = () => {
    const bottom = room.y + room.h - 1;
    return rng.chance(0.5) ? { x: rng.chance(0.5) ? room.x : room.x + room.w - 1, y: rng.int(room.y + 1, bottom) } : { x: rng.int(room.x, room.x + room.w - 1), y: bottom };
  };
  scatter(P, rng, ["hayBale"], rng.int(1, 2), edge);
  scatter(P, rng, ["crate", "crateStack"], rng.int(1, 2), edge);
  out.push(...P.placed, ...inside);
  return true;
}

/**
 * ALCHIMISTE v1 (planche art/alchimiste_v1.png) : 1 à 3 bibliothèques de 2 cases, de face contre le mur du fond ou de
 * profil contre un mur de côté ; 0 à 3 étagères de verrerie et 0 à 2 bouquets d'herbes contre le mur du fond ; une
 * cheminée ; le chaudron sur son feu et le grimoire sur pied au milieu ; l'ours empaillé dans un coin ; une plante en
 * pot ; 1 à 2 coffres (une potion dedans).
 */
export function furnishAlchemist(floor: Floor, room: Room, rng: Rng, out: Furniture[]): boolean {
  const P = roomPlacer(floor, room);
  if (!P.allFloor()) return false;
  // Cheminée d'abord, au milieu d'un mur de côté : rien n'est posé devant elle (Thomas, 2026-11-12).
  const hy = room.y + Math.floor(room.h / 2);
  for (const side of rng.chance(0.5) ? [-1, 1] : [1, -1]) {
    const wx = side < 0 ? room.x - 1 : room.x + room.w;
    const ok = [-1, 0, 1].every((d) => floor.map.get(wx, hy + d) === Tile.Wall) && !floor.torches.some((t) => t.x === wx && t.y === hy);
    if (!ok) continue;
    floor.torches = floor.torches.filter((t) => !(t.hearth && t.x >= room.x - 1 && t.x <= room.x + room.w && t.y >= room.y - 1 && t.y <= room.y + room.h));
    floor.torches.push({ x: wx, y: hy, radius: 5, faceX: -side, faceY: 0, hearth: true, lit: true });
    break;
  }
  // Mur du fond (Thomas, 2026-11-12) : bibliothèques DE FACE seulement (1 à 2), au moins une étagère de verrerie
  // (jusqu'à 3), 0 à 2 bouquets d'herbes. Plus de bibliothèque de profil.
  const others = [...Array(rng.int(0, 1)).fill("bookcase"), ...Array(rng.int(0, 2)).fill("glassShelf"), ...Array(rng.int(0, 2)).fill("herbs")];
  // Une bibliothèque et une étagère de verrerie à coup sûr, d'un côté ou de l'autre ; le reste mélangé derrière.
  const sure = rng.chance(0.5) ? ["bookcase", "glassShelf"] : ["glassShelf", "bookcase"];
  P.alongBackWall([sure[0], ...shuffle(rng, [sure[1], ...others])]);
  for (let x = room.x; x < room.x + room.w; x++) P.reserve(x, room.y + 1);
  if (!P.placed.some((f) => f.kind === "bookcase") || !P.placed.some((f) => f.kind === "glassShelf")) {
    P.undo();
    return false;
  }
  const inner = () => ({ x: rng.int(room.x + 1, room.x + room.w - 3), y: rng.int(room.y + 2, room.y + room.h - 2) });
  // Le pupitre au grimoire, contre le mur de droite (Thomas, 2026-11-12).
  scatter(P, rng, ["grimoire"], 1, () => ({ x: room.x + room.w - 1, y: rng.int(room.y + 2, room.y + room.h - 2) }));
  const lectern = P.placed.find((f) => f.kind === "grimoire");
  const corner = () => {
    // Jamais collé au pupitre : l'ours, haut, le cacherait.
    const cs = [{ x: room.x, y: room.y + 2 }, { x: room.x + room.w - 1, y: room.y + 2 }, { x: room.x, y: room.y + room.h - 1 }, { x: room.x + room.w - 1, y: room.y + room.h - 1 }].filter(
      (c) => !lectern || Math.max(Math.abs(c.x - lectern.x), Math.abs(c.y - lectern.y)) > 1,
    );
    return cs[rng.int(0, cs.length - 1)];
  };
  scatter(P, rng, ["cauldron"], 1, inner);
  scatter(P, rng, ["stuffedBear"], 1, corner);
  scatter(P, rng, ["pottedPlant"], 1, corner);
  edgeChests(P, floor, room, rng, rng.int(1, 2));
  // Un tapis usé au milieu de la salle (Thomas, 2026-11-12).
  for (let attempt = 0; attempt < 30; attempt++) {
    if (P.tryPlace({ x: rng.int(room.x + 1, room.x + room.w - 4), y: rng.int(room.y + 2, room.y + room.h - 2), kind: rng.chance(0.5) ? "rug" : "rugB" })) break;
  }
  out.push(...P.placed);
  return true;
}
