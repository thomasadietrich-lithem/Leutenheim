import { Rng } from "../core/rng";
import { RULES } from "../data/rules";
import { FURNITURE_KINDS } from "../data/themedRooms";
import { besideOpening, blocksPassage, Furniture, freeCell } from "./furnish";
import { Floor, Room } from "./generator";
import { Point, Tile } from "./map";

/**
 * SECTION 3, L'OSSUAIRE DE LA LUNE PÂLE (Thomas, 2026-11-19 : « ok implémente tout » ; planches `art/ossuaire_da_v4.png`,
 * `art/ossuaire_objets_v1.png` et `v2`). Les étages 11 à 15 sont tirés comme les autres (salles ordinaires), puis habillés
 * ici, sans rien des sections du dessus (ni PNJ, ni monstre, ni salle spéciale, ni salle à thème, ni piège) :
 *
 * - plus aucune torche ni cheminée : la seule lumière est celle des PUITS DE LUNE (2 à 4 par étage, toujours un dans la
 *   salle de départ) ; ailleurs, l'ombre ;
 * - ALCÔVES D'OSSUAIRE creusées dans des tronçons de mur (3 à 6 cases), PLAQUES FUNÉRAIRES scellées dans les murs ;
 * - PIERRES TOMBALES encastrées dans le sol, à n'importe quel angle, à cheval sur les dalles ;
 * - mobilier : sarcophages, gisants, un autel, urnes, squelettes qui traînent, lustre d'os, pilier de crânes,
 *   cercueils empilés, statue voilée, fosse sous grille, brouette du fossoyeur.
 *
 * Le décor des murs et du sol (craie, losanges, brume) est choisi à l'affichage d'après `FloorState.look`.
 */

/** Côté ouvert d'un tronçon de mur : « S » = mur du haut d'une salle (on voit sa face sud), « N » = mur du bas, « W » =
 *  mur de droite, « E » = mur de gauche. */
export type WallSide = "S" | "N" | "W" | "E";

const SIDES: { side: WallSide; out: Point }[] = [
  { side: "S", out: { x: 0, y: -1 } },
  { side: "N", out: { x: 0, y: 1 } },
  { side: "W", out: { x: 1, y: 0 } },
  { side: "E", out: { x: -1, y: 0 } },
];

/** Le côté d'un mur selon la direction de la salle (`dir` : de la salle vers le mur). */
export function sideOf(dir: Point): WallSide {
  return dir.y < 0 ? "S" : dir.y > 0 ? "N" : dir.x > 0 ? "W" : "E";
}

const TOMB_KINDS = ["ins", "crane", "brisee", "anneau", "os", "petite", "double"];

/** Les cases de mur d'un côté de la salle, en tronçons continus (coupés aux portes et aux ouvertures). */
function wallRuns(floor: Floor, room: Room, out: Point, blocked: Set<string>): Point[][] {
  const { map } = floor;
  const cells: Point[] = [];
  if (out.y !== 0) {
    const y = out.y < 0 ? room.y - 1 : room.y + room.h;
    for (let x = room.x; x < room.x + room.w; x++) cells.push({ x, y });
  } else {
    const x = out.x < 0 ? room.x - 1 : room.x + room.w;
    for (let y = room.y; y < room.y + room.h; y++) cells.push({ x, y });
  }
  const runs: Point[][] = [];
  let cur: Point[] = [];
  for (const c of cells) {
    const inner = { x: c.x - out.x, y: c.y - out.y };
    const behind = { x: c.x + out.x, y: c.y + out.y };
    // Un vrai mur, avec du sol devant et de la roche derrière (on creuse un mur plein) ; jamais contre une porte.
    const ok =
      map.get(c.x, c.y) === Tile.Wall &&
      map.get(inner.x, inner.y) === Tile.Floor &&
      map.get(behind.x, behind.y) === Tile.Wall &&
      !blocked.has(`${c.x},${c.y}`) &&
      ![-1, 1].some((k) => (out.y !== 0 ? map.isDoor(c.x + k, c.y) || map.get(c.x + k, c.y) !== Tile.Wall : map.isDoor(c.x, c.y + k) || map.get(c.x, c.y + k) !== Tile.Wall));
    if (ok) cur.push(c);
    else {
      if (cur.length) runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  return runs;
}

/** Une salle qui contient la case. */
function roomOf(floor: Floor, p: Point): Room | undefined {
  return floor.rooms.find((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
}

/** Les meubles de l'Ossuaire : quelle sorte, contre le mur du haut ou n'importe où dans la salle, et combien au plus. */
const PIECES: { kind: string; weight: number; wall: boolean; max?: number }[] = [
  { kind: "sarcophage", weight: 3, wall: false },
  { kind: "sarcophageOuvert", weight: 1.5, wall: false },
  { kind: "gisant", weight: 2, wall: false },
  { kind: "autelOss", weight: 1, wall: true, max: 1 },
  { kind: "urnes", weight: 2.5, wall: true },
  { kind: "urneBrisee", weight: 1.2, wall: false },
  { kind: "skelCouche", weight: 1.5, wall: false },
  { kind: "skelAssis", weight: 1.5, wall: true },
  { kind: "skelRampant", weight: 1.2, wall: false },
  { kind: "skelMorceaux", weight: 1.2, wall: false },
  { kind: "lustreOs", weight: 1, wall: false, max: 1 },
  { kind: "pilierCranes", weight: 1.2, wall: false },
  { kind: "cercueils", weight: 1.2, wall: true },
  { kind: "statueVoilee", weight: 1.2, wall: true },
  { kind: "fosseGrille", weight: 0.8, wall: false, max: 1 },
  { kind: "brouetteOss", weight: 0.8, wall: false, max: 1 },
];

export function decorateOssuaire(floor: Floor, furniture: Furniture[], rng: Rng, blocked: Set<string> = new Set()): void {
  const { map, rooms, start } = floor;
  // Plus de torche ni de cheminée : la lune seule éclaire.
  floor.torches.splice(0, floor.torches.length);
  const startRoom = rooms.findIndex((r) => start.x >= r.x && start.x < r.x + r.w && start.y >= r.y && start.y < r.y + r.h);

  // ---------- Puits de lune ----------
  const order = rooms.map((_, i) => i).filter((i) => i !== startRoom).sort(() => rng.next() - 0.5);
  const lit = [startRoom, ...order].filter((i) => i >= 0).slice(0, rng.int(RULES.moonWells[0], RULES.moonWells[1]));
  for (const i of lit) {
    const r = rooms[i];
    const cx = r.x + Math.floor(r.w / 2);
    const cy = r.y + Math.floor(r.h / 2);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]]) {
      const p = { x: cx + dx, y: cy + dy };
      if (map.get(p.x, p.y) === Tile.Floor && freeCell(floor, furniture, p.x, p.y)) {
        furniture.push({ x: p.x, y: p.y, kind: "moonWell" });
        break;
      }
    }
  }

  // ---------- Alcôves d'ossuaire et plaques funéraires ----------
  const used = new Set<string>(blocked);
  rooms.forEach((room) => {
    let alcoves = 0;
    for (const { side, out } of [...SIDES].sort(() => rng.next() - 0.5)) {
      for (const run of wallRuns(floor, room, out, used)) {
        if (alcoves >= RULES.ossAlcovesPerRoom || run.length < 3 || !rng.chance(0.55)) continue;
        const len = rng.int(3, Math.min(6, run.length));
        const at = rng.int(0, run.length - len);
        const cells = run.slice(at, at + len);
        for (const c of cells) used.add(`${c.x},${c.y}`);
        // les cases voisines restent libres de plaque (l'encadrement a besoin d'air)
        for (const c of [run[at - 1], run[at + len]]) if (c) used.add(`${c.x},${c.y}`);
        furniture.push({ x: cells[0].x, y: cells[0].y, kind: "ossAlcove", side, len });
        alcoves++;
      }
    }
    // 0 à 2 plaques funéraires sur les murs restants
    const free = SIDES.flatMap(({ side, out }) => wallRuns(floor, room, out, used).flat().map((c) => ({ c, side })));
    for (let k = rng.int(0, 2); k > 0 && free.length > 0; k--) {
      const { c, side } = free.splice(rng.int(0, free.length - 1), 1)[0];
      if (used.has(`${c.x},${c.y}`)) continue;
      used.add(`${c.x},${c.y}`);
      furniture.push({ x: c.x, y: c.y, kind: "ossTablet", side, variant: rng.chance(0.5) ? "texte" : "crane" });
    }
  });

  // ---------- Pierres tombales au sol (à plat, n'importe quel angle) ----------
  rooms.forEach((room) => {
    const n = Math.min(3, Math.max(1, Math.floor((room.w * room.h) / 14))) - (rng.chance(0.3) ? 1 : 0);
    for (let k = 0; k < n; k++) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const x = rng.int(room.x, room.x + room.w - 1);
        const y = rng.int(room.y, room.y + room.h - 1);
        if (map.get(x, y) !== Tile.Floor || furniture.some((f) => f.kind === "ossTomb" && Math.abs(f.x - x) + Math.abs(f.y - y) < 3)) continue;
        furniture.push({ x, y, kind: "ossTomb", variant: TOMB_KINDS[rng.int(0, TOMB_KINDS.length - 1)], angle: rng.int(0, 359) });
        break;
      }
    }
  });

  // ---------- Mobilier ----------
  const count = new Map<string, number>();
  rooms.forEach((room, index) => {
    if (index === startRoom || room.w < 4 || room.h < 3) return;
    for (let k = rng.int(1, room.w * room.h >= 30 ? 3 : 2); k > 0; k--) {
      const choices = PIECES.filter((p) => (count.get(p.kind) ?? 0) < (p.max ?? 99));
      let pick = rng.next() * choices.reduce((s, p) => s + p.weight, 0);
      const piece = choices.find((p) => (pick -= p.weight) < 0) ?? choices[0];
      if (placePiece(floor, furniture, rng, room, piece.kind, piece.wall)) count.set(piece.kind, (count.get(piece.kind) ?? 0) + 1);
    }
  });
}

function placePiece(floor: Floor, furniture: Furniture[], rng: Rng, room: Room, kind: string, wall: boolean): boolean {
  const { map } = floor;
  // Un groupe d'urnes : 2 ou 3 urnes de tailles différentes, côte à côte contre le mur.
  const group = kind === "urnes" ? ["urneL", "urneM", "urneS"].slice(0, rng.int(2, 3)) : [kind];
  const w = group.reduce((s, k) => s + FURNITURE_KINDS[k].w, 0);
  const h = FURNITURE_KINDS[group[0]].h;
  for (let attempt = 0; attempt < 24; attempt++) {
    if (room.w < w + 2) return false;
    const x = rng.int(room.x + 1, room.x + room.w - 1 - w);
    const y = wall ? room.y : rng.int(room.y + 1, Math.max(room.y + 1, room.y + room.h - 1 - h));
    const cells: Point[] = [];
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) cells.push({ x: x + dx, y: y + dy });
    if (!cells.every((c) => freeCell(floor, furniture, c.x, c.y) && !besideOpening(floor, room, c.x, c.y))) continue;
    // contre le mur du haut : le mur doit être là (pas une porte ni un couloir)
    if (wall && !cells.every((c) => map.get(c.x, c.y - 1) === Tile.Wall)) continue;
    const blocks = group.some((k) => FURNITURE_KINDS[k].blocks);
    if (blocks && blocksPassage(map, cells)) continue;
    if (furniture.some((f) => f.kind === "moonWell" && cells.some((c) => c.x === f.x && c.y === f.y))) continue;
    let gx = x;
    for (const k of group) {
      furniture.push({ x: gx, y, kind: k });
      const def = FURNITURE_KINDS[k];
      if (def.blocks) for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) map.set(gx + dx, y + dy, Tile.Furniture);
      gx += def.w;
    }
    return true;
  }
  return false;
}

/** La salle d'une case (pour la lumière d'un puits de lune). */
export function moonArea(floor: { rooms: Room[] }, p: Point): Room {
  return roomOf(floor as Floor, p) ?? { x: p.x - 2, y: p.y - 2, w: 5, h: 5 };
}
