import { ItemId } from "./items";

/**
 * Bouton « Stuff » des outils de triche (Thomas, 2026-11-16 : « stuff faible, moyen, élevé, avec consommables
 * associés, rotation aléatoire »). Chaque emplacement donne une liste : on en tire un au hasard à chaque appui.
 * L'équipement est porté tout de suite (même si le niveau est trop bas) ; l'ancien disparaît.
 */
export type KitTier = "faible" | "moyen" | "eleve";

export interface TestKit {
  melee: ItemId[];
  armor: ItemId[];
  hat: ItemId[];
  ranged: ItemId[];
  amulet?: ItemId[];
  artifact?: ItemId[];
  bag: ItemId;
  /** Munitions : [objet, nombre], une ligne tirée au hasard. */
  ammo: [ItemId, number][][];
  /** Vivres : [objet, nombre], une ligne tirée au hasard. */
  food: [ItemId, number][][];
  /** Potions : combien, tirées au hasard dans la liste (une même potion peut sortir deux fois). */
  potions: { count: number; from: ItemId[] };
}

export const TEST_KITS: Record<KitTier, TestKit> = {
  faible: {
    melee: ["epee", "couteau_boucher", "masse"],
    armor: ["armure_cuir", "tunique"],
    hat: ["casque_cuir"],
    ranged: ["arc_court"],
    bag: "sac_toile",
    ammo: [[["fleche", 10]], [["fleche", 6], ["javeline", 3]]],
    food: [[["pomme", 3]], [["pomme", 1], ["cuisse_poulet", 1]]],
    potions: { count: 1, from: ["potion_feu", "potion_vitesse", "potion_poison", "potion_fumee"] },
  },
  moyen: {
    melee: ["epee_longue", "lance", "masse", "couteau_boucher"],
    armor: ["armure_cloutee", "cotte_mailles"],
    hat: ["casque_cuir", "casque_maille"],
    ranged: ["arc_court"],
    amulet: ["amulette_vitalite", "amulette_force", "amulette_agilite", "amulette_precision"],
    artifact: ["flute_pan", "outils_voleur"],
    bag: "sac_cuir",
    ammo: [[["fleche", 15], ["fleche_poison", 5]], [["fleche", 10], ["javeline", 6]]],
    food: [[["pomme", 2], ["cuisse_poulet", 2]], [["cuisse_poulet", 2], ["morille", 2]]],
    potions: { count: 3, from: ["potion_feu", "potion_vitesse", "potion_brouillard", "potion_oursin", "potion_pierre", "potion_discorde", "potion_glissante"] },
  },
  eleve: {
    // Le meilleur de tout (Thomas, 2026-11-17 : « l'équipement au top, avec le meilleur stuff ») : les armes et l'arc de
    // la section 2, le harnois.
    melee: ["epee_batarde", "marteau_guerre"],
    armor: ["harnois"],
    hat: ["casque_maille"],
    ranged: ["arc_corne"],
    amulet: ["amulette_vitalite_2", "amulette_force_2", "amulette_agilite_2", "amulette_precision_2"],
    artifact: ["d20_enchante", "oeil_chauve_souris", "outils_voleur", "flute_pan"],
    bag: "sac_voyage",
    ammo: [[["fleche", 20], ["fleche_ricochet", 5]], [["fleche", 15], ["fleche_poison", 10]], [["fleche", 15], ["javeline", 6], ["fleche_ricochet", 3]]],
    food: [[["cuisse_poulet", 3], ["morille", 2]], [["cuisse_poulet", 2], ["pomme", 3]]],
    potions: { count: 5, from: ["potion_feu", "potion_vitesse", "potion_brouillard", "potion_oursin", "potion_pierre", "potion_discorde", "potion_glissante", "potion_geant", "potion_jouvence", "potion_poison"] },
  },
};
