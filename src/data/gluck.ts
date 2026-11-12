import type { StatId } from "./skills";

/**
 * QUÊTE 01 — Gluck, le Kobold et ses pommes (Thomas, 2026-11-12 : « implémente quête 1 » ; brouillon `claude/QUETES.md`).
 * Un petit Kobold déserteur, peureux et maladroit, qui veut des pommes (« les potions, ça brûle la gorge »).
 * On le croise au plus 4 fois dans une partie, à des étages de plus en plus profonds ; à chaque fois il a changé :
 * déserteur, commerçant, chef d'entreprise, philosophe. Rien n'est gardé d'une partie à l'autre (Thomas).
 * Valeurs (C) : à confirmer.
 */
export const GLUCK = {
  name: "Gluck",
  /** Chance qu'il se montre sur un étage 1 à 4 d'une section (jamais à l'étage du boss), tant qu'on l'a vu moins de 4 fois. */
  chance: 0.35,
  maxEncounters: 4,
  /** Difficultés cachées des jets : facile, moyen, dur. */
  dc: { easy: 9, medium: 12, hard: 15 },
  /** Prix d'une pomme quand il est commerçant : s'il vous aime bien, sinon. */
  applePriceFriend: 6,
  applePrice: 12,
  /** « Au prix d'une potion de jouvence » : la pomme qu'il essaie de vous vendre quand le marché rate. */
  scamPrice: 80,
  /** Sommes qu'on peut investir dans son commerce de pommes ; retour ×2 (or) et 2 pommes, sauf une fois sur 5. */
  invest: [10, 20, 40],
  investLoss: 0.2,
  /** Le tuyau du philosophe : les Kobolds de l'étage s'endorment. */
  sleepTurns: 30,
  /** Vol raté : l'alerte monte de tant, et un Kobold frondeur accourt. */
  stealAlarm: 10,
} as const;

/** Les répliques d'ouverture, selon la rencontre (1 à 4) et l'humeur de Gluck. */
export const GLUCK_OPENING: Record<1 | 2 | 3 | 4, (mood: number) => string[]> = {
  1: () => [
    "« Psst ! Humain ! Par ici ! »",
    "« Je veux partir. Je déteste cet endroit. »",
    "Vous : « Tu es un Kobold. »",
    "« Et alors ? Je peux détester mon travail ! J'ai besoin de pommes. Beaucoup de pommes. Les potions, ça brûle la gorge. »",
  ],
  2: (mood) =>
    mood < 0
      ? ["« Encore toi… »", "« J'ai des pommes. Mais pour toi, c'est plus cher. Paie d'abord. »"]
      : ["« Hé ! Mon humain préféré ! »", "« J'ai encore des pommes. Tu as de l'or ? »"],
  3: () => ["« Les affaires marchent ! Tu veux investir ? »", "Vous : « Dans quoi ? »", "« Des pommes. »"],
  4: () => [
    "« Finalement, le donjon n'est pas si mal. »",
    "Vous : « Tu as changé d'avis ? »",
    "« Non. J'ai trouvé une meilleure cachette. »",
  ],
};

/** Un choix du dialogue : son texte, et le jet qu'il demande (caractéristique et difficulté), s'il y en a un. */
export interface GluckChoice {
  id: string;
  label: string;
  stat?: StatId;
  dc?: keyof typeof GLUCK.dc;
}

export const STAT_NAMES: Partial<Record<StatId, string>> = { force: "Force", agilite: "Agilité", intelligence: "Intelligence", charisme: "Charisme" };
