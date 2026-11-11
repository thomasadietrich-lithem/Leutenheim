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
  /** Équipement de départ. L'attaque vient des armes et la classe d'armure de l'armure (voir src/data/items.ts). */
  startingItems: { item: ItemId; count: number; equip?: boolean }[];
  /** Bonus au d20 pour crocheter une serrure et pour enfoncer une porte. */
  lockpickBonus: number;
  /** Bonus au d20 pour se cacher. */
  stealthBonus: number;
  /** Bonus au d20 pour se dégager d'un bond. */
  disengageBonus: number;
  /** Bonus au d20 pour fouiller une salle. */
  searchBonus: number;
  /** Bonus au d20 pour pousser un ennemi. */
  pushBonus: number;
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
    startingItems: [
      { item: "tunique", count: 1, equip: true },
      { item: "epee", count: 1, equip: true },
      { item: "arc_court", count: 1, equip: true },
      { item: "fleche", count: 10 },
    ],
    lockpickBonus: 0,
    stealthBonus: -5,
    disengageBonus: 2,
    searchBonus: 0,
    pushBonus: 4,
    breakBonus: 4,
  },
  assassin: {
    id: "assassin",
    name: "Assassin",
    available: false,
    tagline: "Frappe par surprise.",
    trait: "Gros dégâts sur un ennemi qui ne l'a pas remarqué ; crochète facilement.",
    hp: 8,
    startingItems: [
      { item: "armure_cuir", count: 1, equip: true },
      { item: "dague", count: 1, equip: true },
      { item: "arc_court", count: 1, equip: true },
      { item: "fleche", count: 8 },
    ],
    lockpickBonus: 5,
    stealthBonus: 4,
    disengageBonus: 4,
    searchBonus: 3,
    pushBonus: 0,
    breakBonus: 0,
  },
  magicien: {
    id: "magicien",
    name: "Magicien",
    available: false,
    tagline: "Sorts à distance, fragile.",
    trait: "Sorts en nombre limité, rechargés par le repos.",
    hp: 6,
    startingItems: [
      { item: "robe", count: 1, equip: true },
      { item: "baton", count: 1, equip: true },
    ],
    lockpickBonus: 1,
    stealthBonus: 0,
    disengageBonus: 0,
    searchBonus: 2,
    pushBonus: -1,
    breakBonus: -1,
  },
} satisfies Record<string, ClassDef>;
