import { Dice } from "../core/dice";

export interface MonsterDef {
  id: string;
  name: string;
  family: string;
  hp: number;
  armorClass: number;
  attackBonus: number;
  damage: Dice;
  vision: number;
  /** Chance par tour de remarquer le héros quand il est en vue. */
  noticeChance: number;
  color: string;
}

export const MONSTERS = {
  schrat: {
    id: "schrat",
    name: "Schrat",
    family: "schrats",
    hp: 5,
    armorClass: 12,
    attackBonus: 2,
    damage: { count: 1, sides: 4, bonus: 0 },
    vision: 6,
    noticeChance: 0.4,
    color: "#d9763a",
  },
} satisfies Record<string, MonsterDef>;

export type MonsterId = keyof typeof MONSTERS;

/** Une ligne de table d'apparition : quel monstre, à quelle fréquence, en groupe de combien. */
export interface SpawnEntry {
  monster: MonsterId;
  weight: number;
  packMin: number;
  packMax: number;
}

export interface FloorSpawns {
  /** Chance qu'une salle (hors salle de départ) contienne un groupe. */
  roomChance: number;
  entries: SpawnEntry[];
}

/** Table d'apparition selon la profondeur. Pour l'instant : les Schrats, en meutes qui grossissent. */
export function spawnsForDepth(depth: number): FloorSpawns {
  return {
    roomChance: Math.min(0.3 + depth * 0.05, 0.7),
    entries: [{ monster: "schrat", weight: 1, packMin: 1, packMax: Math.min(1 + Math.floor(depth / 2), 4) }],
  };
}
