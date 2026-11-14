import { Rng } from "../core/rng";
import { FURNITURE_KINDS } from "../data/themedRooms";
import { Furniture, furnitureCells } from "./furnish";
import { Floor, Room } from "./generator";
import { Point, Tile } from "./map";

/**
 * PIÈCES SECRÈTES (Thomas, 2026-11-14 : « 0 à 1 par étage ; si la surface d'une pièce est entourée de murs, il peut y avoir
 * une pièce secrète ; des briques manquantes et de petits creux dans certains murs ; à moins de 3 cases de certains creux,
 * on voit quelques tuiles derrière le mur ; il faut fouiller dans la pièce voisine pour la révéler ; un coffre d'acier avec
 * un objet rare, de l'argent, des statues, une armure, un présentoir »).
 *
 * La pièce est taillée dans la roche pleine contre le mur d'une salle (la salle « hôte ») ; son entrée reste du mur tant
 * qu'on ne l'a pas trouvée. Un des creux du mur commun laisse voir dedans.
 */
export type SecretLayout = "tresor" | "armurerie" | "reliquaire" | "contrebandier";

export interface SecretRoom {
  room: Room;
  /** La case de mur qui s'ouvre (entre la salle hôte et la pièce). */
  entry: Point;
  /** Vers la pièce secrète, depuis la salle hôte. */
  dir: Point;
  /** Numéro de la salle hôte dans `rooms` : la fouiller révèle la pièce. */
  host: number;
  layout: SecretLayout;
  /** Le creux du mur par lequel on voit dedans, et les cases qu'il laisse voir. */
  peek: Point;
  view: Point[];
  /** Le coffre d'acier (un objet rare et de l'or). */
  chest: Point;
  /** Des piles d'or au sol (posées par la partie). */
  gold: Point[];
  glimpsed: boolean;
  found: boolean;
}

/** Les quatre plans proposés (lettres : c coffre d'acier, s statue, a armure, p présentoir, b tonneau, k caisses, o or). */
export const SECRET_LAYOUTS: Record<SecretLayout, { name: string; size: [number, number]; plan: string[] }> = {
  // Plans vus depuis l'entrée (rangée du bas = contre le mur commun, l'entrée sous la colonne du milieu).
  tresor: { name: "Le trésor muré", size: [5, 3], plan: ["s.c.s", "o...o", "....."] },
  armurerie: { name: "L'armurerie oubliée", size: [5, 3], plan: ["a.c.a", "p...o", "....."] },
  reliquaire: { name: "Le reliquaire", size: [5, 4], plan: ["s.c.s", "..p..", "o...o", "....."] },
  contrebandier: { name: "La cache du contrebandier", size: [3, 3], plan: ["bck", "o..", "..."] },
};

const KIND: Record<string, string> = { s: "statueKnight", a: "armorStand", p: "display", b: "barrel", k: "crateStack" };

/** Les murs des salles où l'on peut accrocher un creux ou une brique manquante (pas aux coins, ni près d'une porte). */
function roomWalls(floor: Floor, room: Room): { cell: Point; dir: Point }[] {
  const out: { cell: Point; dir: Point }[] = [];
  for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
    out.push({ cell: { x, y: room.y - 1 }, dir: { x: 0, y: -1 } }, { cell: { x, y: room.y + room.h }, dir: { x: 0, y: 1 } });
  }
  for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
    out.push({ cell: { x: room.x - 1, y }, dir: { x: -1, y: 0 } }, { cell: { x: room.x + room.w, y }, dir: { x: 1, y: 0 } });
  }
  return out;
}

function nearDoor(floor: Floor, p: Point): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (floor.map.isDoor(p.x + dx, p.y + dy)) return true;
  return false;
}

/**
 * Pose (ou non) la pièce secrète de l'étage. `special` : salles à ne pas prendre pour hôte (départ, salles à thème…).
 * Rend `null` si rien ne convient ; sinon la pièce est taillée, meublée, et son coffre posé.
 */
export function placeSecretRoom(floor: Floor, furniture: Furniture[], rng: Rng, special: Set<number>, layout?: SecretLayout, onlyHost?: number): SecretRoom | null {
  const { map } = floor;
  const inRoom = (p: Point) => floor.rooms.some((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
  const taken = (p: Point) => furniture.some((f) => furnitureCells(f).some((c) => c.x === p.x && c.y === p.y));
  const order: SecretLayout[] = layout ? [layout] : (["tresor", "armurerie", "reliquaire", "contrebandier"] as SecretLayout[]).sort(() => rng.next() - 0.5);
  for (const lay of order) {
    const [W, D] = SECRET_LAYOUTS[lay].size;
    const half = Math.floor(W / 2);
    const found: { entry: Point; dir: Point; host: number; room: Room }[] = [];
    floor.rooms.forEach((r, host) => {
      if (host === 0 || special.has(host) || (onlyHost !== undefined && host !== onlyHost)) return;
      for (const { cell: e, dir } of roomWalls(floor, r)) {
        const xs = dir.x !== 0 ? [e.x + dir.x, e.x + dir.x * D] : [e.x - half, e.x + half];
        const ys = dir.y !== 0 ? [e.y + dir.y, e.y + dir.y * D] : [e.y - half, e.y + half];
        const room: Room = { x: Math.min(...xs), y: Math.min(...ys), w: Math.abs(xs[1] - xs[0]) + 1, h: Math.abs(ys[1] - ys[0]) + 1 };
        if (room.x - 1 < 1 || room.y - 1 < 1 || room.x + room.w + 1 >= map.width - 1 || room.y + room.h + 1 >= map.height - 1) continue;
        const inner = { x: e.x - dir.x, y: e.y - dir.y };
        if (map.get(inner.x, inner.y) !== Tile.Floor || map.get(e.x, e.y) !== Tile.Wall || taken(inner) || taken(e)) continue;
        if (nearDoor(floor, e) || floor.torches.some((t) => t.x === e.x && t.y === e.y)) continue;
        // « Une surface entourée de murs » : toute la boîte (la pièce et son pourtour) est de la roche, hors des salles.
        let ok = true;
        for (let y = room.y - 1; ok && y <= room.y + room.h; y++)
          for (let x = room.x - 1; ok && x <= room.x + room.w; x++) {
            const onShared = dir.x !== 0 ? x === e.x : y === e.y;
            if (map.get(x, y) !== Tile.Wall || (!onShared && inRoom({ x, y }))) ok = false;
          }
        if (ok) found.push({ entry: e, dir, host, room });
      }
    });
    if (found.length === 0) continue;
    const pick = found[rng.int(0, found.length - 1)];
    const { entry, dir, room } = pick;
    const perp = { x: dir.y !== 0 ? 1 : 0, y: dir.x !== 0 ? 1 : 0 };
    /** Case de la pièce : `a` en travers (0 à W-1), `d` en profondeur (0 : contre l'entrée). */
    const at = (a: number, d: number): Point => ({ x: entry.x + dir.x * (d + 1) + perp.x * (a - half), y: entry.y + dir.y * (d + 1) + perp.y * (a - half) });
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) map.set(x, y, Tile.Floor);
    // Le plan : sa première ligne est le fond de la pièce.
    const plan = SECRET_LAYOUTS[lay].plan;
    let chest: Point = at(half, D - 1);
    const gold: Point[] = [];
    plan.forEach((line, row) => {
      const d = D - 1 - row;
      [...line].forEach((ch, a) => {
        const p = at(a, d);
        if (ch === "c") {
          map.set(p.x, p.y, Tile.Chest);
          chest = p;
        } else if (ch === "o") gold.push(p);
        else if (KIND[ch]) {
          furniture.push({ x: p.x, y: p.y, kind: KIND[ch] });
          if (FURNITURE_KINDS[KIND[ch]].blocks) map.set(p.x, p.y, Tile.Furniture);
        }
      });
    });
    // Le creux qui laisse voir dedans : sur le mur commun, à côté de l'entrée (ou l'entrée elle-même) ; il montre la
    // case derrière lui et ses deux voisines, plus la suivante.
    const shared = [-half, half, -1, 1, 0].map((k) => ({ x: entry.x + perp.x * k, y: entry.y + perp.y * k })).filter((p) => {
      const front = { x: p.x - dir.x, y: p.y - dir.y };
      return map.get(p.x, p.y) === Tile.Wall && map.get(front.x, front.y) !== Tile.Wall && !taken(p) && !nearDoor(floor, p);
    });
    const peek = shared.length > 0 ? shared[rng.int(0, shared.length - 1)] : entry;
    furniture.push({ x: peek.x, y: peek.y, kind: rng.chance(0.5) ? "wallHoleA" : "wallHoleB" });
    const behind = { x: peek.x + dir.x, y: peek.y + dir.y };
    const view = [behind, { x: behind.x + perp.x, y: behind.y + perp.y }, { x: behind.x - perp.x, y: behind.y - perp.y }, { x: behind.x + dir.x, y: behind.y + dir.y }].filter(
      (p) => p.x >= room.x && p.y >= room.y && p.x < room.x + room.w && p.y < room.y + room.h,
    );
    return { room, entry, dir, host: pick.host, layout: lay, peek, view, chest, gold, glimpsed: false, found: false };
  }
  return null;
}

/**
 * Une petite pièce W × D taillée dans la roche contre un mur de la salle `host` (le poulailler de la ferme) : rend la
 * pièce et la case de mur entre les deux (à transformer en porte), ou `null`. Mêmes règles que la pièce secrète.
 */
export function carvePocket(floor: Floor, furniture: Furniture[], rng: Rng, host: number, W: number, D: number): { room: Room; entry: Point; dir: Point } | null {
  const { map } = floor;
  const inRoom = (p: Point) => floor.rooms.some((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
  const taken = (p: Point) => furniture.some((f) => furnitureCells(f).some((c) => c.x === p.x && c.y === p.y));
  const half = Math.floor(W / 2);
  const r = floor.rooms[host];
  if (!r) return null;
  const found: { entry: Point; dir: Point; room: Room }[] = [];
  for (const { cell: e, dir } of roomWalls(floor, r)) {
    const xs = dir.x !== 0 ? [e.x + dir.x, e.x + dir.x * D] : [e.x - half, e.x + half];
    const ys = dir.y !== 0 ? [e.y + dir.y, e.y + dir.y * D] : [e.y - half, e.y + half];
    const room: Room = { x: Math.min(...xs), y: Math.min(...ys), w: Math.abs(xs[1] - xs[0]) + 1, h: Math.abs(ys[1] - ys[0]) + 1 };
    if (room.x - 1 < 1 || room.y - 1 < 1 || room.x + room.w + 1 >= map.width - 1 || room.y + room.h + 1 >= map.height - 1) continue;
    const inner = { x: e.x - dir.x, y: e.y - dir.y };
    if (map.get(inner.x, inner.y) !== Tile.Floor || map.get(e.x, e.y) !== Tile.Wall || taken(inner) || taken(e) || nearDoor(floor, e)) continue;
    if (floor.torches.some((t) => t.x === e.x && t.y === e.y)) continue;
    let ok = true;
    for (let y = room.y - 1; ok && y <= room.y + room.h; y++)
      for (let x = room.x - 1; ok && x <= room.x + room.w; x++) if (map.get(x, y) !== Tile.Wall || inRoom({ x, y })) ok = false;
    if (ok) found.push({ entry: e, dir, room });
  }
  if (found.length === 0) return null;
  const pick = found[rng.int(0, found.length - 1)];
  for (let y = pick.room.y; y < pick.room.y + pick.room.h; y++) for (let x = pick.room.x; x < pick.room.x + pick.room.w; x++) map.set(x, y, Tile.Floor);
  return pick;
}

/**
 * Briques manquantes et petits creux (Thomas, 2026-11-14) : quelques-uns par étage, au hasard sur les murs des salles,
 * de simple décor (seul le creux de la pièce secrète laisse voir derrière).
 */
export function placeWallMarks(floor: Floor, furniture: Furniture[], rng: Rng, count: number): void {
  const taken = (p: Point) => furniture.some((f) => furnitureCells(f).some((c) => c.x === p.x && c.y === p.y));
  const walls = floor.rooms.flatMap((r) => roomWalls(floor, r)).filter(({ cell }) => floor.map.get(cell.x, cell.y) === Tile.Wall);
  let put = 0;
  for (let attempt = 0; attempt < count * 20 && put < count && walls.length > 0; attempt++) {
    const { cell } = walls[rng.int(0, walls.length - 1)];
    if (taken(cell) || nearDoor(floor, cell) || floor.torches.some((t) => t.x === cell.x && t.y === cell.y)) continue;
    // Jamais deux marques côte à côte.
    if (furniture.some((f) => /^wall(Gap|Hole)/.test(f.kind) && Math.abs(f.x - cell.x) + Math.abs(f.y - cell.y) <= 2)) continue;
    furniture.push({ x: cell.x, y: cell.y, kind: ["wallGapA", "wallGapB", "wallHoleA", "wallHoleB"][rng.int(0, 3)] });
    put++;
  }
}
