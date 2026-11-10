/** Une race apporte de petits ajustements et un trait passif. */
export interface RaceDef {
  id: string;
  name: string;
  /** Jouable dès maintenant ? Sinon la case est grisée dans l'écran de nouvelle partie. */
  available: boolean;
  /** Phrase courte affichée sur la case. */
  tagline: string;
  /** Trait, décrit dans la fiche détaillée. */
  trait: string;
  hpBonus: number;
  /** Rayon de la lueur portée par le héros : ce qu'il voit dans le noir. */
  darkVision: number;
  /** Distance maximale à laquelle il distingue une zone éclairée. */
  sight: number;
}

export const RACES = {
  humain: {
    id: "humain",
    name: "Humain",
    available: true,
    tagline: "Polyvalent et endurant.",
    trait: "Robuste : 2 points de vie supplémentaires.",
    hpBonus: 2,
    darkVision: 4,
    sight: 11,
  },
  halfelin: {
    id: "halfelin",
    name: "Halfelin",
    available: false,
    tagline: "Petit et chanceux.",
    trait: "Chanceux : relance tout 1 obtenu au dé à 20 faces.",
    hpBonus: 0,
    darkVision: 4,
    sight: 11,
  },
  elfe: {
    id: "elfe",
    name: "Elfe",
    available: false,
    tagline: "Une vue perçante.",
    trait: "Voit plus loin dans le noir et repère les pièges.",
    hpBonus: 0,
    darkVision: 6,
    sight: 13,
  },
} satisfies Record<string, RaceDef>;
