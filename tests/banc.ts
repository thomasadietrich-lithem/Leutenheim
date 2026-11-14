import { Rng } from "../src/core/rng";
import { furnishAlchemist, furnishBath, furnishChapel, furnishDortoir, furnishForge, furnishKitchen, furnishTorture, Furniture, RoomTheme } from "../src/world/furnish";
import { LightSource } from "../src/world/fov";
import { Floor, Room } from "../src/world/generator";
import { SPECIAL_ROOMS } from "../src/data/specialRooms";
import { GameMap, Tile } from "../src/world/map";
import type { SandboxFloor } from "../src/world/sandbox";

/**
 * BANC D'ESSAI DES TESTS : l'ancienne salle d'essai (plan 20, 52 × 32), gardée telle quelle pour les tests de mécanique
 * qui comptent sur ses cases (pousser contre ce mur, ce Schrat endormi, etc.). La vraie salle d'essai du jeu est
 * `src/world/sandbox.ts` (Thomas, 2026-11-14 : le hub et ses six directions).
 */
export function buildBanc(): SandboxFloor {
  const seeds = { kitchen: 30, chapel: 7, torture: 33, forge: 30, alchemist: 28 };
  const map = new GameMap(52, 32);
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
  // Un second escalier, dans le coin de la salle de départ (Thomas : « l'étage du boss sous l'étage 1 ») : comme celui
  // de la salle de combat, il descend à l'étage 2 de la salle d'essai, la nichée de la Tisseuse.
  map.set(11, 9, Tile.StairsDown);

  const torches: LightSource[] = [
    { x: 7, y: 2, radius: 6, faceX: 0, faceY: 1 },
    { x: 21, y: 2, radius: 5, faceX: 0, faceY: 1, hearth: true, lit: true },
    // Une torche sur le mur de droite de la cuisine, de la salle de prière et de la salle de torture.
    { x: 38, y: 5, radius: 6, faceX: -1, faceY: 0 },
    { x: 38, y: 16, radius: 6, faceX: -1, faceY: 0 },
    { x: 38, y: 26, radius: 6, faceX: -1, faceY: 0 },
    { x: 50, y: 5, radius: 6, faceX: -1, faceY: 0 },
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
  // Le placard du Kobold qui compte (Thomas, 2026-11-12) : au bout du couloir du dortoir, une porte (13, 28) et une case
  // derrière (13, 29). La porte est verrouillée par la partie (voir `Game.placeCounterDoor`).
  map.set(13, 28, Tile.DoorClosed);
  map.set(13, 29, Tile.Floor);
  // Antre de l'araignée (2026-11-11) : au sud de la salle de combat, sans torche, des toiles dans trois coins.
  const den: Room = { x: 17, y: 23, w: 9, h: 6 };
  carve(den);
  for (let y = 20; y <= 22; y++) map.set(21, y, Tile.Floor);
  // Nouvelles salles à thème (2026-11-11), à l'est : CUISINE (par la salle des colonnes), SALLE DE PRIÈRE (par la salle
  // de combat), SALLE DE TORTURE (par l'antre de l'araignée).
  const kitchen: Room = { x: 29, y: 3, w: 9, h: 6 };
  const chapel: Room = { x: 29, y: 12, w: 9, h: 8 };
  const torture: Room = { x: 29, y: 23, w: 9, h: 6 };
  for (const r of [kitchen, chapel, torture]) carve(r);
  for (const y of [6, 16, 25]) for (let x = 26; x <= 28; x++) map.set(x, y, Tile.Floor);
  // Plus à l'est encore (2026-11-11) : la FORGE (par la cuisine) et l'ALCHIMISTE (par la salle de prière).
  const forgeRoom: Room = { x: 41, y: 3, w: 9, h: 6 };
  const alchemy: Room = { x: 41, y: 12, w: 9, h: 8 };
  for (const r of [forgeRoom, alchemy]) carve(r);
  for (let x = 38; x <= 40; x++) {
    map.set(x, 7, Tile.Floor);
    map.set(x, 13, Tile.Floor);
  }
  // Salle de bain du Kobold (Thomas, 2026-11-13) : 5 × 4 cases, à l'est de la salle de torture.
  const bathRoom: Room = { x: 41, y: 24, w: 5, h: 4 };
  carve(bathRoom);
  for (let x = 38; x <= 40; x++) map.set(x, 25, Tile.Floor);
  map.set(40, 25, Tile.DoorClosed);
  // La salle du poulet (Thomas, 2026-11-13) : derrière la salle de bain, porte qu'on ne peut pas forcer ; le poulet
  // attend dans la salle de départ (voir `Game.placeChicken`).
  const chickenRoom: Room = { x: 47, y: 24, w: 4, h: 5 };
  carve(chickenRoom);
  map.set(46, 26, Tile.DoorClosed);
  const rooms = [start, pillars, combat, patrolRoom, dortoir, den, kitchen, chapel, torture, forgeRoom, alchemy, bathRoom, chickenRoom];
  const floorPlan: Floor = { map, rooms, start: { x: 7, y: 6 }, stairs, torches, specials: [] };
  const furniture: Furniture[] = [];
  furnishDortoir(floorPlan, dortoir, new Rng(1), furniture);
  // Graines choisies pour que chaque salle montre tout : deux jambons, une barrique ; bancs cassés, candélabres ; deux
  // sarcophages, cordes.
  furnishKitchen(floorPlan, kitchen, new Rng(seeds.kitchen), furniture);
  furnishChapel(floorPlan, chapel, new Rng(seeds.chapel), furniture);
  furnishTorture(floorPlan, torture, new Rng(seeds.torture), furniture);
  furnishForge(floorPlan, forgeRoom, new Rng(seeds.forge), furniture);
  furnishAlchemist(floorPlan, alchemy, new Rng(seeds.alchemist), furniture);
  furnishBath(floorPlan, bathRoom, new Rng(2), furniture);
  const themes: RoomTheme[] = [
    { room: 4, id: "dortoir" },
    { room: 6, id: "cuisine" },
    { room: 7, id: "priere" },
    { room: 8, id: "torture" },
    { room: 9, id: "forge" },
    { room: 10, id: "alchimiste" },
    { room: 11, id: "bain" },
  ];
  // Toiles de l'antre, et des trainards (tonneau, caisses) contre le mur gauche de la salle des colonnes.
  furniture.push({ x: 17, y: 23, kind: "webTL" }, { x: 25, y: 23, kind: "webTR" }, { x: 25, y: 28, kind: "webBR" });
  // La cloche d'alarme (Thomas, 2026-11-12), dans la salle de départ, à gauche du héros.
  for (const f of [{ x: 17, y: 8, kind: "barrel" }, { x: 17, y: 9, kind: "crateStack" }, { x: 17, y: 28, kind: "crate" }, { x: 5, y: 6, kind: "bell" }]) {
    furniture.push(f);
    map.set(f.x, f.y, Tile.Furniture);
  }
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
    // Le Colporteur (Thomas, 2026-11-12 : « ajoute le marchand dans l'étage test ») flâne dans la salle de départ.
    merchant: { x: 9, y: 5, home: start },
    stairs,
    torches: floorPlan.torches,
    specials: [
      { room: fountainRoom, kind: fontaine },
      { room: chestRoom, kind: tresor },
    ],
    // Les quatre pièges v3 : pointes (colonnes), gaz (salle de combat), fosse CACHÉE (salle de ronde : une fouille la
    // révèle), aiguille (antre).
    traps: [
      { x: 21, y: 6, kind: "spikes" },
      { x: 21, y: 17, kind: "gas" },
      { x: 9, y: 20, kind: "pit", hidden: true },
      { x: 22, y: 25, kind: "needle" },
    ],
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
      // Armes v4 (2026-11-11) : couteau de boucher, arc puissant (Lv5), javelines (à lancer depuis le carquois).
      { x: 4, y: 9, item: "couteau_boucher", count: 1 },
      { x: 6, y: 9, item: "arc_puissant", count: 1 },
      { x: 8, y: 9, item: "javeline", count: 3 },
      // Casques (2026-11-11) : de cuir (+1 CA) et de maille (+2 CA, niveau 3).
      { x: 3, y: 8, item: "casque_cuir", count: 1 },
      { x: 3, y: 9, item: "casque_maille", count: 1 },
      // Armures en paliers (Thomas, 2026-11-12) : cotte de mailles (CA 16, niveau 3, bruyante) et harnois (CA 17, niveau 5).
      { x: 5, y: 7, item: "cotte_mailles", count: 1 },
      { x: 10, y: 9, item: "harnois", count: 1 },
      // Thomas, 2026-11-12 (soir) : potions de brouillard et d'oursin, bibelots (œil de chauve-souris, flûte de pan).
      { x: 5, y: 4, item: "potion_brouillard", count: 2 },
      { x: 7, y: 4, item: "potion_oursin", count: 1 },
      { x: 10, y: 4, item: "oeil_chauve_souris", count: 1 },
      { x: 11, y: 4, item: "flute_pan", count: 1 },
      // Nœud papillon de Kobold (Thomas, 2026-11-13 : +8 Charisme, très rare).
      { x: 3, y: 4, item: "noeud_papillon", count: 1 },
      // Potions de pierre et de discorde (Thomas, 2026-11-13).
      { x: 3, y: 5, item: "potion_pierre", count: 2 },
      { x: 4, y: 5, item: "potion_discorde", count: 2 },
      // Potions de géant et glissante (Thomas, 2026-11-13).
      { x: 5, y: 5, item: "potion_geant", count: 2 },
      { x: 6, y: 5, item: "potion_glissante", count: 2 },
      // Outils de voleur (Thomas, 2026-11-13 : le crochetage réussit à coup sûr).
      { x: 11, y: 5, item: "outils_voleur", count: 1 },
    ],
    // Les places fixes de l'ancien plan (les tests en dépendent).
    npcs: { gluck: [{ x: 20, y: 5 }, { x: 21, y: 5 }, { x: 20, y: 6 }, { x: 22, y: 6 }] },
    chicken: { room: 12, door: { x: 46, y: 26 }, at: { x: 7, y: 8 } },
    counter: { door: { x: 13, y: 28 }, inside: { x: 13, y: 29 } },
    heroLevel: 4,
    monsters: [
      { x: 24, y: 6, asleep: false, patrol: true },
      { x: 7, y: 20, asleep: false, patrol: true },
      { x: 25, y: 16, asleep: false },
      { x: 18, y: 18, asleep: true },
      { x: 22, y: 26, asleep: false, patrol: true, monster: "araignee" },
      // Kobold frondeur (2026-11-11) : dans la salle de combat, il tire de loin et recule derrière les colonnes.
      { x: 19, y: 15, asleep: false, patrol: true, monster: "frondeur" },
    ],
  };
}
