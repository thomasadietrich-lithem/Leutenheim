/**
 * QUÊTE DE LA SECTION 2 : MORILLON, LE KOBOLD CUEILLEUR (Thomas, 2026-11-14 : « la première salle spéciale avec sa
 * première quête : la champignonnière de morilles »). Un vieux Kobold masqué, la hotte au dos, qui cultive des morilles
 * dans les caves. Il vit dans sa champignonnière (salle à thème) ; les cueilleurs de l'étage, eux, ne sont pas ses amis.
 *
 * Sa tâche : ARROSER SES RANGS. Il prête son arrosoir ; chaque case de rang qu'on longe (on marche à côté) est arrosée ;
 * tous les rangs arrosés, on revient le voir : il donne des morilles (elles soignent) et, si on a su lui parler, un
 * masque de toile. Valeurs (C).
 */
export const MORILLON = {
  name: "Morillon",
  maxEncounters: 1,
  /** Morilles données au retour. */
  reward: 3,
};

/** Ce qu'il dit en ouvrant la conversation. */
export const MORILLON_OPENING = [
  "Un vieux Kobold au masque de toile, une hotte d'osier au dos, se redresse entre deux rangs de terre.",
  "« Pas un pas sur mes rangs, hein. Les morilles, c'est fragile. Plus fragile que toi. »",
  "« Mais tu tombes bien. Mes rangs ont soif, et mon dos ne veut plus. »",
];
