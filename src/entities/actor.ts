import { Dice } from "../core/dice";

/** Tout ce qui agit dans le donjon : le héros comme les monstres. */
export interface Actor {
  id: number;
  kind: "hero" | "monster";
  /** Identifiant de la fiche dans src/data (monstre) ou "hero". */
  defId: string;
  name: string;
  x: number;
  y: number;
  /** Case occupée au début du tour, pour l'animation. */
  fromX: number;
  fromY: number;
  hp: number;
  maxHp: number;
  armorClass: number;
  attackBonus: number;
  damage: Dice;
  /** Portée de vue, en cases. */
  vision: number;
  /** Un monstre non alerté n'a pas remarqué le héros : il ne bouge pas et se fait attaquer avec avantage. */
  alerted: boolean;
  /** Monstre endormi : immobile, remarque mal le héros. Un monstre ni alerté ni endormi se promène. */
  asleep: boolean;
  /** Le héros vient de lui échapper en passant une porte : il ne se laisse plus surprendre tant qu'il ne l'a pas rattrapé. */
  wary?: boolean;
  /** Le Kobold de la salle de bain, sorti de l'eau : savon (tours de désavantage restants), serviette, fuite. */
  bather?: boolean;
  soapy?: number;
  fleeing?: boolean;
  /** Un Kobold blessé qui détale : tours de fuite restants ; le tirage n'a lieu qu'une fois. */
  fleeTurns?: number;
  /** Position au début du tour précédent (pour savoir d'où il venait à son dernier pas : règle de l'avantage). */
  prevX?: number;
  prevY?: number;
  /** À terre (renversé par une poussée, Thomas 2026-11-13) : il perd son tour à se relever ; on le frappe avec l'avantage. */
  prone?: number;
  /** Agrandi (potion d'agrandissement, Thomas 2026-11-13) : tours restants ; dégâts doublés, il ne passe plus les portes. */
  grown?: number;
  /** Glissant (potion glissante, Thomas 2026-11-13) : pour toujours ; chaque coup reçu le fait glisser et rebondir. */
  slippery?: boolean;
  /** Pétrifié (potion de pierre lancée) : tours restants ; il ne bouge plus et sert d'abri. */
  petrified?: number;
  fleeChecked?: boolean;
  /** Il a perdu la trace du héros caché : il reste sur place à regarder autour de lui pendant tant de tours. */
  lost?: number;
  /** Numéro de la cible que ce personnage vient de frapper AVEC avantage : jamais deux avantages de suite sur elle. */
  lastAdvantageOn?: number;
  /** Sonné (poussé par le héros) : il perd ce nombre de tours. */
  stunned?: number;
  /** Quêtes v3 : la bougie du dortoir soufflée, ce dormeur n'entend plus rien (seul un coup le réveille). */
  deaf?: boolean;
  /** En feu : encore tant de tours de brûlure après avoir quitté les flammes. */
  burning?: number;
  /** Ralenti (bousculade) : ne joue qu'un tour sur deux pendant ce nombre de tours. */
  slowed?: number;
  /** Empoisonné : perd `damage` PV au début de chacun de ses `turns` prochains tours. */
  poison?: { damage: number; turns: number };
  /** Englué (toile, morsure d'araignée) : il perd ce nombre de déplacements (il peut encore frapper). */
  stuck?: number;
  /** Vers où il regarde (monstres) : son éventail de vue part de là. */
  facing?: "up" | "down" | "left" | "right";
  /** Ronde : il ne se promène que dans ce rectangle (sa salle). */
  patrol?: { x: number; y: number; w: number; h: number };
  /** Destination de promenade d'un monstre qui se balade. */
  goal?: { x: number; y: number };
  /** Taille en cases (2 : un carré de 2 × 2 dont `x, y` est la case du haut à gauche). 1 par défaut. */
  size?: number;
  /** Bloqué face à un autre monstre (numéro) depuis tant de tours : deux monstres qui se bloquent finissent par se battre. */
  blockedBy?: number;
  blockedTurns?: number;
  /** Or qu'il lâche en mourant, à coup sûr (le Kobold qui compte : autant de pièces que son nombre). */
  purse?: number;
  /** Combattant du tripot de Fifrelin (Thomas, 2026-11-14) : le champion, le petit, ou le champion qui vous affronte. */
  arena?: "champ" | "small" | "duel";
  /** Querelle (Thomas, 2026-11-12) : il se bat contre ce monstre (numéro) jusqu'à ce que l'un des deux tombe. */
  feud?: number;
  /** Boss : où il en est de son combat (avance, recule, tapi…), voir `src/core/boss.ts`. */
  boss?: BossState;
}

/** État de combat de la Tisseuse (sauvegardé avec elle). */
export interface BossState {
  /** AVANCE vers le héros pour mordre, RECULE (vers un cocon, sa grande toile ou l'anneau), ou reste TAPIE quelques tours. */
  phase: "advance" | "retreat" | "lurk";
  /** Morsures depuis qu'elle s'est avancée, et ses PV à ce moment-là. */
  bites: number;
  hpMark: number;
  /** Où elle va (case du haut à gauche), et pour quoi faire en arrivant. */
  dest?: { x: number; y: number; eat?: { x: number; y: number } };
  /** Tours qu'elle reste encore tapie. */
  lurk: number;
  /** Dernière case où elle a senti le héros. */
  target?: { x: number; y: number };
  /** Leurre : une flèche plantée dans une toile l'attire ici, encore tant de tours. */
  lure?: { x: number; y: number; turns: number };
  /** Renversée sur le dos (grande toile effondrée) : sonnée encore tant de tours. */
  fallen: number;
  /** Les œufs ont éclos (à mi-vie), la grande toile tient encore, le combat est engagé. */
  hatched: boolean;
  hubUp: boolean;
  engaged: boolean;
}
