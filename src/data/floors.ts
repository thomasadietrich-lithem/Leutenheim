/** Réglages de génération d'un étage. Modifier ici change la forme des donjons, sans toucher au moteur. */
export interface FloorConfig {
  width: number;
  height: number;
  /** Nombre de tentatives de placement de salles. */
  roomAttempts: number;
  minRooms: number;
  roomMinSize: number;
  roomMaxSize: number;
  /** Couloirs supplémentaires, pour créer des boucles. */
  extraLinks: number;
  /** Probabilité qu'un couloir fasse deux cases de large. */
  wideCorridorChance: number;
}

export const DEFAULT_FLOOR: FloorConfig = {
  width: 32,
  height: 32,
  roomAttempts: 40,
  minRooms: 4,
  roomMinSize: 4,
  roomMaxSize: 8,
  extraLinks: 2,
  wideCorridorChance: 0.3,
};
