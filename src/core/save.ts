import { Furniture, RoomTheme } from "../world/furnish";
import { Motif } from "../world/grounds";
import type { BossLayout } from "../world/bossFloor";
import { Actor } from "../entities/actor";
import { BagItem } from "../items/inventory";
import { ItemId, Slot } from "../data/items";
import { LightSource } from "../world/fov";
import { Room } from "../world/generator";
import { Point } from "../world/map";
import { BloodStain, Debris, GroundItem, Secret, Trap } from "./floor";
import type { Merchant } from "./merchant";
import type { CounterDoor, GluckSpot } from "./floor";
import type { QuestTask } from "../data/quests";
import type { GluckMemory, KrikMemory, SoeurMemory } from "./game";

/**
 * Sauvegarde d'une partie : de simples données (texte JSON), écrites sur l'appareil à chaque tour.
 * Tout y est pour reprendre exactement là où l'on s'était arrêté, y compris l'état du hasard : une partie reprise
 * continue comme elle aurait continué. Les ordres en cours (chemin, repos, fouille) ne sont pas gardés.
 * Changer la forme de ces données : augmenter `SAVE_VERSION` (les anciennes sauvegardes sont alors ignorées).
 */
export const SAVE_VERSION = 2;

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
  blood?: BloodStain[];
  explored: string;
  sensed: string;
  rng: number;
  seenMonsters: number[];
  population: number;
  nextRespawn: number;
  alarm?: number;
  alarmStage?: number;
  rested: boolean;
  brawls?: number;
  rests?: number;
  secrets: Secret[];
  traps: Trap[];
  searched: number[];
  furniture?: Furniture[];
  themes?: RoomTheme[];
  motifs?: Motif[];
  /** Étage du boss (facultatif). */
  boss?: BossLayout;
  /** Le Colporteur (facultatif). */
  merchant?: Merchant;
  /** La porte du Kobold qui compte (facultatif). */
  counter?: CounterDoor;
  /** Gluck (facultatif). */
  gluck?: GluckSpot;
  /** Sœur Osseuse (facultatif). */
  soeur?: GluckSpot;
  krik?: GluckSpot;
  bath?: import("./floor").BathState;
  chicken?: import("./floor").ChickenState;
  farm?: import("./floor").FloorState["farm"];
  zone?: import("./floor").QuestZone;
  cierges?: import("./floor").FloorState["cierges"];
  grates?: import("./floor").FloorState["grates"];
  goldHen?: import("./floor").FloorState["goldHen"];
  grum?: import("./floor").GluckSpot;
  fifrelin?: import("./floor").GluckSpot;
  courier?: import("./floor").FloorState["courier"];
  secretRoom?: import("./floor").FloorState["secretRoom"];
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
  /** Version 2 (2026-11-11) : points, voie, compétences, potions, feu, taille du sac. */
  points: number;
  alloc: { vie: number; force: number; agilite: number; intelligence?: number; charisme?: number };
  voie: string | null;
  skills: string[];
  /** Rangs des pouvoirs de la voie (2026-11-11 ; absent des anciennes sauvegardes). */
  ranks?: Record<string, number>;
  floorPerks: Record<number, { secondWind: boolean | number; doubleStrikes: number; lastStand: boolean | number; chainRefunds?: number }>;
  weaponPoison: number;
  hasteTurns: number;
  /** Gluck : ce qu'il sait du héros dans cette partie (absent des anciennes sauvegardes). */
  gluck?: GluckMemory;
  /** Sœur Osseuse : ce qu'elle sait du héros ; ses bénédictions en cours (absents des anciennes sauvegardes). */
  soeur?: SoeurMemory;
  /** Krik : ce qu'il sait du héros (absent des anciennes sauvegardes). */
  krik?: KrikMemory;
  grum?: { met: number };
  fifrelin?: { met: number };
  /** La tâche de quête en cours (absente des anciennes sauvegardes). */
  quest?: QuestTask | null;
  xpCarry?: number;
  urchinTurns?: number;
  stoneTurns?: number;
  restHidden?: number;
  blessings?: { protect: number; clarity: number; curse: number; luck: number };
  /** Bénédiction de l'autel (absente des anciennes sauvegardes). */
  blessTurns?: number;
  /** Raccourci « Objet » (absent des anciennes sauvegardes). */
  quickItem?: ItemId | null;
  fires: { x: number; y: number; turns: number; gen?: number }[];
  /** Nuages de gaz empoisonné (absent des sauvegardes d'avant les pièges v3). */
  gas?: { x: number; y: number; turns: number }[];
  fog?: { x: number; y: number; turns: number }[];
  bagSize: { cols: number; rows: number };
  /** Ajoutés le 2026-11-11 (facultatifs : une sauvegarde plus ancienne se relit sans eux). */
  torchOff?: boolean;
  torchTurns?: number;
  /** Salle d'essai : version de son plan (une sauvegarde d'un ancien plan est ignorée). */
  sandboxLayout?: number;
  clock?: number;
  ammoChoice?: string;
  /** Boss vaincus (facultatif, ajouté avec la Tisseuse). */
  bossKills?: number;
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
