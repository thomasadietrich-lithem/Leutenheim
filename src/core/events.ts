import type { QuestTaskId } from "../data/quests";
import { AttackResult } from "./combat";
import { Actor } from "../entities/actor";
import { ItemId } from "../data/items";
import { Point } from "../world/map";
import { Room } from "../world/generator";
import { TrapKind } from "../data/traps";
import { PathId } from "../data/skills";

/** Ce qui s'est passé pendant un tour, dans l'ordre : l'affichage les lit, les met en scène, puis vide la liste. */
/** Crocheter (silencieux) ou enfoncer (bruyant) une porte verrouillée. */
export type DoorAction = "pick" | "break" | "key" | "peek";

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
      /** Une javeline plutôt qu'une flèche (dessin en vol et morceaux brisés). */
      javelin?: boolean;
    }
  | { type: "pickup"; item: ItemId; count: number }
  | { type: "death"; actor: Actor }
  /** Coup de l'arme du héros qui tue net un monstre intact (Thomas : « sentir la différence »), ou qui l'assomme (arme lourde). */
  | { type: "heavyBlow"; actor: Actor; kind: "oneShot" | "stun" | "knockback"; fromX?: number; fromY?: number }
  | { type: "noticed"; actor: Actor }
  | { type: "stairs"; direction: "down" | "up"; healed: number }
  /** Le sac est plein : l'objet reste au sol. */
  | { type: "bagFull"; item?: ItemId; x?: number; y?: number; messy?: boolean }
  /** Un objet tombé sur un escalier rebondit sur la marche et retombe à côté. */
  | { type: "stairsBounce"; item: ItemId; fromX: number; fromY: number; x: number; y: number }
  | { type: "bounce"; item: ItemId; count: number; fromX: number; fromY: number; x: number; y: number; messy?: boolean }
  | { type: "opened"; x: number; y: number }
  | { type: "fountain"; healed: number }
  | { type: "blessEnd" }
  /** Gluck : le héros arrive à côté de lui (la conversation s'ouvre), ou il s'en va. */
  /** Gluck : la conversation s'ouvre, ou il part (« Pouf ! », petit nuage) en laissant tomber ses pommes autour de lui. */
  | { type: "npc"; who: "gluck" | "soeur" | "krik"; what: "talk" | "leave"; fled?: "fire" | "gas"; gold?: number; x?: number; y?: number; drops?: { item: ItemId; x: number; y: number; count: number }[] }
  /** Une statue : on la regarde (`look`), ou on frappe la statue creuse (jet de force ; réussi : elle s'effondre). */
  | { type: "statue"; x: number; y: number; look?: boolean; d20?: number; bonus?: number; total?: number; success?: boolean }
  /** Chance (Sœur Osseuse) : un 1 naturel du héros est relancé. */
  | { type: "luck" }
  /** Un jet de dialogue avec un PNJ de quête (d20 + caractéristique). */
  | { type: "npcRoll"; stat: string; d20: number; bonus: number; total: number; success: boolean }
  /** Le Kobold qui compte derrière sa porte : il compte (`count`), met le doigt dans l'œil (`poke`), ou il est attrapé (`caught`). */
  | { type: "counter"; what: "count" | "poke" | "caught"; n: number; x: number; y: number; first?: boolean }
  /** Le héros sonne la cloche d'alarme : `rings` = combien de fois sur cet étage ; `joke` choisit la moquerie. */
  | { type: "bell"; x: number; y: number; rings: number; joke: number }
  /** Deux monstres se querellent : bloqués face à face dans un couloir, ou touchés par la pierre d'un frondeur. */
  | { type: "feud"; a: Actor; b: Actor; reason: "blocked" | "shot" }
  /** Un monstre en frappe un autre (sans dé à l'écran : le héros regarde). */
  | { type: "infight"; attacker: Actor; target: Actor; hit: boolean; damage: number; ranged?: boolean }
  /** Se cacher : le jet au d20, et s'il a réussi. */
  | { type: "hide"; d20: number; bonus: number; total: number; success: boolean }
  /** Le héros sort de sa cachette (il attaque, quitte l'abri d'un obstacle, fait du bruit). */
  | { type: "revealed" }
  /** Un meuble prend feu. */
  | { type: "furnitureFire"; x: number; y: number; kind: string }
  | { type: "web"; escaped: boolean; roll: number; bonus: number }
  | { type: "webbed"; by: Actor }
  /** Le héros évite d'un bond un piège qu'il vient de déclencher (agilité). */
  | { type: "trapDodged"; x: number; y: number; kind: string; d20: number; bonus: number }
  /** Nichée : une nappe de toile (ou la grande toile) ralentit le héros. */
  | { type: "webSlow"; hub: boolean }
  /** Nichée : un cocon ou un sac d'œufs crevé, une amarre tranchée (il en reste `left`). */
  | { type: "breakWeb"; kind: "cocoon" | "eggs" | "anchor"; left: number; x: number; y: number }
  /** La Tisseuse : réveil, recul, repas, éclosion, leurre, chute, mort… */
  | {
      type: "boss";
      what: "awake" | "retreatCocoon" | "retreatHub" | "retreatRing" | "eat" | "hatch" | "hatchNone" | "lured" | "fallen" | "hubDown" | "rise" | "dead";
      x: number;
      y: number;
      amount?: number;
    }
  | { type: "stuck" }
  | {
      type: "maiden";
      action: "pick" | "break" | "key";
      x: number;
      y: number;
      d20: number;
      bonus: number;
      total: number;
      success: boolean;
      damage: number;
      gold: number;
      item: ItemId;
      count: number;
      drops: Point[];
    }
  /** Le héros marche sur du gravier : ça crisse ; `alerted` monstres l'ont entendu. */
  /** Un pas bruyant : sur le gravier, ou dans l'eau (`water`). */
  | { type: "gravel"; x: number; y: number; alerted: number; water?: boolean }
  /** Se dégager : le jet, et s'il a réussi le saut sans attaque d'opportunité. */
  | { type: "jump"; fromX: number; fromY: number; x: number; y: number; d20: number; bonus: number; total: number; success: boolean }
  /** Pousser : le jet ; réussi, le monstre a reculé d'une case, ou heurté un obstacle (dégâts en plus). */
  | { type: "push"; target: Actor; d20: number; bonus: number; total: number; success: boolean; moved: boolean; slam: number }
  /** Quelqu'un a marché sur un piège. */
  | { type: "trap"; x: number; y: number; victim: Actor; damage: number; kind: TrapKind }
  /** Fouille : commencée, interrompue, ou finie avec le jet et les cases où l'on a trouvé quelque chose. */
  | { type: "search"; phase: "start" | "interrupted" }
  | { type: "searched"; d20: number; bonus: number; total: number; success: boolean; found: Point[]; room: Room }
  /** Repos : commencé, mené à son terme (avec les PV rendus) ou interrompu par un monstre. */
  | { type: "rest"; phase: "start" | "done" | "interrupted"; healed: number }
  | { type: "shop"; line: number }
  | { type: "bought"; item: ItemId; count: number; price: number }
  | { type: "sold"; item: ItemId; count: number; price: number }
  | { type: "merchantHides" }
  | { type: "merchantShows" }
  | { type: "merchantLeaves"; x: number; y: number; seen: boolean }
  | { type: "chest"; gold: number; item: ItemId; count: number; x: number; y: number; drops: { x: number; y: number }[] }
  /** Objet utilisé (pomme : PV rendus ; torche : allumée), torche éteinte, poison posé et poison qui ronge. */
  | { type: "used"; item: ItemId; healed?: number }
  | { type: "torchOut" }
  /** Voie choisie, compétence de voie utilisée, Dernier rempart, potion (feu lancé, case qui brûle, statut posé). */
  | { type: "path"; path: PathId }
  | { type: "skill"; path: PathId; healed: number }
  | { type: "lastStand" }
  | { type: "fire"; fromX: number; fromY: number; x: number; y: number; cells: Point[] }
  /** Une potion lancée vole jusqu'à sa case et y éclate (feu ou poison). */
  | { type: "potionThrown"; item: ItemId; potion: string; fromX: number; fromY: number; x: number; y: number; cells: { x: number; y: number }[] }
  | { type: "burn"; actor: Actor; damage: number }
  | { type: "potion"; potion: "youth" | "poison" | "haste" | "urchin"; points?: number }
  /** Potion d'oursin : l'attaquant se pique et perd des PV. */
  | { type: "thorns"; actor: Actor; damage: number }
  /** Salle de bain du Kobold : il sort de l'eau, le disque s'arrête, coup de serviette, il s'enfuit. */
  | { type: "bath"; what: "splash" | "scratch" | "towel" | "flee"; x: number; y: number }
  /** Un Kobold blessé prend la fuite. */
  | { type: "flee"; actor: Actor }
  /** Flûte de pan : quelques notes, un ennemi s'endort. */
  | { type: "lullaby"; actor: Actor }
  | { type: "slowed"; actor: Actor }
  | { type: "dropped"; item: ItemId; count: number }
  /** Une potion jetée se casse sur les dalles (Thomas, 2026-11-12). */
  | { type: "shatter"; item: ItemId; potion: string; fromX: number; fromY: number; x: number; y: number }
  /** Niveau d'alerte : l'étage passe au palier suivant (1 agité, 2 alerte, 3 traque). */
  | { type: "alarm"; stage: number }
  /** Du bruit à cet endroit (porte enfoncée, coups échangés) : il fait monter le tocsin. */
  | { type: "noise"; x: number; y: number; points: number }
  | { type: "poisoned"; actor: Actor; immune?: boolean }
  | { type: "poison"; actor: Actor; damage: number }
  | { type: "xp"; amount: number; blocked?: boolean }
  /** Un personnage en feu entre dans l'eau : il s'éteint. */
  | { type: "doused"; actor: Actor }
  /** L'investissement chez Krik (quête 03) : rendu à l'étage suivant, ou perdu. */
  | { type: "krikReturn"; amount: number }
  /** Tâche de quête : donnée, rendue au PNJ, ratée (on est descendu sans revenir) ou perdue (le PNJ s'est enfui). */
  | { type: "quest"; what: "start" | "complete" | "fail" | "lost"; id: QuestTaskId; gold?: number }
  /** L'alerte de l'étage redescend d'un palier. */
  | { type: "alarmDown"; stage: number }
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
export type ShootRefusal = "no-bow" | "two-hands" | "no-ammo" | "no-target" | "out-of-range";
