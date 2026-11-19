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
  | { type: "attack"; attacker: Actor; target: Actor; result: AttackResult; opportunity?: boolean; ranged?: boolean; ink?: boolean }
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
      /** Le projectile (son nom au journal : `ItemDef.single`). */
      ammo?: ItemId;
      /** Une pierre de lance-pierre (le Halfelin). */
      stone?: boolean;
      /** Flèche spéciale : son dessin en vol (Thomas, 2026-11-17 : la flèche de recul volait comme une ordinaire). */
      arrowKind?: "poison" | "ricochet" | "recul" | "obsidienne" | "feu";
      /** Le rebond d'une flèche ricochante, de la première cible vers la deuxième. */
      ricochet?: boolean;
    }
  | { type: "pickup"; item: ItemId; count: number }
  /** `fire` : mort en brûlant ; `unaware` : tué par le héros sans l'avoir vu venir (succès). */
  | { type: "death"; actor: Actor; fire?: boolean; unaware?: boolean }
  /** Coup de l'arme du héros qui tue net un monstre intact (Thomas : « sentir la différence »), ou qui l'assomme (arme lourde). */
  | { type: "heavyBlow"; actor: Actor; kind: "oneShot" | "stun" | "knockback"; fromX?: number; fromY?: number }
  | { type: "noticed"; actor: Actor }
  /** `unhurt` : l'étage quitté vers le bas sans avoir perdu de vie, avec au moins un monstre vaincu (succès). */
  | { type: "stairs"; direction: "down" | "up"; healed: number; unhurt?: boolean }
  /** Bouton « S'équiper » du ruban : l'objet ramassé a été porté (ou non : il reste dans le sac). */
  | { type: "pickEquip"; item: ItemId; ok: boolean }
  /** Première arrivée dans une nouvelle section : son texte d'arrivée. */
  | { type: "sectionIntro"; section: number }
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
  | { type: "npc"; who: "gluck" | "soeur" | "krik" | "grum" | "fifrelin" | "morillon" | "vernis" | "maestro" | "plumeau"; what: "talk" | "leave"; fled?: "fire" | "gas"; gold?: number; x?: number; y?: number; drops?: { item: ItemId; x: number; y: number; count: number }[] }
  /** Une statue : on la regarde (`look`), ou on frappe la statue creuse (jet de force ; réussi : elle s'effondre). */
  | { type: "statue"; x: number; y: number; look?: boolean; grille?: boolean; d20?: number; bonus?: number; total?: number; success?: boolean }
  /** Chance (Sœur Osseuse) : un 1 naturel du héros est relancé. */
  | { type: "luck" }
  /** Races (2026-11-16) : la relance de l'Humain têtu ; son coup gratuit sur un monstre qui s'éloigne. */
  | { type: "stubborn" }
  | { type: "opportunist"; actor: Actor }
  /** Le d20 enchanté (artefact) change un 1 naturel du héros en 20 : un coup critique, une fois par étage. */
  | { type: "luckyDie" }
  /** Le bas de la démo : l'escalier de l'étage 10 (Thomas, 2026-11-14). */
  | { type: "demoEnd" }
  /** Le Carillon (boss de la section 2) : il s'éveille, avertit, sonne (qui est jeté à terre), sonne faux, perd son
   *  battant ; à mi-vie, des envahis sortent du mycélium. */
  | { type: "carillon"; what: "wake" | "warn" | "ring" | "false" | "clapper" | "sprout" | "ink" | "inkMark" | "cower" | "repair" | "repaired" | "echo" | "knell" | "slump" | "stumpCrack" | "stumpBreak"; actor: Actor; hit?: Actor[]; cells?: { x: number; y: number }[]; kind?: "zone" | "drip" }
  /** L'escalier de la nichée est scellé : la Tisseuse vit encore. */
  | { type: "sealed" }
  /** Un jet de dialogue avec un PNJ de quête (d20 + caractéristique). */
  | { type: "npcRoll"; stat: string; d20: number; bonus: number; total: number; success: boolean }
  /** Le Kobold qui compte derrière sa porte : il compte (`count`), met le doigt dans l'œil (`poke`), ou il est attrapé (`caught`). */
  | { type: "counter"; what: "count" | "poke" | "caught"; n: number; x: number; y: number; first?: boolean }
  /** Le héros sonne la cloche d'alarme : `rings` = combien de fois sur cet étage ; `joke` choisit la moquerie. */
  | { type: "bell"; x: number; y: number; rings: number; joke: number }
  /** Deux monstres se querellent : bloqués face à face dans un couloir, ou touchés par la pierre d'un frondeur. */
  | { type: "feud"; a: Actor; b: Actor; reason: "blocked" | "shot" | "fog" | "discord" | "species" | "bout" }
  /** Le tripot de Fifrelin : le pari gagné ou perdu, le champion battu par le héros, le tricheur pris la main dans le sac. */
  | { type: "bout"; what: "win" | "lose" | "duelWin" | "caught"; x: number; y: number; gold?: number; winner?: "champ" | "small"; rigged?: boolean }
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
  | { type: "watered"; x: number; y: number }
  | { type: "alembic"; x: number; y: number; item: ItemId; toX: number; toY: number }
  /** La carotte magique se décroche du nez du bonhomme de neige. */
  | { type: "snowman"; x: number; y: number; toX: number; toY: number }
  /** Bombe arcanique : lancée (elle vole et se pose), le compte à rebours, l'explosion (cases touchées, portes soufflées). */
  | { type: "bomb"; what: "thrown"; fromX: number; fromY: number; x: number; y: number }
  | { type: "bomb"; what: "tick"; x: number; y: number; n: number }
  | { type: "bomb"; what: "boom"; x: number; y: number; cells: { x: number; y: number }[]; doors: { x: number; y: number }[]; hit: Actor[] }
  /** La chambre de neige fond (un feu dedans ou contre elle). */
  | { type: "melt"; x: number; y: number; seen: boolean }
  | { type: "rise"; actor: Actor; what: "down" | "up" }
  /** Section 3 : tas d'os, crâne brisé, relevé par la lune ; chant de l'acolyte (annonce, chant, sonné) ; gisant qui
   *  se lève ou se recouche ; rat qui dévore la nourriture au sol. */
  /** Crâne lunaire : il se charge (la ligne s'allume), puis le rayon part. */
  | { type: "beam"; actor: Actor; what: "charge" | "fire"; cells: { x: number; y: number }[]; damage?: number }
  /** Potion de gel : un monstre gelé, puis dégelé. */
  | { type: "frost"; actor: Actor; what: "freeze" | "thaw" }
  | { type: "undead"; actor: Actor; what: "pile" | "crush" | "rise" | "chant0" | "chant" | "daze" | "wake" | "rest" | "eat"; item?: string }
  | { type: "burst"; x: number; y: number }
  | { type: "whistle"; actor: Actor }
  | { type: "lostTrack"; actor: Actor }
  | { type: "trapDodged"; x: number; y: number; kind: string; d20: number; bonus: number }
  /** Désamorcer un piège voisin (Thomas, 2026-11-17) : réussi, il disparaît ; raté de beaucoup, il part sur vous. */
  | { type: "disarm"; x: number; y: number; kind: string; d20: number; bonus: number; total: number; success: boolean; sprung: boolean }
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
      /** À sa mort : ses petits s'éloignent de quelques pas puis disparaissent dans la fumée (Thomas, 2026-11-14). */
      fled?: { id: number; path: Point[] }[];
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
  | { type: "gravel"; x: number; y: number; alerted: number; water?: boolean; monster?: boolean }
  /** Se dégager : le jet, et s'il a réussi le saut sans attaque d'opportunité. */
  | { type: "jump"; fromX: number; fromY: number; x: number; y: number; d20: number; bonus: number; total: number; success: boolean }
  /** Pousser : le jet ; réussi, le monstre a reculé d'une case, ou heurté un obstacle (dégâts en plus). */
  | { type: "push"; target: Actor; d20: number; bonus: number; total: number; success: boolean; moved: boolean; slam: number; prone?: boolean }
  /** Un monstre renversé se relève (il y passe son tour). */
  | { type: "getUp"; actor: Actor }
  /** Salle d'essai : de retour au HUB, l'étage est remis à neuf. */
  | { type: "sandboxReset" }
  /** Pièce secrète (Thomas, 2026-11-14) : entrevue par un creux du mur, puis trouvée en fouillant la salle voisine. */
  | { type: "secret"; what: "glimpse" | "found"; x: number; y: number }
  /** Quêtes v3 : la zone spéciale (montrée, tapisserie tranchée, bougie soufflée, dalle enfoncée). */
  | {
      type: "zone";
      what: "shown" | "tapestry" | "candle" | "plate" | "pushed" | "stuck" | "wall" | "cierge" | "noflame" | "bell" | "hen" | "henFlees" | "hat" | "nohat" | "thief" | "complice" | "courier" | "courierLost" | "found";
      x: number;
      y: number;
      woke?: number;
    }
  /** Quelqu'un a marché sur un piège. */
  | { type: "trap"; x: number; y: number; victim: Actor; damage: number; kind: TrapKind }
  /** Fouille : commencée, interrompue, ou finie avec le jet et les cases où l'on a trouvé quelque chose. */
  | { type: "search"; phase: "start" | "interrupted" }
  /** Le poulet dérangé : son trajet jusqu'au mur du fond (la porte défoncée en chemin), et si le héros voit la fin. */
  | { type: "chicken"; path: Point[]; door?: Point; crash: Point; seen: boolean }
  | { type: "searched"; d20: number; bonus: number; total: number; success: boolean; found: Point[]; traps?: Point[]; room: Room ; corridor?: boolean }
  /** Repos : commencé, mené à son terme (avec les PV rendus) ou interrompu par un monstre. */
  | { type: "rest"; phase: "start" | "done" | "interrupted"; healed: number }
  | { type: "shop"; line: number }
  | { type: "bought"; item: ItemId; count: number; price: number }
  | { type: "sold"; item: ItemId; count: number; price: number }
  | { type: "merchantHides" }
  | { type: "merchantShows" }
  | { type: "merchantLeaves"; x: number; y: number; seen: boolean }
  | { type: "chest"; gold: number; item: ItemId; count: number; x: number; y: number; drops: { x: number; y: number }[]; golden?: ItemId[] }
  /** Objet utilisé (pomme : PV rendus ; torche : allumée), torche éteinte, poison posé et poison qui ronge. */
  | { type: "used"; item: ItemId; healed?: number }
  | { type: "torchOut" }
  /** Se cacher torche allumée (Thomas, 2026-11-17) : elle s'étouffe toute seule, puis se rallume en sortant de l'ombre. */
  | { type: "torchHush"; lit: boolean }
  /** Voie choisie, compétence de voie utilisée, Dernier rempart, potion (feu lancé, case qui brûle, statut posé). */
  | { type: "path"; path: PathId }
  | { type: "skill"; path: PathId; healed: number }
  /** 2026-11-18 : vol d'une pomme dorée (hall d'exposition) ou du canard du bain ; d20 + discrétion. */
  | { type: "theft"; what: "apple" | "duck"; d20: number; bonus: number; total: number; success: boolean; watched?: boolean }
  /** Section 2 : les champignons d'une salle se referment (bruit) ou se rouvrent ; un nuage de spores explose ; une
   *  vesse-de-loup crache son nuage (sommeil ou querelle). */
  | { type: "mushHush"; x: number; y: number; dark: boolean }
  | { type: "sporeBlast"; cells: Point[] }
  | { type: "puffball"; x: number; y: number; what: "sleep" | "feud"; cells: Point[] }
  /** La dalle à pression : un pan de mur coulisse, une niche s'ouvre. */
  | { type: "niche"; x: number; y: number }
  /** Le squelette à butin, fouillé : l'or, et parfois un objet. */
  | { type: "skeleton"; x: number; y: number; gold: number; item?: ItemId }
  /** Une mission réussie hors tâche (succès de quête) : Plumeau libéré par la force, registre lu ; pomme dorée volée. */
  | { type: "feat"; npc: "plumeau" | "vernis"; id: string }
  /** Artefacts qui s'utilisent : faux mur peint (puis effacé), diapason qui vibre. */
  | { type: "artifact"; what: "paint" | "unpaint" | "fork"; x?: number; y?: number; traps?: number; secret?: boolean }
  /** Rang II des voies (2026-11-17) : riposte, tourbillon (ennemis touchés), charge, cri de guerre (ennemis touchés, fuyards). */
  | { type: "power"; power: "riposte" | "tourbillon" | "charge" | "cri_guerre"; count?: number; fled?: number }
  | { type: "lastStand" }
  | { type: "fire"; fromX: number; fromY: number; x: number; y: number; cells: Point[] }
  /** Une torche lancée (Thomas, 2026-11-14) : elle vole et met le feu à sa case (ou s'éteint dans l'eau). */
  | { type: "torchThrown"; fromX: number; fromY: number; x: number; y: number; doused: boolean }
  /** Une potion lancée vole jusqu'à sa case et y éclate (feu ou poison). */
  | { type: "potionThrown"; item: ItemId; potion: string; fromX: number; fromY: number; x: number; y: number; cells: { x: number; y: number }[]; note?: "healed" | "angry" }
  | { type: "burn"; actor: Actor; damage: number }
  | { type: "potion"; potion: "youth" | "poison" | "haste" | "urchin" | "stone" | "grow" | "frost"; points?: number }
  /** Potion d'agrandissement : un personnage grandit, ou revient à sa taille. Potion glissante : il devient glissant. */
  | { type: "grow"; actor: Actor; back?: boolean }
  | { type: "slippery"; actor: Actor }
  /** Un glissant reçoit un coup : il glisse de (fromX, fromY) à (x, y), en rebondissant `bumps` fois (dégâts `damage`). */
  | { type: "slide"; actor: Actor; fromX: number; fromY: number; x: number; y: number; bumps: number; damage: number; path: { x: number; y: number }[] }
  /** Une potion lancée sur la Tisseuse : ce qu'elle lui fait (journal). */
  | { type: "bossPotion"; potion: string; actor: Actor }
  /** Potion de pierre : le héros redevient chair, un monstre est pétrifié (ou le redevient). */
  | { type: "stone"; what: "heroBack" | "petrified" | "monsterBack"; actor: Actor }
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
      /** La porte du poulet : aucun jet ne l'ouvre. */
      sealed?: boolean;
    };

/** Pourquoi un tir est refusé. */
export type ShootRefusal = "no-bow" | "no-ammo" | "no-target" | "out-of-range";
