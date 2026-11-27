/**
 * Arbre de compétences du Guerrier, étage 1 (Thomas, 2026-11-11 ; secondaires proposées par Claude, validées par « Ok. Tout »).
 * Une voie se choisit au niveau 2, une fois pour toutes ; ensuite un point de voie à chaque niveau (voir PROGRESSION).
 */

/** La voie verte « Bousculade » a été retirée (Thomas, 2026-11-11 : « retire la voie bousculade »). */
export type PathId = "blue" | "red";

export type SkillId =
  | "peau_dure"
  | "esquive"
  | "dernier_rempart"
  | "coup_puissant"
  | "enchainement"
  | "rage"
  // RANG II (Thomas, 2026-11-17 : « 4 capacités de rang 2 », dès le niveau 6) : voie bleue, puis voie rouge.
  | "riposte"
  | "garde"
  | "encaisseur"
  | "tourbillon"
  | "charge"
  | "cri_guerre"
  // RANG III (Thomas, 2026-11-19 : « Posture. Implémente dans la démo »), dès le niveau 11 : bleue, puis rouge.
  | "bastion"
  | "sang_froid"
  | "posture"
  | "execution"
  | "frenesie"
  | "soif_sang";

/** Les capacités qui s'utilisent (un bouton dans la barre Capacités), en dehors du pouvoir principal. */
export type ActivePower = "tourbillon" | "charge" | "cri_guerre" | "bastion" | "execution";

/** Un pouvoir de voie : le principal (celui du bouton) ou un des trois autres. */
export type PowerId = "second_souffle" | "double_frappe" | SkillId;

/** Un pouvoir et ce qu'il fait à chacun de ses trois rangs. */
export interface PowerDef {
  id: PowerId;
  name: string;
  /** Deux rangs (quatre pour le pouvoir principal : I et II au Rang I, III et IV au Rang II). */
  ranks: string[];
}

export interface PathDef {
  id: PathId;
  /** Nom de la voie (celui du pouvoir principal). */
  name: string;
  /** Couleur de la voie (cadre, texte). */
  color: string;
  /** Ce que fait le pouvoir principal, en une phrase (au rang 1). */
  description: string;
  /** Le pouvoir principal (rang 1 à la prise de la voie), puis les trois autres. */
  main: PowerDef;
  secondaries: PowerDef[];
  /** Rang II : trois pouvoirs nouveaux, ouverts au niveau 6 (le principal y continue, rangs 3 et 4). */
  tier2: PowerDef[];
  /** Rang III : trois pouvoirs nouveaux, ouverts au niveau 11 (le principal y continue, rangs 5 et 6). */
  tier3: PowerDef[];
}

/**
 * PROGRESSION (Thomas, 2026-11-11 : « un point à chaque niveau, améliorer les pouvoirs à chaque fois, plus faibles au
 * début ») : la voie se choisit au niveau 2 et donne le rang 1 de son pouvoir principal ; ensuite CHAQUE niveau donne un
 * point de voie, à mettre dans n'importe quel pouvoir de la voie (3 rangs chacun). Valeurs (C).
 */
export const PATHS: Record<PathId, PathDef> = {
  blue: {
    id: "blue",
    name: "Second souffle",
    color: "#4a8fd0",
    description: "Une fois par étage, en un tour : +3 PV. Se renforce.",
    main: { id: "second_souffle", name: "Second souffle", ranks: ["+3 PV, une fois par étage", "+5 PV, une fois par étage", "+7 PV, une fois par étage", "+9 PV, une fois par étage", "+11 PV, une fois par étage", "+13 PV, une fois par étage"] },
    secondaries: [
      { id: "peau_dure", name: "Peau dure", ranks: ["+1 à la classe d'armure, au-dessus de la moitié de vos PV", "+2 à la classe d'armure, au-dessus de la moitié de vos PV"] },
      // Thomas (2026-11-13) : remplace Récupération (« deux sources de soin direct, c'est trop »).
      { id: "esquive", name: "Esquive", ranks: ["+2 en agilité ; se dégager saute une case plus loin", "+4 en agilité ; se dégager saute une case plus loin"] },
      { id: "dernier_rempart", name: "Dernier rempart", ranks: ["Un coup mortel vous laisse à 1 PV (1 fois par partie)", "Un coup mortel vous laisse à 5 PV (1 fois par section)"] },
    ],
    tier2: [
      { id: "riposte", name: "Riposte", ranks: ["Un ennemi au contact vous rate : vous ripostez, avec le désavantage (une fois tous les trois tours)", "La riposte frappe normalement"] },
      { id: "garde", name: "Garde", ranks: ["+2 à la classe d'armure quand deux ennemis ou plus vous touchent", "+3 à la classe d'armure quand deux ennemis ou plus vous touchent"] },
      { id: "encaisseur", name: "Encaisseur", ranks: ["+1 à l'absorption de votre armure, à chaque coup", "+2 à l'absorption de votre armure, à chaque coup"] },
    ],
    tier3: [
      { id: "bastion", name: "Bastion", ranks: ["Une fois par étage, 3 tours : dégâts reçus divisés par deux, et qui vous touche au contact recule d'une case", "Dure 4 tours"] },
      { id: "sang_froid", name: "Sang-froid", ranks: ["+3 à la classe d'armure sous le quart de vos PV", "+4 à la classe d'armure sous le quart de vos PV"] },
      { id: "posture", name: "Posture", ranks: ["+1 à la classe d'armure quand vous ne vous déplacez pas de votre tour", "+2 à la classe d'armure quand vous ne vous déplacez pas de votre tour"] },
    ],
  },
  red: {
    id: "red",
    name: "Double frappe",
    color: "#d03a44",
    description: "Deux fois par étage : deux coups d'épée en un seul tour. Se renforce.",
    main: { id: "double_frappe", name: "Double frappe", ranks: ["Deux fois par étage", "Trois fois par étage", "Quatre fois par étage", "Cinq fois par étage", "Six fois par étage", "Sept fois par étage"] },
    secondaries: [
      { id: "coup_puissant", name: "Coup puissant", ranks: ["Critique sur 18 à 20 ; un critique assomme", "Critique sur 17 à 20 ; un critique assomme"] },
      // Thomas (2026-11-13) : remplace Soif de combat, pour faire vivre l'action « Pousser ».
      { id: "enchainement", name: "Bousculade", ranks: ["+2 pour pousser ; la poussée envoie une case plus loin", "+4 pour pousser ; la poussée envoie une case plus loin"] },
      { id: "rage", name: "Rage", ranks: ["+1 dégât sous la moitié des PV", "+2 dégâts sous la moitié des PV"] },
    ],
    tier2: [
      { id: "tourbillon", name: "Tourbillon", ranks: ["Une fois par étage : un coup à chaque ennemi au contact", "Deux fois par étage : un coup à chaque ennemi au contact"] },
      { id: "charge", name: "Charge", ranks: ["Fond sur un ennemi à 2 cases en ligne droite et frappe à +2 (2 fois par étage)", "Jusqu'à 3 cases, frappe à +3 (3 fois par étage)"] },
      { id: "cri_guerre", name: "Cri de guerre", ranks: ["Une fois par étage : les ennemis à 3 cases ont le désavantage 2 tours ; les plus faibles peuvent fuir", "Le désavantage dure 3 tours"] },
    ],
    tier3: [
      { id: "execution", name: "Exécution", ranks: ["Deux fois par étage : achève net un ennemi au contact sous le quart de ses PV (pas un boss)", "Trois fois par étage, sous 30 % de ses PV"] },
      { id: "frenesie", name: "Frénésie", ranks: ["+1 dégât par coup qui porte d'affilée, jusqu'à +3 ; retombe au premier tour sans toucher", "Jusqu'à +4"] },
      { id: "soif_sang", name: "Soif de sang", ranks: ["Chaque ennemi que vous tuez rend 2 PV (une fois par tour)", "Rend 3 PV"] },
    ],
  },
};

/** Rang le plus haut d'un pouvoir. */
/** Deux rangs par pouvoir (Thomas, 2026-11-13 : « garder de la marge pour après le boss et les niveaux suivants »). */
export const MAX_RANK = 2;
/** Le pouvoir principal monte jusqu'au rang 6 (rangs 3 et 4 au Rang II, 5 et 6 au Rang III). */
export const MAIN_MAX_RANK = 6;
/** Niveau où s'ouvre le Rang III ; le Rang II ne reçoit plus de point ensuite (Thomas, 2026-11-19). */
export const TIER3_LEVEL = 11;
/** Niveau où s'ouvre le Rang II ; le Rang I ne reçoit plus de point ensuite (Thomas, 2026-11-17). */
export const TIER2_LEVEL = 6;

/** Niveau où l'on choisit sa voie (un point de voie à chaque niveau ensuite). */
export const PATH_LEVEL = 2;

/** Caractéristiques où placer les points gagnés à chaque niveau (la fouille est à part). */
export type StatId = "vie" | "force" | "agilite" | "intelligence" | "charisme";
export const STAT_LABELS: Record<StatId, { name: string; hint: string }> = {
  vie: { name: "Vie", hint: "+4 PV max" },
  force: { name: "Force", hint: "pousser, dégâts au contact" },
  agilite: { name: "Agilité", hint: "esquive, tir, pièges, serrures" },
  // Thomas, 2026-11-11 : viendront les quêtes et les conditions d'objet ; la magie dépendra de l'Intelligence.
  intelligence: { name: "Intelligence", hint: "magie (à venir)" },
  charisme: { name: "Charisme", hint: "quêtes, marchands (à venir)" },
};
