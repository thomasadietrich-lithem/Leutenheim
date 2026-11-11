import { ItemId } from "./items";

/**
 * Salles à thème. Les cinq premiers essais (garde-manger, ossuaire, bibliothèque, dortoir, forge, mobilier v1) ont été
 * retirés le 2026-11-11 (Thomas : « l'identité n'est pas assez forte ») ; on les refait une par une. D'abord le
 * DORTOIR des Schrats (planche art/dortoir_v3.png) : lits superposés contre le mur du haut, cheminée, table et chaises,
 * parfois une chaise renversée, un tapis usé posé de travers.
 */
export interface ThemedRoomDef {
  id: string;
  name: string;
  /** Butin de la cache : objet, quantité de min à max, poids. `or` : la quantité grandit avec l'étage. */
  loot: { item: ItemId; min: number; max: number; weight: number; minDepth?: number }[];
}

export const THEMED_ROOMS: ThemedRoomDef[] = [
  {
    id: "dortoir",
    name: "Dortoir",
    loot: [
      { item: "or", min: 8, max: 16, weight: 3 },
      { item: "pomme", min: 1, max: 2, weight: 2 },
      { item: "sac_cuir", min: 1, max: 1, weight: 1, minDepth: 5 }, // pas avant la fin de la section 1 (Thomas)
    ],
  },
];

/**
 * Meubles : ceux qui bloquent leur(s) case(s), leur taille en cases, s'ils brûlent. Les chaises debout, le tapis et les
 * cendres ne bloquent pas. Un meuble qui brûle met le feu à ses voisins (à une case) et laisse un tas de cendres.
 */
export const FURNITURE_KINDS: Record<string, { blocks: boolean; w: number; h: number; burns: boolean }> = {
  bunkA: { blocks: true, w: 2, h: 1, burns: true },
  bunkB: { blocks: true, w: 2, h: 1, burns: true },
  table: { blocks: true, w: 2, h: 1, burns: true },
  tableApple: { blocks: true, w: 2, h: 1, burns: true },
  chairR: { blocks: false, w: 1, h: 1, burns: true },
  chairL: { blocks: false, w: 1, h: 1, burns: true },
  chairFallen: { blocks: true, w: 1, h: 1, burns: true },
  rug: { blocks: false, w: 3, h: 2, burns: true },
  rugB: { blocks: false, w: 3, h: 2, burns: true },
  ashes1: { blocks: false, w: 1, h: 1, burns: false },
  ashes2: { blocks: false, w: 2, h: 1, burns: false },
  // Trainards (planche art/trainards_v3.png, validée) : tonneau, caisse, deux caisses empilées. On se cache derrière.
  barrel: { blocks: true, w: 1, h: 1, burns: true },
  crate: { blocks: true, w: 1, h: 1, burns: true },
  crateStack: { blocks: true, w: 1, h: 1, burns: true },
  // Toiles d'araignée (dès l'étage 3), dans un coin de salle sans torche : TL = coin en haut à gauche, etc. Elles collent.
  webTL: { blocks: false, w: 1, h: 1, burns: true },
  webTR: { blocks: false, w: 1, h: 1, burns: true },
  webBL: { blocks: false, w: 1, h: 1, burns: true },
  webBR: { blocks: false, w: 1, h: 1, burns: true },
};
