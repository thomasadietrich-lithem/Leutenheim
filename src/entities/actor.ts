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
  /** Sonné (poussé par le héros) : il perd ce nombre de tours. */
  stunned?: number;
  /** Ralenti (bousculade) : ne joue qu'un tour sur deux pendant ce nombre de tours. */
  slowed?: number;
  /** Empoisonné : perd `damage` PV au début de chacun de ses `turns` prochains tours. */
  poison?: { damage: number; turns: number };
  /** Ronde : il ne se promène que dans ce rectangle (sa salle). */
  patrol?: { x: number; y: number; w: number; h: number };
  /** Destination de promenade d'un monstre qui se balade. */
  goal?: { x: number; y: number };
}
