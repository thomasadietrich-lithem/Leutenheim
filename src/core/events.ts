import { AttackResult } from "./combat";
import { Actor } from "../entities/actor";
import { ItemId } from "../data/items";
import { Point } from "../world/map";
import { Room } from "../world/generator";
import { PathId } from "../data/skills";

/** Ce qui s'est passé pendant un tour, dans l'ordre : l'affichage les lit, les met en scène, puis vide la liste. */
/** Crocheter (silencieux) ou enfoncer (bruyant) une porte verrouillée. */
export type DoorAction = "pick" | "break" | "key";

export type GameEvent =
  | { type: "attack"; attacker: Actor; target: Actor; result: AttackResult; opportunity?: boolean; ranged?: boolean }
  | {
      type: "arrow";
      fromX: number;
      fromY: number;
      /** Où la flèche finit sa course. */
      x: number;
      y: number;
      /** Si elle a rebondi : la case où elle a heurté l'obstacle avant de retomber. */
      via?: Point;
      hit: boolean;
      kept: boolean;
    }
  | { type: "pickup"; item: ItemId; count: number }
  | { type: "death"; actor: Actor }
  | { type: "noticed"; actor: Actor }
  | { type: "stairs"; direction: "down" | "up"; healed: number }
  /** Le sac est plein : l'objet reste au sol. */
  | { type: "bagFull" }
  | { type: "opened"; x: number; y: number }
  | { type: "fountain"; healed: number }
  /** Se cacher : le jet au d20, et s'il a réussi. */
  | { type: "hide"; d20: number; bonus: number; total: number; success: boolean }
  /** Le héros sort de sa cachette (il attaque, quitte l'abri d'un obstacle, fait du bruit). */
  | { type: "revealed" }
  /** Se dégager : le jet, et s'il a réussi le saut sans attaque d'opportunité. */
  | { type: "jump"; fromX: number; fromY: number; x: number; y: number; d20: number; bonus: number; total: number; success: boolean }
  /** Pousser : le jet ; réussi, le monstre a reculé d'une case, ou heurté un obstacle (dégâts en plus). */
  | { type: "push"; target: Actor; d20: number; bonus: number; total: number; success: boolean; moved: boolean; slam: number }
  /** Quelqu'un a marché sur un piège. */
  | { type: "trap"; x: number; y: number; victim: Actor; damage: number }
  /** Fouille : commencée, interrompue, ou finie avec le jet et les cases où l'on a trouvé quelque chose. */
  | { type: "search"; phase: "start" | "interrupted" }
  | { type: "searched"; d20: number; bonus: number; total: number; success: boolean; found: Point[]; room: Room }
  /** Repos : commencé, mené à son terme (avec les PV rendus) ou interrompu par un monstre. */
  | { type: "rest"; phase: "start" | "done" | "interrupted"; healed: number }
  | { type: "chest"; gold: number }
  /** Objet utilisé (pomme : PV rendus ; torche : allumée), torche éteinte, poison posé et poison qui ronge. */
  | { type: "used"; item: ItemId; healed?: number }
  | { type: "torchOut" }
  /** Voie choisie, compétence de voie utilisée, Dernier rempart, potion (feu lancé, case qui brûle, statut posé). */
  | { type: "path"; path: PathId }
  | { type: "skill"; path: PathId; healed: number }
  | { type: "lastStand" }
  | { type: "fire"; fromX: number; fromY: number; x: number; y: number; cells: Point[] }
  | { type: "burn"; actor: Actor; damage: number }
  | { type: "potion"; potion: "youth" | "poison" | "haste"; points?: number }
  | { type: "slowed"; actor: Actor }
  | { type: "dropped"; item: ItemId; count: number }
  /** Niveau d'alerte : l'étage passe au palier suivant (1 agité, 2 alerte, 3 traque). */
  | { type: "alarm"; stage: number }
  /** Du bruit à cet endroit (porte enfoncée, coups échangés) : il fait monter le tocsin. */
  | { type: "noise"; x: number; y: number; points: number }
  | { type: "poisoned"; actor: Actor }
  | { type: "poison"; actor: Actor; damage: number }
  | { type: "xp"; amount: number }
  | { type: "levelup"; level: number }
  | {
      type: "door";
      action: DoorAction;
      x: number;
      y: number;
      d20: number;
      bonus: number;
      total: number;
      dc: number;
      success: boolean;
      /** Nombre de monstres alertés par le bruit. */
      alerted: number;
    };

/** Pourquoi un tir est refusé. */
export type ShootRefusal = "no-bow" | "no-ammo" | "no-target" | "out-of-range";
