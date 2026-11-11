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
  loot: { item: ItemId; min: number; max: number; weight: number }[];
}

export const THEMED_ROOMS: ThemedRoomDef[] = [
  {
    id: "dortoir",
    name: "Dortoir",
    loot: [
      { item: "or", min: 8, max: 16, weight: 3 },
      { item: "pomme", min: 1, max: 2, weight: 2 },
      { item: "sac_cuir", min: 1, max: 1, weight: 1 },
    ],
  },
];

/** Meubles : ceux qui bloquent leur(s) case(s), leur largeur en cases. Les chaises debout et le tapis ne bloquent pas. */
export const FURNITURE_KINDS: Record<string, { blocks: boolean; w: number; h: number }> = {
  bunkA: { blocks: true, w: 2, h: 1 },
  bunkB: { blocks: true, w: 2, h: 1 },
  table: { blocks: true, w: 2, h: 1 },
  chairR: { blocks: false, w: 1, h: 1 },
  chairL: { blocks: false, w: 1, h: 1 },
  chairFallen: { blocks: true, w: 1, h: 1 },
  rug: { blocks: false, w: 3, h: 2 },
  rugB: { blocks: false, w: 3, h: 2 },
};
