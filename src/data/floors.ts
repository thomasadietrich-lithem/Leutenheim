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
  /** Une porte n'est posée que si la contourner demande plus de pas que ceci (sinon elle ne sert à rien). */
  doorDetour: number;
  /** Nombre de salles spéciales (verrouillées) par étage, avec le poids de chaque cas. Toujours au moins une. */
  specialRoomCounts: { count: number; weight: number }[];
  specialRoomMinSize: number;
  specialRoomMaxSize: number;
  /** Probabilité qu'une salle assez grande (5×5 au moins) ait des colonnes, derrière lesquelles se cacher. */
  pillarChance: number;
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
  doorDetour: 14,
  // 1 salle : 60 %, 2 salles : 30 %, 3 salles : 10 % → 1,5 en moyenne.
  specialRoomCounts: [
    { count: 1, weight: 6 },
    { count: 2, weight: 3 },
    { count: 3, weight: 1 },
  ],
  specialRoomMinSize: 3,
  specialRoomMaxSize: 5,
  pillarChance: 0.45,
  torchChance: 0.5,
  torchRadius: 6,
};
