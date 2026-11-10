import { Dice } from "../core/dice";

/** Ce que le héros peut porter sur lui, à part du sac. */
export type Slot = "amulet" | "hat" | "armor" | "melee" | "ranged";
export const SLOTS: { slot: Slot; label: string }[] = [
  { slot: "amulet", label: "Amulette" },
  { slot: "hat", label: "Chapeau" },
  { slot: "armor", label: "Armure" },
  { slot: "melee", label: "Corps à corps" },
  { slot: "ranged", label: "Distance" },
];

/** Classe d'armure sans armure. */
export const UNARMORED_AC = 10;

/** Une fiche d'objet. Les statistiques d'attaque sont portées par l'arme, pas par le personnage. */
export interface ItemDef {
  id: string;
  name: string;
  /** Les cinq premiers sont aussi des emplacements d'équipement ; munitions et clefs restent dans le sac. */
  kind: Slot | "ammo" | "key";
  /** Place occupée dans le sac, en cases (largeur × hauteur). */
  w: number;
  h: number;
  /** Nombre maximal d'exemplaires dans une même case (1 = ne s'empile pas). */
  maxStack: number;
  /** Armes : bonus au d20 et dés de dégâts. */
  attackBonus?: number;
  damage?: Dice;
  /** Armures : classe d'armure une fois portée (10 sans armure). */
  armorClass?: number;
  /** Armes à distance : portée en cases et munition consommée. */
  range?: number;
  ammo?: string;
}

export const ITEMS = {
  epee: { id: "epee", name: "Épée", kind: "melee", w: 1, h: 2, maxStack: 1, attackBonus: 4, damage: { count: 1, sides: 6, bonus: 2 } },
  dague: { id: "dague", name: "Dague", kind: "melee", w: 1, h: 1, maxStack: 1, attackBonus: 5, damage: { count: 1, sides: 4, bonus: 2 } },
  baton: { id: "baton", name: "Bâton", kind: "melee", w: 1, h: 2, maxStack: 1, attackBonus: 2, damage: { count: 1, sides: 4, bonus: 0 } },
  arc_court: {
    id: "arc_court",
    name: "Arc court",
    kind: "ranged",
    w: 1,
    h: 2,
    maxStack: 1,
    attackBonus: 3,
    damage: { count: 1, sides: 6, bonus: 0 },
    range: 6,
    ammo: "fleche",
  },
  fleche: { id: "fleche", name: "Flèches", kind: "ammo", w: 1, h: 1, maxStack: 20 },
  clef: { id: "clef", name: "Clef", kind: "key", w: 1, h: 1, maxStack: 5 },
  cotte_mailles: { id: "cotte_mailles", name: "Cotte de mailles", kind: "armor", w: 2, h: 2, maxStack: 1, armorClass: 15 },
  armure_cuir: { id: "armure_cuir", name: "Armure de cuir", kind: "armor", w: 2, h: 2, maxStack: 1, armorClass: 13 },
  robe: { id: "robe", name: "Robe", kind: "armor", w: 2, h: 2, maxStack: 1, armorClass: 11 },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;

/** Sans arme de mêlée équipée, on se bat à mains nues. */
export const UNARMED = { attackBonus: 2, damage: { count: 1, sides: 2, bonus: 0 } as Dice };
