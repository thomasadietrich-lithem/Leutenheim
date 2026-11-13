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
export const LOOT: Record<Rarity, { item: ItemId | "gold"; count?: [number, number]; minDepth?: number; odds?: number; orElse?: ItemId }[]> = {
  // Cuisse de poulet (Thomas, 2026-11-13 : « commune, un peu moins que les pommes mais fréquente ») : 8 fois sur 10 quand
  // elle sort, sinon une pomme.
  common: [{ item: "fleche", count: [2, 5] }, { item: "torche" }, { item: "pomme" }, { item: "cuisse_poulet", odds: 0.8, orElse: "pomme" }, { item: "gold" }, { item: "couteau_boucher", minDepth: 2 }, { item: "casque_cuir" }, { item: "armure_cuir", minDepth: 2 }],
  uncommon: [
    { item: "fleche_poison", count: [2, 4] }, { item: "gold" }, { item: "epee_longue" }, { item: "lance" },
    { item: "amethyste" }, { item: "masse", minDepth: 2 }, { item: "sac_cuir", minDepth: 5 }, { item: "casque_maille", minDepth: 3 }, { item: "armure_cloutee", minDepth: 2 }, { item: "cotte_mailles", minDepth: 3 },
    { item: "javeline", count: [3, 3], minDepth: 3 }, { item: "arc_puissant", minDepth: 5 }, { item: "potion_poison" }, { item: "potion_vitesse" }, { item: "potion_feu" },
    { item: "potion_brouillard" }, { item: "potion_oursin" }, { item: "potion_pierre", minDepth: 2 }, { item: "potion_discorde", minDepth: 2 }, { item: "flute_pan", minDepth: 2 },
  ],
  rare: [
    { item: "gold" }, { item: "cimeterre" }, { item: "harnois", minDepth: 5 }, { item: "saphir" }, { item: "potion_jouvence" },
    { item: "emeraude", minDepth: 6 }, { item: "diamant", minDepth: 11 }, { item: "sac_voyage", minDepth: 6 },
    { item: "oeil_chauve_souris" },
    { item: "outils_voleur", minDepth: 2 },
    // Très rare : une fois sur cinq quand il sort, sinon un gros tas d'or.
    { item: "noeud_papillon", minDepth: 3, odds: 0.2 },
  ],
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

/**
 * Garanties de la première section (Thomas, 2026-11-11) : au moins une pomme à l'étage 1, au moins deux équipements,
 * une pierre précieuse et une potion entre les étages 1 et 5. L'étage de chacune est tiré au début de la partie.
 */
export const SECTION_GUARANTEES: { what: "pomme" | "equipment" | "gem" | "potion" | "fleches"; count: number; floors: [number, number] }[] = [
  // Deux pommes à l'étage 1 (Thomas, 2026-11-13 : étage 1 plus doux ; une avant).
  { what: "pomme", count: 2, floors: [1, 1] },
  // Thomas : 10 flèches dans la première section, en un lot ou en trois (tiré au début de la partie).
  { what: "fleches", count: 1, floors: [1, 4] },
  { what: "equipment", count: 2, floors: [1, 4] },
  { what: "gem", count: 1, floors: [1, 4] },
  { what: "potion", count: 1, floors: [1, 4] },
];
