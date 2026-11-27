import type { FloorState } from "../core/floor";
import { FURNITURE_KINDS } from "../data/themedRooms";
import type { Furniture } from "./furnish";
import type { LightSource } from "./fov";
import { GameMap, Tile } from "./map";
import type { Room } from "./generator";
import type { SandboxFloor, SandboxMonster, SandboxSign } from "./sandbox";
import type { Floor } from "./generator";
import type { RoomTheme } from "./furnish";
import { Rng } from "../core/rng";
import { furnishBall, furnishCemetery, furnishEmbalming, furnishSporeKitchen } from "./nuit";

/**
 * ZONE D'ESSAI DES SALLES SPÉCIALES (Thomas, 2026-11-26 : « implémente les salles spéciales en test ») : un HUB (de l'or
 * et de quoi manger pour les essais), un long couloir, et les six salles proposées le 25/11 au-dessus de lui :
 * le puits aux vœux, l'autel du Poulet, la salle des miroirs, le garde-manger des Myconides, l'atelier du cartographe,
 * la crypte aux trois cierges. En essai seulement : elles ne sont pas encore dans le donjon.
 */
export function buildSandboxSpeciales(): SandboxFloor {
  const map = new GameMap(90, 30);
  const rooms: Room[] = [];
  const signs: SandboxSign[] = [];
  const torches: LightSource[] = [];
  const furniture: Furniture[] = [];
  const ground: SandboxFloor["ground"] = [];
  const monsters: SandboxMonster[] = [];
  const addRoom = (r: Room, name?: string) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map.set(x, y, Tile.Floor);
    rooms.push(r);
    if (name) signs.push({ x: r.x + Math.floor(r.w / 2), y: r.y - 1, text: name });
    return rooms.length - 1;
  };
  const put = (x: number, y: number, kind: string, extra: Partial<Furniture> = {}) => {
    furniture.push({ x, y, kind, ...extra });
    if (FURNITURE_KINDS[kind]?.blocks) for (let k = 0; k < (FURNITURE_KINDS[kind]?.w ?? 1); k++) map.set(x + k, y, Tile.Furniture);
  };
  const torch = (r: Room, dx = 2) => torches.push({ x: r.x + dx, y: r.y - 1, radius: 6, faceX: 0, faceY: 1, area: { x: r.x, y: r.y, w: r.w, h: r.h } });

  // ---------- Le HUB ----------
  const hub: Room = { x: 3, y: 15, w: 14, h: 9 };
  const hubIndex = addRoom(hub, "Salles spéciales");
  torch(hub, 3);
  torch(hub, 10);
  const start = { x: 6, y: 19 };
  for (const [x, y, item, count] of [
    [5, 16, "or", 120], [7, 16, "omelette", 1], [9, 16, "cuisse_poulet", 2], [11, 16, "pomme", 3],
    [5, 22, "potion_jouvence", 1], [7, 22, "fleche", 10],
  ] as [number, number, SandboxFloor["ground"][number]["item"], number][]) ground.push({ x, y, item, count });
  const stairs = { x: 15, y: 22 };
  map.set(stairs.x, stairs.y, Tile.StairsDown);
  for (let x = 17; x <= 84; x++) for (const y of [19, 20]) map.set(x, y, Tile.Floor);

  const names = ["1. Puits aux vœux", "2. Autel du Poulet", "3. Salle des miroirs", "4. Garde-manger des Myconides", "5. Atelier du cartographe", "6. Crypte aux trois cierges"];
  const rs: Room[] = names.map((n, i) => {
    const r: Room = { x: 19 + i * 11, y: 10, w: 9, h: 8 };
    addRoom(r, n);
    torch(r, 1);
    map.set(r.x + 4, 18, Tile.DoorClosed);
    return r;
  });
  // 1. Le puits, au milieu.
  put(rs[0].x + 4, rs[0].y + 3, "puitsVoeux");
  // 2. L'autel du Poulet, contre le mur du fond, sous la tapisserie.
  put(rs[1].x + 4, rs[1].y + 1, "autelPoulet");
  put(rs[1].x + 2, rs[1].y - 1, "tapisserieCulte");
  // 3. Le grand miroir.
  put(rs[2].x + 4, rs[2].y + 1, "miroir");
  // 4. Le festin, et trois Myconides endormis autour.
  put(rs[3].x + 4, rs[3].y + 3, "champiFestin");
  for (const [dx, dy] of [[2, 3], [6, 3], [4, 5]]) monsters.push({ x: rs[3].x + dx, y: rs[3].y + dy, asleep: true, monster: "myconide" });
  // 5. La table du cartographe.
  put(rs[4].x + 4, rs[4].y + 3, "tableCarte");
  // 6. La crypte : trois cierges, le sarcophage, l'affiche qui donne l'ordre.
  const crypt = rs[5];
  const candles = [{ x: crypt.x + 2, y: crypt.y + 2 }, { x: crypt.x + 4, y: crypt.y + 2 }, { x: crypt.x + 6, y: crypt.y + 2 }];
  for (const c of candles) put(c.x, c.y, "ciergeCrypte");
  const sarco = { x: crypt.x + 3, y: crypt.y + 4 };
  put(sarco.x, sarco.y, "sarcophage");
  put(crypt.x + 1, crypt.y - 1, "afficheTexte", { note: "« Pour réveiller le gardien de la crypte : d'abord le cierge de droite, puis celui de gauche, celui du milieu en dernier. »" });
  const cryptState: NonNullable<FloorState["crypt"]> = { candles, order: [2, 0, 1], lit: [], sarco };

  // ---------- NUIT DU 27-28/11 : sous le couloir, le cimetière, l'embaumement, le bal macabre, la cuisine aux spores ----------
  const themes: RoomTheme[] = [];
  const night = ["7. Cimetière (Pelle-Creuse)", "8. Embaumement (Dame Bandelette)", "9. Bal macabre", "10. Cuisine aux spores (Boletus)"];
  const below: Room[] = night.map((n, i) => {
    const r: Room = { x: 19 + i * 15, y: 22, w: i === 2 ? 9 : 11, h: 7 };
    addRoom(r, undefined);
    signs.push({ x: r.x + Math.floor(r.w / 2), y: r.y + r.h, text: n });
    map.set(r.x + 4, 21, Tile.DoorClosed);
    return r;
  });
  const fl: Floor = { map, rooms, start, stairs, torches, specials: [] };
  const nrng = new Rng(0x9a17);
  if (furnishCemetery(fl, below[0], nrng, furniture)) themes.push({ room: rooms.indexOf(below[0]), id: "cimetiere" });
  if (furnishEmbalming(fl, below[1], nrng, furniture)) themes.push({ room: rooms.indexOf(below[1]), id: "embaumement" });
  const ball = furnishBall(fl, below[2], nrng, furniture);
  if (ball) themes.push({ room: rooms.indexOf(below[2]), id: "bal" });
  if (furnishSporeKitchen(fl, below[3], nrng, furniture)) themes.push({ room: rooms.indexOf(below[3]), id: "cuisineSpores" });
  for (const r of below) torches.push({ x: r.x + 2, y: r.y + r.h, radius: 6, faceX: 0, faceY: -1, area: { x: r.x, y: r.y, w: r.w, h: r.h } });
  ground.push({ x: 13, y: 22, item: "pelle", count: 1 }, { x: 11, y: 22, item: "soupe_boletus", count: 1 });

  return {
    map,
    rooms,
    furniture,
    themes,
    motifs: [],
    start,
    merchant: { x: 14, y: 17, home: hub },
    stairs,
    torches,
    specials: [],
    traps: [],
    secrets: [],
    ground,
    heroLevel: 4,
    monsters,
    signs,
    areas: [],
    hub: hubIndex,
    plain: true,
    crypt: cryptState,
    ball: ball ? { room: rooms.indexOf(below[2]), ...ball } : undefined,
    nightNpcs: true,
  };
}
