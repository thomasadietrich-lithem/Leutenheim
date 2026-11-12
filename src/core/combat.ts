import { Dice } from "./dice";
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
  /** Les dés de dégâts lancés (pour le journal) : la formule et chaque face ; `rolled` = leur total avant les bonus ajoutés après. */
  damageRoll?: { dice: Dice; faces: number[]; rolled: number };
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
  /** Coup critique à partir de ce d20 (20 d'ordinaire ; 19 avec « Coup puissant »). */
  critFrom = 20,
  /** Chance (Sœur Osseuse) : appelé sur un 1 naturel ; s'il répond oui, le dé est relancé. */
  reroll?: () => boolean,
): AttackResult {
  const rolls = [rng.int(1, 20)];
  if (mode !== "normal") rolls.push(rng.int(1, 20));
  let d20 = mode === "advantage" ? Math.max(...rolls) : Math.min(...rolls);
  if (d20 === 1 && reroll?.()) {
    d20 = rng.int(1, 20);
    rolls[rolls.indexOf(1)] = d20;
  }
  const total = d20 + attacker.attackBonus;
  const critical = d20 >= critFrom;
  const hit = critical || (d20 !== 1 && total >= defender.armorClass);
  const result: AttackResult = {
    mode,
    rolls,
    d20,
    bonus: attacker.attackBonus,
    total,
    targetAc: defender.armorClass,
    hit,
    critical,
    damage: 0,
  };
  if (hit) {
    // Mêmes tirages que rollDice (même ordre), mais on garde chaque face pour le journal.
    const count = critical ? attacker.damage.count * 2 : attacker.damage.count;
    const faces: number[] = [];
    for (let i = 0; i < count; i++) faces.push(rng.int(1, attacker.damage.sides));
    const rolled = Math.max(1, faces.reduce((a, b) => a + b, 0) + attacker.damage.bonus);
    result.damage = rolled;
    result.damageRoll = { dice: attacker.damage, faces, rolled };
  }
  return result;
}

/**
 * Dégâts moyens par tour d'une arme de corps à corps contre une classe d'armure (sert à comparer deux armes
 * sur la fiche, Thomas 2026-11-12 : « sentir la différence »). Compte les ratés, les critiques et la vitesse.
 */
export function expectedDamagePerTurn(attackBonus: number, damage: Dice, speed: "slow" | "fast" | undefined, armorClass: number, slowTurns = 1.5, fastTurns = 0.75): number {
  const average = damage.count * (damage.sides + 1) / 2 + damage.bonus;
  const hits = Math.min(19, Math.max(1, 21 - (armorClass - attackBonus))); // faces du d20 qui touchent (le 1 rate, le 20 touche)
  const normal = (hits - 1) / 20;
  const critical = 1 / 20;
  const perAttack = normal * average + critical * (average + damage.count * (damage.sides + 1) / 2);
  return perAttack / (speed === "slow" ? slowTurns : speed === "fast" ? fastTurns : 1);
}
