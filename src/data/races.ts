import { ItemId } from "./items";

/** Une race apporte de petits ajustements et quelques traits passifs (détail : `claude/RACES.md` du Projet). */
export interface RaceDef {
  id: string;
  name: string;
  /** Jouable dès maintenant ? Sinon la case est grisée dans l'écran de nouvelle partie. */
  available: boolean;
  /** Phrase courte affichée sur la case. */
  tagline: string;
  /** Traits, une ligne par trait (rubrique « Races » du manuel). */
  traits: string[];
  /** Capacités spéciales, montrées avec leur picto sur la fiche « + » (`src/ui/racePictos.ts`). */
  abilities: { id: string; name: string; text: string }[];
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
  /** Tir au contact (Elfe, Thomas 2026-11-16) : pas de désavantage à l'arc quand un ennemi est au contact. */
  closeShot?: boolean;
  /** ŒIL DE LYNX : avantage à l'arc sur une cible à cette distance ou plus (0 : jamais). */
  lynxRange: number;
  /** CARQUOIS SANS FOND : arc en main, les flèches simples ne s'épuisent pas et ne se ramassent plus. */
  endlessArrows: boolean;
  /** Objets de départ, en plus de ceux de la classe. Ni potion ni or (Thomas, 2026-11-16). */
  startingItems: { item: ItemId; count: number }[];
  /** Objets de la classe remplacés par d'autres au départ (le Halfelin : serpe, lance-pierre, pierres). */
  swapItems?: Partial<Record<ItemId, ItemId>>;
  /** Le Halfelin trouve de petits tas de pierres sur chaque étage, et un arc court dans la section 1. */
  stonePiles?: number;
  /** L'Elfe (Thomas, 2026-11-17 : « augmente la distribution de flèches de recul, et donne-en de manière un peu plus
   *  automatique ») : un petit paquet de flèches de recul posé sur chaque étage (le deuxième une fois sur trois). */
  recoilPiles?: boolean;
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
  endlessArrows: false,
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
      "Têtu : une fois par étage, en combat, il relance un coup raté.",
      "Opportuniste : quand un monstre à son contact s'éloigne, il le frappe, avec l'avantage.",
      "Départ : une torche et une cuisse de poulet.",
    ],
    abilities: [
      { id: "tetu", name: "Têtu", text: "Une fois par étage, en combat, il relance un coup ou un tir raté." },
      { id: "opportuniste", name: "Opportuniste", text: "Quand un monstre à son contact s'éloigne, il le frappe, avec l'avantage." },
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
      "Gourmand : toute nourriture lui rend 3 PV de plus.",
      "Faiblesse : Pousser −2.",
      "Départ : une serpe, un lance-pierre et des pierres (plutôt qu'une épée courte, un arc et des flèches), deux pommes.",
      "Des pierres : de petits tas, sur chaque étage ; un arc court à trouver dans la section 1.",
    ],
    abilities: [
      { id: "petit", name: "Petit", text: "N'importe quel meuble lui sert d'abri pour se cacher." },
      { id: "gourmand", name: "Gourmand", text: "Toute nourriture lui rend 3 PV de plus." },
    ],
    hpBonus: -1,
    agilite: 2,
    stealthBonus: 3,
    pushBonus: -2,
    smallCover: true,
    foodBonus: 3,
    startingItems: [{ item: "pomme", count: 2 }],
    swapItems: { epee: "serpe", arc_court: "lance_pierre", fleche: "pierre" },
    stonePiles: 2,
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
      "Tir au contact : pas de désavantage à l'arc quand un ennemi le touche.",
      "Beau parleur : Charisme +5.",
      "Faiblesse : Force −1.",
      "Carquois sans fond : ses flèches simples ne s'épuisent jamais (et ne se ramassent plus).",
      "Départ : huit flèches de recul et deux pains elfiques ; un petit paquet de flèches de recul l'attend sur chaque étage.",
    ],
    abilities: [
      { id: "archer", name: "Archer", text: "+2 à l'arc, et pas de désavantage vers une case qu'il ne voit pas." },
      { id: "lynx", name: "Œil de lynx", text: "Avantage à l'arc sur une cible à 5 cases ou plus." },
      { id: "contact", name: "Tir au contact", text: "Pas de désavantage à l'arc quand un ennemi le touche : il tire même au corps à corps." },
    ],
    hpBonus: 0,
    darkVision: 6,
    sight: 13,
    force: -1,
    charisme: 5,
    bowBonus: 2,
    blindShot: true,
    closeShot: true,
    lynxRange: 5,
    endlessArrows: true,
    recoilPiles: true,
    startingItems: [
      { item: "fleche_recul", count: 8 },
      { item: "pain_elfique", count: 2 },
    ],
  },
} satisfies Record<string, RaceDef>;
