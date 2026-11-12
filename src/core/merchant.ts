import { ItemDef, ITEMS, ItemId } from "../data/items";
import { basePrice, MERCHANT } from "../data/merchant";
import { Room } from "../world/generator";
import { Point } from "../world/map";
import { lootPool } from "./floor";

/** Un article du Colporteur : le lot entier se vend d'un coup, à ce prix. */
export interface Ware {
  item: ItemId;
  count: number;
  price: number;
}

/** Le Colporteur sur son étage (gardé dans la sauvegarde). */
export interface Merchant {
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  /** Caché : un monstre est tout près ; il est presque invisible (on le devine), on ne peut pas lui parler. */
  hidden: boolean;
  wares: Ware[];
  /** La salle où il flâne. */
  home: Room;
  /** Case où il se rend. */
  target: Point | null;
  facing: "down" | "up" | "left" | "right";
}

/**
 * Hasard sans état, tiré de quelques nombres (tour, position) : le Colporteur ne touche pas au hasard des combats,
 * et une partie reprise refait exactement les mêmes choix.
 */
export function mix(a: number, b: number, c: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Le Colporteur et ses articles, prix « louches » (±20 %) compris. */
export function makeMerchant(at: Point, home: Room, list: { item: ItemId; count: number }[], seed: number): Merchant {
  const wares = list.map((w, i) => {
    const swing = 1 + (mix(seed, i, 77) * 2 - 1) * MERCHANT.priceSwing;
    return { ...w, price: Math.max(1, Math.round((basePrice(w.item) ?? 1) * w.count * swing)) };
  });
  return { x: at.x, y: at.y, fromX: at.x, fromY: at.y, hidden: false, wares, home, target: null, facing: "down" };
}

/**
 * Les 4 articles d'un Colporteur du donjon (C) : un objet à consommer, une arme ou une armure, des munitions, et un
 * objet plus rare ; tirés parmi ce que l'étage peut offrir.
 */
export function rollWares(depth: number, seed: number): { item: ItemId; count: number }[] {
  const out: { item: ItemId; count: number }[] = [];
  const pick = (pool: ItemId[], k: number): ItemId | null => {
    const free = pool.filter((id) => !out.some((w) => w.item === id));
    return free.length > 0 ? free[Math.floor(mix(seed, depth, k) * free.length)] : null;
  };
  const use = pick(lootPool(depth, (kind) => kind === "use"), 1);
  if (use) out.push({ item: use, count: (ITEMS[use] as ItemDef).heal ? 2 : 1 });
  const gear = pick(lootPool(depth, (kind) => ["melee", "ranged", "armor", "hat"].includes(kind)), 2);
  if (gear) out.push({ item: gear, count: 1 });
  const ammo = pick(lootPool(depth, (kind) => kind === "ammo"), 3) ?? "fleche";
  out.push({ item: ammo, count: ammo === "fleche" ? 10 : ammo === "javeline" ? 3 : 5 });
  const rare = pick(lootPool(depth, (kind) => kind !== "gem", "rare"), 4) ?? pick(lootPool(depth, (kind) => kind !== "gem", "uncommon"), 5);
  if (rare) out.push({ item: rare, count: 1 });
  return out;
}
