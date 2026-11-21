import type { Enigma } from "../core/floor";
import { FURNITURE_KINDS } from "../data/themedRooms";
import type { Furniture } from "./furnish";
import type { LightSource } from "./fov";
import { GameMap, Point, Tile } from "./map";
import type { Room } from "./generator";
import type { SandboxFloor, SandboxSign } from "./sandbox";
import type { Trap } from "../core/floor";

/**
 * ZONE D'ESSAI DES SALLES À ÉNIGME (Thomas, 2026-11-21 : « fais une zone d'essai spéciale pour toutes ces salles ») :
 * un HUB où sont posés les objets qui résolvent les énigmes (flèches de recul et ricochantes, torches, potions de feu,
 * de gel, de géant, de brouillard, un arc), puis un long couloir vers la droite, et les sept salles au-dessus de lui,
 * dans l'ordre de la planche `art/salles_enigme_v1.png` : tir, rebond, racines, glisse, balance, salle noire, gardiens.
 * Chacune a sa clef d'argent et son coffre d'argent. Revenir dans le HUB remet tout à neuf.
 */
export function buildSandboxEnigme(): SandboxFloor {
  const map = new GameMap(102, 30);
  const rooms: Room[] = [];
  const signs: SandboxSign[] = [];
  const torches: LightSource[] = [];
  const furniture: Furniture[] = [];
  const ground: SandboxFloor["ground"] = [];
  const traps: Trap[] = [];
  const enigmas: Enigma[] = [];
  const carve = (r: Room) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map.set(x, y, Tile.Floor);
  };
  const addRoom = (r: Room, name?: string) => {
    carve(r);
    rooms.push(r);
    if (name) signs.push({ x: r.x + Math.floor(r.w / 2), y: r.y - 1, text: name });
    return rooms.length - 1;
  };
  const put = (x: number, y: number, kind: string) => {
    furniture.push({ x, y, kind });
    if (FURNITURE_KINDS[kind]?.blocks) map.set(x, y, Tile.Furniture);
  };
  const torch = (r: Room, dx = 2) => torches.push({ x: r.x + dx, y: r.y - 1, radius: 6, faceX: 0, faceY: 1, area: { x: r.x, y: r.y, w: r.w, h: r.h } });
  const chest = (p: Point) => map.set(p.x, p.y, Tile.Chest);
  const door = (x: number, y: number) => map.set(x, y, Tile.DoorClosed);

  // ---------- Le HUB : les objets des énigmes ----------
  const hub: Room = { x: 3, y: 15, w: 14, h: 9 };
  const hubIndex = addRoom(hub, "Salles à énigme");
  torch(hub, 3);
  torch(hub, 10);
  const start = { x: 6, y: 19 };
  const items: [number, number, SandboxFloor["ground"][number]["item"], number][] = [
    [5, 16, "fleche_recul", 6], [7, 16, "fleche_ricochet", 6], [9, 16, "arc_court", 1],
    [11, 16, "torche", 2], [13, 16, "potion_feu", 2], [5, 22, "potion_gel", 2],
    [7, 22, "potion_geant", 2], [9, 22, "potion_brouillard", 2], [11, 22, "fleche", 10],
  ];
  for (const [x, y, item, count] of items) ground.push({ x, y, item, count });
  // Un escalier, pour l'aller-retour (il ne mène nulle part d'important).
  const stairs = { x: 15, y: 22 };
  map.set(stairs.x, stairs.y, Tile.StairsDown);

  // Le couloir, sous les sept salles.
  for (let x = 17; x <= 97; x++) for (const y of [19, 20]) map.set(x, y, Tile.Floor);

  // ---------- 1. Salle de tir ----------
  {
    const r: Room = { x: 19, y: 10, w: 9, h: 8 };
    addRoom(r, "1. Salle de tir");
    torch(r, 1);
    door(23, 18);
    const row = r.y + 2;
    ["cible", "barriere", "cible", "barriere", "cibleBleue", "barriere", "cible", "barriere", "cible"].forEach((k, i) => put(r.x + i, row, k));
    for (const x of [r.x + 1, r.x + 3, r.x + 5, r.x + 7]) for (let y = row + 1; y <= r.y + 5; y++) put(x, y, "piste");
    for (let x = r.x; x < r.x + r.w; x++) put(x, r.y + 6, "ligneTir");
    const c = { x: 23, y: r.y };
    chest(c);
    enigmas.push({ kind: "tir", room: { ...r }, key: { x: 21, y: r.y }, keyShown: true, chest: c });
  }

  // ---------- 2. Salle de rebond (en long ; une cible une rangée sur deux, gauche, droite, gauche) ----------
  {
    const r: Room = { x: 30, y: 8, w: 7, h: 10 };
    addRoom(r, "2. Salle de rebond");
    torch(r, 5);
    door(33, 18);
    put(r.x, r.y + 2, "cibleNoireG");
    put(r.x + r.w - 1, r.y + 4, "cibleNoireD");
    put(r.x, r.y + 6, "cibleNoireG");
    for (let x = r.x; x < r.x + r.w; x++) put(x, r.y + 8, "ligneTir");
    const c = { x: 33, y: r.y };
    chest(c);
    enigmas.push({ kind: "rebond", room: { ...r }, key: { x: 31, y: r.y }, keyShown: false, chest: c, struck: [] });
  }

  // ---------- 3. Salle des racines (une seule haie ; deux alcôves derrière) ----------
  {
    const r: Room = { x: 39, y: 14, w: 9, h: 4 };
    addRoom(r, "3. Salle des racines");
    signs[signs.length - 1].y = 10;
    addRoom({ x: 40, y: 11, w: 3, h: 3 });
    addRoom({ x: 44, y: 11, w: 3, h: 3 });
    torch(r, 0);
    door(43, 18);
    for (let x = r.x; x < r.x + r.w; x++) put(x, r.y, "racines");
    const c = { x: 41, y: 11 };
    chest(c);
    enigmas.push({ kind: "racines", room: { x: 39, y: 11, w: 9, h: 7 }, key: { x: 45, y: 11 }, keyShown: true, chest: c });
  }

  // ---------- 4. Salle de glisse (eau profonde) ----------
  {
    const r: Room = { x: 50, y: 9, w: 9, h: 9 };
    addRoom(r, "4. Salle de glisse");
    torch(r, 1);
    door(54, 18);
    for (let x = r.x; x < r.x + r.w; x++) for (const y of [r.y + 2, r.y + 3]) put(x, y, "eauProfonde");
    const c = { x: 54, y: r.y };
    chest(c);
    enigmas.push({ kind: "glisse", room: { ...r }, key: { x: 51, y: r.y }, keyShown: true, chest: c });
  }

  // ---------- 5. Salle de la balance (grande dalle, herse sur l'alcôve de la clef) ----------
  {
    const r: Room = { x: 61, y: 13, w: 9, h: 5 };
    addRoom(r, "5. Salle de la balance");
    signs[signs.length - 1].y = 9;
    addRoom({ x: 64, y: 10, w: 3, h: 2 });
    torch(r, 1);
    door(65, 18);
    const gate = { x: 65, y: 12 };
    map.set(gate.x, gate.y, Tile.Floor);
    put(gate.x, gate.y, "herse");
    const plate = { x: 64, y: 15 };
    put(plate.x, plate.y, "dalleGeant");
    const c = { x: 62, y: 13 };
    chest(c);
    enigmas.push({ kind: "balance", room: { x: 61, y: 10, w: 9, h: 8 }, key: { x: 65, y: 10 }, keyShown: true, chest: c, gate, plate });
  }

  // ---------- 6. Salle noire (aucune lumière ; pièges cachés, un chemin sûr marqué à la craie) ----------
  {
    const r: Room = { x: 72, y: 11, w: 9, h: 7 };
    addRoom(r, "6. Salle noire");
    door(76, 18);
    const safe: Point[] = [[76, 17], [76, 16], [77, 15], [78, 14], [79, 13], [79, 12], [78, 12], [77, 12], [76, 12], [76, 11]].map(([x, y]) => ({ x, y }));
    const c = { x: 76, y: 11 };
    chest(c);
    const key = { x: 79, y: 12 };
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        if (safe.some((p) => p.x === x && p.y === y) || (x === c.x && y === c.y)) continue;
        // Des pièges cachés « partout » : à peu près une case sur deux hors du chemin sûr.
        if ((x * 7 + y * 3) % 5 < 3) traps.push({ x, y, kind: (x + y) % 3 === 0 ? "pit" : "spikes", hidden: true });
      }
    enigmas.push({ kind: "noire", room: { ...r }, key, keyShown: true, chest: c, safe });
  }

  // ---------- 7. Salle des gardiens (deux statues regardent deux rangées ; la herse tombe si l'on est vu) ----------
  {
    const r: Room = { x: 83, y: 12, w: 9, h: 6 };
    addRoom(r, "7. Salle des gardiens");
    signs[signs.length - 1].y = 8;
    addRoom({ x: 86, y: 9, w: 3, h: 2 });
    torch(r, 1);
    torch(r, 7);
    door(87, 18);
    const gate = { x: 87, y: 11 };
    map.set(gate.x, gate.y, Tile.Floor);
    put(gate.x, gate.y, "herseUp");
    put(r.x, r.y + 2, "gardien");
    put(r.x + r.w - 1, r.y + 4, "gardien");
    const gazes = [
      Array.from({ length: r.w - 1 }, (_, i) => ({ x: r.x + 1 + i, y: r.y + 2 })),
      Array.from({ length: r.w - 1 }, (_, i) => ({ x: r.x + i, y: r.y + 4 })),
    ];
    const c = { x: 84, y: r.y };
    chest(c);
    enigmas.push({ kind: "gardiens", room: { x: 83, y: 9, w: 9, h: 9 }, key: { x: 87, y: 9 }, keyShown: true, chest: c, gate, gazes });
  }

  for (const e of enigmas) if (e.keyShown) ground.push({ x: e.key.x, y: e.key.y, item: "clef_argent", count: 1 });

  return {
    map,
    rooms,
    furniture,
    themes: [],
    motifs: [],
    start,
    merchant: { x: 14, y: 17, home: hub },
    stairs,
    torches,
    specials: [],
    traps,
    secrets: [],
    ground,
    // Niveau 6 : la flèche ricochante le demande.
    heroLevel: 6,
    monsters: [],
    signs,
    areas: [],
    hub: hubIndex,
    enigmas,
    plain: true,
  };
}
