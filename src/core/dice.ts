import { Rng } from "./rng";

/** Des dés à la D&D : `count`d`sides` + `bonus` (ex. 1d8+2). */
export interface Dice {
  count: number;
  sides: number;
  bonus: number;
}

export function rollDice(rng: Rng, dice: Dice, critical = false): number {
  let total = dice.bonus;
  const count = critical ? dice.count * 2 : dice.count; // coup critique : on double les dés
  for (let i = 0; i < count; i++) total += rng.int(1, dice.sides);
  return Math.max(1, total);
}

export function diceLabel(d: Dice): string {
  return `${d.count}d${d.sides}${d.bonus > 0 ? `+${d.bonus}` : d.bonus < 0 ? d.bonus : ""}`;
}
