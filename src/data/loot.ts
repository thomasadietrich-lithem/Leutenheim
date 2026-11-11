import { ItemId, Rarity } from "./items";

/**
 * Butin trouvé au sol des salles (Thomas, 2026-11-11). Valeurs choisies par Claude, à confirmer.
 * Une section = 5 étages (1 à 5, 6 à 10, …) ; au-delà de la dernière ligne, on garde la dernière.
 */

/** Chances (en %) de chaque rareté, par section. */
export const RARITY_ODDS: Record<Rarity, number>[] = [
  { common: 75, uncommon: 22, rare: 3 },
  { common: 55, uncommon: 35, rare: 10 },
  { common: 40, uncommon: 40, rare: 20 },
];

/** Tas d'or : petit (commun), moyen (peu commun), gros (rare) ; or minimum et maximum, par section. Doublé à chaque section au-delà. */
export const GOLD_PILES: Record<"small" | "medium" | "large", [number, number]>[] = [
  { small: [3, 8], medium: [10, 20], large: [25, 40] },
  { small: [6, 15], medium: [20, 40], large: [50, 80] },
];

/** Ce qu'on peut trouver, par rareté. `count` : nombre d'exemplaires (min, max). */
export const LOOT: Record<Rarity, { item: ItemId | "gold"; count?: [number, number] }[]> = {
  common: [{ item: "fleche", count: [2, 5] }, { item: "torche" }, { item: "pomme" }, { item: "gold" }],
  uncommon: [{ item: "fleche_poison", count: [2, 4] }, { item: "gold" }, { item: "epee_longue" }, { item: "lance" }],
  rare: [{ item: "gold" }, { item: "cimeterre" }, { item: "armure_cloutee" }],
};

/** Taille du tas d'or selon la rareté tirée. */
export const GOLD_SIZE: Record<Rarity, "small" | "medium" | "large"> = { common: "small", uncommon: "medium", rare: "large" };

export function sectionOf(depth: number): number {
  return Math.floor((depth - 1) / 5);
}

/** Or minimum et maximum d'un tas, à cet étage. */
export function goldRange(depth: number, size: "small" | "medium" | "large"): [number, number] {
  const section = sectionOf(depth);
  const row = GOLD_PILES[Math.min(section, GOLD_PILES.length - 1)][size];
  const factor = 2 ** Math.max(0, section - (GOLD_PILES.length - 1));
  return [row[0] * factor, row[1] * factor];
}
