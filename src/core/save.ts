import { Actor } from "../entities/actor";
import { BagItem } from "../items/inventory";
import { Slot } from "../data/items";
import { LightSource } from "../world/fov";
import { Room } from "../world/generator";
import { Point } from "../world/map";
import { Debris, GroundItem, Secret } from "./floor";

/**
 * Sauvegarde d'une partie : de simples données (texte JSON), écrites sur l'appareil à chaque tour.
 * Tout y est pour reprendre exactement là où l'on s'était arrêté, y compris l'état du hasard : une partie reprise
 * continue comme elle aurait continué. Les ordres en cours (chemin, repos, fouille) ne sont pas gardés.
 * Changer la forme de ces données : augmenter `SAVE_VERSION` (les anciennes sauvegardes sont alors ignorées).
 */
export const SAVE_VERSION = 1;

export interface SavedFloor {
  depth: number;
  width: number;
  height: number;
  tiles: string;
  start: Point;
  stairs: Point;
  rooms: Room[];
  torches: LightSource[];
  monsters: Actor[];
  ground: GroundItem[];
  debris: Debris[];
  explored: string;
  sensed: string;
  rng: number;
  seenMonsters: number[];
  population: number;
  nextRespawn: number;
  rested: boolean;
  secrets: Secret[];
  traps: Point[];
  searched: number[];
}

export interface SaveData {
  version: number;
  savedAt: string;
  runSeed: number;
  race: string;
  heroClass: string;
  sandbox: boolean;
  depth: number;
  deepest: number;
  turn: number;
  hero: Actor;
  bag: { items: BagItem[]; nextUid: number };
  equipment: Record<Slot, BagItem | null>;
  gold: number;
  xp: number;
  level: number;
  /** Ajoutés le 2026-11-11 (facultatifs : une sauvegarde plus ancienne se relit sans eux). */
  torchTurns?: number;
  /** Salle d'essai : version de son plan (une sauvegarde d'un ancien plan est ignorée). */
  sandboxLayout?: number;
  clock?: number;
  ammoChoice?: string;
  heroMisses: number;
  hidden: boolean;
  nextId: number;
  lastFoeId: number | null;
  failedDoorAttempts: string[];
  floors: SavedFloor[];
}

/** Octets → texte compact (base64), pour les cartes et les zones explorées. */
export function bytesToText(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function textToBytes(text: string): Uint8Array {
  const s = atob(text);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

/** Copie profonde de simples données (sans fonction ni tableau typé). */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
