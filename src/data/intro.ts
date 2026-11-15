/**
 * Synopsis montré au début de chaque nouvelle partie (texte de Thomas, 2026-11-13). Une ligne par paragraphe ; elles
 * apparaissent l'une après l'autre.
 */
export const INTRO_LINES: string[] = [
  "Depuis que quelqu'un, ou quelque chose, a volé la cloche, Leutenheim ne se réveille plus à l'heure.",
  "Le boulanger dort. Le coq a démissionné.",
  "Certains jurent l'entendre sonner la nuit, sous leurs pieds.",
  "On vous a donné une épée, dix flèches et une tape dans le dos.",
  "La cave est par là.",
];

/** Texte d'arrivée de chaque section, à la première arrivée à son premier étage (Thomas, 2026-11-15). */
export const SECTION_LINES: Record<number, string[]> = {
  2: [
    "La Tisseuse ne tissera plus. Vous avez fouillé sa toile : des cocons, des œufs, et pas la moindre cloche.",
    "Derrière elle, l'escalier sent la terre mouillée.",
    "Ici les murs luisent, et des champignons poussent dans tous les sens.",
    "Vous avez gagné des cicatrices, perdu des flèches, et il n'y a plus personne pour la tape dans le dos.",
    "Ça sonne plus bas.",
  ],
};
