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
): AttackResult {
  const rolls = [rng.int(1, 20)];
  if (mode !== "normal") rolls.push(rng.int(1, 20));
  const d20 = mode === "advantage" ? Math.max(...rolls) : Math.min(...rolls);
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
