/**
 * Arbre de compétences du Guerrier, étage 1 (Thomas, 2026-11-11 ; secondaires proposées par Claude, validées par « Ok. Tout »).
 * Une voie se choisit au niveau 2, une fois pour toutes ; ensuite un point de voie à chaque niveau (voir PROGRESSION).
 */

/** La voie verte « Bousculade » a été retirée (Thomas, 2026-11-11 : « retire la voie bousculade »). */
export type PathId = "blue" | "red";

export type SkillId =
  | "peau_dure"
  | "recuperation"
  | "dernier_rempart"
  | "coup_puissant"
  | "enchainement"
  | "rage";

/** Un pouvoir de voie : le principal (celui du bouton) ou un des trois autres. */
export type PowerId = "second_souffle" | "double_frappe" | SkillId;

/** Un pouvoir et ce qu'il fait à chacun de ses trois rangs. */
export interface PowerDef {
  id: PowerId;
  name: string;
  ranks: [string, string, string];
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
    description: "Une fois par étage, en un tour : +4 PV. Se renforce.",
    main: { id: "second_souffle", name: "Second souffle", ranks: ["+4 PV, une fois par étage", "+7 PV, une fois par étage", "+10 PV, une fois par étage"] },
    secondaries: [
      { id: "peau_dure", name: "Peau dure", ranks: ["+1 à la classe d'armure", "+2 à la classe d'armure", "+3 à la classe d'armure"] },
      { id: "recuperation", name: "Récupération", ranks: ["Le repos rend tous les PV manquants", "Repos complet, deux fois plus court", "Repos court, deux fois par étage"] },
      { id: "dernier_rempart", name: "Dernier rempart", ranks: ["Un coup mortel vous laisse à 1 PV (1 fois par étage)", "Un coup mortel vous laisse à 5 PV (1 fois par étage)", "Un coup mortel vous laisse à 5 PV (2 fois par étage)"] },
    ],
  },
  red: {
    id: "red",
    name: "Double frappe",
    color: "#d03a44",
    description: "Deux fois par étage : deux coups d'épée en un seul tour. Se renforce.",
    main: { id: "double_frappe", name: "Double frappe", ranks: ["Deux fois par étage", "Trois fois par étage", "Quatre fois par étage"] },
    secondaries: [
      { id: "coup_puissant", name: "Coup puissant", ranks: ["Critique sur 18 à 20 ; un critique assomme", "Critique sur 17 à 20 ; un critique assomme", "Critique sur 16 à 20 ; un critique assomme"] },
      { id: "enchainement", name: "Soif de combat", ranks: ["Chaque ennemi tué rend 1 PV (4 par étage)", "Chaque ennemi tué rend 2 PV (7 par étage)", "Chaque ennemi tué rend 3 PV (10 par étage)"] },
      { id: "rage", name: "Rage", ranks: ["+1 dégât sous la moitié des PV", "+2 dégâts sous la moitié des PV", "+3 dégâts sous la moitié des PV"] },
    ],
  },
};

/** Rang le plus haut d'un pouvoir. */
export const MAX_RANK = 3;

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
