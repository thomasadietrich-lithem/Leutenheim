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
  /** Couleur du sang (Thomas, 2026-11-12) : jaune pour les Kobolds, noir pour les araignées. */
  blood?: "red" | "green" | "yellow" | "black";
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
  // ---- Section 2 (Thomas, 2026-11-15 : « retire les mobs de la section 1 dans la section 2 » ; `claude/MONSTRES_S2.md`) ----
  /** Lent : il ne joue qu'un tour sur deux (le myconide). */
  slow?: boolean;
  /** Aveugle : il ne voit pas, il SENT les pas du héros à cette distance, à travers les murs ; immobile, on le perd. */
  tremorSense?: number;
  /** À sa mort, il éclate : un nuage de spores (empoisonné) sur sa case et ses 4 voisines, pendant ces tours (sporelin). */
  burstGas?: number;
  /** Insensible aux spores et au gaz (le Kobold cueilleur et son masque). */
  sporeProof?: boolean;
  /** Il siffle l'alerte en remarquant le héros, une fois : ce nombre de points d'alerte (le Kobold cueilleur). */
  alarmOnNotice?: number;
  /** Il se relève une fois après sa mort, à moitié de ses PV, sauf s'il meurt en feu (le Kobold envahi). */
  risesOnce?: boolean;
  /** Le feu lui fait deux fois plus mal (le myconide, sec à l'intérieur). */
  fireWeak?: boolean;
  /** À sa mort, il laisse tomber sa hotte : des morilles (le Kobold cueilleur). */
  dropsMorels?: [number, number];
  /** Ne bouge ni n'agit jamais, ne se pousse pas (le battant du Carillon). */
  inert?: boolean;
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
    xpMin: 1,
    xpMax: 3,
    goldChance: 0.35,
    goldMax: 4,
    noticeChance: 0.4,
    color: "#d9763a",
    blood: "yellow",
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
    xpMin: 2,
    xpMax: 3,
    goldChance: 0.35,
    goldMax: 4,
    noticeChance: 0.45,
    color: "#a87c4a",
    blood: "yellow",
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
    xpMin: 2,
    xpMax: 4,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 0.45,
    color: "#5a4466",
    blood: "black",
    chaseSteps: 2,
    // 1 fois sur 4 (Thomas, 2026-11-13, d'après les joueurs automatiques : 1 sur 3 en faisait un mur aux étages 3-4).
    webBite: 1 / 4,
  },
  // ---------- SECTION 2, LA CHAMPIGNONNIÈRE (planche art/mobs_champi_v1.png ; comportements claude/MONSTRES_S2.md, C) ----------
  // Équilibrés pour un héros de niveau 5 et plus (Thomas, 2026-11-15 : « en section 2, on est déjà niveau 5 ») : du
  // sporelin (le plus faible, un peu plus solide qu'une araignée) au myconide (le plus dur).
  myconide: {
    id: "myconide",
    name: "Myconide",
    family: "champignons",
    description: "Un grand champignon qui marche, aveugle. Il sent vos pas à travers la pierre : qui s'arrête, il le perd. Lent, mais il frappe fort, et le feu le dévore.",
    hp: 24,
    armorClass: 13,
    attackBonus: 6,
    damage: { count: 1, sides: 8, bonus: 2 },
    vision: 0,
    xpMin: 5,
    xpMax: 7,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 0.6,
    color: "#6e5a86",
    blood: "green",
    slow: true,
    tremorSense: 6,
    fireWeak: true,
  },
  sporelin: {
    id: "sporelin",
    name: "Sporelin",
    family: "champignons",
    description: "Une vesse-de-loup sur pattes, qui sautille vers vous en bande. Tué, il éclate en un nuage de spores qui empoisonne tout autour : mieux vaut l'abattre de loin.",
    hp: 8,
    armorClass: 12,
    attackBonus: 4,
    damage: { count: 1, sides: 4, bonus: 1 },
    vision: 5,
    xpMin: 2,
    xpMax: 3,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 0.5,
    color: "#bcae70",
    blood: "green",
    chaseSteps: 2,
    burstGas: 3,
  },
  cueilleur: {
    id: "cueilleur",
    name: "Kobold cueilleur",
    family: "kobolds",
    description: "Un Kobold masqué, la hotte au dos et la serpette à la main. Les spores ne lui font rien ; en vous voyant, il siffle l'alerte. Sa hotte est pleine de morilles.",
    hp: 13,
    armorClass: 14,
    attackBonus: 5,
    damage: { count: 1, sides: 6, bonus: 1 },
    vision: 6,
    xpMin: 3,
    xpMax: 5,
    goldChance: 0.35,
    goldMax: 6,
    noticeChance: 0.45,
    color: "#8a6a44",
    blood: "yellow",
    sporeProof: true,
    alarmOnNotice: 10,
    dropsMorels: [1, 2],
  },
  envahi: {
    id: "envahi",
    name: "Kobold envahi",
    family: "kobolds",
    description: "Un Kobold gris, l'œil voilé : un champignon lui pousse sur le crâne. Abattu, il se relève une fois, à moins d'avoir brûlé, ou qu'on l'achève à terre.",
    hp: 14,
    armorClass: 13,
    attackBonus: 5,
    damage: { count: 1, sides: 6, bonus: 1 },
    vision: 5,
    xpMin: 3,
    xpMax: 4,
    goldChance: 0.2,
    goldMax: 4,
    noticeChance: 0.25,
    color: "#7f9a84",
    blood: "green",
    risesOnce: true,
  },
  // Les FIDÈLES DU CARILLON (Thomas, 2026-11-17 : « B c'est bien, essayons ») : moines-champignons du culte de la Lune
  // pâle, à la place des Kobolds envahis dans sa grotte. Battant cassé : ils vont le réparer (3 tours à côté). (C)
  fidele: {
    id: "fidele",
    name: "Fidèle du Carillon",
    family: "champignons",
    description: "Un moine-champignon en robe violette, la lune pâle brodée sur le cœur. Il sert le Carillon : si son battant tombe, il court le remettre en place. Arrêtez-le avant.",
    hp: 16,
    armorClass: 13,
    attackBonus: 5,
    damage: { count: 1, sides: 6, bonus: 1 },
    vision: 6,
    xpMin: 3,
    xpMax: 5,
    goldChance: 0.3,
    goldMax: 5,
    noticeChance: 0.3,
    color: "#8a5ac0",
    blood: "green",
  },
  // BOSS DE LA SECTION 1 (étage 5 ; planche art/boss_v2.png, Thomas : « implémente », 2026-11-11). Valeurs (C).
  tisseuse: {
    id: "tisseuse",
    name: "la Tisseuse",
    family: "araignées",
    description: "Reine des araignées, grosse comme un chariot, l'abdomen marqué d'un crâne. Elle sent chaque vibration de sa toile, avance pour mordre puis recule dans l'ombre.",
    // Rééquilibrée le 2026-11-11 (proposée à 45 PV, +5, 2d6 : un héros niveau 5 qui fonce perdait toujours).
    // Thomas, 2026-11-14 : « double le nombre de points de vie de la Tisseuse » (36 → 72).
    hp: 72,
    armorClass: 13,
    attackBonus: 4,
    damage: { count: 1, sides: 8, bonus: 1 },
    vision: 2,
    xpMin: 15,
    xpMax: 15,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 1,
    color: "#d8d2c0",
    blood: "black",
    poisonBite: { chance: 1 / 4, damage: 1, turns: 3 },
    size: 2,
    boss: true,
  },
  // BOSS DE LA SECTION 2 (étage 10 ; planches art/carillon_v1.png et carillon_v2.png, version A « coprin » ; Thomas,
  // 2026-11-16 : « A fonce »). Valeurs (C) : voir claude/BOSS_CARILLON.md.
  carillon: {
    id: "carillon",
    name: "le Carillon",
    family: "champignons",
    description: "Un coprin géant qui pousse de la voûte, tête en bas, le chapeau en forme de cloche. C'est lui qui sonnait. Tous les huit tours, son battant de spores frappe : l'onde jette à terre qui n'est pas à l'abri. Entre deux, il fait pleuvoir de l'encre sur des cases marquées d'une ombre, et son chapeau frappe qui se colle à lui.",
    hp: 120,
    armorClass: 12,
    attackBonus: 5,
    damage: { count: 1, sides: 8, bonus: 0 },
    vision: 12,
    xpMin: 30,
    xpMax: 30,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 1,
    color: "#e6dcc8",
    blood: "green",
    size: 3,
    boss: true,
    sporeProof: true,
  },
  /** Le battant du Carillon : une boule de spores pendue sous son chapeau ; on la casse pour le faire taire. */
  battant: {
    id: "battant",
    name: "le battant",
    family: "champignons",
    description: "La grosse boule de spores qui pend sous le chapeau du Carillon et le fait sonner. Il ne s'atteint que quand la cloche se balance, juste avant l'onde (sinon, seul un coup parfait passe). Cassée (flèches, javelines, coups, ou une poussée), il ne sonne plus, mais son chapeau se met à fondre.",
    hp: 20,
    armorClass: 14,
    attackBonus: 0,
    damage: { count: 1, sides: 1, bonus: 0 },
    vision: 0,
    xpMin: 2,
    xpMax: 2,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 0,
    color: "#c4d660",
    blood: "green",
    sporeProof: true,
    inert: true,
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
  // Section 2, la champignonnière (Thomas, 2026-11-15 : « retire les mobs de la section 1 dans la section 2 ») : plus de
  // Kobolds, de frondeurs ni d'araignées ; ses quatre monstres à elle (C).
  if (depth > 5) {
    // CRESCENDO (Thomas, 2026-11-15 : « les mobs faciles au début ; à la fin, les faciles et les difficiles », comme en
    // section 1) : étage 6 sporelins et envahis seuls ; 7 + cueilleur ; 8 + myconide ; 9 et 10 meutes plus grosses (C).
    const d = depth - 5;
    return {
      roomChance: Math.min(0.35 + d * 0.06, 0.7),
      sleepChance: Math.max(0.2, 0.6 - (d - 1) * 0.1),
      entries: [
        { monster: "sporelin", weight: 1, packMin: 1, packMax: Math.min(1 + d, 4) },
        { monster: "envahi", weight: 0.8, packMin: 1, packMax: d >= 4 ? 3 : d >= 2 ? 2 : 1 },
        ...(d >= 2 ? [{ monster: "cueilleur" as const, weight: 0.45, packMin: 1, packMax: 1 }] : []),
        ...(d >= 3 ? [{ monster: "myconide" as const, weight: 0.35, packMin: 1, packMax: d >= 4 ? 2 : 1 }] : []),
      ],
    };
  }
  return {
    roomChance: Math.min(0.3 + depth * 0.05, 0.7),
    // Étages du haut : presque tout le monde dort. Plus on descend, plus ça se promène.
    // Étage 1 plus doux (Thomas, 2026-11-13) : 80 % de dormeurs (65 % avant), puis −10 % par étage depuis 65 %.
    sleepChance: depth === 1 ? 0.8 : Math.max(0.2, 0.65 - (depth - 1) * 0.1),
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
