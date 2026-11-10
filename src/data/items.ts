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
  kind: Slot | "ammo" | "key" | "gold";
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
}

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
  fleche: { id: "fleche", name: "Flèches", kind: "ammo", description: "Munitions pour l'arc.", w: 1, h: 1, maxStack: 20 },
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
};
