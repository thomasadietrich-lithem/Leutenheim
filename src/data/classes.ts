import { ItemId } from "./items";

/** Une classe fixe la base de combat et la façon de jouer. */
export interface ClassDef {
  id: string;
  name: string;
  /** Jouable dès maintenant ? Sinon la case est grisée dans l'écran de nouvelle partie. */
  available: boolean;
  /** Phrase courte affichée sur la case. */
  tagline: string;
  /** Style de jeu, décrit dans la fiche détaillée. */
  trait: string;
  hp: number;
  armorClass: number;
  /** Équipement de départ. Les statistiques d'attaque viennent des armes (voir src/data/items.ts). */
  startingItems: { item: ItemId; count: number; equip?: boolean }[];
  /** Bonus au d20 pour crocheter une serrure et pour enfoncer une porte. */
  lockpickBonus: number;
  breakBonus: number;
}

export const CLASSES = {
  guerrier: {
    id: "guerrier",
    name: "Guerrier",
    available: true,
    tagline: "Encaisse et frappe fort.",
    trait: "Bonne armure, et la force d'enfoncer les portes.",
    hp: 10,
    armorClass: 15,
    startingItems: [
      { item: "epee", count: 1, equip: true },
      { item: "arc_court", count: 1, equip: true },
      { item: "fleche", count: 5 },
    ],
    lockpickBonus: 0,
    breakBonus: 4,
  },
  assassin: {
    id: "assassin",
    name: "Assassin",
    available: false,
    tagline: "Frappe par surprise.",
    trait: "Gros dégâts sur un ennemi qui ne l'a pas remarqué ; crochète facilement.",
    hp: 8,
    armorClass: 13,
    startingItems: [
      { item: "dague", count: 1, equip: true },
      { item: "arc_court", count: 1, equip: true },
      { item: "fleche", count: 8 },
    ],
    lockpickBonus: 5,
    breakBonus: 0,
  },
  magicien: {
    id: "magicien",
    name: "Magicien",
    available: false,
    tagline: "Sorts à distance, fragile.",
    trait: "Sorts en nombre limité, rechargés par le repos.",
    hp: 6,
    armorClass: 11,
    startingItems: [{ item: "baton", count: 1, equip: true }],
    lockpickBonus: 1,
    breakBonus: -1,
  },
} satisfies Record<string, ClassDef>;
