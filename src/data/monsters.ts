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
  /** Couleur du sang (le Schrat saigne vert). */
  blood?: "red" | "green";
  /** Pas par tour quand il fonce sur le héros (l'araignée en fait deux). */
  chaseSteps?: number;
  /** Chance qu'une morsure qui porte englue le héros (il perd son prochain déplacement). */
  webBite?: number;
  /** Morsure qui empoisonne parfois : chance, PV perdus par tour, nombre de tours. */
  poisonBite?: { chance: number; damage: number; turns: number };
  /** Taille en cases (2 : elle occupe un carré de 2 × 2 ; sa case `x, y` est celle du haut à gauche). */
  size?: number;
  /** Tireur (Kobold frondeur) : sa fronde (portée, bonus au d20, dégâts) et la distance qu'il cherche à garder. */
  sling?: { range: number; attackBonus: number; damage: Dice; keep: number };
  /** Boss : ne se pousse pas, ne se repeuple pas ; son comportement est à part (`src/core/boss.ts`). */
  boss?: boolean;
}

export const MONSTERS = {
  schrat: {
    id: "schrat",
    name: "Kobold",
    family: "kobolds",
    description: "Petit pillard écailleux à cornes des premières galeries. Il dort volontiers, mais une fois réveillé il ne lâche plus sa proie.",
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
    blood: "green",
  },
  // KOBOLD FRONDEUR (Thomas, 2026-11-11 : « Kobold frondeur ok » ; planche art/frondeur_v1.png). Valeurs (C).
  frondeur: {
    id: "frondeur",
    name: "Kobold frondeur",
    family: "kobolds",
    description: "Un Kobold en jaque de cuir, fronde à la main. Il garde ses distances, tire de loin et recule derrière les colonnes quand on l'approche.",
    hp: 6,
    armorClass: 12,
    attackBonus: 1,
    damage: { count: 1, sides: 3, bonus: 0 },
    vision: 7,
    xpMin: 4,
    xpMax: 6,
    goldChance: 0.35,
    goldMax: 4,
    noticeChance: 0.45,
    color: "#a87c4a",
    blood: "green",
    sling: { range: 6, attackBonus: 3, damage: { count: 1, sides: 4, bonus: 0 }, keep: 3 },
  },
  araignee: {
    id: "araignee",
    name: "Araignée",
    family: "araignées",
    description: "Elle guette dans les coins sombres, près de ses toiles. Très vive quand elle fond sur sa proie, et sa morsure colle.",
    // Validée par Thomas le 2026-11-11 (planche art/araignee_v1.png) : plus rapide, plus de santé, plus de dégâts que le Schrat.
    hp: 10,
    armorClass: 13,
    attackBonus: 3,
    damage: { count: 1, sides: 6, bonus: 0 },
    vision: 6,
    xpMin: 5,
    xpMax: 7,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 0.45,
    color: "#5a4466",
    blood: "green",
    chaseSteps: 2,
    webBite: 1 / 3,
  },
  // BOSS DE LA SECTION 1 (étage 5 ; planche art/boss_v2.png, Thomas : « implémente », 2026-11-11). Valeurs (C).
  tisseuse: {
    id: "tisseuse",
    name: "la Tisseuse",
    family: "araignées",
    description: "Reine des araignées, grosse comme un chariot, l'abdomen marqué d'un crâne. Elle sent chaque vibration de sa toile, avance pour mordre puis recule dans l'ombre.",
    // Rééquilibrée le 2026-11-11 (proposée à 45 PV, +5, 2d6 : un héros niveau 5 qui fonce perdait toujours).
    hp: 36,
    armorClass: 13,
    attackBonus: 4,
    damage: { count: 1, sides: 8, bonus: 1 },
    vision: 2,
    xpMin: 30,
    xpMax: 30,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 1,
    color: "#d8d2c0",
    blood: "green",
    poisonBite: { chance: 1 / 4, damage: 1, turns: 3 },
    size: 2,
    boss: true,
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
    entries: [
      // Meutes de Kobolds : 1 aux étages 1-2, 2 aux étages 3-4, 3 à l'étage 5… (2026-11-11 : un cran plus doux qu'avant,
      // la chute de l'étage 3 à l'étage 4 était trop raide).
      { monster: "schrat", weight: 1, packMin: 1, packMax: Math.min(1 + Math.floor((depth - 1) / 2), 4) },
      // Les araignées arrivent à l'étage 3, avec les toiles (Thomas) ; elles chassent seules ou à deux.
      // Kobold frondeur (2026-11-11) : dès l'étage 2, seul.
      ...(depth >= 2 ? [{ monster: "frondeur" as const, weight: 0.35, packMin: 1, packMax: 1 }] : []),
      // (2026-11-11) : seules aux étages 3-4, jusqu'à deux ensuite.
      ...(depth >= 3 ? [{ monster: "araignee" as const, weight: 0.25, packMin: 1, packMax: depth >= 5 ? 2 : 1 }] : []),
    ],
  };
}
