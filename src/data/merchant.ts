import { ItemDef, ITEMS, ItemId } from "./items";

/**
 * Le Colporteur, marchand itinérant louche (Thomas, 2026-11-11 ; planche art/marchand_v1.png). Pour l'instant
 * un par section, au 4e étage, et un dans la salle d'essai (Thomas, 2026-11-12).
 */
export const MERCHANT = {
  /** Un Colporteur par section, à son 4e étage (Thomas, 2026-11-12 : « un marchand par section, étage 4 »). */
  floorInSection: 4,
  /** Au palier d'alerte ALERTE (2) et au-delà, il quitte l'étage pour de bon (Thomas, 2026-11-12). */
  leaveAtAlarmStage: 2,
  /** Un monstre à cette distance (en cases) ou moins : il se cache (presque transparent, on le devine). */
  hideRadius: 6,
  /** Sa bulle (une pièce d'or) n'apparaît que si le héros est à cette distance ou moins. */
  bubbleRadius: 6,
  /** Il fait un pas tous les N tours (il flâne), et s'arrête quand le héros est à 2 cases ou moins. */
  stepEvery: 2,
  waitNearHero: 2,
  /** Il rachète au héros à cette part du prix (40 %), au moins 1 or. */
  buyBack: 0.4,
  /** Prix « louches » : chaque article vaut de −20 % à +20 % de son prix normal. */
  priceSwing: 0.2,
  /** Ce qu'il dit en ouvrant la boutique (une phrase au hasard). */
  lines: [
    "Pas d'questions, pas d'soucis…",
    "Tout est d'origine. Presque.",
    "Prix d'ami. Enfin… d'ami.",
    "Chut. Les murs ont des oreilles pointues.",
  ],
} as const;

/** Prix normal d'un exemplaire (C) : selon la rareté, quelques exceptions. */
const BY_RARITY = { common: 8, uncommon: 25, rare: 60 } as const;
const SPECIAL: Partial<Record<ItemId, number>> = {
  fleche: 1,
  fleche_poison: 3,
  javeline: 8,
  pomme: 4,
  torche: 5,
  potion_jouvence: 80,
  sac_cuir: 40,
  sac_voyage: 90,
};

/** Prix normal d'un exemplaire ; null si cela ne se vend pas (or, gemmes, clef). */
export function basePrice(id: ItemId): number | null {
  const def: ItemDef = ITEMS[id];
  if (def.kind === "gold" || def.kind === "gem" || def.kind === "key") return null;
  return SPECIAL[id] ?? (def.rarity ? BY_RARITY[def.rarity] : 4);
}

/** Ce que le Colporteur donne pour un exemplaire (40 %, au moins 1) ; null s'il n'en veut pas. */
export function buyBackPrice(id: ItemId): number | null {
  const p = basePrice(id);
  return p === null ? null : Math.max(1, Math.floor(p * MERCHANT.buyBack));
}

/** Les 4 articles de la salle d'essai (lot entier, prix pour le lot). */
export const SANDBOX_WARES: { item: ItemId; count: number }[] = [
  { item: "potion_feu", count: 1 },
  { item: "javeline", count: 3 },
  { item: "casque_maille", count: 1 },
  { item: "pomme", count: 2 },
];
