import { Dice } from "../core/dice";

/**
 * Pièges (planche art/pieges_v3.png, validée le 2026-11-11 : « Ok fonce »). La dalle elle-même trahit le piège.
 * Valeurs choisies par Claude, à confirmer (C).
 */
export type TrapKind = "spikes" | "pit" | "needle" | "gas";

export interface TrapDef {
  name: string;
  /** Premier étage où il peut apparaître, et poids au tirage. */
  minDepth: number;
  weight: number;
  /** Dégâts à qui marche dessus. */
  damage?: Dice;
  /** Poison : PV perdus au début de chacun de ses `turns` prochains tours. */
  poison?: { damage: number; turns: number };
  /** Fosse : on y reste ce nombre de déplacements à remonter. */
  stuck?: number;
  /** Gaz : nuage sur la case et ses quatre voisines pendant ce nombre de tours ; qui s'y tient est empoisonné. */
  gasTurns?: number;
}

export const TRAPS: Record<TrapKind, TrapDef> = {
  spikes: { name: "piège à pointes", minDepth: 1, weight: 4, damage: { count: 1, sides: 4, bonus: 1 } },
  pit: { name: "fosse", minDepth: 1, weight: 2, damage: { count: 1, sides: 6, bonus: 0 }, stuck: 1 },
  needle: { name: "aiguille empoisonnée", minDepth: 2, weight: 2, damage: { count: 1, sides: 1, bonus: 0 }, poison: { damage: 1, turns: 4 } },
  gas: { name: "gaz empoisonné", minDepth: 3, weight: 1, gasTurns: 3, poison: { damage: 1, turns: 3 } },
};
