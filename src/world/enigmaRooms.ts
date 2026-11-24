import type { Enigma } from "../core/floor";
import { Rng } from "../core/rng";
import type { ItemId } from "../data/items";
import { FURNITURE_KINDS } from "../data/themedRooms";
import { Furniture, furnitureCells } from "./furnish";
import type { Floor, Room } from "./generator";
import { Point, Tile } from "./map";
import { carvePocket } from "./secretRoom";

/**
 * SALLES À ÉNIGME DANS LE DONJON (Thomas, 2026-11-21 ; « ok pour mettre la salle rico > étage 6 », 2026-11-24).
 *
 * Une salle ordinaire de l'étage reçoit l'énigme ; la clef d'argent et le coffre d'argent sont dans une petite pièce
 * taillée dans la roche derrière un de ses murs, fermée par l'énigme (cible bleue, racines, eau profonde, herse) ; la
 * salle de rebond, elle, se joue dans la salle même (la clef y tombe quand les trois cibles noires sont touchées).
 * L'objet qui résout l'énigme est posé dans une AUTRE salle de l'étage. Le décor (murs, sol) suit la section.
 */
export type EnigmaKind = Enigma["kind"];

/** Ce qui résout chaque énigme (posé à coup sûr sur l'étage). */
export const ENIGMA_ITEMS: Record<EnigmaKind, { item: ItemId; count: number }> = {
  tir: { item: "fleche_recul", count: 3 },
  rebond: { item: "fleche_ricochet", count: 3 },
  racines: { item: "torche", count: 1 },
  glisse: { item: "potion_gel", count: 2 },
  balance: { item: "potion_geant", count: 1 },
  gardiens: { item: "potion_brouillard", count: 1 },
};

/** Le premier étage où chaque énigme peut sortir (la flèche ricochante demande le niveau 6). */
export const ENIGMA_MIN_DEPTH: Record<EnigmaKind, number> = { tir: 1, rebond: 6, racines: 1, glisse: 1, balance: 1, gardiens: 1 };

/**
 * Le plan de la partie : deux salles par section, sur deux étages tirés parmi les étages 1 à 3 de la section, jamais
 * deux fois la même dans la partie (6 salles pour 3 sections). Rend étage → sorte.
 */
export function enigmaPlan(runSeed: number, sections = 3, floorsPerSection = 5): Map<number, EnigmaKind> {
  const rng = new Rng(runSeed ^ 0xe1167a);
  const kinds: EnigmaKind[] = ["tir", "rebond", "racines", "glisse", "balance", "gardiens"];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const plan = new Map<number, EnigmaKind>();
  const slots: number[] = [];
  for (let s = 0; s < sections; s++) {
    // Parmi les étages 1 à 3 de la section : une salle qui ne tient pas a toujours un étage suivant où passer (le 4).
    const floors = [1, 2, 3].map((k) => s * floorsPerSection + k);
    for (let i = floors.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [floors[i], floors[j]] = [floors[j], floors[i]];
    }
    slots.push(...floors.slice(0, 2).sort((a, b) => a - b));
  }
  // Une sorte trop tôt pour son étage (le rebond avant l'étage 6) échange sa place avec une plus loin.
  for (let i = 0; i < slots.length && i < kinds.length; i++) {
    if (slots[i] >= ENIGMA_MIN_DEPTH[kinds[i]]) continue;
    const j = kinds.findIndex((k, n) => n > i && slots[n] >= ENIGMA_MIN_DEPTH[kinds[i]] && slots[i] >= ENIGMA_MIN_DEPTH[k]);
    if (j > 0) [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  slots.forEach((depth, i) => {
    if (kinds[i] && depth >= ENIGMA_MIN_DEPTH[kinds[i]]) plan.set(depth, kinds[i]);
  });
  return plan;
}

/** Cases où l'on peut marcher depuis le départ (portes fermées comprises, pas les verrouillées ni les meubles). */
function reachable(floor: Floor): Set<number> {
  const { map } = floor;
  const seen = new Set<number>([map.index(floor.start.x, floor.start.y)]);
  const stack = [floor.start];
  while (stack.length) {
    const p = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = p.x + dx;
      const y = p.y + dy;
      const i = map.index(x, y);
      if (!map.inBounds(x, y) || seen.has(i) || !map.isWalkable(x, y)) continue;
      seen.add(i);
      stack.push({ x, y });
    }
  }
  return seen;
}

/** Les entrées d'une salle : groupes de cases franchissables (sol, porte…) collées à son pourtour. */
export function entranceGroups(floor: Floor, r: Room): Point[][] {
  const { map } = floor;
  const ring: Point[] = [];
  for (let x = r.x; x < r.x + r.w; x++) ring.push({ x, y: r.y - 1 }, { x, y: r.y + r.h });
  for (let y = r.y; y < r.y + r.h; y++) ring.push({ x: r.x - 1, y }, { x: r.x + r.w, y });
  const open = ring.filter((p) => {
    const t = map.get(p.x, p.y);
    return t !== Tile.Wall && t !== Tile.Pillar;
  });
  // Deux cases voisines (couloir de 2 de large) : une seule entrée.
  const seen = new Set<string>();
  const groups: Point[][] = [];
  for (const p of open) {
    if (seen.has(`${p.x},${p.y}`)) continue;
    const group = [p];
    const stack = [p];
    seen.add(`${p.x},${p.y}`);
    while (stack.length) {
      const c = stack.pop()!;
      for (const q of open) if (!seen.has(`${q.x},${q.y}`) && Math.abs(q.x - c.x) + Math.abs(q.y - c.y) === 1) {
        seen.add(`${q.x},${q.y}`);
        stack.push(q);
        group.push(q);
      }
    }
    groups.push(group);
  }
  return groups;
}

export function entrances(floor: Floor, r: Room): number {
  return entranceGroups(floor, r).length;
}

/**
 * L'objet qui résout l'énigme, posé APRÈS tout le décor de l'étage (Thomas, 2026-11-24 : « mon pote n'a pas dropé la
 * potion associée » : un champignon, une pierre tombale ou un meuble posé ensuite le recouvrait) : dans une autre salle,
 * sur une case nue (aucun meuble, même plat), praticable, atteignable depuis le départ. Halfelin : un arc en plus.
 */
export function placeEnigmaItems(floor: Floor, furniture: Furniture[], rng: Rng, kind: EnigmaKind, host: number, avoid: Set<number>, needBow: boolean, ground: { x: number; y: number }[]): { x: number; y: number; item: ItemId; count: number }[] {
  const { map } = floor;
  const reach = reachable(floor);
  const occupied = new Set(furniture.flatMap((f) => furnitureCells(f)).map((c) => `${c.x},${c.y}`));
  const ok = (p: Point) =>
    map.get(p.x, p.y) === Tile.Floor && !occupied.has(`${p.x},${p.y}`) && reach.has(map.index(p.x, p.y)) && !(p.x === floor.start.x && p.y === floor.start.y) && !ground.some((g) => g.x === p.x && g.y === p.y);
  const rooms = floor.rooms.map((_, i) => i).filter((i) => i !== host && !avoid.has(i));
  const out: { x: number; y: number; item: ItemId; count: number }[] = [];
  const spot = (): Point | null => {
    const cells: Point[] = [];
    for (const i of rooms.length > 0 ? rooms : [host]) {
      const r = floor.rooms[i];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (ok({ x, y }) && !out.some((o) => o.x === x && o.y === y)) cells.push({ x, y });
    }
    return cells.length > 0 ? cells[rng.int(0, cells.length - 1)] : null;
  };
  const at = spot();
  if (at) out.push({ ...at, ...ENIGMA_ITEMS[kind] });
  if (needBow && (kind === "tir" || kind === "rebond")) {
    const bow = spot();
    if (bow) out.push({ ...bow, item: "arc_court", count: 1 });
  }
  return out;
}

export interface PlacedEnigma {
  enigma: Enigma;
  /** La salle hôte (numéro dans `floor.rooms`). */
  host: number;
  /** Objets à poser au sol : la clef d'argent (sauf rebond), l'objet de l'énigme, un arc pour qui n'en a pas. */
  items: { x: number; y: number; item: ItemId; count: number }[];
}

/**
 * Taille la salle à énigme `kind` dans une salle ordinaire de l'étage (pas `avoid` : départ, escaliers, salles à thème,
 * spéciales). Si rien ne convient, ou si le résultat couperait l'étage, tout est défait et rend `null`.
 * `needBow` : le héros n'a pas d'arc (Halfelin) : un arc court est posé avec les flèches.
 */
export function placeEnigma(floor: Floor, furniture: Furniture[], rng: Rng, kind: EnigmaKind, avoid: Set<number>): PlacedEnigma | null {
  const { map } = floor;
  const before = reachable(floor);
  const tiles = map.tiles.slice();
  const furnCount = furniture.length;
  const undo = () => {
    for (let i = 0; i < tiles.length; i++) if (map.tiles[i] !== tiles[i]) map.set(i % map.width, Math.floor(i / map.width), tiles[i] as Tile);
    furniture.length = furnCount;
  };
  const taken = (p: Point) => furniture.some((f) => furnitureCells(f).some((c) => c.x === p.x && c.y === p.y));
  const put = (x: number, y: number, k: string) => {
    furniture.push({ x, y, kind: k });
    if (FURNITURE_KINDS[k]?.blocks) map.set(x, y, Tile.Furniture);
  };
  const inside = (r: Room, p: Point) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;
  const floorFree = (p: Point) => map.get(p.x, p.y) === Tile.Floor && !taken(p);
  /** Une case collée (même en diagonale) à une porte ou une ouverture du pourtour : on n'y pose rien qui bloque. */
  const byOpening = (r: Room, p: Point) =>
    [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => {
      const q = { x: p.x + dx, y: p.y + dy };
      return !inside(r, q) && (map.isWalkable(q.x, q.y) || map.isDoor(q.x, q.y));
    });
  // Une salle ISOLÉE, en cul-de-sac (Thomas, 2026-11-24 : « les salles spéciales doivent être isolées, pas entre deux
  // salles ») : une seule entrée.
  // Les culs-de-sac d'abord ; puis les salles à plusieurs entrées dont on MURE les autres (si l'étage reste d'un seul tenant).
  // Jamais une salle spéciale (verrouillée : trésor, autel) : elles ne sont pas toujours repérées par leur numéro.
  const special = (r: Room) => floor.specials.some((s) => s.room.x === r.x && s.room.y === r.y) || entranceGroups(floor, r).some((g) => g.some((c) => map.get(c.x, c.y) === Tile.DoorLocked));
  const hosts = floor.rooms.map((_, i) => i).filter((i) => !avoid.has(i) && floor.rooms[i].w >= 5 && floor.rooms[i].h >= 5 && !special(floor.rooms[i]));
  for (let i = hosts.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [hosts[i], hosts[j]] = [hosts[j], hosts[i]];
  }
  let curRoom: Room | null = null;
  let curHost: number | null = null;
  const byEntrances = [...hosts].sort((a, b) => Math.min(2, entrances(floor, floor.rooms[a])) - Math.min(2, entrances(floor, floor.rooms[b])));
  for (const host of byEntrances) {
    const r = floor.rooms[host];
    curRoom = r;
    curHost = host;
    const groups = entranceGroups(floor, r);
    if (groups.length === 0) continue;
    for (let keep = 0; keep < Math.min(groups.length, 3); keep++) {
      // Murer les autres entrées : la salle ne garde que celle-là (« pas entre deux salles »).
      const sealed: Point[] = [];
      for (const [g, cells] of groups.entries()) if (g !== keep) for (const c of cells) {
        map.set(c.x, c.y, Tile.Wall);
        sealed.push(c);
      }
      trimDeadEnds(sealed);
      const built = build(r, host);
      if (!built) {
        undo();
        continue;
      }
      // Rien de ce qui était accessible ne doit le devenir moins (sauf les cases désormais occupées ou murées).
      const after = reachable(floor);
      const blocked = (i: number) => !map.isWalkable(i % map.width, Math.floor(i / map.width));
      const inRoom = (i: number) => {
        const x = i % map.width;
        const y = Math.floor(i / map.width);
        return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
      };
      // La salle elle-même doit rester atteignable par son entrée.
      if ([...before].some((i) => !after.has(i) && !blocked(i)) || ![...after].some(inRoom)) {
        undo();
        continue;
      }
      return { ...built, host };
    }
  }
  // Aucune salle en cul-de-sac ne convient : on en CREUSE une dans la roche, contre une salle ordinaire, reliée par une
  // seule porte (la salle à énigme reste isolée).
  const sizes: [number, number][] = kind === "rebond" ? [[5, 7], [7, 5], [5, 6], [6, 5]] : [[7, 6], [5, 6], [5, 5], [5, 4]];
  const anchors = floor.rooms.map((_, i) => i).filter((i) => !avoid.has(i) && !special(floor.rooms[i]));
  for (let i = anchors.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [anchors[i], anchors[j]] = [anchors[j], anchors[i]];
  }
  for (const anchor of anchors) {
    for (const [W, D] of sizes) {
      const dug = carvePocket(floor, furniture, rng, anchor, W, D);
      if (!dug) continue;
      // La porte ; la nouvelle salle entre dans la liste des salles de l'étage.
      map.set(dug.entry.x, dug.entry.y, Tile.DoorClosed);
      floor.rooms.push(dug.room);
      const host = floor.rooms.length - 1;
      curRoom = dug.room;
      curHost = host;
      const built = build(dug.room, host);
      const after = built ? reachable(floor) : null;
      const blocked = (i: number) => !map.isWalkable(i % map.width, Math.floor(i / map.width));
      const reached = !!after && after.has(map.index(dug.entry.x, dug.entry.y));
      if (built && after && reached && ![...before].some((i) => !after.has(i) && !blocked(i))) return { ...built, host };
      floor.rooms.pop();
      undo();
    }
  }
  return null;

  /**
   * Le couloir qui menait à une entrée murée finit en impasse : on le comble de proche en proche (hors des salles, jamais
   * un escalier ni le départ), pour ne pas laisser de bout de couloir ni de porte qui donne sur un mur.
   */
  function trimDeadEnds(from: Point[]): void {
    const inAnyRoom = (p: Point) => floor.rooms.some((ro) => inside(ro, p));
    const stack = from.flatMap((c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })));
    while (stack.length) {
      const c = stack.pop()!;
      const t = map.get(c.x, c.y);
      if (!map.isWalkable(c.x, c.y) || inAnyRoom(c) || t === Tile.StairsDown || t === Tile.StairsUp || (c.x === floor.start.x && c.y === floor.start.y)) continue;
      const ways = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => map.isWalkable(c.x + dx, c.y + dy) || map.get(c.x + dx, c.y + dy) === Tile.DoorLocked).length;
      if (ways > 1) continue;
      map.set(c.x, c.y, Tile.Wall);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) stack.push({ x: c.x + dx, y: c.y + dy });
    }
  }

  /** Construit l'énigme dans la salle `r` ; rend `null` (sans rien avoir changé) si elle n'y tient pas. */
  function build(r: Room, host: number): PlacedEnigma | null {
    if (kind === "rebond") {
      // Dans la salle même : 3 cibles noires sur deux bords opposés, une rangée sur deux (gauche / droite / gauche),
      // dans le sens de la longueur de la salle (en hauteur, sinon en largeur).
      for (const tall of r.h >= r.w ? [true, false] : [false, true]) {
        const len = tall ? r.h : r.w;
        const wide = tall ? r.w : r.h;
        if (len < 6 || wide < 5) continue;
        // (u : le long de la salle ; v : en travers) → case.
        const P = (u: number, v: number): Point => (tall ? { x: r.x + v, y: r.y + u } : { x: r.x + u, y: r.y + v });
        for (let o = 0; o + 6 <= len; o++) {
        for (const end of [0, len - 1]) {
        const cells: [Point, string, Point][] = [
          // Contre le mur de gauche / droite (dos de bois côté mur), ou du haut (face vers la salle) / du bas (dos).
          [P(o + 1, 0), tall ? "cibleNoireG" : "cibleNoireH", P(o + 1, -1)],
          [P(o + 3, wide - 1), tall ? "cibleNoireD" : "cibleNoireB", P(o + 3, wide)],
          [P(o + 5, 0), tall ? "cibleNoireG" : "cibleNoireH", P(o + 5, -1)],
        ];
        const chest = P(end, Math.floor(wide / 2));
        const key = P(end, 1);
        if (![...cells.map((c) => c[0]), chest, key].every(floorFree) || cells.some(([p]) => (p.x === chest.x && p.y === chest.y) || (p.x === key.x && p.y === key.y) || byOpening(r, p)) || byOpening(r, chest)) continue;
        // Les cibles contre un mur ou une colonne (pas devant une porte ni une ouverture).
        if (!cells.every(([, , wall]) => map.get(wall.x, wall.y) === Tile.Wall || map.get(wall.x, wall.y) === Tile.Pillar)) continue;
        for (const [p, k] of cells) put(p.x, p.y, k);
        map.set(chest.x, chest.y, Tile.Chest);
        return { enigma: { kind, room: { ...r }, hall: { ...r }, key, keyShown: false, chest, struck: [] }, items: [], host: -1 };
        }
        }
      }
      return null;
    }
    for (let attempt = 0; attempt < 8; attempt++) {
      const done = tryPocket();
      if (done) return done;
    }
    return null;
  }

  /** Les autres énigmes : une petite pièce taillée derrière un mur de la salle (un mur tiré au hasard à chaque essai). */
  function tryPocket(): PlacedEnigma | null {
    const r = curRoom!;
    const host = curHost!;
    // Les autres : une petite pièce derrière un mur (3 de large ; la glisse, 3 de profondeur).
    const D = kind === "glisse" ? 3 : 2;
    const tiles0 = map.tiles.slice();
    const furn0 = furniture.length;
    const pocket = carvePocket(floor, furniture, rng, host, 3, D);
    if (!pocket) return null;
    const { entry: e, dir, room: pk } = pocket;
    const along = dir.y !== 0 ? { x: 1, y: 0 } : { x: 0, y: 1 };
    const inward = { x: -dir.x, y: -dir.y };
    const at = (base: Point, a: number, b: number): Point => ({ x: base.x + along.x * a + inward.x * b, y: base.y + along.y * a + inward.y * b });
    const back = (a: number): Point => ({ x: e.x + dir.x * D + along.x * a, y: e.y + dir.y * D + along.y * a });
    const restore = () => {
      for (let i = 0; i < tiles0.length; i++) if (map.tiles[i] !== tiles0[i]) map.set(i % map.width, Math.floor(i / map.width), tiles0[i] as Tile);
      furniture.length = furn0;
      return null;
    };
    // La clef et le coffre au fond de la petite pièce, de part et d'autre.
    const key = back(-1);
    const chest = back(1);
    const box = { x: Math.min(r.x, pk.x), y: Math.min(r.y, pk.y), w: 0, h: 0 };
    box.w = Math.max(r.x + r.w, pk.x + pk.w) - box.x;
    box.h = Math.max(r.y + r.h, pk.y + pk.h) - box.y;
    const wallRow = (a: number) => at(e, a, 0);
    const straight = (a: number) => map.get(wallRow(a).x, wallRow(a).y) === Tile.Wall && inside(r, at(e, a, 1)) && floorFree(at(e, a, 1));
    const enigma: Enigma = { kind, room: box, hall: { ...r }, entry: { ...e }, key, keyShown: true, chest };
    if (kind === "tir" || kind === "racines") {
      // Le mur entre la salle et la petite pièce s'ouvre sur 5 cases (tir) ou 3 (racines), s'il est droit.
      const span = kind === "tir" ? [-2, -1, 0, 1, 2] : [-1, 0, 1];
      if (!span.every(straight)) return restore();
      if (kind === "tir") {
        const kinds = ["cible", "barriere", "cibleBleue", "barriere", "cible"];
        span.forEach((a, i) => {
          const p = wallRow(a);
          map.set(p.x, p.y, Tile.Floor);
          put(p.x, p.y, kinds[i]);
        });
        // Pistes de tir à la craie devant (entre les cibles), puis la ligne de tir.
        // Les traits suivent le sens du tir : contre un mur de côté, les pistes sont horizontales et la ligne verticale.
        const [laneArt, lineArt] = dir.y !== 0 ? ["piste", "ligneTir"] : ["ligneTir", "piste"];
        for (const a of [-1, 1]) for (let b = 1; b <= 3; b++) if (inside(r, at(e, a, b)) && floorFree(at(e, a, b))) put(at(e, a, b).x, at(e, a, b).y, laneArt);
        for (const a of span) if (inside(r, at(e, a, 4)) && floorFree(at(e, a, 4))) put(at(e, a, 4).x, at(e, a, 4).y, lineArt);
      } else {
        for (const a of span) {
          const p = wallRow(a);
          map.set(p.x, p.y, Tile.Floor);
          put(p.x, p.y, "racines");
        }
      }
    } else if (kind === "glisse") {
      // L'entrée ouverte ; les deux premières rangées de la petite pièce : eau profonde ; la troisième, la rive.
      map.set(e.x, e.y, Tile.Floor);
      for (const b of [1, 2]) for (const a of [-1, 0, 1]) {
        const p = { x: e.x + dir.x * b + along.x * a, y: e.y + dir.y * b + along.y * a };
        put(p.x, p.y, "eauProfonde");
      }
    } else if (kind === "balance" || kind === "gardiens") {
      map.set(e.x, e.y, Tile.Floor);
      put(e.x, e.y, kind === "balance" ? "herse" : "herseUp");
      enigma.gate = { x: e.x, y: e.y };
      if (kind === "balance") {
        // La grande dalle (2 × 2) devant la herse, dans la salle.
        const corners = [at(e, 0, 2), at(e, -1, 2), at(e, 1, 2), at(e, 0, 3)];
        const plate = corners
          .map((c) => ({ x: Math.min(c.x, c.x + along.x + inward.x), y: Math.min(c.y, c.y + along.y + inward.y) }))
          .find((p) => [p, { x: p.x + 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x + 1, y: p.y + 1 }].every((c) => inside(r, c) && floorFree(c)));
        if (!plate) return restore();
        put(plate.x, plate.y, "dalleGeant");
        enigma.plate = plate;
      } else {
        // Deux gardiens au bout de deux rangées parallèles au mur (à 1 et 3 cases de lui), chacun d'un côté : leur
        // regard barre la salle.
        if (r.w < 5 || r.h < 5) return restore();
        const gazes: Point[][] = [];
        for (const [b, side] of [[1, -1], [3, 1]] as const) {
          const line: Point[] = [];
          for (let a = -20; a <= 20; a++) {
            const p = at(e, a, b);
            if (inside(r, p)) line.push(p);
          }
          if (line.length < 4) return restore();
          if (side > 0) line.reverse();
          const statue = line[0];
          if (!floorFree(statue) || byOpening(r, statue)) return restore();
          put(statue.x, statue.y, "gardien");
          gazes.push(line.slice(1));
        }
        enigma.gazes = gazes;
      }
    }
    map.set(chest.x, chest.y, Tile.Chest);
    return { enigma, items: [{ ...key, item: "clef_argent", count: 1 }], host: -1 };
  }
}
