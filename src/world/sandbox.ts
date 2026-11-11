import { ItemId } from "../data/items";
import { Rng } from "../core/rng";
import { furnishDortoir, Furniture, RoomTheme } from "./furnish";
import { Motif } from "./grounds";
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
 * - du gravier dans le couloir entre la salle des colonnes et la salle de combat, une flaque dans la salle de ronde ;
 * - au sud de la salle de ronde, par un couloir, le DORTOIR des Schrats (lits superposés, cheminée, table, chaises, tapis),
 *   avec une cache au pied d'un lit.
 */
export interface SandboxFloor extends Floor {
  traps: Point[];
  /** Caches à fouiller : leur salle (numéro dans `rooms`), ce qu'elles contiennent. */
  secrets: { x: number; y: number; room: number; item: ItemId; count: number }[];
  furniture: Furniture[];
  themes: RoomTheme[];
  motifs: Motif[];
  ground: { x: number; y: number; item: ItemId; count: number }[];
  /** Niveau du héros en arrivant (pour essayer les objets qui demandent un niveau). */
  heroLevel: number;
  /** `patrol` : il fait les cent pas dans sa salle au lieu de se promener dans tout l'étage. */
  monsters: { x: number; y: number; asleep: boolean; patrol?: boolean }[];
}

/** Version du plan : à augmenter quand on le change, pour qu'une ancienne salle d'essai sauvegardée ne soit pas reprise. */
export const SANDBOX_LAYOUT = 7;

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

  // Sols spéciaux (2026-11-11) : gravier dans le couloir colonnes → combat (et un peu autour), flaque dans la salle de ronde.
  for (const [x, y] of [[21, 10], [21, 11], [21, 12], [20, 9], [21, 9], [22, 9]]) map.set(x, y, Tile.Gravel);
  for (const [x, y] of [[5, 20], [6, 20], [6, 21], [5, 21]]) map.set(x, y, Tile.Water);

  // Dortoir des Schrats (2026-11-11) : 9 × 6 cases au sud de la salle de ronde, entrée par le mur de droite.
  const dortoir: Room = { x: 3, y: 24, w: 9, h: 6 };
  carve(dortoir);
  for (let y = 20; y <= 27; y++) map.set(13, y, Tile.Floor);
  map.set(12, 27, Tile.Floor);
  const rooms = [start, pillars, combat, patrolRoom, dortoir];
  const floorPlan: Floor = { map, rooms, start: { x: 7, y: 6 }, stairs, torches, specials: [] };
  const furniture: Furniture[] = [];
  furnishDortoir(floorPlan, dortoir, new Rng(1), furniture);
  const themes: RoomTheme[] = [{ room: 4, id: "dortoir" }];
  // La cache, au pied du premier lit.
  const firstBunk = furniture.find((f) => f.kind.startsWith("bunk"));
  const secrets: SandboxFloor["secrets"] = [{ x: 22, y: 8, room: 1, item: "or", count: 12 }];
  if (firstBunk) secrets.push({ x: firstBunk.x, y: firstBunk.y + 1, room: 4, item: "or", count: 14 });

  return {
    map,
    rooms,
    furniture,
    themes,
    // Motifs gravés (validés le 2026-11-11) : runes dans la salle de départ, rose des vents et rosace dans la salle de
    // combat, croix et spirale dans la salle de ronde.
    motifs: [
      { x: 4, y: 6, kind: "runes" },
      { x: 22, y: 14, kind: "boussole" },
      { x: 18, y: 15, kind: "rosace" },
      { x: 9, y: 20, kind: "croix" },
      { x: 10, y: 19, kind: "spirale" },
    ],
    start: { x: 7, y: 6 },
    stairs,
    torches: floorPlan.torches,
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
