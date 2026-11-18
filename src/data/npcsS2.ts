/**
 * PNJ ajoutés le 2026-11-18 (Thomas : « fonce, livre 100 % ») : une rencontre chacun par partie. Valeurs (C).
 *
 * VERNIS, le Kobold conservateur du HALL D'EXPOSITION (section 2) : gilet violet, lorgnon. Le Grand Poulet d'Or a été
 * volé sur son socle. Deux missions : le retrouver (ticket d'exposition) ou poser sur le socle, immobile, trois tours, pour
 * tromper le public (pinceau magique). Les pommes dorées sous cloche se volent (discrétion), mais pas sous ses yeux.
 *
 * LE MAESTRO, chef d'orchestre de la SALLE DE CONCERT (section 2) : queue-de-pie, baguette. Sa partition a disparu :
 * la retrouver lui rend le sourire (diapason).
 *
 * PLUMEAU, le greffier ENCHAÎNÉ de la PRISON (section 1, quête 06) : vieil humain, lunettes, plume. On trouve la clef du
 * geôlier, ou l'on brise sa chaîne (Force) ; libre, il montre le plan de l'étage. On peut aussi lui lire le registre
 * (Intelligence) : il dit où est l'escalier.
 */
export const VERNIS = {
  name: "Vernis",
  opening: [
    "Un Kobold en gilet violet ajuste son lorgnon devant un socle vide.",
    "« Bienvenue au Hall. Ne touchez à rien. Surtout pas aux pommes. »",
    "« Quelqu'un a volé le Grand Poulet d'Or. Mon chef-d'œuvre. Le public arrive bientôt, et le socle est VIDE. »",
  ],
  /** Le vol d'une pomme dorée sous cloche : d20 + discrétion contre cette difficulté ; raté : +15 d'alerte. */
  stealDc: 12,
  stealAlarm: 15,
};

export const MAESTRO = {
  name: "Le Maestro",
  opening: [
    "Un Kobold en queue-de-pie agite sa baguette devant des chaises vides.",
    "« Silence ! … Ah, c'est vous. Le public. Enfin, un public. »",
    "« Ma partition a disparu. Sans elle, l'orchestre ne sait plus rien. Il ne savait pas grand-chose avant. »",
  ],
};

export const PLUMEAU = {
  name: "Plumeau",
  opening: [
    "Un vieil homme enchaîné au mur, des lunettes au bout du nez, tient encore sa plume.",
    "« Ah ! Un visiteur. Je suis Plumeau, greffier. On m'a enchaîné ici avec le registre : je recopiais trop bien. »",
    "« La clef du geôlier traîne quelque part. À moins que vous n'ayez des bras pour la chaîne. »",
  ],
  /** Libéré : un peu d'or (C). */
  gold: 20,
};
