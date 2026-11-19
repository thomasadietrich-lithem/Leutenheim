import { RULES } from "../data/rules";
import { ItemId, ITEMS, Rarity } from "../data/items";
import { GOLD_SIZE, goldRange, lessGold, LOOT, RARITY_ODDS, SECTION_GUARANTEES, sectionOf } from "../data/loot";
import { Actor } from "../entities/actor";
import { LightSource } from "../world/fov";
import { Room } from "../world/generator";
import { Furniture, furnitureCells, RoomTheme } from "../world/furnish";
import { Motif } from "../world/grounds";
import type { BossLayout } from "../world/bossFloor";
import { THEMED_ROOMS } from "../data/themedRooms";
import { GameMap, Point, Tile } from "../world/map";
import { Rng } from "./rng";
import type { Merchant } from "./merchant";
import { TRAPS, TrapKind } from "../data/traps";

/**
 * Un étage et ce qu'on y pose en le créant (clef, caches, pièges). Les monstres sont créés par la partie (`game.ts`),
 * qui leur donne leurs numéros.
 */
/** Tout ce qu'il faut garder d'un étage pour le retrouver tel quel en y revenant. */
export interface FloorState {
  /** Section 3 : la lune renvoyée par un miroir (piège), quelques tours autour de lui. */
  moonFlashes?: { x: number; y: number; turns: number }[];
  map: GameMap;
  start: Point;
  stairs: Point;
  rooms: Room[];
  torches: LightSource[];
  monsters: Actor[];
  ground: GroundItem[];
  debris: Debris[];
  /** Section 2 : cases dont la mousse a déjà brûlé (index y × 4096 + x) : elle ne repropage plus le feu, et ses veines
   *  sont noircies. */
  mossBurnt?: number[];
  /** Le décor de l'étage : « champi » pour la section 2 (la champignonnière). */
  look?: "champi" | "ossuaire";
  /** Le coffre doré, apparu à la mort du boss (Thomas, 2026-11-14) : argent, artefact, arme, armure. */
  goldChest?: Point;
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
  /** Bagarres araignée contre Kobold déjà montrées sur cet étage (Thomas, 2026-11-13). */
  brawls?: number;
  /** Repos pris sur cet étage (Récupération au rang 3 : deux) ; absent des anciennes sauvegardes (alors `rested`). */
  rests?: number;
  /** Caches de l'étage (butin enfoui dans une salle) et salles déjà fouillées (une fouille par salle). */
  secrets: Secret[];
  searched: Set<number>;
  /** Pièges de l'étage (visibles pour l'instant) : ils restent armés. */
  traps: Trap[];
  /** Meubles des salles de fouille, et thème de ces salles. */
  furniture: Furniture[];
  themes: RoomTheme[];
  /** Motifs gravés au sol (décor). */
  motifs: Motif[];
  /** Étage du boss : le plan de la nichée (grande toile, colonnes, brèches, coffre, escalier scellé). */
  boss?: BossLayout;
  /** Le Colporteur, s'il passe par cet étage (pour l'instant : salle d'essai). */
  merchant?: Merchant;
  /** La porte du Kobold qui compte (Thomas, 2026-11-12), s'il y en a une sur cet étage. */
  counter?: CounterDoor;
  /** Gluck, le Kobold aux pommes (quête 01), s'il est sur cet étage. */
  gluck?: GluckSpot;
  /** Sœur Osseuse (quête 02), si elle est sur cet étage. */
  soeur?: GluckSpot;
  /** Krik, le Kobold qui ne sait plus mentir (quête 03), s'il est sur cet étage. */
  krik?: GluckSpot;
  /** La salle de bain du Kobold (truc fun, Thomas 2026-11-13), s'il y en a une sur cet étage. */
  bath?: BathState;
  /** Le poulet et sa porte qu'on ne peut pas forcer (truc fun), ou le poulet échappé de la ferme. */
  chicken?: ChickenState;
  /** Le poulet de la ferme quand celui du truc fun est déjà sur l'étage (salle d'essai). */
  farmChicken?: ChickenState;
  /** La ferme : les cases du pré, et les poules qui s'y promènent. */
  farm?: { field: Point[]; hens: { x: number; y: number; fromX: number; fromY: number }[] };
  /** Quêtes v3 : la zone spéciale taillée dans la roche quand la quête est donnée. */
  zone?: QuestZone;
  /** La pièce secrète de l'étage (Thomas, 2026-11-14), s'il y en a une. */
  secretRoom?: import("../world/secretRoom").SecretRoom;
  /** Faux murs du pinceau magique (2026-11-18) : la case, les tours avant qu'il s'efface. */
  fakeWalls?: { x: number; y: number; turns: number }[];
  /** Section 2 : salles où les champignons se sont refermés après un bruit, jusqu'à ce tour. */
  hush?: { room: number; until: number }[];
  /** Niche secrète : le pan de mur, la case derrière, la dalle à pression ; ouverte ou non. */
  niche?: { wall: Point; cell: Point; plate: Point; open?: boolean };
  /** Bombes arcaniques posées : leur case et les tours avant l'explosion. */
  bombs?: { x: number; y: number; turns: number }[];
  /** Quêtes v3, Sœur Osseuse : les cierges à rallumer (les cases) ; les grilles d'où monte le son (la bonne, indiquée ou non). */
  cierges?: Point[];
  grates?: { cells: Point[]; right: number; hinted: boolean };
  /** Quêtes v3, Grum : la poule aux œufs d'or échappée. */
  goldHen?: { x: number; y: number; fromX: number; fromY: number };
  /** Grum, le Kobold fermier (quête 05), s'il est sur cet étage. */
  grum?: GluckSpot;
  /** Section 2 : Morillon, le Kobold cueilleur, dans sa champignonnière. */
  morillon?: GluckSpot;
  /** Section 2 : Vernis (hall d'exposition), le Maestro (salle de concert) ; section 1 : Plumeau (prison). */
  vernis?: GluckSpot;
  maestro?: GluckSpot;
  plumeau?: GluckSpot;
  /** Section 3 : Sœur Clavicule (chapelle des os). */
  clavicule?: GluckSpot;
  /** Section 3 : bénédiction du repos (les squelettes abattus ne se relèvent plus sur l'étage) ; nuits (potion de nuit). */
  restful?: boolean;
  nights?: { x: number; y: number; turns: number; hero?: boolean }[];
  /** Fifrelin, le Kobold aux gobelets (quête 04), s'il est sur cet étage. */
  fifrelin?: GluckSpot;
  /** Le coursier de Krik (rencontre 3), à escorter jusqu'à l'escalier. */
  courier?: { x: number; y: number; fromX: number; fromY: number };
}

/**
 * ZONE SPÉCIALE DE QUÊTE (Thomas, 2026-11-13 : « une petite pièce avec 3 Kobolds sur des paillasses et une bougie,
 * derrière un passage secret »). Taillée dans la roche contre une salle quand la quête est donnée ; on y entre par une
 * action du jeu (trancher la tapisserie).
 */
export interface QuestZone {
  /** `traitres` : le dortoir des traîtres de Krik ; `placard` : la mauvaise tapisserie (un placard, une pomme). */
  kind: "traitres" | "placard" | "cellier" | "sacristie" | "grange" | "tripot";
  /** Comment on entre : trancher la tapisserie, pousser le tonneau creux ou la botte de foin, ou le mur qui coulisse. */
  door: "tapestry" | "barrel" | "hay" | "wall";
  /** Où apparaît l'objet à rapporter (sac de Gluck), et une place pour un PNJ dans la zone. */
  loot?: Point;
  inside?: Point;
  room: { x: number; y: number; w: number; h: number };
  /** La case de mur de l'entrée (la tapisserie), et si elle est ouverte. */
  entry: Point;
  open: boolean;
  /** La salle (index) contre laquelle la zone est taillée ; `noticed` : une fouille y a repéré le tonneau creux. */
  host?: number;
  noticed?: boolean;
  /** La bougie (allumée : les dormeurs entendent ; soufflée : le noir, ils n'entendent plus rien). */
  candle?: Point;
  candleLit?: boolean;
  /** La dalle à pression (la cache de Krik) et si on l'a enfoncée. */
  plate?: Point;
  pressed?: boolean;
  /** Les Kobolds de la zone (numéros). */
  sleepers: number[];
}

/**
 * Truc fun du poulet (Thomas, 2026-11-13) : une salle fermée par une porte qu'aucun jet n'ouvre (`door`), un coffre
 * dedans ; le poulet attend ailleurs (`x`, `y`). Dérangé, il traverse le donjon, défonce la porte et s'écrase contre le
 * mur du fond (`crash`) ; il y laisse une cuisse. `done` : c'est arrivé.
 */
export interface ChickenState {
  x: number;
  y: number;
  /** La porte qu'il défonce ; sans porte (le poulet de la ferme), il fonce droit dans un mur. */
  door?: Point;
  crash: Point;
  room: number;
  done: boolean;
  /** Ferme (Thomas, 2026-11-14 : « exactement le même dispositif ») : le poulailler derrière la porte qu'il défonce. */
  pen?: Room;
}

/** La salle de bain : la baignoire (sa case de gauche), le Kobold sorti de l'eau ou non, la musique, vaincu ou non. */
export interface BathState {
  x: number;
  y: number;
  out: boolean;
  music: boolean;
  beaten: boolean;
  /** Son canard volé (Thomas, 2026-11-18 : « voler le canard sans le réveiller »). */
  duckTaken?: boolean;
}

/** Gluck sur un étage : sa case, s'il est parti, et où en est la conversation. */
export interface GluckSpot {
  x: number;
  y: number;
  gone: boolean;
  /** Ce qu'il a dit en arrivant (retour d'un placement), affiché une fois. */
  intro?: string[];
  opened?: boolean;
  /** Un choix en attente : « give » (donne-moi une pomme d'abord), « scam » (la pomme à 80 or). */
  pending?: "give" | "scam";
  pendingLines?: string[];
  /** Marchandage déjà tenté (commerçant) : on ne peut pas recommencer. */
  haggled?: boolean;
  /** Salle d'essai : il revient quelques tours après être parti, à la rencontre suivante. */
  backAt?: number;
  /** Les pommes qu'il laisse en partant : elles tombent par terre autour de lui (Thomas, 2026-11-12). */
  drops?: number;
  /** Les objets qu'il laisse en partant (Krik) : ils tombent par terre autour de lui. */
  items?: { item: ItemId; count: number }[];
  /** L'or qu'il laisse en partant (donation de Sœur Osseuse), en un tas à côté de lui. */
  gold?: number;
  /** Sœur Osseuse, rencontre 4 : le tambour a déjà résonné à l'ouverture. */
  drumDone?: boolean;
  /** Quêtes v3 : il dort (Gluck fait la sieste dans son cellier, sur son sac). */
  asleep?: boolean;
  /** Fifrelin : le combat en cours ou fini (le pari, la mise, le gain). */
  bout?: { bet: "champ" | "small" | "duel" | null; payout: number; over: boolean; rigged?: boolean };
  /** Fifrelin : l'intérieur de sa petite arène (3 × 3), s'il a pu en installer une. */
  ring?: Room;
}

/**
 * La porte du compteur : derrière une porte verrouillée percée d'un trou, un Kobold invisible répète le même nombre.
 * On regarde par le trou : il y met le doigt (dans l'œil) et compte un de plus. On force la porte : on l'attrape.
 */
export interface CounterDoor {
  x: number;
  y: number;
  /** Où il se tient, derrière la porte. */
  inside: { x: number; y: number };
  /** Le nombre qu'il répète. */
  n: number;
  /** Le héros l'a déjà entendu (le journal ne le dit qu'une fois). */
  heard: boolean;
  /** La porte est ouverte : il est sorti de sa cachette. */
  opened: boolean;
}

/** Un piège : sa case, sa sorte (pointes par défaut, pour les anciennes sauvegardes), et la fosse déjà effondrée. */
export interface Trap extends Point {
  kind?: TrapKind;
  sprung?: boolean;
  /** Caché : invisible, et le héros ne le contourne pas, tant qu'une fouille ne l'a pas trouvé ou qu'il n'est pas parti. */
  hidden?: boolean;
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
  /** Une javeline brisée (Thomas, 2026-11-12 : « une javeline brisée, ce n'est pas une flèche brisée »). */
  javelin?: boolean;
}

/** Un objet posé au sol. */
/** Taches au sol : sang (rouge héros, jaune Kobolds, noir araignées ; vert des anciennes sauvegardes), SUIE du feu,
 *  flaques de potion (Thomas, 2026-11-12). */
export type StainColor = "red" | "green" | "yellow" | "black" | "soot" | "pYouth" | "pPoison" | "pHaste" | "pFire" | "pUrchin" | "pStone" | "pDiscord" | "pGrow" | "pSlip";

export interface BloodStain {
  x: number;
  y: number;
  color: StainColor;
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
      // Certains objets n'apparaissent pas trop tôt (sac de cuir : pas avant la fin de la section 1).
      const pool = theme.loot.filter((l) => (l.minDepth ?? 1) <= depth);
      let pick = rng.next() * pool.reduce((sum, l) => sum + l.weight, 0);
      const loot = pool.find((l) => (pick -= l.weight) < 0) ?? pool[0];
      const raw = rng.int(loot.min, loot.max) + (loot.item === "or" ? RULES.secretGoldPerDepth * (depth - 1) : 0);
      const count = loot.item === "or" ? lessGold(raw) : raw;
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
          ? lessGold(rng.int(RULES.secretGoldMin, RULES.secretGoldMax) + RULES.secretGoldPerDepth * (depth - 1))
          : rng.int(RULES.secretArrowsMin, RULES.secretArrowsMax),
        found: false,
      });
      return;
    }
  });
}

/** Pose les pièges : au plus un par salle, jamais dans la salle de départ, toujours au milieu du sol. Hasard à part. */
export function placeTraps(state: FloorState, seed: number, depth = 1): void {
  const rng = new Rng(seed ^ 0x51ed2701);
  // La sorte de chaque piège se tire à part : les cases des pièges ne changent pas.
  const kindRng = new Rng(seed ^ 0x7a3c19e5);
  // Caché ou non : tiré à part aussi (crescendo selon l'étage).
  const hideRng = new Rng(seed ^ 0x2b9d4e61);
  const section = sectionOf(depth);
  const hiddenShare = Math.min(
    RULES.trapHiddenMax,
    RULES.trapHiddenByDepth[Math.min(depth, RULES.trapHiddenByDepth.length) - 1] + RULES.trapHiddenPerSection * section,
  );
  const bonus = RULES.trapRoomChancePerSection * section;
  const chance = Math.min(RULES.trapRoomChanceMax + bonus, RULES.trapRoomChance + RULES.trapRoomChancePerDepth * (depth - 1) + bonus);
  const kinds = (Object.keys(TRAPS) as TrapKind[]).filter(
    (k) => TRAPS[k].minDepth <= depth && (!TRAPS[k].sections || TRAPS[k].sections!.includes(Math.min(section, 2))),
  );
  // Section 3 : la lame pendule ne se pose que dans les couloirs (et n'y a qu'elle).
  const roomKinds = kinds.filter((k) => !TRAPS[k].corridorOnly);
  const corridorKinds = kinds.some((k) => TRAPS[k].corridorOnly) ? kinds.filter((k) => TRAPS[k].corridorOnly) : kinds;
  state.rooms.forEach((room, index) => {
    if (index === 0 || !rng.chance(chance)) return;
    // Pas de piège dans une salle à thème (Thomas, 2026-11-11). Le tirage a eu lieu : le hasard des autres salles ne change pas.
    if (state.themes.some((t) => t.room === index)) return;
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = rng.int(room.x, room.x + room.w - 1);
      const y = rng.int(room.y, room.y + room.h - 1);
      // Seulement au milieu du sol (8 voisines dégagées) : un piège ne bouche jamais un passage, et l'on peut toujours le contourner.
      let open = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (state.map.get(x + dx, y + dy) !== Tile.Floor) open = false;
      if (!open || state.ground.some((g) => g.x === x && g.y === y)) continue;
      if (state.furniture.some((f) => furnitureCells(f).some((c) => c.x === x && c.y === y))) continue;
      let pick = kindRng.next() * roomKinds.reduce((sum, k) => sum + TRAPS[k].weight, 0);
      const kind = roomKinds.find((k) => (pick -= TRAPS[k].weight) < 0) ?? roomKinds[0];
      const trap: Trap = { x, y, kind };
      if (hideRng.chance(hiddenShare)) trap.hidden = true;
      state.traps.push(trap);
      return;
    }
  });
  placeCorridorTraps(state, seed, depth, corridorKinds, hiddenShare);
}

/**
 * PIÈGES DE COULOIR (Thomas, 2026-11-17 : « mets des pièges dans certains couloirs, à condition qu'il y ait un autre
 * accès ») : dès l'étage 2, un par étage 6 fois sur 10, un deuxième dès l'étage 4 (C). Sur une case de couloir droite
 * (deux voisines en face l'une de l'autre), loin des portes et des escaliers, et seulement si l'on peut faire le tour :
 * boucher la case laisse ses deux côtés reliés. Tirage à part : le reste de l'étage ne change pas.
 */
function placeCorridorTraps(state: FloorState, seed: number, depth: number, kinds: TrapKind[], hiddenShare: number): void {
  if (depth < RULES.corridorTrapMinDepth || kinds.length === 0) return;
  const rng = new Rng(seed ^ 0x6c0771d5);
  const wanted = (rng.chance(RULES.corridorTrapChance) ? 1 : 0) + (depth >= RULES.corridorTrapSecondDepth && rng.chance(RULES.corridorTrapChance) ? 1 : 0);
  if (wanted === 0) return;
  const map = state.map;
  const inRoom = (x: number, y: number) => state.rooms.some((r) => x >= r.x - 1 && y >= r.y - 1 && x <= r.x + r.w && y <= r.y + r.h);
  const walk = (x: number, y: number) => map.isWalkable(x, y);
  const near = (x: number, y: number, test: (t: Tile) => boolean) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (test(map.get(x + dx, y + dy))) return true;
    return false;
  };
  const candidates: Point[] = [];
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      if (map.get(x, y) !== Tile.Floor || inRoom(x, y)) continue;
      const ns = walk(x, y - 1) && walk(x, y + 1) && !walk(x - 1, y) && !walk(x + 1, y);
      const ew = walk(x - 1, y) && walk(x + 1, y) && !walk(x, y - 1) && !walk(x, y + 1);
      if (!ns && !ew) continue;
      if (near(x, y, (t) => t === Tile.DoorClosed || t === Tile.DoorOpen || t === Tile.DoorLocked || t === Tile.StairsDown || t === Tile.StairsUp)) continue;
      if (state.traps.some((t) => Math.abs(t.x - x) + Math.abs(t.y - y) < 6)) continue;
      if (state.ground.some((g) => g.x === x && g.y === y) || state.furniture.some((f) => furnitureCells(f).some((c) => c.x === x && c.y === y))) continue;
      candidates.push({ x, y });
    }
  }
  for (let i = 0; i < wanted && candidates.length > 0; i++) {
    const at = candidates.splice(rng.int(0, candidates.length - 1), 1)[0];
    // Un autre accès : sans cette case (ni celles des autres pièges), ses deux côtés restent reliés.
    const ns = map.isWalkable(at.x, at.y - 1) && map.isWalkable(at.x, at.y + 1);
    const a = ns ? { x: at.x, y: at.y - 1 } : { x: at.x - 1, y: at.y };
    const b = ns ? { x: at.x, y: at.y + 1 } : { x: at.x + 1, y: at.y };
    if (state.traps.some((t) => Math.abs(t.x - at.x) + Math.abs(t.y - at.y) < 6) || !connectedWithout(map, a, b, [at, ...state.traps])) {
      i--;
      continue;
    }
    let pick = rng.next() * kinds.reduce((sum, k) => sum + TRAPS[k].weight, 0);
    const kind = kinds.find((k) => (pick -= TRAPS[k].weight) < 0) ?? kinds[0];
    const trap: Trap = { x: at.x, y: at.y, kind };
    // La lame pendule se voit toujours (on la regarde passer, on attend le bon moment).
    if (rng.chance(hiddenShare) && !TRAPS[kind].swings) trap.hidden = true;
    state.traps.push(trap);
  }
}

/** Deux cases restent-elles reliées (pas droits) si l'on bouche celle-ci ? */
function connectedWithout(map: GameMap, a: Point, b: Point, blockedCells: Point[]): boolean {
  const seen = new Uint8Array(map.width * map.height);
  const stack = [a];
  seen[a.y * map.width + a.x] = 1;
  while (stack.length > 0) {
    const p = stack.pop()!;
    if (p.x === b.x && p.y === b.y) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || blockedCells.some((c) => c.x === x && c.y === y)) continue;
      // Une porte verrouillée ne compte pas comme un passage.
      if (map.get(x, y) === Tile.DoorLocked) continue;
      const k = y * map.width + x;
      if (seen[k] || !map.isWalkable(x, y)) continue;
      seen[k] = 1;
      stack.push({ x, y });
    }
  }
  return false;
}

/**
 * BIBELOTS UNIQUES (Thomas, 2026-11-15 : « chaque bibelot est unique, et ne devrait pas pouvoir tomber une deuxième
 * fois ») : la partie en cours tient la liste de ceux déjà sortis (butin, coffre, cache, Colporteur) ; le tirage les
 * écarte. La partie y fait pointer ce registre (`trackUniques`) avant de tirer quoi que ce soit.
 */
let seenUniques: Set<string> = new Set();
export function trackUniques(set: Set<string>): void {
  seenUniques = set;
}
export function isUnique(id: ItemId): boolean {
  return ITEMS[id]?.kind === "artifact";
}
/** Un bibelot vient d'entrer dans la partie : il ne sortira plus. */
export function noteUnique(id: ItemId): void {
  if (isUnique(id)) seenUniques.add(id);
}
const available = (id: string): boolean => id === "gold" || !isUnique(id as ItemId) || !seenUniques.has(id);

/** Les objets qu'on porte (armes, armures, casques, sacs, amulettes, bibelots) : soumis à la règle de section. */
const GEAR_KINDS = new Set(["melee", "ranged", "armor", "hat", "bag", "amulet", "artifact"]);

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
  const pool = LOOT[rarity].filter((l) => (l.minDepth ?? 1) <= depth && (l.maxDepth ?? Infinity) >= depth && available(l.item));
  // LE BUTIN DE SA SECTION D'ABORD (Thomas, 2026-11-17 : règle pour la suite) : un équipement d'une section passée
  // (son étage minimal y est) sort quatre fois moins souvent ; une section future est déjà exclue par `minDepth`.
  const section = sectionOf(depth);
  // `weight` : un objet qui sort un peu plus souvent que les autres (la torche : Thomas, 2026-11-17).
  const weight = (l: (typeof pool)[number]): number =>
    (l.weight ?? 1) * (l.item !== "gold" && GEAR_KINDS.has((ITEMS[l.item] as { kind: string }).kind) && sectionOf(l.minDepth ?? 1) < section ? RULES.pastSectionGearWeight : 1);
  let roll2 = rng.next() * pool.reduce((sum, l) => sum + weight(l), 0);
  const pick = pool.find((l) => (roll2 -= weight(l)) < 0) ?? pool[pool.length - 1];
  // Très rare (nœud papillon) : il ne sort qu'une fois sur `odds`, sinon de l'or.
  const missed = pick.odds !== undefined && !rng.chance(pick.odds);
  // Raté : l'objet de rechange s'il y en a un (une pomme au lieu de la cuisse), sinon de l'or.
  if (missed && pick.orElse) return { item: pick.orElse, count: 1 };
  if (pick.item === "gold" || missed) {
    const [min, max] = goldRange(depth, GOLD_SIZE[rarity]);
    return { item: "or", count: rng.int(min, max) };
  }
  const count = pick.count ? rng.int(pick.count[0], pick.count[1]) : 1;
  noteUnique(pick.item);
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

/**
 * Butin garanti de la première section (`SECTION_GUARANTEES`) : l'étage de chaque garantie est tiré une fois pour toute
 * la partie, à partir de la graine de la partie ; on rend ici ce qui doit tomber à l'étage `depth`.
 */
export function guaranteedLoot(runSeed: number, depth: number): { item: ItemId; count: number }[] {
  const rng = new Rng(runSeed ^ 0x7e1a9c55);
  const out: { item: ItemId; count: number }[] = [];
  const pools: Record<string, ItemId[]> = {
    pomme: ["pomme"],
    equipment: lootPool(depth, (k) => k === "melee" || k === "ranged" || k === "armor"),
    gem: lootPool(depth, (k) => k === "gem"),
    potion: lootPool(depth, (k, id) => id.startsWith("potion_")),
  };
  for (const g of SECTION_GUARANTEES) {
    for (let i = 0; i < g.count; i++) {
      if (g.what === "fleches") {
        // Dix flèches : en un seul lot, ou en trois lots (3, 3 et 4) sur des étages tirés à part.
        const lots = rng.chance(0.5) ? [10] : [3, 3, 4];
        for (const n of lots) if (rng.int(g.floors[0], g.floors[1]) === depth) out.push({ item: "fleche", count: n });
        continue;
      }
      const floor = rng.int(g.floors[0], g.floors[1]);
      const pickIndex = rng.int(0, 999);
      const pool = pools[g.what];
      if (floor === depth && pool.length > 0) out.push({ item: pool[pickIndex % pool.length], count: 1 });
    }
  }
  // UNE TORCHE PAR SECTION, au moins (Thomas, 2026-11-17) : sur un de ses quatre premiers étages, tiré à part (le reste
  // du butin garanti ne bouge pas).
  const section = sectionOf(depth);
  const torch = new Rng(runSeed ^ 0x51ed270b ^ Math.imul(section + 1, 7919));
  if (section * RULES.floorsPerSection + torch.int(1, 4) === depth) out.push({ item: "torche", count: 1 });
  return out;
}

/** Les objets des tables de butin (peu communs et rares compris) d'une sorte donnée, permis à cet étage. */
export function lootPool(depth: number, keep: (kind: string, id: string) => boolean, only?: Rarity): ItemId[] {
  const ids: ItemId[] = [];
  for (const rarity of ["common", "uncommon", "rare"] as Rarity[]) {
    if (only && rarity !== only) continue;
    for (const l of LOOT[rarity]) {
      if (l.item === "gold" || (l.minDepth ?? 1) > depth || (l.maxDepth ?? Infinity) < depth || ids.includes(l.item) || !available(l.item)) continue;
      if (keep(ITEMS[l.item].kind, l.item)) ids.push(l.item);
    }
  }
  return ids;
}

/** Pose le butin garanti de cet étage, chacun dans une salle au hasard (jamais celle de départ). */
export function placeGuaranteed(state: FloorState, items: { item: ItemId; count: number }[], seed: number): void {
  const rng = new Rng(seed ^ 0x4d2c6b1f);
  for (const { item, count } of items) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const room = state.rooms[rng.int(Math.min(1, state.rooms.length - 1), state.rooms.length - 1)];
      const x = rng.int(room.x, room.x + room.w - 1);
      const y = rng.int(room.y, room.y + room.h - 1);
      if (state.map.get(x, y) !== Tile.Floor || state.ground.some((g) => g.x === x && g.y === y)) continue;
      if (state.traps.some((t) => t.x === x && t.y === y)) continue;
      if (state.furniture.some((f) => furnitureCells(f).some((c) => c.x === x && c.y === y))) continue;
      state.ground.push({ x, y, item, count });
      break;
    }
  }
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
