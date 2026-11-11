import { RULES } from "../data/rules";
import { ItemId, ITEMS, Rarity } from "../data/items";
import { GOLD_SIZE, goldRange, LOOT, RARITY_ODDS, sectionOf } from "../data/loot";
import { Actor } from "../entities/actor";
import { LightSource } from "../world/fov";
import { Room } from "../world/generator";
import { Furniture, RoomTheme } from "../world/furnish";
import { Motif } from "../world/grounds";
import { THEMED_ROOMS } from "../data/themedRooms";
import { GameMap, Point, Tile } from "../world/map";
import { Rng } from "./rng";

/**
 * Un étage et ce qu'on y pose en le créant (clef, caches, pièges). Les monstres sont créés par la partie (`game.ts`),
 * qui leur donne leurs numéros.
 */
/** Tout ce qu'il faut garder d'un étage pour le retrouver tel quel en y revenant. */
export interface FloorState {
  map: GameMap;
  start: Point;
  stairs: Point;
  rooms: Room[];
  torches: LightSource[];
  monsters: Actor[];
  ground: GroundItem[];
  debris: Debris[];
  /** Taches de sang : sur le sol (forme 0 ou 1) ou sur un mur (forme 2) ; rouge (héros) ou vert (Schrats). */
  blood: BloodStain[];
  explored: Uint8Array;
  sensed: Uint8Array;
  rng: Rng;
  seenMonsters: Set<number>;
  /** Repeuplement : nombre de monstres à l'origine, et tour du prochain renfort possible. */
  population: number;
  nextRespawn: number;
  /** Niveau d'alerte de l'étage (0 à 100) et palier atteint (0 calme, 1 agité, 2 alerte, 3 traque). */
  alarm: number;
  alarmStage: number;
  /** Le héros s'est déjà reposé sur cet étage (un seul repos par étage). */
  rested: boolean;
  /** Caches de l'étage (butin enfoui dans une salle) et salles déjà fouillées (une fouille par salle). */
  secrets: Secret[];
  searched: Set<number>;
  /** Pièges de l'étage (visibles pour l'instant) : ils restent armés. */
  traps: Point[];
  /** Meubles des salles de fouille, et thème de ces salles. */
  furniture: Furniture[];
  themes: RoomTheme[];
  /** Motifs gravés au sol (décor). */
  motifs: Motif[];
}

/** Une cache : un objet enfoui dans une salle, invisible tant qu'une fouille réussie ne l'a pas trouvé. */
export interface Secret {
  x: number;
  y: number;
  room: number;
  item: ItemId;
  count: number;
  found: boolean;
}

/** Débris sans usage (flèche brisée) : il reste au sol jusqu'au tour `until`, puis disparaît. */
export interface Debris {
  x: number;
  y: number;
  angle: number;
  until: number;
}

/** Un objet posé au sol. */
export interface BloodStain {
  x: number;
  y: number;
  color: "red" | "green";
  shape: 0 | 1 | 2;
  /** Tache au sol : quart de tour et miroir, pour que les giclures varient. */
  turn?: number;
}

export interface GroundItem {
  x: number;
  y: number;
  item: ItemId;
  count: number;
  /** Orientation de l'objet posé au sol (radians), pour les flèches : dans quel sens elle est tombée ou plantée. */
  angle?: number;
}


/** État complet d'une partie. Ne connaît ni l'écran ni le tactile. */

/** Éléments d'une salle (colonnes, cheminée) : plus il y en a, plus elle a de chances de cacher quelque chose. */
export function roomElements(map: GameMap, torches: readonly LightSource[], room: Room): number {
  let pillars = false;
  let furniture = false;
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (map.get(x, y) === Tile.Pillar) pillars = true;
      if (map.get(x, y) === Tile.Furniture) furniture = true;
    }
  }
  const hearth = torches.some(
    (t) => t.hearth && t.x >= room.x - 1 && t.x <= room.x + room.w && t.y >= room.y - 1 && t.y <= room.y + room.h,
  );
  return (pillars ? 1 : 0) + (hearth ? 1 : 0) + (furniture ? 1 : 0);
}

/** Enfouit des caches dans les salles garnies : une salle vide n'en a jamais. Hasard à part, pour ne rien changer au reste. */
export function placeSecrets(state: FloorState, depth: number, seed: number): void {
  const rng = new Rng(seed ^ 0x2c1b3c6d);
  state.rooms.forEach((room, index) => {
    if (index === 0) return; // salle de départ
    const theme = THEMED_ROOMS.find((t) => state.themes.some((th) => th.room === index && th.id === t.id));
    if (theme) {
      // Salle de fouille : la cache est au pied d'un meuble, et son butin suit le thème.
      if (!rng.chance(RULES.themedSecretChance)) return;
      const spots: Point[] = [];
      for (const f of state.furniture) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = f.x + dx;
          const y = f.y + dy;
          if (x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h && state.map.get(x, y) === Tile.Floor) spots.push({ x, y });
        }
      }
      if (spots.length === 0) return;
      const spot = spots[rng.int(0, spots.length - 1)];
      let pick = rng.next() * theme.loot.reduce((sum, l) => sum + l.weight, 0);
      const loot = theme.loot.find((l) => (pick -= l.weight) < 0) ?? theme.loot[0];
      const count = rng.int(loot.min, loot.max) + (loot.item === "or" ? RULES.secretGoldPerDepth * (depth - 1) : 0);
      state.secrets.push({ x: spot.x, y: spot.y, room: index, item: loot.item, count, found: false });
      return;
    }
    const chance = Math.min(RULES.secretChanceMax, RULES.secretChancePerElement * roomElements(state.map, state.torches, room));
    if (chance <= 0 || !rng.chance(chance)) return;
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = rng.int(room.x, room.x + room.w - 1);
      const y = rng.int(room.y, room.y + room.h - 1);
      if (state.map.get(x, y) !== Tile.Floor) continue;
      const gold = rng.chance(RULES.secretGoldChance);
      state.secrets.push({
        x,
        y,
        room: index,
        item: gold ? "or" : "fleche",
        count: gold
          ? rng.int(RULES.secretGoldMin, RULES.secretGoldMax) + RULES.secretGoldPerDepth * (depth - 1)
          : rng.int(RULES.secretArrowsMin, RULES.secretArrowsMax),
        found: false,
      });
      return;
    }
  });
}

/** Pose les pièges : au plus un par salle, jamais dans la salle de départ, toujours au milieu du sol. Hasard à part. */
export function placeTraps(state: FloorState, seed: number): void {
  const rng = new Rng(seed ^ 0x51ed2701);
  state.rooms.forEach((room, index) => {
    if (index === 0 || !rng.chance(RULES.trapRoomChance)) return;
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = rng.int(room.x, room.x + room.w - 1);
      const y = rng.int(room.y, room.y + room.h - 1);
      // Seulement au milieu du sol (8 voisines dégagées) : un piège ne bouche jamais un passage, et l'on peut toujours le contourner.
      let open = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (state.map.get(x + dx, y + dy) !== Tile.Floor) open = false;
      if (!open || state.ground.some((g) => g.x === x && g.y === y)) continue;
      state.traps.push({ x, y });
      return;
    }
  });
}

/** Tire la rareté puis l'objet d'un butin, à cet étage. */
export function rollLoot(rng: Rng, depth: number): { item: ItemId; count: number } {
  const odds = RARITY_ODDS[Math.min(sectionOf(depth), RARITY_ODDS.length - 1)];
  let roll = rng.int(1, 100);
  let rarity: Rarity = "common";
  for (const r of ["common", "uncommon", "rare"] as Rarity[]) {
    if (roll <= odds[r]) {
      rarity = r;
      break;
    }
    roll -= odds[r];
  }
  const pool = LOOT[rarity].filter((l) => (l.minDepth ?? 1) <= depth);
  const pick = pool[rng.int(0, pool.length - 1)];
  if (pick.item === "gold") {
    const [min, max] = goldRange(depth, GOLD_SIZE[rarity]);
    return { item: "or", count: rng.int(min, max) };
  }
  const count = pick.count ? rng.int(pick.count[0], pick.count[1]) : 1;
  return { item: pick.item, count: Math.min(count, ITEMS[pick.item].maxStack) };
}

/** Butin au sol : un objet dans certaines salles (jamais celle de départ), sur une case de sol libre. */
export function placeLoot(state: FloorState, depth: number, seed: number): void {
  const rng = new Rng(seed ^ 0x2b0f71c3);
  state.rooms.forEach((room, index) => {
    if (index === 0 || !rng.chance(RULES.lootRoomChance)) return;
    const loot = rollLoot(rng, depth);
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = rng.int(room.x, room.x + room.w - 1);
      const y = rng.int(room.y, room.y + room.h - 1);
      if (state.map.get(x, y) !== Tile.Floor || state.ground.some((g) => g.x === x && g.y === y)) continue;
      if (state.traps.some((t) => t.x === x && t.y === y)) continue;
      state.ground.push({ x, y, item: loot.item, count: loot.count });
      return;
    }
  });
}

/** Avec un peu de chance, une clef traîne dans une salle de l'étage (jamais sous les pieds du héros). */
export function placeKey(state: FloorState, rng: Rng, hero: Point): void {
  if (!rng.chance(RULES.keyChance)) return;
  for (let attempt = 0; attempt < 30; attempt++) {
    const room = state.rooms[rng.int(0, state.rooms.length - 1)];
    const x = rng.int(room.x, room.x + room.w - 1);
    const y = rng.int(room.y, room.y + room.h - 1);
    if (state.map.get(x, y) !== Tile.Floor || (x === hero.x && y === hero.y)) continue;
    state.ground.push({ x, y, item: "clef", count: 1 });
    return;
  }
}
