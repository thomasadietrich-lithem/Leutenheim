import type { LightSource } from "./fov";
import type { Furniture } from "./furnish";
import { GameMap, Tile } from "./map";
import type { Room } from "./generator";
import type { SandboxFloor, SandboxMonster, SandboxSign } from "./sandbox";

/**
 * ZONE D'ESSAI DE LA SECTION 4, LE GOUFFRE (Thomas, 2026-11-27 : « dessine, et implémente cette nuit » ;
 * claude/BRIEF_SECTION4_ET_S3.md). Des ÎLOTS de roche au milieu du VIDE, reliés par des PASSERELLES à cordages :
 *  - le HUB (départ, de quoi essayer) ;
 *  - au nord, une passerelle avec une TROUÉE : deux Kobolds dessus, à pousser dans le vide ;
 *  - à l'est, une passerelle aux PLANCHES POURRIES (la première craque, la seconde cède) ;
 *  - au sud, le grand îlot des VESPÈRES (deux chauves-souris géantes qui piquent depuis le vide).
 */
export function buildSandboxGouffre(): SandboxFloor {
  const map = new GameMap(64, 44);
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) map.set(x, y, Tile.Chasm);
  const rooms: Room[] = [];
  const signs: SandboxSign[] = [];
  const torches: LightSource[] = [];
  const furniture: Furniture[] = [];
  const ground: SandboxFloor["ground"] = [];
  const monsters: SandboxMonster[] = [];
  const gaps: Record<string, true> = {};
  const rotten: Record<string, number> = {};
  const island = (r: Room, name: string) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map.set(x, y, Tile.Floor);
    rooms.push(r);
    signs.push({ x: r.x + Math.floor(r.w / 2), y: r.y, text: name });
    return r;
  };
  const bridge = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (map.get(x, y) === Tile.Chasm) map.set(x, y, Tile.Bridge);
  };
  // Des lanternes sur poteaux : une lumière posée au milieu de chaque îlot (pas de mur où accrocher une torche).
  // Sans mur, la lumière file au-dessus du vide : les passerelles et les bords des îlots sont éclairés.
  const lantern = (r: Room) => torches.push({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2), radius: 8, faceX: 0, faceY: 0, lantern: true });
  const post = (x: number, y: number) => torches.push({ x, y, radius: 5, faceX: 0, faceY: 0, lantern: true });

  const hub = island({ x: 26, y: 18, w: 12, h: 8 }, "Le Gouffre (aperçu)");
  lantern(hub);
  const start = { x: 31, y: 22 };
  for (const [x, y, item, count] of [[27, 19, "torche", 2], [29, 19, "fleche", 12], [33, 19, "pomme", 3], [35, 19, "potion_jouvence", 1]] as [number, number, SandboxFloor["ground"][number]["item"], number][]) ground.push({ x, y, item, count });
  ground.push({ x: 27, y: 24, item: "arc_court", count: 1 });

  // Nord : la passerelle à la trouée (deux Kobolds dessus).
  const north = island({ x: 27, y: 2, w: 10, h: 6 }, "Trouée : poussez !");
  lantern(north);
  bridge(31, 8, 31, 17);
  gaps["31,12"] = true;
  gaps["31,13"] = true;
  monsters.push({ x: 31, y: 12, asleep: false, monster: "schrat" }, { x: 31, y: 10, asleep: true, monster: "schrat" });
  post(31, 12);

  // Est : la passerelle aux planches pourries, longue, vers un îlot au trésor.
  const east = island({ x: 52, y: 18, w: 9, h: 8 }, "Planches pourries");
  lantern(east);
  bridge(38, 21, 51, 21);
  for (const x of [42, 46, 49]) rotten[`${x},21`] = 0;
  post(44, 21);
  post(46, 30);
  ground.push({ x: 56, y: 22, item: "potion_geant", count: 1 }, { x: 55, y: 20, item: "or", count: 30 });
  // Un second chemin, sûr mais long, par le sud-est.
  bridge(37, 25, 37, 30);
  bridge(37, 30, 56, 30);
  bridge(56, 26, 56, 30);

  // Sud-ouest : l'îlot des Vespères.
  const south = island({ x: 6, y: 30, w: 14, h: 10 }, "Les Vespères");
  lantern(south);
  bridge(20, 34, 25, 34);
  bridge(25, 26, 25, 34);
  gaps["22,34"] = true;
  post(25, 30);
  monsters.push({ x: 4, y: 26, asleep: false, monster: "vespere" }, { x: 22, y: 38, asleep: false, monster: "vespere" });
  ground.push({ x: 12, y: 35, item: "or", count: 20 });

  const stairs = { x: 36, y: 24 };
  map.set(stairs.x, stairs.y, Tile.StairsDown);
  return {
    map,
    rooms,
    furniture,
    themes: [],
    motifs: [],
    start,
    merchant: { x: 36, y: 19, home: hub },
    stairs,
    torches,
    specials: [],
    traps: [],
    secrets: [],
    ground,
    heroLevel: 8,
    monsters,
    signs,
    areas: [],
    hub: 0,
    plain: true,
    gaps,
    rotten,
  };
}
