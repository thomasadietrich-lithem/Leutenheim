import { Dice, rollDice } from "./dice";
import { Rng } from "./rng";

export type RollMode = "normal" | "advantage" | "disadvantage";

export interface AttackResult {
  mode: RollMode;
  /** Tous les d20 lancés (deux en cas d'avantage ou de désavantage). */
  rolls: number[];
  /** Le d20 retenu. */
  d20: number;
  bonus: number;
  total: number;
  targetAc: number;
  hit: boolean;
  critical: boolean;
  damage: number;
}

/**
 * Jet d'attaque : d20 + bonus contre la classe d'armure (CA).
 * 20 naturel : touche toujours et double les dés de dégâts. 1 naturel : rate toujours.
 */
export function rollAttack(
  rng: Rng,
  attacker: { attackBonus: number; damage: Dice },
  defender: { armorClass: number },
  mode: RollMode = "normal",
): AttackResult {
  const rolls = [rng.int(1, 20)];
  if (mode !== "normal") rolls.push(rng.int(1, 20));
  const d20 = mode === "advantage" ? Math.max(...rolls) : Math.min(...rolls);
  const total = d20 + attacker.attackBonus;
  const critical = d20 === 20;
  const hit = critical || (d20 !== 1 && total >= defender.armorClass);
  return {
    mode,
    rolls,
    d20,
    bonus: attacker.attackBonus,
    total,
    targetAc: defender.armorClass,
    hit,
    critical,
    damage: hit ? rollDice(rng, attacker.damage, critical) : 0,
  };
}
