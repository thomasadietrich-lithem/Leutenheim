import { ItemId } from "./items";

/**
 * Salles de fouille (2026-11-11, Thomas : « Oui implémente. Mais pour l'instant, pas de règles particulières »).
 * Une salle ordinaire reçoit des meubles le long de ses murs et, souvent, une cache dont le butin suit le thème.
 * Pas encore de règle propre (pas de Tocsin sur un 1, pas de bonus d'Intelligence, pas de sarcophage à ouvrir…).
 */
export interface ThemedRoomDef {
  id: string;
  name: string;
  weight: number;
  /** Meubles possibles (noms des dessins de `src/render/sprites/furniture.ts`). */
  furniture: string[];
  /** Butin de la cache : objet, quantité de min à max, poids. `or` : la quantité grandit avec l'étage. */
  loot: { item: ItemId; min: number; max: number; weight: number }[];
}

export const THEMED_ROOMS: ThemedRoomDef[] = [
  {
    id: "garde_manger",
    name: "Garde-manger",
    weight: 1,
    furniture: ["tonneau", "caisse", "sac_grain"],
    loot: [
      { item: "pomme", min: 2, max: 4, weight: 4 },
      { item: "torche", min: 1, max: 1, weight: 1 },
      { item: "or", min: 4, max: 10, weight: 1 },
    ],
  },
  {
    id: "ossuaire",
    name: "Ossuaire",
    weight: 1,
    furniture: ["os", "sarcophage"],
    loot: [
      { item: "or", min: 10, max: 20, weight: 3 },
      { item: "amethyste", min: 1, max: 1, weight: 2 },
      { item: "saphir", min: 1, max: 1, weight: 1 },
    ],
  },
  {
    id: "bibliotheque",
    name: "Bibliothèque",
    weight: 1,
    furniture: ["etagere", "pupitre"],
    loot: [
      { item: "potion_jouvence", min: 1, max: 1, weight: 1 },
      { item: "potion_vitesse", min: 1, max: 1, weight: 2 },
      { item: "potion_feu", min: 1, max: 1, weight: 2 },
      { item: "or", min: 6, max: 12, weight: 2 },
    ],
  },
  {
    id: "dortoir",
    name: "Dortoir",
    weight: 1,
    furniture: ["paillasse", "malle"],
    loot: [
      { item: "or", min: 8, max: 16, weight: 3 },
      { item: "pomme", min: 1, max: 2, weight: 2 },
      { item: "sac_cuir", min: 1, max: 1, weight: 1 },
    ],
  },
  {
    id: "forge",
    name: "Forge",
    weight: 1,
    furniture: ["enclume", "etabli", "ratelier"],
    loot: [
      { item: "fleche", min: 4, max: 8, weight: 3 },
      { item: "fleche_poison", min: 2, max: 4, weight: 1 },
      { item: "potion_poison", min: 1, max: 1, weight: 1 },
    ],
  },
];
