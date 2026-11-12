/**
 * QUÊTE 02 — Sœur Osseuse et la cloche disparue (Thomas, 2026-11-12 : « implémente quête 2 » ; brouillon `claude/QUETES.md` §4).
 * Un squelette en voile de nonne déchiré, chapelet d'os, très digne, autoritaire : elle ignore qu'elle est morte. Les
 * Kobolds lui ont volé sa cloche, et elle est PERDUE POUR TOUJOURS : aucune quête ne la fait retrouver.
 * On la croise au plus 4 fois dans une partie, de plus en plus bas : la colère, la reconstruction, la nouvelle religion,
 * la sérénité (avec un tambour). Elle donne surtout des bénédictions (statuts du héros). Valeurs (C) : à confirmer.
 */
export const SOEUR = {
  name: "Sœur Osseuse",
  maxEncounters: 4,
  /** PROTECTION : +1 classe d'armure pendant 150 tours. */
  protectBonus: 1,
  protectTurns: 150,
  /** MALÉDICTION DES KOBOLDS : +2 dégâts contre les Kobolds, tout l'étage. */
  curseBonus: 2,
  /** CHANCE : les 3 prochains 1 naturels au dé du héros sont relancés. */
  luckRerolls: 3,
  /** Cloche de fortune ratée : un bruit épouvantable. */
  craftAlarm: 5,
  /** Chaque coup de tambour (rencontre 4). */
  drumAlarm: 3,
  /** Donation (rencontre 3) : de 15 à 30 or. */
  donationMin: 15,
  donationMax: 30,
  /** Mise en garde réussie (rencontre 3) : ses Kobolds fidèles quittent l'étage. */
  faithfulLeave: 2,
} as const;

/** Les répliques d'ouverture, selon la rencontre (1 à 4) ; `grudge` : on lui a reparlé de la cloche. */
export const SOEUR_OPENING: Record<1 | 2 | 3 | 4, (grudge: boolean) => string[]> = {
  1: () => [
    "« Halte. On ne court pas dans une chapelle. »",
    "Vous : « Vous êtes… un squelette. »",
    "« Quelle grossièreté. »",
    "Vous : « Pourquoi êtes-vous si fâchée ? »",
    "« Parce que je suis contrariée. Les Kobolds ont volé ma cloche. MA cloche. »",
  ],
  2: () => ["« Vous encore. »", "« Je vous préviens : NE PARLONS PAS DE LA CLOCHE. »"],
  3: (grudge) => [
    grudge ? "« Ah. Celui qui parle de cloches. »" : "« Mon enfant ! Venez voir ! »",
    "(Deux Kobolds en robe de bure prient à côté d'elle, très sages.)",
    "« Mes fidèles. Ils ont trouvé la foi. Ils chantent faux, mais ils chantent. »",
  ],
  4: () => [
    "BOUM ! BOUM !",
    "« J'ai maintenant un tambour. Il est beaucoup plus bruyant. »",
    "Vous : « Et la cloche ? »",
    "« Quelle cloche ? »",
  ],
};
