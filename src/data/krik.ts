/**
 * QUÊTE 03 — Krik, le Kobold qui ne sait plus mentir (Thomas, 2026-11-12 : « implémente quête 3 » ; fiche « DARK
 * DUNGEON — Fiches de quêtes 03 & 04 », adaptée dans `claude/QUETES.md` §5).
 * Un Kobold marchand, nerveux et bavard, victime d'une expérience ratée au laboratoire : il ne peut plus mentir. Il a
 * trahi ses camarades pour garder le butin ; ils le pourchassent. On le croise au plus 3 fois dans une partie, de plus
 * en plus bas : la confession, le retour du menteur, le grand commerçant. Il n'est jamais tout à fait fiable.
 * Valeurs (C) : à confirmer.
 */
export const KRIK = {
  name: "Krik",
  maxEncounters: 3,
  /** Échec de « le protéger » : il achète sa tranquillité avec un peu d'or. */
  hushMin: 5,
  hushMax: 10,
  /** Ses caches (réussi) : de l'or, plus un objet du butin de l'étage. */
  cacheGoldMin: 10,
  cacheGoldMax: 20,
  /** Tâche « magot » ratée : on descend avec le magot, il vaut tant d'or (C). */
  keptMagot: 15,
  /** Menace ratée : il crie (+10 d'alerte) et un Kobold frondeur accourt. */
  shoutAlarm: 10,
  /** Diversion réussie : des fioles de fumée. */
  smokeFlasks: 2,
  /** Diversion ratée : ses poursuivants arrivent (Kobolds alertés). */
  pursuers: 2,
  /** Rencontre 2 : un objet « garanti » pour ce prix… une fois sur 4, c'est une pomme. */
  sellPrice: 15,
  sellLie: 0.25,
  /** Rencontre 2 : il ment aux monstres pour vous ; l'alerte baisse d'autant. */
  lieAlarm: 20,
  /** Rencontre 2 : la prime des Kobolds quand on le dénonce. */
  bountyMin: 20,
  bountyMax: 30,
  /** Rencontre 3 : un objet à consommer à prix cassé ; un objet rare après marchandage. */
  discountPrice: 8,
  rarePrice: 40,
  /** Rencontre 3 : investir ; rendu ×2 à l'étage suivant, sauf s'il a « tout revendu trois fois » (1 fois sur 3). */
  investStake: 20,
  investLoss: 1 / 3,
} as const;

/** Les répliques d'ouverture, selon la rencontre (1 à 3) ; `denounced` : on l'a dénoncé à la rencontre 2. */
export const KRIK_OPENING: Record<1 | 2 | 3, (denounced: boolean) => string[]> = {
  1: () => [
    "« Bonjour aventurier ! »",
    "Vous : « Tu vends quelque chose ? »",
    "« Oui. Des objets volés à mes camarades. »",
    "Vous : « Tu es honnête, au moins. »",
    "« Non. Je suis malade. Une expérience ratée, au laboratoire. Depuis, je ne peux plus mentir. »",
    "« Mes camarades savent que je les ai trahis. »",
    "Vous : « Pourquoi les avoir trahis ? »",
    "« Parce que je voulais garder tout le butin. Maintenant, ils veulent me tuer. Tu peux m'aider ? »",
  ],
  2: (denounced) => [
    denounced ? "« Toi ! Tu m'as… non, je suis ravi de te voir. Vraiment. »" : "« Je vais beaucoup mieux ! »",
    "Vous : « Tu mens ? »",
    "« Non. »",
    "Vous : « Donc tu mens. »",
    "« … »",
  ],
  3: (denounced) => [
    denounced ? "« Ah. Le délateur. Les affaires sont les affaires : entre. »" : "« J'ai fait fortune ! »",
    "Vous : « Comment ? »",
    "« En vendant les mêmes objets trois fois. »",
  ],
};
