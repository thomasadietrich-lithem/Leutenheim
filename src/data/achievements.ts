/**
 * MUR DE SUCCÈS (Thomas, 2026-11-14 : « design un mur de succès » → maquette art/succes_v1.html, « Fonce »).
 * Chaque succès a trois rangs : cuivre, argent, or. Toutes les parties s'additionnent (salle d'essai exclue).
 * Pour en ajouter un : une ligne ici (son picto dans `src/ui/medals.ts`), puis ce qui le fait avancer dans
 * `src/ui/achievements.ts` (`onEvent`). Valeurs (C).
 */
export type AchievementGroup = "combat" | "quetes" | "exploration";

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
  npc?: "gluck" | "soeur" | "krik" | "grum" | "fifrelin";
}

export const TIER_NAMES = ["cuivre", "argent", "or"] as const;

/** Les issues du tripot de Fifrelin qui comptent comme ses « missions ». */
export const FIFRELIN_FEATS = ["fifre_champ", "fifre_petit", "fifre_truque", "fifre_duel"] as const;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "chasseur", name: "Chasseur", group: "combat", what: "Vaincre des monstres, toutes parties confondues.", tiers: [25, 100, 500], kind: "count" },
  { id: "bourreau", name: "Bourreau", group: "combat", what: "Infliger des dégâts, toutes parties confondues.", tiers: [500, 2500, 10000], kind: "count" },
  { id: "tisseuse", name: "Tisseuse", group: "combat", what: "Vaincre la Tisseuse.", tiers: [1, 5, 20], kind: "count" },
  { id: "course", name: "Course", group: "combat", what: "Atteindre la Tisseuse en peu de tours (une partie).", tiers: [1500, 1000, 600], kind: "low" },
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
  { id: "fifrelin", name: "Fifrelin", group: "quetes", what: "Gagner au tripot de Fifrelin : sur le champion, sur le petit, en trichant, en duel.", tiers: [1, 2, 4], kind: "count", npc: "fifrelin" },
  { id: "fouineur", name: "Fouineur", group: "exploration", what: "Trouver des salles secrètes.", tiers: [1, 5, 15], kind: "count" },
  { id: "portier", name: "Portier", group: "exploration", what: "Ouvrir des portes verrouillées : crochetées, enfoncées ou à la clef.", tiers: [3, 10, 30], kind: "count" },
  { id: "profondeur", name: "Plus bas", group: "exploration", what: "Descendre le plus bas possible (une partie).", tiers: [3, 5, 10], kind: "best" },
  { id: "radin", name: "Radin", group: "exploration", what: "Gagner de l'or (ramassé, trouvé, vendu, gagné), toutes parties confondues.", tiers: [500, 2500, 10000], kind: "count" },
  { id: "pilleur", name: "Pilleur", group: "exploration", what: "Ouvrir des coffres et des sarcophages.", tiers: [10, 50, 200], kind: "count" },
  { id: "poulet", name: "Côôt !", group: "exploration", what: "Effrayer des poulets.", tiers: [1, 5, 15], kind: "count" },
];

/** Le rang atteint pour cette valeur : -1 (aucun), 0 cuivre, 1 argent, 2 or. */
export function tierOf(def: AchievementDef, value: number): number {
  let t = -1;
  def.tiers.forEach((need, i) => {
    if (def.kind === "low" ? value > 0 && value < need : value >= need) t = i;
  });
  return t;
}
