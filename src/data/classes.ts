import { Dice } from "../core/dice";

/** Une classe fixe la base de combat et (plus tard) les capacités actives. */
export interface ClassDef {
  id: string;
  name: string;
  hp: number;
  armorClass: number;
  attackBonus: number;
  damage: Dice;
  /** Bonus au d20 pour crocheter une serrure et pour enfoncer une porte. */
  lockpickBonus: number;
  breakBonus: number;
}

export const CLASSES = {
  guerrier: {
    id: "guerrier",
    name: "Guerrier",
    hp: 10,
    armorClass: 15,
    attackBonus: 4,
    damage: { count: 1, sides: 6, bonus: 2 },
    lockpickBonus: 0,
    breakBonus: 4,
  },
} satisfies Record<string, ClassDef>;
