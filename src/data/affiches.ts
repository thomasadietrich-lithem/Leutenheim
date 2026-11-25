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
  // Dix de plus (Thomas, 2026-11-25 : « génère 10 autres affiches »).
  { art: "afficheAvis", text: "« PERDU : un coq nommé Monseigneur. Répond au nom de Monseigneur, mais pas toujours. Ne pas le regarder dans les yeux. »" },
  { art: "afficheTexte", text: "« Le saviez-vous ? Le Poulet d'argent a traversé la Grande Route sans regarder. Personne ne sait ce qu'il y avait de l'autre côté. Personne n'a osé suivre. »" },
  { art: "afficheTexte", text: "« Cantine des fidèles. Menu du jour : graines. Menu de demain : graines. Les plaintes se déposent dans la boîte à plaintes (le puits). »" },
  { art: "afficheDechiree", text: "« …ainsi parla le Grand Caqueteur : “Celui qui pond dans le doute ne couve que des questions.” Et les fidèles se turent, car c'était profond, ou alors… » (La suite est arrachée.)" },
  { art: "afficheTexte", text: "« Recrutement : le culte cherche des volontaires pour garder l'œuf sacré. Qualités requises : patience, chaleur, aucun goût pour l'omelette. »" },
  { art: "afficheAvis", text: "« ATTENTION : poulet enragé signalé dans les couloirs. Ne courez pas : il court plus vite. Ne vous cachez pas : il trouve. Priez, peut-être. »" },
  { art: "afficheTexte", text: "« Calendrier des fêtes : la Nuit des Plumes, la Saint-Ergot, le Jour de la Grande Ponte. Tenue de fête : une plume derrière l'oreille. »" },
  { art: "afficheTexte", text: "« Avis aux Kobolds : il est interdit de vendre des cuisses de poulet dans l'enceinte du temple. Même grillées. SURTOUT grillées. »" },
  { art: "afficheDechiree", text: "« Prophétie : quand trois poulets tourneront en rond autour d'un trou, le monde… » (Quelqu'un a dessiné une omelette par-dessus.)" },
  { art: "afficheTexte", text: "« Objets trouvés : une plume dorée, un dé à vingt faces, un aventurier (endormi). Réclamer auprès du sergent. »" },
];

/** Combien d'affiches par étage (au plus ; il faut un mur du haut libre). */
export const AFFICHES_PER_FLOOR: readonly [number, number] = [1, 2];
