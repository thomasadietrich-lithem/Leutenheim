import { ItemId } from "../data/items";
import { FURNITURE_KINDS } from "../data/themedRooms";
import { Rng } from "../core/rng";
import {
  furnishAlchemist,
  furnishBath,
  furnishChapel,
  furnishDortoir,
  furnishFarm,
  furnishForge,
  furnishKitchen,
  furnishTorture,
  Furniture,
  RoomTheme,
} from "./furnish";
import { Motif } from "./grounds";
import { LightSource } from "./fov";
import { Floor, Room } from "./generator";
import { SPECIAL_ROOMS } from "../data/specialRooms";
import type { Trap } from "../core/floor";
import { GameMap, Point, Tile } from "./map";

/**
 * SALLE D'ESSAI v21 (Thomas, 2026-11-14 : « une direction pour chaque type de salles depuis le HUB ») : un étage dessiné à
 * la main, toujours le même. On arrive dans le HUB (le Colporteur y flâne) ; six sorties, chacune vers un type de salles :
 *
 * - à gauche, un long couloir de QUÊTES : Gluck (et sa statue creuse), Sœur Osseuse (dans sa chapelle), Krik, la ferme
 *   (Grum, bientôt) ;
 * - à droite, un long couloir de SALLES À THÈME : dortoir, cuisine, prière, torture, forge, alchimiste ;
 * - en haut à gauche, les TRUCS FUN : cloche, Kobold qui compte, salle de bain, poulet, pièges et sols, autel et coffre ;
 * - en haut à droite, l'ARMURERIE : tous les objets, rangés par zones dessinées au sol ;
 * - en bas à gauche, l'ARÈNE : un monstre de chaque sorte (boutons pour la remettre ou en ajouter) ;
 * - en bas à droite, l'escalier de la NICHÉE DE LA TISSEUSE (le boss).
 *
 * Chaque salle a son nom écrit sur un écriteau, au mur. Revenir dans le HUB remet tout l'étage à neuf (sauf le héros).
 */
export interface SandboxFloor extends Floor {
  traps: Trap[];
  /** Caches à fouiller : leur salle (numéro dans `rooms`), ce qu'elles contiennent. */
  secrets: { x: number; y: number; room: number; item: ItemId; count: number }[];
  furniture: Furniture[];
  themes: RoomTheme[];
  motifs: Motif[];
  ground: { x: number; y: number; item: ItemId; count: number }[];
  /** Niveau du héros en arrivant (pour essayer les objets qui demandent un niveau). */
  heroLevel: number;
  /** `patrol` : il fait les cent pas dans sa salle au lieu de se promener dans tout l'étage. */
  monsters: SandboxMonster[];
  /** Le Colporteur (Thomas, 2026-11-12) : où il se tient et la salle où il flâne. */
  merchant: { x: number; y: number; home: Room };
  /** Places des PNJ de quête (la première libre est prise) ; sans place, la partie en choisit une. */
  npcs?: { gluck?: Point[]; soeur?: Point[]; krik?: Point[]; grum?: Point[]; fifrelin?: Point[] };
  /** Le poulet : la salle fermée (numéro), sa porte, et où il attend. */
  chicken?: { room: number; door: Point; at: Point };
  /** Le placard du Kobold qui compte : sa porte et la case derrière. */
  counter?: { door: Point; inside: Point };
  /** La statue creuse de Gluck est déjà posée dans `furniture` (sinon la partie en pose une au hasard). */
  hollowStatue?: boolean;
  /** Écriteaux au mur : la case (un mur) et le texte (en français ; traduit au dessin). */
  signs?: SandboxSign[];
  /** Zones dessinées au sol (armurerie) : un cadre de couleur et son nom. */
  areas?: SandboxArea[];
  /** Le HUB (numéro de salle) : y revenir remet l'étage à neuf. */
  hub?: number;
  /** L'arène (numéro de salle) : ses monstres se remettent ou s'ajoutent par boutons. */
  arena?: number;
}

export interface SandboxMonster {
  x: number;
  y: number;
  asleep: boolean;
  patrol?: boolean;
  monster?: SandboxMonsterKind;
}

export type SandboxMonsterKind = "schrat" | "araignee" | "frondeur";

export interface SandboxSign {
  x: number;
  y: number;
  text: string;
}

export interface SandboxArea {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
}

/** Version du plan : à augmenter quand on le change, pour qu'une ancienne salle d'essai sauvegardée ne soit pas reprise. */
export const SANDBOX_LAYOUT = 25;

/** Graines des salles meublées (choisies pour que chaque salle montre tous ses meubles ; voir le test « salle d'essai »). */
export const SANDBOX_SEEDS = { dortoir: 1, kitchen: 5, chapel: 7, torture: 3, forge: 30, alchemist: 28, bath: 2, farm: 1, soeur: 7 };

/** Le plan utilisé par la partie : les tests le remplacent par leur banc d'essai (`tests/banc.ts`). */
let plan: () => SandboxFloor = () => buildSandbox();

export function sandboxPlan(): SandboxFloor {
  return plan();
}

export function setSandboxPlan(builder: () => SandboxFloor): void {
  plan = builder;
}

const W = 200;
const H = 70;

export function buildSandbox(seeds = SANDBOX_SEEDS): SandboxFloor {
  const map = new GameMap(W, H);
  const rooms: Room[] = [];
  const signs: SandboxSign[] = [];
  const torches: LightSource[] = [];
  const furniture: Furniture[] = [];
  const themes: RoomTheme[] = [];
  const ground: SandboxFloor["ground"] = [];
  const monsters: SandboxMonster[] = [];
  const traps: Trap[] = [];
  const carve = (r: Room) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map.set(x, y, Tile.Floor);
  };
  const addRoom = (r: Room, name?: string) => {
    carve(r);
    rooms.push(r);
    if (name) signs.push({ x: r.x + Math.floor(r.w / 2), y: r.y - 1, text: name });
    return rooms.length - 1;
  };
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) map.set(x, y, Tile.Floor);
  };
  const put = (x: number, y: number, kind: string) => {
    furniture.push({ x, y, kind });
    map.set(x, y, Tile.Furniture);
  };

  /**
   * Un long couloir horizontal : les salles se suivent le long de la ligne `cy`, à partir de `from` (première case de
   * couloir), vers la gauche (`dir` −1) ou la droite (+1). Entre deux salles, 4 cases de couloir ; une porte à l'entrée
   * de chaque salle (on ne voit pas la suivante avant d'y entrer).
   */
  const chain = (from: number, cy: number, dir: 1 | -1, list: { w: number; h: number; name: string }[]): number[] => {
    let cursor = from;
    const out: number[] = [];
    for (const spec of list) {
      const near = cursor + dir * 4;
      line(cursor, cy, near - dir, cy);
      map.set(near - dir, cy, Tile.DoorClosed);
      const x = dir > 0 ? near : near - spec.w + 1;
      const r: Room = { x, y: cy - Math.floor(spec.h / 2), w: spec.w, h: spec.h };
      out.push(addRoom(r, spec.name));
      cursor = dir > 0 ? r.x + r.w : r.x - 1;
    }
    return out;
  };

  // ---------- Le HUB ----------
  const hub: Room = { x: 90, y: 40, w: 19, h: 11 };
  const hubIndex = addRoom(hub);
  const start = { x: 99, y: 45 };
  // Six sorties : à gauche et à droite au milieu ; deux en haut, deux en bas.
  map.set(89, 45, Tile.Floor);
  map.set(109, 45, Tile.Floor);
  for (const x of [92, 106]) {
    map.set(x, 39, Tile.Floor);
    map.set(x, 51, Tile.Floor);
  }
  signs.push(
    { x: 96, y: 39, text: "↖ Trucs fun" },
    { x: 102, y: 39, text: "Armurerie ↗" },
    { x: 96, y: 51, text: "↙ Arène" },
    { x: 102, y: 51, text: "Boss ↘" },
    { x: 86, y: 44, text: "← Quêtes" },
    { x: 112, y: 44, text: "Salles →" },
  );
  torches.push({ x: 90, y: 39, radius: 7, faceX: 0, faceY: 1 }, { x: 108, y: 39, radius: 7, faceX: 0, faceY: 1 }, { x: 99, y: 51, radius: 6, faceX: 0, faceY: -1 });
  // Le héros proposé n° 2 (planche héros v9, l'apprenti garde), debout à côté du héros actuel, pour comparer.
  put(101, 45, "heroV9");
  const motifs: Motif[] = [
    { x: 93, y: 42, kind: "runes" },
    { x: 104, y: 42, kind: "boussole" },
    { x: 93, y: 47, kind: "rosace" },
    { x: 104, y: 47, kind: "spirale" },
    { x: 98, y: 48, kind: "croix" },
  ];

  // ---------- À gauche : les quêtes ----------
  const [gluckRoom, soeurRoom, krikRoom, farmRoom, fifRoom] = chain(88, 45, -1, [
    { w: 11, h: 9, name: "Gluck, le Kobold aux pommes" },
    { w: 11, h: 9, name: "Sœur Osseuse" },
    { w: 11, h: 9, name: "Krik" },
    { w: 12, h: 9, name: "Ferme de Grum" },
    { w: 11, h: 9, name: "Le jeu de Fifrelin" },
  ]);
  {
    const r = rooms[gluckRoom];
    // La statue creuse (Gluck en parle), des pommes à lui donner.
    put(r.x + 1, r.y + 1, "statue");
    furniture[furniture.length - 1].hollow = true;
    put(r.x + r.w - 2, r.y + 1, "statue");
    ground.push({ x: r.x + 2, y: r.y + r.h - 2, item: "pomme", count: 3 });
    torches.push({ x: r.x + 2, y: r.y - 1, radius: 6, faceX: 0, faceY: 1 });
  }
  const floorPlan = (): Floor => ({ map, rooms, start, stairs: { x: 0, y: 0 }, torches, specials: [] });
  furnishChapel(floorPlan(), rooms[soeurRoom], new Rng(seeds.soeur), furniture);
  themes.push({ room: soeurRoom, id: "priere" });
  {
    const r = rooms[krikRoom];
    torches.push({ x: r.x + 2, y: r.y - 1, radius: 6, faceX: 0, faceY: 1 });
    // Deux Kobolds endormis : de quoi faire les tâches de Sœur Osseuse et de Krik sans courir l'étage.
    monsters.push({ x: r.x + r.w - 2, y: r.y + 1, asleep: true }, { x: r.x + r.w - 2, y: r.y + r.h - 2, asleep: true });
  }
  furnishFarm(floorPlan(), rooms[farmRoom], new Rng(seeds.farm), furniture);
  themes.push({ room: farmRoom, id: "ferme" });

  // ---------- À droite : les salles à thème ----------
  const themed = chain(110, 45, 1, [
    { w: 9, h: 6, name: "Dortoir des Kobolds" },
    { w: 11, h: 7, name: "Cuisine" },
    { w: 9, h: 8, name: "Salle de prière" },
    { w: 9, h: 6, name: "Salle de torture" },
    { w: 9, h: 6, name: "Forge" },
    { w: 9, h: 8, name: "Alchimiste" },
  ]);
  const furnishers = [furnishDortoir, furnishKitchen, furnishChapel, furnishTorture, furnishForge, furnishAlchemist];
  const ids = ["dortoir", "cuisine", "priere", "torture", "forge", "alchimiste"];
  const themeSeeds = [seeds.dortoir, seeds.kitchen, seeds.chapel, seeds.torture, seeds.forge, seeds.alchemist];
  themed.forEach((index, k) => {
    const r = rooms[index];
    // Une torche sur le mur de droite (le dortoir a sa cheminée).
    if (k !== 0) torches.push({ x: r.x + r.w, y: r.y + 1, radius: 6, faceX: -1, faceY: 0 });
    furnishers[k](floorPlan(), r, new Rng(themeSeeds[k]), furniture);
    themes.push({ room: index, id: ids[k] });
  });

  // ---------- En haut à gauche : les trucs fun ----------
  line(92, 28, 92, 38);
  const [bellRoom, counterRoom, bathRoom, chickenHall, trapRoom, altarRoom] = chain(91, 28, -1, [
    { w: 9, h: 7, name: "La cloche" },
    { w: 9, h: 7, name: "Le Kobold qui compte" },
    { w: 7, h: 5, name: "Salle de bain" },
    { w: 9, h: 7, name: "Le poulet" },
    { w: 11, h: 7, name: "Pièges et sols" },
    { w: 11, h: 7, name: "Autel et coffre" },
  ]);
  {
    const r = rooms[bellRoom];
    put(r.x + 4, r.y + 2, "bell");
    torches.push({ x: r.x + 1, y: r.y - 1, radius: 6, faceX: 0, faceY: 1 });
  }
  // Le placard du Kobold qui compte : une porte dans le mur du haut, une case derrière (verrouillée par la partie).
  const counterDoor = { x: rooms[counterRoom].x + 4, y: rooms[counterRoom].y - 1 };
  const counterInside = { x: counterDoor.x, y: counterDoor.y - 1 };
  map.set(counterDoor.x, counterDoor.y, Tile.DoorClosed);
  map.set(counterInside.x, counterInside.y, Tile.Floor);
  signs.find((s) => s.text === "Le Kobold qui compte")!.x = rooms[counterRoom].x + 1;
  torches.push({ x: rooms[counterRoom].x + 7, y: rooms[counterRoom].y - 1, radius: 6, faceX: 0, faceY: 1 });
  furnishBath(floorPlan(), rooms[bathRoom], new Rng(seeds.bath), furniture);
  themes.push({ room: bathRoom, id: "bain" });
  // Le poulet attend au milieu de sa salle ; la salle fermée est au-dessus, porte dans le mur du haut.
  const hall = rooms[chickenHall];
  const lockedRoom: Room = { x: hall.x + 2, y: hall.y - 6, w: 5, h: 5 };
  const lockedIndex = addRoom(lockedRoom);
  const chickenDoor = { x: hall.x + 4, y: hall.y - 1 };
  map.set(chickenDoor.x, chickenDoor.y, Tile.DoorClosed);
  signs.find((s) => s.text === "Le poulet")!.x = hall.x + 1;
  torches.push({ x: hall.x + 7, y: hall.y - 1, radius: 6, faceX: 0, faceY: 1 });
  {
    // Les quatre pièges v3 (la fosse est CACHÉE : une fouille la révèle), du gravier, une flaque.
    const r = rooms[trapRoom];
    traps.push(
      { x: r.x + 2, y: r.y + 3, kind: "spikes" },
      { x: r.x + 4, y: r.y + 1, kind: "gas" },
      { x: r.x + 6, y: r.y + 3, kind: "pit", hidden: true },
      { x: r.x + 8, y: r.y + 5, kind: "needle" },
    );
    for (let x = r.x + 1; x <= r.x + 4; x++) map.set(x, r.y + 5, Tile.Gravel);
    for (const [dx, dy] of [[7, 1], [8, 1], [8, 2], [9, 1]]) map.set(r.x + dx, r.y + dy, Tile.Water);
    torches.push({ x: r.x + 2, y: r.y - 1, radius: 6, faceX: 0, faceY: 1 });
  }
  // Autel et coffre : deux salles spéciales sous la salle, derrière des portes verrouillées ; la clef est au sol.
  const altar = rooms[altarRoom];
  const fountainRoom: Room = { x: altar.x + 1, y: altar.y + altar.h + 2, w: 3, h: 3 };
  const chestRoom: Room = { x: altar.x + 7, y: altar.y + altar.h + 2, w: 3, h: 3 };
  carve(fountainRoom);
  carve(chestRoom);
  map.set(fountainRoom.x + 1, altar.y + altar.h, Tile.Floor);
  map.set(fountainRoom.x + 1, altar.y + altar.h + 1, Tile.DoorLocked);
  map.set(chestRoom.x + 1, altar.y + altar.h, Tile.Floor);
  map.set(chestRoom.x + 1, altar.y + altar.h + 1, Tile.DoorLocked);
  map.set(fountainRoom.x + 1, fountainRoom.y + 1, Tile.Fountain);
  map.set(chestRoom.x + 1, chestRoom.y + 1, Tile.Chest);
  ground.push({ x: altar.x + 5, y: altar.y + 3, item: "clef", count: 2 });
  torches.push({ x: altar.x + 5, y: altar.y - 1, radius: 6, faceX: 0, faceY: 1 });
  signs.find((s) => s.text === "Autel et coffre")!.x = altar.x + 2;

  // ---------- En haut à droite : l'armurerie ----------
  line(106, 36, 106, 38);
  const armory: Room = { x: 96, y: 22, w: 27, h: 14 };
  addRoom(armory, "Armurerie");
  signs[signs.length - 1].x = 109;
  torches.push({ x: 99, y: 21, radius: 8, faceX: 0, faceY: 1 }, { x: 119, y: 21, radius: 8, faceX: 0, faceY: 1 }, { x: 109, y: 36, radius: 7, faceX: 0, faceY: -1 });
  const areas: SandboxArea[] = [];
  /** Une zone : son cadre (rangée du nom comprise) et ses objets posés en ligne, une case sur `step`. */
  const zone = (x: number, y: number, w: number, label: string, color: string, items: [ItemId, number][], step = 1) => {
    areas.push({ x, y, w, h: 2, label, color });
    items.forEach(([item, count], i) => ground.push({ x: x + i * step, y: y + 1, item, count }));
  };
  zone(97, 23, 11, "Armes", "#c9a227", [
    ["epee", 1], ["dague", 1], ["baton", 1], ["masse", 1], ["epee_longue", 1],
    ["couteau_boucher", 1], ["lance", 1], ["cimeterre", 1], ["arc_court", 1], ["arc_puissant", 1], ["fourche", 1],
  ]);
  zone(109, 23, 6, "Armures", "#8fa3b8", [["tunique", 1], ["robe", 1], ["armure_cuir", 1], ["armure_cloutee", 1], ["cotte_mailles", 1], ["harnois", 1]]);
  zone(116, 23, 5, "Casques", "#a77a52", [["casque_cuir", 1], ["casque_maille", 1], ["casque_poulet", 1]], 2);
  zone(97, 27, 11, "Potions", "#b05cc9", [
    ["potion_jouvence", 2], ["potion_poison", 2], ["potion_vitesse", 2], ["potion_feu", 2], ["potion_fumee", 2], ["potion_brouillard", 2],
    ["potion_oursin", 2], ["potion_pierre", 2], ["potion_discorde", 2], ["potion_geant", 2], ["potion_glissante", 2],
  ]);
  zone(110, 27, 5, "Munitions", "#7fae5a", [["fleche", 6], ["fleche_poison", 6], ["javeline", 3]], 2);
  zone(117, 27, 5, "Sacs", "#9c7b4f", [["sac_toile", 1], ["sac_cuir", 1], ["sac_voyage", 1]], 2);
  zone(97, 31, 8, "Gemmes et or", "#5cb8c9", [["amethyste", 1], ["saphir", 1], ["emeraude", 1], ["diamant", 1], ["oeuf_or", 1], ["or", 5], ["or", 15], ["or", 40]]);
  zone(106, 31, 7, "Bibelots", "#d47a9e", [["oeil_chauve_souris", 1], ["flute_pan", 1], ["noeud_papillon", 1], ["outils_voleur", 1]], 2);
  zone(115, 31, 7, "Vivres et lumière", "#d9853b", [["pomme", 3], ["escalope", 1], ["cuisse_poulet", 1], ["torche", 2]], 2);
  // Les objets de quête et la clef (Thomas, 2026-11-14 : « il manque beaucoup d'objets dans la salle de test »).
  zone(97, 34, 8, "Objets de quête", "#e0c070", [["sac_pommes", 1], ["magot_krik", 1], ["marmite", 1], ["louche", 1], ["corde", 1], ["poule_or", 1], ["clef", 1]]);

  // ---------- À droite de l'armurerie : le musée du mobilier et du décor ----------
  // Tous les meubles et décors du jeu qui ne sont pas déjà dans une salle, rangés en rangées (Thomas, 2026-11-14).
  line(123, 28, 126, 28);
  const museum: Room = { x: 127, y: 8, w: 31, h: 29 };
  addRoom(museum, "Mobilier et décor");
  torches.push({ x: 131, y: 7, radius: 9, faceX: 0, faceY: 1 }, { x: 142, y: 7, radius: 9, faceX: 0, faceY: 1 }, { x: 153, y: 7, radius: 9, faceX: 0, faceY: 1 });
  torches.push({ x: 131, y: 37, radius: 9, faceX: 0, faceY: -1 }, { x: 153, y: 37, radius: 9, faceX: 0, faceY: -1 });
  const used = new Set(furniture.map((f) => f.kind));
  // Pas les pièces d'assemblage (clôtures, rigoles, terre du pré), ni ce qui vit dans un mur ou ne sert qu'à une quête.
  const skip = /^(loot|anchor|sealedStairs|heroV9|soil|fence|gutter|drain|bloodGutter|bloodDrain|tapestry|barrelWall|hayWall|vitrail|ashes)/;
  const kinds = Object.keys(FURNITURE_KINDS).filter((k) => !used.has(k) && !skip.test(k) && !FURNITURE_KINDS[k].wall);
  let cx = museum.x + 1;
  let cy = museum.y + 2;
  let rowH = 1;
  for (const kind of kinds) {
    const def = FURNITURE_KINDS[kind];
    if (cx + def.w > museum.x + museum.w - 1) {
      cx = museum.x + 1;
      cy += rowH + 2;
      rowH = 1;
    }
    if (cy + def.h > museum.y + museum.h - 1) break;
    furniture.push({ x: cx, y: cy, kind });
    if (def.blocks) for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) map.set(cx + dx, cy + dy, Tile.Furniture);
    rowH = Math.max(rowH, def.h);
    cx += def.w + 1;
  }

  // ---------- En bas à gauche : l'arène ----------
  line(92, 52, 92, 55);
  const arena: Room = { x: 82, y: 56, w: 21, h: 11 };
  const arenaIndex = addRoom(arena, "Arène");
  signs[signs.length - 1].x = 87;
  for (const [dx, dy] of [[5, 3], [15, 3], [5, 7], [15, 7]]) map.set(arena.x + dx, arena.y + dy, Tile.Pillar);
  torches.push({ x: 82, y: 55, radius: 8, faceX: 0, faceY: 1 }, { x: 102, y: 55, radius: 8, faceX: 0, faceY: 1 });
  furniture.push({ x: arena.x, y: arena.y + arena.h - 1, kind: "webBL" }, { x: arena.x + arena.w - 1, y: arena.y + arena.h - 1, kind: "webBR" });
  monsters.push(...ARENA_MONSTERS.map((m) => ({ ...m, x: arena.x + m.x, y: arena.y + m.y })));

  // ---------- En bas à droite : l'escalier du boss ----------
  line(106, 52, 106, 60);
  line(107, 60, 110, 60);
  const lair: Room = { x: 111, y: 56, w: 11, h: 9 };
  addRoom(lair, "Nichée de la Tisseuse ↓");
  const stairs = { x: 116, y: 60 };
  map.set(stairs.x, stairs.y, Tile.StairsDown);
  torches.push({ x: 112, y: 55, radius: 6, faceX: 0, faceY: 1 });
  furniture.push({ x: lair.x, y: lair.y, kind: "webTL" }, { x: lair.x + lair.w - 1, y: lair.y, kind: "webTR" });

  const fontaine = SPECIAL_ROOMS.find((k) => k.id === "fontaine") ?? SPECIAL_ROOMS[0];
  const tresor = SPECIAL_ROOMS.find((k) => k.id === "tresor") ?? SPECIAL_ROOMS[0];
  const gluck = rooms[gluckRoom];
  const krik = rooms[krikRoom];
  return {
    map,
    rooms,
    furniture,
    themes,
    motifs,
    start,
    merchant: { x: 102, y: 43, home: hub },
    stairs,
    torches,
    specials: [
      { room: fountainRoom, kind: fontaine },
      { room: chestRoom, kind: tresor },
    ],
    traps,
    secrets: [{ x: gluck.x + 5, y: gluck.y + gluck.h - 1, room: gluckRoom, item: "or", count: 12 }],
    ground,
    heroLevel: 4,
    monsters,
    npcs: {
      gluck: [{ x: gluck.x + 5, y: gluck.y + 4 }, { x: gluck.x + 4, y: gluck.y + 4 }],
      krik: [{ x: krik.x + 5, y: krik.y + 4 }, { x: krik.x + 4, y: krik.y + 4 }],
      fifrelin: [{ x: rooms[fifRoom].x + 5, y: rooms[fifRoom].y + 4 }, { x: rooms[fifRoom].x + 4, y: rooms[fifRoom].y + 4 }],
    },
    chicken: { room: lockedIndex, door: chickenDoor, at: { x: hall.x + 4, y: hall.y + 4 } },
    counter: { door: counterDoor, inside: counterInside },
    hollowStatue: true,
    signs,
    areas,
    hub: hubIndex,
    arena: arenaIndex,
  };
}

/** Les monstres de l'arène (cases comptées depuis son coin en haut à gauche) : un de chaque sorte. */
export const ARENA_MONSTERS: SandboxMonster[] = [
  { x: 3, y: 5, asleep: false, patrol: true },
  { x: 10, y: 2, asleep: true },
  { x: 17, y: 5, asleep: false, patrol: true, monster: "frondeur" },
  { x: 10, y: 8, asleep: false, patrol: true, monster: "araignee" },
];
