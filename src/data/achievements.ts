/**
 * MUR DE SUCCÈS (Thomas, 2026-11-14 : « design un mur de succès » → maquette art/succes_v1.html, « Fonce »).
 * Chaque succès a trois rangs : cuivre, argent, or. Toutes les parties s'additionnent (salle d'essai exclue).
 * Pour en ajouter un : une ligne ici (son picto dans `src/ui/medals.ts`), puis ce qui le fait avancer dans
 * `src/ui/achievements.ts` (`onEvent`). Valeurs (C).
 */
/** Rubriques d'une page (Thomas, 2026-11-16) : les boss à part, puis combat, quêtes, exploration, et une par classe. */
export type AchievementGroup = "boss" | "combat" | "quetes" | "exploration" | "classe";

/** Une page de succès par race (Thomas, 2026-11-16 : « dupliquer la page en 3 pages »). */
export const ACHIEVEMENT_PAGES = [
  { id: "humain", name: "Humain" },
  { id: "halfelin", name: "Halfelin" },
  { id: "elfe", name: "Elfe" },
] as const;
export type AchievementPage = (typeof ACHIEVEMENT_PAGES)[number]["id"];

/** Les rubriques de classe, dans l'ordre ; une classe sans succès s'affiche « bientôt ». */
export const CLASS_SECTIONS = [
  { id: "guerrier", name: "Guerrier" },
  { id: "assassin", name: "Assassin" },
  { id: "magicien", name: "Magicien" },
] as const;

export interface AchievementDef {
  id: string;
  name: string;
  group: AchievementGroup;
  /** Ce qui compte, en une phrase (la fiche du mur). */
  what: string;
  /** Seuils cuivre, argent, or. */
  tiers: [number, number, number];
  /** « count » : un total qui monte ; « best » : le meilleur résultat d'une partie ; « low » : le plus petit (tours). */
  kind: "count" | "best" | "low";
  /** Un succès de quête : le PNJ (les missions différentes réussies comptent). */
  npc?: "gluck" | "soeur" | "krik" | "grum" | "fifrelin" | "morillon" | "vernis" | "maestro" | "plumeau" | "clavicule" | "osselet";
  /** Un succès de classe : seule cette classe le fait avancer. */
  cls?: "guerrier" | "assassin" | "magicien";
}

export const TIER_NAMES = ["cuivre", "argent", "or"] as const;

/** Les issues du tripot de Fifrelin qui comptent comme ses « missions ». */
export const FIFRELIN_FEATS = ["fifre_champ", "fifre_petit", "fifre_truque", "fifre_duel"] as const;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "chasseur", name: "Chasseur", group: "combat", what: "Vaincre des monstres, toutes parties confondues.", tiers: [25, 100, 500], kind: "count" },
  { id: "bourreau", name: "Bourreau", group: "combat", what: "Infliger des dégâts, toutes parties confondues.", tiers: [500, 2500, 10000], kind: "count" },
  // Les boss, à part (Thomas, 2026-11-16 : « isole les kills de boss dans une section »).
  { id: "tisseuse", name: "Tisseuse", group: "boss", what: "Vaincre la Tisseuse.", tiers: [1, 5, 20], kind: "count" },
  { id: "carillon", name: "Carillon", group: "boss", what: "Vaincre le Carillon.", tiers: [1, 5, 20], kind: "count" },
  // Section 3 (Thomas, 2026-11-20 : « tu as mis à jour les succès ? »).
  { id: "pretresse", name: "Grande Prêtresse", group: "boss", what: "Vaincre la Grande Prêtresse et son Colosse.", tiers: [1, 5, 20], kind: "count" },
  { id: "course", name: "Course", group: "boss", what: "Atteindre la Tisseuse en peu de tours (une partie).", tiers: [1500, 1000, 600], kind: "low" },
  { id: "bousculeur", name: "Bousculeur", group: "combat", what: "Réussir des poussées.", tiers: [5, 25, 100], kind: "count" },
  { id: "fuyard", name: "Fuyard", group: "combat", what: "Se dégager d'un ennemi au contact (jet réussi).", tiers: [5, 20, 50], kind: "count" },
  { id: "intouchable", name: "Intouchable", group: "combat", what: "Quitter un étage vers le bas sans avoir perdu de vie, après y avoir vaincu au moins un monstre.", tiers: [1, 3, 5], kind: "count" },
  { id: "ombre", name: "Ombre", group: "combat", what: "Vaincre un monstre qui ne vous avait pas vu venir.", tiers: [10, 50, 200], kind: "count" },
  { id: "pyromane", name: "Pyromane", group: "combat", what: "Vaincre des monstres en feu.", tiers: [5, 25, 100], kind: "count" },
  { id: "alchimiste", name: "Alchimiste", group: "combat", what: "Lancer des potions.", tiers: [5, 25, 100], kind: "count" },
  { id: "gluck", name: "Gluck", group: "quetes", what: "Réussir les missions de Gluck (chacune compte une fois).", tiers: [1, 4, 7], kind: "count", npc: "gluck" },
  { id: "soeur", name: "Sœur Osseuse", group: "quetes", what: "Réussir les missions de Sœur Osseuse.", tiers: [1, 2, 4], kind: "count", npc: "soeur" },
  { id: "krik", name: "Krik", group: "quetes", what: "Réussir les missions de Krik.", tiers: [1, 4, 8], kind: "count", npc: "krik" },
  { id: "grum", name: "Grum", group: "quetes", what: "Réussir les missions de Grum.", tiers: [1, 2, 3], kind: "count", npc: "grum" },
  // 2026-11-18 (Thomas : « pense aux succès associés ») : Vernis, Plumeau, le Maestro, et le chapardage.
  // 2026-11-21 : il manquait, et rendre sa quête faisait planter le compteur (Thomas : conversation bloquée, héros figé).
  { id: "morillon", name: "Morillon", group: "quetes", what: "Aider Morillon : arroser ses rangs de morilles, et le faire avec de bonnes manières.", tiers: [1, 2, 2], kind: "count", npc: "morillon" },
  { id: "vernis", name: "Vernis", group: "quetes", what: "Réussir les missions de Vernis : retrouver le Grand Poulet d'Or, poser sur le socle, voler une pomme dorée.", tiers: [1, 2, 3], kind: "count", npc: "vernis" },
  { id: "plumeau", name: "Plumeau", group: "quetes", what: "Aider Plumeau : la clef du geôlier, briser sa chaîne, lui lire le registre.", tiers: [1, 2, 3], kind: "count", npc: "plumeau" },
  { id: "clavicule", name: "Sœur Clavicule", group: "quetes", what: "Aider Sœur Clavicule : briser des crânes, rallumer ses cierges, lui parler de sa sœur, obtenir sa bénédiction.", tiers: [1, 2, 4], kind: "count", npc: "clavicule" },
  { id: "osselet", name: "Maître Osselet", group: "quetes", what: "Aider Maître Osselet : retrouver la corne, lire l'écriteau, toucher le tricératops sans se faire gronder.", tiers: [1, 2, 3], kind: "count", npc: "osselet" },
  { id: "maestro", name: "Mélomane", group: "quetes", what: "Rendre sa partition au Maestro, puis faire chanter le diapason.", tiers: [1, 5, 15], kind: "count" },
  { id: "chapardeur", name: "Chapardeur", group: "quetes", what: "Voler sans être pris : pommes dorées de l'exposition, canard du bain.", tiers: [1, 5, 15], kind: "count" },
  { id: "fifrelin", name: "Fifrelin", group: "quetes", what: "Gagner au tripot de Fifrelin : sur le champion, sur le petit, en trichant, en duel.", tiers: [1, 2, 4], kind: "count", npc: "fifrelin" },
  { id: "fouineur", name: "Fouineur", group: "exploration", what: "Trouver des salles secrètes.", tiers: [1, 5, 15], kind: "count" },
  { id: "portier", name: "Portier", group: "exploration", what: "Ouvrir des portes verrouillées : crochetées, enfoncées ou à la clef.", tiers: [25, 100, 400], kind: "count" },
  { id: "profondeur", name: "Plus bas", group: "exploration", what: "Descendre le plus bas possible (une partie).", tiers: [3, 5, 10], kind: "best" },
  { id: "radin", name: "Radin", group: "exploration", what: "Gagner de l'or (ramassé, trouvé, vendu, gagné), toutes parties confondues.", tiers: [500, 2500, 10000], kind: "count" },
  { id: "pilleur", name: "Pilleur", group: "exploration", what: "Ouvrir des coffres et des sarcophages.", tiers: [10, 50, 200], kind: "count" },
  { id: "poulet", name: "Côôt !", group: "exploration", what: "Effrayer des poulets.", tiers: [1, 5, 15], kind: "count" },
  // Guerrier (Thomas, 2026-11-16 : « une section par classe ; suggère des succès pour le guerrier »).
  { id: "critique", name: "Coup critique", group: "classe", cls: "guerrier", what: "Porter des coups critiques (Guerrier).", tiers: [10, 50, 200], kind: "count" },
  { id: "assommeur", name: "Assommeur", group: "classe", cls: "guerrier", what: "Assommer des ennemis d'un coup (Guerrier).", tiers: [5, 25, 100], kind: "count" },
  { id: "net", name: "Net !", group: "classe", cls: "guerrier", what: "Vaincre un monstre intact d'un seul coup (Guerrier).", tiers: [10, 50, 200], kind: "count" },
  { id: "rempart", name: "Dernier rempart", group: "classe", cls: "guerrier", what: "Survivre à un coup mortel grâce au Dernier rempart (Guerrier).", tiers: [1, 5, 20], kind: "count" },
  // Quatre de plus (Thomas, 2026-11-17 : « fonce sur tous ces points ») ; seuils (C).
  { id: "doubleFrappe", name: "Double frappe", group: "classe", cls: "guerrier", what: "Utiliser la Double frappe (Guerrier).", tiers: [5, 25, 100], kind: "count" },
  { id: "secondSouffle", name: "Second souffle", group: "classe", cls: "guerrier", what: "Se soigner avec le Second souffle (Guerrier).", tiers: [20, 100, 400], kind: "count" },
  { id: "tank", name: "Tank", group: "classe", cls: "guerrier", what: "Encaisser des dégâts (Guerrier).", tiers: [200, 1000, 5000], kind: "count" },
  { id: "charge", name: "Charge", group: "classe", cls: "guerrier", what: "Mettre des ennemis à terre d'une poussée (Guerrier).", tiers: [5, 25, 100], kind: "count" },
  // Rang III (2026-11-20) ; seuils (C).
  { id: "executeur", name: "Exécuteur", group: "classe", cls: "guerrier", what: "Achever des ennemis par l'Exécution (Guerrier).", tiers: [5, 25, 100], kind: "count" },
  { id: "bastion", name: "Bastion", group: "classe", cls: "guerrier", what: "Repousser des ennemis pendant le Bastion (Guerrier).", tiers: [5, 25, 100], kind: "count" },
];

/** Le succès des succès (Thomas, 2026-11-16) : des médailles de la page ; l'or, c'est la page entière. */
export const MASTER_ID = "maitre";

/** Le rang atteint pour cette valeur : -1 (aucun), 0 cuivre, 1 argent, 2 or. */
export function tierOf(def: AchievementDef, value: number): number {
  let t = -1;
  def.tiers.forEach((need, i) => {
    if (def.kind === "low" ? value > 0 && value < need : value >= need) t = i;
  });
  return t;
}
