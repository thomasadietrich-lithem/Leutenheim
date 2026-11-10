import { Dice } from "../core/dice";

export interface MonsterDef {
  id: string;
  name: string;
  family: string;
  /** Une ou deux phrases pour l'encyclopédie (jamais de chiffres de défense : le joueur les découvre en jouant). */
  description: string;
  hp: number;
  armorClass: number;
  attackBonus: number;
  damage: Dice;
  vision: number;
  /** Expérience gagnée en le vainquant : un nombre tiré entre ces deux bornes. */
  xpMin: number;
  xpMax: number;
  /** Chance qu'il laisse tomber de l'or, et combien au plus. */
  goldChance: number;
  goldMax: number;
  /** Chance par tour de remarquer le héros quand il est en vue. */
  noticeChance: number;
  color: string;
}

export const MONSTERS = {
  schrat: {
    id: "schrat",
    name: "Schrat",
    family: "schrats",
    description: "Petit pillard écailleux des premières galeries. Il dort volontiers, mais une fois réveillé il ne lâche plus sa proie.",
    hp: 7,
    armorClass: 12,
    attackBonus: 2,
    damage: { count: 1, sides: 4, bonus: 0 },
    vision: 6,
    xpMin: 3,
    xpMax: 5,
    goldChance: 0.35,
    goldMax: 4,
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
  /** Chance qu'un groupe dorme. Les autres se promènent d'une salle à l'autre. */
  sleepChance: number;
  entries: SpawnEntry[];
}

/** Table d'apparition selon la profondeur. Pour l'instant : les Schrats, en meutes qui grossissent. */
export function spawnsForDepth(depth: number): FloorSpawns {
  return {
    roomChance: Math.min(0.3 + depth * 0.05, 0.7),
    // Étages du haut : presque tout le monde dort. Plus on descend, plus ça se promène.
    sleepChance: Math.max(0.2, 0.65 - (depth - 1) * 0.1),
    entries: [{ monster: "schrat", weight: 1, packMin: 1, packMax: Math.min(1 + Math.floor(depth / 2), 4) }],
  };
}
