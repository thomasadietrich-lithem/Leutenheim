import { Dice } from "../core/dice";

/** Une classe fixe la base de combat et (plus tard) les capacités actives. */
export interface ClassDef {
  id: string;
  name: string;
  hp: number;
  armorClass: number;
  attackBonus: number;
  damage: Dice;
}

export const CLASSES = {
  guerrier: {
    id: "guerrier",
    name: "Guerrier",
    hp: 12,
    armorClass: 15,
    attackBonus: 4,
    damage: { count: 1, sides: 8, bonus: 2 },
  },
} satisfies Record<string, ClassDef>;
