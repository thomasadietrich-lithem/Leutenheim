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
  /** Probabilité qu'une entrée de salle étroite reçoive une porte. */
  doorChance: number;
  /** Deux portes ne sont jamais à moins de ce nombre de cases l'une de l'autre (pas de portes à la suite). */
  doorSpacing: number;
  /** Probabilité qu'une salle en cul-de-sac soit fermée à clé. */
  lockChance: number;
  /** Probabilité qu'une salle ait une torche murale (la salle de départ en a toujours une). */
  torchChance: number;
  torchRadius: number;
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
  doorChance: 0.6,
  doorSpacing: 5,
  lockChance: 0.5,
  torchChance: 0.5,
  torchRadius: 6,
};
