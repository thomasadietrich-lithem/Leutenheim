/**
 * Affiches parchemin du culte du poulet (Thomas, 2026-11-24 : « des affiches RP, pas interactives » ; « Ok » pour les
 * six textes). Du décor accroché au mur du haut d'une salle : on les touche pour les lire, rien de plus.
 * `art` : le dessin (art/affiches_v1.py).
 */
export const AFFICHES: readonly { art: "afficheAvis" | "afficheTexte" | "afficheDechiree"; text: string }[] = [
  { art: "afficheAvis", text: "« RECHERCHÉ — Poulet d'or, dit \"le Fugitif\". Évadé du saint poulailler. Mord. Récompense : une poignée de grains bénits. »" },
  { art: "afficheTexte", text: "« Avant la torche, il y avait l'Œuf. Avant l'Œuf, il y avait le Poulet. Qui demande ce qu'il y avait avant le Poulet sera plumé. »" },
  { art: "afficheTexte", text: "« Règlement du culte : ne jamais manger de poulet le jour du Grand Caquet. Saluer chaque plume tombée. Ne jamais, jamais traverser une route. »" },
  { art: "afficheTexte", text: "« Ce soir, Grand Caquet dans la chapelle. Apportez vos plus belles plumes. Les retardataires nettoieront le perchoir. »" },
  { art: "afficheDechiree", text: "« …et quand le Poulet d'argent ne revint pas, les fidèles levèrent les yeux et virent la lune, pâle et ronde comme un œuf. \"Il a pondu le ciel\", dirent-ils. Ce jour-là naquit… » (La suite est arrachée.)" },
  { art: "afficheTexte", text: "« Qui a encore lâché les poules dans la salle du trésor ? Troisième fois cette semaine. Signé : le sergent, qui en a assez. »" },
];

/** Combien d'affiches par étage (au plus ; il faut un mur du haut libre). */
export const AFFICHES_PER_FLOOR: readonly [number, number] = [1, 2];
