/**
 * Arbre de compétences du Guerrier, étage 1 (Thomas, 2026-11-11 ; secondaires proposées par Claude, validées par « Ok. Tout »).
 * Une voie se choisit au niveau 2, une fois pour toutes ; puis une compétence secondaire de cette voie aux niveaux 4, 6 et 8.
 */

export type PathId = "blue" | "red" | "green";

export type SkillId =
  | "peau_dure"
  | "recuperation"
  | "dernier_rempart"
  | "coup_puissant"
  | "enchainement"
  | "rage"
  | "pas_de_cote"
  | "impact"
  | "charge";

export interface PathDef {
  id: PathId;
  /** Nom de la compétence principale. */
  name: string;
  /** Couleur de la voie (cadre, texte). */
  color: string;
  description: string;
  secondaries: { id: SkillId; name: string; description: string }[];
}

export const PATHS: Record<PathId, PathDef> = {
  blue: {
    id: "blue",
    name: "Second souffle",
    color: "#4a8fd0",
    description: "Une fois par étage, en un tour : +10 PV.",
    secondaries: [
      { id: "peau_dure", name: "Peau dure", description: "+1 à la classe d'armure." },
      { id: "recuperation", name: "Récupération", description: "Le repos rend tous les PV manquants, et non la moitié." },
      { id: "dernier_rempart", name: "Dernier rempart", description: "Une fois par étage, un coup qui vous tuerait vous laisse à 1 PV." },
    ],
  },
  red: {
    id: "red",
    name: "Double frappe",
    color: "#d03a44",
    description: "Trois fois par étage : deux coups d'épée en un seul tour.",
    secondaries: [
      { id: "coup_puissant", name: "Coup puissant", description: "Coup critique sur 19 ou 20 au corps à corps." },
      { id: "enchainement", name: "Enchaînement", description: "Tuer un ennemi au corps à corps rend une double frappe (3 au plus)." },
      { id: "rage", name: "Rage", description: "+2 dégâts au corps à corps sous la moitié de vos PV." },
    ],
  },
  green: {
    id: "green",
    name: "Bousculade",
    color: "#5cc860",
    description: "Pousser repousse jusqu'à 3 cases et ralentit l'ennemi 3 tours.",
    secondaries: [
      { id: "pas_de_cote", name: "Pas de côté", description: "Se dégager à +3, d'un saut de 3 cases." },
      { id: "impact", name: "Impact", description: "Un ennemi poussé contre un mur encaisse 2d6 au lieu de 1d6." },
      { id: "charge", name: "Charge", description: "Après deux pas en ligne droite, le premier coup fait 1d6 de plus." },
    ],
  },
};

/** Niveau où l'on choisit sa voie, et niveaux qui donnent une compétence secondaire. */
export const PATH_LEVEL = 2;
export const SECONDARY_LEVELS = [4, 6, 8];

/** Caractéristiques où placer les points gagnés à chaque niveau (la fouille est à part). */
export type StatId = "vie" | "force" | "agilite" | "intelligence" | "charisme";
export const STAT_LABELS: Record<StatId, { name: string; hint: string }> = {
  vie: { name: "Vie", hint: "+4 PV max" },
  force: { name: "Force", hint: "pousser, dégâts au contact" },
  agilite: { name: "Agilité", hint: "se dégager, tir à l'arc" },
  // Thomas, 2026-11-11 : viendront les quêtes et les conditions d'objet ; la magie dépendra de l'Intelligence.
  intelligence: { name: "Intelligence", hint: "magie (à venir)" },
  charisme: { name: "Charisme", hint: "quêtes, marchands (à venir)" },
};
