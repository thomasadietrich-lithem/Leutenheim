import { Dice } from "../core/dice";

/**
 * Pièges (planche art/pieges_v3.png, validée le 2026-11-11 : « Ok fonce »). La dalle elle-même trahit le piège.
 * Valeurs choisies par Claude, à confirmer (C).
 */
export type TrapKind = "spikes" | "pit" | "needle" | "gas" | "snare" | "hooks" | "spores" | "tombSlab" | "boneHands" | "censer" | "moonMirror" | "pendulum";

export interface TrapDef {
  name: string;
  /** Premier étage où il peut apparaître, et poids au tirage. */
  minDepth: number;
  weight: number;
  /** Sections où il se pose (0 = étages 1-5, 1 = étages 6-10…) ; sans cela, partout. */
  sections?: number[];
  /** Dégâts à qui marche dessus. */
  damage?: Dice;
  /** Poison : PV perdus au début de chacun de ses `turns` prochains tours. */
  poison?: { damage: number; turns: number };
  /** Fosse : on y reste ce nombre de déplacements à remonter. */
  stuck?: number;
  /** Gaz : nuage sur la case et ses quatre voisines pendant ce nombre de tours ; qui s'y tient est empoisonné. */
  gasTurns?: number;
  /** Section 3 : la dalle s'effondre et le reste (comme la fosse) ; nuage d'encens qui ENGOURDIT au lieu d'empoisonner ;
   *  le miroir renvoie la lune (tours) ; la lame pendule, seulement dans les couloirs, ne frappe qu'un tour sur deux. */
  sinks?: boolean;
  numb?: boolean;
  moonFlash?: number;
  corridorOnly?: boolean;
  /** Retiré du jeu (n'est plus posé), le code reste (Thomas, 2026-11-19 : la lame pendule, « nulle »). */
  retired?: boolean;
  swings?: boolean;
}

export const TRAPS: Record<TrapKind, TrapDef> = {
  spikes: { name: "piège à pointes", minDepth: 1, sections: [0], weight: 4, damage: { count: 1, sides: 4, bonus: 1 } },
  pit: { name: "fosse", minDepth: 1, sections: [0], weight: 2, damage: { count: 1, sides: 6, bonus: 0 }, stuck: 1 },
  needle: { name: "aiguille empoisonnée", minDepth: 2, sections: [0], weight: 2, damage: { count: 1, sides: 1, bonus: 0 }, poison: { damage: 1, turns: 4 } },
  gas: { name: "gaz empoisonné", minDepth: 3, sections: [0], weight: 1, gasTurns: 3, poison: { damage: 1, turns: 3 } },
  // Section 2, la champignonnière (Thomas, 2026-11-14 : « des pièges adaptés au sol de la nouvelle section ») : plus de
  // dalles, les pièges vivent dans la mousse et la terre (planche art/pieges_champi_v1.png). Les pièges de la section 1
  // ne s'y posent plus.
  snare: { name: "lacet de mycélium", minDepth: 1, weight: 3, sections: [1], stuck: 2 },
  hooks: { name: "racines-crochets", minDepth: 1, weight: 3, sections: [1], damage: { count: 1, sides: 6, bonus: 0 }, stuck: 1 },
  spores: { name: "vesse-de-loup", minDepth: 1, weight: 2, sections: [1], gasTurns: 3, poison: { damage: 1, turns: 3 } },
  // Section 3, l'Ossuaire (planche art/pieges_oss_v1.png ; Thomas, 2026-11-19 : « Ok »). Valeurs (C).
  tombSlab: { name: "dalle basculante", minDepth: 1, weight: 3, sections: [2], damage: { count: 1, sides: 8, bonus: 0 }, stuck: 1, sinks: true },
  boneHands: { name: "mains d'os", minDepth: 1, weight: 3, sections: [2], damage: { count: 1, sides: 4, bonus: 0 }, stuck: 2 },
  censer: { name: "encensoir", minDepth: 1, weight: 2, sections: [2], gasTurns: 3, numb: true },
  moonMirror: { name: "miroir de lune", minDepth: 1, weight: 2, sections: [2], moonFlash: 6 },
  pendulum: { name: "lame pendule", minDepth: 1, weight: 1, sections: [2], damage: { count: 2, sides: 6, bonus: 2 }, corridorOnly: true, swings: true, retired: true },
};
