import { Rng } from "../core/rng";
import { FURNITURE_KINDS } from "../data/themedRooms";
import { Furniture, furnitureCells } from "./furnish";
import { Floor, Room } from "./generator";
import { Point, Tile } from "./map";

/**
 * SECTION 2, LA CHAMPIGNONNIÈRE, dans le donjon (Thomas, 2026-11-14 : « génère la section ») : les étages 6 à 10 sont
 * tirés comme les autres, puis habillés ici (planches art/champi_v3 à v5, salle d'essai section 2) :
 *
 * - presque plus de torches (seule la salle de départ garde la sienne) : ce sont les champignons qui éclairent ;
 * - dans chaque salle (hors départ, salles spéciales et à thème) : 2 à 4 groupes de petits lumineux, parfois une grappe
 *   verte ou un gros champignon bleu (ils bloquent, on se cache derrière), parfois un corail ;
 * - 2 à 4 ÉBOULEMENTS par étage : une case de mur éventrée, la terre déborde dans la salle (infranchissable) et de la
 *   terre meuble autour ; jamais contre une porte ni dans le passage d'une salle, jamais dans la roche derrière le mur,
 *   et l'étage reste entièrement praticable.
 *
 * Le décor (murs, sol de pavés ronds, lumière bleu-vert, grilles) est choisi à l'affichage d'après `FloorState.look`.
 */
export function decorateChampi(floor: Floor, furniture: Furniture[], rng: Rng, skip: Set<number>, lit: Set<number> = new Set()): void {
  const { map, rooms, start, stairs } = floor;
  // Les torches : seule celle de la salle de départ reste.
  const startRoom = rooms.findIndex((r) => inRect(r, start));
  // Les salles à thème (champignonnière, atelier : Thomas, 2026-11-15) gardent aussi les leurs.
  floor.torches.splice(0, floor.torches.length, ...floor.torches.filter((t) => [startRoom, ...lit].some((i) => i >= 0 && near(rooms[i], { x: t.x + t.faceX, y: t.y + t.faceY }))));
  const taken = (p: Point) =>
    furniture.some((f) => furnitureCells(f).some((c) => c.x === p.x && c.y === p.y)) || (p.x === start.x && p.y === start.y) || (p.x === stairs.x && p.y === stairs.y);
  const isDoor = (x: number, y: number) => map.isDoor(x, y);
  const nearDoor = (p: Point) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isDoor(p.x + dx, p.y + dy)) return true;
    return false;
  };
  const inAnyRoom = (x: number, y: number) => rooms.some((r) => inRect(r, { x, y }));
  /** Une case de passage : sol hors des salles collé à une salle (l'entrée d'un couloir). */
  const opening = (x: number, y: number) =>
    map.isWalkable(x, y) && !inAnyRoom(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inAnyRoom(x + dx, y + dy));
  const nearOpening = (p: Point) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (opening(p.x + dx, p.y + dy)) return true;
    return false;
  };
  const block = (p: Point, kind: string) => {
    furniture.push({ x: p.x, y: p.y, kind });
    if (FURNITURE_KINDS[kind]?.blocks) map.set(p.x, p.y, Tile.Furniture);
  };

  // ---------- Éboulements ----------
  const wanted = rng.int(2, 4);
  let made = 0;
  for (let attempt = 0; attempt < 60 && made < wanted; attempt++) {
    const index = rng.int(0, rooms.length - 1);
    const r = rooms[index];
    if (index === startRoom || skip.has(index) || r.w < 5 || r.h < 4) continue;
    // Un mur de la salle : haut, bas, gauche ou droite ; la case de mur éventrée, et la direction vers la salle.
    const side = rng.int(0, 3);
    const along = side < 2 ? rng.int(r.x + 1, r.x + r.w - 2) : rng.int(r.y + 1, r.y + r.h - 2);
    const wall: Point = side === 0 ? { x: along, y: r.y - 1 } : side === 1 ? { x: along, y: r.y + r.h } : side === 2 ? { x: r.x - 1, y: along } : { x: r.x + r.w, y: along };
    const inward: Point = side === 0 ? { x: 0, y: 1 } : side === 1 ? { x: 0, y: -1 } : side === 2 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    const across: Point = { x: inward.y !== 0 ? 1 : 0, y: inward.x !== 0 ? 1 : 0 };
    // La roche derrière doit être de la roche (pas un couloir) : on éventre un vrai mur.
    const behind = { x: wall.x - inward.x, y: wall.y - inward.y };
    if (map.get(wall.x, wall.y) !== Tile.Wall || map.get(behind.x, behind.y) !== Tile.Wall) continue;
    // Le tas : la case de mur, 1 ou 2 cases de large, et 1 à 2 cases dans la salle ; de la terre meuble autour.
    const width = rng.int(1, 2);
    const depth = rng.int(1, 2);
    const mound: Point[] = [];
    for (let k = 0; k < width; k++) {
      const wx = wall.x + across.x * k;
      const wy = wall.y + across.y * k;
      if (map.get(wx, wy) !== Tile.Wall || map.get(wx - inward.x, wy - inward.y) !== Tile.Wall) continue;
      mound.push({ x: wx, y: wy });
      for (let d = 1; d <= depth - (k === width - 1 && width > 1 ? 1 : 0); d++) mound.push({ x: wx + inward.x * d, y: wy + inward.y * d });
    }
    const inside = mound.filter((p) => map.get(p.x, p.y) !== Tile.Wall);
    if (inside.length === 0) continue;
    const bad = mound.some((p) => nearDoor(p) || nearOpening(p) || (map.get(p.x, p.y) !== Tile.Wall && (map.get(p.x, p.y) !== Tile.Floor || taken(p))));
    if (bad) continue;
    // L'étage doit rester entièrement praticable.
    const saved = mound.map((p) => map.get(p.x, p.y));
    for (const p of mound) map.set(p.x, p.y, Tile.Furniture);
    if (!allConnected(floor)) {
      mound.forEach((p, i) => map.set(p.x, p.y, saved[i]));
      continue;
    }
    mound.forEach((p, i) => {
      furniture.push({ x: p.x, y: p.y, kind: "eboulis", ...(saved[i] === Tile.Wall ? { breach: true } : {}) });
    });
    // Terre meuble : les cases libres autour du tas, côté salle.
    for (const p of inside) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const q = { x: p.x + dx, y: p.y + dy };
        if (map.get(q.x, q.y) === Tile.Floor && !taken(q) && rng.chance(0.6)) furniture.push({ x: q.x, y: q.y, kind: "terre" });
      }
    }
    made++;
  }

  // ---------- Champignons ----------
  const LUEURS = ["lueursB1", "lueursB2", "lueursB3", "lueursG1", "lueursG2", "lueursG3", "lueursP1", "lueursP2", "lueursP3"];
  rooms.forEach((r, index) => {
    if (skip.has(index)) return;
    const free = (): Point | null => {
      for (let k = 0; k < 20; k++) {
        const p = { x: rng.int(r.x, r.x + r.w - 1), y: rng.int(r.y, r.y + r.h - 1) };
        if (map.get(p.x, p.y) === Tile.Floor && !taken(p) && !nearDoor(p) && !nearOpening(p)) return p;
      }
      return null;
    };
    const groups = rng.int(2, 4);
    for (let k = 0; k < groups; k++) {
      const p = free();
      if (p) block(p, LUEURS[rng.int(0, LUEURS.length - 1)]);
    }
    if (rng.chance(0.3)) {
      const p = free();
      if (p) block(p, "champiCorail");
    }
    // Les gros (ils bloquent) : jamais là où ils couperaient un passage.
    if (index !== startRoom && r.w * r.h >= 20 && rng.chance(0.6)) {
      const p = free();
      if (p) {
        map.set(p.x, p.y, Tile.Furniture);
        if (allConnected(floor)) furniture.push({ x: p.x, y: p.y, kind: rng.chance(0.5) ? "champiGrappe" : "champiGeant" });
        else map.set(p.x, p.y, Tile.Floor);
      }
    }
  });
}

function inRect(r: Room, p: Point): boolean {
  return p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;
}

function near(r: Room, p: Point): boolean {
  return p.x >= r.x - 1 && p.y >= r.y - 1 && p.x <= r.x + r.w && p.y <= r.y + r.h;
}

/** Toutes les cases où l'on marche se rejoignent-elles (depuis l'arrivée) ? */
function allConnected(floor: Floor): boolean {
  const { map, start } = floor;
  const seen = new Uint8Array(map.width * map.height);
  const stack = [start];
  seen[map.index(start.x, start.y)] = 1;
  let count = 1;
  while (stack.length > 0) {
    const p = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (!map.inBounds(x, y) || seen[map.index(x, y)] || !walk(map.get(x, y))) continue;
      seen[map.index(x, y)] = 1;
      count++;
      stack.push({ x, y });
    }
  }
  let total = 0;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (walk(map.get(x, y))) total++;
  return count === total;
}

function walk(t: Tile): boolean {
  return t !== Tile.Wall && t !== Tile.Furniture && t !== Tile.Pillar;
}
