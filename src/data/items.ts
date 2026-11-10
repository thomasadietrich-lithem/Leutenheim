import { Dice } from "../core/dice";

/** Une fiche d'objet. Les statistiques d'attaque sont portées par l'arme, pas par le personnage. */
export interface ItemDef {
  id: string;
  name: string;
  kind: "melee" | "ranged" | "ammo" | "key";
  /** Place occupée dans le sac, en cases (largeur × hauteur). */
  w: number;
  h: number;
  /** Nombre maximal d'exemplaires dans une même case (1 = ne s'empile pas). */
  maxStack: number;
  /** Armes : bonus au d20 et dés de dégâts. */
  attackBonus?: number;
  damage?: Dice;
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
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;

/** Sans arme de mêlée équipée, on se bat à mains nues. */
export const UNARMED = { attackBonus: 2, damage: { count: 1, sides: 2, bonus: 0 } as Dice };
