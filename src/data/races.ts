import { ItemId } from "./items";

/** Une race apporte de petits ajustements et quelques traits passifs (détail : `claude/RACES.md` du Projet). */
export interface RaceDef {
  id: string;
  name: string;
  /** Jouable dès maintenant ? Sinon la case est grisée dans l'écran de nouvelle partie. */
  available: boolean;
  /** Phrase courte affichée sur la case. */
  tagline: string;
  /** Traits, décrits dans la fiche détaillée (une ligne par trait). */
  traits: string[];
  /** PV ajoutés à ceux de la classe (le Guerrier en a 10). */
  hpBonus: number;
  /** Rayon de la lueur portée par le héros : ce qu'il voit dans le noir. */
  darkVision: number;
  /** Distance maximale à laquelle il distingue une zone éclairée. */
  sight: number;
  /** Caractéristiques de départ, en plus des points placés. */
  force: number;
  agilite: number;
  charisme: number;
  /** Bonus au d20 pour se cacher. */
  stealthBonus: number;
  /** Bonus (négatif) au d20 de l'action « Pousser ». */
  pushBonus: number;
  /** PETIT : n'importe quel meuble voisin sert d'abri pour se cacher, même s'il ne bloque pas (chaise…). */
  smallCover: boolean;
  /** PIEDS NUS : les monstres qui sentent les pas (myconide) ne le sentent qu'à cette distance au plus. */
  tremorRange?: number;
  /** GOURMAND : PV en plus à chaque nourriture mangée. */
  foodBonus: number;
  /** TÊTU : une fois par étage, il relance un d20 raté. */
  stubborn: boolean;
  /** OPPORTUNISTE : quand un monstre à son contact s'éloigne, il le frappe (coup gratuit, avec l'avantage). */
  opportunist: boolean;
  /** ARCHER : bonus au jet à l'arc. */
  bowBonus: number;
  /** ARCHER : pas de désavantage pour tirer vers une case qu'il ne voit pas. */
  blindShot: boolean;
  /** ŒIL DE LYNX : avantage à l'arc sur une cible à cette distance ou plus (0 : jamais). */
  lynxRange: number;
  /** Objets de départ, en plus de ceux de la classe. Ni potion ni or (Thomas, 2026-11-16). */
  startingItems: { item: ItemId; count: number }[];
}

const BASE = {
  darkVision: 4,
  sight: 11,
  force: 0,
  agilite: 0,
  charisme: 0,
  stealthBonus: 0,
  pushBonus: 0,
  smallCover: false,
  foodBonus: 0,
  stubborn: false,
  opportunist: false,
  bowBonus: 0,
  blindShot: false,
  lynxRange: 0,
};

/** Races (Thomas, 2026-11-16). */
export const RACES = {
  humain: {
    ...BASE,
    id: "humain",
    name: "Humain",
    available: true,
    tagline: "Il tient bon.",
    traits: [
      "Têtu : une fois par étage, il relance un d20 raté.",
      "Opportuniste : quand un monstre à son contact s'éloigne, il le frappe, avec l'avantage.",
      "Départ : une torche et une cuisse de poulet.",
    ],
    hpBonus: 2,
    stubborn: true,
    opportunist: true,
    startingItems: [
      { item: "torche", count: 1 },
      { item: "cuisse_poulet", count: 1 },
    ],
  },
  halfelin: {
    ...BASE,
    id: "halfelin",
    name: "Halfelin",
    available: true,
    tagline: "Il esquive et se cache.",
    traits: [
      "Agile : Agilité +2.",
      "Petit : Discrétion +3 ; n'importe quel meuble lui sert d'abri.",
      "Pieds nus : les myconides le sentent de moins loin.",
      "Gourmand : toute nourriture lui rend 3 PV de plus.",
      "Faiblesse : Pousser −2.",
      "Départ : deux pommes.",
    ],
    hpBonus: -1,
    agilite: 2,
    stealthBonus: 3,
    pushBonus: -2,
    smallCover: true,
    tremorRange: 3,
    foodBonus: 3,
    startingItems: [{ item: "pomme", count: 2 }],
  },
  elfe: {
    ...BASE,
    id: "elfe",
    name: "Elfe",
    available: true,
    tagline: "Il tire de loin et parle bien.",
    traits: [
      "Vue perçante : il voit plus loin, dans le noir comme en lumière.",
      "Archer : +2 à l'arc ; pas de désavantage vers une case qu'il ne voit pas.",
      "Œil de lynx : avantage à l'arc sur une cible à 5 cases ou plus.",
      "Beau parleur : Charisme +5.",
      "Faiblesse : Force −1.",
      "Départ : dix flèches de plus.",
    ],
    hpBonus: 0,
    darkVision: 6,
    sight: 13,
    force: -1,
    charisme: 5,
    bowBonus: 2,
    blindShot: true,
    lynxRange: 5,
    startingItems: [{ item: "fleche", count: 10 }],
  },
} satisfies Record<string, RaceDef>;
