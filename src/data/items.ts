import { Dice } from "../core/dice";

/** Ce que le héros peut porter sur lui, à part du sac. */
export type Slot = "amulet" | "hat" | "artifact" | "armor" | "melee" | "ranged" | "bag";
export const SLOTS: { slot: Slot; label: string }[] = [
  { slot: "amulet", label: "Amulette" },
  { slot: "hat", label: "Heaume" },
  { slot: "artifact", label: "Artefact" },
  { slot: "armor", label: "Armure" },
  { slot: "melee", label: "Corps à corps" },
  { slot: "ranged", label: "Distance" },
  { slot: "bag", label: "Sac" },
];

/** Classe d'armure sans armure. */
export const UNARMORED_AC = 10;

/** Une fiche d'objet. Les statistiques d'attaque sont portées par l'arme, pas par le personnage. */
export interface ItemDef {
  id: string;
  name: string;
  /** Les six premiers sont aussi des emplacements d'équipement ; munitions et clefs restent dans le sac. */
  kind: Slot | "ammo" | "key" | "gold" | "use" | "gem" | "quest";
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
  /** Casques : classe d'armure ajoutée à celle de l'armure. */
  acBonus?: number;
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
  /** Gemmes : leur valeur, versée dans la bourse en les ramassant. */
  value?: number;
  /** Sacs : nombre de cases (colonnes × rangées). */
  bagCols?: number;
  bagRows?: number;
  /** Potions : ce qu'elles font (voir `src/core/game.ts`, `resolveUse`). */
  potion?: "youth" | "poison" | "haste" | "fire" | "smoke" | "fog" | "urchin";
  /** Potion lancée (feu) : portée en cases ; il faut viser une case. */
  throwRange?: number;
  /** Munitions : famille d'arme qui les tire (« fleche » pour l'arc ; « jet » : se lance à la main, sans arc). */
  ammoFamily?: string;
  /** Arme à deux mains (épée longue, lance) : marqué sur la fiche (Thomas, 2026-11-11). */
  twoHanded?: boolean;
  /** Armes lourdes : un d20 naturel à partir de ce nombre SONNE la cible (elle perd son prochain tour). */
  stunOn?: number;
  /** Armures lourdes : malus de discrétion (Thomas, 2026-11-12 : « bruyante »). */
  stealthPenalty?: number;
}

export type Rarity = "common" | "uncommon" | "rare";
export const RARITY_LABELS: Record<Rarity, string> = { common: "Commun", uncommon: "Peu commun", rare: "Rare" };

/**
 * La rareté se montre par une PASTILLE de couleur, plus par un mot (Thomas, 2026-11-12) : gris commun, vert peu commun,
 * bleu rare ; violet (épique) et doré (légendaire) sont prêts pour les objets à venir. Clair, foncé (le bord).
 */
export const RARITY_COLORS: Record<Rarity | "epic" | "legendary", [string, string]> = {
  common: ["#a8a8b0", "#5a5a64"],
  uncommon: ["#5cc860", "#2e7a38"],
  rare: ["#4a9ae0", "#22508a"],
  epic: ["#b07ae8", "#5a3290"],
  legendary: ["#f0c050", "#8a6418"],
};

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
    // Règle de Thomas (2026-11-11) : l'arc donne le jet (d20 + bonus) et la portée ; la FLÈCHE donne les dégâts.
    attackBonus: 3,
    range: 9,
    ammo: "fleche",
  },
  arc_puissant: {
    id: "arc_puissant",
    name: "Arc puissant",
    kind: "ranged",
    description: "Un arc recourbé aux bouts de corne. Il porte loin, et la flèche part droit.",
    w: 1,
    h: 2,
    maxStack: 1,
    rarity: "uncommon",
    level: 5,
    attackBonus: 5,
    range: 11,
    ammo: "fleche",
  },
  fleche: {
    id: "fleche",
    name: "Flèches",
    kind: "ammo",
    description: "Munitions pour l'arc.",
    w: 1,
    h: 1,
    maxStack: 20,
    rarity: "common",
    ammoFamily: "fleche",
    damage: { count: 1, sides: 6, bonus: 0 },
  },
  javeline: {
    id: "javeline",
    name: "Javelines",
    kind: "ammo",
    description: "Se lance à la main, sans arc. Moins précise qu'une flèche, mais frappe fort ; se ramasse.",
    w: 1,
    h: 2,
    maxStack: 6,
    rarity: "uncommon",
    level: 3,
    ammoFamily: "jet",
    attackBonus: -2,
    range: 6,
    damage: { count: 1, sides: 8, bonus: 2 },
  },
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
    damage: { count: 1, sides: 6, bonus: 0 },
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
    description: "Lourde et longue, elle se tient à deux mains. Chaque coup prend du temps, mais il porte, et peut assommer.",
    w: 1,
    h: 3,
    maxStack: 1,
    rarity: "uncommon",
    level: 2,
    speed: "slow",
    twoHanded: true,
    attackBonus: 4,
    damage: { count: 2, sides: 8, bonus: 2 },
    stunOn: 18,
  },
  couteau_boucher: {
    id: "couteau_boucher",
    name: "Couteau de boucher",
    kind: "melee",
    description: "Une lame large et lourde du bout, faite pour trancher la viande. Vive en main.",
    w: 1,
    h: 1,
    maxStack: 1,
    rarity: "common",
    level: 2,
    speed: "fast",
    attackBonus: 3,
    damage: { count: 1, sides: 4, bonus: 1 },
  },
  lance: {
    id: "lance",
    name: "Lance",
    kind: "melee",
    description: "Frappe à deux cases : on touche l'ennemi avant qu'il n'arrive au contact. À deux mains.",
    w: 1,
    h: 4,
    maxStack: 1,
    rarity: "uncommon",
    level: 2,
    twoHanded: true,
    reach: 2,
    attackBonus: 4,
    damage: { count: 1, sides: 10, bonus: 2 },
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
    rarity: "uncommon",
    level: 2,
    armorClass: 14,
  },
  // Casques (Thomas, 2026-11-11 ; planche art/objets_v4.png) : ils s'ajoutent à l'armure.
  casque_cuir: {
    id: "casque_cuir",
    name: "Casque de cuir",
    kind: "hat",
    description: "Une calotte de cuir bouilli, cousue, avec deux protège-oreilles. Mieux que rien.",
    w: 1,
    h: 1,
    maxStack: 1,
    rarity: "common",
    level: 1,
    acBonus: 1,
  },
  casque_maille: {
    id: "casque_maille",
    name: "Casque de maille",
    kind: "hat",
    description: "Un camail d'anneaux d'acier qui couvre la tête et la nuque, le visage dégagé.",
    w: 1,
    h: 1,
    maxStack: 1,
    rarity: "uncommon",
    level: 3,
    acBonus: 2,
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
  harnois: {
    id: "harnois",
    name: "Harnois",
    kind: "armor",
    description: "Des plaques d'acier qui couvrent tout le corps. Presque rien ne passe, mais on l'entend venir de loin.",
    w: 2,
    h: 2,
    maxStack: 1,
    rarity: "rare",
    level: 5,
    armorClass: 17,
    stealthPenalty: 3,
  },
  cotte_mailles: {
    id: "cotte_mailles",
    name: "Cotte de mailles",
    kind: "armor",
    description: "Des anneaux de fer rivetés. Lourde et sûre, mais elle cliquette : on se cache moins bien.",
    w: 2,
    h: 2,
    maxStack: 1,
    rarity: "uncommon",
    level: 3,
    armorClass: 16,
    stealthPenalty: 2,
  },
  armure_cuir: {
    id: "armure_cuir",
    name: "Armure de cuir",
    kind: "armor",
    description: "Du cuir bouilli, souple et silencieux.",
    w: 2,
    h: 2,
    maxStack: 1,
    rarity: "common",
    armorClass: 13,
  },
  // ---- Gemmes (Thomas, 2026-11-11) : ramassées, elles vont dans la bourse pour leur valeur. ----
  amethyste: { id: "amethyste", name: "Améthyste", kind: "gem", description: "Une pierre violette, taillée en brillant.", w: 1, h: 1, maxStack: 99, rarity: "uncommon", value: 20 },
  saphir: { id: "saphir", name: "Saphir", kind: "gem", description: "Un bleu profond qui accroche la moindre lueur.", w: 1, h: 1, maxStack: 99, rarity: "rare", value: 50 },
  emeraude: { id: "emeraude", name: "Émeraude", kind: "gem", description: "Taillée à degrés, d'un vert très pur.", w: 1, h: 1, maxStack: 99, rarity: "rare", value: 100 },
  diamant: { id: "diamant", name: "Diamant", kind: "gem", description: "Il brille même dans le noir. Ou presque.", w: 1, h: 1, maxStack: 99, rarity: "rare", value: 200 },
  // ---- Sacs (emplacement « sac ») : la toile au départ, puis plus grand. ----
  sac_toile: { id: "sac_toile", name: "Sac en toile", kind: "bag", description: "Un sac de toile grossière. 6 × 4 cases.", w: 2, h: 2, maxStack: 1, level: 1, bagCols: 6, bagRows: 4 },
  sac_cuir: { id: "sac_cuir", name: "Sac de cuir", kind: "bag", description: "Un sac à rabat, solide. 7 × 5 cases.", w: 2, h: 2, maxStack: 1, rarity: "uncommon", level: 3, bagCols: 7, bagRows: 5 },
  sac_voyage: { id: "sac_voyage", name: "Sac d'aventurier", kind: "bag", description: "Un grand sac à dos, couverture roulée dessus. 8 × 6 cases.", w: 2, h: 2, maxStack: 1, rarity: "rare", level: 6, bagCols: 8, bagRows: 6 },
  // ---- Potions ----
  potion_jouvence: { id: "potion_jouvence", name: "Potion de jouvence", kind: "use", description: "Jaune et pétillante. Rend tous vos points à répartir, plus un. La voie choisie, elle, ne change pas.", w: 1, h: 1, maxStack: 3, rarity: "rare", potion: "youth" },
  potion_poison: { id: "potion_poison", name: "Potion de poison", kind: "use", description: "Enduire : vos 15 prochains coups qui portent empoisonnent. Lancer : un nuage empoisonné en croix.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "poison", throwRange: 5 },
  potion_vitesse: { id: "potion_vitesse", name: "Potion de vitesse", kind: "use", description: "Pendant 4 tours, chaque attaque au corps à corps frappe deux fois.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "haste" },
  potion_feu: { id: "potion_feu", name: "Potion de feu", kind: "use", description: "À lancer : la case visée et ses quatre voisines brûlent pendant 5 tours.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "fire", throwRange: 5 },
  potion_fumee: { id: "potion_fumee", name: "Fiole de fumée", kind: "use", description: "À lancer : un nuage gris ; les monstres tout près (2 cases) perdent votre trace et restent un tour hébétés. Un cadeau de Krik.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "smoke", throwRange: 5 },
  potion_brouillard: { id: "potion_brouillard", name: "Potion de brouillard", kind: "use", description: "Noire et épaisse. À lancer : une nappe de brouillard en losange, cinq cases de large. Personne n'y voit : de quoi fuir.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "fog", throwRange: 5 },
  potion_oursin: { id: "potion_oursin", name: "Potion d'oursin", kind: "use", description: "Brune et piquante. Pendant 40 tours, 15 % des dégâts reçus au contact reviennent à l'attaquant.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "urchin" },
  // ---- Bibelots (emplacement « artefact », Thomas 2026-11-12) ----
  oeil_chauve_souris: { id: "oeil_chauve_souris", name: "Œil de chauve-souris", kind: "artifact", description: "Desséché, il palpite encore. Vous devinez l'ombre des monstres hors de vue : à 10 cases, et à 3 à travers un mur ou une porte.", w: 1, h: 1, maxStack: 1, rarity: "rare" },
  flute_pan: { id: "flute_pan", name: "Flûte de pan", kind: "artifact", description: "Quelques roseaux liés. En combat, de temps en temps, un air doux endort l'ennemi le plus proche.", w: 1, h: 1, maxStack: 1, rarity: "uncommon" },
  // ---- Objets de quête (2026-11-12) : ils n'apparaissent qu'une fois la tâche donnée, et se rapportent au PNJ. ----
  sac_pommes: { id: "sac_pommes", name: "Sac de pommes de Gluck", kind: "quest", description: "Un sac de toile plein de pommes. À rapporter à Gluck.", w: 1, h: 1, maxStack: 1 },
  magot_krik: { id: "magot_krik", name: "Magot de Krik", kind: "quest", description: "Un coffret lourd qui tinte. À rapporter à Krik… ou pas.", w: 1, h: 1, maxStack: 1 },
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
  gem: "Pierre précieuse",
  bag: "Sac",
  quest: "Objet de quête",
};
