import { ItemId } from "../data/items";
import { THEMED_ROOMS } from "../data/themedRooms";
import { Rng } from "../core/rng";
import { furnishRoom, Furniture, RoomTheme } from "./furnish";
import { LightSource } from "./fov";
import { Floor, Room } from "./generator";
import { SPECIAL_ROOMS } from "../data/specialRooms";
import { GameMap, Point, Tile } from "./map";

/**
 * Salle d'essai : un étage dessiné à la main, toujours le même, qui rassemble les derniers éléments créés
 * pour les essayer sans les chercher dans un donjon tiré au hasard. À compléter à chaque nouveauté.
 *
 * Plan (intérieur des salles) :
 * - salle 0, départ : torche, clef, flèches et or au sol ;
 * - salle 1, « salle des colonnes » : quatre colonnes, une cheminée, une cache à fouiller, un piège, un Schrat endormi ;
 * - salle 2, « salle de combat » : un piège, un Schrat éveillé près d'un mur (pour pousser), un autre endormi, l'escalier ;
 * - deux salles spéciales verrouillées sous la salle de départ : fontaine et coffre ;
 * - sous la salle de ronde, une rangée de cinq salles de fouille (garde-manger, ossuaire, bibliothèque, dortoir,
 *   forge), chacune meublée avec une cache au pied d'un meuble.
 */
export interface SandboxFloor extends Floor {
  traps: Point[];
  /** Caches à fouiller : leur salle (numéro dans `rooms`), ce qu'elles contiennent. */
  secrets: { x: number; y: number; room: number; item: ItemId; count: number }[];
  furniture: Furniture[];
  themes: RoomTheme[];
  ground: { x: number; y: number; item: ItemId; count: number }[];
  /** Niveau du héros en arrivant (pour essayer les objets qui demandent un niveau). */
  heroLevel: number;
  /** `patrol` : il fait les cent pas dans sa salle au lieu de se promener dans tout l'étage. */
  monsters: { x: number; y: number; asleep: boolean; patrol?: boolean }[];
}

/** Version du plan : à augmenter quand on le change, pour qu'une ancienne salle d'essai sauvegardée ne soit pas reprise. */
export const SANDBOX_LAYOUT = 4;

export function buildSandbox(): SandboxFloor {
  const map = new GameMap(32, 32);
  const carve = (r: Room) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map.set(x, y, Tile.Floor);
  };
  const start: Room = { x: 3, y: 3, w: 9, h: 7 };
  const pillars: Room = { x: 17, y: 3, w: 9, h: 7 };
  const combat: Room = { x: 17, y: 14, w: 9, h: 6 };
  const fountainRoom: Room = { x: 3, y: 14, w: 3, h: 3 };
  const chestRoom: Room = { x: 9, y: 14, w: 3, h: 3 };
  // Salle de ronde (2026-11-11) : un Schrat y fait les cent pas, à l'ouest de la salle de combat.
  const patrolRoom: Room = { x: 3, y: 19, w: 9, h: 3 };
  for (const r of [start, pillars, combat, fountainRoom, chestRoom, patrolRoom]) carve(r);
  for (let x = 12; x <= 16; x++) map.set(x, 19, Tile.Floor);

  // Couloirs : départ → colonnes (avec une porte), colonnes → combat (passage ouvert), départ → salles spéciales.
  for (let x = 12; x <= 16; x++) map.set(x, 6, Tile.Floor);
  map.set(12, 6, Tile.DoorClosed);
  for (let y = 10; y <= 13; y++) map.set(21, y, Tile.Floor);
  for (let y = 10; y <= 12; y++) map.set(4, y, Tile.Floor);
  for (let y = 10; y <= 12; y++) map.set(10, y, Tile.Floor);
  map.set(4, 13, Tile.DoorLocked);
  map.set(10, 13, Tile.DoorLocked);

  // Colonnes aux coins intérieurs, fontaine, coffre, escalier.
  for (const p of [{ x: 18, y: 4 }, { x: 24, y: 4 }, { x: 18, y: 8 }, { x: 24, y: 8 }]) map.set(p.x, p.y, Tile.Pillar);
  map.set(4, 15, Tile.Fountain);
  map.set(10, 15, Tile.Chest);
  const stairs = { x: 24, y: 18 };
  map.set(stairs.x, stairs.y, Tile.StairsDown);

  const torches: LightSource[] = [
    { x: 7, y: 2, radius: 6, faceX: 0, faceY: 1 },
    { x: 21, y: 2, radius: 5, faceX: 0, faceY: 1, hearth: true, lit: true },
  ];
  const fontaine = SPECIAL_ROOMS.find((k) => k.id === "fontaine") ?? SPECIAL_ROOMS[0];
  const tresor = SPECIAL_ROOMS.find((k) => k.id === "tresor") ?? SPECIAL_ROOMS[0];

  // Salles de fouille (2026-11-11) : un couloir sous la salle de ronde, cinq salles de 5 × 5 en dessous.
  map.set(7, 22, Tile.Floor);
  for (let x = 4; x <= 28; x++) map.set(x, 23, Tile.Floor);
  const themedRooms: Room[] = [];
  for (let i = 0; i < THEMED_ROOMS.length; i++) {
    const r: Room = { x: 2 + i * 6, y: 25, w: 5, h: 5 };
    carve(r);
    map.set(r.x + 2, 24, Tile.Floor);
    themedRooms.push(r);
  }
  const rooms = [start, pillars, combat, patrolRoom, ...themedRooms];
  const floorPlan = { map, rooms, start: { x: 7, y: 6 }, stairs, torches: [] as LightSource[], specials: [] };
  const furniture: Furniture[] = [];
  const themes: RoomTheme[] = [];
  const secrets: SandboxFloor["secrets"] = [{ x: 22, y: 8, room: 1, item: "or", count: 12 }];
  // Une torche au mur du fond de chaque salle de fouille.
  for (const r of themedRooms) torches.push({ x: r.x + 2, y: r.y + r.h, radius: 4, faceX: 0, faceY: -1 });
  const rng = new Rng(4242);
  themedRooms.forEach((room, i) => {
    const theme = THEMED_ROOMS[i];
    const index = 4 + i;
    const first = furniture.length;
    furnishRoom(floorPlan, room, theme, rng, furniture);
    themes.push({ room: index, id: theme.id });
    // La cache, au pied du premier meuble (côté salle), avec le butin le plus courant du thème.
    const f = furniture[first];
    if (!f) return;
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => ({ x: f.x + dx, y: f.y + dy }))
      .find((p) => p.x >= room.x && p.x < room.x + room.w && p.y >= room.y && p.y < room.y + room.h && map.get(p.x, p.y) === Tile.Floor);
    const loot = theme.loot[0];
    if (spot) secrets.push({ x: spot.x, y: spot.y, room: index, item: loot.item, count: loot.max });
  });

  return {
    map,
    rooms,
    furniture,
    themes,
    start: { x: 7, y: 6 },
    stairs,
    torches,
    specials: [
      { room: fountainRoom, kind: fontaine },
      { room: chestRoom, kind: tresor },
    ],
    traps: [{ x: 21, y: 6 }, { x: 21, y: 17 }],
    secrets,
    ground: [
      { x: 5, y: 5, item: "clef", count: 1 },
      { x: 9, y: 7, item: "fleche", count: 3 },
      { x: 9, y: 4, item: "or", count: 5 },
      // Les nouveaux objets, dans la salle de départ (Thomas ne trouvait pas l'armurerie) :
      // en haut, ceux à utiliser ; en bas, les armes et l'armure ; à droite, les tas d'or moyen et gros.
      { x: 4, y: 4, item: "pomme", count: 2 },
      { x: 6, y: 4, item: "torche", count: 1 },
      { x: 8, y: 4, item: "fleche_poison", count: 6 },
      { x: 4, y: 8, item: "epee_longue", count: 1 },
      { x: 6, y: 8, item: "lance", count: 1 },
      { x: 8, y: 8, item: "cimeterre", count: 1 },
      { x: 10, y: 8, item: "armure_cloutee", count: 1 },
      { x: 10, y: 5, item: "or", count: 15 },
      { x: 10, y: 7, item: "or", count: 30 },
      // 2026-11-11 (après-midi) : gemmes et potions sur la rangée du haut, sacs à gauche et à droite.
      { x: 4, y: 3, item: "amethyste", count: 1 },
      { x: 5, y: 3, item: "saphir", count: 1 },
      { x: 6, y: 3, item: "emeraude", count: 1 },
      { x: 7, y: 3, item: "diamant", count: 1 },
      { x: 8, y: 3, item: "potion_jouvence", count: 1 },
      { x: 9, y: 3, item: "potion_poison", count: 1 },
      { x: 10, y: 3, item: "potion_vitesse", count: 1 },
      { x: 11, y: 3, item: "potion_feu", count: 2 },
      { x: 3, y: 6, item: "sac_cuir", count: 1 },
      { x: 11, y: 6, item: "sac_voyage", count: 1 },
    ],
    heroLevel: 4,
    monsters: [
      { x: 24, y: 6, asleep: false, patrol: true },
      { x: 7, y: 20, asleep: false, patrol: true },
      { x: 25, y: 16, asleep: false },
      { x: 18, y: 18, asleep: true },
    ],
  };
}
