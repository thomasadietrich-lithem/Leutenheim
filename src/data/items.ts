import { Dice } from "../core/dice";

/** Ce que le héros peut porter sur lui, à part du sac. */
export type Slot = "amulet" | "hat" | "artifact" | "armor" | "melee" | "ranged";
export const SLOTS: { slot: Slot; label: string }[] = [
  { slot: "amulet", label: "Amulette" },
  { slot: "hat", label: "Heaume" },
  { slot: "artifact", label: "Artefact" },
  { slot: "armor", label: "Armure" },
  { slot: "melee", label: "Corps à corps" },
  { slot: "ranged", label: "Distance" },
];

/** Classe d'armure sans armure. */
export const UNARMORED_AC = 10;

/** Une fiche d'objet. Les statistiques d'attaque sont portées par l'arme, pas par le personnage. */
export interface ItemDef {
  id: string;
  name: string;
  /** Les six premiers sont aussi des emplacements d'équipement ; munitions et clefs restent dans le sac. */
  kind: Slot | "ammo" | "key" | "gold" | "use";
  /** Une phrase de description, affichée sur la fiche de l'objet. */
  description: string;
  /** Place occupée dans le sac, en cases (largeur × hauteur). */
  w: number;
  h: number;
  /** Nombre maximal d'exemplaires dans une même case (1 = ne s'empile pas). */
  maxStack: number;
  /** Armes : bonus au d20 et dés de dégâts. */
  attackBonus?: number;
  damage?: Dice;
  /** Armures : classe d'armure une fois portée (10 sans armure). */
  armorClass?: number;
  /** Armes à distance : portée en cases et munition consommée. */
  range?: number;
  ammo?: string;
  /** Rareté : dit à quel point l'objet est difficile à trouver (Thomas, 2026-11-11). Sans rareté : objet de départ. */
  rarity?: Rarity;
  /** Niveau du héros nécessaire pour équiper ou utiliser l'objet (Thomas : « le niveau du héros »). */
  level?: number;
  /** Armes de corps à corps : lente (une attaque prend 1,5 tour) ou rapide (¾ de tour). */
  speed?: "slow" | "fast";
  /** Armes de corps à corps : portée en cases (1 par défaut ; la lance frappe à 2). */
  reach?: number;
  /** Munitions : poison laissé dans la plaie (dégâts par tour, nombre de tours). */
  poison?: { damage: number; turns: number };
  /** Objets à utiliser : PV rendus, ou tours de lumière (torche). */
  heal?: number;
  lightTurns?: number;
  /** Munitions : famille d'arme qui les tire (« fleche » pour l'arc). */
  ammoFamily?: string;
}

export type Rarity = "common" | "uncommon" | "rare";
export const RARITY_LABELS: Record<Rarity, string> = { common: "Commun", uncommon: "Peu commun", rare: "Rare" };

export const ITEMS = {
  epee: {
    id: "epee",
    name: "Épée courte",
    kind: "melee",
    description: "Une lame courte et droite, sans garde ni fioriture. Fiable.",
    w: 1,
    h: 2,
    maxStack: 1,
    attackBonus: 4,
    damage: { count: 1, sides: 6, bonus: 2 },
  },
  dague: {
    id: "dague",
    name: "Dague",
    kind: "melee",
    description: "Courte et vive, faite pour les coups en traître.",
    w: 1,
    h: 1,
    maxStack: 1,
    attackBonus: 5,
    damage: { count: 1, sides: 4, bonus: 2 },
  },
  baton: {
    id: "baton",
    name: "Bâton",
    kind: "melee",
    description: "Un bâton de marche. Mieux que rien.",
    w: 1,
    h: 2,
    maxStack: 1,
    attackBonus: 2,
    damage: { count: 1, sides: 4, bonus: 0 },
  },
  arc_court: {
    id: "arc_court",
    name: "Arc court",
    kind: "ranged",
    description: "Un arc de chasse en bois nu.",
    w: 1,
    h: 2,
    maxStack: 1,
    attackBonus: 3,
    damage: { count: 1, sides: 6, bonus: 0 },
    range: 9,
    ammo: "fleche",
  },
  fleche: { id: "fleche", name: "Flèches", kind: "ammo", description: "Munitions pour l'arc.", w: 1, h: 1, maxStack: 20, rarity: "common", ammoFamily: "fleche" },
  fleche_poison: {
    id: "fleche_poison",
    name: "Flèches empoisonnées",
    kind: "ammo",
    description: "La pointe luit d'un enduit verdâtre. La plaie brûle encore plusieurs tours.",
    w: 1,
    h: 1,
    maxStack: 20,
    rarity: "uncommon",
    level: 4,
    ammoFamily: "fleche",
    poison: { damage: 1, turns: 4 },
  },
  pomme: { id: "pomme", name: "Pomme", kind: "use", description: "Croquante. Rend 5 PV.", w: 1, h: 1, maxStack: 5, rarity: "common", heal: 5 },
  torche: {
    id: "torche",
    name: "Torche",
    kind: "use",
    description: "Une fois allumée, elle éclaire autour de vous pendant 100 tours. Mais on vous voit venir.",
    w: 1,
    h: 1,
    maxStack: 3,
    rarity: "common",
    lightTurns: 100,
  },
  epee_longue: {
    id: "epee_longue",
    name: "Épée longue",
    kind: "melee",
    description: "Lourde et longue. Chaque coup prend du temps, mais il porte.",
    w: 1,
    h: 3,
    maxStack: 1,
    rarity: "uncommon",
    level: 2,
    speed: "slow",
    attackBonus: 4,
    damage: { count: 2, sides: 6, bonus: 2 },
  },
  lance: {
    id: "lance",
    name: "Lance",
    kind: "melee",
    description: "Frappe à deux cases : on touche l'ennemi avant qu'il n'arrive au contact. Lente à manier.",
    w: 1,
    h: 4,
    maxStack: 1,
    rarity: "uncommon",
    level: 2,
    speed: "slow",
    reach: 2,
    attackBonus: 4,
    damage: { count: 1, sides: 8, bonus: 1 },
  },
  cimeterre: {
    id: "cimeterre",
    name: "Cimeterre",
    kind: "melee",
    description: "Une lame courbe qui danse. Rapide et cruelle.",
    w: 2,
    h: 2,
    maxStack: 1,
    rarity: "rare",
    level: 5,
    speed: "fast",
    attackBonus: 5,
    damage: { count: 1, sides: 6, bonus: 3 },
  },
  armure_cloutee: {
    id: "armure_cloutee",
    name: "Cuir clouté",
    kind: "armor",
    description: "Du cuir épais renforcé de rivets d'acier. Solide sans faire de bruit.",
    w: 2,
    h: 2,
    maxStack: 1,
    rarity: "rare",
    level: 5,
    armorClass: 14,
  },
  clef: { id: "clef", name: "Clef", kind: "key", description: "Ouvre une salle fermée de l'étage où on l'a trouvée, sans bruit. Ne sert qu'une fois.", w: 1, h: 1, maxStack: 5 },
  or: { id: "or", name: "Bourse d'or", kind: "gold", description: "Un petit sac de cuir fermé par une cordelette. Son or rejoint votre bourse dès que vous marchez dessus.", w: 1, h: 1, maxStack: 9999 },
  tunique: {
    id: "tunique",
    name: "Tunique",
    kind: "armor",
    description: "Une tunique blanche, serrée par une ceinture de cuir.",
    w: 2,
    h: 2,
    maxStack: 1,
    armorClass: 12,
  },
  cotte_mailles: {
    id: "cotte_mailles",
    name: "Cotte de mailles",
    kind: "armor",
    description: "Des anneaux de fer rivetés. Lourde, mais sûre.",
    w: 2,
    h: 2,
    maxStack: 1,
    armorClass: 16,
  },
  armure_cuir: {
    id: "armure_cuir",
    name: "Armure de cuir",
    kind: "armor",
    description: "Du cuir bouilli, souple et silencieux.",
    w: 2,
    h: 2,
    maxStack: 1,
    armorClass: 13,
  },
  robe: { id: "robe", name: "Robe", kind: "armor", description: "Une robe d'étude. Elle ne protège guère.", w: 2, h: 2, maxStack: 1, armorClass: 11 },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;

/** Sans arme de mêlée équipée, on se bat à mains nues. */
export const UNARMED = { attackBonus: 2, damage: { count: 1, sides: 2, bonus: 0 } as Dice };

/** Le genre d'un objet, en clair, pour sa fiche. */
export const KIND_LABELS: Record<ItemDef["kind"], string> = {
  melee: "Arme de corps à corps",
  ranged: "Arme à distance",
  armor: "Armure",
  hat: "Heaume",
  artifact: "Artefact",
  amulet: "Amulette",
  ammo: "Munition",
  key: "Objet utile",
  gold: "Monnaie",
  use: "À utiliser",
};
