import { Tile } from "../world/map";

/** Un type de salle spéciale : ce qu'on trouve au centre de la salle, derrière sa porte verrouillée. */
export interface SpecialRoomDef {
  id: string;
  name: string;
  weight: number;
  /** Case posée au centre de la salle. */
  feature: Tile;
}

export const SPECIAL_ROOMS: SpecialRoomDef[] = [
  { id: "fontaine", name: "Salle de l'autel", weight: 1, feature: Tile.Fountain },
  { id: "tresor", name: "Salle au trésor", weight: 1, feature: Tile.Chest },
];
