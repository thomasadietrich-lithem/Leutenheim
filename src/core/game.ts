import { QUEST_TASKS, type QuestTask, type QuestTaskId } from "../data/quests";
import { CLASSES, ClassDef } from "../data/classes";
import { DEFAULT_FLOOR, FloorConfig } from "../data/floors";
import { ITEMS, ItemDef, ItemId, Slot, UNARMED, UNARMORED_AC } from "../data/items";
import { ActivePower, MAIN_MAX_RANK, MAX_RANK, PATH_LEVEL, PathId, PATHS, PowerId, StatId, TIER2_LEVEL, TIER3_LEVEL } from "../data/skills";
import { MONSTERS, spawnsForDepth, MonsterDef } from "../data/monsters";
import { TRAPS } from "../data/traps";
import { RACES, RaceDef } from "../data/races";
import { RULES } from "../data/rules";
import { GLUCK, GLUCK_OPENING, GluckChoice, STAT_NAMES } from "../data/gluck";
import { SOEUR, SOEUR_OPENING } from "../data/soeur";
import { KRIK, KRIK_OPENING } from "../data/krik";
import { GRUM, GRUM_OPENING } from "../data/grum";
import { MORILLON, MORILLON_OPENING } from "../data/morillon";
import { MAESTRO, PLUMEAU, VERNIS } from "../data/npcsS2";
import { CLAVICULE, OSSELET } from "../data/npcsS3";
import { FIFRELIN, FIFRELIN_OPENING } from "../data/fifrelin";
import { Actor } from "../entities/actor";
import { BagItem, Inventory } from "../items/inventory";
import { computeFov, computeLight, hasClearSight, hasLineOfSight, LightSource, lineBetween } from "../world/fov";
import { generateFloor, Room } from "../world/generator";
import { encaseStairs } from "../world/stairs";
import { carvePocket, placeSecretRoom, placeWallMarks } from "../world/secretRoom";
import { decorateChampi } from "../world/champi";
import { ARENA_MONSTERS, SANDBOX_LAYOUT, SandboxArea, SandboxFloor, SandboxMonsterKind, SandboxSign, sandboxPlan, sandboxSection, setSandboxSection } from "../world/sandbox";
import { BossFloor, BossLayout, buildBossFloor } from "../world/bossFloor";
import { buildCarillonFloor } from "../world/carillonFloor";
import { buildPriestessFloor } from "../world/priestessFloor";
import { bigStep, cellsOf, gapBetween, occupies, sizeOf } from "./boss";
import { furnishFloor, Furniture, furnitureCells, placeBell, reachable } from "../world/furnish";
import { decorateOssuaire, moonArea, sideOf } from "../world/ossuaire";
import { FURNITURE_KINDS } from "../data/themedRooms";
import { Motif, placeGrounds, placeMotifs } from "../world/grounds";
import { GameMap, Point, Tile } from "../world/map";
import { canStep, distanceField, findPath, isChokepoint } from "../world/pathfinding";
import { rollAttack } from "./combat";
import { rollDice } from "./dice";
import { DoorAction, GameEvent, ShootRefusal } from "./events";
import { bytesToText, clone, SAVE_VERSION, SaveData, SavedFloor, textToBytes } from "./save";
import { BloodStain, ChickenState, CounterDoor, StainColor, Debris, FloorState, GluckSpot, GroundItem, QuestZone, Trap, foodRations, guaranteedLoot, lootPool, noteUnique, placeGuaranteed, placeKey, placeLoot, placeSecrets, placeTraps, rollLoot, roomElements, trackUniques } from "./floor";

// Les autres fichiers continuent d'importer ces types depuis la partie.
export type { DoorAction, GameEvent, ShootRefusal } from "./events";
export type { Debris, GroundItem, Secret } from "./floor";
import { floorSeed, Rng } from "./rng";
import { KitTier, TEST_KITS } from "../data/testKits";
import { lessGold, sectionOf } from "../data/loot";
/** Le dessin en vol des flèches spéciales. */
const ARROW_KIND: Partial<Record<ItemId, "poison" | "ricochet" | "recul" | "obsidienne" | "feu">> = { fleche_poison: "poison", fleche_ricochet: "ricochet", fleche_recul: "recul", fleche_obsidienne: "obsidienne", fleche_feu: "feu" };
import { makeMerchant, Merchant, mix, rollWares } from "./merchant";
import { buyBackPrice, MERCHANT, SANDBOX_WARES } from "../data/merchant";

/** Ce qui s'est passé pendant un tour, pour que l'affichage puisse le montrer. */
/** Ce qui ne sert qu'un nombre limité de fois par étage : second souffle et dernier rempart (fois déjà utilisés),
 * doubles frappes qui restent, doubles frappes rendues par « Enchaînement ». */
export interface FloorPerks {
  secondWind: number;
  doubleStrikes: number;
  lastStand: number;
  chainRefunds: number;
  /** Rang II (2026-11-17) : tourbillons, charges, cris de guerre déjà faits sur l'étage. */
  whirls?: number;
  /** Rang III (2026-11-19) : bastions et exécutions déjà faits sur l'étage. */
  bastions?: number;
  executions?: number;
  /** 2026-11-18 : ticket d'exposition déjà servi, pinceau, diapason. */
  ticket?: number;
  brush?: number;
  fork?: number;
  charges?: number;
  cries?: number;
  /** D20 enchanté déjà servi sur cet étage. */
  luckyDie?: number;
  /** TÊTU (Humain) : la relance de l'étage a déjà servi. */
  stubborn?: number;
  /** Le héros a perdu de la vie sur cet étage ; monstres qu'il y a vaincus (succès « Intouchable »). */
  hurt?: number;
  kills?: number;
  /** Déjà quitté une fois (par n'importe quel escalier) : le succès « sans une égratignure » ne compte plus (Thomas,
   *  2026-11-15 : repasser par l'escalier par lequel on est arrivé ne doit pas marcher). */
  left?: number;
}

/** Ce que Gluck sait du héros, le temps d'une partie (Thomas : pas de mémoire d'une partie à l'autre). */
export interface GluckMemory {
  /** Rencontres menées à leur terme (0 à 4) : choisit la scène suivante. */
  met: number;
  /** −1 rancunier, 0, +1 ami. */
  mood: number;
  /** Or investi dans son commerce, rendu (ou perdu) à la rencontre suivante. */
  invested: number;
  /** Dernier cadeau du philosophe (pour ne pas redonner le même). */
  lastReward?: string;
  /** Son concurrent chassé (rencontre 2) : la pomme à 3 pièces pour le reste de la partie. */
  discount?: boolean;
}

/** Les PNJ de quête : Gluck (quête 01), Sœur Osseuse (quête 02), Krik (quête 03). */
/** Les meubles à bougies et le rayon de leur lueur (Thomas, 2026-11-14 : « toutes les bougies doivent éclairer » ; C). */
// Section 2 (Thomas, 2026-11-14) : les champignons lumineux éclairent leur salle (C).
const CANDLE_LIGHT: Record<string, number> = { chandelierArgent: 3, chandelierMusee: 3, chandelierExpo: 3, table: 2, lowTable: 3, candelA: 2, candelB: 3, candelC: 3, grimoire: 2, champiGeant: 4, champiGrappe: 3, champiCorail: 2 };

export type NpcId = "gluck" | "soeur" | "krik" | "grum" | "fifrelin" | "morillon" | "vernis" | "maestro" | "plumeau" | "clavicule" | "osselet";
export const NPC_IDS: readonly NpcId[] = ["gluck", "soeur", "krik", "grum", "fifrelin", "morillon", "vernis", "maestro", "plumeau", "clavicule", "osselet"];
/** Ceux qu'on croise au hasard ; Grum, lui, vit dans la ferme. */
/** Ce que le rat d'ossuaire dévore au sol. */
const RAT_FOOD: ReadonlySet<string> = new Set(["pomme", "cuisse_poulet", "escalope", "morille", "pain_elfique", "carotte_magique", "pomme_doree_expo", "tourte_fossoyeur"]);
const ROAMING_NPCS: readonly NpcId[] = ["gluck", "soeur", "krik", "fifrelin"];

/** Ce que Krik sait du héros, le temps d'une partie. */
export interface KrikMemory {
  met: number;
  /** On l'a dénoncé à ses anciens camarades (rencontre 2). */
  denounced?: boolean;
  /** Or investi dans son commerce (rencontre 3), et l'étage où on l'a investi. */
  invested?: number;
  investDepth?: number;
}

/** La flaque qu'une potion laisse en éclatant : sa couleur. */
const POTION_STAIN: Record<string, StainColor> = { youth: "pYouth", poison: "pPoison", haste: "pHaste", fire: "pFire", smoke: "soot", fog: "soot", urchin: "pUrchin", stone: "pStone", discord: "pDiscord", grow: "pGrow", slip: "pSlip", frost: "pHaste" };

/** Ce que Sœur Osseuse sait du héros, le temps d'une partie. */
export interface SoeurMemory {
  met: number;
  /** On lui a reparlé de la cloche (rencontre 2) : elle s'en souvient. */
  grudge?: boolean;
  /** Dernier cadeau (rencontres 2 et 4), pour ne pas redonner le même. */
  lastReward?: string;
}

/** Ce que rend un choix du dialogue de Gluck : ses répliques, le jet s'il y en a eu un, et si la scène est finie. */
export interface GluckResult {
  lines: string[];
  roll?: { stat: string; d20: number; bonus: number; total: number; success: boolean };
  done: boolean;
}

export class Game {
  depth = 0;
  turn = 0;
  over = false;
  /** La partie s'est finie sur la victoire contre le boss (fin de la démo), pas sur la mort du héros. */
  won = false;
  map!: GameMap;
  hero: Actor;
  monsters: Actor[] = [];
  /** Cases restant à parcourir vers la destination choisie. */
  path: Point[] = [];
  /** Cases actuellement en vue (1) et cases déjà vues au moins une fois (1). */
  visible!: Uint8Array;
  explored!: Uint8Array;
  /** Passages devinés au-delà de ce qu'on a vu (1) : affichés en très estompé. */
  sensed!: Uint8Array;
  /** Torches de l'étage et éclairage qu'elles produisent (0 à 1 par case). */
  torches: LightSource[] = [];
  light!: Float32Array;
  /** Porte verrouillée devant laquelle le héros se tient et attend une décision du joueur. */
  pendingDoor: Point | null = null;
  /** On marche vers le Colporteur : sa boutique s'ouvrira en arrivant à côté de lui. */
  private shopTarget = false;
  /** Le héros va parler à un PNJ de quête (Gluck, Sœur Osseuse) : la conversation s'ouvre en arrivant à côté de lui. */
  private talkTarget: NpcId | null = null;
  /** Le sac du héros, et à part ce qu'il porte sur lui : un objet par emplacement. */
  inventory = new Inventory();
  equipment: Record<Slot, BagItem | null> = { amulet: null, hat: null, artifact: null, armor: null, melee: null, ranged: null, bag: null };
  /** Objets au sol sur l'étage courant (flèches à ramasser). */
  ground: GroundItem[] = [];
  /** Bourse, expérience et niveau du héros. */
  gold = 0;
  xp = 0;
  level = 1;
  /** Torche allumée : tours de lumière restants autour du héros. */
  /** La torche rangée sous l'arc : ses tours restants (0 : pas de torche). `torchOff` : éteinte (elle ne brûle plus). */
  torchTurns = 0;
  torchOff = false;

  /** La torche brûle-t-elle ? */
  /** Les cases vues juste avant d'allumer la torche : l'affichage montre celles qu'on gagne (non sauvegardé). */
  torchBefore: Uint8Array | null = null;
  torchLit(): boolean {
    return this.torchTurns > 0 && !this.torchOff;
  }

  /** Éteindre ou rallumer la torche rangée sous l'arc (sans prendre de tour). */
  toggleTorch(): boolean {
    if (this.over || this.torchTurns <= 0) return false;
    this.torchOff = !this.torchOff;
    this.torchHushed = false;
    if (!this.torchOff) this.torchBefore = this.visible ? this.visible.slice() : null;
    this.refreshLight();
    if (!this.torchOff) this.reveal();
    return true;
  }
  /** Munition choisie dans le carquois (la flèche ordinaire par défaut). */
  ammoChoice: ItemId = "fleche";
  /**
   * Vitesse d'attaque : avance (+) ou retard (−) du héros sur les monstres, en tours. Une attaque lente l'ajoute,
   * une rapide le retire ; à +1 les monstres jouent un tour de plus, à −1 ils en sautent un.
   */
  clock = 0;
  private actionCost = 1;
  // ---- Points, voie et compétences (2026-11-11) ----
  /** Points gagnés aux niveaux, pas encore placés. */
  points = 0;
  /** Points placés dans chaque caractéristique. */
  alloc: Record<StatId, number> = { vie: 0, force: 0, agilite: 0, intelligence: 0, charisme: 0 };
  /** Voie choisie (définitive) et compétences secondaires prises. */
  voie: PathId | null = null;
  /** Rang de chaque pouvoir de la voie (0 : pas pris ; 1 à 3). Le principal est au rang 1 dès le choix de la voie. */
  ranks: Partial<Record<PowerId, number>> = {};
  /** Ce qui ne sert qu'une fois (ou trois) par étage, étage par étage. */
  floorPerks: Record<number, FloorPerks> = {};
  /** Potions : coups empoisonnés qui restent sur l'arme, tours d'accélération qui restent. */
  weaponPoison = 0;
  hasteTurns = 0;
  /** Gluck, le Kobold aux pommes : ce qu'il sait du héros dans cette partie. */
  gluckMemory: GluckMemory = { met: 0, mood: 0, invested: 0 };
  /** Sœur Osseuse : ce qu'elle sait du héros dans cette partie. */
  soeurMemory: SoeurMemory = { met: 0 };
  krikMemory: KrikMemory = { met: 0 };
  grumMemory: { met: number } = { met: 0 };
  fifrelinMemory: { met: number } = { met: 0 };
  morillonMemory: { met: number } = { met: 0 };
  /** Section 2 (2026-11-18) : Vernis (hall d'exposition), le Maestro (salle de concert) ; section 1 : Plumeau (prison). */
  vernisMemory: { met: number } = { met: 0 };
  maestroMemory: { met: number } = { met: 0 };
  plumeauMemory: { met: number } = { met: 0 };
  /** Section 3 : Sœur Clavicule (chapelle des os). */
  claviculeMemory: { met: number } = { met: 0 };
  osseletMemory: { met: number } = { met: 0 };
  /** Bénédictions de Sœur Osseuse (quête 02) : Protection (tours), Clarté et Malédiction des Kobolds (l'étage où elles
   *  valent), Chance (1 naturels encore à relancer). */
  protectTurns = 0;
  clarityDepth = 0;
  curseDepth = 0;
  luck = 0;
  /** Raccourci « Objet » de la barre d'actions : la sorte d'objet choisie (appui long dans le sac, Thomas 2026-11-12). */
  quickItem: ItemId | null = null;
  /** La tâche de quête en cours (une seule à la fois ; Thomas, 2026-11-12). */
  quest: QuestTask | null = null;
  /** Les fractions de points d'expérience pas encore gagnées (XP divisée par deux). */
  xpCarry = 0;
  /** Bénédiction de l'autel à la pomme dorée : +1 au jet d'attaque et +1 CA, pendant tant de tours. */
  blessTurns = 0;
  /** Cases en feu (potion de feu), sur l'étage courant. */
  fires: { x: number; y: number; turns: number; gen?: number }[] = [];
  /** Salle d'essai : combats coupés (bouton « Combats »), pour visiter tranquillement. Pas sauvegardé. */
  peaceful = false;
  /** Mode du Carillon (Thomas, 2026-11-16 : « fais un mode dans le test ») : « douce » en jeu ; les outils d'essai
   *  passent à « onde » (l'onde seule, sans encre ni chapeau) ou « dure » (l'encre dès l'arrivée, à chaque tour). */
  carillonMode: "onde" | "douce" | "dure" = "douce";
  private throwOrder: { uid: number; x: number; y: number } | null = null;
  private skillOrder: number | null = null;
  /** Le pouvoir que `skillOrder` déclenche (null : celui du bouton, second souffle ou double frappe). */
  private skillPower: ActivePower | null = null;
  /** Bonus du prochain coup du héros (charge, riposte) : toucher et dégâts. */
  private strikeBonus = { hit: 0, damage: 0 };
  /** Tour de la dernière riposte (une par tour). */
  private ripostedOn = -9;
  /** Bastion (voie bleue, Rang III) : actif jusqu'à ce tour compris. */
  bastionUntil = -1;
  /** Frénésie (voie rouge, Rang III) : coups qui portent d'affilée, et le tour du dernier. */
  private frenzy = 0;
  private frenzyTurn = -9;
  /** Soif de sang : le tour où elle a déjà soigné. */
  private thirstTurn = -9;
  /** Aperçu de la section 3 (salle d'essai) : chapelle et musée garantis à l'étage 11. */
  private previewS3 = false;
  private useOrder: number | null = null;
  /** Un objet du sac attend d'être consommé (ou lancé) au prochain tour. */
  usePending(): boolean {
    return this.useOrder !== null || this.throwOrder !== null;
  }
  private lastGroundTorches = -1;
  private torchWasLit = false;
  /** Flèches brisées encore visibles au sol. */
  debris: Debris[] = [];
  /** Événements en attente d'affichage ; l'affichage les lit puis vide la liste. */
  events: GameEvent[] = [];

  private rng!: Rng;
  private nextId = 1;
  private targetId: number | null = null;
  /** Dernier monstre frappé au corps à corps : c'est lui que vise le dé quand on le touche. */
  private lastFoeId: number | null = null;
  private waiting = false;
  /** Attaques du héros manquées d'affilée. */
  heroMisses = 0;
  private picking = false;
  /** Le héros est caché : les monstres l'ont perdu de vue et ne le remarquent plus que s'ils arrivent à son contact. */
  hidden = false;
  /** Ordres de la roue d'actions en attente : se cacher, ou sauter vers une case. */
  private hideOrder = false;
  private jumpTarget: Point | null = null;
  private pushTargetId: number | null = null;
  /** Ordre : désamorcer le piège de cette case (voisine du héros). */
  private disarmAt: Point | null = null;
  /** Tours de fouille restant à passer sur place (0 : pas de fouille en cours). */
  private searching = 0;
  private lastGiverKey = "";
  /** Tours de repos restant à passer sur place (0 : le héros ne se repose pas). */
  private resting = 0;
  /** Genre d'objet en cours de ramassage : ses semblables sur la case suivent, un par tour. */
  private pickingItem: ItemId | null = null;
  private shotTarget: Point | null = null;
  private doorTarget: Point | null = null;
  private doorAction: DoorAction | null = null;
  private seenMonsters = new Set<number>();
  rooms: Room[] = [];
  /** Étages déjà visités, gardés en l'état. */
  private floors = new Map<number, FloorState>();
  /** Portes sur lesquelles une tentative a déjà échoué : on ne peut pas réessayer la même méthode. */
  private failedDoorAttempts = new Set<string>();
  private current!: FloorState;
  /** Le héros vient de marcher sur un escalier : il le prendra à la fin de son pas. */
  pendingStairs: "down" | "up" | null = null;
  /** Étage le plus profond atteint dans cette partie. */
  deepest = 0;

  constructor(
    readonly runSeed: number,
    readonly race: RaceDef = RACES.humain,
    readonly heroClass: ClassDef = CLASSES.guerrier,
    private readonly floorConfig: FloorConfig = DEFAULT_FLOOR,
    /** Salle d'essai : le premier étage est le plan fixe de `src/world/sandbox.ts` au lieu d'un étage tiré au hasard. */
    readonly sandbox = false,
  ) {
    const maxHp = heroClass.hp + race.hpBonus;
    this.hero = {
      id: 0,
      kind: "hero",
      defId: "hero",
      name: `${race.name} ${heroClass.name}`,
      x: 0,
      y: 0,
      fromX: 0,
      fromY: 0,
      hp: maxHp,
      maxHp,
      armorClass: UNARMORED_AC,
      attackBonus: UNARMED.attackBonus,
      damage: UNARMED.damage,
      vision: race.darkVision,
      alerted: true,
      asleep: false,
    };
    for (const start0 of heroClass.startingItems) {
      // Le Halfelin change l'équipement de la classe (serpe, lance-pierre, pierres).
      const start = { ...start0, item: race.swapItems?.[start0.item] ?? start0.item };
      this.inventory.add(start.item, start.count);
      const placed = this.inventory.items.find((i) => i.defId === start.item);
      if (start.equip && placed) this.equip(placed.uid);
    }
    // La race ajoute quelques objets à ceux de la classe (Thomas, 2026-11-16 : ni potion, ni or).
    for (const start of race.startingItems) this.inventory.add(start.item, start.count);
    this.refreshStats();
    trackUniques(this.uniques);
    this.enterFloor(1, "down");
  }
  /**
   * Le butin propre à la race (Thomas, 2026-11-16) : le Halfelin trouve de PETITS tas de pierres (2 ou 3) sur chaque
   * étage, plusieurs fois, et un ARC COURT sur un étage de la section 1 (tiré au début de la partie).
   */
  private raceLoot(depth: number): { item: ItemId; count: number }[] {
    const out: { item: ItemId; count: number }[] = [];
    if (this.race.recoilPiles) {
      const rr = new Rng(floorSeed(this.runSeed, depth) ^ 0x7ec011);
      out.push({ item: "fleche_recul", count: rr.int(2, 3) });
      if (rr.chance(1 / 3)) out.push({ item: "fleche_recul", count: rr.int(2, 3) });
    }
    const piles = this.race.stonePiles ?? 0;
    if (!piles) return out;
    const rng = new Rng(floorSeed(this.runSeed, depth) ^ 0x57a11);
    for (let i = 0; i < piles; i++) out.push({ item: "pierre", count: rng.int(2, 3) });
    if (depth === new Rng(this.runSeed ^ 0xa4c).int(2, 4)) out.push({ item: "arc_court", count: 1 });
    return out;
  }

  /** Les bibelots déjà sortis dans cette partie (chacun est unique). */
  uniques = new Set<string>();

  // ---------- Mise en place d'un étage ----------

  /**
   * Arrive sur un étage. S'il a déjà été visité, on le retrouve exactement comme on l'a laissé (monstres,
   * portes, objets au sol, carte explorée). `via` : par quel escalier on arrive.
   */
  private enterFloor(depth: number, via: "down" | "up"): void {
    trackUniques(this.uniques);
    this.pendingGlow = [];
    if (this.current) {
      // On range l'étage qu'on quitte.
      // Combats coupés : les monstres mis de côté restent sur leur étage.
      this.current.monsters = this.peaceful ? [...this.monsters, ...this.peacefulStash] : this.monsters;
      this.peacefulStash = [];
      this.current.ground = this.ground;
      this.current.debris = this.debris;
    }
    let state = this.floors.get(depth);
    const fresh = !state;
    let sandboxFloor: SandboxFloor | null = null;
    if (!state) {
      const seed = floorSeed(this.runSeed, depth);
      if (this.sandbox && depth === 1) sandboxFloor = this.plan = sandboxPlan(this.sandboxSection);
      // Étage du boss (le dernier de la section ; en salle d'essai, l'escalier y mène directement).
      const bossFloor: BossFloor | null = !sandboxFloor && this.isBossDepth(depth) ? (this.isCarillonDepth(depth) ? buildCarillonFloor(seed) : this.isPriestessDepth(depth) ? buildPriestessFloor(seed) : buildBossFloor(seed)) : null;
      // Section 3, l'Ossuaire (Thomas, 2026-11-19) : pas de salle spéciale des sections du dessus.
      const oss = !sandboxFloor && !bossFloor && Math.floor((depth - 1) / RULES.floorsPerSection) >= 2;
      const floor = sandboxFloor ?? bossFloor ?? generateFloor(seed, oss ? { ...this.floorConfig, specialRoomCounts: [{ count: 0, weight: 1 }], roomMaxSize: 10 } : this.floorConfig);
      // À partir du deuxième étage, un escalier remonte depuis le point d'arrivée.
      if (depth > 1) floor.map.set(floor.start.x, floor.start.y, Tile.StairsUp);
      // Escaliers enchâssés dans un « U » de mur, sur tous les étages tirés au hasard (Thomas, 2026-11-14).
      if (!sandboxFloor && !bossFloor) {
        floor.stairs = encaseStairs(floor, floor.stairs, Tile.StairsDown);
        if (depth > 1) floor.start = encaseStairs(floor, floor.start, Tile.StairsUp);
      }
      // Salles de fouille : à la main en salle d'essai ; dans le donjon, seulement quand le mobilier sera validé.
      const furnished = sandboxFloor
        ? { furniture: sandboxFloor.furniture, themes: sandboxFloor.themes }
        : bossFloor
          ? { furniture: bossFloor.furniture, themes: [] }
          : oss
          ? { furniture: [] as Furniture[], themes: [] }
          : RULES.themedRoomsInDungeon
          ? furnishFloor(floor, seed, depth, this.funOf(depth) === "bell", this.funOf(depth) === "bath", Math.floor((depth - 1) / RULES.floorsPerSection))
          : { furniture: [], themes: [] };
      // Section 2, la champignonnière (étages 6 à 10 ; Thomas, 2026-11-14 : « génère la section ») : l'étage tiré au
      // hasard est habillé (torches retirées, champignons, éboulements) ; le décor suit `look`.
      const champi = !sandboxFloor && !bossFloor && Math.floor((depth - 1) / RULES.floorsPerSection) === 1;
      if (champi) {
        const skip = new Set<number>([...furnished.themes.map((t) => t.room), ...floor.specials.map((s) => floor.rooms.indexOf(s.room))]);
        decorateChampi(floor, furnished.furniture, new Rng(seed ^ 0xc4a3b1), skip, new Set(furnished.themes.filter((t) => ["morilles", "sculpture", "expo", "concert"].includes(t.id)).map((t) => t.room)));
      }
      // Statues de pierre (Thomas, 2026-11-12) : une sur un étage sur trois (C), du décor ; seule une statue CREUSE, posée
      // avec Gluck, cache quelque chose, et on ne le sait que s'il le dit.
      // (Section 2 : ni statues, ni gravier, ni eau, ni PNJ de la section 1 ; Thomas, 2026-11-14.)
      if (!sandboxFloor && !bossFloor && !champi && !oss && new Rng(seed ^ 0x57a7e).chance(RULES.statueChance)) {
        placeBell(floor, new Rng(seed ^ 0x57a7f), furnished.furniture, new Set(furnished.themes.map((t) => t.room)), "statue");
      }
      // Gravier et flaques : à la main en salle d'essai ; dans le donjon, quelques-uns par étage.
      if (!sandboxFloor && !bossFloor && !champi && !oss && RULES.groundsInDungeon) {
        const quiet = furnished.themes.filter((t) => t.id === "bain" || t.id === "ferme").map((t) => floor.rooms[t.room]);
        placeGrounds(floor, seed, depth, quiet);
      }
      // Section 2 : pas de dalles gravées (Thomas, 2026-11-15 : « retire les designs gravure au sol »).
      const motifs = sandboxFloor ? sandboxFloor.motifs : bossFloor || champi || oss ? [] : placeMotifs(floor, seed);
      state = {
        map: floor.map,
        start: floor.start,
        stairs: floor.stairs,
        rooms: floor.rooms,
        torches: floor.torches,
        monsters: [],
        ground: [],
        debris: [],
        blood: [],
        explored: new Uint8Array(floor.map.width * floor.map.height),
        sensed: new Uint8Array(floor.map.width * floor.map.height),
        rng: new Rng(seed ^ 0x5bd1e995), // hasard des combats et des monstres, propre à l'étage
        seenMonsters: new Set<number>(),
        population: 0,
        nextRespawn: 0,
        alarm: 0,
        alarmStage: 0,
        rested: false,
        secrets: [],
        traps: [],
        searched: new Set<number>(),
        furniture: furnished.furniture,
        themes: furnished.themes,
        motifs,
        boss: bossFloor?.boss,
      };
      const tub = furnished.furniture.find((f) => f.kind === "tub");
      if (tub) state.bath = { x: tub.x, y: tub.y, out: false, music: true, beaten: false };
      if (bossFloor) for (const sec of bossFloor.secrets) state.secrets.push({ ...sec, found: false });
      // Le Colporteur : dans la salle d'essai, et au 4e étage de chaque section (Thomas, 2026-11-12).
      if (sandboxFloor) state.merchant = makeMerchant(sandboxFloor.merchant, sandboxFloor.merchant.home, SANDBOX_WARES, seed);
      else if (!bossFloor && (depth - 1) % 5 === MERCHANT.floorInSection - 1) state.merchant = this.placeMerchant(floor, seed, depth) ?? undefined;
      // Salle d'essai de la section 2 : ni porte du compteur, ni poulet, ni PNJ (seulement le décor et les monstres).
      const plainSandbox = sandboxFloor?.look === "champi";
      if (!bossFloor && !plainSandbox && (sandboxFloor || this.funOf(depth) === "counter")) {
        state.counter = this.placeCounterDoor(floor, state, seed, !!sandboxFloor) ?? undefined;
        // Pas de porte qui convienne : la cloche prend sa place (il y a toujours un truc fun dans la section).
        if (!state.counter && !sandboxFloor) {
          const special = new Set((state.themes ?? []).map((t) => t.room));
          placeBell(floor, new Rng(seed ^ 0x5b311e7d), state.furniture ?? [], special);
        }
      }
      // Le poulet (truc fun, Thomas 2026-11-13) ; sans salle qui convienne, la cloche prend sa place.
      if (!bossFloor && !plainSandbox && (sandboxFloor || this.funOf(depth) === "chicken")) {
        state.chicken = this.placeChicken(floor, state, seed, !!sandboxFloor) ?? undefined;
        if (!state.chicken && !sandboxFloor) {
          const special = new Set((state.themes ?? []).map((t) => t.room));
          placeBell(floor, new Rng(seed ^ 0x5b311e7e), state.furniture ?? [], special);
        }
      }
      // La ferme (Thomas, 2026-11-13) : 1 à 3 poules dans le pré, et un poulet échappé dehors (s'il n'y a pas déjà le
      // poulet du truc fun).
      if (!oss) this.placeFarm(state, seed);
      // Pièce secrète (0 à 1 par étage) et marques dans les murs (Thomas, 2026-11-14).
      if (sandboxFloor?.secretRoom) state.secretRoom = JSON.parse(JSON.stringify(sandboxFloor.secretRoom));
      if (!sandboxFloor && !bossFloor) {
        const srng = new Rng(seed ^ 0x5ec7e7);
        if (srng.chance(RULES.secretRoomChance)) {
          const hosts = new Set((state.themes ?? []).map((t) => t.room));
          // Ossuaire : seulement les pièces de toujours (trésor, armurerie, reliquaire, cache), pas celles des sections du dessus.
          state.secretRoom = (oss ? placeSecretRoom(floor, state.furniture, srng, hosts, (["tresor", "reliquaire", "armurerie", "contrebandier"] as const)[srng.int(0, 3)]) : placeSecretRoom(floor, state.furniture, srng, hosts)) ?? undefined;
          if (state.secretRoom) for (const g of state.secretRoom.gold) state.ground.push({ x: g.x, y: g.y, item: "or", count: lessGold((srng.int(RULES.secretGold[0], RULES.secretGold[1]) + depth * 2) * (1 + sectionOf(depth))) });
        }
        if (!oss) placeWallMarks(floor, state.furniture, srng, srng.int(RULES.wallMarks[0], RULES.wallMarks[1]));
        // Niche secrète (planche art/murs_v2.png validée le 2026-11-18) : une dalle à pression qui fait coulisser un pan de mur.
        const nrng = new Rng(seed ^ 0x11c4e);
        if (!oss && nrng.chance(RULES.nicheChance)) state.niche = this.placeNiche(state, nrng) ?? undefined;
        // Ossuaire : l'entrée de la pièce secrète est une PLAQUE FUNÉRAIRE (ou une alcôve de crânes) parmi les autres ;
        // puis tout le décor de la section (lune, alcôves, plaques, pierres tombales, mobilier).
        if (oss) {
          // pas de creux ni de briques manquantes de la section 1
          state.furniture = state.furniture.filter((f) => !/^wall(Gap|Hole)/.test(f.kind));
          const blocked = new Set<string>();
          const sr = state.secretRoom;
          if (sr) {
            const side = sideOf(sr.dir);
            state.furniture.push(srng.chance(0.5) ? { x: sr.entry.x, y: sr.entry.y, kind: "ossTablet", side, variant: "texte" } : { x: sr.entry.x, y: sr.entry.y, kind: "ossAlcove", side, len: 1 });
            for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) blocked.add(`${sr.entry.x + dx},${sr.entry.y + dy}`);
          }
          const special = decorateOssuaire(floor, state.furniture, new Rng(seed ^ 0x055a1e), blocked, [], this.previewS3 && depth === 11);
          // La chapelle des os et le musée : des « salles à thème » pour le reste du jeu (ni piège ni monstre ; Sœur
          // Clavicule, le Conservateur).
          if (special.chapel !== undefined) state.themes = [...(state.themes ?? []), { room: special.chapel, id: "chapelle" } as (typeof state.themes)[number]];
          if (special.museum !== undefined) state.themes = [...(state.themes ?? []), { room: special.museum, id: "musee" } as (typeof state.themes)[number]];
          state.torches = floor.torches;
        }
        // Section 2 : la salle secrète se cache derrière un RIDEAU DE MYCÉLIUM (Thomas, 2026-11-14), plus de creux au mur.
        if (champi) {
          state.furniture = (state.furniture ?? []).filter((f) => !/^wall(Gap|Hole)/.test(f.kind));
          if (state.secretRoom) {
            state.furniture.push({ x: state.secretRoom.entry.x, y: state.secretRoom.entry.y, kind: "mycCurtain" });
            state.secretRoom.peek = { ...state.secretRoom.entry };
          }
        }
      }
      if (champi || bossFloor?.boss.kind === "carillon") state.look = "champi";
      if (bossFloor?.boss.kind === "pretresse") state.look = "ossuaire";
      if (oss) state.look = "ossuaire";
      this.floors.set(depth, state);
    }
    this.useFloor(state, depth);
    this.fires = [];
    this.gas = [];
    this.fog = [];
    this.discordMist = [];
    this.frost = [];
    this.incense = [];
    this.furnitureFire.clear();
    // En descendant, on arrive en haut de l'étage ; en remontant, au pied de l'escalier qui descend.
    const arrival = via === "down" ? state.start : state.stairs;
    this.hero.x = this.hero.fromX = arrival.x;
    this.hero.y = this.hero.fromY = arrival.y;
    this.rescueHero();
    this.path = [];
    this.targetId = null;
    this.waiting = false;
    this.picking = false;
    this.resting = 0;
    this.searching = 0;
    this.hideOrder = false;
    this.jumpTarget = null;
    this.pushTargetId = null;
    this.disarmAt = null;
    this.useOrder = null;
    this.throwOrder = null;
    this.skillOrder = null;
    this.hidden = false;
    this.hideOrder = false;
    this.jumpTarget = null;
    this.pushTargetId = null;
    this.disarmAt = null;
    this.useOrder = null;
    this.throwOrder = null;
    this.skillOrder = null;
    this.shotTarget = null;
    this.pendingStairs = null;
    this.clearDoorOrders();
    // Paniers à fruits : leurs pommes sont de vrais objets au sol, qu'on ramasse (le panier les montre).
    if (fresh) for (const f of state.furniture) if (f.kind === "basket" && f.count) state.ground.push({ x: f.x, y: f.y, item: "pomme", count: f.count });
    if (fresh) for (const f of state.furniture) if (f.kind === "plate" && f.count) state.ground.push({ x: f.x, y: f.y, item: "cuisse_poulet", count: f.count });
    if (fresh && sandboxFloor) {
      this.populateSandbox(state, sandboxFloor, this.resetting);
    } else if (fresh && state.boss?.kind === "carillon") {
      this.spawnCarillon(state);
    } else if (fresh && state.boss?.kind === "pretresse") {
      this.spawnPriestess(state);
    } else if (fresh && state.boss) {
      // La nichée : la Tisseuse seule, au centre de sa grande toile ; ni renforts, ni clef, ni pièges, ni butin au sol.
      const queen = this.newMonster(MONSTERS.tisseuse, state.boss.spawn.x, state.boss.spawn.y, false);
      queen.boss = { phase: "lurk", bites: 0, hpMark: queen.hp, lurk: 0, fallen: 0, hatched: false, hubUp: true, engaged: false };
      this.monsters.push(queen);
      state.population = 0;
    } else if (fresh && state.look === "ossuaire") {
      // Ossuaire (Thomas, 2026-11-19 : « pas de PNJ ni de mob de l'étage inférieur ») : ses monstres à lui (rats,
      // squelettes, acolytes, gisants ; « Ok fonce ») ; ni clef (pas de porte verrouillée), ni piège des sections du
      // dessus. Le butin reste.
      this.spawnMonsters(state.rooms);
      this.wakeEffigies(state, depth);
      state.population = Math.max(1, this.monsters.length);
      state.nextRespawn = this.turn + RULES.respawnTurns;
      placeSecrets(state, depth, floorSeed(this.runSeed, depth));
      // Ses pièges à elle (Thomas, 2026-11-19 : « Maintenant piège », planche art/pieges_oss_v1.png).
      placeTraps(state, floorSeed(this.runSeed, depth), depth);
      if (RULES.lootEnabled) placeLoot(state, depth, floorSeed(this.runSeed, depth));
      placeGuaranteed(state, [...guaranteedLoot(this.runSeed, depth), ...this.raceLoot(depth), ...foodRations(this.runSeed, depth)], floorSeed(this.runSeed, depth));
    } else if (fresh) {
      this.spawnMonsters(state.rooms);
      state.population = Math.max(1, this.monsters.length);
      state.nextRespawn = this.turn + RULES.respawnTurns;
      placeKey(state, this.rng, this.hero);
      placeSecrets(state, depth, floorSeed(this.runSeed, depth));
      placeTraps(state, floorSeed(this.runSeed, depth), depth);
      if (RULES.lootEnabled) placeLoot(state, depth, floorSeed(this.runSeed, depth));
      // Garanties de la section 1 (une pomme à l'étage 1, deux équipements, une gemme, une potion).
      placeGuaranteed(state, [...guaranteedLoot(this.runSeed, depth), ...this.raceLoot(depth), ...foodRations(this.runSeed, depth)], floorSeed(this.runSeed, depth));
    }
    if (fresh && !state.boss) this.placeQuestNpc(state, depth);
    for (const m of this.monsters) {
      m.fromX = m.x;
      m.fromY = m.y;
    }
    // Combats coupés (salle d'essai) : les monstres de ce nouvel étage sont mis de côté eux aussi.
    if (this.peaceful) this.peacefulStash = this.monsters.splice(0);
    this.updateVision();
  }

  private spawnMonsters(rooms: Room[]): void {
    const spawns = spawnsForDepth(this.depth);
    const totalWeight = spawns.entries.reduce((sum, e) => sum + e.weight, 0);
    const quiet = new Set((this.current.themes ?? []).filter((t) => t.id === "chapelle" || t.id === "musee").map((t) => rooms[t.room]));
    rooms.slice(1).forEach((room) => {
      // La chapelle des os : personne n'y entre.
      if (quiet.has(room)) return;
      // Une salle tissée de toiles abrite souvent une araignée (ou deux), qui l'attend dans le noir.
      const webbed = this.current.furniture.some(
        (f) => f.kind.startsWith("web") && f.x >= room.x && f.x < room.x + room.w && f.y >= room.y && f.y < room.y + room.h,
      );
      const spiders = webbed && this.rng.chance(RULES.spiderInWebRoomChance);
      if (!spiders && !this.rng.chance(spawns.roomChance)) return;
      let pick = this.rng.next() * totalWeight;
      const rolled = spawns.entries.find((e) => (pick -= e.weight) < 0) ?? spawns.entries[0];
      const entry = spiders ? (spawns.entries.find((e) => e.monster === "araignee") ?? rolled) : rolled;
      const def = MONSTERS[entry.monster];
      const count = this.rng.int(entry.packMin, entry.packMax);
      const asleep = this.rng.chance(spawns.sleepChance); // tout le groupe dort, ou tout le groupe se promène
      for (let i = 0; i < count; i++) {
        // Quelques essais pour trouver une case libre dans la salle.
        for (let attempt = 0; attempt < 20; attempt++) {
          const x = this.rng.int(room.x, room.x + room.w - 1);
          const y = this.rng.int(room.y, room.y + room.h - 1);
          if (this.map.get(x, y) !== Tile.Floor || this.actorAt(x, y)) continue;
          this.monsters.push(this.newMonster(def, x, y, asleep));
          break;
        }
      }
    });
    // Il y a toujours au moins un promeneur sur l'étage : si tout le monde dort, le dernier venu se lève.
    if (this.monsters.length > 0 && this.monsters.every((m) => m.asleep)) this.monsters[this.monsters.length - 1].asleep = false;
  }

  /**
   * Ossuaire, dès l'étage 13 : un gisant du décor sur deux est un GISANT ÉVEILLÉ (claude/MONSTRES_S3.md) : le meuble
   * s'en va, le monstre couché prend sa place, pareil à l'œil ; il ne se lève que quand la lune le touche.
   */
  private wakeEffigies(state: FloorState, depth: number): void {
    if (depth < 13) return;
    const rng = new Rng(floorSeed(this.runSeed, depth) ^ 0x915a);
    for (const f of state.furniture.filter((g) => g.kind === "gisant")) {
      if (!rng.chance(0.5)) continue;
      for (const c of furnitureCells(f)) this.map.set(c.x, c.y, Tile.Floor);
      state.furniture.splice(state.furniture.indexOf(f), 1);
      const m = this.newMonster(MONSTERS.gisantEveille, f.x, f.y, true);
      m.effigy = true;
      this.monsters.push(m);
    }
  }

  /** Tas d'os : le feu le brise ; dans la lune, il se relève au bout de quelques tours ; dans l'ombre, il reste à terre. */
  private pileAct(m: Actor): void {
    if ((m.burning ?? 0) > 0 || this.isBurning(m.x, m.y)) {
      m.crush = true;
      m.hp = 0;
      this.removeIfDead(m);
      return;
    }
    if (!this.moonlit(m)) return;
    m.pile = (m.pile ?? 1) - 1;
    if (m.pile <= 0) this.raisePile(m);
  }

  private raisePile(m: Actor): void {
    m.pile = undefined;
    m.prone = 0;
    m.crush = false;
    m.alerted = true;
    m.asleep = false;
    this.events.push({ type: "undead", actor: m, what: "rise" });
  }

  /** Gisant couché : il se lève quand la lune le touche et que le héros est près, ou que le héros entre dans la lune près de lui. */
  private effigyWakes(m: Actor): void {
    const near = Math.max(Math.abs(m.x - this.hero.x), Math.abs(m.y - this.hero.y));
    const arena = this.current.boss?.kind === "pretresse" && !!this.bossActor()?.boss?.engaged;
    const wake = (this.moonlit(m) && (arena || (near <= 5 && hasLineOfSight(this.map, m, this.hero)))) || (this.moonlit(this.hero) && near <= 3);
    if (!wake || this.peaceful) return;
    m.effigy = false;
    m.asleep = false;
    m.alerted = true;
    m.moonless = 0;
    this.events.push({ type: "undead", actor: m, what: "wake" });
  }

  /** Gisant éveillé : trois tours hors de la lune, il se recouche sur place et redevient un meuble (on le sème). */
  private effigyRests(m: Actor): boolean {
    if (this.moonlit(m)) {
      m.moonless = 0;
      return false;
    }
    m.moonless = (m.moonless ?? 0) + 1;
    if (m.moonless < RULES.effigyRestTurns) return false;
    m.effigy = true;
    m.asleep = true;
    m.alerted = false;
    m.wary = false;
    m.goal = undefined;
    this.events.push({ type: "undead", actor: m, what: "rest" });
    return true;
  }

  /** Rat d'ossuaire : la nourriture laissée au sol à côté de lui, il la dévore (« Il l'a mangé ! »). */
  private ratEats(m: Actor): boolean {
    if (m.asleep) return false;
    const food = this.current.ground.find((g) => RAT_FOOD.has(g.item) && Math.max(Math.abs(g.x - m.x), Math.abs(g.y - m.y)) <= 1);
    if (!food) return false;
    if (this.inReach(m, this.hero) && this.rng.chance(0.5)) return false;
    food.count--;
    if (food.count <= 0) this.current.ground.splice(this.current.ground.indexOf(food), 1);
    this.events.push({ type: "undead", actor: m, what: "eat", item: food.item });
    return true;
  }

  /**
   * Acolyte de la Lune pâle : un tour sur trois, s'il est en vue et qu'un mort est près de lui, il entonne (annonce) ;
   * au tour suivant il chante : les morts à 4 cases reprennent 4 PV et les tas d'os se relèvent aussitôt.
   */
  private chantAct(m: Actor): boolean {
    if (m.asleep || !m.alerted) return false;
    const undeadNear = (o: Actor) => o !== m && !!(MONSTERS[o.defId as keyof typeof MONSTERS] as MonsterDef | undefined)?.undead && Math.max(Math.abs(o.x - m.x), Math.abs(o.y - m.y)) <= RULES.chantRange;
    if (m.chanting) {
      m.chanting = false;
      for (const o of this.monsters.filter(undeadNear)) {
        if (o.pile !== undefined) this.raisePile(o);
        else o.hp = Math.min(o.maxHp, o.hp + RULES.chantHeal);
      }
      this.events.push({ type: "undead", actor: m, what: "chant" });
      return true;
    }
    const worth = this.monsters.some((o) => undeadNear(o) && (o.pile !== undefined || o.hp < o.maxHp || o.alerted));
    if (!worth || (this.turn + m.id) % 3 !== 0 || !this.isVisible(m.x, m.y)) return false;
    m.chanting = true;
    this.faceToward(m, this.hero);
    this.events.push({ type: "undead", actor: m, what: "chant0" });
    return true;
  }

  /** Coup du héros qui porte (épée, tir) : le gisant couché se lève, l'acolyte qui chante se tait, sonné. */
  private struckByHero(m: Actor, hit: boolean): void {
    if (m.effigy) {
      m.effigy = false;
      m.asleep = false;
      m.alerted = true;
      m.moonless = 0;
      this.events.push({ type: "undead", actor: m, what: "wake" });
    }
    if (hit && m.chanting && m.hp > 0) {
      m.chanting = false;
      m.stunned = Math.max(m.stunned ?? 0, 1);
      this.events.push({ type: "undead", actor: m, what: "daze" });
    }
  }

  /**
   * Crâne lunaire (Thomas, 2026-11-19 : « un mob qui charge et tire un rayon ») : en vue, aligné avec le héros (ligne,
   * colonne ou diagonale) entre 2 et `range` cases, il se charge : la ligne s'allume jusqu'au premier mur. Au tour
   * suivant, le rayon part sur cette ligne : tout ce qui s'y trouve est touché (monstres compris). On l'évite en sortant
   * de la ligne. Puis il refroidit 2 tours.
   */
  private chargeBeam(m: Actor, beam: NonNullable<MonsterDef["beam"]>): boolean {
    if (m.beamCd) {
      m.beamCd--;
      return false;
    }
    const dx = this.hero.x - m.x;
    const dy = this.hero.y - m.y;
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    if (d < 2 || d > beam.range || !(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) return false;
    if (!hasLineOfSight(this.map, m, this.hero) || !this.isVisible(m.x, m.y) || this.fogBetween(m, this.hero)) return false;
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    const cells: Point[] = [];
    for (let k = 1; k <= beam.range + 2; k++) {
      const x = m.x + sx * k;
      const y = m.y + sy * k;
      if (this.map.blocksSight(x, y) || !this.map.inBounds(x, y)) break;
      cells.push({ x, y });
    }
    m.beam = cells;
    this.faceToward(m, this.hero);
    this.events.push({ type: "beam", actor: m, what: "charge", cells });
    return true;
  }

  private fireBeam(m: Actor, beam: NonNullable<MonsterDef["beam"]>): void {
    const cells = m.beam ?? [];
    m.beam = undefined;
    m.beamCd = 2;
    const damage = rollDice(this.rng, beam.damage);
    this.events.push({ type: "beam", actor: m, what: "fire", cells, damage });
    for (const c of cells) {
      if (this.hero.x === c.x && this.hero.y === c.y && !this.over) this.hurtHero(damage, this.killerName(m));
      const o = this.monsterAt(c.x, c.y);
      if (o && o !== m && !this.isInert(o)) {
        o.hp -= damage;
        this.removeIfDead(o, false);
      }
    }
  }

  /** Gel : les monstres sur ces cases sont figés (`RULES.freezeTurns`, le boss un tour) ; le feu y meurt ; givre au sol. */
  private freezeCells(cells: readonly Point[]): void {
    this.fires = this.fires.filter((f) => !cells.some((c) => c.x === f.x && c.y === f.y));
    for (const c of cells) this.frost.push({ x: c.x, y: c.y, turns: RULES.freezeTurns });
    for (const m of this.monsters) {
      if (this.isInert(m) || !cells.some((c) => occupies(m, c.x, c.y))) continue;
      m.petrified = m.boss ? 1 : RULES.freezeTurns;
      m.frozen = true;
      m.burning = 0;
      m.chanting = false;
      m.beam = undefined;
      m.feud = undefined;
      this.events.push({ type: "frost", actor: m, what: "freeze" });
    }
  }

  /** Fin d'un gel ou d'une pétrification. */
  private thaw(m: Actor): void {
    if (m.frozen) {
      m.frozen = false;
      this.events.push({ type: "frost", actor: m, what: "thaw" });
    } else this.events.push({ type: "stone", what: "monsterBack", actor: m });
  }

  /** Chapelet d'argent (Sœur Clavicule) : de la classe d'armure en plus contre un mort. */
  private undeadWard(m: Actor): number {
    if (!(MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef | undefined)?.undead) return 0;
    return Object.values(this.equipment).reduce((n, it) => n + ((it && (ITEMS[it.defId] as ItemDef).undeadAc) || 0), 0);
  }

  /** Os creux ou pierre : les projectiles ne font que la moitié des dégâts. */
  private shotResist(m: Actor, damage: number): number {
    return (MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef | undefined)?.arrowResist ? Math.ceil(damage / 2) : damage;
  }

  /** Ossuaire : la lumière d'un puits de lune tombe sur cette case (même salle, à portée, rien entre les deux). */
  moonlit(p: Point): boolean {
    if (this.current?.look !== "ossuaire") return false;
    // Potion de nuit : là où elle est versée (ou autour du héros qui l'a bue), la lune ne touche plus rien.
    for (const n of this.current.nights ?? []) {
      const c = n.hero ? this.hero : n;
      if (Math.max(Math.abs(p.x - c.x), Math.abs(p.y - c.y)) <= 2) return false;
    }
    for (const f of this.current.furniture) {
      if (f.kind !== "moonWell") continue;
      const r = moonArea(this, f);
      if (p.x < r.x || p.x >= r.x + r.w || p.y < r.y || p.y >= r.y + r.h) continue;
      if (Math.hypot(p.x - f.x, p.y - f.y) <= (f.variant === "boss" ? this.bossWellRadius() + 0.5 : RULES.moonRadius - 0.5)) return true;
    }
    // Miroir de lune (piège) : la lumière tombe autour de lui quelques tours.
    for (const f of this.current.moonFlashes ?? []) if (Math.max(Math.abs(p.x - f.x), Math.abs(p.y - f.y)) <= 2 && hasLineOfSight(this.map, f, p)) return true;
    return false;
  }

  private newMonster(def: MonsterDef, x: number, y: number, asleep: boolean): Actor {
    return {
      id: this.nextId++,
      kind: "monster",
      defId: def.id,
      name: def.name,
      x,
      y,
      fromX: x,
      fromY: y,
      hp: def.hp,
      maxHp: def.hp,
      armorClass: def.armorClass,
      attackBonus: def.attackBonus,
      damage: def.damage,
      vision: def.vision,
      alerted: false,
      asleep,
      // Regard de départ : une des quatre directions, d'après son numéro (sans toucher au hasard du jeu).
      facing: (["down", "left", "right", "up"] as const)[this.nextId % 4],
      ...((def.size ?? 1) > 1 ? { size: def.size } : {}),
    };
  }

  /**
   * La porte du Kobold qui compte (Thomas, 2026-11-12), de temps en temps : une porte ordinaire entre un couloir et
   * une salle, qu'on verrouille ; il se tient juste derrière, dans la salle. Jamais une porte dont la fermeture
   * couperait une partie de l'étage (on doit pouvoir passer ailleurs). En salle d'essai : toujours, si possible.
   */
  /**
   * Le poulet (Thomas, 2026-11-13) : une salle ordinaire qui n'a qu'une porte ; cette porte se verrouille pour de bon
   * (aucun jet ne l'ouvre, la clef n'y entre pas) ; un coffre dedans, et le mur du fond où le poulet finira. Le poulet
   * attend dans une autre salle, loin de l'arrivée. En salle d'essai : la salle derrière la salle de bain.
   */
  private placeChicken(floor: { map: GameMap; start: Point; stairs: Point; rooms: Room[] }, state: FloorState, seed: number, sandbox: boolean): ChickenState | null {
    const rng = new Rng(seed ^ 0x9011e7);
    const { map, rooms } = floor;
    const inside = (r: Room, p: Point) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
    const themed = new Set((state.themes ?? []).map((t) => t.room));
    const open = reachable(map, floor.start);
    const tryRoom = (index: number, door: Point, spot?: Point): ChickenState | null => {
      const room = rooms[index];
      const was = map.get(door.x, door.y);
      map.set(door.x, door.y, Tile.DoorLocked);
      const center = { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
      const field = distanceField(map, floor.start);
      const cut = field[map.index(center.x, center.y)] < 0 && field[map.index(floor.stairs.x, floor.stairs.y)] >= 0 && open - reachable(map, floor.start) <= room.w * room.h + 1;
      if (!cut) {
        map.set(door.x, door.y, was);
        return null;
      }
      // Le mur du fond : la case de la salle la plus loin de la porte ; le coffre, la plus loin ensuite.
      const fromDoor = distanceField(map, door, (x, y) => inside(room, { x, y }) || (x === door.x && y === door.y));
      const cells: { x: number; y: number; d: number }[] = [];
      for (let y = room.y; y < room.y + room.h; y++)
        for (let x = room.x; x < room.x + room.w; x++)
          if (map.get(x, y) === Tile.Floor && fromDoor[map.index(x, y)] > 0) cells.push({ x, y, d: fromDoor[map.index(x, y)] });
      cells.sort((a, b) => b.d - a.d);
      const crash = cells[0];
      const chest = cells.find((c) => Math.max(Math.abs(c.x - crash.x), Math.abs(c.y - crash.y)) >= 2 && c.d >= 2);
      if (!crash || !chest) {
        map.set(door.x, door.y, was);
        return null;
      }
      map.set(chest.x, chest.y, Tile.Chest);
      // Le poulet : ailleurs, dans une salle (jamais dans un passage), atteignable.
      const free = (x: number, y: number) => this.npcFree(state, x, y) && distanceField(map, floor.start)[map.index(x, y)] >= 0;
      let at = spot && free(spot.x, spot.y) ? spot : null;
      for (let attempt = 0; attempt < 80 && !at; attempt++) {
        const k = rng.int(1, rooms.length - 1);
        if (k === index || themed.has(k) || inside(rooms[k], floor.start)) continue;
        const r = rooms[k];
        const p = { x: rng.int(r.x, r.x + r.w - 1), y: rng.int(r.y, r.y + r.h - 1) };
        if (free(p.x, p.y)) at = p;
      }
      if (!at) {
        map.set(chest.x, chest.y, Tile.Floor);
        map.set(door.x, door.y, was);
        return null;
      }
      return { x: at.x, y: at.y, door: { x: door.x, y: door.y }, crash: { x: crash.x, y: crash.y }, room: index, done: false };
    };
    if (sandbox) {
      const spot = this.sandboxFloor()?.chicken;
      return spot ? tryRoom(spot.room, spot.door, spot.at) : null;
    }
    const order = rooms.map((_, i) => i).filter((i) => i > 0 && !themed.has(i) && !inside(rooms[i], floor.start) && !inside(rooms[i], floor.stairs) && rooms[i].w >= 3 && rooms[i].h >= 3);
    while (order.length > 0) {
      const index = order.splice(rng.int(0, order.length - 1), 1)[0];
      const room = rooms[index];
      // Une seule ouverture sur son pourtour, une porte.
      const openings: Point[] = [];
      for (let x = room.x - 1; x <= room.x + room.w; x++)
        for (let y = room.y - 1; y <= room.y + room.h; y++) {
          if (inside(room, { x, y })) continue;
          const onRing = x === room.x - 1 || x === room.x + room.w || y === room.y - 1 || y === room.y + room.h;
          const corner = (x === room.x - 1 || x === room.x + room.w) && (y === room.y - 1 || y === room.y + room.h);
          if (onRing && !corner && map.get(x, y) !== Tile.Wall) openings.push({ x, y });
        }
      if (openings.length !== 1 || map.get(openings[0].x, openings[0].y) !== Tile.DoorClosed) continue;
      const done = tryRoom(index, openings[0]);
      if (done) return done;
    }
    return null;
  }

  private placeFarm(state: FloorState, seed: number): void {
    const theme = (state.themes ?? []).find((t) => t.id === "ferme");
    const furniture = state.furniture ?? [];
    const field = furniture.filter((f) => f.kind === "soil" || f.kind === "soil2").map((f) => ({ x: f.x, y: f.y }));
    if (!theme || field.length === 0) return;
    const rng = new Rng(seed ^ 0xfa53e1);
    const taken = (x: number, y: number) => furniture.some((f) => f.x === x && f.y === y && f.kind !== "soil" && f.kind !== "soil2");
    const free = field.filter((c) => !taken(c.x, c.y));
    const hens: { x: number; y: number; fromX: number; fromY: number }[] = [];
    for (let k = rng.int(1, 3); k > 0 && free.length > 0; k--) {
      const c = free.splice(rng.int(0, free.length - 1), 1)[0];
      hens.push({ x: c.x, y: c.y, fromX: c.x, fromY: c.y });
    }
    state.farm = { field, hens };
    // Des plumes dans le pré (Thomas, 2026-11-14), là où il n'y a rien d'autre que la terre.
    // (Un hasard à part : le reste de la ferme ne change pas.)
    const frng = new Rng(seed ^ 0xfea7e5);
    const bare = free.filter((c) => !hens.some((h) => h.x === c.x && h.y === c.y));
    for (let k = Math.min(bare.length, frng.int(3, 5)); k > 0; k--) {
      const c = bare.splice(frng.int(0, bare.length - 1), 1)[0];
      furniture.push({ x: c.x, y: c.y, kind: frng.chance(0.5) ? "plumesA" : "plumesB" });
    }
    // Le poulet du truc fun est déjà là (salle d'essai) : celui de la ferme a son propre emplacement.
    const slot: "chicken" | "farmChicken" = state.chicken ? "farmChicken" : "chicken";
    const room = state.rooms[theme.room];
    const cells: Point[] = [];
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) if (this.npcFree(state, x, y)) cells.push({ x, y });
    // Le même dispositif que le poulet du truc fun (Thomas, 2026-11-14) : un POULAILLER fermé contre un mur de la ferme,
    // porte verrouillée que rien n'ouvre ; le poulet fait le tour de la ferme, défonce la porte, s'écrase au fond.
    const floorLike = { map: state.map, rooms: state.rooms, torches: state.torches, start: state.start, stairs: state.stairs, specials: [] };
    const pen = cells.length > 0 ? carvePocket(floorLike, furniture, rng, theme.room, 3, 3) : null;
    if (pen) {
      state.map.set(pen.entry.x, pen.entry.y, Tile.DoorLocked);
      const perp = { x: pen.dir.y !== 0 ? 1 : 0, y: pen.dir.x !== 0 ? 1 : 0 };
      const back = (a: number) => ({ x: pen.entry.x + pen.dir.x * 3 + perp.x * a, y: pen.entry.y + pen.dir.y * 3 + perp.y * a });
      state.map.set(back(-1).x, back(-1).y, Tile.Chest);
      furniture.push({ x: back(1).x, y: back(1).y, kind: "hayBale" });
      state.map.set(back(1).x, back(1).y, Tile.Furniture);
      const at = cells[rng.int(0, cells.length - 1)];
      state[slot] = { x: at.x, y: at.y, door: { ...pen.entry }, crash: back(0), room: theme.room, pen: pen.room, done: false };
      return;
    }
    if (slot === "farmChicken") return;
    // Sans place pour le poulailler : il ira se viander contre le mur le plus loin, à 12 pas au plus.
    while (cells.length > 0) {
      const at = cells.splice(rng.int(0, cells.length - 1), 1)[0];
      const dist = distanceField(state.map, at);
      let best: Point | null = null;
      let far = 4;
      for (let y = 1; y < state.map.height - 1; y++)
        for (let x = 1; x < state.map.width - 1; x++) {
          const d = dist[state.map.index(x, y)];
          if (d <= far || d > 12 || state.map.get(x, y) !== Tile.Floor) continue;
          if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => state.map.get(x + dx, y + dy) === Tile.Wall)) continue;
          far = d;
          best = { x, y };
        }
      if (best) {
        state.chicken = { x: at.x, y: at.y, crash: best, room: theme.room, done: false };
        return;
      }
    }
  }

  /** La ferme de l'étage (le pré, les poules), s'il y en a une. */
  farm(): Readonly<NonNullable<FloorState["farm"]>> | null {
    return this.current.farm ?? null;
  }

  /** Les poules du pré se promènent : une fois sur deux, un pas vers une case libre du pré. */
  private moveHens(): void {
    const farm = this.current.farm;
    if (!farm) return;
    const rng = new Rng((this.runSeed ^ Math.imul(this.turn + 1, 0x9e3779b1) ^ this.depth) >>> 0);
    const furniture = this.current.furniture ?? [];
    const inField = (x: number, y: number) => farm.field.some((c) => c.x === x && c.y === y);
    const blocked = (x: number, y: number) => furniture.some((f) => f.x === x && f.y === y && f.kind !== "soil" && f.kind !== "soil2");
    for (const h of farm.hens) {
      h.fromX = h.x;
      h.fromY = h.y;
      if (!rng.chance(0.5)) continue;
      const steps: Point[] = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = h.x + dx;
          const y = h.y + dy;
          if ((dx || dy) && inField(x, y) && !blocked(x, y) && !farm.hens.some((o) => o !== h && o.x === x && o.y === y)) steps.push({ x, y });
        }
      if (steps.length === 0) continue;
      const s = steps[rng.int(0, steps.length - 1)];
      h.x = s.x;
      h.y = s.y;
    }
  }

  /** Les poulets de l'étage : celui du truc fun et celui de la ferme (les deux en salle d'essai). */
  chickens(): ChickenState[] {
    return [this.current?.chicken, this.current?.farmChicken].filter((c): c is ChickenState => !!c);
  }

  /** Le poulet (encore là), s'il est sur cette case. */
  chickenAt(x: number, y: number): ChickenState | null {
    return this.chickens().find((c) => !c.done && c.x === x && c.y === y) ?? null;
  }

  chicken(): Readonly<ChickenState> | null {
    return this.current.chicken ?? null;
  }

  /** La porte d'un poulet, tant qu'il ne l'a pas défoncée. */
  private sealedDoor(x: number, y: number): boolean {
    return this.chickens().some((c) => !c.done && !!c.door && c.door.x === x && c.door.y === y);
  }

  /**
   * On dérange le poulet : il panique, traverse le donjon, défonce la porte qu'aucun jet n'ouvrait et s'écrase contre
   * le mur du fond, dans un nuage de plumes ; une cuisse reste au sol. Tout se joue d'un coup ; l'écran rejoue sa course.
   */
  private scareChicken(c: ChickenState | null): void {
    if (!c || c.done) return;
    // La porte reste debout jusqu'à ce qu'il la touche (Thomas, 2026-11-14) : l'affichage appelle `chickenDoorBroken`.
    const was = c.door ? this.map.get(c.door.x, c.door.y) : null;
    if (c.door) this.map.set(c.door.x, c.door.y, Tile.Floor);
    const from = { x: c.x, y: c.y };
    // D'abord un tour complet de sa salle, en panique (Thomas, 2026-11-14), puis droit sur la porte.
    const lap = this.chickenLap(from);
    const tail = findPath(this.map, lap.length > 0 ? lap[lap.length - 1] : from, c.crash) ?? [c.crash];
    const path = [...lap, ...tail];
    if (c.door && was !== null) this.map.set(c.door.x, c.door.y, was);
    const seen = this.isVisible(c.crash.x, c.crash.y) || (!!c.door && this.isVisible(c.door.x, c.door.y));
    c.done = true;
    c.x = c.crash.x;
    c.y = c.crash.y;
    this.dropItem(c.crash.x, c.crash.y, "cuisse_poulet", 1);
    // Des plumes sur le sol de la pièce derrière la porte (Thomas, 2026-11-14).
    const behind = c.pen ?? (c.door ? this.rooms[c.room] : null);
    if (behind) {
      const cells: Point[] = [];
      for (let y = behind.y; y < behind.y + behind.h; y++)
        for (let x = behind.x; x < behind.x + behind.w; x++) if (this.map.get(x, y) === Tile.Floor && !this.furnitureAt(x, y)) cells.push({ x, y });
      for (let k = Math.min(cells.length, 3 + this.rng.int(0, 3)); k > 0; k--) {
        const p = cells.splice(this.rng.int(0, cells.length - 1), 1)[0];
        this.current.furniture.push({ x: p.x, y: p.y, kind: this.rng.chance(0.5) ? "plumesA" : "plumesB" });
        this.map.touch(p.x, p.y);
      }
    }
    if (!c.door) this.chickenDoorBroken(c.crash);
    this.events.push({ type: "chicken", path: [from, ...path], door: c.door ? { ...c.door } : undefined, crash: { ...c.crash }, seen });
  }

  /** Le poulet qui court porte une petite lueur (Thomas, 2026-11-14 : « on doit le voir dans le noir, et les cases autour »). */
  private chickenLight: Point | null = null;

  /** L'affichage suit la course du poulet : sa case (ou `null` à la fin). Ses cases voisines se voient. */
  chickenGlow(p: Point | null): void {
    this.chickenLight = p ? { x: p.x, y: p.y } : null;
    this.refreshLight();
    this.updateVision();
  }

  /** Le poulet touche la porte : elle éclate (appelé par l'affichage au bon moment de sa course). */
  chickenDoorBroken(door: Point): void {
    const c = this.chickens().find((k) => k.door && k.door.x === door.x && k.door.y === door.y);
    if (c?.door && this.map.isDoor(c.door.x, c.door.y)) {
      this.map.set(c.door.x, c.door.y, Tile.Floor);
      this.refreshLight();
      this.updateVision();
    }
  }

  /** Le tour de sa salle : par les quatre « coins » des cases où il peut courir, dans le sens des aiguilles d'une montre. */
  private chickenLap(from: Point): Point[] {
    const room = this.rooms.find((r) => from.x >= r.x && from.x < r.x + r.w && from.y >= r.y && from.y < r.y + r.h);
    if (!room) return [];
    const inRoom = (x: number, y: number) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
    const dist = distanceField(this.map, from, (x, y) => inRoom(x, y) && !this.map.isDoor(x, y));
    const cells: Point[] = [];
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) if (dist[this.map.index(x, y)] >= 0) cells.push({ x, y });
    if (cells.length < 4) return [];
    const best = (score: (p: Point) => number) => cells.reduce((a, b) => (score(b) > score(a) ? b : a));
    const corners = [best((p) => -p.x - p.y), best((p) => p.x - p.y), best((p) => p.x + p.y), best((p) => -p.x + p.y)];
    const near = corners.reduce((k, p, i) => (Math.abs(p.x - from.x) + Math.abs(p.y - from.y) < Math.abs(corners[k].x - from.x) + Math.abs(corners[k].y - from.y) ? i : k), 0);
    const order = [0, 1, 2, 3, 4].map((i) => corners[(near + i) % 4]);
    const out: Point[] = [];
    let at = from;
    for (const p of order) {
      if (p.x === at.x && p.y === at.y) continue;
      const seg = findPath(this.map, at, p, (x, y) => inRoom(x, y) && !this.map.isDoor(x, y));
      if (!seg) continue;
      out.push(...seg);
      at = p;
    }
    return out;
  }

  private placeCounterDoor(floor: { map: GameMap; start: Point; stairs: Point; rooms: Room[] }, state: FloorState, seed: number, sandbox: boolean): CounterDoor | null {
    const rng = new Rng(seed ^ 0x2a7c11e3);
    const { map } = floor;
    if (sandbox) {
      // Salle d'essai : le placard prévu par le plan.
      const spot = this.sandboxFloor()?.counter;
      if (!spot || map.get(spot.door.x, spot.door.y) !== Tile.DoorClosed) return null;
      map.set(spot.door.x, spot.door.y, Tile.DoorLocked);
      return { x: spot.door.x, y: spot.door.y, inside: { ...spot.inside }, n: RULES.counterStart, heard: false, opened: false };
    }
    const inRoom = (p: Point) => floor.rooms.findIndex((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
    const doors: Point[] = [];
    for (let y = 1; y < map.height - 1; y++) for (let x = 1; x < map.width - 1; x++) if (map.get(x, y) === Tile.DoorClosed) doors.push({ x, y });
    const open = reachable(map, floor.start);
    while (doors.length > 0) {
      const door = doors.splice(rng.int(0, doors.length - 1), 1)[0];
      const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: door.x + dx, y: door.y + dy })).filter((p) => map.isWalkable(p.x, p.y));
      const inside = sides.find((p) => inRoom(p) > 0 && map.get(p.x, p.y) === Tile.Floor && !state.furniture?.some((f) => f.x === p.x && f.y === p.y));
      if (!inside || sides.length !== 2) continue;
      if ((inside.x === floor.stairs.x && inside.y === floor.stairs.y) || (inside.x === floor.start.x && inside.y === floor.start.y)) continue;
      map.set(door.x, door.y, Tile.DoorLocked);
      if (reachable(map, floor.start) === open - 1) return { x: door.x, y: door.y, inside, n: RULES.counterStart, heard: false, opened: false };
      map.set(door.x, door.y, Tile.DoorClosed);
    }
    return null;
  }

  /**
   * UN TRUC FUN PAR SECTION (Thomas, 2026-11-12) : sur quel étage de la section, et lequel (cloche ou porte du
   * compteur). Tiré une fois pour toutes d'après la graine de la partie ; jamais à l'étage du boss, ni en salle d'essai.
   */
  funOf(depth: number): "bell" | "counter" | "bath" | "chicken" | null {
    if (this.sandbox && depth === 1) return null;
    const section = Math.floor((depth - 1) / RULES.floorsPerSection);
    const rng = new Rng((this.runSeed ^ Math.imul(section + 1, 0x9e3779b1)) >>> 0);
    const floor = section * RULES.floorsPerSection + rng.int(1, RULES.funMaxFloor);
    if (floor !== depth) return null;
    // Thomas, 2026-11-13 : la salle de bain du Kobold, puis le poulet, rejoignent la cloche et la porte du compteur
    // (un quart chacun).
    // Section 2 : pas de Kobold de la section 1 (Thomas, 2026-11-15) : ni porte du compteur, ni salle de bain.
    // Section 3, l'Ossuaire : rien des sections du dessus (Thomas, 2026-11-19).
    if (section >= 2) return null;
    if (section >= 1) return rng.int(0, 1) === 0 ? "bell" : "chicken";
    const pick = rng.int(0, 3);
    return pick === 0 ? "bell" : pick === 1 ? "counter" : pick === 2 ? "bath" : "chicken";
  }

  /** La porte du compteur à cette case (encore fermée), s'il y en a une. */
  counterAt(x: number, y: number): CounterDoor | null {
    const c = this.current.counter;
    return c && !c.opened && c.x === x && c.y === y ? c : null;
  }

  /** Le Kobold compte, quand le héros est assez près pour l'entendre (tous les quelques tours). */
  private counterChatter(): void {
    const c = this.current.counter;
    if (!c || c.opened) return;
    const d = Math.max(Math.abs(c.x - this.hero.x), Math.abs(c.y - this.hero.y));
    if (d > RULES.counterHearing) return;
    this.events.push({ type: "counter", what: "count", n: c.n, x: c.x, y: c.y, first: !c.heard });
    c.heard = true;
  }

  /** Regarder par le trou : le doigt dans l'œil, et il compte un de plus. */
  private peekCounter(c: CounterDoor): void {
    c.n++;
    c.heard = true;
    this.events.push({ type: "counter", what: "poke", n: c.n, x: c.x, y: c.y });
    this.hurtHero(RULES.counterPoke, "un doigt dans l'œil");
  }

  /** La porte s'ouvre (crochetée, enfoncée ou à la clef) : le Kobold est là, surpris, sa bourse pleine. */
  private releaseCounter(c: CounterDoor): void {
    c.opened = true;
    // Il est de l'AUTRE côté de la porte que le héros (Thomas, 2026-11-12 : « le mob est arrivé derrière moi » : le héros
    // avait forcé la porte depuis la salle, et le Kobold apparaissait de son côté).
    const d2 = (p: Point) => (p.x - this.hero.x) ** 2 + (p.y - this.hero.y) ** 2;
    const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy }))
      .filter((p) => this.map.isWalkable(p.x, p.y));
    const far = sides.sort((a, b) => d2(b) - d2(a))[0] ?? c.inside;
    const doorD = d2(c);
    const spot = [far, ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: far.x + dx, y: far.y + dy }))].find(
      (p) => this.map.isWalkable(p.x, p.y) && !this.actorAt(p.x, p.y) && !(p.x === c.x && p.y === c.y) && d2(p) > doorD,
    );
    if (!spot) return;
    const kobold = this.newMonster(MONSTERS.schrat, spot.x, spot.y, false);
    kobold.name = "Kobold qui compte";
    kobold.alerted = true;
    kobold.stunned = 1; // surpris : il perd son premier tour
    kobold.purse = c.n;
    this.faceToward(kobold, this.hero);
    this.monsters.push(kobold);
    this.events.push({ type: "counter", what: "caught", n: c.n + 1, x: spot.x, y: spot.y });
  }

  /** Étage d'un boss ? (le dernier de chaque section ; en salle d'essai, l'étage 2, sous l'escalier). */
  /** La grotte du Carillon : lui (3 × 3), son battant sous son chapeau, trois Kobolds envahis endormis. */
  private spawnCarillon(state: FloorState): void {
    const b = state.boss!;
    const bell = this.newMonster(MONSTERS.carillon, b.spawn.x, b.spawn.y, false);
    bell.boss = { phase: "lurk", bites: 0, hpMark: bell.hp, lurk: 0, fallen: 0, hatched: false, hubUp: false, engaged: false, ring: RULES.carillonEvery, clapperUp: true };
    bell.alerted = true;
    bell.facing = "down";
    this.monsters.push(bell);
    if (b.clapper) {
      const clap = this.newMonster(MONSTERS.battant, b.clapper.x, b.clapper.y, false);
      clap.alerted = true;
      this.monsters.push(clap);
    }
    for (const p of b.sleepers ?? []) this.monsters.push(this.newMonster(MONSTERS.fidele, p.x, p.y, true));
    state.population = 0;
  }

  /** Le Carillon a-t-il le héros « en vue » pour son onde (rien entre eux qui bloque : mur, souche, autre monstre) ? */
  private waveReaches(from: Point, to: Point): boolean {
    for (const c of lineBetween(from, to)) {
      if (c.x === to.x && c.y === to.y) break;
      const t = this.map.get(c.x, c.y);
      if (t === Tile.Wall || t === Tile.Pillar || t === Tile.Furniture || t === Tile.DoorClosed || t === Tile.DoorLocked) return false;
      const o = this.monsterAt(c.x, c.y);
      if (o && !o.boss && !this.isInert(o)) return false;
    }
    return true;
  }

  // ---------- Boss de la section 3 : la Grande Prêtresse et son Colosse (planche art/ossuaire_boss_v1.png) ----------

  private spawnPriestess(state: FloorState): void {
    const b = state.boss!;
    const pr = this.newMonster(MONSTERS.pretresse, b.spawn.x, b.spawn.y, false);
    pr.boss = { phase: "lurk", bites: 0, hpMark: pr.hp, lurk: 0, fallen: 0, hatched: false, hubUp: false, engaged: false, callIn: RULES.priestessCallEvery, chantIn: RULES.priestessChantEvery };
    pr.alerted = true;
    pr.facing = "down";
    this.monsters.push(pr);
    // Les gisants : couchés comme le décor, la lune les relève.
    for (const p of b.sleepers ?? []) {
      const g = this.newMonster(MONSTERS.gisantEveille, p.x, p.y, true);
      g.effigy = true;
      this.monsters.push(g);
    }
    state.population = 0;
  }

  /** Le puits de lune de la salle de la Prêtresse. */
  private bossWell(): Furniture | undefined {
    return this.current.furniture.find((f) => f.kind === "moonWell" && f.variant === "boss");
  }

  /** Rayon du puits de la Prêtresse : il rétrécit à chaque cierge violet éteint. */
  bossWellRadius(): number {
    const lit = this.current.furniture.filter((f) => f.kind === "ciergeViolet").length;
    return RULES.priestessWellRadius[Math.min(lit, RULES.priestessWellRadius.length - 1)];
  }

  /** La case où le puits va glisser (annoncée), s'il y en a une. */
  bossWellTarget(): Point | undefined {
    return this.bossActor()?.boss?.wellTo;
  }

  /** Éteindre un cierge violet (le héros à côté, un tour). */
  private snuffCandle(f: Furniture): void {
    f.kind = "ciergeVioletOff";
    this.map.touch(f.x, f.y);
    this.events.push({ type: "priestess", what: "snuff", x: f.x, y: f.y, left: this.current.furniture.filter((o) => o.kind === "ciergeViolet").length });
    this.refreshLight();
  }

  /** Une attaque ordinaire d'un monstre au contact du héros (bras du Colosse). */
  private monsterStrikes(m: Actor): void {
    this.faceToward(m, this.hero);
    const result = rollAttack(this.rng, m, { armorClass: this.hero.armorClass + this.guardBonus() + this.undeadWard(m) });
    result.damage = this.absorb(result.damage);
    this.events.push({ type: "attack", attacker: m, target: this.hero, result });
    if (result.damage > 0) this.bleed(this.hero, m);
    this.hurtHero(result.damage, this.killerName(m));
    if (result.damage > 0 && this.bastionActive() && !m.boss && (m.size ?? 1) === 1 && this.hero.hp > 0) this.knockBack(m);
  }

  /**
   * La Grande Prêtresse. Phase 1 : elle s'approche et frappe de son bâton ; tous les `priestessCallEvery` tours elle
   * APPELLE LA LUNE (un cercle s'allume sous le héros) et le puits y glisse au tour suivant ; tous les
   * `priestessChantEvery` tours elle ENTONNE (annoncé) puis CHANTE : les morts de la salle reprennent des PV, les tas d'os
   * se relèvent ; frappée pendant l'annonce, elle est sonnée. À mi-vie : elle monte chanter dans le puits (hors d'atteinte
   * du corps à corps) et les os de la salle se lèvent en COLOSSE. Le Colosse tombé, elle redescend, épuisée.
   */
  private priestessAct(m: Actor): void {
    const st = m.boss!;
    const lair = this.current.boss!.lair;
    if (!st.engaged) {
      if (!this.inLair(lair, this.hero)) return;
      st.engaged = true;
      this.events.push({ type: "priestess", what: "awake", x: m.x, y: m.y });
    }
    if (m.stunned) {
      m.stunned--;
      return;
    }
    const well = this.bossWell();
    // Le puits glisse là où elle l'a appelé.
    if (st.wellTo && well) {
      well.x = st.wellTo.x;
      well.y = st.wellTo.y;
      st.wellTo = undefined;
      if (m.aloft) {
        m.x = well.x;
        m.y = well.y;
      }
      this.events.push({ type: "priestess", what: "moved", x: well.x, y: well.y });
      this.refreshLight();
      return;
    }
    // Mi-vie : le Colosse se lève.
    if (!st.colossus && m.hp * 2 <= m.maxHp && well) {
      st.colossus = true;
      this.raiseColossus(m, well);
      return;
    }
    // Le chant (annoncé le tour d'avant).
    if (m.chanting) {
      m.chanting = false;
      for (const o of this.monsters) {
        if (o === m || !(MONSTERS[o.defId as keyof typeof MONSTERS] as MonsterDef | undefined)?.undead || !this.inLair(lair, o)) continue;
        if (o.pile !== undefined) this.raisePile(o);
        else o.hp = Math.min(o.maxHp, o.hp + RULES.priestessChantHeal);
      }
      // Plus dure (Thomas, 2026-11-19) : le chant relève aussi un squelette au pied du socle, tant que la salle
      // compte moins de `priestessRaiseMax` morts debout.
      const standing = this.monsters.filter((o) => o !== m && o.pile === undefined && !o.effigy && (MONSTERS[o.defId as keyof typeof MONSTERS] as MonsterDef | undefined)?.undead && this.inLair(lair, o)).length;
      if (standing < RULES.priestessRaiseMax) {
        const at = this.nearFree({ x: lair.x + Math.floor(lair.w / 2), y: lair.y + 1 });
        if (at) {
          const sk = this.newMonster(MONSTERS.squelette, at.x, at.y, false);
          sk.alerted = true;
          this.monsters.push(sk);
          this.events.push({ type: "undead", actor: sk, what: "rise" });
        }
      }
      this.events.push({ type: "undead", actor: m, what: "chant" });
      return;
    }
    st.chantIn = (st.chantIn ?? RULES.priestessChantEvery) - 1;
    st.callIn = (st.callIn ?? RULES.priestessCallEvery) - 1;
    // Le héros dans le brouillard : elle ne le voit pas, ne l'appelle pas et ne marche pas sur lui.
    const lost = gapBetween(m, this.hero) > 1 && this.fogBetween(m, this.hero);
    if (lost && st.callIn <= 0) st.callIn = 1;
    if (st.callIn <= 0 && well) {
      st.callIn = RULES.priestessCallEvery;
      // Elle appelle la lune sous les pieds du héros (sur une case de la salle).
      const to = { x: Math.max(lair.x, Math.min(lair.x + lair.w - 1, this.hero.x)), y: Math.max(lair.y + 1, Math.min(lair.y + lair.h - 1, this.hero.y)) };
      st.wellTo = to;
      this.events.push({ type: "priestess", what: "call", x: to.x, y: to.y });
      return;
    }
    if (st.chantIn <= 0) {
      st.chantIn = RULES.priestessChantEvery;
      m.chanting = true;
      this.events.push({ type: "undead", actor: m, what: "chant0" });
      return;
    }
    if (m.aloft) {
      // Dans le puits (Thomas, 2026-11-19 : « beaucoup trop simple ») : un éclair de lune sur le héros, s'il est en vue.
      if (!lost && (this.turn + m.id) % RULES.priestessBoltEvery === 0 && hasLineOfSight(this.map, m, this.hero)) {
        const result = rollAttack(this.rng, { attackBonus: 8, damage: { count: 2, sides: 6, bonus: 2 } }, { armorClass: this.hero.armorClass + this.stanceBonus() });
        result.damage = this.absorb(result.damage);
        this.events.push({ type: "attack", attacker: m, target: this.hero, result, ranged: true });
        if (result.damage > 0) this.bleed(this.hero, m);
        this.hurtHero(result.damage, this.killerName(m));
      }
      return;
    }
    // Phase 1 : au contact, un coup de bâton ; sinon un pas vers le héros (un tour sur deux).
    if (gapBetween(m, this.hero) <= 1) {
      this.monsterStrikes(m);
      return;
    }
    if (!lost && (this.turn + m.id) % 2 === 0) this.stepToward(m, this.hero);
  }

  /** Mi-vie : la Prêtresse monte dans le puits ; le Colosse (3 × 3) se lève au plus près du milieu de la salle. */
  private raiseColossus(pr: Actor, well: Furniture): void {
    const lair = this.current.boss!.lair;
    pr.aloft = true;
    pr.x = well.x;
    pr.y = well.y;
    pr.chanting = false;
    const cx = lair.x + Math.floor(lair.w / 2) - 1;
    const cy = lair.y + Math.floor(lair.h / 2) - 1;
    const free = (x: number, y: number) => this.map.get(x, y) === Tile.Floor && !(x === this.hero.x && y === this.hero.y) && !this.monsters.some((o) => o !== pr && occupies(o, x, y));
    const fits = (x: number, y: number) => {
      for (let dy = -1; dy <= 3; dy++) for (let dx = -1; dx <= 3; dx++) {
        const inBody = dx >= 0 && dx < 3 && dy >= 0 && dy < 3;
        const part = (dy === 1 && (dx === -1 || dx === 3)) || (dy === -1 && dx === 1);
        if ((inBody || part) && !free(x + dx, y + dy)) return false;
      }
      return !(pr.x >= x && pr.x < x + 3 && pr.y >= y && pr.y < y + 3);
    };
    let at: Point | null = null;
    for (let r = 0; r < 8 && !at; r++) {
      for (let dy = -r; dy <= r && !at; dy++) for (let dx = -r; dx <= r && !at; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && fits(cx + dx, cy + dy)) at = { x: cx + dx, y: cy + dy };
    }
    if (!at) at = { x: cx, y: cy };
    const body = this.newMonster(MONSTERS.colosse, at.x, at.y, false);
    body.alerted = true;
    body.regrow = {};
    this.monsters.push(body);
    this.spawnColossusPart(body, "armL");
    this.spawnColossusPart(body, "armR");
    this.spawnColossusPart(body, "head");
    this.guardColossus(body);
    this.events.push({ type: "priestess", what: "colossus", x: at.x, y: at.y });
  }

  private colossusPartAt(body: Actor, part: "armL" | "armR" | "head"): Point {
    return part === "armL" ? { x: body.x - 1, y: body.y + 1 } : part === "armR" ? { x: body.x + 3, y: body.y + 1 } : { x: body.x + 1, y: body.y - 1 };
  }

  private spawnColossusPart(body: Actor, part: "armL" | "armR" | "head"): void {
    const at = this.colossusPartAt(body, part);
    const def = part === "head" ? MONSTERS.craneColosse : MONSTERS.brasColosse;
    const m = this.newMonster(def, at.x, at.y, false);
    m.alerted = true;
    m.goal = undefined;
    m.part = part;
    this.monsters.push(m);
  }

  /** Les morceaux encore debout du Colosse. */
  colossusParts(body: Actor): { armL: boolean; armR: boolean; head: boolean } {
    const has = (part: string) => this.monsters.some((o) => o.part === part && (o.defId === "brasColosse" || o.defId === "craneColosse"));
    return { armL: has("armL"), armR: has("armR"), head: has("head") };
  }

  /** Le cœur est à nu quand les deux bras, ou le crâne, sont cassés : sinon on ne l'atteint qu'avec un coup parfait. */
  private guardColossus(body: Actor): void {
    const p = this.colossusParts(body);
    const open = (!p.armL && !p.armR) || !p.head;
    body.armorClass = open ? MONSTERS.colosse.armorClass : 40;
  }

  private colossusAct(body: Actor): void {
    const p = this.colossusParts(body);
    const reg = (body.regrow ??= {});
    const lit = cellsOf(body).some((c) => this.moonlit(c));
    for (const part of ["armL", "armR", "head"] as const) {
      if (p[part]) {
        reg[part] = undefined;
        continue;
      }
      if (!lit) continue;
      reg[part] = (reg[part] ?? 0) + 1;
      if (reg[part]! >= RULES.colossusRegrowTurns) {
        const at = this.colossusPartAt(body, part);
        if (this.monsterAt(at.x, at.y) || (at.x === this.hero.x && at.y === this.hero.y) || !this.map.isWalkable(at.x, at.y)) continue;
        reg[part] = undefined;
        this.spawnColossusPart(body, part);
        this.events.push({ type: "priestess", what: "regrow", x: at.x, y: at.y });
      }
    }
    this.guardColossus(body);
  }

  /** Un morceau du Colosse cassé, ou le Colosse tombé (la Prêtresse redescend, épuisée). */
  private colossusLoss(m: Actor): void {
    const body = this.monsters.find((o) => o.defId === "colosse");
    if (m.defId === "colosse") {
      for (const o of [...this.monsters]) if (o.defId === "brasColosse" || o.defId === "craneColosse") this.monsters.splice(this.monsters.indexOf(o), 1);
      const pr = this.bossActor();
      if (pr?.defId === "pretresse") {
        pr.aloft = false;
        pr.stunned = 3;
        pr.armorClass = MONSTERS.pretresse.armorClass - 2;
        const well = this.bossWell();
        const spot = well ? this.nearFree(well) : null;
        if (spot) {
          pr.x = spot.x;
          pr.y = spot.y;
        }
      }
      this.events.push({ type: "priestess", what: "colossusDown", x: m.x + 1, y: m.y + 1 });
      return;
    }
    if (body) {
      this.guardColossus(body);
      this.events.push({ type: "priestess", what: "partDown", x: m.x, y: m.y });
    }
  }

  /** Une case libre près d'un point (pour poser la Prêtresse qui redescend). */
  private nearFree(p: Point): Point | null {
    for (let r = 0; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const q = { x: p.x + dx, y: p.y + dy };
          if (this.map.get(q.x, q.y) === Tile.Floor && !this.monsterAt(q.x, q.y) && !(q.x === this.hero.x && q.y === this.hero.y)) return q;
        }
      }
    }
    return null;
  }

  /** Pour les essais : le héros (ou un point) est-il dans la grotte du boss ? */
  inLairPublic(p: Point): boolean {
    const b = this.current.boss;
    return !!b && this.inLair(b.lair, p);
  }

  private inLair(r: Room, p: Point): boolean {
    return p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;
  }

  /** Le battant du Carillon (et tout monstre inerte) : il ne bouge ni n'agit. */
  isInert(m: Actor): boolean {
    return !!(MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef | undefined)?.inert;
  }

  /**
   * Le tour du CARILLON (Thomas, 2026-11-16) : il ne bouge pas. Dès que le héros entre dans sa grotte, il compte ;
   * le tour d'avant, il se balance fort (l'avertissement) ; puis il SONNE : l'onde jette à terre (1 tour) et blesse
   * (1d6, le double au contact) qui n'est pas à l'abri, réveille les envahis. Un coup reçu pendant l'avertissement le
   * fait SONNER FAUX : pas d'onde, il est sonné 2 tours et se fêle. Battant cassé : il ne sonne plus.
   */
  private carillonAct(m: Actor): void {
    this.carillonTurn(m);
    // Le BATTANT ne s'atteint que pendant l'avertissement (Thomas, 2026-11-17, « go ») : le reste du temps il est
    // à l'abri sous le chapeau (seul un 20 naturel passe) ; il faut venir sous la cloche quand elle se balance.
    const clap = this.monsters.find((o) => o.defId === "battant");
    if (clap) clap.armorClass = m.boss!.ring === 1 && m.boss!.clapperUp ? MONSTERS.battant.armorClass : RULES.carillonClapperGuard;
  }

  private carillonTurn(m: Actor): void {
    const st = m.boss!;
    const layout = this.current.boss!;
    if (!st.engaged) {
      if (!this.inLair(layout.lair, this.hero)) return;
      st.engaged = true;
      st.ring = RULES.carillonEvery;
      this.events.push({ type: "carillon", what: "wake", actor: m });
    }
    // Aux deux tiers puis au tiers de sa vie (Thomas, 2026-11-19 ; une seule fois à mi-vie avant), deux fidèles sortent
    // du mycélium.
    const wave = !st.sprouted && m.hp * 3 <= m.maxHp * 2 ? 1 : st.sprouted && !st.sprouted2 && m.hp * 3 <= m.maxHp ? 2 : 0;
    if (wave > 0) {
      if (wave === 1) st.sprouted = true;
      else st.sprouted2 = true;
      for (const p of layout.sprouts ?? []) {
        if (this.actorAt(p.x, p.y) || !this.map.isWalkable(p.x, p.y)) continue;
        const e = this.newMonster(MONSTERS.fidele, p.x, p.y, false);
        e.alerted = true;
        e.prone = 1;
        this.monsters.push(e);
        this.events.push({ type: "carillon", what: "sprout", actor: e });
      }
    }
    // Pluie d'encre (Thomas, 2026-11-16 : « il est statique et ne fait aucun dommage ») : les gouttes marquées au tour
    // d'avant tombent, même quand il est sonné.
    this.carillonInkFall(m);
    if (this.over) return;
    // Le GLAS : sous 10 % de sa vie, une fois, trois ondes rapprochées.
    if (!st.knelled && st.clapperUp && m.hp <= m.maxHp * RULES.carillonKnellAt) {
      st.knelled = true;
      st.knell = RULES.carillonKnellRings;
      st.ring = 2;
      this.events.push({ type: "carillon", what: "knell", actor: m });
    }
    if ((st.fallen ?? 0) > 0) {
      st.fallen--;
      return;
    }
    // Sonné (potion de discorde, coup de bouclier) : il perd son tour, le décompte ne bouge pas.
    if (m.stunned) {
      m.stunned--;
      return;
    }
    // CRACHAT D'ENCRE (Thomas, 2026-11-18 : remplace le coup de chapeau, « transformer l'attaque au contact en attaque à
    // distance ») : un tour sur deux, s'il voit le héros, à toute distance ; une souche entre eux l'arrête, comme l'onde.
    // Touché : « Taché », le prochain tir du héros a le désavantage (pas en mode « onde seule »).
    st.spitTick = (st.spitTick ?? 0) + 1;
    if (this.carillonMode !== "onde" && st.spitTick % RULES.carillonSpitEvery === 0 && this.inLair(layout.lair, this.hero)) {
      const mouth = { x: m.x + 1, y: m.y + 1 };
      if (this.waveReaches(mouth, this.hero) && !this.fogBetween(mouth, this.hero)) {
        const result = rollAttack(this.rng, { attackBonus: RULES.carillonSpitBonus, damage: RULES.carillonSpitDamage }, this.hero);
        result.damage = this.absorb(result.damage);
        this.events.push({ type: "attack", attacker: m, target: this.hero, result, ranged: true, ink: true });
        if (result.hit) {
          this.inkBlind = 1;
          this.stain(this.hero.x, this.hero.y, "black");
        }
        this.hurtHero(result.damage, "le crachat du Carillon");
        if (this.over) return;
      }
    }
    // L'ENCRE EN ZONES (Thomas, 2026-11-17) : en mode « douce », après la première onde, une zone tous les 3 tours ;
    // « dure » : dès l'arrivée, tous les 2 tours. Les motifs se suivent dans l'ordre (croix, bandes, anneau, quart) :
    // on apprend à les lire. Annoncée un tour avant.
    const mode = this.carillonMode;
    st.inkTick = (st.inkTick ?? 0) + 1;
    const every = mode === "dure" ? RULES.carillonInkEveryHard : RULES.carillonInkEvery;
    const inkNow = mode === "dure" || (mode === "douce" && st.inked);
    // Sans battant (Thomas, 2026-11-17 : « c'est idiot qu'il ne puisse plus attaquer ») : il ne sonne plus, mais son
    // chapeau fond (c'est un coprin) : une COULÉE d'encre tout autour de lui, annoncée, tous les 4 tours ; et l'encre
    // en zones continue (elle commence aussi, s'il n'avait pas encore sonné).
    if (!st.clapperUp) {
      st.inked = true;
      st.drip = (st.drip ?? RULES.carillonDripEvery) - 1;
      if (st.drip <= 0) {
        st.drip = RULES.carillonDripEvery;
        this.carillonInkMark(m, this.carillonDripCells(m), "drip");
      } else if (mode !== "onde" && st.inkTick % every === 0) this.carillonInkMark(m, this.carillonInkZone(m), "zone");
      return;
    }
    st.ring = (st.ring ?? RULES.carillonEvery) - 1;
    // Les monstres de la grotte s'écartent DEUX tours avant l'onde : le héros a le temps de rejoindre une souche.
    if (st.ring === RULES.carillonCowerLead) this.carillonCower(m);
    if (st.ring === 1) {
      this.events.push({ type: "carillon", what: "warn", actor: m });
      return;
    }
    // Pas d'encre pendant l'avertissement ni au coup : un danger à la fois.
    if (inkNow && st.ring > 1 && st.inkTick % every === 0) this.carillonInkMark(m, this.carillonInkZone(m), "zone");
    if (st.ring > 0) return;
    st.inked = true;
    // Le décompte suivant : tous les 6 tours sous le tiers de sa vie ; pendant le glas, tous les 2 tours.
    st.ring = m.hp * 3 <= m.maxHp ? RULES.carillonEveryLate : RULES.carillonEvery;
    if ((st.knell ?? 0) > 0) {
      st.knell!--;
      st.ring = st.knell! > 0 ? 2 : RULES.carillonEvery;
    }
    if (st.falseNote) {
      st.falseNote = false;
      st.fallen = RULES.carillonFalseTurns;
      if (!st.cracked) {
        st.cracked = true;
        m.armorClass -= 2;
      }
      this.events.push({ type: "carillon", what: "false", actor: m });
      return;
    }
    // L'onde : elle part du battant (sous le chapeau). (L'écho est RETIRÉ : Thomas, 2026-11-17.)
    const from = layout.clapper ?? { x: m.x + 1, y: m.y + 2 };
    this.carillonWave(m, from, false);
    // Après le dernier coup du glas, il s'affaisse.
    if (st.knelled && st.knell === 0) {
      st.knell = undefined;
      st.fallen = RULES.carillonKnellFallen;
      if (!st.cracked) {
        st.cracked = true;
        m.armorClass -= 2;
      }
      this.events.push({ type: "carillon", what: "slump", actor: m });
    }
  }

  /** Une onde (ou son écho) : jette à terre et blesse qui n'est pas à l'abri ; la souche qui arrête l'onde pour le
   *  héros se fêle, et tombe au deuxième coup. */
  private carillonWave(m: Actor, from: Point, echo = false): void {
    const layout = this.current.boss!;
    const hit: Actor[] = [];
    if (this.inLair(layout.lair, this.hero)) {
      if (this.waveReaches(from, this.hero)) {
        const close = !echo && gapBetween(m, this.hero) <= 1;
        // Grandi par une potion de géant : l'onde frappe deux fois plus fort. L'écho : la moitié.
        let dmg = rollDice(this.rng, RULES.carillonWaveDamage) * (close ? 2 : 1) * ((m.grown ?? 0) > 0 ? 2 : 1);
        if (echo) dmg = Math.max(1, Math.floor(dmg / 2));
        this.hero.prone = Math.max(this.hero.prone ?? 0, 1);
        this.hurtHero(dmg, "l'onde du Carillon");
        hit.push(this.hero);
      } else this.wearStump(from, this.hero);
    }
    for (const o of this.monsters) {
      if (o === m || o.boss || this.isInert(o)) continue;
      if (!echo && o.asleep) {
        o.asleep = false;
        o.alerted = true;
      }
      if (this.waveReaches(from, o)) {
        // Couché AU MOINS UN TOUR (Thomas, 2026-11-17) : même s'il joue après le Carillon dans ce tour.
        o.prone = Math.max(o.prone ?? 0, 1);
        o.proneSince = this.turn;
        hit.push(o);
      }
    }
    this.events.push({ type: "carillon", what: "ring", actor: m, hit });
  }

  /** La souche qui a arrêté l'onde pour le héros se fêle ; au deuxième coup, elle s'effondre (la place se libère). */
  private wearStump(from: Point, to: Point): void {
    for (const c of lineBetween(from, to)) {
      if (c.x === to.x && c.y === to.y) return;
      const f = this.current.furniture.find((o) => o.kind === "souche" && o.x === c.x && o.y === c.y);
      if (!f) {
        if (this.map.get(c.x, c.y) === Tile.Wall) return;
        continue;
      }
      f.count = (f.count ?? 0) + 1;
      if (f.count >= RULES.carillonStumpHits) {
        this.current.furniture = this.current.furniture.filter((o) => o !== f);
        this.map.set(f.x, f.y, Tile.Floor);
        this.stain(f.x, f.y, "soot");
        this.events.push({ type: "carillon", what: "stumpBreak", actor: this.bossActor()!, cells: [{ x: f.x, y: f.y }] });
      } else {
        this.map.touch(f.x, f.y);
        this.events.push({ type: "carillon", what: "stumpCrack", actor: this.bossActor()!, cells: [{ x: f.x, y: f.y }] });
      }
      return;
    }
  }

  /** Pluie d'encre : les cases marquées au tour d'avant reçoivent leur goutte (1d6 à qui s'y tient, monstres compris). */
  private carillonInkFall(m: Actor): void {
    const st = m.boss!;
    const cells = st.ink ?? [];
    if (cells.length === 0) return;
    // Deux tours pour se mettre à l'abri (Thomas, 2026-11-17 : « on n'a pas forcément le temps »).
    if ((st.inkWait ?? 1) > 1) {
      st.inkWait = (st.inkWait ?? 1) - 1;
      return;
    }
    st.ink = [];
    const hit: Actor[] = [];
    for (const c of cells) {
      this.stain(c.x, c.y, "black");
      if (this.hero.x === c.x && this.hero.y === c.y && !this.over) {
        this.hurtHero(rollDice(this.rng, RULES.carillonInkDamage), "l'encre du Carillon");
        hit.push(this.hero);
      }
      const o = this.monsterAt(c.x, c.y);
      if (o && !o.boss && !this.isInert(o)) {
        o.hp -= rollDice(this.rng, RULES.carillonInkDamage);
        hit.push(o);
        this.removeIfDead(o);
      }
    }
    this.events.push({ type: "carillon", what: "ink", actor: m, hit, cells });
  }

  /** L'encre annoncée : ces cases recevront une goutte au tour suivant (une ombre au sol). Les monstres qui s'y
   *  tiennent s'en écartent aussitôt (Thomas, 2026-11-17 : « les mobs s'éloignent avant l'attaque »). */
  private carillonInkMark(m: Actor, cells: Point[], kind: "zone" | "drip"): void {
    if (cells.length === 0 || (m.boss!.ink ?? []).length > 0) return;
    m.boss!.ink = cells;
    m.boss!.inkWait = RULES.carillonInkWarn;
    this.events.push({ type: "carillon", what: "inkMark", actor: m, cells, kind });
    const marked = (x: number, y: number) => cells.some((c) => c.x === x && c.y === y);
    for (const o of this.monsters) {
      // Les fidèles en train de réparer le battant tiennent bon sous l'encre.
      if (o === m || o.boss || this.isInert(o) || o.asleep || !marked(o.x, o.y) || (o.defId === "fidele" && !m.boss?.clapperUp)) continue;
      let best: Point | null = null;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = o.x + dx;
        const y = o.y + dy;
        if (!this.map.isWalkable(x, y) || this.actorAt(x, y) || marked(x, y) || !canStep(this.map, o.x, o.y, dx, dy)) continue;
        if (!best || gapBetween({ x, y } as Actor, this.hero) > gapBetween(best as Actor, this.hero)) best = { x, y };
      }
      if (best) {
        o.x = best.x;
        o.y = best.y;
      }
    }
  }

  /** Les cases libres de la grotte (hors du Carillon). */
  private lairCells(m: Actor): Point[] {
    const lair = this.current.boss!.lair;
    const out: Point[] = [];
    for (let y = lair.y; y < lair.y + lair.h; y++)
      for (let x = lair.x; x < lair.x + lair.w; x++) if (this.map.isWalkable(x, y) && !occupies(m, x, y)) out.push({ x, y });
    return out;
  }

  /**
   * Une ZONE d'encre (Thomas, 2026-11-17 : « de la cohérence, des zones plutôt que des cercles aléatoires »). Quatre
   * motifs, toujours dans le même ordre, chacun avec sa porte de sortie :
   * CROIX : la ligne et la colonne du héros, sur 3 cases de chaque côté (un pas en diagonale suffit) ;
   * BANDES : une rangée sur trois de toute la grotte, celle du héros comprise (un pas en haut ou en bas) ;
   * ANNEAU : les cases à 2 ou 3 cases du Carillon (venir à son contact, ou s'éloigner) ;
   * QUART : le quart de la grotte où se tient le héros, à 3 cases de lui au plus (changer de côté).
   */
  private carillonInkZone(m: Actor): Point[] {
    const st = m.boss!;
    const hero = this.hero;
    if (!this.inLair(this.current.boss!.lair, hero)) return [];
    const pattern = (st.inkPattern ?? 0) % 4;
    st.inkPattern = pattern + 1;
    const cx = m.x + 1;
    const cy = m.y + 1;
    const near = (p: Point, r: number) => Math.max(Math.abs(p.x - hero.x), Math.abs(p.y - hero.y)) <= r;
    // Phases : sous les deux tiers de sa vie, les zones s'élargissent.
    const reach = m.hp * 3 <= m.maxHp * 2 ? RULES.carillonZoneReach[1] : RULES.carillonZoneReach[0];
    return this.lairCells(m).filter((p) => {
      if (pattern === 0) return (p.x === hero.x || p.y === hero.y) && near(p, reach);
      if (pattern === 1) return (((p.y - hero.y) % 3) + 3) % 3 === 0;
      if (pattern === 2) {
        const gap = gapBetween(m, p as Actor);
        return gap >= 2 && gap <= 3;
      }
      return Math.sign(p.x - cx) === Math.sign(hero.x - cx) && Math.sign(p.y - cy) === Math.sign(hero.y - cy) && near(p, reach);
    });
  }

  /** Sans battant : la coulée au pied du chapeau, sur 2 cases tout autour de lui. */
  private carillonDripCells(m: Actor): Point[] {
    return this.lairCells(m).filter((p) => gapBetween(m, p as Actor) <= RULES.carillonDripReach);
  }

  /** Une goutte d'encre est-elle annoncée sur cette case ? (S'en écarter ne donne pas d'attaque d'opportunité.) */
  inkMarkedAt(x: number, y: number): boolean {
    const b = this.bossActor();
    return !!b?.boss?.ink?.some((c) => c.x === x && c.y === y);
  }

  /** Avant l'onde (Thomas, 2026-11-16 : « fais reculer les mobs avant l'attaque ») : les monstres de la grotte lâchent
   *  le héros et courent s'abriter (2 pas au plus vers une case que l'onde n'atteint pas) ; ils ne font rien d'autre
   *  pendant l'avertissement et le coup. */
  private carillonCower(m: Actor): void {
    const layout = this.current.boss!;
    const from = layout.clapper ?? { x: m.x + 1, y: m.y + 2 };
    for (const o of this.monsters) {
      if (o === m || o.boss || this.isInert(o) || o.asleep || !this.inLair(layout.lair, o)) continue;
      let best: Point[] | null = null;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const c = { x: o.x + dx, y: o.y + dy };
          if (!this.map.isWalkable(c.x, c.y) || !this.inLair(layout.lair, c) || this.waveReaches(from, c)) continue;
          if ((dx || dy) && this.actorAt(c.x, c.y)) continue;
          const path = dx || dy ? findPath(this.map, o, c, (x, y) => !this.actorAt(x, y) || (x === c.x && y === c.y)) : [];
          if (!path || path.length > 3) continue;
          const score = path.length + (gapBetween(this.hero, c) <= 1 ? 2 : 0);
          const bestScore = best ? best.length + (gapBetween(this.hero, best[best.length - 1] ?? o) <= 1 ? 2 : 0) : Infinity;
          if (score < bestScore) best = path;
        }
      }
      if (best === null) continue;
      for (const step of best.slice(0, 2)) {
        if (this.actorAt(step.x, step.y)) break;
        o.x = step.x;
        o.y = step.y;
      }
      o.cower = RULES.carillonCowerLead + 1;
      this.events.push({ type: "carillon", what: "cower", actor: o });
    }
  }

  /**
   * FIDÈLES DU CARILLON (Thomas, 2026-11-17) : quand le battant est cassé, chaque fidèle marche jusqu'à lui ; trois tours
   * côte à côte (cumulés entre fidèles) et le battant est remis : le Carillon sonne de nouveau. Rend vrai s'il s'en
   * occupe ce tour-ci.
   */
  private fideleRepair(m: Actor): boolean {
    const bell = this.bossActor();
    const layout = this.current.boss;
    if (!bell?.boss || bell.boss.clapperUp || !layout?.clapper || bell.hp <= 0) return false;
    const c = layout.clapper;
    if (Math.max(Math.abs(m.x - c.x), Math.abs(m.y - c.y)) > 1) {
      const path = findPath(this.map, m, c, (x, y) => (x === c.x && y === c.y) || (x === m.x && y === m.y) || !this.actorAt(x, y));
      const step = path?.[0];
      if (!step || (step.x === c.x && step.y === c.y) || this.actorAt(step.x, step.y)) return false;
      m.x = step.x;
      m.y = step.y;
      return true;
    }
    bell.boss.repair = (bell.boss.repair ?? 0) + 1;
    this.events.push({ type: "carillon", what: "repair", actor: m });
    if (bell.boss.repair < RULES.carillonRepairTurns || this.actorAt(c.x, c.y)) return true;
    bell.boss.repair = 0;
    bell.boss.clapperUp = true;
    bell.boss.ring = RULES.carillonEvery;
    const clap = this.newMonster(MONSTERS.battant, c.x, c.y, false);
    this.monsters.push(clap);
    this.events.push({ type: "carillon", what: "repaired", actor: m });
    return true;
  }

  /** Un coup du héros a porté sur le Carillon : pendant son avertissement, il sonnera faux. */
  private noteBossHit(m: Actor, damage: number): void {
    if (m.defId !== "carillon" || damage <= 0 || !m.boss) return;
    if (m.boss.ring === 1 && m.boss.clapperUp) m.boss.falseNote = true;
  }

  /** L'étage de la Grande Prêtresse : le 15 (boss de la section 3). */
  isPriestessDepth(depth: number): boolean {
    return !this.sandbox && depth === RULES.bossDepths[2];
  }

  /** L'étage du Carillon : le 10 (boss de la section 2) ; en salle d'essai section 2, l'escalier du terrier y mène. */
  isCarillonDepth(depth: number): boolean {
    return this.sandbox ? depth === 2 && this.sandboxSection === 2 : depth === RULES.bossDepths[1];
  }

  /** Le dernier étage jouable : la fin de la démo (10), ou l'aperçu de l'Ossuaire en partie d'essai (15). */
  lastDepth(): number {
    return this.testRun ? RULES.previewLastDepth : RULES.demoLastDepth;
  }

  /** Ossuaire : le décor peint dans une case de mur (alcôve d'ossuaire ou plaque funéraire), d'après le mobilier. */
  ossWallDecor(x: number, y: number): { kind: "alcove"; side: string; x0: number; y0: number; len: number } | { kind: "tablet"; side: string; variant: string } | null {
    const list = this.current?.furniture;
    if (!list) return null;
    if (this.ossDecorList !== list || this.ossDecorCount !== list.length) {
      this.ossDecorList = list;
      this.ossDecorCount = list.length;
      this.ossDecorIndex = new Map();
      for (const f of list) {
        if (f.kind === "ossTablet") this.ossDecorIndex.set(`${f.x},${f.y}`, { kind: "tablet", side: f.side ?? "S", variant: f.variant ?? "texte" });
        if (f.kind === "ossAlcove") {
          const horiz = f.side === "S" || f.side === "N";
          for (let k = 0; k < (f.len ?? 1); k++) this.ossDecorIndex.set(`${f.x + (horiz ? k : 0)},${f.y + (horiz ? 0 : k)}`, { kind: "alcove", side: f.side ?? "S", x0: f.x, y0: f.y, len: f.len ?? 1 });
        }
      }
    }
    return this.ossDecorIndex.get(`${x},${y}`) ?? null;
  }
  private ossDecorList: Furniture[] | null = null;
  private ossDecorCount = 0;
  private ossDecorIndex = new Map<string, { kind: "alcove"; side: string; x0: number; y0: number; len: number } | { kind: "tablet"; side: string; variant: string }>();

  /** Ossuaire : les pierres tombales dont le dessin peut toucher la case (elles débordent sur les voisines). */
  ossTombsNear(x: number, y: number): { cx: number; cy: number; angle: number; variant: string }[] {
    if (this.look() !== "ossuaire") return [];
    const out: { cx: number; cy: number; angle: number; variant: string }[] = [];
    for (const f of this.current.furniture) {
      if (f.kind !== "ossTomb" || Math.abs(f.x - x) > 2 || Math.abs(f.y - y) > 2) continue;
      out.push({ cx: f.x * 16 + 8, cy: f.y * 16 + 8, angle: f.angle ?? 0, variant: f.variant ?? "ins" });
    }
    return out;
  }

  /** Ossuaire : une porte dans le mur du BAS d'une salle (la salle est au-dessus) : la grille est vue de l'autre côté. */
  doorBelowRoom(x: number, y: number): boolean {
    const inRoom = (p: Point) => this.rooms.some((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
    return inRoom({ x, y: y - 1 }) && !inRoom({ x, y: y + 1 });
  }

  isBossDepth(depth: number): boolean {
    return this.sandbox ? depth === 2 : (RULES.bossDepths as readonly number[]).includes(depth);
  }

  /** Le plan de la nichée (étage du boss), pour le dessin des amarres. */
  bossLayout(): BossLayout | undefined {
    return this.current.boss;
  }

  /** Le boss de l'étage, s'il vit encore. */
  bossActor(): Actor | undefined {
    return this.monsters.find((m) => !!m.boss);
  }

  // ---------- La Tisseuse (boss de la section 1, planche art/boss_v2.png) ----------

  /** Combats de boss gagnés dans cette partie (pour les records). */
  bossKills = 0;
  /** Cocon, sac d'œufs ou amarre à crever : le héros s'en approche, puis frappe. */
  private breakTarget: Point | null = null;

  /** Une case de toile qui colle (nappe ou grande toile de la nichée) ? */
  stickyAt(x: number, y: number): boolean {
    return this.current.furniture.some((f) => f.x === x && f.y === y && (f.kind.startsWith("webN") || f.kind.startsWith("webHub")));
  }

  /** Cocon, sac d'œufs ou amarre (sur sa colonne) sur cette case : ça se crève d'un coup. */
  breakableAt(x: number, y: number): Furniture | null {
    return this.current.furniture.find((f) => f.x === x && f.y === y && (f.kind.startsWith("cocoon") || f.kind === "eggSac" || f.kind === "anchor")) ?? null;
  }

  /** La table de cuisine où attend une cuisse de poulet (sur une de ses deux cases). */
  plateTableAt(x: number, y: number): Furniture | null {
    return this.current.furniture.find((f) => f.kind === "table" && (f.plate ?? 0) > 0 && f.y === y && (f.x === x || f.x + 1 === x)) ?? null;
  }

  /** La cloche d'alarme sur cette case, s'il y en a une. */
  /** L'escalier scellé de la nichée, une fois la Tisseuse morte : le toucher termine la démo (Thomas, 2026-11-14). */
  sealedStairsAt(x: number, y: number): boolean {
    // Parties d'essai (Thomas, 2026-11-16 : « dans la zone d'essai, je ne devrais pas avoir d'étage scellé ») : ouvert.
    const open = !this.bossActor() || this.testRun || this.sandbox;
    return !!this.current?.boss && open && this.current.furniture.some((f) => f.kind === "sealedStairs" && f.x === x && f.y === y);
  }

  /** L'escalier scellé tant que la Tisseuse vit (Thomas, 2026-11-15 : « s'assurer qu'elle est vaincue avant de
   *  descendre ») : le toucher dit pourquoi on ne passe pas. */
  sealedBlockedAt(x: number, y: number): boolean {
    return !!this.current?.boss && !!this.bossActor() && !this.testRun && !this.sandbox && this.current.furniture.some((f) => f.kind === "sealedStairs" && f.x === x && f.y === y);
  }

  bellAt(x: number, y: number): Furniture | null {
    return this.current.furniture.find((f) => f.x === x && f.y === y && f.kind === "bell") ?? null;
  }

  /**
   * Le héros sonne la cloche (Thomas, 2026-11-12) : DONG ! L'alerte de l'étage monte d'un palier, les monstres proches
   * accourent, et le journal se moque de lui. On peut recommencer (le moqueur aussi).
   */
  private ringBell(f: Furniture): void {
    f.count = (f.count ?? 0) + 1;
    this.reveal();
    this.raiseAlarm(RULES.bellAlarm, f);
    for (const m of this.monsters) {
      const d = Math.max(Math.abs(m.x - f.x), Math.abs(m.y - f.y));
      if (!m.alerted && d <= RULES.noiseRadius) {
        m.alerted = true;
        m.asleep = false;
      }
    }
    this.events.push({ type: "bell", x: f.x, y: f.y, rings: f.count, joke: this.rng.int(0, 99) });
  }

  private approachBreakable(x: number, y: number, ignoreFog: boolean): boolean {
    const known = ignoreFog ? undefined : (cx: number, cy: number) => this.isKnown(cx, cy);
    let best: Point[] | null = null;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx === this.hero.x && ny === this.hero.y) best = [];
        if (best && best.length === 0) break;
        if (!this.map.isWalkable(nx, ny) || this.monsterAt(nx, ny)) continue;
        const path = this.heroPath({ x: nx, y: ny }, known);
        if (path && (!best || path.length < best.length)) best = path;
      }
    }
    if (!best) return false;
    this.clearDoorOrders();
    this.targetId = null;
    this.waiting = false;
    this.picking = false;
    this.resting = 0;
    this.searching = 0;
    this.hideOrder = false;
    this.jumpTarget = null;
    this.pushTargetId = null;
    this.disarmAt = null;
    this.useOrder = null;
    this.throwOrder = null;
    this.skillOrder = null;
    this.shotTarget = null;
    this.path = best;
    this.breakTarget = { x, y };
    return true;
  }

  /** Un coup d'épée : le cocon ou le sac d'œufs crève, l'amarre est tranchée. La toile vibre : la Tisseuse le sent. */
  private resolveBreak(at: Point): void {
    const hen = this.current.goldHen;
    if (hen && Math.max(Math.abs(hen.x - this.hero.x), Math.abs(hen.y - this.hero.y)) <= 1 && hen.x === at.x && hen.y === at.y) {
      this.current.goldHen = undefined;
      if (this.inventory.add("poule_or", 1) === 0) this.events.push({ type: "pickup", item: "poule_or", count: 1 });
      else this.bounceFromHero("poule_or", 1);
      this.events.push({ type: "zone", what: "hen", x: at.x, y: at.y });
      return;
    }
    const bathTarget = this.bathTargetAt(at.x, at.y);
    if (bathTarget === "tub") {
      // Caché, on peut lui voler son canard sans le réveiller (d20 + discrétion contre 10) ; sinon, on l'attaque.
      const b = this.current.bath!;
      if (this.hidden && !b.out && !b.duckTaken) {
        const d20 = this.rng.int(1, 20);
        const bonus = this.stealthBonus();
        const success = d20 !== 1 && (d20 === 20 || d20 + bonus >= RULES.duckStealDc);
        this.events.push({ type: "theft", what: "duck", d20, bonus, total: d20 + bonus, success });
        if (success) {
          b.duckTaken = true;
          this.map.touch(b.x, b.y);
          const at = this.landingCell(this.hero, "canard");
          this.dropItem(at.x, at.y, "canard", 1);
          return;
        }
      }
      this.wakeBath(true);
      return;
    }
    if (bathTarget === "gramophone") {
      // On arrête le disque : sans musique, il se réveille, de mauvaise humeur.
      this.current.bath!.music = false;
      this.events.push({ type: "bath", what: "scratch", x: at.x, y: at.y });
      this.wakeBath(false);
      return;
    }
    // L'assiette sur la table : on prend la cuisse (au sac, ou à ses pieds si le sac est plein).
    const plateTable = this.plateTableAt(at.x, at.y);
    if (plateTable) {
      plateTable.plate = 0;
      this.map.touch(plateTable.x, plateTable.y);
      this.map.touch(plateTable.x + 1, plateTable.y);
      if (this.inventory.add("cuisse_poulet", 1) === 0) this.events.push({ type: "pickup", item: "cuisse_poulet", count: 1 });
      else this.bounceFromHero("cuisse_poulet", 1);
      return;
    }
    const bell = this.bellAt(at.x, at.y);
    if (bell) {
      this.ringBell(bell);
      return;
    }
    if (this.sealedBlockedAt(at.x, at.y)) {
      this.events.push({ type: "sealed" });
      return;
    }
    // Étage ouvert après le boss (Thomas, 2026-11-16 : « ouvre l'étage post Fileuse ») : l'escalier mène à l'étage
    // suivant, dans toutes les parties ; seul celui du dernier boss de la démo (le Carillon) termine la partie.
    if (this.sealedStairsAt(at.x, at.y) && this.depth < this.lastDepth()) {
      this.pendingStairs = "down";
      return;
    }
    if (this.sealedStairsAt(at.x, at.y)) {
      this.over = true;
      this.won = true;
      this.events.push({ type: "demoEnd" });
      return;
    }
    if (this.zoneDoorAt(at.x, at.y)) {
      if (this.current.zone!.door === "tapestry") this.openZoneDoor();
      else this.pushZoneDoor();
      return;
    }
    if (this.ciergeAt(at.x, at.y)) {
      this.lightCierge(at);
      return;
    }
    const violet = this.current.furniture.find((f) => f.kind === "ciergeViolet" && f.x === at.x && f.y === at.y);
    if (violet) {
      this.snuffCandle(violet);
      return;
    }
    const grille = this.grilleAt(at.x, at.y);
    if (grille) {
      this.forceGrille(grille);
      return;
    }
    if (this.scarecrowAt(at.x, at.y)) {
      this.hatScarecrow();
      return;
    }
    if (this.candleAt(at.x, at.y)) {
      this.blowCandle();
      return;
    }
    const snowman = this.snowmanAt(at.x, at.y);
    if (snowman) {
      this.pickCarrot(snowman);
      return;
    }
    const alembic = this.alembicAt(at.x, at.y);
    if (alembic) {
      this.drawAlembic(alembic);
      return;
    }
    const bones = this.skeletonAt(at.x, at.y);
    if (bones) {
      this.lootSkeleton(bones);
      return;
    }
    const dome = this.appleDomeAt(at.x, at.y);
    if (dome) {
      this.stealApple(dome);
      return;
    }
    const statue = this.statueAt(at.x, at.y);
    if (statue?.hinted) {
      this.smashStatue(statue);
      return;
    }
    const f = this.breakableAt(at.x, at.y);
    if (!f) return;
    this.reveal();
    this.current.furniture = this.current.furniture.filter((o) => o !== f);
    if (f.kind !== "anchor") this.map.set(f.x, f.y, Tile.Floor);
    else this.map.touch(f.x, f.y);
    const left = this.current.furniture.filter((o) => o.kind === "anchor").length;
    this.events.push({ type: "breakWeb", kind: f.kind.startsWith("cocoon") ? "cocoon" : f.kind === "eggSac" ? "eggs" : "anchor", left, x: f.x, y: f.y });
    // Dans un cocon, il reste parfois quelques pièces de la victime.
    if (f.kind.startsWith("cocoon") && this.rng.chance(0.5)) this.dropItem(f.x, f.y, "or", lessGold(this.rng.int(2, 6)));
    // Du sang (Thomas : « pense au sang ») : rouge pour la proie du cocon, vert pour les œufs.
    if (f.kind !== "anchor") this.stain(f.x, f.y, f.kind === "eggSac" ? "black" : "red");
    // Les œufs écrasés laissent leurs coquilles et une flaque au sol (Thomas).
    if (f.kind === "eggSac") this.current.furniture.push({ x: f.x, y: f.y, kind: "eggSmash" });
    const queen = this.bossActor();
    if (queen?.boss) queen.boss.target = { x: this.hero.x, y: this.hero.y };
    if (f.kind === "anchor") this.checkHub();
  }

  /** Leurre : une flèche plantée dans une toile la fait vibrer ; la Tisseuse y accourt (si elle ne sent pas le héros). */
  private lureBoss(p: Point): void {
    const queen = this.bossActor();
    if (!queen?.boss || !this.stickyAt(p.x, p.y)) return;
    queen.boss.lure = { x: p.x, y: p.y, turns: RULES.bossLureTurns };
    if (queen.boss.phase === "lurk") this.bossAdvance(queen);
    this.events.push({ type: "boss", what: "lured", x: p.x, y: p.y });
  }

  /**
   * La grande toile tient tant qu'il reste une amarre et qu'elle n'a pas brûlé à moitié. Quand elle s'effondre, la
   * Tisseuse, si elle s'y tenait, tombe sur le dos : sonnée plusieurs tours, on la frappe avec avantage. Elle n'a
   * plus de refuge.
   */
  private checkHub(): void {
    const queen = this.bossActor();
    const st = queen?.boss;
    if (!queen || !st || !st.hubUp || !this.current.boss) return;
    // Plus d'amarres (Thomas, 2026-11-14 : « retire les cordes de toiles ! ») : seul le feu fait tomber la grande toile.
    const cells = this.current.furniture.filter((f) => f.kind.startsWith("webHub"));
    if (cells.length > 4) return;
    st.hubUp = false;
    for (const c of cells) this.map.touch(c.x, c.y);
    this.current.furniture = this.current.furniture.filter((f) => !f.kind.startsWith("webHub"));
    const hub = this.current.boss.hub;
    const onHub = cellsOf(queen).some((c) => c.x >= hub.x && c.x < hub.x + 3 && c.y >= hub.y && c.y < hub.y + 3);
    if (onHub) {
      st.fallen = RULES.bossFallTurns;
      st.phase = "lurk";
      st.lurk = 0;
      st.dest = undefined;
    }
    this.events.push({ type: "boss", what: onHub ? "fallen" : "hubDown", x: queen.x, y: queen.y });
  }

  /**
   * La Tisseuse est morte (Thomas, 2026-11-14 : la section 2 existe, la partie continue) : la toile qui scellait
   * l'escalier tombe, et un COFFRE DORÉ apparaît là où elle est morte (argent, artefact, arme, armure).
   */
  private bossDefeated(at: Point): void {
    const layout = this.current.boss;
    this.bossKills++;
    if (!layout) return;
    this.path = [];
    // L'escalier RESTE SCELLÉ pour l'instant (Thomas, 2026-11-14 : « laisse l'étage fermé ») : le toucher termine la
    // démo, une fois le coffre doré pillé.
    // Le coffre doré : sur la case libre la plus proche de l'endroit où elle est tombée.
    // À UNE case de son corps (Thomas, 2026-11-15 : « pour éviter de l'ouvrir automatiquement ») : sur le pourtour de
    // ses 2 × 2 cases, jamais à côté du héros (la plus loin de lui) ; sinon, plus loin.
    const free = (p: Point) =>
      this.map.get(p.x, p.y) === Tile.Floor && !this.furnitureAt(p.x, p.y) && !(p.x === this.hero.x && p.y === this.hero.y) && !this.ground.some((g) => g.x === p.x && g.y === p.y) && !this.isBurning(p.x, p.y);
    // Le battant tombe avec lui.
    for (const m of [...this.monsters]) if (this.isInert(m)) this.monsters.splice(this.monsters.indexOf(m), 1);
    const s = layout.kind === "carillon" ? 3 : 2;
    const ring: Point[] = [];
    for (let y = at.y - 1; y <= at.y + s; y++) for (let x = at.x - 1; x <= at.x + s; x++) if (x < at.x || x > at.x + s - 1 || y < at.y || y > at.y + s - 1) ring.push({ x, y });
    const far = (p: Point) => Math.max(Math.abs(p.x - this.hero.x), Math.abs(p.y - this.hero.y));
    let chest: Point | null = ring.filter((p) => free(p) && far(p) > 1).sort((a, b) => far(b) - far(a))[0] ?? null;
    for (let r = 2; r <= 5 && !chest; r++) {
      for (let dy = -r; dy <= r && !chest; dy++) {
        for (let dx = -r; dx <= r && !chest; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const p = { x: at.x + dx, y: at.y + dy };
          if (this.map.get(p.x, p.y) !== Tile.Floor || this.furnitureAt(p.x, p.y) || (p.x === this.hero.x && p.y === this.hero.y)) continue;
          if (this.ground.some((g) => g.x === p.x && g.y === p.y) || this.isBurning(p.x, p.y)) continue;
          chest = p;
        }
      }
    }
    if (chest) {
      this.map.set(chest.x, chest.y, Tile.Chest);
      this.map.touch(chest.x, chest.y);
      this.current.goldChest = chest;
    }
    // Ses petits (Thomas, 2026-11-14 : « s'éloignent de quelques pas, puis fuient dans un nuage de fumée ») : chacun
    // s'écarte du héros (3 pas au plus) ; l'affichage les fait marcher puis disparaître.
    const fled: { id: number; path: Point[] }[] = [];
    const taken = new Set<string>();
    for (const m of this.monsters) {
      if (m.boss || m.hp <= 0) continue;
      const path: Point[] = [];
      let at: Point = { x: m.x, y: m.y };
      for (let step = 0; step < RULES.bossBroodFleeSteps; step++) {
        let best: Point | null = null;
        let far = Math.max(Math.abs(at.x - this.hero.x), Math.abs(at.y - this.hero.y)) + Math.hypot(at.x - this.hero.x, at.y - this.hero.y) * 0.01;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const n = { x: at.x + dx, y: at.y + dy };
          if (!this.map.isWalkable(n.x, n.y) || this.map.isDoor(n.x, n.y) || taken.has(`${n.x},${n.y}`) || !this.inReach(at, n)) continue;
          if (this.monsters.some((o) => o !== m && cellsOf(o).some((c) => c.x === n.x && c.y === n.y))) continue;
          const d = Math.max(Math.abs(n.x - this.hero.x), Math.abs(n.y - this.hero.y)) + Math.hypot(n.x - this.hero.x, n.y - this.hero.y) * 0.01;
          if (d > far) {
            far = d;
            best = n;
          }
        }
        if (!best) break;
        path.push(best);
        at = best;
      }
      taken.add(`${at.x},${at.y}`);
      fled.push({ id: m.id, path });
    }
    this.events.push({ type: "boss", what: "dead", x: layout.seal.x, y: layout.seal.y, fled, kind: layout.kind });
  }

  /** Cases où la Tisseuse peut poser une patte : pas de mur, de meuble, d'autre personnage ni de flammes. */
  private bossFree(m: Actor): (x: number, y: number) => boolean {
    return (x, y) =>
      this.map.isWalkable(x, y) && !this.isBurning(x, y) && !(x === this.hero.x && y === this.hero.y) && !this.monsters.some((o) => o !== m && occupies(o, x, y));
  }

  private bossMove(m: Actor, step: Point): void {
    this.faceToward(m, step);
    m.x = step.x;
    m.y = step.y;
  }

  private bossAdvance(m: Actor): void {
    const st = m.boss!;
    st.phase = "advance";
    st.bites = 0;
    st.hpMark = m.hp;
    st.dest = undefined;
  }

  /**
   * Elle recule (Thomas : « la faire avancer et reculer ») : vers un cocon pour le manger (+PV) s'il en reste, sinon
   * dans sa grande toile si elle tient, sinon (ou parfois) par une brèche dans l'anneau, pour ressortir ailleurs.
   */
  private bossRetreat(m: Actor): void {
    const st = m.boss!;
    const layout = this.current.boss!;
    const cocoons = this.current.furniture.filter((f) => f.kind.startsWith("cocoon"));
    st.phase = "retreat";
    st.bites = 0;
    let what: "cocoon" | "hub" | "ring" = "ring";
    if (cocoons.length > 0 && this.rng.chance(0.65)) {
      const c = cocoons.reduce((a, b) => (gapBetween(m, b) < gapBetween(m, a) ? b : a));
      st.dest = { x: c.x, y: c.y, eat: { x: c.x, y: c.y } };
      what = "cocoon";
    } else if (st.hubUp && this.rng.chance(0.6)) {
      st.dest = { ...layout.spawn };
      what = "hub";
    } else {
      // Une place dans l'anneau, juste derrière la brèche la plus éloignée du héros.
      const free = this.bossFree(m);
      const lair = layout.lair;
      let best: Point | null = null;
      let bestD = -1;
      for (const b of layout.breaches) {
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const x = b.x + dx;
            const y = b.y + dy;
            const out = x + 1 < lair.x || x >= lair.x + lair.w || y + 1 < lair.y || y >= lair.y + lair.h;
            if (!out || !free(x, y) || !free(x + 1, y) || !free(x, y + 1) || !free(x + 1, y + 1)) continue;
            const d = Math.max(Math.abs(x - this.hero.x), Math.abs(y - this.hero.y));
            if (d > bestD) {
              bestD = d;
              best = { x, y };
            }
          }
        }
      }
      st.dest = best ?? { ...layout.spawn };
    }
    this.events.push({ type: "boss", what: what === "cocoon" ? "retreatCocoon" : what === "hub" ? "retreatHub" : "retreatRing", x: m.x, y: m.y });
  }

  /** Le tour de la Tisseuse. */
  private bossAct(m: Actor): void {
    const st = m.boss!;
    if (this.peaceful) return;
    if (st.fallen > 0) {
      st.fallen--;
      if (st.fallen === 0) {
        this.events.push({ type: "boss", what: "rise", x: m.x, y: m.y });
        this.bossAdvance(m);
      }
      return;
    }
    if (m.stunned) {
      m.stunned--;
      return;
    }
    const hero = this.hero;
    // Dans le brouillard (Thomas, 2026-11-13) : elle ne sent plus que ce qui la touche ; elle attend.
    if ((cellsOf(m).some((c) => this.fogAt(c.x, c.y)) || this.fogBetween(m, hero)) && gapBetween(m, hero) > 1) {
      st.target = undefined;
      return;
    }
    // Ce qu'elle sent : le héros qui marche sur sa toile (les vibrations), ou tout près d'elle. Sinon, un leurre.
    const sensed = this.stickyAt(hero.x, hero.y) || gapBetween(m, hero) <= RULES.bossSenseRange || (st.engaged && this.hidden === false && gapBetween(m, hero) <= RULES.bossChaseRange);
    if (sensed) {
      st.target = { x: hero.x, y: hero.y };
      st.lure = undefined;
      if (!st.engaged) {
        st.engaged = true;
        m.alerted = true;
        m.asleep = false;
        this.events.push({ type: "boss", what: "awake", x: m.x, y: m.y });
        this.bossAdvance(m);
      }
    } else if (st.lure) {
      st.target = { x: st.lure.x, y: st.lure.y };
      if (--st.lure.turns <= 0) st.lure = undefined;
    }
    m.alerted = st.engaged;
    // À mi-vie, les sacs d'œufs qui restent éclosent : une araignée par sac. Elle recule.
    if (!st.hatched && m.hp * 2 <= m.maxHp) {
      st.hatched = true;
      const sacs = this.current.furniture.filter((f) => f.kind === "eggSac");
      for (const sac of sacs) {
        this.current.furniture = this.current.furniture.filter((o) => o !== sac);
        this.map.set(sac.x, sac.y, Tile.Floor);
        this.current.furniture.push({ x: sac.x, y: sac.y, kind: "eggSmash" });
        const young = this.newMonster(MONSTERS.araignee, sac.x, sac.y, false);
        young.alerted = true;
        young.fromX = young.x;
        young.fromY = young.y;
        this.monsters.push(young);
      }
      this.events.push({ type: "boss", what: sacs.length > 0 ? "hatch" : "hatchNone", x: m.x, y: m.y });
      this.bossRetreat(m);
    }
    if (st.phase === "advance" && (st.bites >= RULES.bossBitesBeforeRetreat || st.hpMark - m.hp >= RULES.bossRetreatDamage)) this.bossRetreat(m);
    const free = this.bossFree(m);
    const onWeb = () => cellsOf(m).some((c) => this.stickyAt(c.x, c.y));

    if (st.phase === "lurk") {
      if (st.engaged && gapBetween(m, hero) === 1) this.bossAdvance(m);
      else if (st.lurk > 0) {
        st.lurk--;
        return;
      } else if (st.engaged && st.target) this.bossAdvance(m);
      else return;
    }

    if (st.phase === "advance") {
      if (gapBetween(m, hero) === 1) {
        this.faceToward(m, hero);
        const result = rollAttack(this.rng, m, hero);
        st.bites++;
        this.events.push({ type: "attack", attacker: m, target: hero, result });
        if (result.damage > 0) {
          this.bleed(hero, m);
          const venom = MONSTERS.tisseuse.poisonBite;
          if (this.rng.chance(venom.chance)) this.poisonActor(hero, { damage: venom.damage, turns: venom.turns });
        }
        this.hurtHero(result.damage, this.killerName(m));
        return;
      }
      if (!st.target) return;
      const steps = onWeb() ? RULES.bossWebSteps : RULES.bossGroundSteps;
      for (let i = 0; i < steps && gapBetween(m, hero) !== 1; i++) {
        const step = bigStep(this.map, m, free, null, st.target);
        if (!step) break;
        this.bossMove(m, step);
      }
      if (!sensed && st.target && gapBetween(m, st.target) <= 1 && !st.lure) st.target = undefined;
      return;
    }

    // Elle recule : vite, deux cases par tour.
    const dest = st.dest;
    if (!dest) {
      st.phase = "lurk";
      st.lurk = RULES.bossLurkTurns;
      return;
    }
    let arrived = false;
    for (let i = 0; i < RULES.bossWebSteps; i++) {
      arrived = dest.eat ? gapBetween(m, dest.eat) === 1 : m.x === dest.x && m.y === dest.y;
      if (arrived) break;
      const step = dest.eat ? bigStep(this.map, m, free, null, dest.eat) : bigStep(this.map, m, free, dest, null);
      if (!step) {
        arrived = true;
        break;
      }
      this.bossMove(m, step);
    }
    arrived = arrived || (dest.eat ? gapBetween(m, dest.eat) === 1 : m.x === dest.x && m.y === dest.y);
    if (!arrived) return;
    if (dest.eat) {
      const cocoon = this.current.furniture.find((f) => f.x === dest.eat!.x && f.y === dest.eat!.y && f.kind.startsWith("cocoon"));
      if (cocoon && gapBetween(m, cocoon) === 1) {
        this.current.furniture = this.current.furniture.filter((o) => o !== cocoon);
        this.map.set(cocoon.x, cocoon.y, Tile.Floor);
        this.stain(cocoon.x, cocoon.y, "red");
        const healed = Math.min(RULES.bossCocoonHeal, m.maxHp - m.hp);
        m.hp += healed;
        this.events.push({ type: "boss", what: "eat", x: cocoon.x, y: cocoon.y, amount: healed });
      }
    }
    st.dest = undefined;
    st.phase = "lurk";
    st.lurk = RULES.bossLurkTurns;
  }

  /**
   * Repeuplement : de temps en temps, si l'étage a perdu des monstres, un promeneur arrive dans une salle
   * hors de vue et loin du héros. L'étage ne dépasse jamais sa population d'origine.
   */
  private respawn(): void {
    const state = this.current;
    if (this.turn < state.nextRespawn || this.peaceful || state.boss) return;
    // Salle d'essai avec arène : pas de renforts (on en ajoute à la main, par les boutons de l'arène).
    if (this.depth === 1 && this.sandboxFloor()?.arena !== undefined) return;
    // Agité, puis alerte : les promeneurs arrivent un peu plus vite, et un peu plus nombreux (en douceur, Thomas 2026-11-11).
    const stage = Math.min(state.alarmStage, 2);
    state.nextRespawn = this.turn + [RULES.respawnTurns, RULES.agitatedRespawnTurns, RULES.alertRespawnTurns][stage];
    const cap = state.population + [0, RULES.agitatedExtraPopulation, RULES.alertExtraPopulation][stage];
    if (this.monsters.length >= cap || this.rooms.length === 0) return;
    const spawns = spawnsForDepth(this.depth);
    let pick = this.rng.next() * spawns.entries.reduce((sum, e) => sum + e.weight, 0);
    const entry = spawns.entries.find((e) => (pick -= e.weight) < 0) ?? spawns.entries[0];
    for (let attempt = 0; attempt < 30; attempt++) {
      const room = this.rooms[this.rng.int(0, this.rooms.length - 1)];
      const x = this.rng.int(room.x, room.x + room.w - 1);
      const y = this.rng.int(room.y, room.y + room.h - 1);
      const far = Math.max(Math.abs(x - this.hero.x), Math.abs(y - this.hero.y)) >= RULES.respawnDistance;
      if (this.map.get(x, y) !== Tile.Floor || this.actorAt(x, y) || this.isVisible(x, y) || !far) continue;
      this.monsters.push(this.newMonster(MONSTERS[entry.monster], x, y, false));
      return;
    }
  }




  // ---------- Niveau d'alerte (ex-« Tocsin ») ----------

  /** Alerte de l'étage courant (0 à 100) et palier (0 calme, 1 agité, 2 alerte, 3 traque). */
  alarm(): { level: number; stage: number } {
    return { level: this.current.alarm, stage: this.current.alarmStage };
  }

  /** L'étage du boss : pas de niveau d'alerte (Thomas, 2026-11-12 : « désactive le niveau d'alerte des étages boss »). */
  alarmOff(): boolean {
    return !!this.current.boss;
  }

  /** Du bruit, ou du temps qui passe : l'alerte monte ; à chaque palier franchi, le donjon réagit. */
  raiseAlarm(points: number, at?: Point): void {
    const state = this.current;
    // La nichée du boss : l'alerte n'y monte pas (il n'y a personne d'autre à prévenir).
    if (points <= 0 || this.over || state.boss) return;
    // Un bruit localisé se voit à l'écran (des ondes qui partent de l'endroit).
    if (at) this.events.push({ type: "noise", x: at.x, y: at.y, points });
    if (at) this.hushMushrooms(at);
    state.alarm = Math.min(100, state.alarm + points);
    while (state.alarmStage < RULES.alarmStages.length && state.alarm >= RULES.alarmStages[state.alarmStage]) {
      state.alarmStage++;
      this.events.push({ type: "alarm", stage: state.alarmStage });
      if (state.alarmStage === 1) state.nextRespawn = Math.min(state.nextRespawn, this.turn + 1);
      // Alerte : seulement des renforts un peu plus fréquents (voir `respawn`). Traqueurs à 0 pour l'instant.
      if (state.alarmStage === 2) this.sendTrackers(RULES.trackersAlert);
      if (state.alarmStage === 3) {
        // Traque : tout l'étage sait où est le héros (traqueurs à 0 pour l'instant).
        this.sendTrackers(RULES.trackersHunt);
        for (const m of this.monsters) {
          m.alerted = true;
          m.asleep = false;
          m.patrol = undefined;
        }
        this.reveal();
      }
    }
  }

  /**
   * L'alerte redescend (quêtes à venir ; salle d'essai : bouton « − Alerte ») : le palier suit le niveau. Un palier
   * perdu ne fait rien partir (les monstres déjà alertés le restent).
   */
  lowerAlarm(points: number): void {
    const state = this.current;
    if (points <= 0 || this.over || state.boss) return;
    state.alarm = Math.max(0, state.alarm - points);
    let stage = 0;
    while (stage < RULES.alarmStages.length && state.alarm >= RULES.alarmStages[stage]) stage++;
    if (stage < state.alarmStage) {
      state.alarmStage = stage;
      this.events.push({ type: "alarmDown", stage });
    }
  }

  /** Des traqueurs arrivent par l'entrée de l'étage (hors de vue) et foncent sur le héros. */
  private sendTrackers(count: number): void {
    const spawns = spawnsForDepth(this.depth);
    const def = MONSTERS[spawns.entries[0].monster];
    const origin = this.current.start;
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 60; attempt++) {
        const r = Math.min(6, 1 + Math.floor(attempt / 8));
        const x = attempt < 50 ? origin.x + this.rng.int(-r, r) : this.rng.int(0, this.map.width - 1);
        const y = attempt < 50 ? origin.y + this.rng.int(-r, r) : this.rng.int(0, this.map.height - 1);
        const far = Math.max(Math.abs(x - this.hero.x), Math.abs(y - this.hero.y)) >= 4;
        if (this.map.get(x, y) !== Tile.Floor || this.actorAt(x, y) || this.isVisible(x, y) || !far) continue;
        const m = this.newMonster(def, x, y, false);
        m.alerted = true;
        this.monsters.push(m);
        break;
      }
    }
  }

  /** Les pièges de l'étage. */
  traps(): readonly Trap[] {
    return this.current.traps;
  }

  isTrap(x: number, y: number): boolean {
    return this.current.traps.some((t) => t.x === x && t.y === y);
  }

  /** Un piège que le héros connaît (visible, ou trouvé) : les pièges cachés ne comptent pas pour lui. */
  knownTrap(x: number, y: number): boolean {
    return this.current.traps.some((t) => t.x === x && t.y === y && !t.hidden);
  }

  /** Cases où un chemin peut passer : on contourne les pièges, sauf si l'on veut y aller. */
  private avoidTraps(to: Point, base?: (x: number, y: number) => boolean, from: Point = this.hero): (x: number, y: number) => boolean {
    // Agrandi (potion de géant) : il ne passe plus les portes (Thomas, 2026-11-13).
    const giant = ((from as Actor).grown ?? 0) > 0;
    // Pièges et cases en feu : on les contourne (sauf si c'est la destination ou le point de départ).
    return (x, y) => (!base || base(x, y)) && !(giant && this.map.isDoor(x, y) && !(x === from.x && y === from.y)) && ((x === to.x && y === to.y) || (x === from.x && y === from.y) || (!(from === this.hero && this.knownTrap(x, y)) && !this.isBurning(x, y) && !this.isDenseGas(x, y)));
  }

  /**
   * Chemin du héros : il évite les pièges et le feu ; il contourne aussi le gravier quand le détour est court
   * (au plus `gravelDetour` pas de plus). On peut toujours y marcher exprès (case d'arrivée sur le gravier).
   */
  private heroPath(to: Point, known0?: (x: number, y: number) => boolean): Point[] | null {
    // Un escalier se prend en marchant dessus : le chemin le contourne toujours, sauf s'il est la destination
    // (Thomas, 2026-11-12 : « quand le chemin ne termine pas sur un escalier, il le contourne »).
    const stairs = (x: number, y: number) => {
      const t = this.map.get(x, y);
      return (t === Tile.StairsDown || t === Tile.StairsUp) && !(x === to.x && y === to.y) && !(x === this.hero.x && y === this.hero.y);
    };
    const known = (x: number, y: number) => (!known0 || known0(x, y)) && !stairs(x, y);
    let plain0 = findPath(this.map, this.hero, to, this.avoidTraps(to, known));
    // FIGÉ DANS UN NUAGE (Thomas, 2026-11-17 : « dans un couloir, nuage toxique : freeze » ; « dans la champignonnière,
    // après avoir arrosé : freeze ») : au milieu d'un nuage (piège, spores d'un sporelin), toutes les cases voisines
    // sont du gaz et le héros, qui contourne le gaz, n'avait plus aucun chemin : il ne bougeait plus. S'il n'y a pas
    // d'autre chemin, il traverse le gaz (puis, au pire, le feu) ; les pièges connus restent évités.
    if (!plain0) {
      const through = (fire: boolean) => (x: number, y: number) =>
        known(x, y) && ((x === to.x && y === to.y) || (x === this.hero.x && y === this.hero.y) || (!this.knownTrap(x, y) && (fire || !this.isBurning(x, y))));
      plain0 = findPath(this.map, this.hero, to, through(false)) ?? findPath(this.map, this.hero, to, through(true));
    }
    // Nichée : le héros suit les sentiers sans toile quand le détour reste court (chaque toile coûte un tour).
    let plain = plain0;
    if (plain0 && this.current.boss) {
      const sticky = (x: number, y: number) => this.current.furniture.some((f) => f.x === x && f.y === y && (f.kind.startsWith("webN") || f.kind.startsWith("webHub")));
      const webs = plain0.filter((p) => sticky(p.x, p.y)).length;
      if (webs > 0) {
        const clean = findPath(this.map, this.hero, to, this.avoidTraps(to, (x, y) => (!known || known(x, y)) && (!sticky(x, y) || (x === to.x && y === to.y))));
        if (clean && clean.length <= plain0.length + webs) plain = clean;
      }
    }
    // Le gravier et l'eau font du bruit (Thomas, 2026-11-12) : le héros les contourne s'il peut.
    const noisy = (t: Tile) => t === Tile.Gravel || t === Tile.Water;
    if (!plain || !plain.some((p) => noisy(this.map.get(p.x, p.y)))) return plain;
    const quiet = findPath(
      this.map,
      this.hero,
      to,
      this.avoidTraps(to, (x, y) => (!known || known(x, y)) && (!noisy(this.map.get(x, y)) || (x === to.x && y === to.y))),
    );
    return quiet && quiet.length <= plain.length + RULES.gravelDetour ? quiet : plain;
  }

  /** Le héros vient de poser le pied sur du gravier : ça crisse ; les monstres proches l'entendent et accourent. */
  /**
   * Entrer dans une toile : d20 + bonus de force contre `webEscapeDc`. Réussi, on la déchire en passant ; raté, on y
   * reste collé un tour (le prochain déplacement sert à se dépêtrer). La toile est déchirée dans les deux cas.
   */
  private enterWeb(): void {
    const web = this.current.furniture.find((f) => f.kind.startsWith("web") && f.x === this.hero.x && f.y === this.hero.y);
    if (!web) return;
    // Nichée de la Tisseuse (Thomas : « quand on marche sur une toile on est ralenti ») : une nappe coûte un tour de plus
    // et se déchire au passage ; la grande toile ralentit aussi mais tient (il faut couper ses amarres ou la brûler).
    if (web.kind.startsWith("webN") || web.kind.startsWith("webHub")) {
      this.hero.stuck = Math.max(this.hero.stuck ?? 0, 1);
      if (web.kind.startsWith("webN")) {
        this.current.furniture = this.current.furniture.filter((o) => o !== web);
        this.map.touch(web.x, web.y);
      }
      this.events.push({ type: "webSlow", hub: web.kind.startsWith("webHub") });
      return;
    }
    const roll = this.rng.int(1, 20);
    const escaped = roll + this.pushBonus() >= RULES.webEscapeDc;
    if (!escaped) this.hero.stuck = Math.max(this.hero.stuck ?? 0, 1);
    this.current.furniture = this.current.furniture.filter((o) => o !== web);
    this.map.touch(web.x, web.y);
    this.path = escaped ? this.path : [];
    this.events.push({ type: "web", escaped, roll, bonus: this.pushBonus() });
  }

  private crunch(): void {
    // Gravier qui crisse, ou eau qui clapote (Thomas, 2026-11-12 : « l'eau et le gravier attirent les ennemis »).
    const ground = this.map.get(this.hero.x, this.hero.y);
    if ((ground !== Tile.Gravel && ground !== Tile.Water) || this.peaceful) return;
    this.reveal();
    let alerted = 0;
    for (const m of this.monsters) {
      const d = Math.max(Math.abs(m.x - this.hero.x), Math.abs(m.y - this.hero.y));
      if (d <= RULES.gravelRadius && !m.alerted) {
        m.alerted = true;
        m.asleep = false;
        alerted++;
      }
    }
    this.events.push({ type: "gravel", x: this.hero.x, y: this.hero.y, alerted, water: ground === Tile.Water });
    this.raiseAlarm(RULES.gravelAlarm, this.hero);
  }

  /** Quelqu'un vient d'arriver sur cette case : si c'est un piège, il se déclenche. */
  /**
   * Un piège se déclenche sous ce personnage (pièges v3) : pointes (dégâts), fosse (dégâts, puis un tour à en remonter ;
   * elle reste effondrée), aiguille empoisonnée (une piqûre et du poison), gaz (un nuage empoisonné sur la case et ses
   * quatre voisines). Il reste armé.
   */
  private springTrap(actor: Actor): void {
    const trap = this.current.traps.find((t) => t.x === actor.x && t.y === actor.y);
    if (!trap) return;
    // Un piège caché se montre en partant (sous le héros ou sous un monstre en vue).
    if (trap.hidden && (actor.kind === "hero" || this.isVisible(trap.x, trap.y))) trap.hidden = false;
    const kind = trap.kind ?? "spikes";
    const def = TRAPS[kind];
    // La lame pendule ne passe qu'un tour sur deux : entre deux passages, on traverse sans rien.
    if (def.swings && !this.bladeDown()) return;
    // Une dalle déjà effondrée ne fait plus rien.
    if (def.sinks && trap.sprung) return;
    // Agilité (Thomas, 2026-11-11) : le héros qui marche sur un piège peut l'éviter d'un bond (d20 + agilité).
    if (actor.kind === "hero") {
      const d20 = this.rng.int(1, 20);
      const bonus = this.agility();
      if (d20 !== 1 && (d20 === 20 || d20 + bonus >= RULES.trapDodgeDc)) {
        if (kind === "pit" || def.sinks) trap.sprung = true;
        this.events.push({ type: "trapDodged", x: actor.x, y: actor.y, kind, d20, bonus });
        return;
      }
    }
    const damage = def.damage ? rollDice(this.rng, def.damage) : 0;
    this.events.push({ type: "trap", x: actor.x, y: actor.y, victim: actor, damage, kind });
    if (kind === "pit" || def.sinks) trap.sprung = true;
    if (def.stuck) actor.stuck = Math.max(actor.stuck ?? 0, def.stuck);
    if (def.poison && kind === "needle") this.poisonActor(actor, def.poison);
    if (def.gasTurns && def.numb) {
      // Encensoir : un nuage d'encens violet qui engourdit (un tour sur deux perdu), pas de poison.
      const cells = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: trap.x + dx, y: trap.y + dy })).filter((c) => this.map.isWalkable(c.x, c.y));
      this.cloud(this.incense, cells, def.gasTurns);
    } else if (def.gasTurns) {
      this.puffGas(trap, def.gasTurns);
    }
    if (def.moonFlash) {
      // Miroir de lune : la lumière tombe autour du miroir quelques tours ; tout l'étage proche voit le héros.
      this.current.moonFlashes = [...(this.current.moonFlashes ?? []).filter((f) => !(f.x === trap.x && f.y === trap.y)), { x: trap.x, y: trap.y, turns: def.moonFlash }];
      for (const m of this.monsters) {
        if (m.boss || m.effigy || m.pile !== undefined || Math.max(Math.abs(m.x - trap.x), Math.abs(m.y - trap.y)) > 8) continue;
        if (actor.kind === "hero") {
          m.alerted = true;
          m.asleep = false;
        }
      }
      this.refreshLight();
    }
    if (damage > 0) {
      this.bleed(actor, actor);
      if (actor.kind === "hero") {
        this.hurtHero(damage, { spikes: "un piège à pointes", pit: "une chute dans une fosse", needle: "une aiguille empoisonnée", gas: "le gaz", snare: "un lacet de mycélium", hooks: "des racines-crochets", spores: "des spores", tombSlab: "une chute dans un caveau", boneHands: "des mains d'os", censer: "l'encens", moonMirror: "un miroir de lune", pendulum: "une lame pendule" }[kind]);
      } else {
        actor.hp = Math.max(0, actor.hp - damage);
        this.removeIfDead(actor);
      }
    }
  }

  // ---------- Section 2 : les monstres de la champignonnière (Thomas, 2026-11-15) ----------

  private fireWeak(a: Actor): boolean {
    return a.kind === "monster" && !!(MONSTERS[a.defId as keyof typeof MONSTERS] as MonsterDef | undefined)?.fireWeak;
  }

  private sporeProof(a: Actor): boolean {
    return a.kind === "monster" && !!(MONSTERS[a.defId as keyof typeof MONSTERS] as MonsterDef | undefined)?.sporeProof;
  }

  /** Un nuage de spores (empoisonné) sur cette case et ses 4 voisines. */
  private puffGas(at: Point, turns: number): void {
    const cells = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: at.x + dx, y: at.y + dy })).filter((c) => this.map.isWalkable(c.x, c.y) || this.map.get(c.x, c.y) === Tile.Furniture);
    this.cloud(this.gas, cells, turns);
    this.gasPoison();
  }

  /**
   * Pose un nuage (gaz ou brouillard) : ses cases DENSES, plus un halo LÉGER (Thomas, 2026-11-15 : « un niveau de fumée
   * intermédiaire, moins dense et moins dangereux, dans les angles ») sur les cases voisines de deux cases denses au
   * moins (les angles d'une croix, le pourtour d'un losange), vues depuis le cœur du nuage. Une case dense l'emporte.
   */
  private cloud(list: { x: number; y: number; turns: number; thin?: boolean }[], cells: Point[], turns: number): void {
    const dense = new Set(cells.map((c) => `${c.x},${c.y}`));
    const put = (x: number, y: number, thin: boolean) => {
      const old = list.find((g) => g.x === x && g.y === y);
      if (old) {
        old.turns = Math.max(old.turns, turns);
        if (!thin) old.thin = undefined;
      } else list.push(thin ? { x, y, turns, thin: true } : { x, y, turns });
    };
    for (const c of cells) put(c.x, c.y, false);
    const halo = new Map<string, number>();
    for (const c of cells) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const k = `${c.x + dx},${c.y + dy}`;
          if ((dx || dy) && !dense.has(k)) halo.set(k, (halo.get(k) ?? 0) + 1);
        }
      }
    }
    const center = cells[0];
    for (const [k, n] of halo) {
      if (n < 2) continue;
      const [x, y] = k.split(",").map(Number);
      if (!this.map.isWalkable(x, y) && this.map.get(x, y) !== Tile.Furniture) continue;
      if (center && !hasLineOfSight(this.map, center, { x, y })) continue;
      put(x, y, true);
    }
  }

  /**
   * Myconide : il ne voit rien, il sent les pas. Un héros qui marche à `radius` cases ou moins (murs compris) est entendu
   * (chance de remarquer par tour) ; un héros immobile 2 tours de suite, hors de portée de coup, est perdu : il va
   * « écouter » là où il l'a senti pour la dernière fois. Renvoie vrai si son tour est joué.
   */
  private tremorAct(m: Actor, radius: number): boolean {
    const moved = this.hero.x !== this.hero.fromX || this.hero.y !== this.hero.fromY;
    const near = Math.max(Math.abs(this.hero.x - m.x), Math.abs(this.hero.y - m.y)) <= radius;
    if (!m.alerted) {
      if (moved && near && this.rng.chance(MONSTERS[m.defId as keyof typeof MONSTERS].noticeChance)) {
        this.faceToward(m, this.hero);
        m.alerted = true;
        m.asleep = false;
        m.quiet = 0;
        m.goal = { x: this.hero.x, y: this.hero.y };
        this.events.push({ type: "noticed", actor: m });
        this.raiseAlarm(RULES.alarmNoticed);
        return true;
      }
      if (!m.asleep) this.wander(m);
      return true;
    }
    if (this.inReach(m, this.hero)) {
      m.quiet = 0;
      return false; // au contact : il frappe (tour ordinaire)
    }
    // Blessé, il ne lâche plus sa proie : il remonte le coup jusqu'à elle, même immobile, même de loin (sinon un archer
    // qui ne bouge pas le tuait sans jamais être approché).
    if ((moved && near) || m.hp < m.maxHp) {
      m.quiet = 0;
      m.goal = { x: this.hero.x, y: this.hero.y };
    } else if ((m.quiet = (m.quiet ?? 0) + 1) >= 2) {
      // Il a perdu le héros : il va là où il l'a senti, et écoute.
      m.alerted = false;
      this.events.push({ type: "lostTrack", actor: m });
      return true;
    }
    const goal = m.goal ?? { x: this.hero.x, y: this.hero.y };
    if (!this.stepToward(m, goal)) m.goal = undefined;
    return true;
  }

  /** « un Kobold », « une Araignée » : le nom du monstre, pour l'écran de fin. */
  private killerName(m: Actor): string {
    if (m.boss) return m.name;
    return m.defId === "araignee" ? `une ${m.name}` : `un ${m.name}`;
  }

  /** Empoisonne un personnage (un nouveau poison remet le compteur, il ne s'ajoute pas). */
  private poisonActor(actor: Actor, poison: { damage: number; turns: number }): void {
    // La Tisseuse ne craint pas le poison (Thomas, 2026-11-13) ; le feu, si. Les morts de l'ossuaire non plus.
    if (actor.boss || (actor.kind === "monster" && (MONSTERS[actor.defId as keyof typeof MONSTERS] as MonsterDef | undefined)?.undead)) {
      this.events.push({ type: "poisoned", actor, immune: true });
      return;
    }
    actor.poison = { ...poison };
    this.events.push({ type: "poisoned", actor });
  }

  /** Nuages de gaz empoisonné (piège à gaz) : case par case, tours restants. */
  gas: { x: number; y: number; turns: number; thin?: boolean }[] = [];
  /** Brouillard noir (potion de brouillard) : on ne voit ni à travers ni dedans ; personne ne s'y empoisonne. */
  fog: { x: number; y: number; turns: number; thin?: boolean }[] = [];
  /** Potion de discorde (Thomas, 2026-11-17 : « nuage rose sur plusieurs mobs, croix foncée, zone plus petite que le
   *  brouillard ») : un nuage rose foncé en croix, pour l'œil seulement (2 tours). */
  discordMist: { x: number; y: number; turns: number; thin?: boolean }[] = [];
  /** Nuage d'encens (encensoir, section 3) : engourdit. */
  incense: { x: number; y: number; turns: number; thin?: boolean }[] = [];
  /** Givre de la potion de gel (pour l'œil). */
  frost: { x: number; y: number; turns: number; thin?: boolean }[] = [];
  /** Potion d'oursin : tours restants pendant lesquels les coups reçus au contact renvoient une part des dégâts. */
  urchinTurns = 0;
  /** Potion de pierre bue : tours où le héros est une statue (rien ne le blesse, il ne peut rien faire). */
  stoneTurns = 0;
  /** Tours de repos passés caché (au-delà de `RULES.hideRestTurns`, on sort de l'ombre). */
  private restHidden = 0;
  /** Coup de serviette reçu : le prochain coup du héros a le désavantage. */
  towelBlind = 0;
  /** Taché par le crachat d'encre du Carillon : le prochain tir du héros a le désavantage. */
  inkBlind = 0;

  isGassed(x: number, y: number): boolean {
    return this.gas.some((g) => g.x === x && g.y === y);
  }

  /** Gaz dense (le héros le contourne ; la fumée légère, non). */
  private isDenseGas(x: number, y: number): boolean {
    return this.gas.some((g) => g.x === x && g.y === y && !g.thin);
  }

  /** Qui se tient dans le gaz est empoisonné (s'il ne l'est pas déjà plus longtemps). */
  private gasPoison(): void {
    const poison = TRAPS.gas.poison!;
    for (const a of [this.hero, ...this.monsters]) {
      if (a.boss || this.sporeProof(a) || !this.isGassed(a.x, a.y) || (a.poison && a.poison.turns >= poison.turns)) continue;
      // Gaz léger (halo, dernier tour) : une chance sur deux seulement.
      if (this.gas.find((g) => g.x === a.x && g.y === a.y)?.thin && !this.rng.chance(RULES.thinGasPoisonChance)) continue;
      this.poisonActor(a, poison);
    }
  }

  /** Fin de tour : le gaz empoisonne, puis se dissipe. */
  private gasTick(): void {
    if (this.gas.length === 0) return;
    this.gasPoison();
    for (const g of this.gas) g.turns--;
    this.gas = this.gas.filter((g) => g.turns > 0);
    // Avant de disparaître, un nuage passe en fumée légère (son dernier tour).
    for (const g of this.gas) if (g.turns === 1) g.thin = true;
  }

  /** Du brouillard sur cette case ? */
  fogAt(x: number, y: number): boolean {
    // La nappe légère (halo, dernier tour) se voit, mais ne cache rien.
    return this.fog.some((f) => f.x === x && f.y === y && !f.thin);
  }

  /** Le brouillard cache-t-il `b` aux yeux de `a` (b dedans, ou une nappe sur la ligne) ? */
  private fogBetween(a: Point, b: Point): boolean {
    if (this.fog.length === 0) return false;
    // Dans un nuage, même léger, personne ne vous voit (Thomas, 2026-11-19 : « boss compris »).
    return this.fog.some((f) => f.x === b.x && f.y === b.y) || this.lineCells(a, b).some((c) => this.fogAt(c.x, c.y));
  }

  /** Les monstres qui ne voient plus le héros à cause du brouillard perdent sa trace et vont voir là où il était. */
  private fogBlinds(): void {
    for (const m of this.monsters) {
      if (m.boss || !m.alerted || this.inReach(m, this.hero) || !this.fogBetween(m, this.hero)) continue;
      m.alerted = false;
      m.wary = false;
      m.lost = 0;
      m.goal = { x: this.hero.x, y: this.hero.y };
    }
  }

  /** Section 3 : la lame pendule est en bas ce tour-ci (un tour sur deux). */
  bladeDown(): boolean {
    return this.turn % 2 === 0;
  }

  /** Dans l'encens (encensoir) : engourdi. */
  incenseAt(x: number, y: number): boolean {
    return this.incense.some((f) => f.x === x && f.y === y && !f.thin);
  }

  /**
   * Fin de tour, section 3 : l'encens se dissipe ; qui s'y tient perd un tour sur deux (engourdi) ; la lune du miroir
   * s'éteint ; la lame pendule passe : qui se tient dessus quand elle descend est frappé.
   */
  private ossuaryTick(): void {
    if (this.incense.length > 0) {
      for (const a of [this.hero, ...this.monsters]) {
        if (a.boss || !this.incenseAt(a.x, a.y) || this.turn % 2 === 0) continue;
        a.stuck = Math.max(a.stuck ?? 0, 1);
        if (a === this.hero) this.events.push({ type: "numb", actor: a });
      }
      for (const f of this.incense) f.turns--;
      this.incense = this.incense.filter((f) => f.turns > 0);
      for (const f of this.incense) if (f.turns === 1) f.thin = true;
    }
    if (this.current?.nights?.length) {
      for (const n of this.current.nights) n.turns--;
      this.current.nights = this.current.nights.filter((n) => n.turns > 0);
    }
    const flashes = this.current?.moonFlashes;
    if (flashes && flashes.length > 0) {
      for (const f of flashes) f.turns--;
      this.current.moonFlashes = flashes.filter((f) => f.turns > 0);
      if (this.current.moonFlashes.length !== flashes.length) this.refreshLight();
    }
    if (this.bladeDown()) {
      for (const a of [this.hero, ...this.monsters]) {
        if (this.over) return;
        const t = this.current.traps.find((p) => p.x === a.x && p.y === a.y && p.kind === "pendulum");
        if (t && (a.x !== a.fromX || a.y !== a.fromY ? false : true)) this.springTrap(a);
      }
    }
  }

  /** Fin de tour : le brouillard aveugle, puis se dissipe. */
  private fogTick(): void {
    for (const f of this.discordMist) f.turns--;
    this.discordMist = this.discordMist.filter((f) => f.turns > 0);
    for (const f of this.frost) f.turns--;
    this.frost = this.frost.filter((f) => f.turns > 0);
    if (this.fog.length === 0) return;
    this.fogBlinds();
    for (const f of this.fog) f.turns--;
    this.fog = this.fog.filter((f) => f.turns > 0);
    for (const f of this.fog) if (f.turns === 1) f.thin = true;
  }

  /**
   * Une nappe de brouillard autour de `at` : un LOSANGE de `arm` cases de rayon (Thomas, 2026-11-13, dessin : « une croix
   * de 5 » = rangées de 1, 3, 5, 3, 1 cases), sans traverser les murs.
   */
  private spreadFog(at: Point, arm: number): Point[] {
    const cells: Point[] = [];
    for (let dy = -arm; dy <= arm; dy++) {
      for (let dx = -arm; dx <= arm; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > arm) continue;
        const c = { x: at.x + dx, y: at.y + dy };
        if (!this.map.isWalkable(c.x, c.y) && this.map.get(c.x, c.y) !== Tile.Furniture) continue;
        if ((dx !== 0 || dy !== 0) && !hasLineOfSight(this.map, at, c)) continue;
        cells.push(c);
      }
    }
    this.cloud(this.fog, cells, RULES.fogTurns);
    this.fogBlinds();
    return cells;
  }

  /**
   * Flûte de pan (bibelot, Thomas 2026-11-12) : en combat, de temps en temps, quelques notes endorment un ennemi proche.
   */
  private fluteTick(): void {
    if (this.equipment.artifact?.defId !== "flute_pan" || !this.inCombat() || !this.rng.chance(RULES.fluteChance)) return;
    const foes = this.monsters.filter((m) => !m.boss && m.alerted && this.isVisible(m.x, m.y) && gapBetween(m, this.hero) <= RULES.fluteRange);
    if (foes.length === 0) return;
    foes.sort((a, b) => gapBetween(a, this.hero) - gapBetween(b, this.hero));
    const m = foes[0];
    m.asleep = true;
    m.alerted = false;
    m.wary = false;
    m.feud = undefined;
    this.events.push({ type: "lullaby", actor: m });
  }

  /** Œil de chauve-souris (bibelot) : les monstres hors de vue qu'on devine, en ombres (10 cases, 3 à travers un mur). */
  batShadows(): Point[] {
    if (this.equipment.artifact?.defId !== "oeil_chauve_souris") return [];
    const out: Point[] = [];
    for (const m of this.monsters) {
      if (this.isVisible(m.x, m.y)) continue;
      const d = gapBetween(m, this.hero);
      if (d <= RULES.batWallRange || (d <= RULES.batRange && hasLineOfSight(this.map, this.hero, m))) out.push({ x: m.x, y: m.y });
    }
    return out;
  }

  /** Les monstres qu'on peut pousser : ceux qu'on voit, au contact. */
  pushTargets(): Actor[] {
    // La Tisseuse est bien trop lourde pour être poussée.
    return this.visibleMonsters().filter((m) => !m.boss && this.inReach(this.hero, m));
  }

  /**
   * DÉSAMORCER (Thomas, 2026-11-17 : « réfléchis à un moyen de les désamorcer ; je veux que des joueurs cliquent dessus
   * par accident, donc ça ne peut pas être au clic ») : une action de la barre, qui n'apparaît qu'à côté d'un piège
   * connu. Toucher le piège, lui, y marche toujours. d20 + agilité (+ crochetage de la classe) contre 12 ; outils de
   * voleur : à coup sûr. Raté de 5 ou plus (ou un 1) : le piège part sur vous ; raté de peu : rien, on peut réessayer.
   */
  disarmTargets(): Point[] {
    if (this.over) return [];
    return this.current.traps
      .filter((t) => !t.hidden && !t.sprung && Math.max(Math.abs(t.x - this.hero.x), Math.abs(t.y - this.hero.y)) === 1)
      .map((t) => ({ x: t.x, y: t.y }));
  }

  disarmRefusal(): "none" | "threatened" | null {
    if (this.disarmTargets().length === 0) return "none";
    if (this.isThreatened()) return "threatened";
    return null;
  }

  /** Ordre : désamorcer le piège de cette case (un tour, un jet). */
  disarm(x: number, y: number): boolean {
    if (this.disarmRefusal() !== null || !this.disarmTargets().some((t) => t.x === x && t.y === y)) return false;
    this.wait();
    this.waiting = false;
    this.disarmAt = { x, y };
    return true;
  }

  private resolveDisarm(at: Point): void {
    const trap = this.current.traps.find((t) => t.x === at.x && t.y === at.y && !t.hidden && !t.sprung);
    if (!trap || Math.max(Math.abs(trap.x - this.hero.x), Math.abs(trap.y - this.hero.y)) !== 1) return;
    const kind = trap.kind ?? "spikes";
    const bonus = this.heroClass.lockpickBonus + this.agility();
    const tools = this.equipment.artifact?.defId === "outils_voleur";
    let d20 = this.rng.int(1, 20);
    let total = d20 + bonus;
    let success = tools || d20 === 20 || (d20 !== 1 && total >= RULES.disarmDc);
    if (!success && this.useStubborn()) {
      d20 = this.rng.int(1, 20);
      total = d20 + bonus;
      success = d20 === 20 || (d20 !== 1 && total >= RULES.disarmDc);
    }
    if (success) {
      this.current.traps = this.current.traps.filter((t) => t !== trap);
      this.map.touch(trap.x, trap.y);
      this.events.push({ type: "disarm", x: trap.x, y: trap.y, kind, d20, bonus, total, success: true, sprung: false });
      return;
    }
    const sprung = d20 === 1 || total <= RULES.disarmDc - 5;
    this.events.push({ type: "disarm", x: trap.x, y: trap.y, kind, d20, bonus, total, success: false, sprung });
    if (!sprung) return;
    // Le piège part sur la main qui y touchait : ses dégâts, son poison, ses liens, son gaz.
    const def = TRAPS[kind];
    if (kind === "pit") trap.sprung = true;
    if (def.stuck) this.hero.stuck = Math.max(this.hero.stuck ?? 0, def.stuck);
    if (def.poison) this.poisonActor(this.hero, def.poison);
    if (def.gasTurns) this.puffGas(trap, def.gasTurns);
    const damage = def.damage && kind !== "pit" ? rollDice(this.rng, def.damage) : 0;
    if (damage > 0) {
      this.bleed(this.hero, this.hero);
      this.hurtHero(damage, "un piège mal désamorcé");
    }
  }

  pushRefusal(): "none" | null {
    return this.pushTargets().length === 0 ? "none" : null;
  }

  /** Ordre : pousser ce monstre (un tour, un jet). */
  push(monsterId: number): boolean {
    if (this.over || !this.pushTargets().some((m) => m.id === monsterId)) return false;
    this.wait();
    this.waiting = false;
    this.pushTargetId = monsterId;
    return true;
  }

  /** La salle où se tient le héros (son numéro), ou -1 dans un couloir. */
  roomIndexAt(p: Point): number {
    return this.rooms.findIndex((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
  }

  /** Salle d'essai : monstres, objets, caches et pièges aux places prévues par le plan. */
  private populateSandbox(state: FloorState, plan: SandboxFloor, again = false): void {
    for (const m of plan.monsters) {
      const monster = this.newMonster(MONSTERS[m.monster ?? "schrat"], m.x, m.y, m.asleep);
      if (m.patrol) monster.patrol = state.rooms.find((r) => m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h);
      this.monsters.push(monster);
    }
    // Niveau 4 dans la salle d'essai : on peut y essayer l'épée longue, la lance et les flèches empoisonnées ;
    // le cimeterre et le cuir clouté (niveau 5) montrent le refus. (Pas quand l'étage est remis à neuf.)
    if (!again) {
      this.level = plan.heroLevel;
      // Les points des niveaux déjà passés sont à attribuer (et la voie à choisir).
      this.points = plan.heroLevel - 1;
    }
    state.population = this.monsters.length;
    state.nextRespawn = this.turn + RULES.respawnTurns;
    for (const g of plan.ground) this.ground.push({ ...g });
    for (const s of plan.secrets) state.secrets.push({ ...s, found: false });
    for (const t of plan.traps) state.traps.push({ ...t });
  }


  /** Le meuble qui couvre cette case, ou `null`. */
  furnitureAt(x: number, y: number): Furniture | null {
    return this.current.furniture.find((f) => furnitureCells(f).some((c) => c.x === x && c.y === y)) ?? null;
  }

  /** Les motifs gravés au sol de l'étage courant (pour le dessin). */
  motifs(): readonly Motif[] {
    return this.current.motifs;
  }

  /** Les meubles de l'étage courant (pour le dessin). */
  furnitureList(): readonly Furniture[] {
    return this.current.furniture;
  }

  /** Le héros marche sur un tapis : ses pas sont étouffés. */
  onRug(p: Point = this.hero): boolean {
    return this.current.furniture.some((f) => f.kind.startsWith("rug") && furnitureCells(f).some((c) => c.x === p.x && c.y === p.y));
  }

  /** Le thème de la salle (salle de fouille), ou `null`. */
  roomTheme(index: number): string | null {
    return this.current.themes.find((t) => t.room === index)?.id ?? null;
  }

  /** Sol particulier d'une case : carrelage de la cuisine, dalles sombres de la salle de torture (sinon le sol B). */
  floorStyle(x: number, y: number): "kitchen" | "torture" | "forge" | "bath" | "prison" | "champi" | "champiFelt" | "morilles" | "sculpture" | "champiWarm" | "snow" | "ossuaire" | undefined {
    if (this.champiPatch(x, y)) return "champi";
    // La chambre de neige : de la neige partout dans la pièce.
    const sr = this.current?.secretRoom;
    if (sr?.layout === "neige" && !sr.melted && x >= sr.room.x && y >= sr.room.y && x < sr.room.x + sr.room.w && y < sr.room.y + sr.room.h) return "snow";
    const id = this.themeAt(x, y);
    // Le musée de l'ossuaire : des dalles claires.
    if (id === "musee") return "kitchen";
    if (this.look() === "ossuaire") return "ossuaire";
    return id === "cuisine" ? "kitchen" : id === "torture" ? "torture" : id === "forge" ? "forge" : id === "bain" ? "bath" : id === "prison" ? "prison" : id === "feutre" ? "champiFelt" : id === "morilles" ? "morilles" : id === "sculpture" || id === "concert" ? "sculpture" : id === "expo" ? "kitchen" : id === "chaud" ? "champiWarm" : this.look() === "champi" ? "champi" : undefined;
  }

  /** Le décor d'une case de mur : celui de l'étage, ou « chaud, terreux » au bord d'une salle de ce thème (salle d'essai). */
  wallLookAt(x: number, y: number): "s1" | "champi" | "champiWarm" | "ossuaire" {
    if (this.champiPatch(x, y)) return "champi";
    const look = this.look();
    if (look !== "champi" || !this.current.themes.some((t) => t.id === "chaud")) return look;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.themeAt(x + dx, y + dy) === "chaud") return "champiWarm";
    return look;
  }

  /** Étage du boss de la section 1 : la section 2 affleure autour de l'escalier scellé (Thomas, 2026-11-15) ; un
   *  contour irrégulier, mais toujours le même pour une case donnée. */
  champiPatch(x: number, y: number): boolean {
    const seal = this.current?.boss?.kind ? undefined : this.current?.boss?.seal;
    if (!seal) return false;
    const dx = x - seal.x;
    const dy = y - seal.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 12) return false;
    if (d2 <= 5) return true;
    return ((x * 73856093) ^ (y * 19349663)) % 3 !== 0;
  }

  /** Section 2 : éboulis (« E », infranchissable) ou terre meuble (« e ») sur cette case (pour le dessin). */
  earthAt(x: number, y: number): "E" | "B" | "e" | null {
    const list = this.current?.furniture;
    if (!list) return null;
    if (this.earthCache?.list !== list || this.earthCache.n !== list.length) {
      const cells = new Map<number, "E" | "B" | "e">();
      const breach = new Set<number>();
      for (const f of list) if (f.kind === "eboulis" || f.kind === "terre") cells.set(f.y * 4096 + f.x, f.kind === "eboulis" ? (f.breach ? "B" : "E") : "e");
      for (const f of list) if (f.kind === "eboulis" && f.breach) breach.add(f.y * 4096 + f.x);
      this.earthCache = { list, n: list.length, cells, breach };
    }
    return this.earthCache.cells.get(y * 4096 + x) ?? null;
  }
  private earthCache: { list: unknown; n: number; cells: Map<number, "E" | "B" | "e">; breach: Set<number> } | null = null;

  /** Section 2 : éboulis posé à la place d'un mur (le mur est éventré, la terre passe au travers). */
  breachAt(x: number, y: number): boolean {
    this.earthAt(x, y);
    return !!this.earthCache?.breach.has(y * 4096 + x);
  }

  /** Thème de la salle qui contient cette case (null hors des salles à thème). */
  themeAt(x: number, y: number): string | null {
    for (const t of this.current.themes) {
      const r = this.rooms[t.room];
      if (r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return t.id;
    }
    return null;
  }

  /** Éléments d'une salle (colonnes, cheminée) : plus il y en a, plus elle a de chances de cacher quelque chose. */
  roomElements(room: Room): number {
    return roomElements(this.map, this.torches, room);
  }

  /** L'étage où se trouve désormais le héros : la partie travaille directement sur ses données. */
  /**
   * HÉROS COINCÉ (Thomas, 2026-11-17 : « mon ami est toujours bloqué après redémarrage ») : à l'arrivée et à la reprise,
   * s'il ne peut pas rejoindre la salle de départ, on retire les meubles qui bouchent le chemin ; et si c'est un mur,
   * on le replace au milieu de la salle de départ. Pas en salle d'essai ni à l'étage d'un boss.
   */
  private rescueHero(): void {
    const state = this.current;
    if (!state || this.over) return;
    // LA VRAIE CAUSE (Thomas, 2026-11-17 : « c'est pile quand il remonte à l'étage de la Tisseuse ») : en remontant,
    // le héros arrivait SUR l'escalier scellé de la nichée, qui est un meuble (case non praticable) : aucun chemin ne
    // partait de lui. Sur une case non praticable, il passe sur la case libre la plus proche (tous les étages).
    if (!this.map.isWalkable(this.hero.x, this.hero.y)) {
      const near = this.nearestFree(this.hero);
      if (near) {
        this.hero.x = this.hero.fromX = near.x;
        this.hero.y = this.hero.fromY = near.y;
      }
    }
    if (state.boss || this.sandbox) return;
    const hub = floorHub(state);
    if (linked(this.map, this.hero, hub)) return;
    if (clearPath(state, this.hero, hub) && linked(this.map, this.hero, hub)) return;
    const room = state.rooms[0];
    for (let r = 0; r < 6; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const x = hub.x + dx;
          const y = hub.y + dy;
          if (!this.map.isWalkable(x, y) || this.actorAt(x, y) || this.map.get(x, y) === Tile.StairsDown || this.map.get(x, y) === Tile.StairsUp) continue;
          if (room && (x < room.x || y < room.y || x >= room.x + room.w || y >= room.y + room.h)) continue;
          this.hero.x = this.hero.fromX = x;
          this.hero.y = this.hero.fromY = y;
          return;
        }
  }

  /** La case praticable et libre la plus proche (d'abord les voisines, en anneaux), de préférence reliée au reste. */
  private nearestFree(p: Point): Point | null {
    for (let r = 1; r < 8; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = p.x + dx;
          const y = p.y + dy;
          if (!this.map.inBounds(x, y) || !this.map.isWalkable(x, y) || this.actorAt(x, y)) continue;
          const t = this.map.get(x, y);
          if (t === Tile.StairsDown || t === Tile.StairsUp) continue;
          return { x, y };
        }
    return null;
  }

  private useFloor(state: FloorState, depth: number): void {
    this.current = state;
    this.depth = depth;
    // Escaliers toujours reliés (Thomas, 2026-11-17 : « un joueur est coincé ici, après être remonté ; corrige aussi la
    // sauvegarde existante ») : réparé à chaque arrivée et à chaque reprise.
    if (!state.boss) unblockStairs(state);
    // Torches dans les couloirs (Thomas, 2026-11-17) : une torche posée sur le mur d'une salle, quand un couloir a été
    // creusé ensuite à travers ce mur, restait accrochée… au sol du couloir. On ne garde que celles qui sont sur un mur.
    if (state.torches.some((t) => state.map.get(t.x, t.y) !== Tile.Wall)) state.torches = state.torches.filter((t) => state.map.get(t.x, t.y) === Tile.Wall);
    // Anciennes parties : le coffre de l'alcôve de la nichée disparaît (il bloquait le retour par l'escalier).
    if (state.boss && (state.map.get(state.boss.chest.x, state.boss.chest.y) === Tile.Chest || state.map.get(state.boss.chest.x, state.boss.chest.y) === Tile.ChestOpen)) state.map.set(state.boss.chest.x, state.boss.chest.y, Tile.Floor);
    // Première arrivée au premier étage d'une nouvelle section : le texte d'arrivée (Thomas, 2026-11-15).
    const per = RULES.floorsPerSection;
    if (depth > this.deepest && depth > 1 && (depth - 1) % per === 0) this.events.push({ type: "sectionIntro", section: (depth - 1) / per + 1 });
    this.deepest = Math.max(this.deepest, depth);
    this.map = state.map;
    this.rng = state.rng;
    this.rooms = state.rooms;
    this.torches = state.torches;
    this.explored = state.explored;
    this.sensed = state.sensed;
    this.seenMonsters = state.seenMonsters;
    this.monsters = state.monsters;
    this.ground = state.ground;
    this.debris = state.debris.filter((d) => d.until > this.turn);
    this.refreshLight();
  }

  // ---------- Sauvegarde ----------

  /** Toute la partie sous forme de simples données, à écrire sur l'appareil. */
  snapshot(): SaveData {
    // L'étage courant travaille sur des copies vivantes : on les range d'abord dans son état.
    this.current.monsters = this.peaceful ? [...this.monsters, ...this.peacefulStash] : this.monsters;
    this.current.ground = this.ground;
    this.current.debris = this.debris;
    const floors: SavedFloor[] = [...this.floors.entries()].map(([depth, f]) => ({
      depth,
      width: f.map.width,
      height: f.map.height,
      tiles: bytesToText(f.map.tiles),
      start: f.start,
      stairs: f.stairs,
      rooms: f.rooms,
      torches: f.torches,
      monsters: f.monsters,
      ground: f.ground,
      debris: f.debris,
      blood: f.blood,
      explored: bytesToText(f.explored),
      sensed: bytesToText(f.sensed),
      rng: f.rng.getState(),
      seenMonsters: [...f.seenMonsters],
      population: f.population,
      nextRespawn: f.nextRespawn,
      alarm: f.alarm,
      alarmStage: f.alarmStage,
      rested: f.rested,
      rests: f.rests,
      brawls: f.brawls,
      secrets: f.secrets,
      traps: f.traps,
      searched: [...f.searched],
      furniture: f.furniture,
      themes: f.themes,
      motifs: f.motifs,
      boss: f.boss,
      merchant: f.merchant,
      counter: f.counter,
      gluck: f.gluck,
      soeur: f.soeur,
      krik: f.krik,
      bath: f.bath,
      chicken: f.chicken,
      farmChicken: f.farmChicken,
      farm: f.farm,
        zone: f.zone,
        cierges: f.cierges,
        grates: f.grates,
        goldHen: f.goldHen,
        grum: f.grum,
        fifrelin: f.fifrelin,
        morillon: f.morillon,
        vernis: f.vernis,
        fakeWalls: f.fakeWalls,
        hush: f.hush,
        niche: f.niche,
        maestro: f.maestro,
        plumeau: f.plumeau,
        clavicule: f.clavicule,
        osselet: f.osselet,
        restful: f.restful,
        nights: f.nights,
        moonFlashes: f.moonFlashes,
        courier: f.courier,
        secretRoom: f.secretRoom,
        look: f.look,
        mossBurnt: f.mossBurnt,
        goldChest: f.goldChest,
    }));
    return clone({
      version: SAVE_VERSION,
      savedAt: new Date(0).toISOString(), // l'heure est mise par l'affichage (la logique ne lit pas l'horloge)
      runSeed: this.runSeed,
      race: this.race.id,
      heroClass: this.heroClass.id,
      sandbox: this.sandbox,
      sandboxSection: this.sandbox ? this.sandboxSection : undefined,
      testRun: this.testRun || undefined,
      depth: this.depth,
      deepest: this.deepest,
      uniques: [...this.uniques],
      turn: this.turn,
      hero: this.hero,
      bag: this.inventory.snapshot(),
      equipment: this.equipment,
      gold: this.gold,
      xp: this.xp,
      level: this.level,
      points: this.points,
      alloc: this.alloc,
      voie: this.voie,
      skills: [],
      ranks: this.ranks,
      floorPerks: this.floorPerks,
      weaponPoison: this.weaponPoison,
      hasteTurns: this.hasteTurns,
      urchinTurns: this.urchinTurns,
      stoneTurns: this.stoneTurns,
      restHidden: this.restHidden,
      gluck: this.gluckMemory,
      soeur: this.soeurMemory,
      krik: this.krikMemory,
      grum: this.grumMemory,
      fifrelin: this.fifrelinMemory,
      morillon: this.morillonMemory,
      vernis: this.vernisMemory,
      maestro: this.maestroMemory,
      plumeau: this.plumeauMemory,
      clavicule: this.claviculeMemory,
      osselet: this.osseletMemory,
      quest: this.quest,
      xpCarry: this.xpCarry,
      blessings: { protect: this.protectTurns, clarity: this.clarityDepth, curse: this.curseDepth, luck: this.luck },
      blessTurns: this.blessTurns,
      quickItem: this.quickItem,
      fires: this.fires,
      gas: this.gas,
      fog: this.fog,
      bagSize: { cols: this.inventory.cols, rows: this.inventory.rows },
      torchTurns: this.torchTurns,
      torchOff: this.torchOff,
      sandboxLayout: this.sandbox ? SANDBOX_LAYOUT : undefined,
      clock: this.clock,
      ammoChoice: this.ammoChoice,
      heroMisses: this.heroMisses,
      bossKills: this.bossKills,
      hidden: this.hidden,
      nextId: this.nextId,
      lastFoeId: this.lastFoeId,
      failedDoorAttempts: [...this.failedDoorAttempts],
      floors,
    });
  }

  /** Recrée une partie à partir d'une sauvegarde ; `null` si elle est illisible ou d'une ancienne version. */
  static restore(data: SaveData): Game | null {
    if (!data || data.version !== SAVE_VERSION) return null;
    if (data.sandbox && data.sandboxLayout !== SANDBOX_LAYOUT) return null;
    const race = (RACES as Record<string, RaceDef>)[data.race];
    const heroClass = (CLASSES as Record<string, ClassDef>)[data.heroClass];
    if (!race || !heroClass || !data.floors.some((f) => f.depth === data.depth)) return null;
    if (data.sandbox) setSandboxSection(data.sandboxSection === 2 ? 2 : 1);
    const game = new Game(data.runSeed, race, heroClass, DEFAULT_FLOOR, data.sandbox);
    const saved = clone(data);
    game.floors.clear();
    for (const f of saved.floors) {
      const map = new GameMap(f.width, f.height);
      map.tiles.set(textToBytes(f.tiles));
      game.floors.set(f.depth, {
        map,
        start: f.start,
        stairs: f.stairs,
        rooms: f.rooms,
        torches: f.torches,
        monsters: f.monsters,
        ground: f.ground,
        debris: f.debris,
        blood: f.blood ?? [],
        explored: textToBytes(f.explored),
        sensed: textToBytes(f.sensed),
        rng: Rng.fromState(f.rng),
        seenMonsters: new Set(f.seenMonsters),
        population: f.population,
        nextRespawn: f.nextRespawn,
        alarm: f.alarm ?? 0,
        alarmStage: f.alarmStage ?? 0,
        rested: f.rested,
        rests: f.rests,
        brawls: f.brawls,
        secrets: f.secrets,
        traps: f.traps,
        searched: new Set(f.searched),
        // La draperie pliée des salles au trésor est retirée (Thomas, 2026-11-17) : les anciennes sauvegardes la perdent.
        furniture: (f.furniture ?? []).filter((o) => o.kind !== "drapPlie"),
        themes: f.themes ?? [],
        motifs: f.motifs ?? [],
        boss: f.boss,
        merchant: f.merchant,
        counter: f.counter,
        gluck: f.gluck,
        soeur: f.soeur,
        krik: f.krik,
        bath: f.bath,
        chicken: f.chicken,
        farmChicken: f.farmChicken,
        farm: f.farm,
        zone: f.zone,
        cierges: f.cierges,
        grates: f.grates,
        goldHen: f.goldHen,
        grum: f.grum,
        fifrelin: f.fifrelin,
        morillon: f.morillon,
        vernis: f.vernis,
        fakeWalls: f.fakeWalls,
        hush: f.hush,
        niche: f.niche,
        maestro: f.maestro,
        plumeau: f.plumeau,
        clavicule: f.clavicule,
        osselet: f.osselet,
        restful: f.restful,
        nights: f.nights,
        moonFlashes: f.moonFlashes,
        courier: f.courier,
        secretRoom: f.secretRoom,
        look: f.look,
        mossBurnt: f.mossBurnt,
        goldChest: f.goldChest,
      });
    }
    game.turn = saved.turn;
    game.testRun = !!saved.testRun;
    game.hero = saved.hero;
    game.inventory.restore(saved.bag);
    game.equipment = saved.equipment;
    game.gold = saved.gold;
    game.xp = saved.xp;
    game.level = saved.level;
    game.points = saved.points;
    game.alloc = { intelligence: 0, charisme: 0, ...saved.alloc };
    // La voie verte a été retirée : une ancienne partie qui l'avait prise peut choisir à nouveau.
    game.voie = saved.voie && saved.voie in PATHS ? (saved.voie as PathId) : null;
    // Voies à rangs (2026-11-11) : une ancienne partie garde ses pouvoirs au rang 1.
    const known = (id: string) => game.voie !== null && [PATHS[game.voie].main, ...PATHS[game.voie].secondaries, ...PATHS[game.voie].tier2].some((pw) => pw.id === id);
    game.ranks = {};
    // Récupération est devenue Esquive ; deux rangs au plus depuis le 2026-11-13 (les points en trop reviennent).
    if (saved.ranks) for (const [old, r] of Object.entries(saved.ranks)) {
      const id = old === "recuperation" ? "esquive" : old;
      if (known(id)) game.ranks[id as PowerId] = Math.min(game.maxRank(id as PowerId), r ?? 0);
    }
    else if (game.voie) {
      game.ranks[PATHS[game.voie].main.id] = 1;
      for (const id of saved.skills) if (known(id)) game.ranks[id as PowerId] = 1;
    }
    game.floorPerks = {};
    for (const [d, pk] of Object.entries(saved.floorPerks ?? {})) {
      const old = pk as unknown as { secondWind: boolean | number; doubleStrikes: number; lastStand: boolean | number; chainRefunds?: number; luckyDie?: number; stubborn?: number; hurt?: number; kills?: number; left?: number };
      game.floorPerks[Number(d)] = { secondWind: Number(old.secondWind), doubleStrikes: old.doubleStrikes, lastStand: Number(old.lastStand), chainRefunds: old.chainRefunds ?? 0, luckyDie: old.luckyDie ?? 0, stubborn: old.stubborn ?? 0, hurt: old.hurt ?? 0, kills: old.kills ?? 0, left: old.left ?? 0 };
    }
    game.weaponPoison = saved.weaponPoison;
    game.hasteTurns = saved.hasteTurns;
    game.urchinTurns = saved.urchinTurns ?? 0;
    game.stoneTurns = saved.stoneTurns ?? 0;
    game.restHidden = saved.restHidden ?? 0;
    // Comme dans la partie d'origine : la lumière des torches posées au sol est déjà à jour.
    game.lastGroundTorches = game.ground.filter((g) => g.item === "torche").length;
    game.gluckMemory = saved.gluck ?? { met: 0, mood: 0, invested: 0 };
    game.blessTurns = saved.blessTurns ?? 0;
    game.soeurMemory = saved.soeur ?? { met: 0 };
    game.krikMemory = saved.krik ?? { met: 0 };
    game.grumMemory = saved.grum ?? { met: 0 };
    game.fifrelinMemory = saved.fifrelin ?? { met: 0 };
    game.morillonMemory = saved.morillon ?? { met: 0 };
    game.vernisMemory = saved.vernis ?? { met: 0 };
    game.maestroMemory = saved.maestro ?? { met: 0 };
    game.plumeauMemory = saved.plumeau ?? { met: 0 };
    game.claviculeMemory = saved.clavicule ?? { met: 0 };
    game.osseletMemory = saved.osselet ?? { met: 0 };
    game.quest = saved.quest && QUEST_TASKS[saved.quest.id] ? saved.quest : null;
    game.xpCarry = saved.xpCarry ?? 0;
    game.protectTurns = saved.blessings?.protect ?? 0;
    game.clarityDepth = saved.blessings?.clarity ?? 0;
    game.curseDepth = saved.blessings?.curse ?? 0;
    game.luck = saved.blessings?.luck ?? 0;
    game.quickItem = saved.quickItem ?? null;
    game.inventory.cols = saved.bagSize.cols;
    game.inventory.rows = saved.bagSize.rows;
    game.torchTurns = saved.torchTurns ?? 0;
    game.torchOff = saved.torchOff ?? false;
    game.clock = saved.clock ?? 0;
    game.ammoChoice = ((saved.ammoChoice ?? "fleche") in ITEMS ? saved.ammoChoice : "fleche") as ItemId;
    game.heroMisses = saved.heroMisses;
    game.bossKills = saved.bossKills ?? 0;
    game.nextId = saved.nextId;
    game.lastFoeId = saved.lastFoeId;
    game.failedDoorAttempts = new Set(saved.failedDoorAttempts);
    game.events = [];
    // L'étage le plus profond d'abord : sinon reprendre une partie en section 2 rejouait son texte d'arrivée (Thomas).
    game.deepest = saved.deepest;
    game.uniques = new Set(saved.uniques ?? []);
    // Les PV max de l'amulette sont déjà dans la sauvegarde : ne pas les rajouter.
    game.gearHp = game.gear("bonusHp");
    trackUniques(game.uniques);
    game.useFloor(game.floors.get(saved.depth)!, saved.depth);
    game.deepest = Math.max(game.deepest, saved.depth);
    game.fires = saved.fires;
    game.gas = saved.gas ?? [];
    game.fog = saved.fog ?? [];
    game.refreshStats();
    game.hidden = saved.hidden;
    // D'où chacun venait (fromX, prevX) reste celui de la sauvegarde : il compte pour l'embuscade du tour suivant (sinon
    // une partie reprise donnait l'avantage là où l'originale ne le donnait pas).
    // La vue est recalculée, mais les monstres « déjà vus » restent ceux de la sauvegarde : sinon un monstre entré dans
    // le champ pendant le dernier tour serait noté vu ici et pas dans la partie d'origine (la suite différait).
    game.rescueHero();
    const seen = new Set(game.seenMonsters);
    game.updateVision();
    game.seenMonsters.clear();
    for (const id of seen) game.seenMonsters.add(id);
    return game;
  }

  // ---------- Consultation ----------

  monsterAt(x: number, y: number): Actor | undefined {
    return this.monsters.find((m) => occupies(m, x, y));
  }

  private actorAt(x: number, y: number): Actor | undefined {
    return this.hero.x === x && this.hero.y === y ? this.hero : this.monsterAt(x, y);
  }

  isVisible(x: number, y: number): boolean {
    return this.map.inBounds(x, y) && this.visible[this.map.index(x, y)] === 1;
  }

  isExplored(x: number, y: number): boolean {
    return this.map.inBounds(x, y) && this.explored[this.map.index(x, y)] === 1;
  }

  /** Case connue du joueur : déjà vue, ou devinée. */
  isKnown(x: number, y: number): boolean {
    return this.map.inBounds(x, y) && (this.explored[this.map.index(x, y)] === 1 || this.sensed[this.map.index(x, y)] === 1);
  }

  isSensed(x: number, y: number): boolean {
    return this.map.inBounds(x, y) && this.sensed[this.map.index(x, y)] === 1;
  }

  /** Le héros est-il éclairé par une torche ? */
  heroInLight(): boolean {
    return this.light[this.map.index(this.hero.x, this.hero.y)] > 0.15;
  }

  visibleMonsters(): Actor[] {
    return this.monsters.filter((m) => this.actorVisible(m));
  }

  /** On voit au moins une des cases du personnage (la Tisseuse en couvre quatre). */
  actorVisible(m: Actor): boolean {
    if (sizeOf(m) === 1) return this.isVisible(m.x, m.y);
    return cellsOf(m).some((c) => this.isVisible(c.x, c.y));
  }

  // ---------- Équipement ----------

  /** L'arme de mêlée ou à distance en main, s'il y en a une. */
  weapon(kind: "melee" | "ranged"): ItemDef | undefined {
    const item = this.equipment[kind];
    return item ? ITEMS[item.defId] : undefined;
  }

  /** Porte un objet du sac. S'il y avait déjà quelque chose à cet emplacement, il retourne dans le sac. Ne coûte pas de tour. */
  equip(uid: number): boolean {
    const item = this.inventory.get(uid);
    if (!item) return false;
    const kind = ITEMS[item.defId].kind;
    if (kind === "ammo" || kind === "key" || kind === "gold" || kind === "use" || kind === "gem" || kind === "quest") return false;
    if (this.tooLow(ITEMS[item.defId])) return false;
    const previous = this.equipment[kind];
    const from = { x: item.x, y: item.y };
    this.inventory.removeItem(uid);
    // Plus de règle des deux mains (Thomas, 2026-11-15 : « retire la règle des deux mains ») : l'arc reste porté.
    if (kind === "bag") {
      // Un sac : le sac change de taille ; ce qu'il contient doit tenir dans le nouveau.
      const def = ITEMS[item.defId] as ItemDef;
      const before = { cols: this.inventory.cols, rows: this.inventory.rows };
      if (!this.inventory.resize(def.bagCols ?? 6, def.bagRows ?? 4)) {
        this.inventory.resize(before.cols, before.rows);
        item.x = from.x;
        item.y = from.y;
        this.inventory.items.push(item);
        return false;
      }
      if (previous && !this.inventory.placeItem(previous)) this.bounceFromHero(previous.defId, previous.count);
      this.equipment.bag = item;
      return true;
    }
    // Pas de place pour ranger l'ancien : il rebondit au sol (Thomas).
    if (previous && !this.inventory.placeItem(previous)) this.bounceFromHero(previous.defId, previous.count);
    this.equipment[kind] = item;
    this.refreshStats();
    return true;
  }

  /** Retire ce qui est porté à cet emplacement et le range dans le sac, s'il y a de la place. */
  unequip(slot: Slot): boolean {
    // Le sac ne s'enlève pas : on le remplace par un autre.
    if (slot === "bag") return false;
    const item = this.equipment[slot];
    if (!item) return false;
    if (!this.inventory.placeItem(item)) this.bounceFromHero(item.defId, item.count);
    this.equipment[slot] = null;
    this.refreshStats();
    return true;
  }

  /** L'attaque du héros vient de son arme de mêlée (ou de ses poings), sa classe d'armure de son armure. */
  private refreshStats(): void {
    const melee = this.weapon("melee");
    const blessed = this.blessTurns > 0 ? RULES.blessBonus : 0;
    this.hero.attackBonus = (melee?.attackBonus ?? UNARMED.attackBonus) + blessed + this.gear("bonusHit");
    // Chaque point de Force ajoute 1 aux dégâts au contact.
    const base = melee?.damage ?? UNARMED.damage;
    this.hero.damage = { ...base, bonus: base.bonus + this.strength() };
    // Amulette de vitalité : ses PV max s'ajoutent en la mettant, s'enlèvent en l'ôtant (sans jamais tuer).
    const hp = this.gear("bonusHp");
    if (hp !== this.gearHp) {
      const diff = hp - this.gearHp;
      this.gearHp = hp;
      this.hero.maxHp += diff;
      this.hero.hp = diff > 0 ? this.hero.hp + diff : Math.max(1, Math.min(this.hero.hp, this.hero.maxHp));
    }
    const armor = this.equipment.armor;
    // Classe d'armure : l'armure, le casque, la peau dure, et l'ESQUIVE (Thomas, 2026-11-11 : +1 tous les 2 points
    // d'agilité).
    const hat = this.equipment.hat;
    this.hero.armorClass =
      ((armor && (ITEMS[armor.defId] as ItemDef).armorClass) || UNARMORED_AC) +
      ((hat && (ITEMS[hat.defId] as ItemDef).acBonus) || 0) +
      this.rank("peau_dure") +
      Math.floor(this.agility() / RULES.agilityPerDodge) +
      blessed +
      (this.protectTurns > 0 ? SOEUR.protectBonus : 0);
  }

  /** Ce que l'équipement porté ajoute (amulettes) : PV max, Force, Agilité, jet d'attaque. */
  gear(field: "bonusHp" | "bonusForce" | "bonusAgility" | "bonusHit"): number {
    return Object.values(this.equipment).reduce((n, it) => n + ((it && (ITEMS[it.defId] as ItemDef)[field]) || 0), 0);
  }
  /** Les PV max déjà ajoutés par l'équipement (pour ne les compter qu'une fois). */
  gearHp = 0;
  /** Force : les points placés, plus l'équipement (amulette de force). */
  strength(): number {
    return this.alloc.force + this.race.force + this.gear("bonusForce");
  }

  /** Vrai si le héros n'a pas encore le niveau demandé par l'objet. */
  tooLow(def: ItemDef): boolean {
    return (def.level ?? 1) > this.level;
  }

  /** Salle d'essai : réveille tous les monstres de l'étage, qui foncent sur le héros (pour tester les combats vite). */
  wakeAll(): void {
    for (const m of this.monsters) {
      m.asleep = false;
      m.alerted = true;
      m.patrol = undefined;
      m.goal = undefined;
    }
    this.reveal();
  }

  /** Salle d'essai : gagner tout de suite le niveau suivant. */
  levelUpNow(): void {
    if (this.over) return;
    this.gainXp(this.xpToNext() - this.xp, true);
  }

  // ---------- Torche, objets à utiliser ----------

  /** La lumière des torches et cheminées de l'étage, plus celle de la torche portée par le héros. */
  private lightVersion = -1;

  private refreshLight(): void {
    const carried = this.torchLit() ? [{ x: this.hero.x, y: this.hero.y, faceX: 0, faceY: 0, radius: RULES.torchRadius }] : [];
    // Une torche posée au sol brille un peu, comme celles des murs (Thomas).
    const dropped = (this.ground ?? []).filter((g) => g.item === "torche" && this.map.get(g.x, g.y) !== Tile.Water).map((g) => ({ x: g.x, y: g.y, faceX: 0, faceY: 0, radius: RULES.groundTorchRadius }));
    // Une torche ou une cheminée n'éclaire que la salle où elle est accrochée (Thomas, 2026-11-12 : « que du côté où
    // elle est placée, pas de l'autre côté du mur ») : ni le couloir derrière le mur, ni à travers une porte.
    const fixed = this.torches.map((t) => {
      const fx = t.x + t.faceX;
      const fy = t.y + t.faceY;
      const area = this.rooms.find((r) => fx >= r.x && fy >= r.y && fx < r.x + r.w && fy < r.y + r.h);
      return area ? { ...t, area } : t;
    });
    // La bougie de la zone de quête : une petite lueur dans sa pièce.
    const z = this.current?.zone;
    const candle = z?.candleLit && z.candle ? [{ x: z.candle.x, y: z.candle.y, faceX: 0, faceY: 0, radius: 3, area: z.room }] : [];
    // Toutes les bougies du décor éclairent un peu leur salle (Thomas, 2026-11-14) : la table du dortoir, la table basse
    // du bain, les candélabres de la chapelle (selon leurs bougies), le grimoire de l'alchimiste.
    for (const f of this.current?.furniture ?? []) {
      const radius0 = f.kind === "alambic" ? (f.drained ? 0 : 2) : CANDLE_LIGHT[f.kind] ?? (f.kind.startsWith("table") ? CANDLE_LIGHT.table : f.kind.startsWith("lueurs") ? 2 : 0);
      // Section 2 : les champignons lumineux d'une salle bruyante se referment quelques tours.
      const radius = radius0 > 0 && /^(lueurs|champiG|champiC)/.test(f.kind) && this.mushHushed(f.x, f.y) ? 0 : radius0;
      if (!radius) continue;
      const cx = f.x + ((FURNITURE_KINDS[f.kind]?.w ?? 1) > 1 ? 1 : 0);
      const area = this.rooms.find((r) => cx >= r.x && cx < r.x + r.w && f.y >= r.y && f.y < r.y + r.h);
      if (area) candle.push({ x: cx, y: f.y, faceX: 0, faceY: 0, radius, area });
    }
    if (this.chickenLight) candle.push({ x: this.chickenLight.x, y: this.chickenLight.y, faceX: 0, faceY: 0, radius: RULES.chickenGlowRadius + 1, area: { x: this.chickenLight.x - 3, y: this.chickenLight.y - 3, w: 7, h: 7 } });
    // Les cierges rallumés de Sœur Osseuse.
    for (const f of this.current?.furniture ?? []) if (f.kind === "ciergeLit") candle.push({ x: f.x, y: f.y, faceX: 0, faceY: 0, radius: 2, area: this.rooms.find((r) => f.x >= r.x && f.x < r.x + r.w && f.y >= r.y && f.y < r.y + r.h) ?? z?.room ?? { x: f.x, y: f.y, w: 1, h: 1 } });
    // Quête en cours (Thomas, 2026-11-14 : « éclaire la zone autour du PNJ, pour éviter de le perdre ») : le PNJ qui
    // l'a donnée brille doucement, on le retrouve de loin.
    const giver = this.quest && this.current ? this.npc(QUEST_TASKS[this.quest.id].npc) : null;
    if (giver) candle.push({ x: giver.x, y: giver.y, faceX: 0, faceY: 0, radius: RULES.questNpcLight, area: this.rooms.find((r) => giver.x >= r.x && giver.x < r.x + r.w && giver.y >= r.y && giver.y < r.y + r.h) ?? { x: giver.x - 1, y: giver.y - 1, w: 3, h: 3 } });
    // Le Carillon luit (ses taches et son battant) : sa grotte se voit, on voit venir le coup.
    const bell = this.monsters.find((m) => m.defId === "carillon");
    // Ossuaire : les puits de lune, seule lumière de la section (Thomas, 2026-11-19).
    for (const f of this.current?.furniture ?? []) if (f.kind === "moonWell") candle.push({ x: f.x, y: f.y, faceX: 0, faceY: 0, radius: f.variant === "boss" ? this.bossWellRadius() + 1 : RULES.moonRadius, area: moonArea(this, f) });
    for (const f of this.current?.moonFlashes ?? []) candle.push({ x: f.x, y: f.y, faceX: 0, faceY: 0, radius: 3, area: { x: f.x - 2, y: f.y - 2, w: 5, h: 5 } });
    const lair = this.current?.boss?.lair;
    if (bell && lair) candle.push({ x: bell.x + 1, y: bell.y + 3, faceX: 0, faceY: 0, radius: 8, area: lair });
    this.light = computeLight(this.map, [...fixed, ...carried, ...dropped, ...candle]);
    this.lightVersion = this.map.version;
  }


  /** Peut-on mettre cet objet en raccourci ? Les objets qu'on consomme, boit ou lance (pomme, torche, potions). */
  canQuick(id: ItemId): boolean {
    return (ITEMS[id] as ItemDef).kind === "use";
  }

  /** Choisir le raccourci « Objet » (ou le retirer en rechoisissant le même). Ne prend pas de tour. */
  setQuickItem(id: ItemId | null): void {
    this.quickItem = id && this.canQuick(id) ? id : null;
  }

  /** Le tas du sac qui sert au raccourci, s'il en reste. */
  quickStack(): { uid: number; count: number } | null {
    if (!this.quickItem) return null;
    const items = this.inventory.items.filter((i) => i.defId === this.quickItem);
    if (items.length === 0) return null;
    return { uid: items[0].uid, count: items.reduce((n, i) => n + i.count, 0) };
  }

  /** Utiliser un objet du sac (pomme, torche) : prend un tour. Renvoie faux si ce n'est pas possible. */
  useItem(uid: number): boolean {
    const item = this.inventory.get(uid);
    if (this.over || !item) return false;
    const def = ITEMS[item.defId] as ItemDef;
    // La potion de feu ne se boit pas : elle se lance. (Celle de poison s'enduit OU se lance.)
    if (def.kind !== "use" || this.tooLow(def) || def.bomb || def.holy || def.potion === "fire" || def.potion === "smoke" || def.potion === "fog" || def.potion === "discord" || def.potion === "slip") return false;
    if (def.heal && this.hero.hp >= this.hero.maxHp) return false;
    this.wait();
    this.waiting = false;
    this.useOrder = uid;
    return true;
  }

  private resolveUse(uid: number): void {
    const item = this.inventory.get(uid);
    if (!item) return;
    const def = ITEMS[item.defId] as ItemDef;
    if (!this.inventory.take(item.defId, 1)) return;
    if (def.heal) {
      const before = this.hero.hp;
      // GOURMAND (Halfelin) : toute nourriture rend quelques PV de plus.
      this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + def.heal + this.race.foodBonus);
      this.events.push({ type: "used", item: item.defId, healed: this.hero.hp - before });
    }
    if (def.potion === "youth") {
      // Jouvence : tous les points placés reviennent, plus un ; la voie ne change pas.
      this.hero.maxHp -= this.alloc.vie * RULES.hpPerVie;
      this.hero.hp = Math.min(this.hero.hp, this.hero.maxHp);
      this.points += Object.values(this.alloc).reduce((a, b) => a + b, 0) + 1;
      this.alloc = { vie: 0, force: 0, agilite: 0, intelligence: 0, charisme: 0 };
      this.refreshStats();
      this.events.push({ type: "potion", potion: "youth", points: this.points });
    } else if (def.potion === "poison") {
      this.weaponPoison = RULES.weaponPoisonHits;
      this.events.push({ type: "potion", potion: "poison" });
    } else if (def.potion === "haste") {
      // +1 : le tour où on la boit ne compte pas.
      this.hasteTurns = RULES.hasteTurns + 1;
      this.events.push({ type: "potion", potion: "haste" });
    } else if (def.potion === "stone") {
      // Bue : statue (Thomas, 2026-11-13) ; les monstres perdent sa trace.
      this.stoneTurns = RULES.stoneTurns;
      for (const m of this.monsters) if (!m.boss) { m.alerted = false; m.wary = false; }
      this.events.push({ type: "potion", potion: "stone" });
    } else if (def.potion === "night") {
      this.current.nights = [...(this.current.nights ?? []).filter((n) => !n.hero), { x: this.hero.x, y: this.hero.y, turns: 11, hero: true }];
      this.events.push({ type: "potion", potion: "night" });
    } else if (def.potion === "frost") {
      // Bue (Thomas, 2026-11-19) : un souffle glacé part du héros ; tout ce qui le touche (8 cases voisines) gèle.
      const cells: Point[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && this.map.isWalkable(this.hero.x + dx, this.hero.y + dy)) cells.push({ x: this.hero.x + dx, y: this.hero.y + dy });
      this.events.push({ type: "potion", potion: "frost" });
      this.freezeCells(cells);
    } else if (def.potion === "grow") {
      // +1 : le tour où on la boit ne compte pas.
      this.hero.grown = RULES.growTurns + 1;
      this.events.push({ type: "potion", potion: "grow" });
      this.events.push({ type: "grow", actor: this.hero });
    } else if (def.potion === "urchin") {
      this.urchinTurns = RULES.urchinTurns + 1;
      this.events.push({ type: "potion", potion: "urchin" });
    }
    if (def.lightTurns) {
      this.torchBefore = this.visible ? this.visible.slice() : null;
      this.torchTurns = def.lightTurns;
      this.torchOff = false;
      this.refreshLight();
      this.events.push({ type: "used", item: item.defId });
      // On ne se cache pas une torche à la main.
      this.reveal();
    }
  }

  /** Jeter un objet du sac : il tombe aux pieds du héros (sans prendre de tour). Le sac porté ne se jette pas. */
  dropFromBag(uid: number, count?: number): boolean {
    const item = this.inventory.get(uid);
    if (!item || this.over) return false;
    // Une pile : on n'en jette que `count` (Thomas, 2026-11-13 : « on doit choisir combien ») ; le reste reste au sac.
    const n = Math.max(1, Math.min(count ?? item.count, item.count));
    if (n < item.count) item.count -= n;
    else this.inventory.removeItem(uid);
    // Une potion jetée se casse sur les dalles, à côté du héros (Thomas, 2026-11-12) : elle est perdue, et son contenu
    // se répand sur la case : le feu y prend, le poison y fait un petit nuage (3 tours) ; les autres s'évaporent.
    const potion = (ITEMS[item.defId] as ItemDef).potion;
    if (potion) {
      const at = this.landingCell(this.hero, item.defId);
      if (potion === "fire" && this.map.get(at.x, at.y) !== Tile.Water) {
        const old = this.fires.find((f) => f.x === at.x && f.y === at.y);
        if (old) old.turns = RULES.fireTurns;
        else this.fires.push({ x: at.x, y: at.y, turns: RULES.fireTurns });
        this.igniteFurniture();
      }
      if (potion === "poison") {
        const old = this.gas.find((g) => g.x === at.x && g.y === at.y);
        if (old) old.turns = Math.max(old.turns, RULES.brokenPoisonGasTurns);
        else this.gas.push({ x: at.x, y: at.y, turns: RULES.brokenPoisonGasTurns });
        this.gasPoison();
      }
      if (potion === "smoke") this.smokeBurst(at, 1);
      if (potion === "frost") this.freezeCells([at]);
      if (potion === "fog") this.spreadFog(at, 1);
      // Une flaque de sa couleur reste au sol (Thomas, 2026-11-12).
      if (this.map.get(at.x, at.y) !== Tile.Water) this.stain(at.x, at.y, POTION_STAIN[potion] ?? "pYouth");
      this.events.push({ type: "shatter", item: item.defId, potion, fromX: this.hero.x, fromY: this.hero.y, x: at.x, y: at.y });
      return true;
    }
    this.dropItem(this.hero.x, this.hero.y, item.defId, n);
    this.events.push({ type: "dropped", item: item.defId, count: n });
    return true;
  }

  /** Les munitions présentes dans le sac : celles de l'arc (ordinaires d'abord), puis ce qui se lance à la main (javelines). */
  ammoKinds(): ItemId[] {
    const family = this.weapon("ranged")?.ammo;
    return (Object.keys(ITEMS) as ItemId[]).filter((id) => {
      const f = (ITEMS[id] as ItemDef).ammoFamily;
      return (f === "jet" || (!!family && f === family)) && (this.inventory.count(id) > 0 || this.endlessAmmo(id));
    });
  }

  /** CARQUOIS SANS FOND (Elfe ; Thomas, 2026-11-17 : « passe les flèches simples en illimité pour l'Elfe ») : arc en
   *  main, ses flèches simples ne s'épuisent pas ; elles ne restent pas au sol après le tir (plus de ramassage). */
  endlessAmmo(id: ItemId | null): boolean {
    return !!this.race.endlessArrows && id === "fleche" && this.weapon("ranged")?.ammo === "fleche";
  }

  /** Le tir qui partira : portée et bonus au jet viennent de l'arc, ou de la javeline si on la lance à la main. */
  shotProfile(): { range: number; attackBonus: number; thrown: boolean } | null {
    const ammo = this.currentAmmo();
    if (!ammo) return null;
    const def = ITEMS[ammo] as ItemDef;
    if (def.ammoFamily === "jet") return { range: def.range ?? 0, attackBonus: def.attackBonus ?? 0, thrown: true };
    const bow = this.weapon("ranged");
    return bow ? { range: bow.range ?? 0, attackBonus: bow.attackBonus ?? 0, thrown: false } : null;
  }

  /** Choisir les flèches à tirer. Refusé si le héros n'a pas le niveau. */
  chooseAmmo(id: ItemId): boolean {
    const def = ITEMS[id] as ItemDef;
    if (def.kind !== "ammo" || this.tooLow(def)) return false;
    this.ammoChoice = id;
    return true;
  }

  /** La munition qui partira au prochain tir : le choix du joueur s'il en reste, sinon la flèche ordinaire. */
  currentAmmo(): ItemId | null {
    const family = this.weapon("ranged")?.ammo;
    const chosen = ITEMS[this.ammoChoice] as ItemDef;
    const usable = (id: ItemId) => !this.tooLow(ITEMS[id] as ItemDef) && (this.inventory.count(id) > 0 || this.endlessAmmo(id));
    if ((chosen.ammoFamily === "jet" || (!!family && chosen.ammoFamily === family)) && usable(this.ammoChoice)) return this.ammoChoice;
    if (family && (this.inventory.count(family as ItemId) > 0 || this.endlessAmmo(family as ItemId))) return family as ItemId;
    // Sans arc (ou sans flèches) : on peut encore lancer une javeline.
    return this.ammoKinds().find((id) => (ITEMS[id] as ItemDef).ammoFamily === "jet" && usable(id)) ?? null;
  }

  // ---------- Points, voie, compétences ----------

  /** Ce qui ne sert qu'un nombre limité de fois sur l'étage courant. */
  perks(): FloorPerks {
    return (this.floorPerks[this.depth] ??= { secondWind: 0, doubleStrikes: this.doubleStrikeUses(), lastStand: 0, chainRefunds: 0 });
  }

  /** Rang d'un pouvoir (0 si on ne l'a pas). */
  rank(id: PowerId): number {
    return this.ranks[id] ?? 0;
  }

  /** Second souffle : PV rendus et fois par étage, selon le rang. */
  secondWindHeal(): number {
    return RULES.secondWindHeal[Math.max(0, this.rank("second_souffle") - 1)];
  }
  secondWindUses(): number {
    // Équilibrage des voies (2026-11-13) : une fois par étage à tous les rangs (deux au rang 3 rendait la voie bleue trop forte).
    return 1;
  }
  /** Double frappe : fois par étage selon le rang (2, 3, 4 ; équilibrage du 2026-11-13). */
  doubleStrikeUses(): number {
    const r = this.rank("double_frappe");
    return r > 0 ? r + RULES.doubleStrikeBonus : 0;
  }

  /** Place un point dans une caractéristique (ne prend pas de tour). */
  /** Charisme : les points placés, plus ce que donne l'équipement (nœud papillon). */
  charisma(): number {
    return this.alloc.charisme + this.race.charisme + Object.values(this.equipment).reduce((n, it) => n + ((it && (ITEMS[it.defId] as ItemDef).charisma) || 0), 0);
  }

  allocate(stat: StatId): boolean {
    if (this.points <= 0 || this.over || this.inCombat()) return false;
    this.points--;
    this.alloc[stat]++;
    if (stat === "vie") {
      this.hero.maxHp += RULES.hpPerVie;
      this.hero.hp += RULES.hpPerVie;
    }
    this.refreshStats();
    return true;
  }

  /** Bonus du héros pour pousser, se dégager, se cacher, fouiller, tirer : classe + points + compétences. */
  pushBonus(): number {
    return this.heroClass.pushBonus + this.strength();
  }
  /** Agilité : les points placés, plus Esquive (voie bleue : +2, puis +4). */
  agility(): number {
    return this.alloc.agilite + this.race.agilite + [0, 2, 4][this.rank("esquive")] + this.gear("bonusAgility");
  }

  disengageBonus(): number {
    return this.heroClass.disengageBonus + this.agility();
  }
  rangedBonus(): number {
    return this.agility() + this.gear("bonusHit");
  }

  /** Peut-on choisir sa voie maintenant ? */
  canChoosePath(): boolean {
    return this.voie === null && this.level >= PATH_LEVEL;
  }

  /** Choisir sa voie : une fois pour toutes. */
  choosePath(id: PathId): boolean {
    if (!this.canChoosePath()) return false;
    this.voie = id;
    this.ranks = { [PATHS[id].main.id]: 1 };
    // La double frappe de l'étage en cours devient disponible tout de suite.
    if (id === "red") this.perks().doubleStrikes = Math.max(this.perks().doubleStrikes, this.doubleStrikeUses());
    this.events.push({ type: "path", path: id });
    return true;
  }

  /** Points de voie à placer : un par niveau après celui où l'on a choisi sa voie (le rang 1 du principal est offert). */
  pathPoints(): number {
    if (!this.voie) return 0;
    const spent = Object.values(this.ranks).reduce((n, r) => n + (r ?? 0), 0) - 1;
    return Math.max(0, this.level - PATH_LEVEL - spent);
  }

  /** Améliorer un pouvoir de sa voie d'un rang (ne prend pas de tour ; pas en plein combat). */
  improve(id: PowerId): boolean {
    if (!this.voie || this.pathPoints() <= 0 || this.inCombat()) return false;
    if (this.improveRefusal(id) !== null) return false;
    this.ranks[id] = this.rank(id) + 1;
    // Une double frappe de plus tout de suite, sur l'étage en cours.
    if (id === "double_frappe") this.perks().doubleStrikes++;
    this.refreshStats();
    return true;
  }

  /** Rang le plus haut de ce pouvoir (4 pour le principal). */
  maxRank(id: PowerId): number {
    return this.voie && PATHS[this.voie].main.id === id ? MAIN_MAX_RANK : MAX_RANK;
  }

  /** Rang II ouvert (niveau 6) : le Rang I ne reçoit plus de point (Thomas, 2026-11-17). */
  tier2Open(): boolean {
    return this.level >= TIER2_LEVEL;
  }
  /** Rang III ouvert (niveau 11) : le Rang II ne reçoit plus de point (Thomas, 2026-11-19). */
  tier3Open(): boolean {
    return this.level >= TIER3_LEVEL;
  }

  /** Pourquoi on ne peut pas monter ce pouvoir maintenant (hors points et combat) : rang I gelé, rang II fermé, max. */
  improveRefusal(id: PowerId): "unknown" | "max" | "frozen" | "locked" | null {
    if (!this.voie) return "unknown";
    const path = PATHS[this.voie];
    const r = this.rank(id);
    if (id === path.main.id) {
      if (r >= MAIN_MAX_RANK) return "max";
      // Rangs 1-2 quand on veut, 3-4 avec le Rang II (niveau 6), 5-6 avec le Rang III (niveau 11).
      if (r >= 4 && !this.tier3Open()) return "locked";
      return r >= MAX_RANK && !this.tier2Open() ? "locked" : null;
    }
    if (path.secondaries.some((pw) => pw.id === id)) return r >= MAX_RANK ? "max" : this.tier2Open() ? "frozen" : null;
    if (path.tier2.some((pw) => pw.id === id)) return r >= MAX_RANK ? "max" : !this.tier2Open() ? "locked" : this.tier3Open() ? "frozen" : null;
    if (path.tier3.some((pw) => pw.id === id)) return r >= MAX_RANK ? "max" : this.tier3Open() ? null : "locked";
    return "unknown";
  }

  /** Garde (voie bleue, Rang II) : la classe d'armure monte quand deux ennemis ou plus touchent le héros. */
  guardBonus(): number {
    const r = this.rank("garde");
    if (!this.hero) return 0;
    if (r === 0) return this.stanceBonus();
    const near = this.monsters.filter((m) => m.alerted && m.hp > 0 && this.inReach(m, this.hero)).length;
    return (near >= 2 ? r + 1 : 0) + this.stanceBonus();
  }

  /** Rang III bleu : Sang-froid (sous le quart des PV) et Posture (le héros ne s'est pas déplacé ce tour-ci). */
  stanceBonus(): number {
    if (!this.hero) return 0;
    let ac = 0;
    const cold = this.rank("sang_froid");
    if (cold > 0 && this.hero.hp * 4 <= this.hero.maxHp) ac += cold + 2;
    const post = this.rank("posture");
    if (post > 0 && this.hero.x === this.hero.fromX && this.hero.y === this.hero.fromY) ac += post;
    return ac;
  }

  /** Bastion actif (voie bleue, Rang III). */
  bastionActive(): boolean {
    return this.turn <= this.bastionUntil;
  }

  /** Exécution (voie rouge, Rang III) : l'ennemi au contact le plus entamé sous le seuil (pas un boss ni un morceau). */
  executeTarget(): Actor | null {
    const limit = this.rank("execution") >= 2 ? 0.3 : 0.25;
    const ok = this.visibleMonsters().filter(
      (m) => (this.inReach(this.hero, m) || this.inWeaponReach(m)) && !m.boss && !m.part && m.defId !== "colosse" && m.defId !== "battant" && !this.isInert(m) && m.hp <= m.maxHp * limit,
    );
    return ok.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ?? null;
  }

  /** Encaisseur (voie bleue, Rang II) : moins de dégâts à chaque coup reçu, jamais moins de 1. */
  private absorb(damage: number): number {
    // Bastion (voie bleue, Rang III) : les dégâts reçus sont divisés par deux.
    if (damage > 0 && this.bastionActive()) damage = Math.ceil(damage / 2);
    // Affaibli (Thomas, 2026-11-18 : la voie bleue battait le Carillon deux fois plus souvent que la rouge) : -1 aux
    // deux rangs ; au rang 1 seulement sur les coups de 3 dégâts ou plus, au rang 2 sur tous (jamais moins de 1).
    const r = this.rank("encaisseur");
    if (r === 0 || damage <= 0) return damage;
    return r === 1 ? (damage >= 3 ? damage - 1 : damage) : Math.max(1, damage - 1);
  }

  /** Riposte (voie bleue, Rang II) : un ennemi au contact rate le héros, il frappe aussitôt (une fois par tour). */
  private riposte(m: Actor): void {
    const r = this.rank("riposte");
    // Une riposte tous les deux tours (Thomas, 2026-11-18 ; une par tour avant).
    if (r === 0 || this.over || this.turn - this.ripostedOn < 2 || !this.monsters.includes(m) || !this.inReach(this.hero, m)) return;
    this.ripostedOn = this.turn;
    this.events.push({ type: "power", power: "riposte" });
    this.strikeBonus = r >= 2 ? { hit: 2, damage: 2 } : { hit: 0, damage: 0 };
    this.heroAttacks(m, true);
    this.strikeBonus = { hit: 0, damage: 0 };
  }

  /** Pouvoirs du Rang II qui s'utilisent (voie rouge) : combien il en reste sur l'étage. */
  powerUsesLeft(id: ActivePower): number {
    const r = this.rank(id);
    if (r === 0) return 0;
    const p = this.perks();
    if (id === "tourbillon") return r - (p.whirls ?? 0);
    if (id === "charge") return r + 1 - (p.charges ?? 0);
    if (id === "bastion") return 1 - (p.bastions ?? 0);
    if (id === "execution") return r + 1 - (p.executions ?? 0);
    return 1 - (p.cries ?? 0);
  }

  /** Ennemis au contact (pour le tourbillon). */
  private whirlTargets(): Actor[] {
    return this.visibleMonsters().filter((m) => this.inReach(this.hero, m) || this.inWeaponReach(m));
  }

  /** Charge : l'ennemi visé, à 2 cases (3 au rang 2) en ligne droite, cases libres entre deux ; et la case d'arrivée. */
  chargeTarget(): { target: Actor; to: Point } | null {
    const reach = this.rank("charge") >= 2 ? 3 : 2;
    let best: { target: Actor; to: Point; d: number } | null = null;
    for (const m of this.visibleMonsters()) {
      const dx = m.x - this.hero.x;
      const dy = m.y - this.hero.y;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d < 2 || d > reach || (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy))) continue;
      const sx = Math.sign(dx);
      const sy = Math.sign(dy);
      let x = this.hero.x;
      let y = this.hero.y;
      let ok = true;
      for (let k = 1; k < d; k++) {
        if (!canStep(this.map, x, y, sx, sy)) { ok = false; break; }
        x += sx;
        y += sy;
        if (!this.map.isWalkable(x, y) || this.actorAt(x, y) || this.knownTrap(x, y) || this.isBurning(x, y)) { ok = false; break; }
      }
      if (!ok || !canStep(this.map, x, y, sx, sy)) continue;
      if (!best || d < best.d) best = { target: m, to: { x, y }, d };
    }
    return best ? { target: best.target, to: best.to } : null;
  }

  /** Pourquoi ce pouvoir du Rang II ne peut pas servir maintenant, ou null. */
  powerRefusal(id: ActivePower): "none" | "used" | "no-target" | null {
    if (this.over || this.rank(id) === 0) return "none";
    if (this.powerUsesLeft(id) <= 0) return "used";
    if (id === "tourbillon" && this.whirlTargets().length === 0) return "no-target";
    if (id === "charge" && !this.chargeTarget()) return "no-target";
    if (id === "cri_guerre" && !this.visibleMonsters().some((m) => gapBetween(m, this.hero) <= RULES.warCryRadius)) return "no-target";
    if (id === "execution" && !this.executeTarget()) return "no-target";
    if (id === "bastion" && this.bastionActive()) return "used";
    return null;
  }

  /** Ordre : utiliser un pouvoir du Rang II (un tour). */
  usePower(id: ActivePower): boolean {
    if (this.powerRefusal(id) !== null) return false;
    this.wait();
    this.waiting = false;
    this.skillOrder = -1;
    this.skillPower = id;
    return true;
  }

  private resolvePower(id: ActivePower): void {
    if (this.powerRefusal(id) !== null) return;
    const p = this.perks();
    if (id === "tourbillon") {
      const targets = this.whirlTargets();
      p.whirls = (p.whirls ?? 0) + 1;
      this.events.push({ type: "power", power: "tourbillon", count: targets.length });
      targets.forEach((m, i) => { if (this.monsters.includes(m) && !this.over) this.heroAttacks(m, i > 0); });
    } else if (id === "bastion") {
      p.bastions = (p.bastions ?? 0) + 1;
      this.bastionUntil = this.turn + (this.rank("bastion") >= 2 ? 4 : 3);
      this.events.push({ type: "power", power: "bastion" });
    } else if (id === "execution") {
      const m = this.executeTarget();
      if (!m) return;
      p.executions = (p.executions ?? 0) + 1;
      this.faceToward(this.hero, m);
      this.events.push({ type: "power", power: "execution" });
      m.crush = true;
      m.heroHurt = true;
      m.hp = 0;
      this.events.push({ type: "heavyBlow", actor: m, kind: "oneShot" });
      this.bleed(m, this.hero);
      this.raiseAlarm(RULES.alarmCombat, m);
      this.removeIfDead(m);
    } else if (id === "charge") {
      const c = this.chargeTarget();
      if (!c) return;
      p.charges = (p.charges ?? 0) + 1;
      this.hero.x = c.to.x;
      this.hero.y = c.to.y;
      this.faceToward(this.hero, c.target);
      this.events.push({ type: "power", power: "charge" });
      this.strikeBonus = { hit: this.rank("charge") >= 2 ? 3 : 2, damage: 0 };
      this.heroAttacks(c.target);
      this.strikeBonus = { hit: 0, damage: 0 };
    } else {
      p.cries = (p.cries ?? 0) + 1;
      const turns = this.rank("cri_guerre") >= 2 ? 3 : 2;
      let count = 0;
      let fled = 0;
      for (const m of this.visibleMonsters()) {
        if (gapBetween(m, this.hero) > RULES.warCryRadius) continue;
        count++;
        m.cowed = turns + 1;
        m.alerted = true;
        m.asleep = false;
        // Les plus faibles (pas les boss) peuvent détaler.
        if (!m.boss && m.maxHp <= RULES.warCryWeakHp && this.rng.chance(RULES.warCryFleeChance)) {
          m.fleeTurns = Math.max(m.fleeTurns ?? 0, turns);
          fled++;
        }
      }
      this.raiseAlarm(RULES.alarmCombat, this.hero);
      this.events.push({ type: "power", power: "cri_guerre", count, fled });
    }
  }

  /** Quelque chose attend le joueur dans l'écran du héros (le « ! » doré). */
  hasPendingChoice(): boolean {
    return this.points > 0 || this.canChoosePath() || this.pathPoints() > 0;
  }

  /** La compétence de voie qui s'utilise (bleue, rouge) ; la verte change « pousser ». Pourquoi c'est impossible, ou null. */
  skillRefusal(): "none" | "used" | "full" | "no-target" | "danger" | null {
    if (this.voie === "blue") {
      if (this.perks().secondWind >= this.secondWindUses()) return "used";
      if (this.hero.hp >= this.hero.maxHp) return "full";
      return null;
    }
    if (this.voie === "red") {
      if (this.perks().doubleStrikes <= 0) return "used";
      if (!this.meleeTarget()) return "no-target";
      return null;
    }
    return "none";
  }

  /** Ordre : utiliser la compétence de sa voie (un tour). */
  useSkill(): boolean {
    if (this.over || this.skillRefusal() !== null) return false;
    const target = this.voie === "red" ? this.meleeTarget() : null;
    this.wait();
    this.waiting = false;
    this.skillOrder = target ? target.id : -1;
    return true;
  }

  private resolveSkill(targetId: number): void {
    const power = this.skillPower;
    this.skillPower = null;
    if (power) return this.resolvePower(power);
    if (this.voie === "blue") {
      const before = this.hero.hp;
      this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + this.secondWindHeal());
      this.perks().secondWind++;
      this.events.push({ type: "skill", path: "blue", healed: this.hero.hp - before });
    } else if (this.voie === "red") {
      const target = this.monsters.find((m) => m.id === targetId);
      if (!target || !(this.inReach(this.hero, target) || this.inWeaponReach(target))) return;
      this.perks().doubleStrikes--;
      this.events.push({ type: "skill", path: "red", healed: 0 });
      this.heroAttacks(target);
      if (this.monsters.includes(target)) this.heroAttacks(target, true);
    }
  }

  /** Le héros encaisse des dégâts. Dernier rempart (voie bleue) : une fois par étage, il reste à 1 PV. */
  /** Ce qui a tué le héros, pour l'écran de fin (Thomas : « dis de quoi il est mort »). */
  deathCause: string | null = null;

  private hurtHero(damage: number, cause = "ses blessures"): void {
    // Statue (potion de pierre) : rien ne la blesse.
    if (damage <= 0 || this.stoneTurns > 0) return;
    this.perks().hurt = 1;
    const rampart = this.rank("dernier_rempart");
    if (this.hero.hp - damage <= 0 && rampart > 0 && this.perks().lastStand < 1) {
      this.perks().lastStand++;
      this.hero.hp = Math.min(this.hero.maxHp, rampart >= 2 ? 5 : 1);
      this.events.push({ type: "lastStand" });
      return;
    }
    this.hero.hp = Math.max(0, this.hero.hp - damage);
    if (this.hero.hp === 0 && !this.over) {
      this.over = true;
      this.deathCause = cause;
      this.path = [];
      this.events.push({ type: "death", actor: this.hero });
    }
  }

  /** Partie d'essai (Thomas, 2026-11-15 : « chercher manuellement l'équipement dans le répertoire ») : donne un objet
   *  (un lot de 10 pour les munitions). Il va au sac ; sac plein, il tombe à côté. Rend « bag », « ground » ou null. */
  testGive(id: ItemId): "bag" | "ground" | null {
    if (!(this.sandbox || this.testRun) || this.over) return null;
    const def = ITEMS[id] as ItemDef;
    const count = def.kind === "ammo" ? Math.min(def.maxStack, 10) : 1;
    const left = this.inventory.add(id, count, def.kind === "key" ? this.depth : undefined);
    if (left > 0) this.bounceFromHero(id, left);
    return left > 0 ? "ground" : "bag";
  }

  /** Bouton « Stuff » de la triche (Thomas, 2026-11-16) : un équipement complet faible, moyen ou élevé, tiré au hasard
   *  dans `TEST_KITS`, porté aussitôt (l'ancien disparaît), plus ses munitions, vivres et potions au sac. Rend la liste
   *  des objets donnés (pour le journal), ou null hors essai. */
  testKit(tier: KitTier): ItemId[] | null {
    if (!(this.sandbox || this.testRun) || this.over) return null;
    const kit = TEST_KITS[tier];
    const pick = <T,>(list: T[]): T => list[this.rng.int(0, list.length - 1)];
    const given: ItemId[] = [];
    const wear = (slot: Slot, id: ItemId) => {
      const item = this.inventory.mint(id, 1);
      this.equipment[slot] = item;
      given.push(id);
    };
    // Le sac d'abord : tout ce qui était dedans y reste (le nouveau est au moins aussi grand) ; sinon on garde l'ancien.
    const bag = ITEMS[kit.bag] as ItemDef;
    if (this.inventory.resize(Math.max(this.inventory.cols, bag.bagCols ?? 6), Math.max(this.inventory.rows, bag.bagRows ?? 4))) wear("bag", kit.bag);
    wear("melee", pick(kit.melee));
    wear("armor", pick(kit.armor));
    wear("hat", pick(kit.hat));
    // Halfelin (Thomas, 2026-11-17) : son lance-pierre et ses pierres, jamais un arc ni des flèches.
    const swap = this.race.swapItems;
    const sling = swap?.arc_court;
    wear("ranged", sling ?? pick(kit.ranged));
    this.equipment.amulet = null;
    this.equipment.artifact = null;
    if (kit.amulet) wear("amulet", pick(kit.amulet));
    if (kit.artifact) wear("artifact", pick(kit.artifact));
    for (const id of given) noteUnique(id);
    this.refreshStats();
    const ammo = pick(kit.ammo).map(([id, n]): [ItemId, number] => (sling && (ITEMS[id] as ItemDef).ammoFamily === "fleche" ? [swap!.fleche ?? id, n] : [id, n]));
    const stock: [ItemId, number][] = [...ammo, ...pick(kit.food)];
    for (let i = 0; i < kit.potions.count; i++) stock.push([pick(kit.potions.from), 1]);
    for (const [id, n] of stock) {
      const left = this.inventory.add(id, n);
      if (left > 0) this.bounceFromHero(id, left);
      if (!given.includes(id)) given.push(id);
    }
    return given;
  }

  /** Bouton « Revivre » de l'écran de mort (Thomas, 2026-11-15 ; démo d'essai seulement, choisi par l'interface) : le
   *  héros se relève sur place, tous ses PV, sans poison, feu ni entrave. Rend faux s'il n'est pas mort. */
  revive(): boolean {
    if (!this.over || this.hero.hp > 0 || this.won) return false;
    this.over = false;
    this.deathCause = null;
    this.hero.hp = this.hero.maxHp;
    this.hero.poison = undefined;
    this.hero.burning = undefined;
    this.hero.stuck = undefined;
    this.hero.stunned = undefined;
    this.path = [];
    return true;
  }

  // ---------- Potion de feu ----------

  /** Pourquoi on ne peut pas lancer cette potion sur cette case (null : c'est possible). */
  throwRefusal(uid: number, x: number, y: number): "far" | "unseen" | "wall" | null {
    const def = this.inventory.get(uid) ? (ITEMS[this.inventory.get(uid)!.defId] as ItemDef) : undefined;
    // Toutes les potions se lancent (Thomas, 2026-11-14), à 5 cases au plus si rien n'est dit.
    // Une torche se lance aussi, à 5 cases (Thomas, 2026-11-14 : « lancer une torche met le feu à une case »).
    const range = def?.throwRange ?? (def?.potion || def?.id === "torche" ? 5 : 0);
    if (!range) return "far";
    if (Math.max(Math.abs(x - this.hero.x), Math.abs(y - this.hero.y)) > range) return "far";
    if (!this.isVisible(x, y)) return "unseen";
    // Une porte verrouillée se vise aussi (Thomas, 2026-11-18) : le feu la consume.
    if (!this.map.isWalkable(x, y) && this.map.get(x, y) !== Tile.DoorLocked) return "wall";
    return null;
  }

  /** La torche lancée : sa case prend feu (dans l'eau, elle s'éteint). Les monstres de la case se réveillent. */
  private resolveTorchThrow(order: { x: number; y: number }): void {
    this.reveal();
    this.markHeroHurt(order, 1);
    const doused = this.map.get(order.x, order.y) === Tile.Water;
    if (!doused) {
      const old = this.fires.find((f) => f.x === order.x && f.y === order.y);
      if (old) old.turns = RULES.fireTurns;
      else this.fires.push({ x: order.x, y: order.y, turns: RULES.fireTurns });
    }
    this.events.push({ type: "torchThrown", fromX: this.hero.x, fromY: this.hero.y, x: order.x, y: order.y, doused });
    for (const m of this.monsters) if (m.x === order.x && m.y === order.y) { m.alerted = true; m.asleep = false; }
    if (!doused) this.igniteFurniture();
  }

  /** Ordre : lancer une potion (de feu) sur une case. */
  throwPotion(uid: number, x: number, y: number): boolean {
    if (this.over || this.throwRefusal(uid, x, y) !== null) return false;
    this.wait();
    this.waiting = false;
    this.throwOrder = { uid, x, y };
    return true;
  }

  private resolveThrow(order: { uid: number; x: number; y: number }): void {
    const item = this.inventory.get(order.uid);
    if (!item || !this.inventory.take(item.defId, 1)) return;
    if (item.defId === "torche") return this.resolveTorchThrow(order);
    if ((ITEMS[item.defId] as ItemDef).holy) return this.holyBurst(order);
    if ((ITEMS[item.defId] as ItemDef).bomb) {
      // Bombe arcanique (Thomas, 2026-11-16) : elle se pose là où elle tombe, et explosera dans quelques tours.
      this.reveal();
      (this.current.bombs ??= []).push({ x: order.x, y: order.y, turns: RULES.bombDelay });
      this.events.push({ type: "bomb", what: "thrown", fromX: this.hero.x, fromY: this.hero.y, x: order.x, y: order.y });
      return;
    }
    const potion = (ITEMS[item.defId] as ItemDef).potion ?? "fire";
    this.reveal();
    this.markHeroHurt(order, 2);
    // La croix, plus une éclaboussure au hasard sur une case voisine de la croix (Thomas).
    const cross = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const splash = [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const extra = splash[this.rng.int(0, splash.length - 1)];
    // La flaque de sa couleur, là où la fiole éclate (Thomas, 2026-11-12).
    if (this.map.get(order.x, order.y) !== Tile.Water) this.stain(order.x, order.y, POTION_STAIN[potion] ?? "pFire");
    if (potion === "night") {
      // Potion de nuit lancée : 10 tours de nuit sur la case et autour (la lune n'y touche plus).
      this.current.nights = [...(this.current.nights ?? []), { x: order.x, y: order.y, turns: 10 }];
      const cells: Point[] = [];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (this.map.isWalkable(order.x + dx, order.y + dy)) cells.push({ x: order.x + dx, y: order.y + dy });
      for (const c of cells) this.discordMist.push({ x: c.x, y: c.y, turns: 1, thin: true });
      this.events.push({ type: "potionThrown", item: item.defId, potion, fromX: this.hero.x, fromY: this.hero.y, x: order.x, y: order.y, cells });
      return;
    }
    if (potion === "frost") {
      // Potion de gel (Thomas, 2026-11-19) : lancée, la croix de 5 cases gèle ; les monstres pris sont figés (le boss un
      // tour), le feu s'éteint.
      const cells = cross.map(([dx, dy]) => ({ x: order.x + dx, y: order.y + dy })).filter((c) => this.map.isWalkable(c.x, c.y));
      this.freezeCells(cells);
      this.events.push({ type: "potionThrown", item: item.defId, potion, fromX: this.hero.x, fromY: this.hero.y, x: order.x, y: order.y, cells });
      return;
    }
    if (potion === "stone") {
      // Lancée : le monstre de la case est pétrifié 3 tours, et sert d'abri (Thomas, 2026-11-13). Pas le boss.
      const m = this.monsterAt(order.x, order.y);
      if (m?.boss) {
        m.petrified = RULES.bossPetrifyTurns;
        this.events.push({ type: "bossPotion", potion, actor: m });
        this.events.push({ type: "stone", what: "petrified", actor: m });
      } else if (m) {
        m.petrified = RULES.petrifyTurns;
        m.alerted = false;
        m.feud = undefined;
        this.events.push({ type: "stone", what: "petrified", actor: m });
      }
      this.events.push({ type: "potionThrown", item: item.defId, potion, fromX: this.hero.x, fromY: this.hero.y, x: order.x, y: order.y, cells: [{ x: order.x, y: order.y }] });
      return;
    }
    if (potion === "youth" || potion === "haste" || potion === "urchin") {
      // Les potions à boire, lancées (Thomas, 2026-11-14) : la fiole éclate, la flaque reste. La jouvence soigne ce qu'elle
      // touche (un monstre aussi !), la vitesse l'énerve.
      const m = this.monsterAt(order.x, order.y);
      let note: "healed" | "angry" | undefined;
      if (m && potion === "youth" && m.hp < m.maxHp) {
        m.hp = m.maxHp;
        note = "healed";
      }
      if (m) {
        m.alerted = true;
        m.asleep = false;
        if (potion === "haste") note = "angry";
      }
      this.events.push({ type: "potionThrown", item: item.defId, potion, fromX: this.hero.x, fromY: this.hero.y, x: order.x, y: order.y, cells: [{ x: order.x, y: order.y }], note });
      return;
    }
    if (potion === "grow" || potion === "slip") {
      // Potion de géant ou glissante lancée (Thomas, 2026-11-13) : le monstre touché, le boss compris.
      const m = this.monsterAt(order.x, order.y);
      if (m) {
        m.alerted = true;
        m.asleep = false;
        if (potion === "grow") {
          m.grown = RULES.growTurns;
          this.events.push({ type: "grow", actor: m });
        } else if (m.defId !== "carillon") {
          // Le Carillon est enraciné : la potion glissante n'y fait rien.
          m.slippery = true;
          this.events.push({ type: "slippery", actor: m });
        }
        if (m.boss) this.events.push({ type: "bossPotion", potion, actor: m });
      }
      this.events.push({ type: "potionThrown", item: item.defId, potion, fromX: this.hero.x, fromY: this.hero.y, x: order.x, y: order.y, cells: [{ x: order.x, y: order.y }] });
      return;
    }
    if (potion === "discord") {
      // La Tisseuse n'a pas de rival : prise de folie, elle se mord les pattes et reste sonnée un tour.
      const queen = this.monsters.find((q) => q.boss && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => occupies(q, order.x + dx, order.y + dy)));
      if (queen) {
        const bite = rollDice(this.rng, RULES.bossDiscordDamage);
        queen.hp -= bite;
        queen.stunned = Math.max(queen.stunned ?? 0, 1);
        this.events.push({ type: "bossPotion", potion, actor: queen });
        this.events.push({ type: "burn", actor: queen, damage: bite });
        this.removeIfDead(queen);
      }
      // Lancée : les monstres de la croix se battent entre eux (Thomas, 2026-11-13 ; les querelles déjà codées).
      const cells = cross.map(([dx, dy]) => ({ x: order.x + dx, y: order.y + dy })).filter((c) => this.map.isWalkable(c.x, c.y));
      const hit = this.monsters.filter((m) => !m.boss && cells.some((c) => occupies(m, c.x, c.y)));
      for (const m of hit) {
        if (m.feud !== undefined) continue;
        const rivals = this.monsters.filter((o) => o !== m && !o.boss && o.feud === undefined && gapBetween(o, m) <= 4);
        if (rivals.length === 0) continue;
        rivals.sort((a, b) => Number(hit.includes(b)) - Number(hit.includes(a)) || gapBetween(a, m) - gapBetween(b, m));
        m.asleep = false;
        rivals[0].asleep = false;
        this.startFeud(m, rivals[0], "discord");
      }
      for (const c of cells) this.discordMist.push({ x: c.x, y: c.y, turns: 3 });
      this.events.push({ type: "potionThrown", item: item.defId, potion, fromX: this.hero.x, fromY: this.hero.y, x: order.x, y: order.y, cells });
      return;
    }
    if (potion === "fog") {
      // Potion de brouillard (Thomas, 2026-11-12, soir) : une épaisse nappe noire en croix de 5 cases, pour fuir.
      const cells = this.spreadFog(order, RULES.fogArm);
      const queen = this.monsters.find((q) => q.boss && cellsOf(q).some((c) => cells.some((f) => f.x === c.x && f.y === c.y)));
      if (queen) this.events.push({ type: "bossPotion", potion, actor: queen });
      this.events.push({ type: "potionThrown", item: item.defId, potion, fromX: this.hero.x, fromY: this.hero.y, x: order.x, y: order.y, cells });
      return;
    }
    if (potion === "smoke") {
      // Fiole de fumée (quête 03, Krik) : un nuage gris ; les monstres tout près perdent la trace du héros.
      const cells = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: order.x + dx, y: order.y + dy })).filter((c) => this.map.isWalkable(c.x, c.y));
      this.smokeBurst(order, 2);
      this.events.push({ type: "potionThrown", item: item.defId, potion, fromX: this.hero.x, fromY: this.hero.y, x: order.x, y: order.y, cells });
      return;
    }
    if (potion === "poison") {
      // Potion de poison lancée (Thomas, 2026-11-12 : « lancer devrait faire quelque chose ») : un nuage vert en croix,
      // qui empoisonne qui s'y tient (comme le piège à gaz).
      const cells = cross.map(([dx, dy]) => ({ x: order.x + dx, y: order.y + dy })).filter((c) => this.map.isWalkable(c.x, c.y) || this.map.get(c.x, c.y) === Tile.Furniture);
      this.cloud(this.gas, [{ x: order.x, y: order.y }, ...cells.filter((c) => c.x !== order.x || c.y !== order.y)], RULES.thrownPoisonGasTurns);
      this.gasPoison();
      for (const m of this.monsters) if (cells.some((c) => c.x === m.x && c.y === m.y)) { m.alerted = true; m.asleep = false; }
      this.events.push({ type: "potionThrown", item: item.defId, potion, fromX: this.hero.x, fromY: this.hero.y, x: order.x, y: order.y, cells });
      return;
    }
    const cells = [...cross, extra]
      .map(([dx, dy]) => ({ x: order.x + dx, y: order.y + dy }))
      .filter((c) => this.map.isWalkable(c.x, c.y) && this.map.get(c.x, c.y) !== Tile.Water);
    for (const c of cells) {
      const old = this.fires.find((f) => f.x === c.x && f.y === c.y);
      if (old) old.turns = RULES.fireTurns;
      else this.fires.push({ x: c.x, y: c.y, turns: RULES.fireTurns });
    }
    this.events.push({ type: "potionThrown", item: item.defId, potion, fromX: this.hero.x, fromY: this.hero.y, x: order.x, y: order.y, cells });
    this.events.push({ type: "fire", fromX: this.hero.x, fromY: this.hero.y, x: order.x, y: order.y, cells });
    // Les monstres touchés par l'éclaboussure se réveillent.
    for (const m of this.monsters) if (cells.some((c) => c.x === m.x && c.y === m.y)) { m.alerted = true; m.asleep = false; }
    // Les meubles tout près prennent feu tout de suite.
    this.igniteFurniture();
  }

  /** Meubles en feu : tours restants avant qu'il n'en reste qu'un tas de cendres. */
  private furnitureFire = new Map<Furniture, number>();

  /**
   * Le feu gagne les meubles (Thomas) : un meuble qui brûle s'il y a des flammes à une case de lui (ou sur lui). Il
   * brûle tout entier, et à son tour enflamme ses voisins à une case.
   */
  /**
   * Tout ce qui est en bois brûle (Thomas) : les portes (même verrouillées) partent en cendres et laissent le passage
   * ouvert ; un coffre brûle et laisse tomber son or et son objet à côté.
   */
  private burnWoodTiles(): void {
    let changed = false;
    // Les flammes au sol, et aussi les meubles qui brûlent (Thomas, 2026-11-18 : « les portes doivent pouvoir brûler »).
    const sources = [...this.fires, ...[...this.furnitureFire.keys()].flatMap((f) => furnitureCells(f))];
    for (const fire of sources) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = fire.x + dx;
          const y = fire.y + dy;
          const t = this.map.get(x, y);
          const door = t === Tile.DoorClosed || t === Tile.DoorOpen || t === Tile.DoorLocked;
          if (!door && t !== Tile.Chest) continue;
          if (t === Tile.Chest) {
            const gold = lessGold(this.rng.int(RULES.chestGoldMin, RULES.chestGoldMax) + this.depth * RULES.chestGoldPerDepth);
            this.map.set(x, y, Tile.Floor);
            this.spillLoot(x, y, gold, rollLoot(this.rng, this.depth));
          } else this.map.set(x, y, Tile.Floor);
          if (!this.furnitureAt(x, y)) this.current.furniture.push({ x, y, kind: "ashes1" });
          this.events.push({ type: "furnitureFire", x, y, kind: door ? "door" : "chest" });
          changed = true;
        }
      }
    }
    if (changed) {
      this.refreshLight();
      this.updateVision();
    }
  }

  private igniteFurniture(): void {
    this.burnWoodTiles();
    // Une toile flambe d'un coup dès qu'une flamme la touche ou la frôle, et laisse un peu de cendre (Thomas).
    const near = (f: { x: number; y: number }) => this.fires.filter((fire) => Math.max(Math.abs(fire.x - f.x), Math.abs(fire.y - f.y)) <= 1);
    const webs = this.current.furniture.filter((f) => {
      if (!f.kind.startsWith("web")) return false;
      const flames = near(f);
      if (flames.length === 0) return false;
      // Nappes de la nichée (Thomas : « il ne doit pas pouvoir se répandre dans toute la salle ») : le feu ne court que
      // `webFireReach` cases de toile depuis sa source, et une nappe sur deux seulement s'embrase.
      if (!(f.kind.startsWith("webN") || f.kind.startsWith("webHub"))) return true;
      const gen = Math.min(...flames.map((fl) => fl.gen ?? 0));
      return gen < RULES.webFireReach && (gen === 0 || this.rng.chance(RULES.webFireSpreadChance));
    });
    const genOf = (f: { x: number; y: number }) => Math.min(...near(f).map((fl) => fl.gen ?? 0));
    for (const w of webs) {
      this.current.furniture = this.current.furniture.filter((o) => o !== w);
      this.current.furniture.push({ x: w.x, y: w.y, kind: "ashes1" });
      this.map.touch(w.x, w.y);
      // Nappes et grande toile (nichée) : la flamme court de toile en toile, une case par tour.
      const sheet = w.kind.startsWith("webN") || w.kind.startsWith("webHub");
      if (sheet && !this.fires.some((f) => f.x === w.x && f.y === w.y)) this.fires.push({ x: w.x, y: w.y, turns: RULES.webFireTurns, gen: genOf(w) + 1 });
      // Pas une ligne de journal par nappe : une seule quand le feu prend dans la toile.
      if (!sheet || !this.events.some((e) => e.type === "furnitureFire" && e.kind === "webN")) this.events.push({ type: "furnitureFire", x: w.x, y: w.y, kind: sheet ? "webN" : w.kind });
    }
    if (webs.some((w) => w.kind.startsWith("webHub"))) this.checkHub();
    let spread = true;
    while (spread) {
      spread = false;
      for (const f of this.current.furniture) {
        if (this.furnitureFire.has(f) || !FURNITURE_KINDS[f.kind]?.burns) continue;
        const cells = furnitureCells(f);
        const near = cells.some((c) => this.fires.some((fire) => Math.max(Math.abs(fire.x - c.x), Math.abs(fire.y - c.y)) <= 1));
        if (!near) continue;
        this.furnitureFire.set(f, RULES.fireTurns);
        for (const c of cells) {
          const old = this.fires.find((fire) => fire.x === c.x && fire.y === c.y);
          if (old) old.turns = Math.max(old.turns, RULES.fireTurns);
          else this.fires.push({ x: c.x, y: c.y, turns: RULES.fireTurns });
        }
        this.events.push({ type: "furnitureFire", x: f.x, y: f.y, kind: f.kind });
        spread = true;
      }
    }
  }

  /** Fin de tour d'un meuble en feu : quand il a fini de brûler, il reste des cendres (le tapis, lui, disparaît). */
  private burnFurniture(): void {
    for (const [f, turns] of [...this.furnitureFire]) {
      if (turns > 1) {
        this.furnitureFire.set(f, turns - 1);
        continue;
      }
      this.furnitureFire.delete(f);
      const def = FURNITURE_KINDS[f.kind];
      const cells = furnitureCells(f);
      this.current.furniture = this.current.furniture.filter((o) => o !== f);
      for (const c of cells) {
        if (def.blocks) this.map.set(c.x, c.y, Tile.Floor);
        else this.map.touch(c.x, c.y);
      }
      // Les meubles plats (tapis, tapis de velours) brûlent et disparaissent ; les autres laissent des cendres.
      if (!def.flat) this.current.furniture.push({ x: f.x, y: f.y, kind: def.w >= 2 ? "ashes2" : "ashes1" });
      else for (let dy = -1; dy <= def.h; dy++) for (let dx = -1; dx <= def.w; dx++) this.map.touch(f.x + dx, f.y + dy);
    }
  }

  /** Fin de tour : le feu brûle ceux qui s'y tiennent, puis faiblit. */
  private burn(): void {
    // L'eau ne brûle jamais (Thomas, 2026-11-12 : « l'eau éteint le feu et ne peut pas brûler »).
    this.fires = this.fires.filter((f) => this.map.get(f.x, f.y) !== Tile.Water);
    // Ceux qui ont quitté les flammes brûlent encore un peu (les flammes les suivent).
    for (const a of [this.hero, ...this.monsters]) {
      if (!a.burning || this.over || cellsOf(a).some((c) => this.isBurning(c.x, c.y))) continue;
      // Dans une flaque, on s'éteint : « Pschh ! ».
      if (cellsOf(a).some((c) => this.map.get(c.x, c.y) === Tile.Water)) {
        a.burning = 0;
        this.events.push({ type: "doused", actor: a });
        continue;
      }
      a.burning--;
      const damage = rollDice(this.rng, RULES.fireDamage) * (a.boss || this.fireWeak(a) ? RULES.bossFireFactor : 1);
      this.events.push({ type: "burn", actor: a, damage });
      if (a === this.hero) this.hurtHero(damage, "les flammes");
      else {
        a.hp -= damage;
        this.removeIfDead(a);
      }
    }
    this.igniteFurniture();
    this.burnFurniture();
    if (this.fires.length === 0) return;
    let burnedBoss = false;
    const spread: { x: number; y: number; turns: number }[] = [];
    for (const f of this.fires) {
      for (const a of [this.hero, ...this.monsters]) {
        if (!occupies(a, f.x, f.y) || this.over || !this.monsters.concat(this.hero).includes(a)) continue;
        // Un grand monstre sur plusieurs cases en feu ne brûle qu'une fois par tour.
        if (a.boss && burnedBoss) continue;
        if (a.boss) burnedBoss = true;
        a.burning = RULES.burnAfter;
        const damage = rollDice(this.rng, RULES.fireDamage) * (a.boss || this.fireWeak(a) ? RULES.bossFireFactor : 1);
        this.events.push({ type: "burn", actor: a, damage });
        if (a === this.hero) this.hurtHero(damage, "les flammes");
        else {
          a.hp -= damage;
          a.alerted = true;
          a.asleep = false;
          this.removeIfDead(a);
        }
      }
      f.turns--;
      // Section 2 (Thomas, 2026-11-14 : « les veines vertes répandent un peu le feu, pas beaucoup ») : la mousse des
      // joints des pavés propage le feu à une case voisine, une fois sur huit par tour ; une case ne s'enflamme qu'une
      // fois par la mousse (elle a brûlé), et ce feu-là dure 3 tours.
      // La mousse de la case brûle : ses veines noircissent (Thomas, 2026-11-14 : « les racines qui ont brûlé changent
      // de couleur »).
      if (this.look() === "champi") {
        const own = f.y * 4096 + f.x;
        const list = (this.current.mossBurnt ??= []);
        if (!list.includes(own)) {
          list.push(own);
          this.map.touch(f.x, f.y);
        }
      }
      if (this.look() === "champi" && f.turns > 0 && this.rng.chance(RULES.mossFireChance)) {
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][this.rng.int(0, 3)];
        const nx = f.x + dx;
        const ny = f.y + dy;
        const key = ny * 4096 + nx;
        const burnt = (this.current.mossBurnt ??= []);
        if (this.map.isWalkable(nx, ny) && this.map.get(nx, ny) !== Tile.Water && !burnt.includes(key) && !this.fires.some((o) => o.x === nx && o.y === ny)) {
          burnt.push(key);
          spread.push({ x: nx, y: ny, turns: RULES.mossFireTurns });
        }
      }
      // Le feu éteint laisse de la SUIE au sol (Thomas, 2026-11-12).
      if (f.turns <= 0 && this.map.get(f.x, f.y) !== Tile.Water && this.map.isWalkable(f.x, f.y)) this.stain(f.x, f.y, "soot");
    }
    this.fires = this.fires.filter((f) => f.turns > 0);
    if (spread.length > 0) {
      this.fires.push(...spread);
      this.igniteFurniture();
    }
  }

  /** Taches de sang de l'étage courant. */
  bloodStains(): readonly BloodStain[] {
    return this.current.blood;
  }

  /**
   * Un coup qui porte fait couler un peu de sang : une petite tache sur la case de la victime, ou sur la case
   * derrière elle (à l'opposé du coup) ; si c'est un mur, la tache est sur le mur. Choix sans tirer au sort
   * (pour ne pas changer le hasard des combats) : il dépend du tour et de la position.
   */
  private bleed(target: Actor, from: Point): void {
    const def = target.kind === "monster" ? MONSTERS[target.defId as keyof typeof MONSTERS] : undefined;
    const color = def?.blood ?? "red";
    // La Tisseuse (2 × 2) saigne du côté où on la frappe : la case de son carré la plus proche du coup.
    const victim = sizeOf(target) > 1 ? { ...target, ...cellsOf(target).reduce((a, b) => (Math.hypot(b.x - from.x, b.y - from.y) < Math.hypot(a.x - from.x, a.y - from.y) ? b : a)) } : target;
    const hash = (victim.x * 73 + victim.y * 151 + this.turn * 17 + victim.id * 7) >>> 0;
    const dx = Math.sign(victim.x - from.x);
    const dy = Math.sign(victim.y - from.y);
    const behind = { x: victim.x + dx, y: victim.y + dy };
    // Les murs proches prennent volontiers des giclures (surtout dans un couloir, où il y en a de chaque côté) :
    // d'abord le mur derrière la victime, sinon un mur voisin.
    const walls: Point[] = [];
    if ((dx || dy) && this.map.get(behind.x, behind.y) === Tile.Wall) walls.push(behind);
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const w = { x: victim.x + ox, y: victim.y + oy };
      if (this.map.get(w.x, w.y) === Tile.Wall && !walls.some((p) => p.x === w.x && p.y === w.y)) walls.push(w);
    }
    const onWall = walls.length > 0 && hash % 5 < 3;
    const wall = walls[(hash >> 3) % Math.max(1, walls.length)];
    const at = onWall ? wall : hash % 2 === 0 || !this.map.isWalkable(behind.x, behind.y) ? { x: victim.x, y: victim.y } : behind;
    const shape: 0 | 1 | 2 = onWall ? 2 : ((hash >> 2) % 2 as 0 | 1);
    const stains = this.current.blood;
    const same = stains.findIndex((b) => b.x === at.x && b.y === at.y);
    if (same >= 0) stains.splice(same, 1);
    stains.push({ x: at.x, y: at.y, color, shape, turn: (hash >> 5) % 8 });
    if (stains.length > RULES.bloodMax) stains.shift();
  }

  /** Une tache de sang posée sur une case (cocon ou œufs crevés). */
  private stain(x: number, y: number, color: StainColor): void {
    const stains = this.current.blood;
    const same = stains.findIndex((b) => b.x === x && b.y === y);
    if (same >= 0) stains.splice(same, 1);
    stains.push({ x, y, color, shape: ((x + y) % 2) as 0 | 1, turn: (x * 7 + y * 3) % 8 });
    if (stains.length > RULES.bloodMax) stains.shift();
  }

  isBurning(x: number, y: number): boolean {
    return this.map.get(x, y) !== Tile.Water && this.fires.some((f) => f.x === x && f.y === y);
  }

  /** Expérience à réunir pour passer au niveau suivant. */
  xpToNext(): number {
    const table = RULES.xpLevels as readonly number[];
    const n = this.level - 1;
    return n < table.length ? table[n] : table[table.length - 1] + (n - table.length + 1) * RULES.xpLevelStep;
  }

  /** Niveau le plus haut avant d'avoir vaincu le boss de la section (5, puis 10…). */
  levelCap(): number {
    // Le verrou saute dès qu'on entre dans une nouvelle section (Thomas, 2026-11-15 : « il saute une fois à l'étage 6,
    // et réapparaît avant le prochain boss ») : section 2, niveau 10 au plus ; section 3, 15… Le boss vaincu l'ouvre
    // aussi (son XP compte), comme avant.
    const section = Math.floor((Math.max(this.depth, this.deepest) - 1) / RULES.floorsPerSection);
    return RULES.levelCapPerSection * (Math.max(this.bossKills, section) + 1);
  }

  /** L'XP est bloquée : niveau maximal de la section atteint (petit panneau « stop » sur la jauge). */
  xpBlocked(): boolean {
    return this.level >= this.levelCap();
  }

  private gainXp(amount: number, ignoreCap = false): void {
    if (amount <= 0) return;
    if (!ignoreCap && this.xpBlocked()) {
      // Les billes rebondissent sur la jauge et retombent : rien n'est gagné.
      this.events.push({ type: "xp", amount, blocked: true });
      return;
    }
    this.xp += amount;
    this.events.push({ type: "xp", amount });
    while (this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.level++;
      // Un niveau donne un point à placer (Vie, Force ou Agilité) ; plus de PV automatiques.
      this.points++;
      this.events.push({ type: "levelup", level: this.level });
      if (!ignoreCap && this.xpBlocked()) {
        this.xp = 0;
        break;
      }
    }
  }

  /** Flèches prêtes à partir (celles choisies dans le carquois). */
  arrows(): number {
    const ammo = this.currentAmmo();
    if (this.endlessAmmo(ammo)) return Infinity;
    return ammo ? this.inventory.count(ammo) : 0;
  }

  // ---------- Ordres du joueur ----------

  /**
   * Tirer une flèche vers une case en vue, quelle qu'elle soit : monstre, sol, mur, porte.
   * Renvoie la raison du refus, ou null si le tir est lancé.
   */
  shoot(x: number, y: number): ShootRefusal | null {
    const profile = this.shotProfile();
    if (this.over || (!profile && !this.weapon("ranged"))) return "no-bow";
    if (!profile || this.arrows() < 1) return "no-ammo";
    // On peut tirer vers une case qu'on ne voit pas (à l'aveugle), mais pas sur soi ni hors de la carte.
    if (!this.map.inBounds(x, y) || (x === this.hero.x && y === this.hero.y)) return "no-target";
    const distance = Math.max(Math.abs(x - this.hero.x), Math.abs(y - this.hero.y));
    if (distance > profile.range) return "out-of-range";
    this.clearDoorOrders();
    this.path = [];
    this.targetId = null;
    this.waiting = false;
    this.picking = false;
    this.resting = 0;
    this.searching = 0;
    this.hideOrder = false;
    this.jumpTarget = null;
    this.pushTargetId = null;
    this.disarmAt = null;
    this.useOrder = null;
    this.throwOrder = null;
    this.skillOrder = null;
    this.shotTarget = { x, y };
    return null;
  }

  /**
   * Le joueur désigne une case. Sur un monstre en vue : on va l'attaquer. Sur sa propre case : on attend un tour.
   * Sinon on s'y rend. `ignoreFog` (réservé aux tests) autorise les cases jamais vues.
   */
  /** Trajet repris par le bouton « avance rapide » : il s'arrête à la prochaine alerte (voir `tick`). */
  wary = false;

  /** Reprendre un trajet coupé : comme `setDestination`, mais il s'arrêtera à la prochaine interruption. */
  resumeTravel(x: number, y: number): boolean {
    const ok = this.setDestination(x, y);
    this.wary = ok;
    return ok;
  }

  setDestination(x: number, y: number, ignoreFog = false): boolean {
    if (this.over) return false;
    this.wary = false;
    // Toucher le poulet : il prend peur (Thomas, 2026-11-13).
    if (this.chickenAt(x, y) && this.isVisible(x, y)) {
      this.path = [];
      this.scareChicken(this.chickenAt(x, y));
      return true;
    }
    if (x === this.hero.x && y === this.hero.y) {
      // Retoucher sa propre case : ramasser ce qui s'y trouve ; sur un escalier, le prendre (Thomas, 2026-11-12 :
      // « on doit pouvoir monter et descendre au clic ») ; sinon passer un tour.
      if (this.pickUp()) return true;
      const here = this.map.get(x, y);
      const stairs = here === Tile.StairsDown ? "down" : here === Tile.StairsUp && this.depth > 1 ? "up" : null;
      if (stairs) {
        this.path = [];
        this.pendingStairs = stairs;
        return true;
      }
      this.wait();
      return true;
    }
    // Porte verrouillée, ou sarcophage à pointes fermé : on va devant, puis on choisit quoi en faire.
    if ((this.map.get(x, y) === Tile.DoorLocked || this.maidenAt(x, y)) && (ignoreFog || this.isExplored(x, y))) {
      return this.approachLockedDoor(x, y, ignoreFog);
    }
    // Le Colporteur : on va à côté de lui, puis sa boutique s'ouvre (pas pendant un combat, pas s'il se cache).
    const merchant = this.merchantAt(x, y);
    if (merchant && this.isVisible(x, y) && !merchant.hidden) return this.approachMerchant(merchant);
    const npcHere = this.npcAt(x, y);
    if (npcHere && this.isVisible(x, y) && !this.monsterAt(x, y)) return this.approachNpc(npcHere);
    // Nichée : un cocon, un sac d'œufs ou une amarre (sur sa colonne) : on va à côté, puis on le crève d'un coup.
    if ((this.breakableAt(x, y) || this.bellAt(x, y) || this.sealedStairsAt(x, y) || this.sealedBlockedAt(x, y) || this.bathTargetAt(x, y) || this.plateTableAt(x, y) || this.zoneDoorAt(x, y) || this.candleAt(x, y) || this.ciergeAt(x, y) || this.current.furniture.some((f) => f.kind === "ciergeViolet" && f.x === x && f.y === y) || this.scarecrowAt(x, y) || this.grilleAt(x, y) || this.alembicAt(x, y) || this.snowmanAt(x, y) || this.appleDomeAt(x, y) || this.skeletonAt(x, y)) && (ignoreFog || this.isExplored(x, y))) return this.approachBreakable(x, y, ignoreFog);
    // Quêtes v3 : la poule aux œufs d'or ; on va à côté, puis on l'attrape (si elle ne s'est pas sauvée avant).
    const hen = this.current.goldHen;
    if (hen && hen.x === x && hen.y === y && this.isVisible(x, y)) return this.approachBreakable(x, y, ignoreFog);
    // Une statue : celle dont Gluck a parlé se brise ; les autres ne sont que de la pierre.
    const statue = this.statueAt(x, y);
    if (statue && this.isExplored(x, y)) {
      if (statue.hinted) return this.approachBreakable(x, y, ignoreFog);
      this.events.push({ type: "statue", x, y, look: true });
      return false;
    }
    const seen = this.monsterAt(x, y);
    const monster = seen && this.isVisible(x, y) ? seen : undefined;
    // Vers un monstre en vue, on trouve toujours un chemin ; sinon on ne passe que par les cases déjà vues.
    const known = ignoreFog || monster ? undefined : (cx: number, cy: number) => this.isKnown(cx, cy);
    const path = this.heroPath({ x, y }, known);
    if (!path) return false;
    this.clearDoorOrders();
    this.breakTarget = null;
    // Un nouvel ordre fait oublier une conversation ou une boutique visée avant (sinon un PNJ resté sur le chemin, ou
    // un monstre posté sur sa case, bloquait le héros).
    this.talkTarget = null;
    this.shopTarget = false;
    this.targetId = monster ? monster.id : null;
    this.path = path;
    this.waiting = false;
    this.picking = false;
    this.resting = 0;
    this.searching = 0;
    this.hideOrder = false;
    this.jumpTarget = null;
    this.pushTargetId = null;
    this.disarmAt = null;
    this.useOrder = null;
    this.throwOrder = null;
    this.skillOrder = null;
    this.shotTarget = null;
    return true;
  }

  /** Se rendre devant une porte verrouillée (ou s'y arrêter si on y est déjà) pour choisir quoi en faire. */
  private approachLockedDoor(x: number, y: number, ignoreFog: boolean): boolean {
    const known = ignoreFog ? undefined : (cx: number, cy: number) => this.isKnown(cx, cy);
    let best: Point[] | null = null;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx === this.hero.x && ny === this.hero.y) {
        best = [];
        break;
      }
      const path = this.heroPath({ x: nx, y: ny }, known);
      if (path && (!best || path.length < best.length)) best = path;
    }
    if (!best) return false;
    this.clearDoorOrders();
    this.targetId = null;
    this.waiting = false;
    this.picking = false;
    this.resting = 0;
    this.searching = 0;
    this.hideOrder = false;
    this.jumpTarget = null;
    this.pushTargetId = null;
    this.disarmAt = null;
    this.useOrder = null;
    this.throwOrder = null;
    this.skillOrder = null;
    this.path = best;
    if (best.length === 0) {
      this.pendingDoor = { x, y };
      this.useKeyIfAny();
    } else this.doorTarget = { x, y };
    return true;
  }

  /** Devant une porte verrouillée, la clef de l'étage sert d'elle-même : ce sera l'action du prochain tour. */
  private useKeyIfAny(): void {
    if (this.pendingDoor && this.maidenAt(this.pendingDoor.x, this.pendingDoor.y)) return;
    if (this.inventory.count("clef", this.depth) > 0 && !(this.pendingDoor && this.sealedDoor(this.pendingDoor.x, this.pendingDoor.y))) this.doorAction = "key";
  }

  /** Vrai quand le héros s'apprête à ouvrir avec sa clef la porte devant lui (rien à choisir). */
  usingKey(): boolean {
    return this.pendingDoor !== null && this.doorAction === "key";
  }

  /** Le joueur choisit de crocheter ou d'enfoncer la porte devant lui : ce sera l'action du prochain tour. */
  actOnDoor(action: DoorAction): boolean {
    if (this.over || !this.doorOptions().includes(action)) return false;
    this.doorAction = action;
    return true;
  }

  private doorAttemptKey(door: Point, action: DoorAction): string {
    return `${this.depth}:${door.x},${door.y}:${action}`;
  }

  /**
   * Ce que le héros peut encore tenter sur la porte verrouillée devant lui. Crocheter et enfoncer n'ont droit
   * qu'à un essai chacun par porte ; la clef marche toujours, si on en a une.
   */
  /** Renoncer à la porte verrouillée devant laquelle on se tient : rien n'est tenté, aucun tour ne passe. */
  cancelDoor(): void {
    this.clearDoorOrders();
    this.pendingDoor = null;
  }

  doorOptions(): DoorAction[] {
    const door = this.pendingDoor;
    if (!door) return [];
    // Sarcophage : désamorcer (« pick ») ou forcer (« break »), toujours possibles ; la clef n'y sert à rien.
    if (this.maidenAt(door.x, door.y)) return ["pick", "break"];
    const options: DoorAction[] = [];
    // La porte du poulet : on peut s'acharner, rien n'y fait ; la clef n'y entre pas.
    if (this.sealedDoor(door.x, door.y)) {
      if (!this.failedDoorAttempts.has(this.doorAttemptKey(door, "pick"))) options.push("pick");
      if (!this.failedDoorAttempts.has(this.doorAttemptKey(door, "break"))) options.push("break");
      return options;
    }
    // La porte du compteur : on peut d'abord regarder par le trou (autant de fois qu'on veut…).
    if (this.counterAt(door.x, door.y)) options.push("peek");
    // Une clef n'ouvre que les portes de l'étage où on l'a trouvée.
    if (this.inventory.count("clef", this.depth) > 0) options.push("key");
    if (!this.failedDoorAttempts.has(this.doorAttemptKey(door, "pick"))) options.push("pick");
    if (!this.failedDoorAttempts.has(this.doorAttemptKey(door, "break"))) options.push("break");
    return options;
  }

  private clearDoorOrders(): void {
    // Tout nouvel ordre interrompt aussi un ramassage en cours.
    this.picking = false;
    this.resting = 0;
    this.searching = 0;
    this.hideOrder = false;
    this.jumpTarget = null;
    this.pushTargetId = null;
    this.disarmAt = null;
    this.useOrder = null;
    this.throwOrder = null;
    this.skillOrder = null;
    this.pendingDoor = null;
    this.doorTarget = null;
    this.doorAction = null;
  }

  /** Déplacement ou attaque d'une case (clavier). */
  moveBy(dx: number, dy: number): boolean {
    if (this.over) return false;
    if ((dx === 0 || dy === 0) && (this.map.get(this.hero.x + dx, this.hero.y + dy) === Tile.DoorLocked || this.maidenAt(this.hero.x + dx, this.hero.y + dy))) {
      return this.approachLockedDoor(this.hero.x + dx, this.hero.y + dy, false);
    }
    if (!canStep(this.map, this.hero.x, this.hero.y, dx, dy)) return false;
    this.clearDoorOrders();
    this.targetId = null;
    this.shotTarget = null;
    this.path = [{ x: this.hero.x + dx, y: this.hero.y + dy }];
    return true;
  }

  /** Passer un tour sur place. */
  /** Ce qui traîne sur la case du héros, dans l'ordre où on le ramassera. */
  itemsHere(): GroundItem[] {
    // L'Elfe a des flèches sans fin : il ne ramasse plus les flèches ordinaires (Thomas, 2026-11-19).
    const elf = !!this.race.endlessArrows;
    return this.ground.filter((g) => g.x === this.hero.x && g.y === this.hero.y && !(elf && g.item === "fleche"));
  }

  /** Ordre : ramasser le premier objet de la case (un seul à la fois ; cela prend un tour). */
  pickUp(): boolean {
    if (this.over || this.itemsHere().length === 0) return false;
    this.clearDoorOrders();
    this.path = [];
    this.targetId = null;
    this.shotTarget = null;
    this.waiting = false;
    this.resting = 0;
    this.searching = 0;
    this.hideOrder = false;
    this.jumpTarget = null;
    this.pushTargetId = null;
    this.disarmAt = null;
    this.useOrder = null;
    this.throwOrder = null;
    this.skillOrder = null;
    this.picking = true;
    this.pickingItem = null;
    this.equipAfterPick = false;
    return true;
  }

  /** Ramasser l'objet du dessus et le porter aussitôt (Thomas, 2026-11-15 : bouton « S'équiper » du ruban). */
  pickUpAndEquip(): boolean {
    const top = this.itemsHere()[0];
    if (!top || !this.wearable(ITEMS[top.item]) || this.tooLow(ITEMS[top.item])) return false;
    if (!this.pickUp()) return false;
    this.pickingItem = top.item;
    this.equipAfterPick = true;
    return true;
  }
  private equipAfterPick = false;

  /** Un objet qui se porte (arme, armure, casque, sac, bibelot…), pas une munition ni un objet à consommer. */
  wearable(def: ItemDef): boolean {
    return !["ammo", "key", "gold", "use", "gem", "quest"].includes(def.kind);
  }

  /** Pourquoi le héros ne peut pas se reposer maintenant (`null` : il le peut). */
  restRefusal(): "full" | "used" | "danger" | null {
    if (this.hero.hp >= this.hero.maxHp) return "full";
    if (this.current.rested) return "used";
    if (this.visibleMonsters().length > 0) return "danger";
    return null;
  }

  /** Avancement du repos en cours, de 0 à 1 (0 : pas de repos). */
  restProgress(): number {
    return this.resting > 0 ? Math.max(0.06, 1 - this.resting / this.restTurns()) : 0;
  }

  /** Durée d'un repos. */
  restTurns(): number {
    return RULES.restTurns;
  }

  /**
   * Y a-t-il de quoi se cacher ici ? Une colonne sur une des 8 cases voisines, ou un mur qui fait un angle :
   * un coin rentrant (mur d'un côté ET mur d'un côté perpendiculaire), ou l'arête d'un mur (le bout d'un pan,
   * en diagonale, derrière lequel on peut se glisser, comme pour l'embuscade au coin). Un mur droit ne suffit pas.
   */
  hasCover(p: Point): boolean {
    const wall = (x: number, y: number) => this.map.get(x, y) === Tile.Wall;
    const small = this.race.smallCover && p.x === this.hero.x && p.y === this.hero.y;
    // Une colonne, ou un meuble qui bloque (lit, table, chaise renversée…), sur une des 8 cases voisines.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = this.map.get(p.x + dx, p.y + dy);
        if (t === Tile.Pillar || t === Tile.Furniture) return true;
        // PETIT (Halfelin) : une chaise, un panier ou un seau suffisent, même s'ils ne bloquent pas.
        if (small && (dx || dy)) {
          const f = this.furnitureAt(p.x + dx, p.y + dy);
          if (f && /^(chair|basket|bucket)/.test(f.kind)) return true;
        }
        // Un monstre pétrifié fait un bon abri (potion de pierre lancée).
        if ((dx || dy) && this.monsterAt(p.x + dx, p.y + dy)?.petrified) return true;
      }
    }
    if ((wall(p.x, p.y - 1) || wall(p.x, p.y + 1)) && (wall(p.x - 1, p.y) || wall(p.x + 1, p.y))) return true;
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (wall(p.x + dx, p.y + dy) && !wall(p.x + dx, p.y) && !wall(p.x, p.y + dy)) return true;
    }
    return false;
  }

  /** Pourquoi le héros ne peut pas fouiller maintenant (`null` : il le peut). */
  searchRefusal(): "corridor" | "searched" | "danger" | null {
    const room = this.roomIndexAt(this.hero);
    // Dans un couloir (Thomas, 2026-11-17 : « active la fouille dans les couloirs, portée de 5 ») : toujours permise,
    // sauf un monstre en vue.
    if (room < 0) return this.visibleMonsters().length > 0 ? "danger" : null;
    const secret = this.current.secretRoom;
    const zone = this.current.zone;
    const hollow = !!zone && zone.door === "barrel" && !zone.open && !zone.noticed && zone.host === room;
    if (this.current.searched.has(room) && !(secret && !secret.found && secret.host === room) && !hollow) return "searched";
    if (this.visibleMonsters().length > 0) return "danger";
    return null;
  }

  /** Avancement de la fouille en cours, de 0 à 1 (0 : pas de fouille). */
  searchProgress(): number {
    return this.searching > 0 ? Math.max(0.06, 1 - this.searching / RULES.searchTurns) : 0;
  }

  /** Ordre : fouiller toute la salle (plusieurs tours sur place, puis un jet). Un monstre en vue l'interrompt. */
  search(): boolean {
    if (this.over || this.searchRefusal() !== null) return false;
    this.wait();
    this.waiting = false;
    this.searching = RULES.searchTurns;
    this.events.push({ type: "search", phase: "start" });
    return true;
  }

  /** Pourquoi le héros ne peut pas se cacher maintenant (`null` : il le peut). */
  hideRefusal(): "hidden" | "threatened" | "watched" | "no-cover" | null {
    if (this.hidden) return "hidden";
    if (this.isThreatened()) return "threatened";
    if (this.isWatched()) return "watched";
    if (!this.hasCover(this.hero)) return "no-cover";
    return null;
  }

  /** Ordre : se cacher contre l'obstacle voisin (un tour, un jet au d20). */
  hide(): boolean {
    if (this.over || this.hideRefusal() !== null) return false;
    this.wait();
    this.waiting = false;
    this.hideOrder = true;
    return true;
  }

  /** Cases où le héros peut sauter pour se dégager : à deux cases en ligne droite, passage libre, sans porte ni escalier. */
  jumpCells(): Point[] {
    const cells: Point[] = [];
    const free = (x: number, y: number) =>
      this.map.isWalkable(x, y) && !this.map.isDoor(x, y) && !this.monsterAt(x, y) &&
      this.map.get(x, y) !== Tile.StairsDown && this.map.get(x, y) !== Tile.StairsUp;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        let at: Point = { x: this.hero.x, y: this.hero.y };
        let ok = true;
        // Esquive (voie bleue) : une case plus loin.
        const distance = RULES.jumpDistance + (this.rank("esquive") > 0 ? 1 : 0);
        for (let i = 0; i < distance && ok; i++) {
          const next = { x: at.x + dx, y: at.y + dy };
          // En diagonale, on ne passe pas entre deux murs qui se touchent par le coin.
          if (!free(next.x, next.y) || !this.inReach(at, next)) ok = false;
          at = next;
        }
        if (ok) cells.push(at);
      }
    }
    return cells;
  }

  /** Pourquoi le héros ne peut pas se dégager maintenant (`null` : il le peut). */
  disengageRefusal(): "safe" | "no-room" | null {
    if (!this.isThreatened()) return "safe";
    if (this.jumpCells().length === 0) return "no-room";
    return null;
  }

  /** Ordre : sauter vers cette case (une de `jumpCells`), sans attaque d'opportunité. */
  disengage(x: number, y: number): boolean {
    if (this.over || this.disengageRefusal() !== null) return false;
    if (!this.jumpCells().some((c) => c.x === x && c.y === y)) return false;
    this.wait();
    this.waiting = false;
    this.jumpTarget = { x, y };
    return true;
  }

  /** Le héros sort de sa cachette. */
  private reveal(): void {
    if (!this.hidden) return;
    this.hidden = false;
    this.events.push({ type: "revealed" });
    this.relightHushed();
  }
  /** La torche a été étouffée pour se cacher (elle se rallumera en sortant de l'ombre). */
  private torchHushed = false;

  /** Ordre : se reposer sur place plusieurs tours. Tout autre ordre y renonce, un monstre en vue l'interrompt. */
  rest(): boolean {
    if (this.over || this.restRefusal() !== null) return false;
    this.wait();
    this.waiting = false;
    this.restHidden = 0;
    this.resting = this.restTurns();
    this.events.push({ type: "rest", phase: "start", healed: 0 });
    return true;
  }

  wait(): void {
    if (this.over) return;
    this.picking = false;
    this.resting = 0;
    this.searching = 0;
    this.hideOrder = false;
    this.jumpTarget = null;
    this.pushTargetId = null;
    this.disarmAt = null;
    this.useOrder = null;
    this.throwOrder = null;
    this.skillOrder = null;
    this.clearDoorOrders();
    this.path = [];
    this.targetId = null;
    this.shotTarget = null;
    this.waiting = true;
  }

  // ---------- Déroulement d'un tour ----------

  /** Joue un tour (action du héros, puis des monstres) si une action est en attente. */
  tick(): boolean {
    trackUniques(this.uniques);
    const hpBefore = this.hero.hp;
    const eventsBefore = this.events.length;
    const played = this.playTick();
    // Trajet repris (Thomas, 2026-11-16 : « jusqu'à la prochaine interruption, pas coûte que coûte ») : il s'arrête dès
    // que le héros est blessé, qu'un monstre le remarque, ou qu'un monstre éveillé en vue arrive à 3 cases.
    if (this.wary && this.path.length > 0) {
      const noticed = this.events.slice(eventsBefore).some((e) => e.type === "noticed");
      const close = this.visibleMonsters().some((m) => !m.asleep && m.alerted && gapBetween(m, this.hero) <= RULES.waryStopRange);
      if (this.hero.hp < hpBefore || noticed || close) {
        this.path = [];
        this.targetId = null;
      }
    }
    if (this.path.length === 0) this.wary = false;
    // Une porte a bougé après le dernier calcul de la vue (un monstre l'a refermée) : la vue se refait, comme le ferait
    // une partie reprise (sinon le héros « voit » encore à travers la porte fermée).
    if (this.map.version !== this.visionVersion) this.updateVision();
    return played;
  }

  private visionVersion = -1;

  private playTick(): boolean {
    if (this.over) return false;
    for (const a of [this.hero, ...this.monsters]) {
      a.prevX = a.fromX;
      a.prevY = a.fromY;
      a.fromX = a.x;
      a.fromY = a.y;
    }
    if (this.current.merchant) {
      this.current.merchant.fromX = this.current.merchant.x;
      this.current.merchant.fromY = this.current.merchant.y;
    }

    // À terre (l'onde du Carillon) : le héros passe ce tour à se relever ; tout ordre est oublié.
    if ((this.hero.prone ?? 0) > 0 && this.stoneTurns <= 0) {
      this.hero.prone!--;
      Object.assign(this, { path: [], targetId: null, breakTarget: null, picking: false, resting: 0, searching: 0, hideOrder: false, jumpTarget: null, pushTargetId: null, disarmAt: null, useOrder: null, throwOrder: null, skillOrder: null, shotTarget: null, doorAction: null });
      this.waiting = true;
      if (this.hero.prone === 0) this.events.push({ type: "getUp", actor: this.hero });
    }
    // ENTOILÉ, englué, ligoté (Thomas, 2026-11-18 : « entoilé un tour, tu ne peux rien faire ») : le tour passe entier à
    // se dépêtrer ; ni frapper, ni marcher, ni manger.
    let held = false;
    if ((this.hero.prone ?? 0) <= 0 && (this.hero.stuck ?? 0) > 0 && this.stoneTurns <= 0) {
      held = true;
      this.hero.stuck!--;
      // Le trajet reste (il reprend au tour suivant) ; les autres ordres sont oubliés.
      Object.assign(this, { resting: 0, searching: 0, hideOrder: false, jumpTarget: null, pushTargetId: null, disarmAt: null, useOrder: null, throwOrder: null, skillOrder: null, shotTarget: null, doorAction: null });
      this.waiting = true;
      this.events.push({ type: "stuck" });
    }
    // Statue (potion de pierre) : le héros ne peut rien faire ; tout ordre est oublié, le tour passe.
    if (this.stoneTurns > 0) {
      this.stoneTurns--;
      Object.assign(this, { path: [], targetId: null, breakTarget: null, picking: false, resting: 0, searching: 0, hideOrder: false, jumpTarget: null, pushTargetId: null, disarmAt: null, useOrder: null, throwOrder: null, skillOrder: null, shotTarget: null, doorAction: null });
      this.waiting = true;
      if (this.stoneTurns === 0) this.events.push({ type: "stone", what: "heroBack", actor: this.hero });
    }
    const wasResting = this.resting > 0;
    const wasSearching = this.searching > 0;
    const shotTarget = this.shotTarget;
    this.shotTarget = null;
    if (shotTarget) {
      this.heroShoots(shotTarget);
    } else if (this.doorAction && this.pendingDoor) {
      this.resolveDoor(this.doorAction, this.pendingDoor);
      this.doorAction = null;
    } else if (held) {
      this.waiting = false;
    } else if (this.breakTarget && this.path.length === 0) {
      const at = this.breakTarget;
      this.breakTarget = null;
      if (Math.max(Math.abs(at.x - this.hero.x), Math.abs(at.y - this.hero.y)) === 1) this.resolveBreak(at);
      else return false;
    } else if (this.picking) {
      // Les objets identiques restés sur la case suivent d'eux-mêmes, un par tour.
      this.picking = this.pickUpOne();
    } else if (this.throwOrder) {
      const order = this.throwOrder;
      this.throwOrder = null;
      this.resolveThrow(order);
    } else if (this.skillOrder !== null) {
      const id = this.skillOrder;
      this.skillOrder = null;
      this.resolveSkill(id);
    } else if (this.useOrder !== null) {
      const uid = this.useOrder;
      this.useOrder = null;
      this.resolveUse(uid);
    } else if (this.hideOrder) {
      this.hideOrder = false;
      this.resolveHide();
    } else if (this.pushTargetId !== null) {
      const target = this.monsters.find((m) => m.id === this.pushTargetId);
      this.pushTargetId = null;
      this.disarmAt = null;
    this.useOrder = null;
    this.throwOrder = null;
    this.skillOrder = null;
      if (target && this.inReach(this.hero, target)) this.resolvePush(target);
    } else if (this.jumpTarget) {
      this.resolveJump(this.jumpTarget);
      this.jumpTarget = null;
    } else if (this.disarmAt) {
      const at = this.disarmAt;
      this.disarmAt = null;
      this.resolveDisarm(at);
    } else if (this.searching > 0) {
      this.searching--;
    } else if (this.resting > 0) {
      this.resting--;
      // Caché avant de se reposer : l'ombre ne dure pas tout le repos (Thomas, 2026-11-13).
      if (this.hidden && ++this.restHidden >= RULES.hideRestTurns) this.reveal();
    } else if (this.waiting) {
      this.waiting = false;
    } else {
      if (this.targetId !== null) {
        // La cible a pu bouger : on recalcule le chemin vers elle.
        const target = this.monsters.find((m) => m.id === this.targetId);
        // Au contact (y compris en diagonale par-delà un coin de mur) : on frappe sans avoir à contourner.
        this.path = target ? (this.inReach(this.hero, target) || this.inWeaponReach(target) ? [{ x: target.x, y: target.y }] : (findPath(this.map, this.hero, target, this.avoidTraps(target)) ?? [])) : [];
        if (!target) this.targetId = null;
      }
      const next = this.path[0];
      if (!next) return false;
      // Le Colporteur sur le chemin : si on allait le voir, on s'arrête et sa boutique s'ouvre ; sinon il s'écarte
      // (il prend la place du héros) et on passe.
      // Gluck sur le chemin : on s'arrête à côté de lui (la conversation s'ouvre) ; sinon il s'écarte, comme le Colporteur.
      // Marcher sur le poulet : il prend peur.
      if (this.chickenAt(next.x, next.y)) {
        this.path = [];
        this.scareChicken(this.chickenAt(next.x, next.y));
        return true;
      }
      const npcOnPath = this.npcAt(next.x, next.y);
      if (npcOnPath && this.talkTarget) {
        const who = this.talkTarget;
        this.path = [];
        this.talkTarget = null;
        if (this.nextToNpc(who)) this.events.push({ type: "npc", what: "talk", who });
        return false;
      }
      if (npcOnPath) {
        const spot = this.npc(npcOnPath)!;
        spot.x = this.hero.x;
        spot.y = this.hero.y;
      }
      const peddler = this.merchantAt(next.x, next.y);
      if (peddler && this.shopTarget) {
        this.path = [];
        this.shopTarget = false;
        if (this.nextToMerchant()) this.openShop();
        return false;
      }
      if (peddler) {
        peddler.x = this.hero.x;
        peddler.y = this.hero.y;
        peddler.target = null;
      }
      const blocker = this.monsterAt(next.x, next.y);
      if (blocker) {
        this.heroAttacks(blocker);
        this.path = [];
        this.targetId = null; // un toucher = une attaque
      } else {
        // Les monstres alertés au contact avant le pas : s'en éloigner leur offre une attaque d'opportunité.
        const threats = this.monsters.filter((m) => m.alerted && this.inReach(m, this.hero));
        const left = { x: this.hero.x, y: this.hero.y };
        this.path.shift();
        this.hero.x = next.x;
        this.hero.y = next.y;
        this.openDoorAt(next.x, next.y);
        this.closeDoorAt(left.x, left.y);
        this.useFeatureAt(next.x, next.y);
        this.collectGold();
        this.springTrap(this.hero);
        if (this.over) return true;
        this.enterWeb();
        this.crunch();
        this.openNiche();
        const puff = this.puffballAt(this.hero.x, this.hero.y);
        if (puff) this.burstPuffball(puff);
        // Caché, on peut longer les murs ; s'écarter de tout abri fait sortir de l'ombre.
        if (this.hidden && !this.hasCover(this.hero)) this.reveal();
        // Marcher sur un escalier, c'est le prendre (à la fin du pas). Y arriver par l'autre étage ne compte pas.
        const here = this.map.get(next.x, next.y);
        this.pendingStairs = here === Tile.StairsDown ? "down" : here === Tile.StairsUp ? "up" : null;
        // Passer une porte pour se mettre à l'abri (y entrer ou en ressortir) ne laisse pas le temps de frapper.
        const throughDoor = this.map.isDoor(next.x, next.y) || this.map.isDoor(left.x, left.y);
        if (throughDoor) {
          // Ceux à qui le héros échappe ainsi sont sur leurs gardes : pas d'embuscade contre eux ensuite.
          for (const m of threats) if (!this.inReach(m, this.hero)) m.wary = true;
        }
        // Se cacher derrière un angle de mur (Thomas, 2026-11-15 : « pas d'attaque d'opportunité si je me cache derrière
        // le mur ») : le monstre qui ne voit plus franchement la case d'arrivée ne frappe pas.
        // Fuir une goutte d'encre annoncée (Carillon, Thomas 2026-11-16) : personne ne frappe, ils esquivent aussi.
        const dodging = this.inkMarkedAt(left.x, left.y);
        const striking = dodging ? [] : threats.filter((m) => hasClearSight(this.map, m, next));
        if (!throughDoor && this.opportunityAttacks(striking)) {
          // Après une attaque d'opportunité, le déplacement s'arrête : au joueur de décider de la suite.
          this.path = [];
          this.doorTarget = null;
        }
        if (this.path.length === 0 && this.shopTarget) {
          this.shopTarget = false;
          if (this.nextToMerchant()) this.openShop();
        }
        if (this.path.length === 0 && this.talkTarget) {
          const who = this.talkTarget;
          this.talkTarget = null;
          if (this.nextToNpc(who)) this.events.push({ type: "npc", what: "talk", who });
        }
        if (this.path.length === 0 && this.doorTarget) {
          // Arrivé devant la porte verrouillée : au joueur de décider.
          this.pendingDoor = this.doorTarget;
          this.doorTarget = null;
          this.useKeyIfAny();
        }
      }
    }

    this.sandboxHubCheck();
    this.zoneStep();
    this.questTick();
    this.boutTick();
    this.turn++;
    // Tocsin : le temps passé sur l'étage fait monter l'alerte, et chaque coup échangé fait du bruit.
    if (this.turn % RULES.alarmTurnsPerPoint === 0) this.raiseAlarm(1);
    this.respawn();
    if (this.debris.some((d) => d.until <= this.turn)) this.debris = this.debris.filter((d) => d.until > this.turn);
    if (this.torchLit()) {
      this.torchTurns--;
      if (this.torchTurns === 0) this.events.push({ type: "torchOut" });
    }
    // La lumière suit la torche portée et celles qu'on ramasse ou qu'on pose.
    const groundTorches = this.ground.filter((g) => g.item === "torche").length;
    // La lueur du PNJ de quête suit le PNJ, et s'éteint quand la quête finit.
    const giver = this.quest ? this.npc(QUEST_TASKS[this.quest.id].npc) : null;
    const giverKey = giver ? `${giver.x},${giver.y}` : "";
    if (this.torchLit() || groundTorches !== this.lastGroundTorches || this.torchWasLit || giverKey !== this.lastGiverKey) this.refreshLight();
    this.lastGiverKey = giverKey;
    this.lastGroundTorches = groundTorches;
    this.torchWasLit = this.torchLit();
    this.updateVision();
    const resting = wasResting;
    // Vitesse d'attaque : selon le temps pris par l'action du héros, les monstres jouent 0, 1 ou 2 fois.
    this.clock += this.actionCost - 1;
    this.actionCost = 1;
    let rounds = 1;
    if (this.clock >= 1 - 1e-9) {
      rounds = 2;
      this.clock -= 1;
    } else if (this.clock <= -1 + 1e-9) {
      rounds = 0;
      this.clock += 1;
    }
    this.heroPoisonTick();
    for (let r = 0; r < rounds && !this.over; r++) {
      this.poisonTick();
      this.monstersAct();
    }
    this.merchantAct();
    this.burn();
    this.bombTick();
    this.meltSnow();
    this.gasTick();
    this.fogTick();
    this.ossuaryTick();
    this.fakeWallTick();
    this.sporeBlast();
    this.hushTick();
    this.npcsFlee();
    this.counterChatter();
    // Salle d'essai : Gluck et Sœur Osseuse reviennent quelques tours après être partis, pour montrer la scène suivante.
    for (const gk of [this.current.gluck, this.current.soeur, this.current.krik, this.current.grum, this.current.fifrelin, this.current.morillon, this.current.vernis, this.current.maestro, this.current.plumeau, this.current.clavicule, this.current.osselet]) {
      if (gk && gk.gone && gk.backAt !== undefined && this.turn >= gk.backAt && !this.actorAt(gk.x, gk.y)) {
        Object.assign(gk, { gone: false, backAt: undefined, opened: false, intro: undefined, pending: undefined, pendingLines: undefined, haggled: false, drumDone: false });
      }
    }
    if (this.hasteTurns > 0) this.hasteTurns--;
    if (this.urchinTurns > 0) this.urchinTurns--;
    if ((this.hero.grown ?? 0) > 0 && --this.hero.grown! === 0) this.events.push({ type: "grow", actor: this.hero, back: true });
    this.fluteTick();
    this.speciesBrawl();
    this.moveHens();
    if (this.protectTurns > 0) {
      this.protectTurns--;
      if (this.protectTurns === 0) this.refreshStats();
    }
    if (this.blessTurns > 0) {
      this.blessTurns--;
      if (this.blessTurns === 0) {
        this.refreshStats();
        this.events.push({ type: "blessEnd" });
      }
    }
    if (resting) this.afterRestTurn();
    if (wasSearching) this.afterSearchTurn();
    return true;
  }

  /** Discrétion du héros : celle de sa classe, moins le malus d'une armure lourde (cotte de mailles, harnois). */
  stealthBonus(): number {
    // Thomas (2026-11-13) : l'équipement ne touche plus à la discrétion. La race compte (Halfelin : +3).
    return this.heroClass.stealthBonus + this.race.stealthBonus;
  }

  /** Jet pour se cacher. Réussi : les monstres perdent la trace du héros et redeviennent de simples promeneurs. */
  private resolveHide(): void {
    // Torche allumée (Thomas, 2026-11-17 : « elle ne devrait pas empêcher de se cacher ; elle devrait s'éteindre toute
    // seule et se rallumer après ») : on l'étouffe avant le jet ; elle se rallume si on reste visible, ou en sortant
    // de l'ombre.
    if (this.torchLit()) {
      this.torchOff = true;
      this.torchHushed = true;
      this.refreshLight();
      this.events.push({ type: "torchHush", lit: false });
    }
    const bonus = this.stealthBonus();
    let d20 = this.rng.int(1, 20);
    let total = d20 + bonus;
    let success = d20 === 20 || (d20 !== 1 && total >= RULES.hideDc);
    if (!success && this.useStubborn()) {
      d20 = this.rng.int(1, 20);
      total = d20 + bonus;
      success = d20 === 20 || (d20 !== 1 && total >= RULES.hideDc);
    }
    if (success) {
      this.hidden = true;
      for (const m of this.monsters) {
        if (!m.alerted) continue;
        m.alerted = false;
        m.asleep = false;
        m.wary = false;
        // Le frondeur, lui, va voir là où le héros a disparu (Thomas, 2026-11-12, soir : « pareil si le joueur se
        // cache ») ; les autres restent sur place un moment.
        const sling = (MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef | undefined)?.sling;
        m.goal = sling ? { x: this.hero.x, y: this.hero.y } : undefined;
        m.lost = sling ? 0 : RULES.hideLostTurns;
      }
    }
    this.events.push({ type: "hide", d20, bonus, total, success });
    if (!success) this.relightHushed();
  }

  /** La torche étouffée pour se cacher se rallume (raté, ou sortie de l'ombre). */
  private relightHushed(): void {
    if (!this.torchHushed) return;
    this.torchHushed = false;
    if (this.torchTurns <= 0 || !this.torchOff) return;
    this.torchOff = false;
    this.refreshLight();
    this.events.push({ type: "torchHush", lit: true });
  }

  /**
   * Poussée : réussie, le monstre recule d'une case dans l'axe du héros et perd son prochain tour ;
   * s'il bute sur un mur, une colonne ou une porte fermée, il reste en place mais encaisse des dégâts en plus.
   * S'il recule sur un piège, le piège se déclenche.
   */
  private resolvePush(m: Actor): void {
    m.heroHurt = true;
    this.reveal();
    // Le battant du Carillon : une poussée réussie l'arrache (Thomas, 2026-11-16).
    if (this.isInert(m)) {
      const d20 = this.rng.int(1, 20);
      // À l'abri sous le chapeau (hors de l'avertissement) : seul un 20 naturel l'arrache.
      const guarded = m.armorClass >= RULES.carillonClapperGuard;
      const ok = d20 === 20 || (!guarded && d20 !== 1 && d20 + this.pushBonus() >= RULES.pushDc);
      this.events.push({ type: "push", target: m, d20, bonus: this.pushBonus(), total: d20 + this.pushBonus(), success: ok, moved: false, slam: 0 });
      // Trois poussées réussies pour l'arracher (Thomas, 2026-11-19 ; une seule suffisait : le boss ne filtrait plus
      // rien). Chaque poussée l'ébranle d'un tiers.
      if (ok) {
        m.hp -= Math.ceil(m.maxHp / RULES.carillonClapperPushes);
        if (m.hp <= 0) {
          m.hp = 0;
          this.removeIfDead(m);
        }
      }
      return;
    }
    // Bousculade (voie rouge, ex-Enchaînement ; Thomas, 2026-11-13 : « un boost pour pousser ») : +2 puis +4 au jet,
    // et la poussée envoie une case plus loin.
    const shove = this.rank("enchainement");
    const bonus = this.pushBonus() + this.race.pushBonus + [0, 2, 4][shove];
    let d20 = this.rng.int(1, 20);
    let total = d20 + bonus;
    let success = d20 === 20 || (d20 !== 1 && total >= RULES.pushDc);
    if (!success && this.useStubborn()) {
      d20 = this.rng.int(1, 20);
      total = d20 + bonus;
      success = d20 === 20 || (d20 !== 1 && total >= RULES.pushDc);
    }
    m.alerted = true;
    m.asleep = false;
    let moved = false;
    let slam = 0;
    if (success) {
      const dx = Math.sign(m.x - this.hero.x);
      const dy = Math.sign(m.y - this.hero.y);
      const distance = shove > 0 ? 2 : 1;
      for (let k = 0; k < distance; k++) {
        const to = { x: m.x + dx, y: m.y + dy };
        const t = this.map.get(to.x, to.y);
        const solid = !this.map.isWalkable(to.x, to.y) || t === Tile.DoorClosed;
        if (!solid && !this.actorAt(to.x, to.y) && canStep(this.map, m.x, m.y, dx, dy)) {
          m.x = to.x;
          m.y = to.y;
          moved = true;
          if (this.isTrap(m.x, m.y)) break;
        } else {
          if (solid) {
            slam = rollDice(this.rng, RULES.pushSlamDamage);
            m.hp -= slam;
          }
          break;
        }
      }
    }
    // À TERRE (Thomas, 2026-11-13 : « pousser peut faire coucher par terre un ennemi ») : contre un mur, ou au hasard
    // (plus souvent avec la Bousculade). Renversé, il perd son tour à se relever, et on le frappe avec l'avantage.
    // Sinon il est seulement sonné (il perd son tour).
    const prone = success && !m.boss && (slam > 0 || this.rng.chance(RULES.pushProneChance + RULES.pushProneBonus * shove));
    if (prone) m.prone = 1;
    else if (success) m.stunned = 1;
    // Rencontre 2 de Gluck : chaque poussée réussie sur son concurrent compte.
    const rq = this.quest;
    if (success && rq?.id === "gluck_rival" && rq.target === m.id && rq.got < rq.need) rq.got++;
    this.events.push({ type: "push", target: m, d20, bonus, total, success, moved, slam, prone });
    if (m.hp <= 0) {
      this.removeIfDead(m);
      return;
    }
    if (moved) this.springTrap(m);
  }

  /** Fin d'un tour de fouille : un monstre en vue l'interrompt (la salle n'est pas perdue) ; au dernier tour, le jet. */
  private afterSearchTurn(): void {
    if (this.over) return;
    if (this.visibleMonsters().length > 0) {
      this.searching = 0;
      this.events.push({ type: "search", phase: "interrupted" });
      return;
    }
    if (this.searching > 0) return;
    const index = this.roomIndexAt(this.hero);
    if (index < 0) {
      this.searchCorridor();
      return;
    }
    this.current.searched.add(index);
    const secret = this.current.secretRoom;
    // Un creux du mur entrevu : on sait où chercher (+5).
    const bonus = this.heroClass.searchBonus + (secret && !secret.found && secret.host === index && secret.glimpsed ? RULES.secretGlimpseBonus : 0);
    const d20 = this.rng.int(1, 20);
    const total = d20 + bonus;
    let success = d20 === 20 || (d20 !== 1 && total >= RULES.searchDc);
    const found: Point[] = [];
    const traps: Point[] = [];
    // Un passage secret qui jouxte la salle se trouve D'OFFICE à la fouille, quel que soit le dé (Thomas, 2026-11-15 :
    // « pas besoin d'être pile en face ») : la pièce secrète, et le tonneau creux de Gluck.
    const zone0 = this.current.zone;
    if ((secret && !secret.found && secret.host === index) || (zone0 && zone0.door === "barrel" && !zone0.open && !zone0.noticed && zone0.host === index)) {
      if (!success) {
        success = true;
        this.searchLuck = true;
      }
    }
    if (success) {
      for (const s of this.searchLuck ? [] : this.current.secrets) {
        if (s.room !== index || s.found) continue;
        s.found = true;
        this.dropItem(s.x, s.y, s.item, s.count);
        found.push({ x: s.x, y: s.y });
      }
      // La pièce secrète derrière un mur de la salle (Thomas, 2026-11-14) : le pan de mur cède, le passage s'ouvre.
      if (secret && !secret.found && secret.host === index) {
        secret.found = true;
        this.map.set(secret.entry.x, secret.entry.y, Tile.Floor);
        this.current.rooms.push(secret.room);
        this.openSecretMark(secret.entry);
        found.push({ ...secret.entry });
        this.events.push({ type: "secret", what: "found", x: secret.entry.x, y: secret.entry.y });
        this.refreshLight();
      }
      // Le tonneau creux de Gluck (Thomas, 2026-11-14 : « qu'on le trouve si on cherche ») : il sonne creux, il brille.
      const zone = this.current.zone;
      if (zone && zone.door === "barrel" && !zone.open && !zone.noticed && zone.host === index) {
        zone.noticed = true;
        found.push({ ...zone.entry });
        this.map.touch(zone.entry.x, zone.entry.y);
        this.events.push({ type: "zone", what: "found", x: zone.entry.x, y: zone.entry.y });
      }
      // Pièges cachés de la salle (Thomas, 2026-11-13) : une fouille réussie les révèle (pas celle qui n'a réussi que
      // grâce au passage secret, ni les caches : le dé, lui, était raté).
      const room = this.rooms[index];
      for (const t of this.searchLuck ? [] : this.current.traps) {
        if (!t.hidden || t.x < room.x || t.y < room.y || t.x >= room.x + room.w || t.y >= room.y + room.h) continue;
        t.hidden = false;
        traps.push({ x: t.x, y: t.y });
      }
    }
    // Le dé était raté : la salle elle-même n'est pas fouillée, on pourra recommencer.
    if (this.searchLuck) this.current.searched.delete(index);
    this.searchLuck = false;
    this.events.push({ type: "searched", d20, bonus, total, success, found, traps, room: this.rooms[index] });
  }

  /** Fouille dans un couloir : les pièges cachés des couloirs à 5 cases du héros (même jet que dans une salle). La
   *  vague balaie le carré de 5 cases autour de lui. */
  private searchCorridor(): void {
    const reach = RULES.corridorSearchReach;
    const bonus = this.heroClass.searchBonus;
    const d20 = this.rng.int(1, 20);
    const total = d20 + bonus;
    const success = d20 === 20 || (d20 !== 1 && total >= RULES.searchDc);
    const traps: Point[] = [];
    if (success) {
      for (const t of this.current.traps) {
        if (!t.hidden || Math.max(Math.abs(t.x - this.hero.x), Math.abs(t.y - this.hero.y)) > reach || this.roomIndexAt(t) >= 0) continue;
        t.hidden = false;
        traps.push({ x: t.x, y: t.y });
      }
    }
    const box = { x: this.hero.x - reach, y: this.hero.y - reach, w: reach * 2 + 1, h: reach * 2 + 1 } as Room;
    this.events.push({ type: "searched", d20, bonus, total, success, found: [], traps, room: box, corridor: true });
  }

  /** La fouille n'a réussi que parce qu'un passage secret jouxte la salle (le reste de la salle n'est pas fouillé). */
  private searchLuck = false;

  /** Saut pour se dégager : il faut réussir un jet. Réussi, pas d'attaque d'opportunité, mais ceux qu'on quitte restent sur leurs gardes. */
  private resolveJump(to: Point): void {
    const threats = this.monsters.filter((m) => m.alerted && this.inReach(m, this.hero));
    const from = { x: this.hero.x, y: this.hero.y };
    const bonus = this.disengageBonus();
    let d20 = this.rng.int(1, 20);
    let total = d20 + bonus;
    let success = d20 === 20 || (d20 !== 1 && total >= RULES.disengageDc);
    if (!success && this.useStubborn()) {
      d20 = this.rng.int(1, 20);
      total = d20 + bonus;
      success = d20 === 20 || (d20 !== 1 && total >= RULES.disengageDc);
    }
    if (!success) {
      // Raté : le héros reste au contact, et le tour est perdu.
      this.events.push({ type: "jump", fromX: from.x, fromY: from.y, x: from.x, y: from.y, d20, bonus, total, success });
      return;
    }
    this.hero.x = to.x;
    this.hero.y = to.y;
    this.collectGold();
    // Un avantage à la fois : après s'être dégagé, pas d'embuscade contre ceux qu'on vient de fuir.
    for (const m of threats) m.wary = true;
    this.events.push({ type: "jump", fromX: from.x, fromY: from.y, x: to.x, y: to.y, d20, bonus, total, success });
  }

  /** Fin d'un tour de repos : un monstre en vue l'interrompt (le repos de l'étage n'est pas perdu) ; au dernier tour, il soigne. */
  private afterRestTurn(): void {
    if (this.over) return;
    if (this.visibleMonsters().length > 0) {
      this.resting = 0;
      this.events.push({ type: "rest", phase: "interrupted", healed: 0 });
    } else if (this.resting === 0) {
      // Moins de soins gratuits en bas (Thomas, 2026-11-19 : « la difficulté doit augmenter au fur et à mesure ») : le
      // repos rend la moitié de la vie manquante en section 1 ; en section 2, de moins en moins à chaque étage.
      const deep = RULES.restHealShareDeep;
      const share = this.depth > RULES.floorsPerSection ? deep[Math.min(deep.length - 1, (this.depth - 1) % RULES.floorsPerSection)] : RULES.restHealShare;
      const healed = Math.ceil((this.hero.maxHp - this.hero.hp) * share);
      this.hero.hp += healed;
      this.current.rested = true;
      this.current.rests = (this.current.rests ?? 0) + 1;
      this.events.push({ type: "rest", phase: "done", healed });
    }
  }

  /**
   * Vrai si `a` peut frapper `b` : case voisine. En diagonale, on peut frapper par-delà un coin de mur,
   * mais pas à travers deux murs qui se touchent par le coin.
   */
  private inReach(a: Point & { size?: number }, b: Point & { size?: number }): boolean {
    // Un grand monstre (2 × 2) touche tout ce qui borde son carré.
    if (sizeOf(a) > 1 || sizeOf(b) > 1) return gapBetween(a, b) === 1;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return false;
    if (dx === 0 || dy === 0) return true;
    return this.map.isWalkable(a.x + dx, a.y) || this.map.isWalkable(a.x, a.y + dy);
  }

  /**
   * Arme à longue portée (lance) : le monstre est à deux cases en ligne droite ou en diagonale,
   * la case du milieu est libre (ni mur, ni colonne, ni porte fermée, ni monstre), et on le voit.
   */
  inWeaponReach(m: Point): boolean {
    const reach = this.weapon("melee")?.reach ?? 1;
    if (reach < 2) return false;
    const dx = m.x - this.hero.x;
    const dy = m.y - this.hero.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) return false;
    if (!(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) return false;
    const mid = { x: this.hero.x + dx / 2, y: this.hero.y + dy / 2 };
    if (!this.map.isWalkable(mid.x, mid.y) || this.map.blocksSight(mid.x, mid.y) || this.monsterAt(mid.x, mid.y)) return false;
    return this.isVisible(m.x, m.y);
  }

  /** Le poison ronge les monstres empoisonnés, au début de leur tour. */
  /** Le héros empoisonné (aiguille, gaz) perd ses PV une fois par tour, quelle que soit la vitesse de son arme. */
  private heroPoisonTick(): void {
    if (!this.hero.poison || this.over) return;
    const damage = this.hero.poison.damage;
    // Clarté (Sœur Osseuse) : le poison s'use deux fois plus vite.
    this.hero.poison.turns -= this.clarityActive() ? 2 : 1;
    if (this.hero.poison.turns <= 0) this.hero.poison = undefined;
    this.events.push({ type: "poison", actor: this.hero, damage });
    this.hurtHero(damage, "le poison");
  }

  private poisonTick(): void {
    for (const m of [...this.monsters]) {
      if (!m.poison) continue;
      m.hp -= m.poison.damage;
      m.poison.turns--;
      this.events.push({ type: "poison", actor: m, damage: m.poison.damage });
      if (m.poison.turns <= 0) m.poison = undefined;
      this.removeIfDead(m);
    }
  }

  /** Vrai si `a` et `b` se touchent en diagonale autour d'un coin de mur : celui qui frappe surprend l'autre. */
  /**
   * AVANTAGE (Thomas, 2026-11-13 : « une mécanique centrale ; lisible et prévisible ; jamais les deux camps à la fois »).
   * L'attaquant A a l'avantage sur le défenseur D si l'une de ces situations est vraie, ET si elle ne l'est pas aussi
   * dans l'autre sens (voir plus bas) :
   *  1. SURPRISE : D ne l'a pas remarqué (monstre qui dort ou se promène).
   *  2. À TERRE : D est renversé (poussée), ou la Tisseuse est sur le dos.
   *  3. EMBRASURE : D se tient dans une porte, A non.
   *  4. EMBUSCADE : A n'a pas bougé à son dernier tour, et D vient d'arriver d'une case d'où il ne voyait pas A
   *     (il passe une porte, contourne une colonne, un meuble ou un angle de mur) : celui qui attend frappe le premier.
   * Thomas, 2026-11-16 : « jamais deux avantages de suite » et le monstre « sur ses gardes » sont RETIRÉS (« une erreur ») ;
   * et quand chacun aurait l'avantage sur l'autre, il REVIENT AU JOUEUR (entre deux monstres, ils s'annulent toujours).
   */
  hasEdge(a: Actor, d: Actor): boolean {
    const mine = this.edgeReasons(a, d);
    if (mine.length === 0) return false;
    // Celui qui est à terre ne menace personne : sa propre situation ne compte pas.
    if (mine.includes("prone")) return true;
    if (this.edgeReasons(d, a).length === 0) return true;
    return a === this.hero;
  }

  /** Les raisons pour lesquelles A aurait l'avantage sur D (sans tenir compte de l'autre sens). */
  edgeReasons(a: Actor, d: Actor): ("surprise" | "prone" | "door" | "ambush")[] {
    const out: ("surprise" | "prone" | "door" | "ambush")[] = [];
    if (d !== this.hero && !d.alerted) out.push("surprise");
    if ((d.prone ?? 0) > 0 || (d.boss && d.boss.fallen > 0)) out.push("prone");
    if (cellsOf(d).some((c) => this.map.isDoor(c.x, c.y)) && !cellsOf(a).some((c) => this.map.isDoor(c.x, c.y))) out.push("door");
    // D est arrivé APRÈS A (Thomas, 2026-11-15 : arrêté depuis un tour, le monstre qui débouche de l'angle donne
    // l'avantage ; avant, il fallait être resté immobile deux tours, et celui qui venait d'arriver gagnait aussi).
    if (this.stepAge(d) < this.stepAge(a)) {
      const from = this.lastStepFrom(d);
      // Embuscade : il arrive d'une case d'où il ne voyait pas A franchement (un mur, une porte, une colonne, ou un
      // angle de mur frôlé en diagonale : Thomas, 2026-11-15).
      if (from && !hasClearSight(this.map, from, a)) out.push("ambush");
    }
    return out;
  }

  /** Depuis quand ce personnage a bougé : 0 ce tour-ci, 1 au tour précédent, l'infini s'il est resté sur place. */
  private stepAge(a: Actor): number {
    if (a.fromX !== a.x || a.fromY !== a.y) return 0;
    if (a.prevX !== undefined && a.prevY !== undefined && (a.prevX !== a.fromX || a.prevY !== a.fromY)) return 1;
    return Infinity;
  }

  /** D'où ce personnage est parti à son dernier pas (ce tour-ci, ou au tour précédent) ; null s'il n'a pas bougé. */
  private lastStepFrom(a: Actor): Point | null {
    if (a.fromX !== a.x || a.fromY !== a.y) return { x: a.fromX, y: a.fromY };
    if (a.prevX !== undefined && a.prevY !== undefined && (a.prevX !== a.fromX || a.prevY !== a.fromY)) return { x: a.prevX, y: a.prevY };
    return null;
  }

  /** Le héros aurait-il l'avantage en frappant ce monstre maintenant ? (cible distraite, dans une porte, ou au coin d'un mur) */
  heroHasAdvantageOn(monster: Actor): boolean {
    return this.hasEdge(this.hero, monster);
  }

  /**
   * L'anneau doré sous un monstre : le héros aurait l'avantage en l'attaquant maintenant, au contact, ou, pour l'Elfe
   * (œil de lynx), en lui tirant dessus à l'arc : cible en vue, à portée, à 5 cases ou plus, et aucun ennemi au contact.
   */
  heroEdgeShown(m: Actor): boolean {
    if (this.heroHasAdvantageOn(m)) return true;
    if (!this.lynxShot(m) || !this.isVisible(m.x, m.y)) return false;
    const profile = this.shotProfile();
    if (!profile || profile.thrown) return false;
    if (Math.max(Math.abs(m.x - this.hero.x), Math.abs(m.y - this.hero.y)) > profile.range) return false;
    return !this.monsters.some((o) => o.alerted && this.inReach(o, this.hero));
  }

  /** ŒIL DE LYNX (Elfe) : cette case est-elle assez loin pour que son tir à l'arc ait l'avantage ? */
  lynxShot(p: Point): boolean {
    const far = this.race.lynxRange;
    return far > 0 && Math.max(Math.abs(p.x - this.hero.x), Math.abs(p.y - this.hero.y)) >= far;
  }

  /**
   * Le monstre à frapper si l'on touche le dé : celui qu'on frappait déjà s'il est toujours au contact,
   * sinon un monstre alerté au contact (le plus abîmé d'abord), sinon n'importe quel monstre visible au contact.
   */
  meleeTarget(): Actor | null {
    const near = this.visibleMonsters().filter((m) => this.inReach(this.hero, m) || this.inWeaponReach(m));
    if (near.length === 0) return null;
    const last = near.find((m) => m.id === this.lastFoeId);
    if (last) return last;
    const alerted = near.filter((m) => m.alerted);
    const pool = alerted.length > 0 ? alerted : near;
    return pool.reduce((a, b) => (b.hp < a.hp ? b : a));
  }

  /** Ordre : frapper au corps à corps le monstre désigné par `meleeTarget` (un tour). */
  strike(): boolean {
    const target = this.over ? null : this.meleeTarget();
    if (!target) return false;
    return this.setDestination(target.x, target.y);
  }

  /** Un ennemi alerté est-il au contact du héros ? */
  /** En plein combat : un monstre qui traque le héros est en vue. On ne place pas de points à ce moment-là (Thomas). */
  /** Le Colporteur de l'étage, s'il y en a un. */
  merchant(): Merchant | null {
    return this.current.merchant ?? null;
  }

  merchantAt(x: number, y: number): Merchant | null {
    const m = this.current.merchant;
    return m && m.x === x && m.y === y ? m : null;
  }

  private nextToMerchant(): boolean {
    const m = this.current.merchant;
    return !!m && !m.hidden && Math.max(Math.abs(m.x - this.hero.x), Math.abs(m.y - this.hero.y)) === 1;
  }

  /** Peut-on commercer maintenant ? Il faut être à côté de lui, qu'il soit visible, et pas en plein combat. */
  canTrade(): boolean {
    return !this.over && this.nextToMerchant() && !this.inCombat();
  }

  private openShop(): void {
    if (!this.canTrade()) return;
    const m = this.current.merchant!;
    this.events.push({ type: "shop", line: Math.floor(mix(this.turn, m.x, m.y) * MERCHANT.lines.length) });
  }

  private approachMerchant(m: Merchant): boolean {
    this.clearDoorOrders();
    this.targetId = null;
    this.waiting = false;
    if (this.nextToMerchant()) {
      this.path = [];
      this.openShop();
      return true;
    }
    let best: Point[] | null = null;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const to = { x: m.x + dx, y: m.y + dy };
      if (!this.map.isWalkable(to.x, to.y) || this.monsterAt(to.x, to.y)) continue;
      const path = this.heroPath(to, (cx, cy) => this.isKnown(cx, cy) && !(cx === m.x && cy === m.y));
      if (path && (!best || path.length < best.length)) best = path;
    }
    if (!best) return false;
    this.path = best;
    this.shopTarget = true;
    return true;
  }

  /** Le prix payé au Colporteur pour ce lot : le Charisme le fait baisser (Thomas, 2026-11-16). */
  buyPrice(price: number): number {
    // Ticket d'exposition (Vernis) : un article gratuit par étage.
    if (this.ticketReady()) return 0;
    const cut = Math.min(RULES.charismaDiscountMax, Math.max(0, this.charisma()) * RULES.charismaDiscount);
    return Math.max(1, Math.round(price * (1 - cut)));
  }

  /** Acheter le lot n° `index` : il faut l'or et la place dans le sac ; ne prend pas de tour. */
  buy(index: number): "ok" | "gold" | "full" | "none" | "away" {
    const m = this.current.merchant;
    const ware = m?.wares[index];
    if (!m || !ware) return "none";
    if (!this.canTrade()) return "away";
    const price = this.buyPrice(ware.price);
    if (this.gold < price) return "gold";
    const left = this.inventory.add(ware.item, ware.count);
    // Sac plein (Thomas) : ce qui ne tient pas rebondit au sol à côté du héros.
    if (left > 0) this.bounceFromHero(ware.item, left);
    if (price === 0 && this.ticketReady()) this.perks().ticket = 1;
    this.gold -= price;
    m.wares.splice(index, 1);
    this.events.push({ type: "bought", item: ware.item, count: ware.count, price });
    return "ok";
  }

  /**
   * Sac plein (Thomas, 2026-11-12) : l'objet part du héros et rebondit au sol sur la case libre la plus proche (sans
   * objet, meuble, piège ni escalier, du même côté des murs) ; à défaut, à ses pieds.
   */
  private bounceFromHero(item: ItemId, count: number): void {
    const h = this.hero;
    const at = this.landingCell(h, item);
    this.dropItem(at.x, at.y, item, count);
    this.events.push({ type: "bounce", item, count, fromX: h.x, fromY: h.y, x: at.x, y: at.y, messy: this.inventory.fitsIfTidied(item) });
  }

  /**
   * La case libre la plus proche de `o` où poser un objet (sans objet, meuble, piège, monstre ni héros, du même côté des
   * murs), jusqu'à 3 cases ; à défaut, la case `o` elle-même. `skip` : une case à éviter aussi (celle de Gluck).
   */
  private landingCell(o: Point, item: ItemId, skip?: Point): Point {
    const h = this.hero;
    const free = (x: number, y: number) =>
      (this.map.get(x, y) === Tile.Floor || this.map.get(x, y) === Tile.Gravel) &&
      !(x === h.x && y === h.y) &&
      !(skip && x === skip.x && y === skip.y) &&
      !this.furnitureAt(x, y) &&
      !this.isTrap(x, y) &&
      !this.monsterAt(x, y) &&
      !this.merchantAt(x, y) &&
      !this.ground.some((g) => g.x === x && g.y === y) &&
      hasLineOfSight(this.map, o, { x, y });
    for (let r = 1; r <= 3; r++) {
      const ring: Point[] = [];
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) ring.push({ x: o.x + dx, y: o.y + dy });
      const ok = ring.filter((p) => free(p.x, p.y));
      if (ok.length > 0) return ok[Math.floor(mix(this.turn, ok.length, item.length) * ok.length)];
    }
    return { x: o.x, y: o.y };
  }

  /** Ce que le Colporteur donne pour cet objet du sac (tout le tas) ; null s'il n'en veut pas. */
  sellPrice(uid: number): number | null {
    const item = this.inventory.get(uid);
    if (!item) return null;
    const unit = buyBackPrice(item.defId);
    return unit === null ? null : unit * item.count;
  }

  /** Vendre un objet du sac (tout le tas) ; ne prend pas de tour. */
  sell(uid: number): boolean {
    const price = this.sellPrice(uid);
    if (price === null || !this.canTrade()) return false;
    const item = this.inventory.removeItem(uid);
    if (!item) return false;
    this.gold += price;
    this.events.push({ type: "sold", item: item.defId, count: item.count, price });
    return true;
  }

  /**
   * Le Colporteur flâne dans sa salle, un pas tous les 2 tours ; il attend quand le héros est tout près. Un monstre à
   * 4 cases ou moins : il se cache (on le devine à peine) et ne bouge plus ; il réapparaît quand ils sont partis.
   */
  private merchantAct(): void {
    const m = this.current.merchant;
    if (!m) return;
    // Il ne quitte plus l'étage quand l'alerte monte (Thomas, 2026-11-18 : « retire la règle des 50 % d'alerte ») : il
    // reste jusqu'au bout, et se cache seulement quand un monstre approche.
    const near = (p: Point, r: number) => Math.max(Math.abs(p.x - m.x), Math.abs(p.y - m.y)) <= r;
    // Il se cache dès qu'un monstre approche (6 cases), ou qu'un monstre éveillé entre dans sa salle
    // (Thomas, 2026-11-12 : « le colpo n'est pas devenu invisible » : à 4 cases, il restait visible pendant les combats).
    const r0 = m.home;
    const inRoom = (p: Point) => p.x >= r0.x - 1 && p.x <= r0.x + r0.w && p.y >= r0.y - 1 && p.y <= r0.y + r0.h;
    // Seulement une vraie menace (Thomas, 2026-11-19 : « le commerçant disparaît avec un mob de quête ») : ni un
    // dormeur, ni un monstre de quête (combattants de Fifrelin, dormeurs d'une zone de quête, Kobold du bain), ni un
    // gisant couché, un tas d'os, un monstre pétrifié ou gelé.
    const zoneIds = this.current.zone && !this.current.zone.open ? this.current.zone.sleepers : [];
    const threat = (mo: Actor) =>
      mo.hp > 0 && !mo.asleep && !mo.effigy && mo.pile === undefined && !(mo.petrified ?? 0) && !mo.frozen && !mo.bather && !(mo.arena && mo.arena !== "duel") && !zoneIds.includes(mo.id);
    const hide = this.monsters.some((mo) => threat(mo) && (near(mo, MERCHANT.hideRadius) || inRoom(mo)));
    if (hide !== m.hidden) {
      m.hidden = hide;
      if (this.isVisible(m.x, m.y)) this.events.push({ type: hide ? "merchantHides" : "merchantShows" });
    }
    if (m.hidden) return;
    if (near(this.hero, MERCHANT.waitNearHero)) {
      const dx = this.hero.x - m.x;
      const dy = this.hero.y - m.y;
      m.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy < 0 ? "up" : "down";
      return;
    }
    // Vu du héros, il ne bouge plus (Thomas : « il ne s'éloigne pas, faut éviter de lui courir après ») : il ne flâne
    // que hors de vue.
    if (this.isVisible(m.x, m.y)) return;
    if (this.turn % MERCHANT.stepEvery !== 0) return;
    const r = m.home;
    const inHome = (x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    const free = (x: number, y: number) =>
      inHome(x, y) && this.map.isWalkable(x, y) && !this.monsterAt(x, y) && !(x === this.hero.x && y === this.hero.y) && !this.isTrap(x, y) && !this.furnitureAt(x, y);
    if (!m.target || (m.target.x === m.x && m.target.y === m.y) || !free(m.target.x, m.target.y)) {
      m.target = null;
      for (let k = 0; k < 12 && !m.target; k++) {
        const x = r.x + Math.floor(mix(this.turn, k, m.x * 31 + m.y) * r.w);
        const y = r.y + Math.floor(mix(k, this.turn, m.y * 17 + m.x) * r.h);
        if (free(x, y) && (x !== m.x || y !== m.y)) m.target = { x, y };
      }
      if (!m.target) return;
    }
    const path = findPath(this.map, m, m.target, (x, y) => free(x, y) || (x === m.x && y === m.y));
    const step = path?.[0];
    if (!step) {
      m.target = null;
      return;
    }
    const dx = step.x - m.x;
    const dy = step.y - m.y;
    m.facing = dx > 0 ? "right" : dx < 0 ? "left" : dy < 0 ? "up" : "down";
    m.x = step.x;
    m.y = step.y;
  }

  /** Au 4e étage d'une section : le Colporteur flâne dans une salle ordinaire (ni départ, ni salle spéciale, ni escalier). */
  // ---------- Quête 01 : Gluck, le Kobold aux pommes (Thomas, 2026-11-12) ----------

  /**
   * Un PNJ de quête au plus par étage (`claude/QUETES.md` §2) : sur un étage 1 à 4 d'une section (jamais celui du boss),
   * une fois sur trois environ, Gluck ou Sœur Osseuse (au hasard parmi ceux qu'on n'a pas encore vus 4 fois).
   * Salle d'essai : les deux, toujours (Gluck dans la salle des colonnes, Sœur Osseuse dans la salle de prière).
   */
  private placeQuestNpc(state: FloorState, depth: number): void {
    // Ossuaire : aucun PNJ des sections du dessus (Thomas, 2026-11-19) ; Sœur Clavicule dans la chapelle des os.
    if (state.look === "ossuaire") {
      if ((state.themes ?? []).some((t) => t.id === "chapelle") && this.claviculeMemory.met < CLAVICULE.maxEncounters) {
        state.clavicule = this.placeInTheme(state, "chapelle", new Rng(floorSeed(this.runSeed, depth) ^ 0xc1a7)) ?? undefined;
      }
      if ((state.themes ?? []).some((t) => t.id === "musee") && this.osseletMemory.met < 1) {
        state.osselet = this.placeInTheme(state, "musee", new Rng(floorSeed(this.runSeed, depth) ^ 0x05e1)) ?? undefined;
      }
      return;
    }
    // Section 2 : Morillon vit dans sa champignonnière de morilles (les PNJ de la section 1 n'y descendent pas).
    if (state.look === "champi" || (this.sandbox && this.sandboxFloor()?.look === "champi")) {
      if (this.morillonMemory.met < MORILLON.maxEncounters || this.sandbox) state.morillon = this.placeMorillon(state, new Rng(floorSeed(this.runSeed, depth) ^ 0x30b1)) ?? undefined;
      // Vernis dans son hall d'exposition, le Maestro dans sa salle de concert (Thomas, 2026-11-18).
      if (this.vernisMemory.met < 1 || this.sandbox) state.vernis = this.placeInTheme(state, "expo", new Rng(floorSeed(this.runSeed, depth) ^ 0x7e41)) ?? undefined;
      if (this.maestroMemory.met < 1 || this.sandbox) state.maestro = this.placeInTheme(state, "concert", new Rng(floorSeed(this.runSeed, depth) ^ 0x3a57)) ?? undefined;
      return;
    }
    if (this.sandbox) {
      if (depth !== 1) return;
      const spots = this.sandboxFloor()?.npcs ?? {};
      const at = (list: Point[] | undefined): GluckSpot | null => {
        const p = list?.find((c) => this.npcFree(state, c.x, c.y));
        return p ? { x: p.x, y: p.y, gone: false } : null;
      };
      state.gluck = this.placeGluck(state, depth) ?? undefined;
      state.soeur = (at(spots.soeur) ?? this.placeSoeur(state, new Rng(this.runSeed ^ 0x50e0))) ?? undefined;
      state.krik = (at(spots.krik) ?? this.placeKrik(state, new Rng(this.runSeed ^ 0x6b1c))) ?? undefined;
      state.grum = (at(spots.grum) ?? this.placeGrum(state, new Rng(this.runSeed ^ 0x6a7))) ?? undefined;
      state.fifrelin = (at(spots.fifrelin) ?? this.placeKrik(state, new Rng(this.runSeed ^ 0xf1f))) ?? undefined;
      if (state.fifrelin) this.placeArena(state, state.fifrelin);
      // Plumeau, enchaîné dans la prison de la salle d'essai (2026-11-18).
      state.plumeau = this.placeInTheme(state, "prison", new Rng(this.runSeed ^ 0x9101)) ?? undefined;
      if (!this.sandboxFloor()?.hollowStatue) this.placeHollowStatue(state, new Rng(this.runSeed ^ 0x57a7));
      return;
    }
    const rng = new Rng(floorSeed(this.runSeed, depth) ^ 0x6a1b2c3d);
    if ((depth - 1) % RULES.floorsPerSection > 3 || !rng.chance(GLUCK.chance)) return;
    // Plumeau, le greffier enchaîné (quête 06) : un étage avec une prison l'a, à la place des autres.
    if ((state.themes ?? []).some((t) => t.id === "prison") && this.plumeauMemory.met < 1) {
      state.plumeau = this.placeInTheme(state, "prison", rng) ?? undefined;
      if (state.plumeau) return;
    }
    // Grum vit dans la ferme : un étage avec une ferme l'a, à la place des autres.
    if ((state.themes ?? []).some((t) => t.id === "ferme") && this.grumMemory.met < GRUM.maxEncounters) {
      state.grum = this.placeGrum(state, rng) ?? undefined;
      if (state.grum) return;
    }
    const who = ROAMING_NPCS.filter((id) => this.npcMemory(id).met < this.npcMax(id));
    if (who.length === 0) return;
    const pick = who[rng.int(0, who.length - 1)];
    if (pick === "gluck") {
      state.gluck = this.placeGluck(state, depth, rng) ?? undefined;
      if (state.gluck) this.placeHollowStatue(state, rng);
    }
    else if (pick === "soeur") state.soeur = this.placeSoeur(state, rng) ?? undefined;
    else if (pick === "fifrelin") state.fifrelin = this.placeFifrelin(state, rng) ?? undefined;
    else state.krik = this.placeKrik(state, rng) ?? undefined;
  }

  /** Combien de fois on peut croiser ce PNJ dans une partie. */
  npcMax(id: NpcId): number {
    return id === "gluck" ? GLUCK.maxEncounters : id === "soeur" ? SOEUR.maxEncounters : id === "grum" ? GRUM.maxEncounters : id === "fifrelin" ? FIFRELIN.maxEncounters : id === "morillon" ? MORILLON.maxEncounters : id === "clavicule" ? CLAVICULE.maxEncounters : id === "osselet" ? 1 : id === "vernis" || id === "maestro" || id === "plumeau" ? 1 : KRIK.maxEncounters;
  }

  /** Avec Gluck, une statue CREUSE sur l'étage : rien ne la distingue des autres tant qu'il n'en a pas parlé. */
  private placeHollowStatue(state: FloorState, rng: Rng): void {
    const furniture = state.furniture ?? (state.furniture = []);
    const special = new Set((state.themes ?? []).map((t) => t.room));
    const floor = state as unknown as Parameters<typeof placeBell>[0];
    // Ni sur un PNJ ni juste à côté (il ne doit pas se retrouver coincé dans un goulet), ni sur un objet, un monstre, un
    // motif au sol ou une flaque.
    const avoid = (x: number, y: number) =>
      [state.gluck, state.soeur, state.krik, state.grum, state.fifrelin, state.morillon, state.vernis, state.maestro, state.plumeau, state.clavicule, state.osselet, state.merchant].some((p) => p && Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1) ||
      state.ground.some((g) => g.x === x && g.y === y) ||
      this.monsters.some((m) => m.x === x && m.y === y) ||
      (state.motifs ?? []).some((m) => x >= m.x && x <= m.x + 1 && y >= m.y && y <= m.y + 1);
    if (placeBell(floor, rng, furniture, special, "statue", avoid)) furniture[furniture.length - 1].hollow = true;
  }

  /** La statue (debout) sur cette case, s'il y en a une. */
  statueAt(x: number, y: number): Furniture | null {
    return this.current.furniture.find((f) => f.x === x && f.y === y && f.kind === "statue") ?? null;
  }

  /** Gluck parle de la statue creuse : la fissure se voit, et on peut la briser. Faux s'il n'y en a pas (ou plus). */
  private hintStatue(): boolean {
    const f = this.current.furniture.find((o) => o.kind === "statue" && o.hollow && !o.hinted);
    if (!f) return false;
    f.hinted = true;
    this.map.touch(f.x, f.y);
    return true;
  }

  /**
   * Briser la statue creuse (Thomas, 2026-11-12) : un coup, d20 + force contre 12 (C) ; chaque coup fait du bruit (+5
   * d'alerte). Réussi : elle s'effondre, son trésor (un cran plus rare que le butin de l'étage) et de l'or roulent à
   * côté. Raté : on peut recommencer.
   */
  private smashStatue(f: Furniture): void {
    this.reveal();
    const bonus = this.pushBonus();
    let d20 = this.rng.int(1, 20);
    if (d20 === 1 && this.useLuck()) d20 = this.rng.int(1, 20);
    const total = d20 + bonus;
    const success = d20 === 20 || (d20 !== 1 && total >= RULES.statueDc);
    this.raiseAlarm(RULES.statueAlarm, f);
    this.events.push({ type: "statue", x: f.x, y: f.y, d20, bonus, total, success });
    if (!success) return;
    f.kind = "statueBroken";
    this.map.set(f.x, f.y, Tile.Floor);
    if (this.quest?.id === "gluck_statue" && this.quest.depth === this.depth) this.quest.got = this.quest.need;
    const gold = lessGold(this.rng.int(10, 20) + this.depth * 3);
    this.spillLoot(f.x, f.y, gold, rollLoot(this.rng, this.depth + RULES.floorsPerSection));
  }

  /** Salle d'essai : les PNJ de quête oublient tout et reviennent à leur première scène (Thomas, 2026-11-12). */
  resetDialogues(): void {
    if (!this.sandbox) return;
    this.gluckMemory = { met: 0, mood: 0, invested: 0 };
    this.soeurMemory = { met: 0 };
    this.krikMemory = { met: 0 };
    this.grumMemory = { met: 0 };
    this.morillonMemory = { met: 0 };
    this.vernisMemory = { met: 0 };
    this.maestroMemory = { met: 0 };
    this.plumeauMemory = { met: 0 };
    this.claviculeMemory = { met: 0 };
    this.osseletMemory = { met: 0 };
    this.fifrelinMemory = { met: 0 };
    this.quest = null;
    for (const g of [this.current.gluck, this.current.soeur, this.current.krik, this.current.grum, this.current.fifrelin, this.current.morillon, this.current.vernis, this.current.maestro, this.current.plumeau, this.current.clavicule, this.current.osselet]) {
      if (!g) continue;
      Object.assign(g, { gone: false, backAt: undefined, opened: false, intro: undefined, pending: undefined, pendingLines: undefined, haggled: false, drumDone: false, drops: 0, gold: 0 });
    }
    for (const f of this.current.furniture) {
      if (f.hollow) {
        if (f.kind === "statueBroken") {
          f.kind = "statue";
          this.map.set(f.x, f.y, Tile.Furniture);
        }
        f.hinted = false;
        this.map.touch(f.x, f.y);
      }
    }
  }

  /** Une case où un PNJ peut se tenir : du sol nu, sans monstre, meuble, objet ni Colporteur. */
  private npcFree(state: FloorState, x: number, y: number): boolean {
    return (
      state.map.get(x, y) === Tile.Floor &&
      // Jamais dans un passage (Thomas, 2026-11-13) : ni couloir, ni devant une porte, ni goulet entre deux obstacles.
      state.rooms.some((r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) &&
      ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => state.map.isDoor(x + dx, y + dy)) &&
      !isChokepoint(state.map, x, y, (a, b) => state.map.isWalkable(a, b) && !state.furniture.some((f) => f.x === a && f.y === b && FURNITURE_KINDS[f.kind]?.blocks)) && !this.monsters.some((m) => m.x === x && m.y === y) && !state.furniture.some((f) => f.x === x && f.y === y) &&
      !(state.merchant && state.merchant.x === x && state.merchant.y === y) && !state.ground.some((g) => g.x === x && g.y === y) &&
      !(state.gluck && state.gluck.x === x && state.gluck.y === y) && !(state.soeur && state.soeur.x === x && state.soeur.y === y) &&
      !(state.krik && state.krik.x === x && state.krik.y === y) &&
      !(state.grum && state.grum.x === x && state.grum.y === y) &&
      !(state.morillon && state.morillon.x === x && state.morillon.y === y) &&
      ![state.vernis, state.maestro, state.plumeau, state.clavicule, state.osselet].some((p) => p && p.x === x && p.y === y) &&
      !(state.fifrelin && state.fifrelin.x === x && state.fifrelin.y === y) &&
      ![state.chicken, state.farmChicken].some((c) => c && !c.done && c.x === x && c.y === y)
    );
  }

  /** Gluck se tient dans une salle ordinaire (de préférence un dortoir ou une forge), loin de l'arrivée. */
  private placeGluck(state: FloorState, depth: number, rng?: Rng): GluckSpot | null {
    const free = (x: number, y: number) => this.npcFree(state, x, y);
    if (this.sandbox && depth === 1) {
      const p = this.sandboxFloor()?.npcs?.gluck?.find((c) => free(c.x, c.y));
      return p ? { x: p.x, y: p.y, gone: false } : null;
    }
    rng ??= new Rng(floorSeed(this.runSeed, depth) ^ 0x6a1b2c3d);
    const inside = (r: Room, p: Point) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
    const rooms = state.rooms.filter((r, i) => i > 0 && !inside(r, state.start) && !inside(r, state.stairs));
    const themed = rooms.filter((r) => (state.themes ?? []).some((t) => (t.id === "dortoir" || t.id === "forge") && state.rooms[t.room] === r));
    for (const pool of [themed, rooms]) {
      for (let attempt = 0; attempt < 40 && pool.length > 0; attempt++) {
        const r = pool[rng.int(0, pool.length - 1)];
        const x = rng.int(r.x, r.x + r.w - 1);
        const y = rng.int(r.y, r.y + r.h - 1);
        if (free(x, y)) return { x, y, gone: false };
      }
    }
    return null;
  }

  /**
   * Sœur Osseuse se tient dans la salle de prière, au plus près du milieu (dans l'allée) ; sinon dans une salle calme,
   * sans monstre, loin de l'arrivée.
   */
  private placeSoeur(state: FloorState, rng: Rng): GluckSpot | null {
    const free = (x: number, y: number) => this.npcFree(state, x, y);
    const inside = (r: Room, p: Point) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
    const chapel = (state.themes ?? []).find((t) => t.id === "priere");
    if (chapel) {
      const r = state.rooms[chapel.room];
      const cx = r.x + (r.w - 1) / 2;
      const cy = r.y + (r.h - 1) / 2;
      let best: Point | null = null;
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          if (free(x, y) && (!best || Math.hypot(x - cx, y - cy) < Math.hypot(best.x - cx, best.y - cy))) best = { x, y };
        }
      }
      if (best) return { ...best, gone: false };
    }
    const calm = state.rooms.filter((r, i) => i > 0 && !inside(r, state.start) && !inside(r, state.stairs) && !this.monsters.some((m) => inside(r, m)));
    for (let attempt = 0; attempt < 60 && calm.length > 0; attempt++) {
      const r = calm[rng.int(0, calm.length - 1)];
      const x = rng.int(r.x, r.x + r.w - 1);
      const y = rng.int(r.y, r.y + r.h - 1);
      if (free(x, y)) return { x, y, gone: false };
    }
    return null;
  }

  /**
   * Krik se tient dans une forge ou un dortoir, sinon n'importe où sur du sol nu d'une salle (plus de couloir : jamais
   * dans un passage, Thomas 2026-11-13) (fiche de Thomas),
   * loin de l'arrivée et de l'escalier.
   */
  private placeKrik(state: FloorState, rng: Rng): GluckSpot | null {
    const free = (x: number, y: number) => this.npcFree(state, x, y);
    const inside = (r: Room, p: Point) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
    const themed = state.rooms.filter((r) => (state.themes ?? []).some((t) => (t.id === "forge" || t.id === "dortoir") && state.rooms[t.room] === r));
    for (let attempt = 0; attempt < 40 && themed.length > 0; attempt++) {
      const r = themed[rng.int(0, themed.length - 1)];
      const x = rng.int(r.x, r.x + r.w - 1);
      const y = rng.int(r.y, r.y + r.h - 1);
      if (free(x, y)) return { x, y, gone: false };
    }
    const startRoom = state.rooms.find((r) => inside(r, state.start));
    const far = (x: number, y: number) => Math.hypot(x - state.start.x, y - state.start.y) > 8 && Math.hypot(x - state.stairs.x, y - state.stairs.y) > 3;
    for (let attempt = 0; attempt < 400; attempt++) {
      const x = rng.int(1, state.map.width - 2);
      const y = rng.int(1, state.map.height - 2);
      if (free(x, y) && far(x, y) && !(startRoom && inside(startRoom, { x, y }))) return { x, y, gone: false };
    }
    return null;
  }

  /** Fifrelin (Thomas, 2026-11-15) : dans une salle ORDINAIRE (ni salle à thème, ni salle de départ, ni celle de
   *  l'escalier), assez grande pour son ring, et toujours avec son ring. Aucune salle ne convient : il ne vient pas. */
  private placeFifrelin(state: FloorState, rng: Rng): GluckSpot | null {
    const inside = (r: Room, p: Point) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
    const rooms = state.rooms.filter(
      (r, i) => r.w >= 7 && r.h >= 7 && !(state.themes ?? []).some((t) => t.room === i) && !inside(r, state.start) && !inside(r, state.stairs) && !(state.secretRoom && state.secretRoom.host === i),
    );
    for (let i = rooms.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [rooms[i], rooms[j]] = [rooms[j], rooms[i]];
    }
    for (const r of rooms) {
      const g: GluckSpot = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2), gone: false };
      this.placeArena(state, g);
      if (g.ring) return g;
    }
    return null;
  }

  /** Grum se tient dans sa ferme, hors du pré, sur du sol nu. */
  private placeGrum(state: FloorState, rng: Rng): GluckSpot | null {
    const farm = (state.themes ?? []).find((t) => t.id === "ferme");
    if (!farm) return null;
    const r = state.rooms[farm.room];
    const field = new Set((state.furniture ?? []).filter((f) => f.kind === "soil" || f.kind === "soil2").map((f) => f.x * 1000 + f.y));
    const cells: Point[] = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (!field.has(x * 1000 + y) && this.npcFree(state, x, y)) cells.push({ x, y });
    if (cells.length === 0) return null;
    const p = cells[rng.int(0, cells.length - 1)];
    return { x: p.x, y: p.y, gone: false };
  }

  /** Morillon se tient dans sa champignonnière, dans une allée (jamais sur un rang). */
  private placeMorillon(state: FloorState, rng: Rng): GluckSpot | null {
    const farm = (state.themes ?? []).find((t) => t.id === "morilles");
    if (!farm) return null;
    const r = state.rooms[farm.room];
    const cells: Point[] = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (this.npcFree(state, x, y)) cells.push({ x, y });
    if (cells.length === 0) return null;
    const p = cells[rng.int(0, cells.length - 1)];
    return { x: p.x, y: p.y, gone: false };
  }

  /** Un PNJ qui vit dans une salle à thème (hall d'exposition, salle de concert, prison) : une case libre de la salle. */
  private placeInTheme(state: FloorState, theme: string, rng: Rng): GluckSpot | null {
    const t = (state.themes ?? []).find((o) => o.id === theme);
    if (!t) return null;
    const r = state.rooms[t.room];
    const cells: Point[] = [];
    // Seulement une case qu'on peut rejoindre à pied (Thomas, 2026-11-19 : Plumeau se trouvait derrière une grille
    // fermée de la prison, on ne pouvait pas lui parler).
    const r0 = state.rooms[0];
    const pass = (x: number, y: number) => state.map.isWalkable(x, y) && !state.furniture.some((f) => furnitureCells(f).some((c) => c.x === x && c.y === y) && FURNITURE_KINDS[f.kind]?.blocks);
    let start: Point | null = null;
    for (let y = r0.y; !start && y < r0.y + r0.h; y++) for (let x = r0.x; !start && x < r0.x + r0.w; x++) if (pass(x, y)) start = { x, y };
    const reach = start ? distanceField(state.map, start, pass) : null;
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) if (this.npcFree(state, x, y) && (!reach || reach[state.map.index(x, y)] >= 0)) cells.push({ x, y });
    if (cells.length === 0) return null;
    // Plumeau est enchaîné au mur : la case libre la plus proche d'un mur.
    if (theme === "prison") cells.sort((a, b) => Math.min(a.x - r.x, r.x + r.w - 1 - a.x, a.y - r.y) - Math.min(b.x - r.x, r.x + r.w - 1 - b.x, b.y - r.y));
    const p = theme === "prison" ? cells[0] : cells[rng.int(0, cells.length - 1)];
    return { x: p.x, y: p.y, gone: false };
  }

  /** Morillon (quête de la section 2), s'il est sur cet étage. */
  morillon(): GluckSpot | null {
    return this.npc("morillon");
  }

  /** Grum (quête 05), s'il est sur cet étage. */
  grum(): GluckSpot | null {
    return this.npc("grum");
  }

  /** Gluck sur cet étage (pas encore parti), s'il y est. */
  gluck(): GluckSpot | null {
    return this.npc("gluck");
  }

  gluckAt(x: number, y: number): GluckSpot | null {
    const g = this.gluck();
    return g && g.x === x && g.y === y ? g : null;
  }

  /** Un PNJ de quête sur cet étage (pas encore parti). */
  npc(id: NpcId): GluckSpot | null {
    const g = this.current[id];
    return g && !g.gone ? g : null;
  }

  /** Le PNJ de quête qui se tient sur cette case, s'il y en a un. */
  npcAt(x: number, y: number): NpcId | null {
    for (const id of NPC_IDS) {
      const g = this.npc(id);
      if (g && g.x === x && g.y === y) return id;
    }
    return null;
  }

  private nextToNpc(id: NpcId): boolean {
    const g = this.npc(id);
    return !!g && Math.max(Math.abs(g.x - this.hero.x), Math.abs(g.y - this.hero.y)) === 1;
  }

  /** Ce que ce PNJ sait du héros dans cette partie. */
  npcMemory(id: NpcId): { met: number } {
    return id === "gluck" ? this.gluckMemory : id === "soeur" ? this.soeurMemory : id === "grum" ? this.grumMemory : id === "fifrelin" ? this.fifrelinMemory : id === "morillon" ? this.morillonMemory : id === "vernis" ? this.vernisMemory : id === "maestro" ? this.maestroMemory : id === "plumeau" ? this.plumeauMemory : id === "clavicule" ? this.claviculeMemory : id === "osselet" ? this.osseletMemory : this.krikMemory;
  }

  /** Peut-on parler à ce PNJ maintenant ? À côté de lui, et pas en plein combat. */
  canTalk(id: NpcId = "gluck"): boolean {
    return !this.over && this.nextToNpc(id) && !this.inCombat();
  }

  private approachNpc(id: NpcId): boolean {
    const g = this.npc(id)!;
    this.clearDoorOrders();
    this.targetId = null;
    this.waiting = false;
    if (this.nextToNpc(id)) {
      this.path = [];
      if (!this.inCombat()) this.events.push({ type: "npc", what: "talk", who: id });
      return true;
    }
    let best: Point[] | null = null;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const to = { x: g.x + dx, y: g.y + dy };
      if (!this.map.isWalkable(to.x, to.y) || this.monsterAt(to.x, to.y) || this.npcAt(to.x, to.y)) continue;
      const path = this.heroPath(to, (cx, cy) => this.isKnown(cx, cy) && !this.npcAt(cx, cy));
      if (path && (!best || path.length < best.length)) best = path;
    }
    if (!best) return false;
    this.path = best;
    this.talkTarget = id;
    return true;
  }

  /** La scène du PNJ, et le choix du joueur : on passe la main à Gluck ou à Sœur Osseuse. */
  npcScene(id: NpcId): { lines: string[]; choices: GluckChoice[] } {
    if (this.questWith(id)) return this.questScene(id);
    return id === "gluck" ? this.gluckScene() : id === "soeur" ? this.soeurScene() : id === "grum" ? this.grumScene() : id === "fifrelin" ? this.fifrelinScene() : id === "morillon" ? this.morillonScene() : id === "vernis" ? this.vernisScene() : id === "maestro" ? this.maestroScene() : id === "plumeau" ? this.plumeauScene() : id === "clavicule" ? this.claviculeScene() : id === "osselet" ? this.osseletScene() : this.krikScene();
  }

  npcChoose(id: NpcId, choice: string): GluckResult {
    if (this.questWith(id)) return this.questChoose(id, choice);
    return id === "gluck" ? this.gluckChoose(choice) : id === "soeur" ? this.soeurChoose(choice) : id === "grum" ? this.grumChoose(choice) : id === "fifrelin" ? this.fifrelinChoose(choice) : id === "morillon" ? this.morillonChoose(choice) : id === "vernis" ? this.vernisChoose(choice) : id === "maestro" ? this.maestroChoose(choice) : id === "plumeau" ? this.plumeauChoose(choice) : id === "clavicule" ? this.claviculeChoose(choice) : id === "osselet" ? this.osseletChoose(choice) : this.krikChoose(choice);
  }

  /**
   * Un PNJ de quête s'en va (« Pouf ! ») : ce qu'il laisse tombe par terre autour de lui, une pomme par case, et l'or en
   * un tas (Thomas, 2026-11-12). Salle d'essai : il revient 3 tours plus tard, pour la scène suivante.
   */
  private npcLeaves(id: NpcId, g: GluckSpot, max: number): void {
    const mem = this.npcMemory(id);
    mem.met++;
    g.gone = true;
    g.pending = undefined;
    if (this.sandbox && mem.met < max) g.backAt = this.turn + 3;
    const drops: { item: ItemId; x: number; y: number; count: number }[] = [];
    for (let i = 0; i < (g.drops ?? 0); i++) {
      const at = this.landingCell(g, "pomme", g);
      this.dropItem(at.x, at.y, "pomme", 1);
      drops.push({ item: "pomme", x: at.x, y: at.y, count: 1 });
    }
    for (const it of g.items ?? []) {
      const at = this.landingCell(g, it.item, g);
      this.dropItem(at.x, at.y, it.item, it.count);
      drops.push({ item: it.item, x: at.x, y: at.y, count: it.count });
    }
    g.items = [];
    if (g.gold) {
      // L'or des PNJ aussi est réduit (Thomas, 2026-11-17 : « fonce sur tous ces points ») ; pas les paris ni les placements.
      const gold = lessGold(g.gold);
      const at = this.landingCell(g, "or", g);
      this.dropItem(at.x, at.y, "or", gold);
      drops.push({ item: "or", x: at.x, y: at.y, count: gold });
    }
    g.drops = 0;
    g.gold = 0;
    this.events.push({ type: "npc", what: "leave", who: id, x: g.x, y: g.y, drops });
  }

  /**
   * Un PNJ de quête pris dans le feu ou le gaz toxique s'enfuit (« Pouf ! ») et la rencontre est perdue
   * (Thomas, 2026-11-12 : « les persos de quête devraient disparaître si effet négatif sur eux »).
   */
  private npcsFlee(): void {
    for (const id of NPC_IDS) {
      const g = this.npc(id);
      if (!g) continue;
      const fled = this.isBurning(g.x, g.y) ? "fire" : this.isGassed(g.x, g.y) ? "gas" : null;
      if (!fled) continue;
      this.npcLeaves(id, g, this.npcMax(id));
      const ev = this.events[this.events.length - 1];
      if (ev.type === "npc") ev.fled = fled;
      if (this.questWith(id)) {
        this.events.push({ type: "quest", what: "lost", id: this.quest!.id });
        this.quest = null;
      }
    }
  }

  /** Un jet de dialogue : d20 + caractéristique contre une difficulté cachée. La Chance relance un 1 naturel. */
  private dialogueRoll(stat: StatId, dc: number): NonNullable<GluckResult["roll"]> {
    const bonus = stat === "force" ? this.pushBonus() : stat === "agilite" ? this.disengageBonus() : stat === "charisme" ? this.charisma() : this.alloc[stat];
    let d20 = this.rng.int(1, 20);
    if (d20 === 1 && this.useLuck()) d20 = this.rng.int(1, 20);
    const total = d20 + bonus;
    const success = d20 === 20 || (d20 !== 1 && total >= dc);
    const roll = { stat: STAT_NAMES[stat] ?? stat, d20, bonus, total, success };
    this.events.push({ type: "npcRoll", ...roll });
    return roll;
  }

  /** La scène en cours : 1 déserteur, 2 commerçant, 3 chef d'entreprise, 4 philosophe. */
  gluckStage(): 1 | 2 | 3 | 4 {
    return Math.min(4, this.gluckMemory.met + 1) as 1 | 2 | 3 | 4;
  }

  private gluckApplePrice(): number {
    if (this.gluckMemory.discount) return 3;
    return this.gluckMemory.mood > 0 ? GLUCK.applePriceFriend : GLUCK.applePrice;
  }

  /** Ce que Gluck dit en ce moment, et les choix proposés. */
  gluckScene(): { lines: string[]; choices: GluckChoice[] } {
    const g = this.gluck();
    if (!g) return { lines: [], choices: [] };
    const mem = this.gluckMemory;
    if (!g.opened) {
      g.opened = true;
      // Le placement de la rencontre précédente : rendu ×2 (or et deux pommes), ou perdu.
      if (mem.invested > 0) {
        const stake = mem.invested;
        mem.invested = 0;
        if (this.rng.chance(GLUCK.investLoss)) {
          g.intro = ["« Ton investissement ? J'ai tout perdu… la faute aux rats. Tiens, une pomme pour m'excuser. »"];
          this.giveApples(1);
        } else {
          this.gold += stake * 2;
          this.events.push({ type: "pickup", item: "or", count: stake * 2 });
          g.intro = [`« Ton investissement a rapporté ! Voilà ${stake * 2} pièces, et deux pommes. »`];
          this.giveApples(2);
        }
      }
    }
    // Une réponse impossible reste visible, grisée, avec sa raison (Thomas : ne pas montrer le compte de pommes).
    const noGold = (n: number) => (this.gold < n ? "Pas assez d'or" : undefined);
    if (g.pending === "give") {
      const off = this.inventory.count("pomme") > 0 ? undefined : "Aucune pomme";
      return { lines: g.pendingLines ?? [], choices: [{ id: "give", label: "Lui donner une pomme", off }, { id: "refuse", label: "Refuser" }] };
    }
    if (g.pending === "scam") {
      return { lines: g.pendingLines ?? [], choices: [{ id: "buyScam", label: `Acheter la pomme (${GLUCK.scamPrice} or)`, off: noGold(GLUCK.scamPrice) }, { id: "refuse", label: "Refuser" }] };
    }
    const stage = this.gluckStage();
    const lines = [...(g.intro ?? []), ...GLUCK_OPENING[stage](mem.mood)];
    const leave = { id: "leave", label: "Partir" };
    if (stage === 1) {
      return {
        lines,
        choices: [
          { id: "kind", label: "Lui parler gentiment", stat: "charisme", dc: "medium" },
          { id: "threaten", label: "Le menacer", stat: "force", dc: "easy" },
          { id: "deal", label: "Lui proposer un marché", stat: "intelligence", dc: "medium" },
          { id: "steal", label: "Lui voler ses pommes", stat: "agilite", dc: "hard" },
          leave,
        ],
      };
    }
    if (stage === 2) {
      return {
        lines,
        choices: [
          { id: "buy", label: `Acheter une pomme (${this.gluckApplePrice()} or)`, off: noGold(this.gluckApplePrice()) },
          ...(g.haggled ? [] : [{ id: "haggle", label: "Marchander", stat: "charisme" as const, dc: "medium" as const, off: noGold(this.gluckApplePrice()) }]),
          { id: "scare", label: "L'intimider", stat: "force", dc: "medium" },
          ...(this.quest || mem.discount ? [] : [{ id: "rival", label: "« Et si je chassais ton concurrent ? »", stat: "charisme" as const, dc: "medium" as const }]),
          leave,
        ],
      };
    }
    if (stage === 3) {
      return {
        lines,
        choices: [
          ...GLUCK.invest.map((n) => ({ id: `invest${n}`, label: `Investir ${n} or`, off: noGold(n) })),
          ...(this.quest ? [] : [{ id: "local", label: "« Il te faut un local ? Je m'en occupe. »" }]),
          { id: "decline", label: "Refuser poliment" },
        ],
      };
    }
    return {
      lines,
      choices: [{ id: "ask", label: "« Et pour moi, un petit quelque chose ? »" }, ...(this.quest ? [] : [{ id: "listen", label: "« Que dois-je faire, maître ? »" }]), leave],
    };
  }

  /** Le joueur choisit une réponse. Rien ne prend de tour ; un jet se fait au d20, contre une difficulté cachée. */
  gluckChoose(id: string): GluckResult {
    const g = this.gluck();
    if (!g || !this.canTalk("gluck")) return { lines: [], done: true };
    const mem = this.gluckMemory;
    const choice = this.gluckScene().choices.find((c) => c.id === id);
    if (!choice || choice.off) return { lines: [], done: false };
    let roll: GluckResult["roll"];
    const test = (): boolean => (roll = this.dialogueRoll(choice.stat!, GLUCK.dc[choice.dc!])).success;
    const end = (lines: string[]): GluckResult => {
      this.npcLeaves("gluck", g, GLUCK.maxEncounters);
      return { lines, roll, done: true };
    };
    const stay = (lines: string[]): GluckResult => ({ lines, roll, done: false });
    const mood = (d: number) => (mem.mood = Math.max(-1, Math.min(1, mem.mood + d)));
    switch (id) {
      case "leave":
        return { lines: ["« Reviens quand tu veux. Avec des pommes. »"], done: true };
      case "kind":
        if (test()) {
          mood(1);
          // Quêtes v3 : son CELLIER, derrière le tonneau qui sonne creux ; deux Kobolds y dorment sur ses pommes.
          if (!this.quest && this.openZone("cellier", g) && this.giveTask("gluck_sac")) {
            return {
              lines: [
                "« Ah ! Enfin quelqu'un de gentil. »",
                "« Mon cellier est derrière le tonneau qui sonne creux. Des Kobolds y dorment sur MES pommes. Et sur mon sac. »",
                "« Pousse le tonneau, rapporte-moi le sac. On partagera. »",
                "(Le tonneau creux apparaît sur la carte.)",
              ],
              roll,
              done: true,
            };
          }
          // Tâche (Thomas, 2026-11-12) : son sac perdu, à lui rapporter. Il attend sur place.
          if (this.giveTask("gluck_sac")) {
            return { lines: ["« Ah ! Enfin quelqu'un de gentil. »", "« Mon sac de pommes ? Perdu en fuyant les autres. Ramène-le-moi, on partagera. »", "(Sa salle apparaît sur la carte.)"], roll, done: true };
          }
          this.gluckDrops(2);
          return end(["« Ah ! Enfin quelqu'un de gentil. Tiens, ma réserve. »"]);
        }
        g.pending = "give";
        g.pendingLines = ["« Hmm. Prouve-moi ta bonne volonté : donne-moi une pomme d'abord. »"];
        return stay(g.pendingLines);
      case "give":
        if (!this.inventory.take("pomme", 1)) return end(["« Pas de pomme ? Je m'en doutais. »"]);
        mood(1);
        this.gluckDrops(2);
        return end(["« Merci ! Deux pour une : c'est ça, l'amitié. »"]);
      case "refuse":
        return end([g.pending === "scam" ? "« Tant pis pour toi. »" : "« Je m'en doutais. »", "Pouf ! Gluck disparaît dans un petit nuage."]);
      case "threaten":
        mood(-1);
        if (test()) {
          // Quêtes v3 : il file se cacher dans son cellier en semant des pommes ; il faut SUIVRE LA PISTE.
          if (!this.quest && this.openZone("cellier", g) && this.giveTask("gluck_piste")) {
            this.appleTrail(g);
            return { lines: ["« D'accord, d'accord ! » Il détale en serrant ses pommes… qui tombent une à une derrière lui.", "(Suivez la piste de pommes.)"], roll, done: true };
          }
          this.gluckDrops(2);
          return end(["« D'accord, d'accord ! Prends-les, mais ne me fais pas mal ! »"]);
        }
        this.gluckDrops(1);
        return end(["« Au secours ! »", "Il détale en lâchant une pomme."]);
      case "deal":
        if (test()) {
          // Le secret (Thomas, 2026-11-12) : la statue creuse de l'étage ; à défaut, l'escalier. Tâche : la briser, puis revenir.
          if (!this.quest && this.current.furniture.some((o) => o.kind === "statue" && o.hollow && !o.hinted) && this.hintStatue() && this.giveTask("gluck_statue")) {
            return { lines: ["« Marché conclu : un secret. La statue de pierre, sur cet étage… elle sonne creux. Un bon coup, et hop ! »", "« Reviens me dire ce qu'il y avait dedans. »", "(Une fissure apparaît sur la statue. Touchez-la pour la briser.)"], roll, done: true };
          }
          this.gluckDrops(1);
          if (this.hintStatue()) {
            return end(["« Marché conclu : une pomme, et un secret. La statue de pierre, sur cet étage… elle sonne creux. Un bon coup, et hop ! »", "(Une fissure apparaît sur la statue. Touchez-la pour la briser.)"]);
          }
          this.revealStairs();
          return end(["« Marché conclu : une pomme, et un secret. L'escalier qui descend ? C'est par là. »", "(L'escalier apparaît sur votre carte.)"]);
        }
        g.pending = "scam";
        g.pendingLines = [`« Une pomme ? ${GLUCK.scamPrice} pièces. C'est le prix d'une potion de jouvence… mais en meilleur. »`];
        return stay(g.pendingLines);
      case "buyScam":
        if (this.gold < GLUCK.scamPrice) return end(["« Pas assez d'or ? Dommage. Une autre fois. »"]);
        this.gold -= GLUCK.scamPrice;
        mood(1);
        this.giveApples(1);
        return end(["« Un plaisir de faire affaire avec toi ! »"]);
      case "steal":
        if (test()) {
          // Quêtes v3 : il bâille et part faire la sieste dans son cellier, sur son sac. Y entrer en douce.
          if (!this.quest && this.openZone("cellier", g) && this.giveTask("gluck_vol")) {
            const z = this.current.zone!;
            const spot = z.inside ?? z.loot!;
            g.x = spot.x;
            g.y = spot.y;
            g.asleep = true;
            return {
              lines: [
                "Vous tendez la main vers son sac… il bâille : « La sieste. Dans mon cellier. Derrière le tonneau. »",
                "« Ne me réveille pas. Personne ne me réveille. »",
                "(Prenez son sac sans le réveiller : chaque pas près de lui est un jet de discrétion.)",
              ],
              roll,
              done: true,
            };
          }
          this.giveApples(this.rng.int(1, 2));
          return end(["Vous glissez la main dans son sac… il ne remarque rien.", "Gluck s'en va en sifflotant."]);
        }
        mood(-1);
        this.raiseAlarm(GLUCK.stealAlarm, g);
        this.callSlinger(g);
        return end(["« AU VOLEUR ! FRONDEUR, À MOI ! »", "Gluck détale. Un Kobold frondeur accourt."]);
      case "buy": {
        const price = this.gluckApplePrice();
        if (this.gold < price) return stay(["« Pas d'or, pas de pomme. »"]);
        this.gold -= price;
        this.giveApples(1);
        return end(["« Excellent choix ! Reviens quand tu veux. »"]);
      }
      case "haggle": {
        g.haggled = true;
        const price = this.gluckApplePrice();
        if (!test()) return stay(["« Le prix, c'est le prix. »"]);
        if (this.gold < price) return stay(["« Bon, d'accord… mais tu n'as même pas l'or. Culotté. »"]);
        this.gold -= price;
        this.giveApples(2);
        return end(["« Bon. Deux pour le prix d'une. Mais ne le dis à personne. »"]);
      }
      case "scare":
        mood(-1);
        if (test()) {
          this.gluckDrops(1);
          return end(["« Bon, bon… Tiens. Mais je m'en souviendrai. »"]);
        }
        return end(["« Même pas peur ! »", "Il file avec son sac."]);
      case "decline":
        this.gluckDrops(1);
        return end(["« Tant pis. Tiens, une pomme. Pour la pub. »"]);
      case "rival":
        if (test()) {
          const at = this.questSpot();
          if (at && this.giveTask("gluck_rival")) {
            const rival = this.newMonster(MONSTERS.schrat, at.x, at.y, false);
            rival.fromX = at.x;
            rival.fromY = at.y;
            rival.patrol = this.rooms.find((r) => at.x >= r.x && at.x < r.x + r.w && at.y >= r.y && at.y < r.y + r.h);
            this.monsters.push(rival);
            this.quest!.target = rival.id;
            return {
              lines: ["« Un Kobold vend des pommes moins cher que moi, là-bas. Moins cher ! »", "« Pousse-le hors de sa salle. Trois fois. Ne le tue pas : c'est un collègue. »", "(Sa salle apparaît sur la carte.)"],
              roll,
              done: true,
            };
          }
        }
        return { lines: ["« Mon concurrent ? Je n'ai pas de concurrent. Je suis le meilleur. »"], roll, done: false };
      case "local": {
        // Rencontre 3 : il lui faut un local ; la salle la plus peuplée de l'étage (hors salle du héros).
        let best = -1;
        let most = 0;
        this.rooms.forEach((r, i) => {
          if (r === this.current.zone?.room) return;
          const n = this.monsters.filter((m) => !m.boss && m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h).length;
          if (n > most && this.roomIndexAt(this.hero) !== i) {
            most = n;
            best = i;
          }
        });
        if (best >= 0 && this.giveTask("gluck_local")) {
          this.quest!.target = best;
          this.quest!.need = most;
          this.revealRoomAt({ x: this.rooms[best].x, y: this.rooms[best].y });
          return { lines: ["« Un local ! Celui-là, sur la carte. Il est un peu… habité. »", "« Videz-le, et j'y pose mon étal. Le premier bénéfice est pour vous. »", "(La salle apparaît sur la carte.)"], done: true };
        }
        return { lines: ["« Tous les locaux sont vides ? Alors je reste ici. »"], done: false };
      }
      case "listen":
        if (this.giveTask("gluck_banc")) {
          return { lines: ["« Va t'asseoir près d'un banc. N'importe lequel. Et réfléchis. Cinq tours. »", "« La vérité vient à ceux qui ne bougent pas. Et qui n'ont pas de monstre en vue. »"], done: true };
        }
        return { lines: ["« Le silence est une réponse. »"], done: false };
      case "ask": {
        const gifts = ["apple", "stairs", "sleep"].filter((r) => r !== mem.lastReward);
        const gift = gifts[this.rng.int(0, gifts.length - 1)];
        mem.lastReward = gift;
        if (gift === "apple") {
          this.gluckDrops(1);
          return end(["« Tiens. Une pomme de ma réserve secrète. »"]);
        }
        if (gift === "stairs" && this.hintStatue()) {
          return end(["« Un secret, entre nous : la statue de pierre ? Creuse. J'y ai caché mes économies. Enfin… mes ANCIENNES économies. »", "(Une fissure apparaît sur la statue. Touchez-la pour la briser.)"]);
        }
        if (gift === "stairs") {
          this.revealStairs();
          return end(["« Un secret, entre nous : l'escalier, c'est par là. »", "(L'escalier apparaît sur votre carte.)"]);
        }
        for (const m of this.monsters) {
          if (m.boss || (m.defId !== "schrat" && m.defId !== "frondeur")) continue;
          m.asleep = true;
          m.alerted = false;
          m.feud = undefined;
        }
        return end(["« Un tuyau : j'ai mis de la mousse dodo dans la soupe des Kobolds. Ils font la sieste. »", "(Les Kobolds de l'étage se sont endormis.)"]);
      }
      default: {
        const n = Number(id.replace("invest", ""));
        if (!id.startsWith("invest") || !n) return stay([]);
        if (this.gold < n) return stay(["« Tu n'as pas cette somme. Reviens plus riche. »"]);
        this.gold -= n;
        mem.invested = n;
        return end(["« Excellent choix ! Reviens me voir plus bas : ça va rapporter. »"]);
      }
    }
  }

  // ---------- Quête 02 : Sœur Osseuse et la cloche disparue (Thomas, 2026-11-12) ----------

  soeur(): GluckSpot | null {
    return this.npc("soeur");
  }

  /** La scène en cours : 1 la colère, 2 la reconstruction, 3 la nouvelle religion, 4 la sérénité (le tambour). */
  soeurStage(): 1 | 2 | 3 | 4 {
    return Math.min(4, this.soeurMemory.met + 1) as 1 | 2 | 3 | 4;
  }

  /** Ce que dit Sœur Osseuse en ce moment, et les choix proposés. */
  soeurScene(): { lines: string[]; choices: GluckChoice[] } {
    const g = this.soeur();
    if (!g) return { lines: [], choices: [] };
    const stage = this.soeurStage();
    if (!g.opened) {
      g.opened = true;
      // Rencontre 4 : BOUM ! Chaque coup de tambour fait monter l'alerte.
      if (stage === 4 && !g.drumDone) {
        g.drumDone = true;
        this.raiseAlarm(SOEUR.drumAlarm, g);
      }
    }
    const chapel = (this.current.themes ?? []).some((t) => {
      const r = t.id === "priere" ? this.rooms[t.room] : undefined;
      return !!r && g.x >= r.x && g.y >= r.y && g.x < r.x + r.w && g.y < r.y + r.h;
    });
    const lines = SOEUR_OPENING[stage](!!this.soeurMemory.grudge, chapel);
    const leave = { id: "leave", label: "Partir" };
    if (stage === 1) {
      return {
        lines,
        choices: [
          { id: "console", label: "La consoler", stat: "charisme", dc: "medium" },
          { id: "explain", label: "Lui dire qu'on l'entend sonner, la nuit, sous le village", stat: "intelligence", dc: "medium" },
          { id: "punish", label: "Proposer de punir les Kobolds", stat: "force", dc: "easy" },
          { id: "craft", label: "Lui fabriquer une cloche de fortune", stat: "agilite", dc: "medium" },
          leave,
        ],
      };
    }
    if (stage === 2) {
      return {
        lines,
        choices: [
          { id: "silence", label: "Respecter son silence" },
          { id: "joke", label: "Lui raconter une histoire drôle", stat: "charisme", dc: "hard" },
          { id: "curse", label: "Proposer de maudire les Kobolds" },
          { id: "bell", label: "Parler de la cloche" },
        ],
      };
    }
    if (stage === 3) {
      return {
        lines,
        choices: [
          { id: "encourage", label: "L'encourager" },
          { id: "warn", label: "La mettre en garde", stat: "intelligence", dc: "medium" },
          { id: "donation", label: "Demander une donation", stat: "charisme", dc: "medium" },
          leave,
        ],
      };
    }
    return { lines, choices: [{ id: "bless", label: "« Une bénédiction, ma sœur ? »" }, { id: "drum", label: "« Encore un peu de tambour ! »" }, leave] };
  }

  /** Le joueur choisit une réponse. Rien ne prend de tour ; un jet se fait au d20, contre une difficulté cachée. */
  soeurChoose(id: string): GluckResult {
    const g = this.soeur();
    if (!g || !this.canTalk("soeur")) return { lines: [], done: true };
    const mem = this.soeurMemory;
    const choice = this.soeurScene().choices.find((c) => c.id === id);
    if (!choice || choice.off) return { lines: [], done: false };
    let roll: GluckResult["roll"];
    const test = (): boolean => (roll = this.dialogueRoll(choice.stat!, GLUCK.dc[choice.dc!])).success;
    const end = (lines: string[]): GluckResult => {
      this.npcLeaves("soeur", g, SOEUR.maxEncounters);
      return { lines, roll, done: true };
    };
    /** Un petit cadeau au hasard, jamais deux fois le même de suite. */
    const gift = (pool: string[]): string[] => {
      const left = pool.filter((r) => r !== mem.lastReward);
      const pick = left[this.rng.int(0, left.length - 1)];
      mem.lastReward = pick;
      if (pick === "apple") {
        g.drops = (g.drops ?? 0) + 1;
        return ["« Tenez. Une pomme. Elle était sur l'autel, mais je ne mange plus. »"];
      }
      if (pick === "gold") {
        g.gold = (g.gold ?? 0) + this.rng.int(8, 16);
        return ["« Prenez ceci. La quête, c'est fait pour ça. »", "(Elle laisse quelques pièces derrière elle.)"];
      }
      if (pick === "luck") {
        this.grantLuck();
        return ["« Que la chance vous accompagne. Vous en aurez besoin. »", "(Chance : vos 3 prochains 1 au dé seront relancés.)"];
      }
      this.grantProtection();
      return ["« Allez en paix, mon enfant. »", "(Protection : +1 classe d'armure pendant 150 tours.)"];
    };
    switch (id) {
      case "leave":
        return { lines: ["« Allez. Et ne courez pas. »"], done: true };
      case "console":
        if (test()) {
          // Quêtes v3 : rallumer ses trois cierges ; derrière l'autel, la sacristie s'ouvrira.
          if (!this.quest && this.placeCierges(g) && this.giveTask("soeur_cierges")) {
            this.openZone("sacristie", g, this.chapelRoom() ?? undefined);
            return {
              lines: ["« … Merci. Vous êtes moins grossier que vous n'en avez l'air. »", "« Rallumez mes trois cierges. Les Kobolds les ont soufflés. Il vous faut une flamme : une torche. »", "(Les trois cierges apparaissent sur la carte.)"],
              roll,
              done: true,
            };
          }
          this.grantProtection();
          return end(["« … Merci. Vous êtes moins grossier que vous n'en avez l'air. »", "(Protection : +1 classe d'armure pendant 150 tours.)"]);
        }
        return end(["« Vous êtes particulièrement mauvais en consolation. »"]);
      case "explain": {
        // Quêtes v3 : trouver la grille d'où monte le son ; réussi, la bonne grille scintille.
        const ok = test();
        if (!this.quest && this.placeGrates(g, ok) && this.giveTask("soeur_grille")) {
          return {
            lines: ok
              ? ["« Sous nos pieds ? Alors elle n'est pas fondue. Elle est en bas. »", "« Trois grilles, dans le sol de cet étage. Une seule chante. Écoutez. »", "(Les grilles apparaissent sur la carte ; l'une d'elles scintille.)"]
              : ["« Des racontars de boulanger. … Mais allez écouter les grilles, tiens. On ne sait jamais. »", "(Les grilles apparaissent sur la carte.)"],
            roll,
            done: true,
          };
        }
        if (ok) {
          this.clarityDepth = this.depth;
          return end(["« Sous nos pieds ? Alors elle n'est pas fondue. Elle est en bas. Quelque part. »", "« Descendez, mon enfant. Et écoutez bien. »", "(Clarté : le poison vous ronge deux fois moins longtemps, sur cet étage.)"]);
        }
        return end(["« Des racontars de boulanger. Il dort, il rêve, il entend des cloches. »"]);
      }
      case "punish":
        if (test()) {
          this.curseDepth = this.depth;
          if (this.giveTask("soeur_kobolds")) {
            return { lines: ["« Oui. OUI. Que leurs écailles tombent. »", "« Punissez-les. Puis revenez me raconter. »", "(Malédiction des Kobolds : +2 dégâts contre eux, sur cet étage.)"], roll, done: true };
          }
          return end(["« Oui. OUI. Que leurs écailles tombent. »", "(Malédiction des Kobolds : +2 dégâts contre eux, sur cet étage.)"]);
        }
        return end(["« Vous manquez de conviction. »"]);
      case "craft": {
        // Quêtes v3 : rassembler une marmite, une louche et une corde ; raté, la cloche fera un vacarme au montage.
        const ok = test();
        if (!this.quest && this.giveTask("soeur_cloche")) {
          if (!ok) this.quest!.noisy = true;
          return {
            lines: ["« Une cloche de fortune ? … Avec quoi ? »", "« Une marmite, une louche, une corde. La cuisine, la forge, la salle de torture. Rapportez-les-moi. »", "(Les trois objets apparaissent sur l'étage ; leurs salles se montrent sur la carte.)"],
            roll,
            done: true,
          };
        }
        if (ok) {
          this.grantLuck();
          return end(["Vous assemblez une gamelle, une cuillère et un bout de ficelle. Ding !", "« … C'est presque joli. »", "(Chance : vos 3 prochains 1 au dé seront relancés.)"]);
        }
        this.raiseAlarm(SOEUR.craftAlarm, g);
        return end(["Vous assemblez une gamelle, une cuillère et un bout de ficelle. CLONK !", "« Ce n'est pas une cloche. C'est une insulte. »"]);
      }
      case "silence":
        this.grantProtection();
        return end(["Vous ne dites rien. Elle hoche le crâne, très digne.", "(Protection : +1 classe d'armure pendant 150 tours.)"]);
      case "joke":
        if (test()) return end(["« … Pfff. Hi. Hi hi. »", ...gift(["apple", "gold", "luck"])]);
        return end(["« … Non. »"]);
      case "curse":
        this.curseDepth = this.depth;
        return end(["« Voilà enfin une idée sensée. »", "(Malédiction des Kobolds : +2 dégâts contre eux, sur cet étage.)"]);
      case "bell":
        mem.grudge = true;
        return end(["« DEHORS ! »", "Elle vous chasse d'un revers de manche. Elle s'en souviendra."]);
      case "encourage":
        this.grantProtection();
        return end(["« Merci. Ils progressent. Hier, l'un d'eux a lu un mot entier. »", "(Protection : +1 classe d'armure pendant 150 tours.)"]);
      case "warn":
        if (test()) {
          this.grantProtection();
          this.clarityDepth = this.depth;
          this.faithfulLeave();
          return end(["« Vous avez raison. Mes enfants : allez prêcher ailleurs. »", "Les deux Kobolds s'en vont, et emmènent des amis.", "(Protection et Clarté. Deux Kobolds quittent l'étage.)"]);
        }
        return end(["« Vous êtes jaloux de leur foi. »"]);
      case "donation":
        if (test()) {
          g.gold = (g.gold ?? 0) + this.rng.int(SOEUR.donationMin, SOEUR.donationMax);
          return end(["« Pour les œuvres. Ne dépensez pas tout en pommes. »", "(Elle laisse une bourse derrière elle.)"]);
        }
        return end(["« La quête, c'est MOI qui la fais. »"]);
      case "bless":
        return end(gift(["protection", "apple", "gold", "luck"]));
      case "drum":
        this.raiseAlarm(SOEUR.drumAlarm, g);
        return { lines: ["BOUM ! BOUM ! BOUM !", "« Magnifique, n'est-ce pas ? »", "(Tout l'étage a entendu.)"], roll, done: false };
      default:
        return { lines: [], done: false };
    }
  }

  /** Mise en garde réussie : ses Kobolds fidèles quittent l'étage (les plus loin du héros, jamais un boss). */
  private faithfulLeave(): void {
    const kobolds = this.monsters
      .filter((m) => !m.boss && (m.defId === "schrat" || m.defId === "frondeur"))
      .sort((a, b) => Math.hypot(b.x - this.hero.x, b.y - this.hero.y) - Math.hypot(a.x - this.hero.x, a.y - this.hero.y));
    for (const m of kobolds.slice(0, SOEUR.faithfulLeave)) this.monsters.splice(this.monsters.indexOf(m), 1);
  }

  /** PROTECTION : +1 classe d'armure pendant 150 tours (un nouveau don remet le compteur). */
  private grantProtection(): void {
    this.protectTurns = SOEUR.protectTurns;
    this.refreshStats();
  }

  private grantLuck(): void {
    this.luck = SOEUR.luckRerolls;
  }

  /** CHANCE : un 1 naturel du héros est relancé, tant qu'il en reste. */
  /** D20 ENCHANTÉ (Thomas, 2026-11-14) : porté en artefact, un 1 naturel du héros devient un 20, une fois par étage. */
  /**
   * TÊTU (Humain ; Thomas, 2026-11-16) : une fois par étage, un d20 raté du héros est relancé (attaque au contact ou à
   * distance, se cacher, pousser, se dégager, crocheter ou enfoncer une porte). La relance part toute seule, au premier
   * raté de l'étage (C). Renvoie vrai si elle sert maintenant.
   */
  private useStubborn(): boolean {
    if (!this.race.stubborn || this.perks().stubborn) return false;
    this.perks().stubborn = 1;
    this.events.push({ type: "stubborn" });
    return true;
  }

  /** Le héros peut-il frapper ce monstre au corps à corps d'où il est ? */
  private heroReaches(m: Actor): boolean {
    return this.inReach(this.hero, m) || this.inWeaponReach(m);
  }

  /**
   * OPPORTUNISTE (Humain ; Thomas, 2026-11-16) : un monstre alerté qui était au contact du héros vient de s'en éloigner
   * (Kobold qui fuit, frondeur qui recule) : le héros lui porte un coup gratuit, avec l'avantage.
   */
  private heroOpportunity(m: Actor, wasInReach: boolean): void {
    if (!wasInReach || !this.race.opportunist || this.over || this.peaceful || this.stoneTurns > 0 || this.hero.stuck) return;
    if (!m.alerted || !this.monsters.includes(m) || this.heroReaches(m) || !this.isVisible(m.x, m.y)) return;
    this.events.push({ type: "opportunist", actor: m });
    this.heroAttacks(m, true, true);
  }

  private useLuckyDie(): boolean {
    if (this.equipment.artifact?.defId !== "d20_enchante" || (this.perks().luckyDie ?? 0) >= 1) return false;
    this.perks().luckyDie = 1;
    this.events.push({ type: "luckyDie" });
    return true;
  }

  /** Le coffre doré du boss (dessiné en or). */
  goldChestAt(x: number, y: number): boolean {
    const c = this.current?.goldChest;
    return !!c && c.x === x && c.y === y;
  }

  /** Section 2 : la mousse de cette case a brûlé (ses veines sont noircies). */
  mossBurntAt(x: number, y: number): boolean {
    return !!this.current?.mossBurnt?.includes(y * 4096 + x);
  }

  /** Le tonneau creux de la zone de quête a-t-il été repéré par une fouille ? (dessin) */
  zoneNoticed(): boolean {
    return !!this.current.zone?.noticed;
  }

  /** Le d20 enchanté peut-il encore servir sur cet étage ? (fiche de l'objet) */
  luckyDieReady(): boolean {
    return (this.perks().luckyDie ?? 0) < 1;
  }

  private useLuck(): boolean {
    if (this.luck <= 0) return false;
    this.luck--;
    this.events.push({ type: "luck" });
    return true;
  }

  /** Bénédictions d'étage : Clarté (poison deux fois plus court) et Malédiction des Kobolds (+2 dégâts). */
  clarityActive(): boolean {
    return this.clarityDepth === this.depth && this.depth > 0;
  }

  curseActive(): boolean {
    return this.curseDepth === this.depth && this.depth > 0;
  }

  /** Malédiction des Kobolds : les dégâts en plus contre ce monstre. */
  private curseBonusOn(m: Actor): number {
    return this.curseActive() && (m.defId === "schrat" || m.defId === "frondeur") ? SOEUR.curseBonus : 0;
  }

  /** Des pommes que Gluck laissera tomber autour de lui en partant (ses cadeaux ; ce qu'on achète ou vole va au sac). */
  private gluckDrops(n: number): void {
    const g = this.current.gluck;
    if (g) g.drops = (g.drops ?? 0) + n;
  }

  /** Des pommes de Gluck : dans le sac, ou au sol à côté si le sac est plein. */
  private giveApples(n: number): void {
    const left = this.inventory.add("pomme", n);
    if (n - left > 0) this.events.push({ type: "pickup", item: "pomme", count: n - left });
    if (left > 0) this.bounceFromHero("pomme", left);
  }

  // ---------- Quête 03 : Krik, le Kobold qui ne sait plus mentir (Thomas, 2026-11-12) ----------

  krik(): GluckSpot | null {
    return this.npc("krik");
  }

  /** La scène en cours : 1 la confession, 2 le retour du menteur, 3 le grand commerçant. */
  krikStage(): 1 | 2 | 3 {
    return Math.min(3, this.krikMemory.met + 1) as 1 | 2 | 3;
  }

  /** Ce que dit Krik en ce moment, et les choix proposés. */
  krikScene(): { lines: string[]; choices: GluckChoice[] } {
    const g = this.krik();
    if (!g) return { lines: [], choices: [] };
    g.opened = true;
    const stage = this.krikStage();
    const lines = KRIK_OPENING[stage](!!this.krikMemory.denounced);
    const leave = { id: "leave", label: "Partir" };
    const poor = (n: number) => (this.gold < n ? "Pas assez d'or" : undefined);
    if (stage === 1) {
      return {
        lines,
        choices: [
          { id: "protect", label: "Proposer de le protéger", stat: "charisme", dc: "medium" },
          { id: "caches", label: "Lui demander ses caches", stat: "intelligence", dc: "medium" },
          { id: "threaten", label: "Le menacer", stat: "force", dc: "easy" },
          { id: "divert", label: "Lui apprendre à faire diversion", stat: "agilite", dc: "medium" },
          leave,
        ],
      };
    }
    if (stage === 2) {
      return {
        lines,
        choices: [
          { id: "buy", label: `Acheter un objet (${KRIK.sellPrice} or)`, off: poor(KRIK.sellPrice) },
          { id: "lie", label: "Lui demander de mentir aux monstres pour vous" },
          { id: "denounce", label: "Le dénoncer à ses anciens camarades" },
          leave,
        ],
      };
    }
    return {
      lines,
      choices: [
        { id: "discount", label: `Acheter à prix cassé (${KRIK.discountPrice} or)`, off: poor(KRIK.discountPrice) },
        { id: "rare", label: `Négocier un objet rare (${KRIK.rarePrice} or)`, stat: "charisme", dc: "hard", off: poor(KRIK.rarePrice) },
        { id: "invest", label: `Investir ${KRIK.investStake} or dans son commerce`, off: poor(KRIK.investStake) },
        leave,
      ],
    };
  }

  /** Le joueur choisit une réponse. Rien ne prend de tour ; un jet se fait au d20, contre une difficulté cachée. */
  krikChoose(id: string): GluckResult {
    const g = this.krik();
    if (!g || !this.canTalk("krik")) return { lines: [], done: true };
    const mem = this.krikMemory;
    const choice = this.krikScene().choices.find((c) => c.id === id);
    if (!choice || choice.off) return { lines: [], done: false };
    let roll: GluckResult["roll"];
    const test = (): boolean => (roll = this.dialogueRoll(choice.stat!, GLUCK.dc[choice.dc!])).success;
    const end = (lines: string[]): GluckResult => {
      this.npcLeaves("krik", g, KRIK.maxEncounters);
      return { lines, roll, done: true };
    };
    const leaves = (item: ItemId, count = 1) => (g.items ??= []).push({ item, count });
    const pay = (n: number) => {
      this.gold -= n;
    };
    const toBag = (item: ItemId, count = 1) => {
      const left = this.inventory.add(item, count);
      if (count - left > 0) this.events.push({ type: "pickup", item, count: count - left });
      if (left > 0) this.bounceFromHero(item, left);
    };
    /** Un objet du butin de l'étage (jamais d'or) ; `rarer` : celui de la section suivante. */
    const loot = (rarer = false): { item: ItemId; count: number } => {
      for (let k = 0; k < 8; k++) {
        const l = rollLoot(this.rng, this.depth + (rarer ? RULES.floorsPerSection : 0));
        if (l.item !== "or") return l;
      }
      return { item: "pomme", count: 1 };
    };
    switch (id) {
      case "leave":
        return { lines: ["« Tu reviendras. C'est vrai, je le sais : je ne peux pas mentir. »"], done: true };
      case "protect":
        if (test()) {
          // Quêtes v3 : le dortoir des traîtres, derrière une tapisserie.
          if (!this.quest && this.openZone("traitres", g) && this.giveTask("krik_dortoir")) {
            return {
              lines: [
                "« Tu me protégerais ? Moi ? … Tu mens mieux que moi. Mais d'accord. »",
                "« Ils dorment derrière la tapisserie, là. Trois. Ils me cherchent. »",
                "« Souffle leur bougie : dans le noir, ils n'entendent plus rien. »",
                "(La tapisserie apparaît sur la carte.)",
              ],
              roll,
              done: true,
            };
          }
          if (!this.quest) {
            this.callFoes(g, "schrat", 2);
            if (this.giveTask("krik_traqueurs")) {
              return { lines: ["« Tu me protégerais ? Moi ? … Tu mens mieux que moi. Mais d'accord. »", "« Deux de mes anciens camarades me cherchent. Tiens, les voilà. »", "(Deux Kobolds accourent.)"], roll, done: true };
            }
          }
          this.revealKoboldRooms();
          leaves("pomme");
          return end([
            "« Tu me protégerais ? Moi ? … Tu mens mieux que moi. Mais d'accord. »",
            "« Mes camarades dorment là, là et là. Le butin, je l'ai caché sous ma langue. Non, ça c'est faux. Ah si, c'est vrai. »",
            "(Les repaires des Kobolds de l'étage apparaissent sur la carte. Il laisse une pomme.)",
          ]);
        }
        // Raté : il se méfie et montre la MAUVAISE tapisserie (un placard, une pomme).
        if (this.openZone("placard", g)) {
          return end(["« Toi ? … Bon. Ils dorment derrière la tapisserie, là. »", "(Il a l'air de mentir. C'est nouveau.)", "(Une tapisserie apparaît sur la carte.)"]);
        }
        g.gold = (g.gold ?? 0) + this.rng.int(KRIK.hushMin, KRIK.hushMax);
        return end(["« Toi ? Tu ne protégerais pas une pomme. »", "« Tiens, prends ça et laisse-moi tranquille. C'est tout ce que je vaux. »", "(Il laisse quelques pièces.)"]);
      case "caches":
        if (test()) {
          if (!this.quest && this.openZone("traitres", g) && this.giveTask("krik_magot")) {
            return {
              lines: [
                "« Ma cache ? Sous la dalle du milieu, dans leur dortoir. Derrière la tapisserie. »",
                "« Pourquoi je te le dis ? … Je ne peux pas m'en empêcher. »",
                "« Attention : la dalle claque. Ça réveille. Rapporte-moi le magot, on partage. »",
                "(La tapisserie apparaît sur la carte.)",
              ],
              roll,
              done: true,
            };
          }
          if (this.giveTask("krik_magot")) {
            return { lines: ["« Ma cache ? Dans une autre salle. Pourquoi je te le dis ? … Je ne peux pas m'en empêcher. »", "« Rapporte-la-moi, on partage. »", "(La salle du magot apparaît sur la carte.)"], roll, done: true };
          }
          g.gold = (g.gold ?? 0) + this.rng.int(KRIK.cacheGoldMin, KRIK.cacheGoldMax);
          const l = loot();
          leaves(l.item, l.count);
          return end(["« Ma cache ? Sous le troisième tonneau. Pourquoi je te le dis ? … Je ne peux pas m'en empêcher. »", "(Il laisse de l'or et un objet derrière lui.)"]);
        }
        return end(["« La cache de l'escalier. Elle est vide. Je l'ai vidée hier. »", "« Je t'avais dit que j'étais malade, pas que j'étais stupide. »"]);
      case "threaten":
        // Quêtes v3 : il file dans le dortoir et réveille tout le monde ; il faut TENIR LE PASSAGE. Réussi : ils sortent
        // un par un (attendre à côté de la tapisserie donne l'embuscade) ; raté : tous en même temps.
        if (!this.quest && this.openZone("traitres", g)) {
          const ok = test();
          this.zoneBreakOut(ok ? 3 : 0);
          if (this.giveTask("krik_passage")) {
            return {
              lines: ok
                ? ["« D'accord, d'accord ! » Il plonge derrière la tapisserie : « RÉVEILLEZ-VOUS ! L'AVENTURIER ! »", "(Ils vont sortir un par un. Attendez-les à côté du passage.)"]
                : ["« AU SECOURS ! » Il plonge derrière la tapisserie et réveille tout le monde.", "(Ils sortent tous en même temps !)"],
              roll,
              done: true,
            };
          }
        }
        if (test()) {
          const l = loot();
          leaves(l.item, l.count);
          return end(["« D'accord, d'accord ! Prends ça ! C'était volé de toute façon. »", "(Il lâche une partie de sa marchandise.)"]);
        }
        this.raiseAlarm(KRIK.shoutAlarm, g);
        this.callSlinger(g);
        return end(["« AU SECOURS ! UN AVENTURIER ME MENACE ! … C'est vrai, en plus. »", "(Un Kobold frondeur accourt.)"]);
      case "divert":
        // Quêtes v3 : protéger Krik pendant qu'il vide le dortoir ; lancer la fumée sur ceux qui sortent.
        if (!this.quest && this.openZone("traitres", g)) {
          const ok = test();
          toBag("potion_fumee", ok ? 2 : 1);
          this.zoneBreakOut(ok ? 2 : 0);
          if (this.giveTask("krik_diversion")) {
            return {
              lines: ok
                ? ["« Là-bas ! … Ça marche ! » Il vous tend des fioles : « Quand ils sortent, la fumée. Moi, je me glisse dedans. »", "(Fioles de fumée dans le sac. Les traîtres se réveillent.)"]
                : ["« Là-bas ! … C'est moi qui ai trahi tout le monde ! » Oups.", "« Vite, une fiole ! Sur eux ! »", "(Une fiole de fumée dans le sac. Ils sortent tous !)"],
              roll,
              done: true,
            };
          }
        }
        if (test()) {
          toBag("potion_fumee", KRIK.smokeFlasks);
          return end([
            "Vous lui montrez : on pointe le doigt ailleurs, on crie « Là-bas ! », on file.",
            "« Là-bas ! … Ça marche ! Même sur moi ! »",
            `« Tiens, pour toi : des fioles de fumée. Volées. »`,
            `(${KRIK.smokeFlasks} fioles de fumée dans le sac.)`,
          ]);
        }
        this.callFoes(g, "schrat", KRIK.pursuers);
        return end(["« Là-bas ! … C'est moi qui ai trahi tout le monde ! »", "« Oh non. Je l'ai dit trop fort. »", "(Ses anciens camarades accourent.)"]);
      case "buy": {
        pay(KRIK.sellPrice);
        if (this.rng.chance(KRIK.sellLie)) {
          toBag("pomme");
          return end(["« Un objet magnifique ! »", "(C'est une pomme.)", "« J'ai menti. Ça m'avait manqué. »"]);
        }
        const l = loot();
        toBag(l.item, l.count);
        return end(["« Un objet magnifique ! » Pour une fois, c'est vrai.", `(${ITEMS[l.item].name}${l.count > 1 ? ` ×${l.count}` : ""}.)`]);
      }
      case "lie":
        // Rencontres v3 : il lui faut un témoin, un Kobold vivant amené jusqu'à lui.
        if (!this.quest && this.giveTask("krik_temoin")) {
          return { lines: ["« Mentir pour toi ? Je ne peux pas ! … Mais je peux répéter ce qu'on me dit. »", "« Amène-moi un Kobold. Vivant. Ici. Pousse-le, attire-le. »"], done: true };
        }
        for (const m of this.monsters) {
          if (m.boss) continue;
          m.alerted = false;
          m.wary = false;
        }
        this.lowerAlarm(KRIK.lieAlarm);
        return end(["Krik file voir ses anciens camarades. « L'aventurier ? Il est parti par là-bas. Très loin. Il a peur de vous. »", "« … Ils m'ont cru ! »", "(Les monstres perdent votre trace ; l'étage se calme.)"]);
      case "denounce":
        if (!this.quest && this.giveTask("krik_denonce")) {
          return { lines: ["« Me dénoncer ? … Pour ça, il faut qu'un de mes camarades vienne jusqu'ici. Sans te voir. »", "« Je te préviens : je vais le lui dire. C'est vrai. »"], done: true };
        }
        mem.denounced = true;
        g.gold = (g.gold ?? 0) + this.rng.int(KRIK.bountyMin, KRIK.bountyMax);
        return end(["« HÉ ! IL EST LÀ ! » crie-t-on. Krik détale.", "Un Kobold vous jette une bourse : « La prime. Merci, l'humain. »", "(Krik s'en souviendra.)"]);
      case "discount": {
        pay(KRIK.discountPrice);
        const pool: ItemId[] = ["pomme", "torche", "potion_vitesse", "potion_fumee"];
        const item = pool[this.rng.int(0, pool.length - 1)];
        toBag(item);
        return end(["« Prix cassé. Comme l'objet. Non : l'objet va bien. Je crois. »", `(${ITEMS[item].name}.)`]);
      }
      case "rare":
        if (test()) {
          pay(KRIK.rarePrice);
          const l = loot(true);
          toBag(l.item, l.count);
          return end(["« Bon. Pour toi. Je l'ai vendu deux fois déjà, mais celui-là est le vrai. »", `(${ITEMS[l.item].name}.)`]);
        }
        return end(["« Celui-là, je le garde. C'est le seul que je n'ai pas encore vendu. »"]);
      case "invest":
        // Rencontres v3 : la mise part avec son coursier, à escorter jusqu'à l'escalier.
        if (!this.quest && this.giveTask("krik_coursier")) {
          pay(KRIK.investStake);
          const p = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: g.x + dx, y: g.y + dy })).find((c) => this.npcFree(this.current, c.x, c.y));
          if (p) this.current.courier = { ...p, fromX: p.x, fromY: p.y };
          return { lines: ["« Mon coursier porte ta mise jusqu'à l'escalier. Il a peur de tout. »", "« Reste près de lui : il n'avance qu'avec toi. Et pas de monstre à côté de lui. »"], done: true };
        }
        pay(KRIK.investStake);
        mem.invested = KRIK.investStake;
        mem.investDepth = this.depth;
        return end(["« Excellent placement. Tu seras remboursé à l'étage suivant. »", "« Je le pense vraiment. Pour l'instant. »"]);
      default:
        return { lines: [], done: false };
    }
  }

  // ---------- Tâches de quête (Thomas, 2026-11-12) ----------

  /** La tâche en cours vient-elle de ce PNJ, sur cet étage ? (Il attend alors le héros.) */
  questWith(id: NpcId): boolean {
    const q = this.quest;
    return !!q && q.depth === this.depth && QUEST_TASKS[q.id].npc === id;
  }

  /** L'objectif est-il rempli ? (Rapporter : l'objet est dans le sac.) */
  questDone(): boolean {
    const q = this.quest;
    if (!q) return false;
    const def = QUEST_TASKS[q.id];
    if (def.kind === "collect") return (def.items ?? []).every((i) => this.inventory.count(i) > 0);
    return def.kind === "fetch" ? this.inventory.count(def.item!) > 0 : q.got >= q.need;
  }

  /** Le texte du bandeau : l'objectif et où on en est, ou « revenir voir… » quand c'est fait. */
  questLine(): { text: string; done: boolean } | null {
    const q = this.quest;
    if (!q) return null;
    const def = QUEST_TASKS[q.id];
    const done = this.questDone();
    const got = def.kind === "collect" ? (def.items ?? []).filter((i) => this.inventory.count(i) > 0).length : q.got;
    return { text: done ? def.back : def.goal.replace("{0}", String(Math.min(got, q.need))).replace("{1}", String(q.need)), done };
  }

  /**
   * Donner une tâche : l'objectif n'existe qu'à partir de maintenant (l'objet à rapporter apparaît sur l'étage, sa salle se
   * montre sur la carte). Faux si elle est impossible ici (une tâche déjà en cours, pas de Kobold, pas de place).
   */
  private giveTask(id: QuestTaskId): boolean {
    if (this.quest) return false;
    const def = QUEST_TASKS[id];
    let need = 1;
    if (def.kind === "kill") {
      need = Math.min(def.count ?? 1, this.monsters.filter((m) => (def.targets === "squelettes" ? isSkeleton(m) : isKobold(m)) && !m.boss).length);
      if (need <= 0) return false;
    }
    if (id === "grum_poule") {
      // La poule aux œufs d'or s'est sauvée : elle est quelque part dans une autre salle.
      const at = this.questSpot();
      if (!at) return false;
      this.current.goldHen = { x: at.x, y: at.y, fromX: at.x, fromY: at.y };
      this.revealRoomAt(at);
    } else if (def.kind === "fetch" && def.zone && this.current.zone?.plate) {
      // Le magot n'est pas au sol : il est sous la dalle (on l'enfonce pour l'avoir).
    } else if (def.kind === "fetch" && def.zone && this.current.zone?.loot) {
      const at = this.current.zone.loot;
      this.dropItem(at.x, at.y, def.item!, 1);
    } else if (def.kind === "fetch") {
      const at = this.questSpot();
      if (!at) return false;
      this.dropItem(at.x, at.y, def.item!, 1);
      this.revealRoomAt(at);
    }
    if (def.kind === "collect") {
      // La cuisine, la forge, la salle de torture ; à défaut, une autre salle loin du héros.
      const where: Record<string, string> = { marmite: "cuisine", louche: "forge", corde: "torture" };
      for (const item of def.items ?? []) {
        const theme = (this.current.themes ?? []).find((t) => t.id === where[item]);
        let at: Point | null = null;
        if (theme) {
          const r = this.rooms[theme.room];
          const cells: Point[] = [];
          for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (this.npcFree(this.current, x, y) && !this.isTrap(x, y)) cells.push({ x, y });
          if (cells.length > 0) at = cells[this.rng.int(0, cells.length - 1)];
        }
        at ??= this.questSpot();
        if (!at) return false;
        this.dropItem(at.x, at.y, item, 1);
        this.revealRoomAt(at);
      }
      need = def.items?.length ?? 1;
    }
    if (def.kind === "count" || def.kind === "smoke" || def.kind === "enter") need = def.count ?? 1;
    // Morillon : tous les rangs de l'étage, case par case.
    if (id === "morillon_arrosage") {
      need = this.morelRows().filter((f) => !f.kind.endsWith("Wet")).length;
      if (need <= 0) return false;
    }
    if (def.zone && def.kind === "kill" && this.current.zone) {
      need = Math.min(def.count ?? 1, this.current.zone.sleepers.length);
      if (need <= 0) return false;
    }
    this.quest = { id, depth: this.depth, got: 0, need, glow: this.pendingGlow.length > 0 ? this.pendingGlow : undefined };
    this.pendingGlow = [];
    this.refreshLight();
    this.events.push({ type: "quest", what: "start", id });
    return true;
  }

  /** Où poser l'objet à rapporter : une case libre d'une autre salle, à 8 cases au moins, que le héros peut atteindre. */
  private questSpot(): Point | null {
    const map = this.map;
    const seen = new Uint8Array(map.width * map.height);
    const queue: Point[] = [{ x: this.hero.x, y: this.hero.y }];
    seen[map.index(this.hero.x, this.hero.y)] = 1;
    const cells: Point[] = [];
    const inside = (r: Room, p: Point) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
    const heroRoom = this.current.rooms.find((r) => inside(r, this.hero));
    while (queue.length > 0) {
      const p = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (!map.inBounds(x, y) || seen[map.index(x, y)] || !map.isWalkable(x, y)) continue;
        seen[map.index(x, y)] = 1;
        queue.push({ x, y });
        const far = Math.max(Math.abs(x - this.hero.x), Math.abs(y - this.hero.y)) >= 8;
        const room = this.current.rooms.find((r) => inside(r, { x, y }));
        if (far && room && room !== heroRoom && this.npcFree(this.current, x, y) && !this.isTrap(x, y)) cells.push({ x, y });
      }
    }
    return cells.length > 0 ? cells[this.rng.int(0, cells.length - 1)] : null;
  }

  /** La salle autour de cette case apparaît sur la carte. */
  private revealRoomAt(p: Point): void {
    const r = this.current.rooms.find((o) => p.x >= o.x && p.x < o.x + o.w && p.y >= o.y && p.y < o.y + o.h);
    const box = r ?? { x: p.x - 1, y: p.y - 1, w: 3, h: 3 };
    this.markGlow(box);
    for (let y = box.y - 1; y <= box.y + box.h; y++) for (let x = box.x - 1; x <= box.x + box.w; x++) if (this.map.inBounds(x, y)) this.explored[this.map.index(x, y)] = 1;
  }

  /**
   * ZONES QUI BRILLENT (Thomas, 2026-11-17 : « les quêtes ne font pas briller les zones indiquées ») : chaque salle que
   * la quête montre sur la carte brille d'un cadre doré qui palpite, tant que la quête dure (sur son étage).
   */
  private pendingGlow: { x: number; y: number; w: number; h: number }[] = [];
  private markGlow(box: { x: number; y: number; w: number; h: number }): void {
    const b = { x: box.x, y: box.y, w: box.w, h: box.h };
    if (this.quest) (this.quest.glow ??= []).push(b);
    else this.pendingGlow.push(b);
  }
  /** Les zones à faire briller sur cet étage (vide sans quête, ou une fois l'objectif rempli). */
  questGlow(): readonly { x: number; y: number; w: number; h: number }[] {
    if (!this.quest || this.quest.depth !== this.depth || this.questDone()) return [];
    return this.quest.glow ?? [];
  }

  /**
   * Les donneurs de quête de l'étage (Thomas, 2026-11-18 : « les donneurs de quêtes doivent briller ; retourner voir X,
   * on doit le voir sur la carte ») : `ret` = celui à qui rendre la quête en cours, objectif rempli ; `active` = celui
   * qui l'a donnée. Les deux se voient sur la carte même hors de vue.
   */
  questBeacons(): { id: NpcId; x: number; y: number; active: boolean; ret: boolean }[] {
    const giver = this.quest && this.quest.depth === this.depth ? QUEST_TASKS[this.quest.id].npc : null;
    const out: { id: NpcId; x: number; y: number; active: boolean; ret: boolean }[] = [];
    for (const id of NPC_IDS) {
      const g = this.npc(id);
      if (!g) continue;
      out.push({ id, x: g.x, y: g.y, active: id === giver, ret: id === giver && this.questDone() });
    }
    return out;
  }

  /** Revenir voir le PNJ : il attend tant que ce n'est pas fait ; sinon on lui rend la tâche. */
  private questScene(id: NpcId): { lines: string[]; choices: GluckChoice[] } {
    const def = QUEST_TASKS[this.quest!.id];
    if (!this.questDone()) return { lines: [def.waiting], choices: [{ id: "leave", label: "Partir" }] };
    return { lines: [this.questLine()!.text + "."], choices: [{ id: "turnin", label: "C'est fait !" }, { id: "leave", label: "Plus tard" }] };
  }

  private questChoose(id: NpcId, choice: string): GluckResult {
    const g = this.npc(id);
    if (!g || !this.canTalk(id)) return { lines: [], done: true };
    if (choice !== "turnin" || !this.questDone()) return { lines: [], done: true };
    const q = this.quest!;
    const def = QUEST_TASKS[q.id];
    if (def.kind === "fetch") this.inventory.take(def.item!, 1);
    if (def.kind === "collect") for (const i of def.items ?? []) this.inventory.take(i, 1);
    const leaves = (item: ItemId, count = 1) => (g.items ??= []).push({ item, count });
    switch (q.id) {
      case "gluck_sac":
        g.drops = (g.drops ?? 0) + 3;
        this.gluckMemory.mood = Math.min(1, this.gluckMemory.mood + 1);
        break;
      case "gluck_statue":
        g.drops = (g.drops ?? 0) + 2;
        this.gluckMemory.mood = Math.min(1, this.gluckMemory.mood + 1);
        break;
      case "soeur_kobolds":
        this.grantProtection();
        this.grantLuck();
        break;
      case "clavicule_cranes":
        this.current.restful = true;
        break;
      case "osselet_corne":
        leaves("massue_os", 1);
        break;
      case "clavicule_cierges":
        leaves("potion_nuit", 1);
        break;
      case "krik_magot": {
        g.gold = (g.gold ?? 0) + this.rng.int(KRIK.cacheGoldMin, KRIK.cacheGoldMax);
        const l = this.floorLoot();
        leaves(l.item, l.count);
        break;
      }
      case "krik_traqueurs": {
        this.revealKoboldRooms();
        leaves("pomme");
        const l = this.floorLoot();
        leaves(l.item, l.count);
        break;
      }
      case "krik_dortoir":
      case "krik_passage": {
        g.gold = (g.gold ?? 0) + this.rng.int(KRIK.cacheGoldMin, KRIK.cacheGoldMax);
        const l = this.floorLoot();
        leaves(l.item, l.count);
        break;
      }
      case "krik_diversion":
        g.gold = (g.gold ?? 0) + 10;
        leaves("potion_fumee", 2);
        break;
      case "gluck_piste":
        g.drops = (g.drops ?? 0) + 2;
        break;
      case "soeur_cierges":
        this.grantProtection();
        break;
      case "soeur_grille":
        this.revealStairs();
        this.clarityDepth = this.depth;
        break;
      case "soeur_cloche":
        if (q.noisy) this.raiseAlarm(SOEUR.craftAlarm, g);
        this.grantLuck();
        break;
      case "grum_poule":
        leaves("oeuf_or");
        break;
      case "gluck_rival":
        this.gluckMemory.discount = true;
        break;
      case "gluck_local":
        g.gold = (g.gold ?? 0) + 25;
        g.drops = (g.drops ?? 0) + 2;
        break;
      case "gluck_banc":
        for (const t of this.current.traps) t.hidden = false;
        for (const t of this.current.traps) this.map.touch(t.x, t.y);
        this.grantLuck();
        break;
      case "krik_temoin":
        for (const m of this.monsters) {
          if (m.boss) continue;
          m.alerted = false;
          m.wary = false;
        }
        this.lowerAlarm(KRIK.lieAlarm);
        break;
      case "krik_denonce":
        this.krikMemory.denounced = true;
        g.gold = (g.gold ?? 0) + this.rng.int(KRIK.bountyMin, KRIK.bountyMax);
        break;
      case "krik_coursier":
        this.krikMemory.invested = KRIK.investStake * 2;
        this.krikMemory.investDepth = this.depth;
        break;
      case "grum_foin":
        leaves("fourche");
        break;
      case "grum_chapeau":
        leaves("casque_poulet");
        break;
      case "vernis_poulet":
        leaves("ticket_expo");
        break;
      case "vernis_socle":
        leaves("pinceau_magique");
        break;
      case "maestro_partition":
        leaves("diapason");
        break;
      case "plumeau_clef":
        this.revealFloorPlan();
        g.gold = (g.gold ?? 0) + lessGold(PLUMEAU.gold);
        break;
      case "morillon_arrosage":
        leaves("morille", MORILLON.reward);
        if (q.charmed) g.gold = (g.gold ?? 0) + 15;
        break;
    }
    this.quest = null;
    this.events.push({ type: "quest", what: "complete", id: q.id });
    // Une quête menée à bien rapporte de l'expérience (Thomas, 2026-11-13 : les quêtes aident à monter de niveau).
    this.gainXp(RULES.questXp);
    this.npcLeaves(id, g, this.npcMax(id));
    return { lines: def.thanks, done: true };
  }

  /** Descendre sans être revenu : la tâche est ratée, le PNJ s'en va. Le magot de Krik, lui, est gardé (en or). */
  private failQuest(): void {
    const q = this.quest!;
    const def = QUEST_TASKS[q.id];
    let gold: number | undefined;
    if (def.kind === "fetch" && this.inventory.take(def.item!, 1) && q.id === "krik_magot") {
      gold = lessGold(KRIK.keptMagot);
      this.gold += gold;
    }
    const g = this.current[def.npc];
    if (g) g.gone = true;
    if (def.npc === "gluck") this.gluckMemory.mood = Math.max(-1, this.gluckMemory.mood - 1);
    this.quest = null;
    this.events.push({ type: "quest", what: "fail", id: q.id, gold });
  }

  // ---------- Quêtes v3 : zones spéciales (Thomas, 2026-11-13/14) ----------

  /** La zone spéciale de l'étage, s'il y en a une. */
  zone(): Readonly<QuestZone> | null {
    return this.current.zone ?? null;
  }

  /**
   * Tailler la zone dans la roche, contre le mur du haut (sinon du bas) d'une salle, le plus près possible du PNJ (à 4
   * cases au moins). L'entrée est une case de ce mur, couverte d'une tapisserie. Dortoir des traîtres : 7 × 4, trois
   * paillasses et trois Kobolds endormis, une bougie, une dalle à pression. Placard : 3 × 2, une pomme. Faux si rien ne
   * convient (ou s'il y a déjà une zone sur l'étage).
   */
  private openZone(kind: QuestZone["kind"], near: Point, prefer?: Room): boolean {
    const state = this.current;
    if (state.zone || state.boss) return false;
    const map = this.map;
    const inRoom = (p: Point) => this.rooms.some((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
    // Tailles essayées : large d'abord (W cases de large, D de profondeur depuis l'entrée).
    const sizes: [number, number][] =
      kind === "traitres" || kind === "cellier" || kind === "grange" ? [[7, 4], [5, 3]] : kind === "sacristie" || kind === "tripot" ? [[5, 3], [3, 3]] : [[3, 2]];
    const door: QuestZone["door"] = kind === "cellier" ? "barrel" : kind === "grange" ? "hay" : kind === "sacristie" ? "wall" : "tapestry";
    for (const [W, D] of sizes) {
      const half = Math.floor(W / 2);
      let best: { entry: Point; dir: Point; room: Room; host: Room; score: number } | null = null;
      for (const r of this.rooms) {
        // Murs du haut et du bas d'abord (la tapisserie y pend mieux), puis de côté.
        const sides: { dir: Point; cells: Point[] }[] = [
          { dir: { x: 0, y: -1 }, cells: Array.from({ length: Math.max(0, r.w - 2) }, (_, i) => ({ x: r.x + 1 + i, y: r.y - 1 })) },
          { dir: { x: 0, y: 1 }, cells: Array.from({ length: Math.max(0, r.w - 2) }, (_, i) => ({ x: r.x + 1 + i, y: r.y + r.h })) },
          { dir: { x: -1, y: 0 }, cells: Array.from({ length: Math.max(0, r.h - 2) }, (_, i) => ({ x: r.x - 1, y: r.y + 1 + i })) },
          { dir: { x: 1, y: 0 }, cells: Array.from({ length: Math.max(0, r.h - 2) }, (_, i) => ({ x: r.x + r.w, y: r.y + 1 + i })) },
        ];
        for (const [side, { dir, cells }] of sides.entries()) {
          for (const e of cells) {
            const inner = { x: e.x - dir.x, y: e.y - dir.y };
            // La pièce : D cases de profondeur derrière le mur, W de large, centrée sur l'entrée.
            const xs = dir.x !== 0 ? [e.x + dir.x, e.x + dir.x * D] : [e.x - half, e.x + half];
            const ys = dir.y !== 0 ? [e.y + dir.y, e.y + dir.y * D] : [e.y - half, e.y + half];
            const room: Room = { x: Math.min(...xs), y: Math.min(...ys), w: Math.abs(xs[1] - xs[0]) + 1, h: Math.abs(ys[1] - ys[0]) + 1 };
            if (room.x - 1 < 1 || room.y - 1 < 1 || room.x + room.w + 1 >= map.width - 1 || room.y + room.h + 1 >= map.height - 1) continue;
            let ok = map.get(inner.x, inner.y) === Tile.Floor && map.get(e.x, e.y) === Tile.Wall;
            ok &&= !state.furniture.some((f) => furnitureCells(f).some((c) => (c.x === inner.x && c.y === inner.y) || (c.x === e.x && c.y === e.y)));
            // Toute la boîte (la pièce et son mur) est de la roche, hors de toute salle.
            for (let y = room.y - 1; ok && y <= room.y + room.h; y++)
              for (let x = room.x - 1; ok && x <= room.x + room.w; x++) if (map.get(x, y) !== Tile.Wall || inRoom({ x, y })) ok = false;
            // Pas collée à une porte ni à une torche.
            const perp = { x: dir.y !== 0 ? 1 : 0, y: dir.x !== 0 ? 1 : 0 };
            if (ok && [-1, 1].some((k) => map.isDoor(e.x + perp.x * k, e.y + perp.y * k) || map.isDoor(inner.x + perp.x * k, inner.y + perp.y * k))) ok = false;
            if (ok && this.torches.some((t) => t.x === e.x && t.y === e.y)) ok = false;
            // Ni sous un écriteau de la salle d'essai (son texte déborde de 4 cases).
            if (ok && this.signs().some((sg) => sg.y === e.y && Math.abs(sg.x - e.x) <= 5)) ok = false;
            if (!ok) continue;
            const d = Math.max(Math.abs(e.x - near.x), Math.abs(e.y - near.y));
            const score = (d < 4 ? 100 : d) + side * 3 + (prefer && r !== prefer ? 60 : 0);
            if (!best || score < best.score) best = { entry: e, dir, room, host: r, score };
          }
        }
      }
      if (!best) continue;
      const { entry, dir, room } = best;
      const perp = { x: dir.y !== 0 ? 1 : 0, y: dir.x !== 0 ? 1 : 0 };
      /** Une case de la pièce : `a` en travers (0 à W-1), `d` en profondeur (0 : contre l'entrée). */
      const at = (a: number, d: number): Point => ({ x: entry.x + dir.x * (d + 1) + perp.x * (a - half), y: entry.y + dir.y * (d + 1) + perp.y * (a - half) });
      for (let y = room.y; y < room.y + room.h; y++)
        for (let x = room.x; x < room.x + room.w; x++) {
          map.set(x, y, Tile.Floor);
          state.explored[map.index(x, y)] = 0;
        }
      map.touch(entry.x, entry.y);
      state.rooms.push(room);
      const doorKind =
        // Tapisserie et rideau tournés vers la salle (Thomas, 2026-11-14) : de face sur le mur du haut, par la tranche ailleurs.
        kind === "tripot" || door === "tapestry"
          ? `${kind === "tripot" ? "curtain" : "tapestry"}${dir.y < 0 ? "" : dir.y > 0 ? "Low" : dir.x < 0 ? "SideL" : "SideR"}`
          : door === "barrel" ? "barrelWall" : door === "hay" ? "hayWall" : null;
      if (doorKind) state.furniture.push({ x: entry.x, y: entry.y, kind: doorKind });
      const zone: QuestZone = { kind, door, room, entry, open: false, sleepers: [], host: this.rooms.indexOf(best.host) };
      // La salle où chercher l'entrée brille (Thomas, 2026-11-17 : « les quêtes ne font pas briller les zones »).
      this.markGlow(best.host);
      const sleeper = (p: Point, asleep: boolean) => {
        const k = this.newMonster(MONSTERS.schrat, p.x, p.y, asleep);
        k.fromX = p.x;
        k.fromY = p.y;
        k.patrol = room;
        if (this.peaceful) this.peacefulStash.push(k);
        else this.monsters.push(k);
        zone.sleepers.push(k.id);
      };
      const put = (p: Point, kind: string) => {
        state.furniture.push({ x: p.x, y: p.y, kind });
        if (FURNITURE_KINDS[kind]?.blocks) map.set(p.x, p.y, Tile.Furniture);
      };
      if (kind === "traitres") {
        // Le dortoir des traîtres (Thomas, 2026-11-14 : « les mêmes lits que le dortoir normal, et le tapis aussi ») :
        // des lits superposés au fond, un tapis usé, trois Kobolds endormis au pied des lits ; une bougie, une dalle.
        zone.candle = at(W - 1, D >= 4 ? 1 : 0);
        zone.candleLit = true;
        put(zone.candle, "candle");
        zone.plate = at(half, D >= 4 ? 1 : 0);
        put(zone.plate, "pressurePlate");
        const inZone = (p: Point) => p.x >= room.x && p.y >= room.y && p.x < room.x + room.w && p.y < room.y + room.h;
        const same = (p: Point, q: Point) => p.x === q.x && p.y === q.y;
        const doorway = at(half, 0);
        const taken = (p: Point) =>
          same(p, zone.candle!) || same(p, zone.plate!) || same(p, doorway) || map.get(p.x, p.y) !== Tile.Floor;
        // Les lits (2 cases en largeur, comme au dortoir) : contre le mur du fond si la zone est en haut ou en bas ;
        // sur une zone de côté, tout au fond, une rangée sur deux.
        const beds: Point[] = [];
        const tryBed = (p: Point) => {
          const cells = [p, { x: p.x + 1, y: p.y }];
          if (!cells.every((c) => inZone(c) && !taken(c))) return;
          put(p, beds.length % 2 === 0 ? "bunkA" : "bunkB");
          beds.push(p);
        };
        if (dir.y !== 0) {
          for (let a = W >= 7 ? 1 : 0; a + 1 < W && beds.length < 3; a += W >= 7 ? 2 : 3) {
            const p = at(a, D - 1);
            const q = at(a + 1, D - 1);
            tryBed({ x: Math.min(p.x, q.x), y: p.y });
          }
        } else {
          const backX = dir.x > 0 ? room.x + room.w - 2 : room.x;
          for (let y = room.y; y < room.y + room.h && beds.length < 3; y += 2) tryBed({ x: backX, y });
        }
        // Les dormeurs : au pied de chaque lit (côté salle), sinon sur une case libre de la zone.
        const free = (p: Point) => inZone(p) && !taken(p) && !this.actorAt(p.x, p.y);
        const spots: Point[] = [];
        for (const b of beds) {
          // Devant le lit (la rangée du dessous) ; un lit contre le mur du bas cacherait qui dort juste au-dessus : deux rangées plus haut.
          const front = [{ x: b.x, y: b.y + 1 }, { x: b.x + 1, y: b.y + 1 }, { x: b.x, y: b.y - 2 }, { x: b.x + 1, y: b.y - 2 }];
          const f = front.find(free);
          if (f) spots.push(f);
        }
        for (let d = D - 1; d >= 0 && spots.length < 3; d--)
          for (let a2 = 0; a2 < W && spots.length < 3; a2++) {
            const p = at(a2, d);
            if (free(p) && !spots.some((q) => same(p, q))) spots.push(p);
          }
        for (const p of spots.slice(0, 3)) sleeper(p, true);
        // Le tapis usé (3 × 2, à plat), devant les lits.
        for (let y = room.y; y < room.y + room.h - 1 && !state.furniture.some((f) => f.kind.startsWith("rug") && inZone(f)); y++)
          for (let x = room.x; x < room.x + room.w - 2; x++) {
            const cells: Point[] = [];
            for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 3; dx++) cells.push({ x: x + dx, y: y + dy });
            if (cells.some((c) => map.get(c.x, c.y) !== Tile.Floor || same(c, zone.plate!))) continue;
            state.furniture.push({ x, y, kind: this.rng.chance(0.5) ? "rug" : "rugB" });
            break;
          }
      } else if (kind === "cellier") {
        // Le cellier de Gluck : cageots de pommes dans les coins, deux Kobolds qui dorment sur SES pommes, une bougie.
        put(at(0, D - 1), "crate");
        put(at(W - 1, D - 1), "crateStack");
        sleeper(at(1, D - 1), true);
        sleeper(at(W - 2, D - 1), true);
        zone.loot = at(half, D - 1);
        zone.inside = at(half, Math.max(0, D - 2));
        zone.candle = at(W - 1, 0);
        zone.candleLit = true;
        put(zone.candle, "candle");
      } else if (kind === "sacristie") {
        // La sacristie : le coffre des offrandes, un cierge qui ne s'éteint jamais.
        const c = at(half, D - 1);
        map.set(c.x, c.y, Tile.Chest);
        zone.candle = at(0, D - 1);
        zone.candleLit = true;
        put(zone.candle, "ciergeLit");
      } else if (kind === "tripot") {
        // Le tripot de Fifrelin, derrière un rideau : la caisse (un coffre), le gobelet truqué sur une table.
        const c = at(half, D - 1);
        map.set(c.x, c.y, Tile.Chest);
        zone.loot = at(0, D - 1);
        zone.candle = at(W - 1, D - 1);
        zone.candleLit = true;
        put(zone.candle, "candle");
      } else if (kind === "grange") {
        // La grange de Grum : des bottes de foin, deux voleurs de foin bien éveillés.
        put(at(0, D - 1), "hayBale");
        put(at(W - 1, D - 1), "hayBale");
        sleeper(at(2, D - 2), false);
        sleeper(at(W - 3, D - 2), false);
      } else {
        this.dropItem(at(0, D - 1).x, at(0, D - 1).y, "pomme", 1);
      }
      state.zone = zone;
      // L'entrée se voit sur la carte : la porte secrète et le bout de salle devant elle (pas la sacristie, cachée).
      if (door !== "wall") {
        for (let k = -1; k <= 1; k++)
          for (const d of [0, -1]) {
            const x = entry.x + perp.x * k + dir.x * d;
            const y = entry.y + perp.y * k + dir.y * d;
            if (map.inBounds(x, y)) state.explored[map.index(x, y)] = 1;
          }
        this.events.push({ type: "zone", what: "shown", x: entry.x, y: entry.y });
      }
      this.refreshLight();
      return true;
    }
    return false;
  }

  /** L'entrée secrète de la zone sur cette case (encore fermée, et qu'on peut ouvrir en la touchant). */
  zoneDoorAt(x: number, y: number): boolean {
    const z = this.current.zone;
    return !!z && !z.open && z.door !== "wall" && z.entry.x === x && z.entry.y === y;
  }

  /** Compatibilité : la tapisserie (fermée) sur cette case. */
  tapestryAt(x: number, y: number): boolean {
    return this.zoneDoorAt(x, y) && this.current.zone!.door === "tapestry";
  }

  /** Les bombes posées : le compte à rebours, puis l'explosion. */
  /**
   * Grenade sainte (Thomas, 2026-11-19) : elle éclate à l'impact en lumière jaune, sur `holyRadius` cases autour (vues
   * depuis le point d'impact). Les monstres pris brûlent (les morts deux fois plus) ; le héros pris dedans est béni
   * (+1 attaque, +1 CA) et soigné un peu ; jamais blessé.
   */
  private holyBurst(at: Point): void {
    this.reveal();
    const R = RULES.holyRadius;
    const cells: Point[] = [];
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const p = { x: at.x + dx, y: at.y + dy };
        if (dx * dx + dy * dy > R * R + 1 || !this.map.inBounds(p.x, p.y) || this.map.blocksSight(p.x, p.y)) continue;
        if (hasLineOfSight(this.map, at, p)) cells.push(p);
      }
    }
    const hit: Actor[] = [];
    for (const m of [...this.monsters]) {
      if (this.isInert(m) || !cells.some((c) => occupies(m, c.x, c.y))) continue;
      const undead = !!(MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef | undefined)?.undead;
      const dmg = rollDice(this.rng, RULES.holyDamage) * (undead ? 2 : 1);
      m.hp -= dmg;
      m.heroHurt = true;
      m.alerted = true;
      m.asleep = false;
      m.chanting = false;
      if (undead) m.crush = true;
      hit.push(m);
      this.events.push({ type: "burn", actor: m, damage: dmg });
    }
    const blessed = cells.some((c) => c.x === this.hero.x && c.y === this.hero.y);
    let healed = 0;
    if (blessed) {
      this.blessTurns = Math.max(this.blessTurns, RULES.holyBlessTurns);
      healed = Math.min(this.hero.maxHp - this.hero.hp, rollDice(this.rng, RULES.holyHeal));
      this.hero.hp += healed;
      this.refreshStats();
    }
    this.events.push({ type: "holy", fromX: this.hero.x, fromY: this.hero.y, x: at.x, y: at.y, cells, hit: hit.length, blessed, healed });
    for (const m of hit) this.removeIfDead(m);
  }

  private bombTick(): void {
    const bombs = this.current.bombs;
    if (!bombs || bombs.length === 0) return;
    for (const b of [...bombs]) {
      b.turns--;
      if (b.turns > 0) {
        this.events.push({ type: "bomb", what: "tick", x: b.x, y: b.y, n: b.turns });
        continue;
      }
      bombs.splice(bombs.indexOf(b), 1);
      this.explodeBomb(b);
      if (this.over) return;
    }
  }

  /** Les bombes posées sur l'étage (pour l'affichage). */
  bombs(): readonly { x: number; y: number; turns: number }[] {
    return this.current.bombs ?? [];
  }

  /**
   * L'explosion : la case et une croix de 4 cases dans chaque direction (arrêtée par les murs). Une porte sur le chemin
   * saute (elle disparaît, l'onde s'arrête là). 2d6 à chacun dans la croix, le héros compris ; un nuage gris ; tout
   * l'étage proche l'entend.
   */
  private explodeBomb(b: Point): void {
    const cells: Point[] = [{ x: b.x, y: b.y }];
    const doors: Point[] = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let k = 1; k <= RULES.bombArm; k++) {
        const x = b.x + dx * k;
        const y = b.y + dy * k;
        const t = this.map.get(x, y);
        if (t === Tile.DoorClosed || t === Tile.DoorLocked || t === Tile.DoorOpen) {
          this.map.set(x, y, Tile.Floor);
          doors.push({ x, y });
          cells.push({ x, y });
          break;
        }
        if (!this.map.isWalkable(x, y)) break;
        cells.push({ x, y });
      }
    }
    const hit: Actor[] = [];
    for (const m of [...this.monsters]) {
      if (!cells.some((c) => occupies(m, c.x, c.y))) continue;
      const dmg = rollDice(this.rng, RULES.bombDamage);
      m.hp -= dmg;
      m.heroHurt = true;
      m.alerted = true;
      m.asleep = false;
      hit.push(m);
      this.events.push({ type: "burn", actor: m, damage: dmg });
      this.removeIfDead(m);
    }
    const hero = this.hero;
    this.raiseAlarm(RULES.alarmBreak, b);
    this.events.push({ type: "bomb", what: "boom", x: b.x, y: b.y, cells, doors, hit });
    this.smokeBurst(b, 1);
    if (cells.some((c) => c.x === hero.x && c.y === hero.y)) {
      hit.push(hero);
      this.hurtHero(rollDice(this.rng, RULES.bombDamage), "une bombe arcanique");
    }
  }

  /**
   * La chambre de neige fond à la chaleur (Thomas, 2026-11-16 : « anticipe que tout va fondre ») : un feu dans la pièce
   * ou contre elle, et tout fond d'un coup : congères, tas et igloo disparaissent, le bonhomme devient une flaque (sa
   * carotte tombe s'il l'avait encore), quelques flaques d'eau restent au sol, la neige laisse la pierre.
   */
  private meltSnow(): void {
    const s = this.current.secretRoom;
    if (!s || s.layout !== "neige" || s.melted) return;
    const r = s.room;
    const hot = this.fires.some((f) => f.x >= r.x - 1 && f.y >= r.y - 1 && f.x <= r.x + r.w && f.y <= r.y + r.h && this.isBurning(f.x, f.y));
    if (!hot) return;
    s.melted = true;
    const furniture = this.current.furniture;
    for (let i = furniture.length - 1; i >= 0; i--) {
      const f = furniture[i];
      if (f.x < r.x || f.y < r.y || f.x >= r.x + r.w || f.y >= r.y + r.h) continue;
      if (f.kind === "congereA" || f.kind === "congereB" || f.kind === "tasNeige" || f.kind === "igloo") {
        if (this.map.get(f.x, f.y) === Tile.Furniture) this.map.set(f.x, f.y, Tile.Floor);
        furniture.splice(i, 1);
      } else if (f.kind === "bonhomme") {
        if (!f.drained) {
          f.drained = true;
          const at = this.landingCell(f, "carotte_magique", f);
          this.dropItem(at.x, at.y, "carotte_magique", 1);
        }
        f.kind = "bonhommeFondu";
        this.map.set(f.x, f.y, Tile.Floor);
      }
    }
    // Quelques flaques de neige fondue (pas sur l'entrée, ni sous un objet).
    const cells: Point[] = [];
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++)
        if (this.map.get(x, y) === Tile.Floor && !(x === s.entry.x + s.dir.x && y === s.entry.y + s.dir.y) && !this.ground.some((g) => g.x === x && g.y === y) && !furniture.some((f) => f.x === x && f.y === y)) cells.push({ x, y });
    for (let k = Math.min(cells.length, RULES.snowMeltPuddles); k > 0; k--) {
      const c = cells.splice(this.rng.int(0, cells.length - 1), 1)[0];
      this.map.set(c.x, c.y, Tile.Water);
    }
    for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) this.map.touch(x, y);
    this.events.push({ type: "melt", x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2), seen: this.isVisible(r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)) });
  }

  /** Le bonhomme de neige (chambre de neige) qui a encore sa carotte, sur cette case. */
  snowmanAt(x: number, y: number): Furniture | null {
    return this.current.furniture.find((f) => f.kind === "bonhomme" && !f.drained && f.x === x && f.y === y) ?? null;
  }

  /** La carotte magique se décroche du nez du bonhomme de neige (Thomas, 2026-11-16) et tombe à côté. */
  private pickCarrot(f: Furniture): void {
    f.drained = true;
    this.map.touch(f.x, f.y);
    const at = this.landingCell(f, "carotte_magique", f);
    this.dropItem(at.x, at.y, "carotte_magique", 1);
    this.events.push({ type: "snowman", x: f.x, y: f.y, toX: at.x, toY: at.y });
  }

  /** Un alambic plein (pièce secrète) sur cette case. */
  alembicAt(x: number, y: number): Furniture | null {
    return this.current.furniture.find((f) => f.kind === "alambic" && !f.drained && f.x === x && f.y === y) ?? null;
  }

  /** Tirer une fiole de l'alambic (Thomas, 2026-11-15) : elle se remplit de sa potion et tombe à côté ; il reste vide. */
  private drawAlembic(f: Furniture): void {
    f.drained = true;
    this.map.touch(f.x, f.y);
    const item = (f.potion ?? "potion_feu") as ItemId;
    const at = this.landingCell(f, item, f);
    this.dropItem(at.x, at.y, item, 1);
    this.refreshLight();
    this.events.push({ type: "alembic", x: f.x, y: f.y, item, toX: at.x, toY: at.y });
  }

  /** La bougie (encore allumée) de la zone sur cette case (le cierge de la sacristie ne s'éteint pas). */
  candleAt(x: number, y: number): boolean {
    const z = this.current.zone;
    return !!z && z.kind !== "sacristie" && !!z.candleLit && !!z.candle && z.candle.x === x && z.candle.y === y;
  }

  /** Ouvrir l'entrée : tapisserie tranchée, tonneau ou botte de foin poussés de côté, mur qui coulisse. */
  private openZoneDoor(): void {
    const z = this.current.zone;
    if (!z || z.open) return;
    z.open = true;
    this.map.set(z.entry.x, z.entry.y, Tile.Floor);
    const f = this.current.furniture.find((o) => o.x === z.entry.x && o.y === z.entry.y && /^(tapestry|barrelWall|hayWall|curtain)/.test(o.kind));
    if (f && f.kind.startsWith("curtain")) f.kind = `${f.kind}Open`;
    else if (f && f.kind.startsWith("tapestry")) f.kind = `${f.kind}Cut`;
    else if (f) {
      // Le tonneau (la botte) glisse de côté, dans la salle, sur une case libre ; sinon il roule dans la zone.
      const inRoom = { x: z.entry.x * 2 - (z.room.x + Math.floor(z.room.w / 2)), y: z.entry.y * 2 - (z.room.y + Math.floor(z.room.h / 2)) };
      const out = { x: Math.sign(inRoom.x - z.entry.x), y: Math.sign(inRoom.y - z.entry.y) };
      const front = { x: z.entry.x + out.x, y: z.entry.y + out.y };
      const sides = out.x === 0 ? [{ x: front.x - 1, y: front.y }, { x: front.x + 1, y: front.y }] : [{ x: front.x, y: front.y - 1 }, { x: front.x, y: front.y + 1 }];
      const free = sides.find((p) => this.map.get(p.x, p.y) === Tile.Floor && !this.actorAt(p.x, p.y) && !this.current.furniture.some((o) => furnitureCells(o).some((c) => c.x === p.x && c.y === p.y)) && !this.isTrap(p.x, p.y));
      const moved = f.kind === "barrelWall" ? "barrel" : "hayBale";
      if (free) {
        f.x = free.x;
        f.y = free.y;
        f.kind = moved;
        this.map.set(free.x, free.y, Tile.Furniture);
      } else this.current.furniture = this.current.furniture.filter((o) => o !== f);
    }
    this.events.push({ type: "zone", what: z.door === "tapestry" ? "tapestry" : z.door === "wall" ? "wall" : "pushed", x: z.entry.x, y: z.entry.y });
    this.refreshLight();
    this.updateVision();
  }

  /** Tests et anciens appels : trancher la tapisserie. */
  private cutTapestry(): void {
    this.openZoneDoor();
  }

  /** Pousser le tonneau creux ou la botte de foin : d20 + force contre 8 (C) ; raté, il ne bouge pas. */
  private pushZoneDoor(): void {
    const z = this.current.zone;
    if (!z || z.open) return;
    const bonus = this.pushBonus();
    const d20 = this.rng.int(1, 20);
    const success = d20 === 20 || (d20 !== 1 && d20 + bonus >= 8);
    if (success) this.openZoneDoor();
    else this.events.push({ type: "zone", what: "stuck", x: z.entry.x, y: z.entry.y });
  }

  /** Souffler la bougie : le noir ; les dormeurs de la zone n'entendent plus rien (seul un coup les réveille). */
  private blowCandle(): void {
    const z = this.current.zone;
    if (!z || !z.candleLit || !z.candle) return;
    z.candleLit = false;
    const f = this.current.furniture.find((o) => o.x === z.candle!.x && o.y === z.candle!.y && o.kind === "candle");
    if (f) f.kind = "candleOut";
    for (const m of this.monsters) if (z.sleepers.includes(m.id) && m.asleep) m.deaf = true;
    this.events.push({ type: "zone", what: "candle", x: z.candle.x, y: z.candle.y });
    this.refreshLight();
  }

  /** Le héros marche sur la dalle à pression : clac ! la niche s'ouvre ; le bruit réveille un dormeur sur deux. */
  private zoneStep(): void {
    const z = this.current.zone;
    if (!z?.plate || z.pressed || this.hero.x !== z.plate.x || this.hero.y !== z.plate.y) return;
    z.pressed = true;
    const f = this.current.furniture.find((o) => o.x === z.plate!.x && o.y === z.plate!.y && o.kind === "pressurePlate");
    if (f) f.kind = "pressurePlateDown";
    const q = this.quest;
    if (q?.id === "krik_magot" && q.depth === this.depth) this.dropItem(z.plate.x, z.plate.y, "magot_krik", 1);
    else this.dropItem(z.plate.x, z.plate.y, "or", this.rng.int(KRIK.cacheGoldMin, KRIK.cacheGoldMax));
    let woke = 0;
    for (const m of this.monsters) {
      if (!z.sleepers.includes(m.id) || !m.asleep || m.deaf || !this.rng.chance(0.5)) continue;
      m.asleep = false;
      m.alerted = true;
      woke++;
    }
    this.events.push({ type: "zone", what: "plate", x: z.plate.x, y: z.plate.y, woke });
  }

  /**
   * Les traîtres se réveillent et sortent par la tapisserie (arrachée). `stagger` : tours d'écart entre deux sorties
   * (0 : tous en même temps).
   */
  private zoneBreakOut(stagger: number): void {
    const z = this.current.zone;
    if (!z) return;
    if (!z.open) this.cutTapestry();
    let i = 0;
    for (const m of [...this.monsters, ...this.peacefulStash]) {
      if (!z.sleepers.includes(m.id)) continue;
      m.asleep = false;
      m.alerted = true;
      m.deaf = false;
      m.patrol = undefined;
      if (stagger > 0 && i > 0) m.stunned = Math.max(m.stunned ?? 0, i * stagger);
      i++;
    }
  }

  /** Gluck menacé file dans son cellier : une pomme toutes les 3 cases de son chemin ; lui, il se cache dedans. */
  private appleTrail(g: GluckSpot): void {
    const z = this.current.zone;
    if (!z) return;
    const dir = { x: Math.sign(z.room.x + z.room.w / 2 - 0.5 - z.entry.x), y: Math.sign(z.room.y + z.room.h / 2 - 0.5 - z.entry.y) };
    const front = { x: z.entry.x - dir.x, y: z.entry.y - dir.y };
    const path = findPath(this.map, g, front) ?? [];
    for (let i = 2; i < path.length; i += 3) {
      const p = path[i];
      if (this.map.get(p.x, p.y) === Tile.Floor && !this.isTrap(p.x, p.y)) this.dropItem(p.x, p.y, "pomme", 1);
    }
    const spot = z.inside ?? z.loot;
    if (spot) {
      g.x = spot.x;
      g.y = spot.y;
    }
  }

  /** La salle de prière de l'étage (s'il y en a une). */
  private chapelRoom(): Room | null {
    const t = (this.current.themes ?? []).find((o) => o.id === "priere" || o.id === "chapelle");
    return t ? this.rooms[t.room] : null;
  }

  /** Une case libre (sol nu d'une salle, hors passage) d'une salle donnée, ou de la salle la plus proche d'un point. */
  private freeCellIn(r: Room): Point | null {
    const cells: Point[] = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (this.npcFree(this.current, x, y) && !this.isTrap(x, y)) cells.push({ x, y });
    return cells.length > 0 ? cells[this.rng.int(0, cells.length - 1)] : null;
  }

  /** Sœur Osseuse : trois cierges éteints, un dans la chapelle (ou sa salle), deux dans d'autres salles. */
  private placeCierges(g: GluckSpot): boolean {
    const home = this.chapelRoom() ?? this.rooms.find((r) => g.x >= r.x && g.x < r.x + r.w && g.y >= r.y && g.y < r.y + r.h);
    const cells: Point[] = [];
    const first = home ? this.freeCellIn(home) : null;
    if (first) cells.push(first);
    for (let attempt = 0; attempt < 12 && cells.length < 3; attempt++) {
      const at = this.questSpot();
      if (at && !cells.some((c) => this.rooms.find((r) => c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h) === this.rooms.find((r) => at.x >= r.x && at.x < r.x + r.w && at.y >= r.y && at.y < r.y + r.h))) cells.push(at);
    }
    if (cells.length < 3) return false;
    this.current.cierges = cells;
    for (const c of cells) {
      this.current.furniture.push({ x: c.x, y: c.y, kind: "cierge" });
      this.map.set(c.x, c.y, Tile.Furniture);
      this.revealRoomAt(c);
    }
    return true;
  }

  /** Un cierge éteint (de la quête de Sœur Osseuse) sur cette case. */
  ciergeAt(x: number, y: number): boolean {
    return this.current.furniture.some((f) => f.x === x && f.y === y && f.kind === "cierge");
  }

  /** Allumer un cierge : il faut une flamme (une torche, allumée ou dans le sac). Les trois : la sacristie s'ouvre. */
  private lightCierge(at: Point): void {
    const f = this.current.furniture.find((o) => o.x === at.x && o.y === at.y && o.kind === "cierge");
    if (!f) return;
    if (!this.torchLit() && this.inventory.count("torche") === 0) {
      this.events.push({ type: "zone", what: "noflame", x: at.x, y: at.y });
      return;
    }
    f.kind = "ciergeLit";
    this.map.touch(at.x, at.y);
    const q = this.quest;
    const lit = this.current.furniture.filter((o) => o.kind === "ciergeLit" && (this.current.cierges ?? []).some((c) => c.x === o.x && c.y === o.y)).length;
    if ((q?.id === "soeur_cierges" || q?.id === "clavicule_cierges") && q.depth === this.depth) q.got = lit;
    this.events.push({ type: "zone", what: "cierge", x: at.x, y: at.y, woke: lit });
    const z = this.current.zone;
    if (lit >= 3 && z?.kind === "sacristie" && !z.open) this.openZoneDoor();
    this.refreshLight();
  }

  /** Sœur Osseuse : trois grilles dans le sol, une seule chante (et scintille si le jet a réussi). */
  private placeGrates(g: GluckSpot, hinted: boolean): boolean {
    const cells: Point[] = [];
    const roomOf = (p: Point) => this.rooms.find((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
    for (let attempt = 0; attempt < 16 && cells.length < 3; attempt++) {
      const at = this.questSpot();
      if (at && !cells.some((c) => roomOf(c) === roomOf(at))) cells.push(at);
    }
    if (cells.length < 3) return false;
    const right = this.rng.int(0, 2);
    this.current.grates = { cells, right, hinted };
    cells.forEach((c, i) => {
      this.current.furniture.push({ x: c.x, y: c.y, kind: hinted && i === right ? "grateGlint" : "grate" });
      this.revealRoomAt(c);
    });
    void g;
    return true;
  }

  /** L'épouvantail de la ferme sur cette case (la quête du chapeau de Grum en cours). */
  scarecrowAt(x: number, y: number): boolean {
    const q = this.quest;
    return q?.id === "grum_chapeau" && q.depth === this.depth && q.got < q.need && this.current.furniture.some((f) => f.x === x && f.y === y && f.kind === "scarecrow");
  }

  /** Coiffer l'épouvantail : un casque du sac (n'importe lequel). */
  private hatScarecrow(): void {
    const f = this.current.furniture.find((o) => o.kind === "scarecrow");
    const hat = this.inventory.items.find((i) => (ITEMS[i.defId] as ItemDef).kind === "hat");
    if (!f) return;
    if (!hat) {
      this.events.push({ type: "zone", what: "nohat", x: f.x, y: f.y });
      return;
    }
    this.inventory.take(hat.defId, 1);
    f.kind = "scarecrowHat";
    this.map.touch(f.x, f.y);
    if (this.quest?.id === "grum_chapeau") this.quest.got = this.quest.need;
    this.events.push({ type: "zone", what: "hat", x: f.x, y: f.y });
  }

  /**
   * Chaque tour, les missions des quêtes v3 qui se jouent sur place : entrer dans le cellier (la piste de pommes),
   * voler le sac de Gluck sans le réveiller, écouter sur la grille, la poule qui se sauve.
   */
  private questTick(): void {
    const q = this.quest;
    const z = this.current.zone;
    const inZone = !!z && this.hero.x >= z.room.x && this.hero.x < z.room.x + z.room.w && this.hero.y >= z.room.y && this.hero.y < z.room.y + z.room.h;
    if (q && q.depth === this.depth) {
      if (q.id === "gluck_piste" && inZone) q.got = q.need;
      if (q.id === "morillon_arrosage") this.waterRows();
      // Vernis : immobile sur le socle vide, trois tours d'affilée (on descend : on recommence).
      if (q.id === "vernis_socle" && q.got < q.need) q.got = this.onSocle() ? q.got + 1 : 0;
      if (q.id === "gluck_vol") {
        const g = this.current.gluck;
        if (this.inventory.count("sac_pommes") > 0) {
          // Le sac est pris : 4 pommes, et il dort toujours.
          this.inventory.take("sac_pommes", 1);
          this.giveApples(4);
          this.quest = null;
          this.events.push({ type: "quest", what: "complete", id: q.id });
          this.gainXp(RULES.questXp);
          if (g) {
            g.gone = true;
            this.gluckMemory.met++;
          }
        } else if (g && !g.gone && g.asleep && Math.max(Math.abs(g.x - this.hero.x), Math.abs(g.y - this.hero.y)) <= 2 && (this.hero.fromX !== this.hero.x || this.hero.fromY !== this.hero.y)) {
          // Chaque pas près de lui : d20 + discrétion contre 8 (C) ; raté, « AU VOLEUR ! ».
          const d20 = this.rng.int(1, 20);
          if (d20 === 1 || (d20 !== 20 && d20 + this.stealthBonus() + (this.hidden ? 5 : 0) < 8)) {
            g.asleep = false;
            this.gluckMemory.mood = -1;
            this.raiseAlarm(GLUCK.stealAlarm, g);
            if (z) for (const m of this.monsters) if (z.sleepers.includes(m.id)) {
              m.asleep = false;
              m.deaf = false;
              m.alerted = true;
            }
            this.events.push({ type: "zone", what: "thief", x: g.x, y: g.y });
            this.npcLeaves("gluck", g, GLUCK.maxEncounters);
            this.quest = null;
            this.events.push({ type: "quest", what: "lost", id: q.id });
          }
        }
      }
      // Rencontres 2 à 4.
      if (q.id === "gluck_local" && q.target !== undefined) {
        const r = this.rooms[q.target];
        const left = r ? this.monsters.filter((m) => !m.boss && m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h).length : 0;
        q.got = Math.max(q.got, q.need - left);
      }
      if (q.id === "gluck_banc" && q.got < q.need) {
        const nearPew = this.current.furniture.some((f) => f.kind.startsWith("pew") && furnitureCells(f).some((c) => Math.max(Math.abs(c.x - this.hero.x), Math.abs(c.y - this.hero.y)) <= 1));
        if (nearPew && this.visibleMonsters().length === 0 && this.hero.fromX === this.hero.x && this.hero.fromY === this.hero.y) q.got++;
      }
      if ((q.id === "krik_temoin" || q.id === "krik_denonce") && q.got < q.need) {
        const k = this.current.krik;
        const near = k && !k.gone && this.monsters.some((m) => isKobold(m) && !m.boss && Math.max(Math.abs(m.x - k.x), Math.abs(m.y - k.y)) <= 1);
        if (near && (q.id === "krik_temoin" || this.hidden)) q.got = q.need;
      }
      if (q.id === "krik_coursier" && this.current.courier) {
        const c = this.current.courier;
        c.fromX = c.x;
        c.fromY = c.y;
        const threat = this.monsters.some((m) => !m.boss && Math.max(Math.abs(m.x - c.x), Math.abs(m.y - c.y)) <= 1 && !m.asleep);
        if (threat) {
          // Un monstre l'attrape : la mise est perdue.
          this.current.courier = undefined;
          this.events.push({ type: "zone", what: "courierLost", x: c.x, y: c.y });
          this.events.push({ type: "quest", what: "lost", id: q.id });
          this.quest = null;
        } else if (Math.max(Math.abs(c.x - this.hero.x), Math.abs(c.y - this.hero.y)) <= 3 && !this.monsters.some((m) => !m.boss && !m.asleep && Math.max(Math.abs(m.x - c.x), Math.abs(m.y - c.y)) <= 3)) {
          // Il n'avance qu'avec le héros à côté, et quand rien ne bouge près de lui.
          const path = findPath(this.map, c, this.current.stairs);
          const next = path?.[0];
          if (next && !(next.x === this.hero.x && next.y === this.hero.y) && !this.actorAt(next.x, next.y)) {
            c.x = next.x;
            c.y = next.y;
          }
          if (c.x === this.current.stairs.x && c.y === this.current.stairs.y) {
            this.current.courier = undefined;
            q.got = q.need;
            this.events.push({ type: "zone", what: "courier", x: c.x, y: c.y });
          }
        }
      }
      if (q.id === "soeur_grille" && this.current.grates) {
        const gr = this.current.grates;
        const right = gr.cells[gr.right];
        if (this.hero.x === right.x && this.hero.y === right.y && q.got < q.need) {
          q.got++;
          if (q.got >= q.need) this.events.push({ type: "zone", what: "bell", x: right.x, y: right.y });
        }
      }
    }
    // La poule aux œufs d'or : elle se sauve quand on approche à découvert (à 3 cases), d'une case à la fois.
    const hen = this.current.goldHen;
    if (hen) {
      hen.fromX = hen.x;
      hen.fromY = hen.y;
      const d = Math.max(Math.abs(hen.x - this.hero.x), Math.abs(hen.y - this.hero.y));
      if (d <= 3 && d > 0 && !this.hidden && this.isVisible(hen.x, hen.y)) {
        let best: Point | null = null;
        let far = d;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const x = hen.x + dx;
            const y = hen.y + dy;
            if ((!dx && !dy) || this.map.get(x, y) !== Tile.Floor || this.actorAt(x, y) || this.npcAt(x, y) || this.isTrap(x, y)) continue;
            const nd = Math.max(Math.abs(x - this.hero.x), Math.abs(y - this.hero.y));
            if (nd > far) {
              far = nd;
              best = { x, y };
            }
          }
        if (best) {
          hen.x = best.x;
          hen.y = best.y;
          if (d <= 2) this.events.push({ type: "zone", what: "henFlees", x: hen.x, y: hen.y });
        }
      }
    }
  }

  /** La poule aux œufs d'or (échappée), s'il y en a une sur l'étage. */
  goldHen(): Readonly<NonNullable<FloorState["goldHen"]>> | null {
    return this.current.goldHen ?? null;
  }

  /** Les grilles de Sœur Osseuse (cases, la bonne, indiquée ou non). */
  grates(): Readonly<NonNullable<FloorState["grates"]>> | null {
    return this.current.grates ?? null;
  }

  /** Le coursier de Krik (rencontre 3), s'il est sur l'étage. */
  courier(): Readonly<NonNullable<FloorState["courier"]>> | null {
    return this.current.courier ?? null;
  }

  // ---------- Quête 04 : Fifrelin, le Kobold aux gobelets (Thomas, 2026-11-14) ----------

  fifrelin(): GluckSpot | null {
    return this.npc("fifrelin");
  }

  fifrelinScene(): { lines: string[]; choices: GluckChoice[] } {
    const g = this.fifrelin();
    if (!g) return { lines: [], choices: [] };
    g.opened = true;
    if (g.bout) {
      return {
        lines: g.bout.over ? ["« C'est tout pour ce soir ! Revenez à l'étage d'en dessous, il y aura du sang neuf. »"] : ["« Le combat est en cours ! Regardez, regardez ! »"],
        choices: [{ id: "leave", label: "Partir" }],
      };
    }
    return {
      lines: FIFRELIN_OPENING,
      choices: [
        { id: "champ", label: `Parier sur Grosse-Dent (${FIFRELIN.champStake} or, rapporte ${FIFRELIN.champPayout})`, off: this.gold < FIFRELIN.champStake ? "Pas assez d'or" : undefined },
        { id: "small", label: `Parier sur Fil-de-Fer (${FIFRELIN.smallStake} or, rapporte ${FIFRELIN.smallPayout})`, off: this.gold < FIFRELIN.smallStake ? "Pas assez d'or" : undefined },
        { id: "rig", label: "Glisser une fiole à Fil-de-Fer, et parier sur lui", stat: "agilite", dc: "medium", off: this.gold < FIFRELIN.smallStake ? "Pas assez d'or" : undefined },
        { id: "duel", label: `Affronter Grosse-Dent vous-même (la caisse : ${FIFRELIN.duelPrize} or)` },
        { id: "leave", label: "Partir" },
      ],
    };
  }

  fifrelinChoose(id: string): GluckResult {
    const g = this.fifrelin();
    if (!g || !this.canTalk("fifrelin")) return { lines: [], done: true };
    const choice = this.fifrelinScene().choices.find((c) => c.id === id);
    if (!choice || choice.off) return { lines: [], done: false };
    let roll: GluckResult["roll"];
    switch (id) {
      case "leave":
        return { lines: ["« Revenez quand vous voulez perdre ! »"], done: true };
      case "champ":
        this.gold -= FIFRELIN.champStake;
        this.startBout(g, "champ", FIFRELIN.champPayout);
        return { lines: ["« Sur le champion ! Prudent, prudent… Les paris sont clos ! »", "GONG !"], done: true };
      case "small":
        this.gold -= FIFRELIN.smallStake;
        this.startBout(g, "small", FIFRELIN.smallPayout);
        return { lines: ["« Sur le PETIT ? Ha ! J'aime les gens qui aiment perdre. Les paris sont clos ! »", "GONG !"], done: true };
      case "rig": {
        this.gold -= FIFRELIN.smallStake;
        const ok = (roll = this.dialogueRoll("agilite", GLUCK.dc.medium)).success;
        if (ok) {
          this.startBout(g, "small", FIFRELIN.smallPayout, true);
          return { lines: ["Vous glissez une fiole dans la patte de Fil-de-Fer. Il la boit d'un trait, et ses yeux s'allument.", "En face, Grosse-Dent a l'air… fatigué, tout à coup. GONG !"], roll, done: true };
        }
        this.startBout(g, null, 0);
        this.raiseAlarm(5, g);
        return { lines: ["« TRICHEUR ! » Fifrelin vous a vu. Il garde la mise.", "« Les gars ! Occupez-vous de lui ! » Les deux combattants se tournent vers vous."], roll, done: true };
      }
      case "duel":
        this.startBout(g, "duel", FIFRELIN.duelPrize);
        return { lines: ["« UN CHALLENGER ! » La foule (deux Kobolds et une araignée au plafond) retient son souffle.", "Grosse-Dent fait craquer ses jointures. GONG !"], done: true };
    }
    return { lines: [], done: false };
  }

  /**
   * Le combat du tripot (Thomas, 2026-11-14) : GROSSE-DENT (le champion, un Kobold costaud) et FIL-DE-FER (le petit,
   * un frondeur à la dague) entrent à côté de Fifrelin et se battent entre eux pour de vrai (une querelle) ; ils ne
   * s'occupent pas du héros, sauf s'il les frappe. `bet` null : le tricheur pris, ils l'attaquent. « duel » : le
   * champion seul, contre le héros.
   */
  private startBout(g: GluckSpot, bet: "champ" | "small" | "duel" | null, payout: number, rigged = false): void {
    g.bout = { bet, payout, over: bet === null, rigged };
    const spots: Point[] = [];
    // Dans la petite arène : un de chaque côté.
    if (g.ring && bet !== "duel") {
      for (const p of [{ x: g.ring.x, y: g.ring.y + 1 }, { x: g.ring.x + 2, y: g.ring.y + 1 }]) if (!this.actorAt(p.x, p.y)) spots.push(p);
    } else if (g.ring) {
      const p = { x: g.ring.x + 1, y: g.ring.y };
      if (!this.actorAt(p.x, p.y)) spots.push(p);
    }
    for (let r = 2; r <= 4 && spots.length < 2; r++)
      for (let dy = -r; dy <= r && spots.length < 2; dy++)
        for (let dx = -r; dx <= r && spots.length < 2; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const p = { x: g.x + dx, y: g.y + dy };
          if (!this.npcFree(this.current, p.x, p.y) || this.actorAt(p.x, p.y) || spots.some((q) => Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y)) < 2)) continue;
          if (findPath(this.map, g, p) === null) continue;
          spots.push(p);
        }
    if (spots.length === 0) spots.push({ x: g.x, y: g.y + 1 });
    const champ = this.newMonster(MONSTERS.schrat, spots[0].x, spots[0].y, false);
    champ.maxHp = champ.hp = rigged ? FIFRELIN.riggedChampHp : FIFRELIN.champHp;
    champ.arena = bet === "duel" ? "duel" : "champ";
    champ.fromX = champ.x;
    champ.fromY = champ.y;
    this.monsters.push(champ);
    if (bet === "duel" || bet === null) {
      champ.alerted = true;
      if (bet === null && spots[1]) {
        const small = this.newMonster(MONSTERS.frondeur, spots[1].x, spots[1].y, false);
        small.alerted = true;
        this.monsters.push(small);
      }
      if (bet === null) champ.arena = undefined;
      return;
    }
    const at = spots[1] ?? { x: spots[0].x + 2, y: spots[0].y };
    const small = this.newMonster(MONSTERS.frondeur, at.x, at.y, false);
    small.maxHp = small.hp = FIFRELIN.smallHp;
    small.arena = "small";
    small.fromX = small.x;
    small.fromY = small.y;
    this.monsters.push(small);
    champ.alerted = small.alerted = false;
    this.startFeud(champ, small, "bout");
  }

  /**
   * La petite arène de Fifrelin (Thomas, 2026-11-14 : « mets les combattants dans une petite arène ») : une clôture de
   * bois autour de 3 × 3 cases, au milieu de sa salle, une ouverture en bas ; Fifrelin se tient à côté de l'ouverture.
   * Rien n'est coupé : on vérifie que tout le reste de l'étage reste atteignable. Sans place, pas d'arène.
   */
  private placeArena(state: FloorState, g: GluckSpot): void {
    const room = state.rooms.find((r) => g.x >= r.x && g.x < r.x + r.w && g.y >= r.y && g.y < r.y + r.h);
    if (!room || room.w < 7 || room.h < 7) return;
    const map = state.map;
    const taken = (x: number, y: number) =>
      map.get(x, y) !== Tile.Floor ||
      (x === state.start.x && y === state.start.y) ||
      (x === state.stairs.x && y === state.stairs.y) ||
      state.furniture.some((f) => furnitureCells(f).some((c) => c.x === x && c.y === y)) ||
      state.traps.some((t) => t.x === x && t.y === y) ||
      state.ground.some((o) => o.x === x && o.y === y) ||
      state.monsters.some((m) => m.x === x && m.y === y) ||
      ([state.gluck, state.soeur, state.krik, state.grum, state.morillon, state.vernis, state.maestro, state.plumeau, state.clavicule, state.osselet, state.merchant].some((p) => p && p.x === x && p.y === y));
    const before = reachable(map, state.start);
    const spots: Point[] = [];
    for (let ry = room.y + 1; ry + 5 <= room.y + room.h - 1; ry++) for (let rx = room.x + 1; rx + 4 <= room.x + room.w - 2; rx++) spots.push({ x: rx, y: ry });
    // Au plus près du centre de la salle.
    const cx = room.x + room.w / 2 - 2.5;
    const cy = room.y + room.h / 2 - 3;
    spots.sort((a, b) => Math.abs(a.x - cx) + Math.abs(a.y - cy) - (Math.abs(b.x - cx) + Math.abs(b.y - cy)));
    for (const { x: rx, y: ry } of spots) {
      let ok = true;
      for (let y = ry; ok && y <= ry + 5; y++) for (let x = rx; ok && x <= rx + 4; x++) if (taken(x, y) && !(x === g.x && y === g.y)) ok = false;
      if (!ok) continue;
      const fence: Furniture[] = [];
      for (let x = rx; x <= rx + 4; x++) {
        fence.push({ x, y: ry, kind: x === rx || x === rx + 4 ? "fencePost" : "fenceH" });
        if (x !== rx + 2) fence.push({ x, y: ry + 4, kind: x === rx ? "fenceCornerL" : x === rx + 4 ? "fenceCornerR" : "fenceH" });
      }
      for (let y = ry + 1; y <= ry + 3; y++) fence.push({ x: rx, y, kind: "fenceV" }, { x: rx + 4, y, kind: "fenceV" });
      for (const f of fence) map.set(f.x, f.y, Tile.Furniture);
      if (reachable(map, state.start) !== before - fence.length) {
        for (const f of fence) map.set(f.x, f.y, Tile.Floor);
        continue;
      }
      state.furniture.push(...fence);
      g.ring = { x: rx + 1, y: ry + 1, w: 3, h: 3 };
      // Fifrelin, à côté de l'ouverture (dehors).
      g.x = rx + 3;
      g.y = ry + 5;
      return;
    }
  }

  /** Après chaque tour : le combat est-il fini ? On paie (ou non), et le vainqueur salue et s'en va. */
  private boutTick(): void {
    const g = this.current.fifrelin;
    const bout = g?.bout;
    if (!g || !bout || bout.over) return;
    const fighters = this.monsters.filter((m) => m.arena && m.hp > 0);
    if (bout.bet === "duel") {
      if (fighters.some((m) => m.arena === "duel")) return;
      bout.over = true;
      this.gold += bout.payout;
      this.events.push({ type: "bout", what: "duelWin", x: g.x, y: g.y, gold: bout.payout });
      return;
    }
    if (fighters.length > 1) return;
    bout.over = true;
    const winner = fighters[0];
    const side = winner?.arena === "small" ? "small" : "champ";
    if (winner) this.monsters.splice(this.monsters.indexOf(winner), 1);
    const at = winner ?? g;
    if (bout.bet === side) {
      this.gold += bout.payout;
      this.events.push({ type: "bout", what: "win", x: at.x, y: at.y, gold: bout.payout, winner: side, rigged: bout.rigged });
    } else this.events.push({ type: "bout", what: "lose", x: at.x, y: at.y, winner: side });
  }


  // ---------- Quête 05 : Grum, le Kobold fermier (quêtes v3) ----------

  grumScene(): { lines: string[]; choices: GluckChoice[] } {
    const g = this.grum();
    if (!g) return { lines: [], choices: [] };
    g.opened = true;
    const hasScarecrow = this.current.furniture.some((f) => f.kind === "scarecrow");
    return {
      lines: GRUM_OPENING,
      choices: [
        { id: "hen", label: "« Ma poule aux œufs d'or s'est sauvée »", stat: "charisme", dc: "easy" },
        { id: "hay", label: "« Des voleurs de foin dans ma grange »", stat: "force", dc: "medium" },
        ...(hasScarecrow ? [{ id: "hat", label: "« Mon épouvantail a perdu son chapeau »" }] : []),
        { id: "leave", label: "Partir" },
      ],
    };
  }

  grumChoose(id: string): GluckResult {
    const g = this.grum();
    if (!g || !this.canTalk("grum")) return { lines: [], done: true };
    const choice = this.grumScene().choices.find((c) => c.id === id);
    if (!choice || choice.off) return { lines: [], done: false };
    let roll: GluckResult["roll"];
    const test = (): boolean => (roll = this.dialogueRoll(choice.stat!, GLUCK.dc[choice.dc!])).success;
    const end = (lines: string[]): GluckResult => {
      this.npcLeaves("grum", g, GRUM.maxEncounters);
      return { lines, roll, done: true };
    };
    switch (id) {
      case "leave":
        return { lines: ["« Fais attention à mon pré en partant. »"], done: true };
      case "hen": {
        const ok = test();
        if (!this.quest && this.giveTask("grum_poule")) {
          return {
            lines: ok
              ? ["« Cocotte. Elle pond de l'or. Elle a peur de tout, même de son ombre. »", "« Approche-la sans te montrer, sinon elle file. Ramène-la-moi. »", "(Sa salle apparaît sur la carte.)"]
              : ["« Tu ferais peur à une poule, toi. … Bon. Essaie quand même. Caché, hein. »", "(Sa salle apparaît sur la carte.)"],
            roll,
            done: true,
          };
        }
        return end(["« Bah. Elle reviendra toute seule. Peut-être. »"]);
      }
      case "hay": {
        const ok = test();
        if (!this.quest && this.openZone("grange", g) && this.giveTask("grum_foin")) {
          if (!ok) this.zoneBreakOut(0);
          return {
            lines: ok
              ? ["« Deux voleurs de foin. Dans ma grange, derrière la grosse botte. Pousse-la, et chasse-les. »", "(La botte de foin apparaît sur la carte.)"]
              : ["« Deux voleurs de foin ! … Ils t'ont entendu. Les voilà ! »", "(Ils sortent de la grange.)"],
            roll,
            done: true,
          };
        }
        return end(["« Pas de grange sur cet étage ? Alors c'était un rêve. Encore. »"]);
      }
      case "hat":
        if (!this.quest && this.giveTask("grum_chapeau")) {
          return { lines: ["« Mon épouvantail a froid à la tête. Un casque. N'importe lequel. Pose-le-lui. »", "(Touchez l'épouvantail avec un casque dans le sac.)"], done: true };
        }
        return end(["« Une autre fois. »"]);
      default:
        return { lines: [], done: false };
    }
  }

  // ---------- Section 2 : Morillon, le Kobold cueilleur (Thomas, 2026-11-14) ----------

  morillonScene(): { lines: string[]; choices: GluckChoice[] } {
    const g = this.morillon();
    if (!g) return { lines: [], choices: [] };
    g.opened = true;
    return {
      lines: MORILLON_OPENING,
      choices: [
        { id: "water", label: "« Prête-moi ton arrosoir »", stat: "charisme", dc: "easy" },
        { id: "leave", label: "Partir" },
      ],
    };
  }

  morillonChoose(id: string): GluckResult {
    const g = this.morillon();
    if (!g || !this.canTalk("morillon")) return { lines: [], done: true };
    const choice = this.morillonScene().choices.find((c) => c.id === id);
    if (!choice || choice.off) return { lines: [], done: false };
    switch (id) {
      case "leave":
        return { lines: ["« Pas sur les rangs, en sortant. »"], done: true };
      case "water": {
        const roll = this.dialogueRoll(choice.stat!, GLUCK.dc[choice.dc!]);
        if (!this.quest && this.giveTask("morillon_arrosage")) {
          // Bien parlé : il ajoute une poignée d'or à la récompense.
          this.quest!.charmed = roll.success;
          return {
            lines: roll.success
              ? ["« Tu as de bonnes manières, toi. Tiens, mon arrosoir. »", "« Longe chaque rang : l'eau coule toute seule. Je te paierai bien. »", "(Marchez le long des rangs : chaque case voisine est arrosée.)"]
              : ["« Hm. Tu as des mains de Kobold de guerre. … Bon. Prends-le. Doucement. »", "(Marchez le long des rangs : chaque case voisine est arrosée.)"],
            roll,
            done: true,
          };
        }
        this.npcLeaves("morillon", g, MORILLON.maxEncounters);
        return { lines: ["« Ils ont bu ce matin. Reviens une autre fois. »"], roll, done: true };
      }
      default:
        return { lines: [], done: false };
    }
  }

  // ---------- Section 2 (2026-11-18) : Vernis, le Maestro ; section 1 : Plumeau ----------

  vernisScene(): { lines: string[]; choices: GluckChoice[] } {
    const g = this.npc("vernis");
    if (!g) return { lines: [], choices: [] };
    g.opened = true;
    const busy = this.quest ? "Une autre tâche en cours" : undefined;
    return {
      lines: VERNIS.opening,
      choices: [
        { id: "poulet", label: "« Je vais le retrouver, votre poulet »", off: busy },
        { id: "socle", label: "« Et si je posais sur le socle ? »", stat: "charisme", dc: "easy", off: busy },
        { id: "leave", label: "Partir" },
      ],
    };
  }

  vernisChoose(id: string): GluckResult {
    const g = this.npc("vernis");
    if (!g || !this.canTalk("vernis")) return { lines: [], done: true };
    const choice = this.vernisScene().choices.find((c) => c.id === id);
    if (!choice || choice.off) return { lines: [], done: false };
    if (id === "leave") return { lines: ["« Les mains dans les poches, en sortant. »"], done: true };
    if (id === "poulet" && this.giveTask("vernis_poulet")) {
      return { lines: ["« Vraiment ? Le voleur ne l'a pas emporté bien loin : il est trop lourd. »", "(La salle où il se trouve brille sur la carte.)"], done: true };
    }
    if (id === "socle") {
      const roll = this.dialogueRoll(choice.stat!, GLUCK.dc[choice.dc!]);
      if (roll.success && this.giveTask("vernis_socle")) {
        return { lines: ["« Vous ? En statue ? … Le public n'y verra que du feu. Montez. Trois tours. Immobile. »"], roll, done: true };
      }
      return { lines: ["« Avec cette tête-là ? Le public fuirait. »"], roll, done: false };
    }
    return { lines: [], done: false };
  }

  maestroScene(): { lines: string[]; choices: GluckChoice[] } {
    const g = this.npc("maestro");
    if (!g) return { lines: [], choices: [] };
    g.opened = true;
    return {
      lines: MAESTRO.opening,
      choices: [
        { id: "partition", label: "« Je vais vous la retrouver »", off: this.quest ? "Une autre tâche en cours" : undefined },
        { id: "leave", label: "Partir" },
      ],
    };
  }

  maestroChoose(id: string): GluckResult {
    const g = this.npc("maestro");
    if (!g || !this.canTalk("maestro")) return { lines: [], done: true };
    const choice = this.maestroScene().choices.find((c) => c.id === id);
    if (!choice || choice.off) return { lines: [], done: false };
    if (id === "leave") return { lines: ["« Revenez au deuxième acte. »"], done: true };
    if (id === "partition" && this.giveTask("maestro_partition")) {
      return { lines: ["« Bravo ! Elle doit traîner dans une salle de l'étage. Les champignons adorent la musique. »", "(La salle où elle se trouve brille sur la carte.)"], done: true };
    }
    return { lines: [], done: false };
  }

  // ---------- Section 3 (2026-11-19) : Maître Osselet, le conservateur du musée ----------

  osseletScene(): { lines: string[]; choices: GluckChoice[] } {
    const g = this.npc("osselet");
    if (!g) return { lines: [], choices: [] };
    if (this.quest && QUEST_TASKS[this.quest.id].npc === "osselet") return this.questScene("osselet");
    g.opened = true;
    const home = this.npcInTheme(g, "musee");
    return {
      lines: home ? OSSELET.opening : OSSELET.away,
      choices: [
        { id: "corne", label: "« Je vous retrouve votre corne »", off: this.quest ? "Une autre tâche en cours" : undefined },
        { id: "ecriteau", label: "Lire l'écriteau", stat: "intelligence", dc: "easy", off: !home ? "L'écriteau est au musée" : g.drumDone ? "Déjà lu" : undefined },
        // Un jet d'Agilité (Thomas, 2026-11-20 : « des tests de compétences dans les quêtes ») : passer sous le cordon.
        { id: "toucher", label: "Toucher le tricératops sans qu'il le voie", stat: "agilite", dc: "hard", off: !home ? "Le tricératops est au musée" : g.haggled ? "Déjà tenté" : undefined },
        { id: "leave", label: home ? "Visiter en silence" : "Le laisser à sa ronde" },
      ],
    };
  }

  osseletChoose(id: string): GluckResult {
    const g = this.npc("osselet");
    if (!g || !this.canTalk("osselet")) return { lines: [], done: true };
    if (this.quest && QUEST_TASKS[this.quest.id].npc === "osselet") return this.questChoose("osselet", id);
    const choice = this.osseletScene().choices.find((c) => c.id === id);
    if (!choice || choice.off) return { lines: [], done: false };
    switch (id) {
      case "leave":
        return { lines: [this.npcInTheme(g, "musee") ? "« Le musée ferme à l'aube. Il n'y a jamais d'aube, ici. »" : "« Passez au musée, à l'occasion. L'entrée est gratuite. La sortie aussi, en principe. »"], done: true };
      case "toucher": {
        const roll = this.dialogueRoll(choice.stat!, GLUCK.dc[choice.dc!]);
        g.haggled = true;
        if (!roll.success) {
          this.raiseAlarm(5, g);
          return { lines: ["(Le cordon tinte. Le monocle se tourne vers vous.)", "« AH ! On NE TOUCHE PAS ! Cent cinquante millions d'années, et vous mettez vos doigts ! »"], roll, done: false };
        }
        this.events.push({ type: "feat", npc: "osselet", id: "osselet_toucher" });
        g.gold = (g.gold ?? 0) + 25;
        return { lines: ["(Vous effleurez la collerette. Elle est froide et rugueuse. Personne n'a rien vu.)", "« … Vous avez touché, n'est-ce pas ? Je le sens. Tenez, et ne le dites à personne. » (Il laisse tomber quelques pièces.)"], roll, done: false };
      }
      case "corne":
        if (this.giveTask("osselet_corne")) return { lines: ["« Le culte l'a cachée dans une salle de l'étage. Elle brille sur votre carte, maintenant. Ne me demandez pas comment. »"], done: true };
        return { lines: [], done: false };
      case "ecriteau": {
        const roll = this.dialogueRoll(choice.stat!, GLUCK.dc[choice.dc!]);
        g.drumDone = true;
        if (!roll.success) return { lines: ["(L'écriteau est en vieux latin d'os. Vous reconnaissez le mot « tricératops ».)"], roll, done: false };
        this.revealFloorPlan();
        this.events.push({ type: "feat", npc: "osselet", id: "osselet_ecriteau" });
        return { lines: ["(« Plan du musée et de ses galeries ». Vous le mémorisez.)", "« Un visiteur qui lit ! Je vais pleurer. Je n'ai plus de larmes, mais l'intention y est. »"], roll, done: false };
      }
      default:
        return { lines: [], done: false };
    }
  }

  // ---------- Section 3 (2026-11-19) : Sœur Clavicule, dans la chapelle des os ----------

  /** Le PNJ se tient-il dans sa salle (musée, chapelle) ? Sinon il parle autrement (Thomas, 2026-11-20). */
  private npcInTheme(g: GluckSpot, theme: string): boolean {
    const t = (this.current.themes ?? []).find((o) => o.id === theme);
    const r = t ? this.rooms[t.room] : undefined;
    return !!r && g.x >= r.x && g.y >= r.y && g.x < r.x + r.w && g.y < r.y + r.h;
  }

  claviculeScene(): { lines: string[]; choices: GluckChoice[] } {
    const g = this.npc("clavicule");
    if (!g) return { lines: [], choices: [] };
    if (this.quest && QUEST_TASKS[this.quest.id].npc === "clavicule") return this.questScene("clavicule");
    g.opened = true;
    const busy = this.quest ? "Une autre tâche en cours" : undefined;
    const sister = this.soeurMemory.met > 0;
    const home = this.npcInTheme(g, "chapelle");
    return {
      lines: home ? CLAVICULE.opening : CLAVICULE.away,
      choices: [
        { id: "cranes", label: "« Je leur brise le crâne »", off: busy ?? (this.monsters.some(isSkeleton) ? undefined : "Aucun squelette sur l'étage") },
        { id: "cierges", label: "« Vos cierges ? »", off: busy },
        { id: "soeur", label: "« J'ai rencontré votre sœur »", off: !sister ? "Vous ne connaissez pas sa sœur" : this.inventory.count("chapelet_argent") > 0 || g.drumDone ? "Déjà donné" : undefined },
        // Un jet de Charisme (Thomas, 2026-11-20) : sa bénédiction, une seule demande.
        { id: "benir", label: "« Bénissez-moi, ma sœur »", stat: "charisme", dc: "medium", off: g.haggled ? "Déjà demandé" : undefined },
        { id: "leave", label: home ? "La laisser prier" : "La laisser chercher" },
      ],
    };
  }

  claviculeChoose(id: string): GluckResult {
    const g = this.npc("clavicule");
    if (!g || !this.canTalk("clavicule")) return { lines: [], done: true };
    if (this.quest && QUEST_TASKS[this.quest.id].npc === "clavicule") return this.questChoose("clavicule", id);
    const choice = this.claviculeScene().choices.find((c) => c.id === id);
    if (!choice || choice.off) return { lines: [], done: false };
    switch (id) {
      case "leave":
        return { lines: ["« Que la vraie lumière vous garde. Pas celle-là. »"], done: true };
      case "cranes":
        if (this.giveTask("clavicule_cranes")) return { lines: ["« Une masse, un coup parfait, ou le feu. Dans l'ombre, de préférence. »", "(Brisez le crâne de squelettes de l'étage.)"], done: true };
        return { lines: [], done: false };
      case "cierges":
        if (this.placeCierges(g) && this.giveTask("clavicule_cierges")) return { lines: ["« Le culte a soufflé mes trois cierges d'argent et les a dispersés. Une torche suffit. »", "(Les salles où ils sont brillent sur la carte.)"], done: true };
        return { lines: ["« Plus tard, peut-être. »"], done: false };
      case "benir": {
        const roll = this.dialogueRoll(choice.stat!, GLUCK.dc[choice.dc!]);
        g.haggled = true;
        if (!roll.success) return { lines: ["« Bénir un pillard de tombes ? Revenez quand vous aurez les mains propres. »"], roll, done: false };
        this.blessTurns = Math.max(this.blessTurns, RULES.claviculeBlessTurns);
        this.refreshStats();
        this.events.push({ type: "feat", npc: "clavicule", id: "clavicule_benir" });
        return { lines: ["(Elle trace une croix d'argent sur votre front. Une chaleur douce.)", "« Que la vraie lumière guide votre main. » (Béni : +1 à l'attaque et à la classe d'armure.)"], roll, done: false };
      }
      case "soeur":
        this.events.push({ type: "feat", npc: "clavicule", id: "clavicule_soeur" });
        g.drumDone = true;
        (g.items ??= []).push({ item: "chapelet_argent", count: 1 });
        return { lines: ["« Osseuse ? Elle est vivante ? Enfin… vous voyez ce que je veux dire. »", "« Prenez mon chapelet. Les morts n'aiment pas l'argent. » (Elle le pose à vos pieds.)"], done: false };
      default:
        return { lines: [], done: false };
    }
  }

  plumeauScene(): { lines: string[]; choices: GluckChoice[] } {
    const g = this.npc("plumeau");
    if (!g) return { lines: [], choices: [] };
    g.opened = true;
    return {
      lines: PLUMEAU.opening,
      choices: [
        { id: "clef", label: "« Je trouve la clef »", off: this.quest ? "Une autre tâche en cours" : undefined },
        { id: "chaine", label: "Briser la chaîne", stat: "force", dc: "medium" },
        { id: "registre", label: "Lui lire le registre", stat: "intelligence", dc: "easy", off: g.drumDone ? "Déjà lu" : undefined },
        { id: "leave", label: "Le laisser" },
      ],
    };
  }

  plumeauChoose(id: string): GluckResult {
    const g = this.npc("plumeau");
    if (!g || !this.canTalk("plumeau")) return { lines: [], done: true };
    const choice = this.plumeauScene().choices.find((c) => c.id === id);
    if (!choice || choice.off) return { lines: [], done: false };
    switch (id) {
      case "leave":
        return { lines: ["« Je ne bouge pas. Littéralement. »"], done: true };
      case "clef":
        if (this.giveTask("plumeau_clef")) return { lines: ["« Merci ! Elle est dans une salle de l'étage, je l'ai vue passer. »", "(La salle où elle se trouve brille sur la carte.)"], done: true };
        return { lines: [], done: false };
      case "chaine": {
        const roll = this.dialogueRoll(choice.stat!, GLUCK.dc[choice.dc!]);
        this.raiseAlarm(5, g);
        if (!roll.success) return { lines: ["(CLANG ! La chaîne tient bon. Tout l'étage a entendu.)", "« Essayez la clef, peut-être ? »"], roll, done: false };
        this.events.push({ type: "feat", npc: "plumeau", id: "plumeau_chaine" });
        this.freePlumeau(g);
        return { lines: ["(CLANG ! Le maillon cède.)", "« Libre ! Tenez, le plan de l'étage : je l'ai recopié de mémoire. »"], roll, done: true };
      }
      case "registre": {
        const roll = this.dialogueRoll(choice.stat!, GLUCK.dc[choice.dc!]);
        g.drumDone = true;
        if (!roll.success) return { lines: ["(Vous butez sur l'écriture penchée.)", "« Non, non, ça se lit “Grosse-Dent”, pas “Grosse Dinde”. »"], roll, done: false };
        this.revealStairs();
        this.events.push({ type: "feat", npc: "plumeau", id: "plumeau_registre" });
        return { lines: ["(Vous lisez une page au hasard.)", "« Ah, l'escalier ! Il est là, je l'avais noté. » (L'escalier apparaît sur la carte.)"], roll, done: false };
      }
      default:
        return { lines: [], done: false };
    }
  }

  /** Plumeau libéré : le plan de l'étage (toutes les salles et couloirs), un peu d'or, puis il s'en va. */
  private freePlumeau(g: GluckSpot): void {
    this.revealFloorPlan();
    g.gold = (g.gold ?? 0) + lessGold(PLUMEAU.gold);
    if (this.quest?.id === "plumeau_clef") this.quest = null;
    this.npcLeaves("plumeau", g, 1);
  }

  /** Le plan de l'étage : toutes les cases praticables et les murs qui les bordent deviennent connus (pas les secrets). */
  private revealFloorPlan(): void {
    const m = this.map;
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        if (!m.isWalkable(x, y) && !m.isDoor(x, y)) continue;
        if (this.current.secretRoom && x >= this.current.secretRoom.room.x && x < this.current.secretRoom.room.x + this.current.secretRoom.room.w && y >= this.current.secretRoom.room.y && y < this.current.secretRoom.room.y + this.current.secretRoom.room.h) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (m.inBounds(x + dx, y + dy)) this.explored[m.index(x + dx, y + dy)] = 1;
      }
    }
  }

  /** Un squelette à butin (pas encore fouillé) sur cette case. */
  skeletonAt(x: number, y: number): Furniture | null {
    return this.current.furniture.find((f) => f.kind === "skeleton" && !f.drained && f.y === y && (f.x === x || f.x + 1 === x)) ?? null;
  }

  /** Fouiller le squelette (Thomas, 2026-11-11 : « avec du loot ») : quelques pièces, et une fois sur deux un objet. */
  private lootSkeleton(f: Furniture): void {
    f.drained = true;
    const gold = lessGold(this.rng.int(4, 12) + this.depth);
    const at = this.landingCell(f, "or", f);
    this.dropItem(at.x, at.y, "or", gold);
    let item: ItemId | undefined;
    if (this.rng.chance(0.5)) {
      const l = this.floorLoot();
      item = l.item;
      const at2 = this.landingCell(f, l.item, f);
      this.dropItem(at2.x, at2.y, l.item, l.count);
    }
    this.events.push({ type: "skeleton", x: f.x, y: f.y, gold, item });
  }

  /** Une pomme dorée sous cloche (hall d'exposition), sur cette case. */
  appleDomeAt(x: number, y: number): Furniture | null {
    return this.current.furniture.find((f) => f.kind === "pommeCloche" && f.x === x && f.y === y) ?? null;
  }

  /**
   * Voler une pomme dorée (Thomas, 2026-11-17 : « voler une pomme dorée sans réveiller le gardien ») : d20 + discrétion
   * contre 12, avec le désavantage si Vernis vous voit ; réussi, la pomme est à vous (60 or) ; raté, « Au voleur ! » :
   * +15 d'alerte, deux gardes accourent et Vernis, outré, s'en va.
   */
  private stealApple(f: Furniture): void {
    const v = this.npc("vernis");
    const watched = !!v && Math.max(Math.abs(v.x - this.hero.x), Math.abs(v.y - this.hero.y)) <= 6 && hasLineOfSight(this.map, v, this.hero);
    const a = this.rng.int(1, 20);
    const d20 = watched ? Math.min(a, this.rng.int(1, 20)) : a;
    const bonus = this.stealthBonus();
    const success = d20 !== 1 && (d20 === 20 || d20 + bonus >= VERNIS.stealDc);
    this.events.push({ type: "theft", what: "apple", d20, bonus, total: d20 + bonus, success, watched });
    if (success) {
      f.kind = "clocheVide";
      this.map.touch(f.x, f.y);
      this.events.push({ type: "feat", npc: "vernis", id: "vernis_pomme" });
      const at = this.landingCell(f, "pomme_doree_expo", f);
      this.dropItem(at.x, at.y, "pomme_doree_expo", 1);
      return;
    }
    this.raiseAlarm(VERNIS.stealAlarm, f);
    this.callFoes(f, this.look() === "champi" ? "cueilleur" : "schrat", 2);
    if (v && !v.gone) this.npcLeaves("vernis", v, 1);
  }

  /**
   * NICHE SECRÈTE (Thomas, 2026-11-12 ; planche art/murs_v2.png validée le 2026-11-18) : dans une salle ordinaire, une
   * DALLE À PRESSION à deux cases d'un mur ; derrière ce mur, de la roche pleine. Marcher sur la dalle fait coulisser le pan
   * de mur : une niche d'une case, son butin dedans (+2 d'alerte, grondement).
   */
  private placeNiche(state: FloorState, rng: Rng): { wall: Point; cell: Point; plate: Point; open?: boolean } | null {
    const map = state.map;
    const themed = new Set((state.themes ?? []).map((t) => t.room));
    const solid = (x: number, y: number) => map.inBounds(x, y) && map.get(x, y) === Tile.Wall;
    const candidates: { wall: Point; cell: Point; plate: Point }[] = [];
    state.rooms.forEach((r, index) => {
      if (index === 0 || themed.has(index) || r.w * r.h < 20) return;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const cells: Point[] = [];
        if (dy !== 0) for (let x = r.x + 1; x < r.x + r.w - 1; x++) cells.push({ x, y: dy < 0 ? r.y - 1 : r.y + r.h });
        else for (let y = r.y + 1; y < r.y + r.h - 1; y++) cells.push({ x: dx < 0 ? r.x - 1 : r.x + r.w, y });
        for (const w of cells) {
          const b = { x: w.x + dx, y: w.y + dy };
          const p = { x: w.x - dx * 2, y: w.y - dy * 2 };
          if (!solid(w.x, w.y) || !solid(b.x, b.y)) continue;
          let rock = true;
          for (let oy = -1; oy <= 1 && rock; oy++) for (let ox = -1; ox <= 1; ox++) if (!(b.x + ox === w.x && b.y + oy === w.y) && !solid(b.x + ox, b.y + oy)) rock = false;
          if (!rock || map.get(p.x, p.y) !== Tile.Floor) continue;
          if (state.torches.some((t) => Math.abs(t.x - w.x) + Math.abs(t.y - w.y) <= 1)) continue;
          if ((state.furniture ?? []).some((f) => furnitureCells(f).some((c) => (c.x === w.x && c.y === w.y) || (c.x === p.x && c.y === p.y)))) continue;
          if (state.traps.some((t) => t.x === p.x && t.y === p.y) || state.ground.some((g) => g.x === p.x && g.y === p.y)) continue;
          if ((p.x === state.start.x && p.y === state.start.y) || (p.x === state.stairs.x && p.y === state.stairs.y)) continue;
          candidates.push({ wall: w, cell: b, plate: p });
        }
      }
    });
    if (candidates.length === 0) return null;
    const n = candidates[rng.int(0, candidates.length - 1)];
    (state.furniture ??= []).push({ x: n.plate.x, y: n.plate.y, kind: "pressurePlate" });
    return n;
  }

  /** Le héros marche sur la dalle de la niche secrète : le pan de mur coulisse, le butin est là. */
  private openNiche(): void {
    const n = this.current.niche;
    if (!n || n.open || this.hero.x !== n.plate.x || this.hero.y !== n.plate.y) return;
    n.open = true;
    this.map.set(n.wall.x, n.wall.y, Tile.Floor);
    this.map.set(n.cell.x, n.cell.y, Tile.Floor);
    const f = this.current.furniture.find((o) => o.x === n.plate.x && o.y === n.plate.y && o.kind === "pressurePlate");
    if (f) f.kind = "pressurePlateDown";
    this.dropItem(n.cell.x, n.cell.y, "or", lessGold((this.rng.int(10, 20) + this.depth * 2) * (1 + sectionOf(this.depth))));
    if (this.rng.chance(0.6)) {
      const l = this.floorLoot();
      this.dropItem(n.cell.x, n.cell.y, l.item, l.count);
    }
    this.raiseAlarm(RULES.nicheAlarm, n.wall);
    this.events.push({ type: "niche", x: n.wall.x, y: n.wall.y });
    this.refreshLight();
    this.updateVision();
  }

  /** Le Grand Poulet d'Or, ou le public : sur le socle vide du hall (la quête « poser » de Vernis compte ses tours). */
  private onSocle(): boolean {
    return this.current.furniture.some((f) => f.kind === "expoSocle" && f.x === this.hero.x && f.y === this.hero.y);
  }

  /** Le ticket d'exposition sert-il encore sur cet étage ? (un article gratuit chez le Colporteur) */
  ticketReady(): boolean {
    return this.equipment.artifact?.defId === "ticket_expo" && !this.perks().ticket;
  }

  /** Pinceau et diapason (artefacts portés, une fois par étage) : pourquoi on ne peut pas s'en servir, ou null. */
  artifactRefusal(): "none" | "used" | "combat" | null {
    const id = this.equipment.artifact?.defId;
    if (id !== "pinceau_magique" && id !== "diapason") return "none";
    if (id === "pinceau_magique" ? this.perks().brush : this.perks().fork) return "used";
    return null;
  }

  /** Les cases de couloir où peindre un faux mur : en vue, à 4 cases au plus, libres, pas une porte. */
  paintCells(): Point[] {
    if (this.artifactRefusal() !== null || this.equipment.artifact?.defId !== "pinceau_magique") return [];
    const out: Point[] = [];
    const inRoom = (x: number, y: number) => this.current.rooms.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    for (let y = this.hero.y - 4; y <= this.hero.y + 4; y++) {
      for (let x = this.hero.x - 4; x <= this.hero.x + 4; x++) {
        if (!this.map.inBounds(x, y) || this.map.get(x, y) !== Tile.Floor || inRoom(x, y) || !this.isVisible(x, y)) continue;
        if ((x === this.hero.x && y === this.hero.y) || this.actorAt(x, y) || this.furnitureAt(x, y) || this.isTrap(x, y)) continue;
        if (this.ground.some((g) => g.x === x && g.y === y)) continue;
        out.push({ x, y });
      }
    }
    return out;
  }

  /**
   * Peindre un faux mur (pinceau magique ; Thomas, 2026-11-17 : « une fois par étage, un faux mur sur une case de
   * couloir : les monstres ne passent pas 10 tours et ne voient pas à travers ») : la case devient un mur, puis redevient
   * du sol. Un tour.
   */
  paintWall(x: number, y: number): boolean {
    if (this.over || !this.paintCells().some((c) => c.x === x && c.y === y)) return false;
    this.perks().brush = 1;
    this.map.set(x, y, Tile.Wall);
    (this.current.fakeWalls ??= []).push({ x, y, turns: RULES.fakeWallTurns });
    this.updateVision();
    this.events.push({ type: "artifact", what: "paint", x, y });
    this.wait();
    return true;
  }

  // ---------- Règles de la section 2 (Thomas, 2026-11-18 : « lumière qui a peur du bruit, vesses-de-loup, spores qui
  // explosent au feu ») ----------

  /** LA LUMIÈRE A PEUR DU BRUIT : un bruit dans une salle de la section 2 y referme les champignons lumineux 3 tours. */
  private hushMushrooms(at: Point): void {
    if (this.look() !== "champi") return;
    const room = this.roomIndexAt(at);
    if (room < 0) return;
    const hush = (this.current.hush ??= []);
    const old = hush.find((h) => h.room === room);
    const until = this.turn + RULES.mushHushTurns;
    if (old) {
      old.until = Math.max(old.until, until);
      return;
    }
    hush.push({ room, until });
    this.events.push({ type: "mushHush", x: at.x, y: at.y, dark: true });
    this.refreshLight();
  }

  /** Les champignons de cette case sont-ils refermés ? */
  mushHushed(x: number, y: number): boolean {
    const hush = this.current?.hush;
    if (!hush || hush.length === 0) return false;
    const room = this.roomIndexAt({ x, y });
    return room >= 0 && hush.some((h) => h.room === room && h.until > this.turn);
  }

  private hushTick(): void {
    const hush = this.current.hush;
    if (!hush || hush.length === 0) return;
    const over = hush.filter((h) => h.until <= this.turn);
    if (over.length === 0) return;
    this.current.hush = hush.filter((h) => h.until > this.turn);
    for (const h of over) {
      const r = this.rooms[h.room];
      if (r) this.events.push({ type: "mushHush", x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2), dark: false });
    }
    this.refreshLight();
  }

  /** SPORES ET FEU : en section 2, un nuage de spores que touche une flamme explose (1d6 à qui s'y tient), puis se dissipe. */
  private sporeBlast(): void {
    if (this.look() !== "champi" || this.gas.length === 0 || this.fires.length === 0) return;
    const hit = this.gas.filter((g) => !g.thin && this.fires.some((f) => Math.max(Math.abs(f.x - g.x), Math.abs(f.y - g.y)) <= 1));
    if (hit.length === 0) return;
    const cells = hit.map((g) => ({ x: g.x, y: g.y }));
    this.gas = this.gas.filter((g) => !hit.includes(g));
    this.events.push({ type: "sporeBlast", cells });
    this.raiseAlarm(RULES.sporeBlastAlarm, cells[0]);
    for (const c of cells) {
      if (this.hero.x === c.x && this.hero.y === c.y) this.hurtHero(rollDice(this.rng, RULES.sporeBlastDamage), "une explosion de spores");
      const m = this.monsterAt(c.x, c.y);
      if (m && !m.boss) {
        m.hp -= rollDice(this.rng, RULES.sporeBlastDamage);
        m.alerted = true;
        m.asleep = false;
        this.removeIfDead(m);
      }
    }
  }

  /** Une vesse-de-loup sur cette case (pas encore crevée). */
  puffballAt(x: number, y: number): Furniture | null {
    return this.current.furniture.find((f) => f.kind.startsWith("vesse") && !f.drained && f.x === x && f.y === y) ?? null;
  }

  /**
   * VESSES-DE-LOUP (section 2) : on marche dessus, ou une flèche la touche : elle crache son nuage en croix. Bleue :
   * SOMMEIL (les monstres s'endorment ; le héros perd son prochain tour). Rose : QUERELLE (les monstres touchés se
   * battent, comme la potion de discorde).
   */
  private burstPuffball(f: Furniture): void {
    f.drained = true;
    this.map.touch(f.x, f.y);
    const sleep = f.kind === "vesseSommeil";
    const cells = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: f.x + dx, y: f.y + dy })).filter((c) => this.map.isWalkable(c.x, c.y));
    this.events.push({ type: "puffball", x: f.x, y: f.y, what: sleep ? "sleep" : "feud", cells });
    if (sleep) {
      for (const c of cells) {
        const m = this.monsterAt(c.x, c.y);
        if (m && !m.boss) {
          m.asleep = true;
          m.alerted = false;
          m.feud = undefined;
        }
        if (this.hero.x === c.x && this.hero.y === c.y) this.hero.stuck = Math.max(this.hero.stuck ?? 0, 1);
      }
    } else {
      this.discordMist = cells.map((c) => ({ ...c, turns: 2 }));
      const hit = this.monsters.filter((m) => !m.boss && cells.some((c) => c.x === m.x && c.y === m.y));
      for (const m of hit) {
        const rival = hit.find((o) => o !== m) ?? this.monsters.filter((o) => o !== m && !o.boss && gapBetween(o, m) <= 4).sort((a, b) => gapBetween(a, m) - gapBetween(b, m))[0];
        if (rival && m.feud === undefined) this.startFeud(m, rival, "discord");
      }
    }
  }

  /** Les faux murs s'effacent au bout de quelques tours (rien dessus, la case redevient du sol). */
  private fakeWallTick(): void {
    const walls = this.current.fakeWalls;
    if (!walls || walls.length === 0) return;
    for (const w of walls) w.turns--;
    for (const w of walls.filter((o) => o.turns <= 0)) {
      this.map.set(w.x, w.y, Tile.Floor);
      this.events.push({ type: "artifact", what: "unpaint", x: w.x, y: w.y });
    }
    this.current.fakeWalls = walls.filter((o) => o.turns > 0);
    if (walls.some((o) => o.turns <= 0)) this.updateVision();
  }

  /**
   * Faire vibrer le diapason (Thomas, 2026-11-18) : une fois par étage, les pièges cachés et les passages secrets (pièce
   * secrète, tonneau creux) à 5 cases se révèlent. Un tour.
   */
  useDiapason(): boolean {
    if (this.over || this.artifactRefusal() !== null || this.equipment.artifact?.defId !== "diapason") return false;
    this.perks().fork = 1;
    const near = (p: Point) => Math.max(Math.abs(p.x - this.hero.x), Math.abs(p.y - this.hero.y)) <= RULES.diapasonReach;
    let traps = 0;
    for (const t of this.current.traps) if (t.hidden && near(t)) {
      t.hidden = false;
      traps++;
    }
    const secret = this.revealSecretsNear(near);
    this.events.push({ type: "artifact", what: "fork", traps, secret });
    this.wait();
    return true;
  }

  /**
   * La marque de l'entrée d'une pièce secrète disparaît quand elle s'ouvre (creux, rideau de mycélium) ; dans l'Ossuaire,
   * la plaque funéraire GLISSE sur la case de mur voisine, et l'alcôve de crânes s'écarte (Thomas, 2026-11-19).
   */
  private openSecretMark(entry: Point): void {
    const list = this.current.furniture;
    const mark = list.findIndex((f) => f.x === entry.x && f.y === entry.y && /^(wall(Gap|Hole)|mycCurtain|ossTablet|ossAlcove)/.test(f.kind));
    if (mark < 0) return;
    const [m] = list.splice(mark, 1);
    if (m.kind !== "ossTablet" || !m.side) return;
    const along = m.side === "S" || m.side === "N" ? [{ x: 1, y: 0 }, { x: -1, y: 0 }] : [{ x: 0, y: 1 }, { x: 0, y: -1 }];
    for (const d of along) {
      const p = { x: entry.x + d.x, y: entry.y + d.y };
      if (this.map.get(p.x, p.y) !== Tile.Wall || list.some((f) => f.x === p.x && f.y === p.y && /^oss(Tablet|Alcove)/.test(f.kind))) continue;
      list.push({ ...m, x: p.x, y: p.y, variant: "glissee" });
      this.map.touch(p.x, p.y);
      break;
    }
  }

  /** Diapason : la pièce secrète et le tonneau creux dont l'entrée est à portée s'ouvrent (comme une fouille réussie). */
  private revealSecretsNear(near: (p: Point) => boolean): boolean {
    let any = false;
    const secret = this.current.secretRoom;
    if (secret && !secret.found && near(secret.entry)) {
      secret.found = true;
      this.map.set(secret.entry.x, secret.entry.y, Tile.Floor);
      this.current.rooms.push(secret.room);
      this.openSecretMark(secret.entry);
      this.events.push({ type: "secret", what: "found", x: secret.entry.x, y: secret.entry.y });
      this.refreshLight();
      this.updateVision();
      any = true;
    }
    const zone = this.current.zone;
    if (zone && zone.door === "barrel" && !zone.open && !zone.noticed && near(zone.entry)) {
      zone.noticed = true;
      this.map.touch(zone.entry.x, zone.entry.y);
      this.events.push({ type: "zone", what: "found", x: zone.entry.x, y: zone.entry.y });
      any = true;
    }
    return any;
  }

  /** Les cases de rang de morilles de cet étage (sèches ou arrosées). */
  private morelRows(): Furniture[] {
    return this.current.furniture.filter((f) => f.kind.startsWith("morelRow") && f.kind !== "morelRowEmpty");
  }

  /** Avec l'arrosoir de Morillon : les cases de rang voisines du héros (4 directions) sont arrosées. */
  private waterRows(): void {
    const q = this.quest!;
    for (const f of this.morelRows()) {
      if (f.kind.endsWith("Wet") || Math.abs(f.x - this.hero.x) + Math.abs(f.y - this.hero.y) !== 1) continue;
      f.kind = `${f.kind}Wet`;
      this.map.touch(f.x, f.y);
      q.got = Math.min(q.need, q.got + 1);
      this.events.push({ type: "watered", x: f.x, y: f.y });
    }
  }

  /** Un objet du butin de l'étage (jamais d'or) ; `rarer` : celui de la section suivante. */
  private floorLoot(rarer = false): { item: ItemId; count: number } {
    for (let k = 0; k < 8; k++) {
      const l = rollLoot(this.rng, this.depth + (rarer ? RULES.floorsPerSection : 0));
      if (l.item !== "or") return l;
    }
    return { item: "pomme", count: 1 };
  }

  /** Fumée : les monstres à `radius` cases ou moins perdent la trace du héros et restent un tour hébétés (pas le boss). */
  private smokeBurst(at: Point, radius: number): void {
    // Quêtes v3, diversion de Krik : la fumée sur un traître de la zone (ou devant la tapisserie) suffit.
    const q = this.quest;
    const z = this.current.zone;
    if (q && q.id === "krik_diversion" && q.depth === this.depth && z) {
      const near = (p: Point) => Math.max(Math.abs(p.x - at.x), Math.abs(p.y - at.y)) <= radius;
      if (near(z.entry) || this.monsters.some((m) => z.sleepers.includes(m.id) && near(m))) q.got = q.need;
    }
    for (const m of this.monsters) {
      if (m.boss) {
        // La Tisseuse dans la fumée (Thomas, 2026-11-13) : elle perd la piste du héros et reste un tour hébétée.
        if (cellsOf(m).some((c) => Math.max(Math.abs(c.x - at.x), Math.abs(c.y - at.y)) <= radius)) {
          m.boss.target = undefined;
          m.stunned = Math.max(m.stunned ?? 0, 1);
          this.events.push({ type: "bossPotion", potion: "smoke", actor: m });
        }
        continue;
      }
      if (Math.max(Math.abs(m.x - at.x), Math.abs(m.y - at.y)) > radius) continue;
      m.alerted = false;
      m.wary = false;
      m.asleep = false;
      m.stunned = Math.max(m.stunned ?? 0, 1);
    }
  }

  /** Krik montre les repaires de ses anciens camarades : les salles où se trouvent des Kobolds apparaissent sur la carte. */
  private revealKoboldRooms(): void {
    for (const m of this.monsters) {
      if (m.defId !== "schrat" && m.defId !== "frondeur") continue;
      const r = this.current.rooms.find((o) => m.x >= o.x && m.x < o.x + o.w && m.y >= o.y && m.y < o.y + o.h);
      if (!r) continue;
      for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) if (this.map.inBounds(x, y)) this.explored[this.map.index(x, y)] = 1;
    }
  }

  /** L'investissement chez Krik, en descendant : rendu ×2, ou perdu (il a vendu le stock trois fois). */
  private settleKrik(): void {
    const mem = this.krikMemory;
    if (!mem.invested || mem.investDepth === undefined || this.depth <= mem.investDepth) return;
    const stake = mem.invested;
    mem.invested = 0;
    const amount = this.rng.chance(KRIK.investLoss) ? 0 : stake * 2;
    this.gold += amount;
    this.events.push({ type: "krikReturn", amount });
  }

  /** L'escalier qui descend apparaît sur la carte (il est noté comme déjà vu, avec ses voisines). */
  private revealStairs(): void {
    const s = this.current.stairs;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.map.inBounds(s.x + dx, s.y + dy)) this.explored[this.map.index(s.x + dx, s.y + dy)] = 1;
  }

  /** Vol raté : un Kobold frondeur accourt (il arrive hors de vue, à quelques cases, et sait où est le héros). */
  private callSlinger(from: Point): void {
    this.callFoes(from, "frondeur", 1);
  }

  /** Des Kobolds alertés arrivent hors de vue, à quelques cases, et savent où est le héros (vol raté, Krik trahi…). */
  private callFoes(from: Point, kind: "frondeur" | "schrat" | "cueilleur", count: number): void {
    for (let n = 0; n < count; n++) this.callOne(from, kind);
  }

  private callOne(from: Point, kind: "frondeur" | "schrat" | "cueilleur"): void {
    let spot: Point | null = null;
    for (let r = 4; r <= 9 && !spot; r++) {
      for (let dy = -r; dy <= r && !spot; dy++) {
        for (let dx = -r; dx <= r && !spot; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = from.x + dx;
          const y = from.y + dy;
          if (this.map.inBounds(x, y) && this.map.isWalkable(x, y) && !this.actorAt(x, y) && !this.isVisible(x, y)) spot = { x, y };
        }
      }
    }
    if (!spot) return;
    const m = this.newMonster(MONSTERS[kind], spot.x, spot.y, false);
    m.alerted = true;
    this.monsters.push(m);
  }

  private placeMerchant(floor: { rooms: Room[]; start: Point; stairs: Point; map: GameMap; specials?: { room: Room }[] }, seed: number, depth: number): Merchant | null {
    const inside = (r: Room, p: Point) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
    const rooms = floor.rooms.filter((r) => !inside(r, floor.start) && !inside(r, floor.stairs) && !(floor.specials ?? []).some((s) => s.room === r) && r.w * r.h >= 12);
    if (rooms.length === 0) return null;
    const room = rooms[Math.floor(mix(seed, depth, 5) * rooms.length)];
    const cells: Point[] = [];
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) if (floor.map.get(x, y) === Tile.Floor) cells.push({ x, y });
    if (cells.length === 0) return null;
    const at = cells[Math.floor(mix(seed, depth, 6) * cells.length)];
    const wares = rollWares(depth, seed);
    for (const w of wares) noteUnique(w.item);
    return makeMerchant(at, room, wares, seed, sectionOf(depth));
  }

  inCombat(): boolean {
    return this.monsters.some((m) => m.alerted && this.isVisible(m.x, m.y));
  }

  /** Le bruit d'un combat réveille les dormeurs proches : ils se lèvent et viennent (Thomas). */
  /** La baignoire où le Kobold dort encore, ou le tourne-disque qui joue, sur cette case. */
  bathTargetAt(x: number, y: number): "tub" | "gramophone" | null {
    const b = this.current.bath;
    if (!b || b.out) return null;
    if (y === b.y && (x === b.x || x === b.x + 1)) return "tub";
    if (b.music && this.current.furniture.some((f) => f.kind === "gramophone" && f.x === x && f.y === y)) return "gramophone";
    return null;
  }

  /** La salle de bain de cet étage (pour le dessin). */
  bath(): Readonly<import("./floor").BathState> | null {
    return this.current.bath ?? null;
  }

  /** Le tourne-disque joue, et le héros est assez près pour l'entendre. */
  bathMusicNear(): boolean {
    const b = this.current.bath;
    if (!b || !b.music) return false;
    const g = this.current.furniture.find((f) => f.kind === "gramophone");
    return !!g && gapBetween(g, this.hero) <= RULES.bathMusicRange && this.isExplored(g.x, g.y);
  }

  /**
   * Le Kobold sort de son bain (Thomas, 2026-11-13) : SPLASH, il bondit sur une case à côté (de préférence à côté du
   * héros), mouillé et savonneux (désavantage 2 tours), sans dague ni cotte (restées au porte-serviettes) : il se bat à la
   * serviette. Si on l'a attaqué, le premier coup part tout de suite, avec l'avantage (il dormait).
   */
  private wakeBath(attack: boolean): void {
    const b = this.current.bath;
    if (!b || b.out) return;
    b.out = true;
    const around: Point[] = [];
    for (let y = b.y - 1; y <= b.y + 1; y++) {
      for (let x = b.x - 1; x <= b.x + 2; x++) {
        if (this.map.isWalkable(x, y) && !this.actorAt(x, y) && !this.npcAt(x, y) && !this.isTrap(x, y)) around.push({ x, y });
      }
    }
    if (around.length === 0) return;
    around.sort((p, q) => gapBetween(p, this.hero) - gapBetween(q, this.hero));
    const at = around[0];
    const def = MONSTERS.schrat as MonsterDef;
    const m = this.newMonster(def, at.x, at.y, false);
    m.name = "Kobold mouillé";
    m.bather = true;
    m.soapy = RULES.soapyTurns + 1;
    m.armorClass -= 2;
    m.attackBonus = 0;
    m.damage = { count: 1, sides: 1, bonus: 0 };
    m.purse = this.rng.int(8, 15);
    m.alerted = false;
    m.asleep = false;
    this.monsters.push(m);
    this.events.push({ type: "bath", what: "splash", x: at.x, y: at.y });
    this.raiseAlarm(RULES.bathAlarm, at);
    if (attack && gapBetween(m, this.hero) <= 1) this.heroAttacks(m);
    if (this.monsters.includes(m)) m.alerted = !this.peaceful;
  }

  private wakeNear(at: Point): void {
    const b = this.current.bath;
    if (b && !b.out && gapBetween(b, at) <= RULES.combatWakeRadius) this.wakeBath(false);
    for (const m of this.monsters) {
      if (!m.asleep || m.deaf || Math.max(Math.abs(m.x - at.x), Math.abs(m.y - at.y)) > RULES.combatWakeRadius) continue;
      m.asleep = false;
      if (!this.peaceful) m.alerted = true;
    }
  }

  /**
   * Salle d'essai, « Combats : non » : les monstres sont mis de côté (ils disparaissent de l'étage), et reviennent à leur
   * place quand on rétablit les combats (Thomas). Pas de renforts tant que les combats sont coupés.
   */
  setPeaceful(on: boolean): void {
    if (on === this.peaceful) return;
    this.peaceful = on;
    if (on) {
      this.peacefulStash = this.monsters.splice(0);
    } else {
      for (const m of this.peacefulStash) {
        if (!this.actorAt(m.x, m.y)) this.monsters.push(m);
      }
      this.peacefulStash = [];
    }
  }
  private peacefulStash: Actor[] = [];

  // ---------- Salle d'essai v21 : HUB, arène, écriteaux (Thomas, 2026-11-14) ----------

  /** Le plan de la salle d'essai (refait à chaque remise à neuf) ; `null` hors salle d'essai. */
  private plan: SandboxFloor | null = null;
  /** SECTION : ALL (Thomas, 2026-11-14) : une vraie partie, mais avec les outils d'essai et le téléporteur d'étage ;
   *  elle ne compte ni pour les records, ni pour les succès, ni pour l'encyclopédie. */
  testRun = false;

  /** Téléporteur d'étage (partie d'essai) : on arrive en haut de l'étage demandé (1 à la fin de la démo). */
  teleport(depth: number): boolean {
    if (!this.testRun || this.over || depth < 1 || depth > this.lastDepth() || depth === this.depth) return false;
    const down = depth > this.depth;
    // Le téléporteur n'est qu'en partie d'essai : jamais d'étage scellé là (Thomas, 2026-11-16).
    this.enterFloor(depth, "down");
    this.deepest = Math.max(this.deepest, depth);
    this.events.push({ type: "stairs", direction: down ? "down" : "up", healed: 0 });
    return true;
  }

  /**
   * Triche « Boss 2 » (Thomas, 2026-11-17 : « un mode qui me téléporte direct au boss 2, niveau cible 10, améliorations
   * faites ») : partie d'essai seulement. Étage 10 (le Carillon), héros niveau 10, points placés (Force et Vie à tour de
   * rôle), la voie rouge si aucune n'est prise, tous les rangs de pouvoir achetés, l'équipement « élevé », PV pleins.
   */
  /**
   * Aperçu de la section 3 (Thomas, 2026-11-19 : « les statues me one shot » : l'aperçu partait au niveau 1) : l'étage 11
   * avec un héros de niveau 10 monté comme pour le Carillon, plus 20 flèches d'obsidienne et 2 potions de gel.
   */
  testSection3(): boolean {
    if (!this.testRun || this.over) return false;
    this.previewS3 = true;
    if (!this.teleport(11)) return false;
    // Chapelle (Sœur Clavicule) et musée (Maître Osselet) sur cet étage : on retire au besoin un autre étage 11
    // (Thomas, 2026-11-19 : « la nouvelle quête n'a pas de test ? »).
    const base = this.runSeed;
    for (let i = 1; i < 60 && !(this.npc("clavicule") && this.npc("osselet")); i++) {
      (this as unknown as { runSeed: number }).runSeed = (base ^ Math.imul(i, 0x9e3779b1)) >>> 0;
      this.floors.delete(11);
      this.monsters = [];
      this.enterFloor(11, "down");
    }
    this.testBoss2(false);
    // Niveau 11 (Thomas, 2026-11-19) : le Rang III s'ouvre, son point de voie reste à placer (le « ! » du héros).
    if (this.level < 11) {
      this.levelUpNow();
      while (this.points > 0 && this.allocate(this.alloc.force <= this.alloc.vie ? "force" : "vie"));
      this.hero.hp = this.hero.maxHp;
    }
    this.inventory.add("fleche_obsidienne", 20);
    this.inventory.add("potion_gel", 2);
    this.inventory.add("grenade_sainte", 2);
    this.chooseAmmo("fleche_obsidienne");
    return true;
  }

  testBoss2(move = true): boolean {
    if (!this.testRun || this.over) return false;
    if (move && this.depth !== RULES.bossDepths[1]) this.teleport(RULES.bossDepths[1]);
    // Niveau par niveau : le Rang I se remplit avant le niveau 6, le Rang II ensuite (Rang I gelé).
    for (let guard = 0; this.level < 10 && guard < 20; guard++) {
      this.levelUpNow();
      while (this.points > 0 && this.allocate(this.alloc.force <= this.alloc.vie ? "force" : "vie"));
      if (this.canChoosePath()) this.choosePath("red");
      const path = this.voie ? PATHS[this.voie] : null;
      const powers = path ? ([path.main, ...path.secondaries, ...path.tier2].map((p) => p.id) as PowerId[]) : [];
      for (let k = 0; this.pathPoints() > 0 && k < 20; k++) if (!powers.some((id) => this.improve(id))) break;
    }
    this.testKit("eleve");
    this.hero.hp = this.hero.maxHp;
    return true;
  }

  /** Quelle salle d'essai (section 1 ou 2), choisie au menu avant de créer la partie. */
  readonly sandboxSection: 1 | 2 = sandboxSection();

  /** Le décor de l'étage : « champi » (section 2, la champignonnière) ou celui de la section 1. */
  look(): "s1" | "champi" | "ossuaire" {
    if (this.current?.look === "champi") return "champi";
    if (this.current?.look === "ossuaire") return "ossuaire";
    return this.sandbox && this.depth === 1 && this.sandboxFloor()?.look === "champi" ? "champi" : "s1";
  }
  private resetting = false;
  private wasInHub = true;

  private sandboxFloor(): SandboxFloor | null {
    if (!this.sandbox) return null;
    return (this.plan ??= sandboxPlan(this.sandboxSection));
  }

  /** Les écriteaux au mur de l'étage (salle d'essai). */
  signs(): readonly SandboxSign[] {
    return this.depth === 1 ? (this.sandboxFloor()?.signs ?? []) : [];
  }

  /** Les zones dessinées au sol de l'étage (armurerie de la salle d'essai). */
  areas(): readonly SandboxArea[] {
    return this.depth === 1 ? (this.sandboxFloor()?.areas ?? []) : [];
  }

  /** Le héros est dans l'arène de la salle d'essai. */
  inArena(): boolean {
    const arena = this.depth === 1 ? this.sandboxFloor()?.arena : undefined;
    return arena !== undefined && this.roomIndexAt(this.hero) === arena;
  }

  /**
   * Salle d'essai : tout l'étage redevient comme au premier jour (monstres, objets, pièges, meubles, PNJ et leurs
   * dialogues), sauf le héros, qui garde sa place, son sac et son niveau ; la carte reste connue.
   */
  resetSandbox(): boolean {
    if (!this.sandbox || this.depth !== 1 || this.over) return false;
    const old = this.current;
    const { x, y } = this.hero;
    this.floors.delete(1);
    this.resetting = true;
    try {
      this.enterFloor(1, "down");
    } finally {
      this.resetting = false;
    }
    if (old.explored.length === this.current.explored.length) {
      this.current.explored.set(old.explored);
      this.current.sensed.set(old.sensed);
    }
    this.hero.x = this.hero.fromX = this.hero.prevX = x;
    this.hero.y = this.hero.fromY = this.hero.prevY = y;
    this.resetDialogues();
    this.updateVision();
    this.events.push({ type: "sandboxReset" });
    return true;
  }

  /** Entrer dans le HUB (en venant d'ailleurs) remet l'étage à neuf. */
  private sandboxHubCheck(): void {
    if (!this.sandbox || this.depth !== 1) return;
    const hub = this.sandboxFloor()?.hub;
    if (hub === undefined) return;
    const now = this.roomIndexAt(this.hero) === hub;
    if (now && !this.wasInHub) this.resetSandbox();
    this.wasInHub = now;
  }

  /** Arène : on retire ses monstres et on remet ceux du départ, à leur place. */
  arenaReset(): boolean {
    const plan = this.depth === 1 ? this.sandboxFloor() : null;
    if (!plan || plan.arena === undefined) return false;
    const r = this.rooms[plan.arena];
    const inside = (m: Point) => m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h;
    this.monsters = this.monsters.filter((m) => !inside(m));
    this.current.monsters = this.monsters;
    this.peacefulStash = this.peacefulStash.filter((m) => !inside(m));
    for (const m of ARENA_MONSTERS) {
      const x = r.x + m.x;
      const y = r.y + m.y;
      if (x === this.hero.x && y === this.hero.y) continue;
      this.addArenaMonster(m.monster ?? "schrat", x, y, m.asleep, !!m.patrol);
    }
    return true;
  }

  /** Arène : un monstre de plus (éveillé, il fait sa ronde), sur une case libre loin du héros si possible. */
  arenaSpawn(kind: SandboxMonsterKind): boolean {
    const plan = this.depth === 1 ? this.sandboxFloor() : null;
    if (!plan || plan.arena === undefined) return false;
    const r = this.rooms[plan.arena];
    let best: Point | null = null;
    let far = -1;
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        if (this.map.get(x, y) !== Tile.Floor || this.actorAt(x, y) || this.peacefulStash.some((m) => m.x === x && m.y === y)) continue;
        const d = Math.max(Math.abs(x - this.hero.x), Math.abs(y - this.hero.y)) + this.rng.next();
        if (d > far) {
          far = d;
          best = { x, y };
        }
      }
    if (!best) return false;
    this.addArenaMonster(kind, best.x, best.y, false, true);
    return true;
  }

  private addArenaMonster(kind: SandboxMonsterKind, x: number, y: number, asleep: boolean, patrol: boolean): void {
    const m = this.newMonster(MONSTERS[kind], x, y, asleep);
    if (patrol) m.patrol = this.rooms[this.sandboxFloor()!.arena!];
    m.fromX = x;
    m.fromY = y;
    if (this.peaceful) this.peacefulStash.push(m);
    else this.monsters.push(m);
  }

  /** Un monstre éveillé a le héros en vue directe (ligne de vue dégagée, à portée de ses yeux) : impossible de se cacher. */
  isWatched(): boolean {
    return this.monsters.some(
      // Seul un monstre qui vous a REPÉRÉ (« ! ») vous empêche de vous cacher ; sous le regard d'un « ? », on a encore
      // une chance de disparaître avant qu'il ne vous remarque (Thomas, 2026-11-11).
      (m) => !m.asleep && m.alerted && this.isVisible(m.x, m.y) && Math.max(Math.abs(m.x - this.hero.x), Math.abs(m.y - this.hero.y)) <= m.vision,
    );
  }

  isThreatened(): boolean {
    return this.monsters.some((m) => m.alerted && this.inReach(m, this.hero));
  }

  /** Le héros est-il en mauvaise posture ? (dans une porte, ou un ennemi alerté le guette au coin d'un mur) */
  heroExposed(): boolean {
    const foes = this.monsters.filter((m) => m.alerted);
    return foes.some((m) => gapBetween(m, this.hero) <= 2 && this.hasEdge(m, this.hero));
  }

  /** Chaque monstre que le héros vient de quitter l'attaque une fois. Renvoie vrai s'il y a eu au moins une attaque. */
  private opportunityAttacks(threats: Actor[]): boolean {
    let attacked = false;
    for (const m of threats) {
      if (this.over || this.inReach(m, this.hero)) continue;
      const result = rollAttack(this.rng, m, this.hero);
      this.events.push({ type: "attack", attacker: m, target: this.hero, result, opportunity: true });
      if (result.damage > 0) this.bleed(this.hero, m);
      this.hurtHero(result.damage, this.killerName(m));
      attacked = true;
    }
    return attacked;
  }

  /** Entrer dans une porte fermée l'ouvre ; la lumière et la vue passent alors au travers. */
  private openDoorAt(x: number, y: number): void {
    if (this.map.get(x, y) !== Tile.DoorClosed) return;
    this.map.set(x, y, Tile.DoorOpen);
    this.refreshLight();
    this.events.push({ type: "opened", x, y });
  }

  /** Une porte se referme dès que plus personne ne se tient dans son encadrement. */
  private closeDoorAt(x: number, y: number): void {
    if (this.map.get(x, y) !== Tile.DoorOpen || this.actorAt(x, y)) return;
    // Une flèche (ou tout objet) au sol dans l'embrasure cale la porte : elle reste ouverte (Thomas, 2026-11-13).
    if (this.ground.some((g) => g.x === x && g.y === y)) return;
    this.map.set(x, y, Tile.DoorClosed);
    this.refreshLight();
  }

  /** Le coffre d'acier de la pièce secrète est-il sur cette case ? */
  steelChestAt(x: number, y: number): boolean {
    const s = this.current?.secretRoom;
    return !!s && s.chest.x === x && s.chest.y === y;
  }

  /** Assombrissement d'une case de la pièce secrète : opacité à l'entrée de la case et à sa sortie, vers le fond. */
  secretShade(x: number, y: number): { from: number; to: number; dir: Point } | null {
    const s = this.current?.secretRoom;
    // La neige reste claire (pas d'ombre en dégradé).
    if (!s || s.layout === "neige") return null;
    const r = s.room;
    if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) return null;
    const depth = s.dir.x !== 0 ? (s.dir.x > 0 ? x - r.x : r.x + r.w - 1 - x) : s.dir.y > 0 ? y - r.y : r.y + r.h - 1 - y;
    const size = s.dir.x !== 0 ? r.w : r.h;
    const a = (t: number) => RULES.secretShade[0] + (RULES.secretShade[1] - RULES.secretShade[0]) * t;
    return { from: a(depth / size), to: a((depth + 1) / size), dir: s.dir };
  }

  /** Une grille de prison fermée sur cette case (on peut la forcer). */
  grilleAt(x: number, y: number): Furniture | null {
    return this.current.furniture.find((f) => f.kind === "grille" && f.x === x && f.y === y) ?? null;
  }

  /**
   * Forcer une grille de la prison (Thomas, 2026-11-14 : « ajoute un élément interactif dans la prison ») : d20 + force
   * contre 12 (C), CLANG à chaque essai (+3 d'alerte, C). Réussi : elle s'ouvre ; dans la cellule, ce qu'un prisonnier
   * a laissé (de l'or, parfois un objet, parfois rien).
   */
  private forceGrille(f: Furniture): void {
    this.reveal();
    const bonus = this.pushBonus();
    let d20 = this.rng.int(1, 20);
    if (d20 === 1 && this.useLuck()) d20 = this.rng.int(1, 20);
    const total = d20 + bonus;
    const success = d20 === 20 || (d20 !== 1 && total >= RULES.grilleDc);
    this.raiseAlarm(RULES.grilleAlarm, f);
    this.events.push({ type: "statue", grille: true, x: f.x, y: f.y, d20, bonus, total, success });
    if (!success) return;
    f.kind = "grilleOpen";
    this.map.set(f.x, f.y, Tile.Floor);
    const cell = { x: f.x, y: f.y - 1 };
    if (this.map.get(cell.x, cell.y) !== Tile.Floor) return;
    const r = this.rng.next();
    if (r < 0.45) this.dropItem(cell.x, cell.y, "or", lessGold(this.rng.int(5, 12) + this.depth * 2));
    else if (r < 0.8) {
      const loot = rollLoot(this.rng, this.depth);
      this.dropItem(cell.x, cell.y, loot.item, loot.count);
    }
  }

  /** La pièce secrète de l'étage (pour l'affichage et la salle d'essai). */
  secretRoom(): import("../world/secretRoom").SecretRoom | null {
    return this.current?.secretRoom ?? null;
  }

  /** Ce qui se déclenche quand le héros marche sur une case particulière (autel à la pomme dorée, coffre). */
  private useFeatureAt(x: number, y: number): void {
    const t = this.map.get(x, y);
    if (t === Tile.Fountain) {
      // L'AUTEL À LA POMME DORÉE (Thomas, 2026-11-12, à la place de la fontaine) : la croquer soigne tout et bénit.
      const healed = this.hero.maxHp - this.hero.hp;
      this.hero.hp = this.hero.maxHp;
      this.map.set(x, y, Tile.FountainDry);
      this.blessTurns = RULES.blessTurns;
      this.refreshStats();
      this.events.push({ type: "fountain", healed });
    } else if (t === Tile.Chest && this.goldChestAt(x, y)) {
      // Le COFFRE DORÉ de la fin du boss (Thomas, 2026-11-14) : de l'argent, un artefact, une arme, une armure.
      this.map.set(x, y, Tile.ChestOpen);
      const gold = lessGold(this.rng.int(RULES.goldChestGold[0], RULES.goldChestGold[1]));
      // Plus aucun bibelot à donner (ils sont uniques, et le joueur les a peut-être déjà tous) : le tirage rendait
      // « rien », posé au sol tel quel, et la partie plantait en marchant dessus (trouvé par le bot expert, 2026-11-16).
      // Désormais ce lot manque simplement au coffre.
      const pickOne = (keep: (kind: string) => boolean): ItemId | null => {
        const pool = lootPool(this.depth + RULES.floorsPerSection, (k) => keep(k), "rare");
        const fallback = lootPool(this.depth + RULES.floorsPerSection, (k) => keep(k));
        const list = pool.length > 0 ? pool : fallback;
        return list.length > 0 ? list[this.rng.int(0, list.length - 1)] : null;
      };
      const artifact = pickOne((k) => k === "artifact");
      const weapon = pickOne((k) => k === "melee" || k === "ranged");
      const armor = pickOne((k) => k === "armor" || k === "hat");
      const lots = [artifact, weapon, armor].filter((id): id is ItemId => id !== null);
      const drops = lots.length === 0 ? this.spillLoot(x, y, 0, { item: "or", count: gold }) : lots.flatMap((item, i) => (i === 0 ? this.spillLoot(x, y, gold, { item, count: 1 }) : this.spillLoot(x, y, 0, { item, count: 1 }).slice(1)));
      this.events.push({ type: "chest", gold, item: lots[0] ?? "or", count: lots.length > 0 ? 1 : 0, x, y, drops, golden: lots.slice(1) });
    } else if (t === Tile.Chest) {
      this.map.set(x, y, Tile.ChestOpen);
      const gold = lessGold((this.rng.int(RULES.chestGoldMin, RULES.chestGoldMax) + this.depth * RULES.chestGoldPerDepth) * (this.current.boss || this.steelChestAt(x, y) ? 2 : 1));
      // Coffre de la forge : une arme ; de l'alchimiste : une potion (Thomas). Ailleurs, un objet au hasard.
      const theme = this.themeAt(x, y);
      const pool = theme === "forge" ? lootPool(this.depth, (k) => k === "melee" || k === "ranged") : theme === "alchimiste" ? lootPool(this.depth, (_, id) => id.startsWith("potion_")) : [];
      // Coffre du boss : un objet RARE à coup sûr, et plus d'or.
      const bossChest = this.current.boss && this.current.boss.chest.x === x && this.current.boss.chest.y === y;
      // Le coffre d'acier de la pièce secrète aussi : un objet rare, et l'or doublé.
      const steel = this.steelChestAt(x, y);
      if (bossChest || steel) pool.push(...lootPool(this.depth, () => true, "rare"));
      const loot = pool.length > 0 ? { item: pool[this.rng.int(0, pool.length - 1)], count: 1 } : rollLoot(this.rng, this.depth);
      const drops = this.spillLoot(x, y, gold, loot);
      this.events.push({ type: "chest", gold, item: loot.item, count: loot.count, x, y, drops });
    }
  }

  /** Le contenu d'un coffre (ou d'un sarcophage) tombe à côté : renvoie les cases de l'or et de l'objet. */
  private spillLoot(x: number, y: number, gold: number, loot: { item: ItemId; count: number }): Point[] {
    {
      // Ce que contient le coffre tombe à côté (Thomas) : l'or sur une case voisine, l'objet sur une autre.
      // Jamais sur un décor (meuble, tapis, chaise, cendres, autre coffre, eau, escalier, porte) : seulement du sol nu
      // (Thomas) ; à défaut, une case plus loin ; à défaut, sur la case du coffre.
      // Visible (Thomas : « sarcophage piqué, 0 drop ») : jamais sur la case juste au-dessus d'un meuble qui bloque (son
      // dessin déborde dessus et cache l'objet) ni juste au-dessus du héros, ni de l'autre côté d'un mur.
      const hidden = (p: Point) => {
        const below = this.furnitureAt(p.x, p.y + 1);
        return (below !== null && FURNITURE_KINDS[below.kind]?.blocks) || (p.x === this.hero.x && p.y + 1 === this.hero.y);
      };
      const bare = (p: Point) =>
        (this.map.get(p.x, p.y) === Tile.Floor || this.map.get(p.x, p.y) === Tile.Gravel) &&
        !this.furnitureAt(p.x, p.y) &&
        !(p.x === this.hero.x && p.y === this.hero.y) &&
        !this.isTrap(p.x, p.y) &&
        hasLineOfSight(this.map, { x, y }, p);
      const ring = (r: number, strict: boolean) => {
        const out: Point[] = [];
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) out.push({ x: x + dx, y: y + dy });
        return out.filter((p) => bare(p) && (!strict || !hidden(p)));
      };
      const near = ring(1, true);
      const strict = near.length >= 2 ? near : [...near, ...ring(2, true)];
      const around = strict.length >= 2 ? strict : [...strict, ...ring(1, false).filter((p) => !strict.some((q) => q.x === p.x && q.y === p.y))];
      if (around.length === 0) around.push(...ring(2, false));
      const free = around.filter((p) => !this.ground.some((g) => g.x === p.x && g.y === p.y));
      const spots = free.length > 0 ? free : around.length > 0 ? around : [{ x, y }];
      // L'objet d'abord, sur une case bien en vue s'il y en a une ; l'or sur une autre.
      const clear = spots.filter((p) => strict.includes(p));
      const pickFrom = clear.length > 0 ? clear : spots;
      const itemAt = pickFrom[this.rng.int(0, pickFrom.length - 1)];
      const others = spots.filter((p) => p !== itemAt);
      const goldAt = others.length > 0 ? others[this.rng.int(0, others.length - 1)] : itemAt;
      if (gold > 0) this.dropItem(goldAt.x, goldAt.y, "or", gold);
      this.dropItem(itemAt.x, itemAt.y, loot.item, loot.count);
      return [goldAt, itemAt];
    }
  }

  /** Ce avec quoi on peut faire quelque chose dans cette salle : coffre, fontaine, sarcophage fermé, objet au sol. */
  interactiveIn(room: { x: number; y: number; w: number; h: number }): Point[] {
    const out: Point[] = [];
    const inside = (p: Point) => p.x >= room.x && p.x < room.x + room.w && p.y >= room.y && p.y < room.y + room.h;
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        const t = this.map.get(x, y);
        if (t === Tile.Chest || t === Tile.Fountain || this.maidenAt(x, y)) out.push({ x, y });
      }
    }
    for (const g of this.ground) if (inside(g) && !out.some((p) => p.x === g.x && p.y === g.y)) out.push({ x: g.x, y: g.y });
    return out;
  }

  /** Sarcophage à pointes encore fermé sur cette case ? */
  maidenAt(x: number, y: number): Furniture | null {
    return this.current.furniture.find((f) => f.kind === "maiden" && f.x === x && f.y === y) ?? null;
  }

  /**
   * Sarcophage à pointes (salle de torture) : DÉSAMORCER (d20 + agilité) ou FORCER (d20 + force, bruyant) contre
   * `maidenDc`. Réussi : il s'ouvre sans mal. Raté : une pointe jaillit (1d4), mais il s'ouvre quand même. Dedans, un
   * squelette, de l'or et un objet, qui tombent à côté.
   */
  private resolveMaiden(action: DoorAction, at: Point): void {
    const maiden = this.maidenAt(at.x, at.y);
    this.pendingDoor = null;
    if (!maiden) return;
    const bonus = action === "pick" ? this.disengageBonus() : this.pushBonus();
    const d20 = this.rng.int(1, 20);
    const total = d20 + bonus;
    const success = (action === "pick" && this.equipment.artifact?.defId === "outils_voleur") || d20 === 20 || (d20 !== 1 && total >= RULES.maidenDc);
    const damage = success ? 0 : rollDice(this.rng, RULES.maidenSpike);
    maiden.kind = "maidenOpen";
    this.map.touch(at.x, at.y);
    if (action === "break") {
      this.reveal();
      this.raiseAlarm(RULES.alarmMaiden, at);
    }
    const gold = lessGold(this.rng.int(RULES.chestGoldMin, RULES.chestGoldMax) + this.depth * RULES.chestGoldPerDepth);
    const loot = rollLoot(this.rng, this.depth);
    const drops = this.spillLoot(at.x, at.y, gold, loot);
    this.events.push({ type: "maiden", action: action as "pick" | "break" | "key", x: at.x, y: at.y, d20, bonus, total, success, damage, gold, item: loot.item, count: loot.count, drops });
    if (damage > 0) {
      this.bleed(this.hero, this.hero);
      this.hurtHero(damage, "la pointe d'un sarcophage");
    }
  }

  private resolveDoor(action: DoorAction, door: Point): void {
    if (this.maidenAt(door.x, door.y)) return this.resolveMaiden(action, door);
    const counter = this.counterAt(door.x, door.y);
    if (action === "peek") {
      if (counter) this.peekCounter(counter);
      return;
    }
    this.resolveDoorOpening(action, door);
    if (counter && this.map.get(door.x, door.y) !== Tile.DoorLocked) this.releaseCounter(counter);
    this.dropUselessKeys();
  }

  /**
   * CLEF INUTILE (Thomas, 2026-11-14 : « quand on a forcé une porte, on ne peut plus trouver une clef associée dans
   * l'étage ») : dès qu'il ne reste plus aucune porte verrouillée que la clef pourrait ouvrir, les clefs encore au sol
   * de l'étage disparaissent (sauf celle qu'on a sous les yeux). Pas en salle d'essai.
   */
  private dropUselessKeys(): void {
    if (this.sandbox) return;
    for (let y = 0; y < this.map.height; y++)
      for (let x = 0; x < this.map.width; x++) if (this.map.get(x, y) === Tile.DoorLocked && !this.sealedDoor(x, y)) return;
    for (let i = this.ground.length - 1; i >= 0; i--) {
      const g = this.ground[i];
      if (g.item === "clef" && !this.isVisible(g.x, g.y)) this.ground.splice(i, 1);
    }
  }

  private resolveDoorOpening(action: DoorAction, door: Point): void {
    if (action === "key") {
      // La clef ouvre sans jet, sans alerter personne (juste le bruit de la serrure) ; elle est consommée.
      if (!this.inventory.take("clef", 1, this.depth)) return;
      this.map.set(door.x, door.y, Tile.DoorOpen);
      this.refreshLight();
      this.pendingDoor = null;
      this.events.push({ type: "door", action, x: door.x, y: door.y, d20: 0, bonus: 0, total: 0, dc: 0, success: true, alerted: 0 });
      return;
    }
    // Crocheter : l'agilité aide (Thomas, 2026-11-11) ; enfoncer : la force.
    const bonus = action === "pick" ? this.heroClass.lockpickBonus + this.agility() : this.heroClass.breakBonus + this.strength();
    const dc = action === "pick" ? RULES.lockpickDc : RULES.breakDc;
    let d20 = this.rng.int(1, 20);
    let total = d20 + bonus;
    const sealed = this.sealedDoor(door.x, door.y);
    // Outils de voleur en artefact : le crochetage réussit à coup sûr (sauf la porte du poulet).
    const tools = action === "pick" && this.equipment.artifact?.defId === "outils_voleur";
    let success = !sealed && (tools || d20 === 20 || (d20 !== 1 && total >= dc));
    if (!success && !sealed && this.useStubborn()) {
      d20 = this.rng.int(1, 20);
      total = d20 + bonus;
      success = d20 === 20 || (d20 !== 1 && total >= dc);
    }
    if (success) {
      // Crochetée, la porte s'ouvre ; enfoncée, elle est détruite.
      this.map.set(door.x, door.y, action === "pick" ? Tile.DoorOpen : Tile.Floor);
      this.refreshLight();
      this.pendingDoor = null;
    } else {
      this.failedDoorAttempts.add(this.doorAttemptKey(door, action)); // raté : cette méthode ne marchera plus ici
    }
    let alerted = 0;
    if (action === "break") {
      this.reveal();
      this.raiseAlarm(RULES.alarmBreak, door);
      // Le vacarme alerte les monstres proches, que la porte cède ou non.
      for (const m of this.monsters) {
        const d = Math.max(Math.abs(m.x - door.x), Math.abs(m.y - door.y));
        if (!m.alerted && d <= RULES.noiseRadius) {
          m.alerted = true;
          m.asleep = false;
          alerted++;
        }
      }
    }
    this.events.push({ type: "door", action, x: door.x, y: door.y, d20, bonus, total, dc, success, alerted, sealed });
  }

  /**
   * Coup de pouce contre les séries de ratés : après plusieurs attaques manquées d'affilée (épée ou arc),
   * chaque attaque suivante gagne un bonus qui grossit jusqu'à ce qu'un coup porte.
   */
  streakBonus(): number {
    const extra = this.heroMisses - RULES.missStreakStart + 1;
    return extra > 0 ? extra * RULES.missStreakBonus : 0;
  }

  private noteHeroAttack(hit: boolean): void {
    this.heroMisses = hit ? 0 : this.heroMisses + 1;
  }

  /** Une attaque au corps à corps du héros. `extra` : un coup en plus du même tour (double frappe, vitesse). */
  private heroAttacks(monster: Actor, extra = false, opportunity = false): void {
    this.reveal();
    // La Prêtresse chante dans le puits : hors d'atteinte du corps à corps (les tirs la touchent).
    if (monster.aloft) {
      this.events.push({ type: "priestess", what: "aloft", x: monster.x, y: monster.y });
      return;
    }
    this.lastFoeId = monster.id;
    // Un monstre qui n'a rien remarqué est attaqué avec avantage (deux d20, on garde le meilleur).
    // De même contre un monstre pris dans l'encadrement d'une porte : celui qui attend derrière a l'avantage.
    let damageBonus = 0;
    // Rage (voie rouge) : plus de dégâts sous la moitié des PV.
    if (this.rank("rage") > 0 && this.hero.hp * 2 < this.hero.maxHp) damageBonus += this.rank("rage");
    damageBonus += this.curseBonusOn(monster);
    damageBonus += this.strikeBonus.damage;
    // Frénésie (voie rouge, Rang III) : +1 dégât par coup qui a porté d'affilée (les tours qui se suivent), plafonné.
    const frenzyRank = this.rank("frenesie");
    if (frenzyRank > 0) {
      if (this.frenzyTurn < this.turn - 1) this.frenzy = 0;
      damageBonus += Math.min(this.frenzy, frenzyRank >= 2 ? 4 : 3);
    }
    const attacker = { attackBonus: this.hero.attackBonus + this.streakBonus() + this.strikeBonus.hit, damage: { ...this.hero.damage, bonus: this.hero.damage.bonus + damageBonus }, grown: this.hero.grown };
    const critFrom = this.rank("coup_puissant") > 0 ? 19 - this.rank("coup_puissant") : 20;
    const advantaged = opportunity || this.heroHasAdvantageOn(monster);
    // Un coup de serviette dans la figure (le Kobold du bain) : le coup suivant a le désavantage.
    const blinded = this.towelBlind > 0;
    this.towelBlind = 0;
    const mode = advantaged && !blinded ? "advantage" : blinded && !advantaged ? "disadvantage" : "normal";
    let result = rollAttack(this.rng, attacker, monster, mode, critFrom, () => this.useLuck(), () => this.useLuckyDie());
    // Têtu : le premier coup raté de l'étage est relancé.
    if (!result.hit && this.useStubborn()) result = rollAttack(this.rng, attacker, monster, mode, critFrom, () => this.useLuck(), () => this.useLuckyDie());
    this.noteHeroAttack(result.hit);
    if (frenzyRank > 0) {
      if (result.hit) {
        if (this.frenzyTurn !== this.turn || this.frenzy === 0) this.frenzy++;
        this.frenzyTurn = this.turn;
      } else this.frenzy = 0;
    }
    if (!extra) {
      // Vitesse de l'arme : une attaque lente laisse plus de temps aux monstres, une rapide moins.
      const speed = this.weapon("melee")?.speed;
      this.actionCost = speed === "slow" ? RULES.slowAttackTurns : speed === "fast" ? RULES.fastAttackTurns : 1;
    }
    // Section 3 : la masse (toute arme qui assomme) fend les os et la pierre ; elle ou un critique brise le crâne.
    const blunt = !!this.weapon("melee")?.stunOn;
    const bdef = MONSTERS[monster.defId as keyof typeof MONSTERS] as MonsterDef | undefined;
    if (result.hit && blunt && bdef?.blunt) result = { ...result, damage: bdef.blunt === "double" ? result.damage * 2 : result.damage + bdef.blunt };
    monster.crush = result.critical || blunt;
    monster.struckUnaware = !monster.alerted || monster.asleep;
    monster.alerted = true;
    monster.asleep = false;
    this.struckByHero(monster, result.hit);
    const intact = monster.hp >= monster.maxHp;
    monster.hp -= result.damage;
    monster.heroHurt = true;
    this.noteBossHit(monster, result.damage);
    this.events.push({ type: "attack", attacker: this.hero, target: monster, result });
    // Arme lourde (épée longue) : un grand d20 assomme la cible, qui perd son prochain tour.
    const stunOn = this.weapon("melee")?.stunOn;
    if (result.hit && stunOn && result.d20 >= stunOn && monster.hp > 0 && !monster.boss) {
      monster.stunned = Math.max(monster.stunned ?? 0, 1);
      this.events.push({ type: "heavyBlow", actor: monster, kind: "stun" });
    }
    // Coup puissant (voie rouge, équilibrage du 2026-11-13) : un critique assomme aussi (pas le boss).
    if (result.critical && this.rank("coup_puissant") > 0 && monster.hp > 0 && !monster.boss && !(stunOn && result.d20 >= stunOn)) {
      monster.stunned = Math.max(monster.stunned ?? 0, 1);
      this.events.push({ type: "heavyBlow", actor: monster, kind: "stun" });
    }
    if (result.hit && intact && monster.hp <= 0 && !monster.boss) this.events.push({ type: "heavyBlow", actor: monster, kind: "oneShot" });
    // Coup critique : le monstre est PROJETÉ d'une case en arrière (Thomas, 2026-11-12), s'il reste debout.
    if (RULES.critKnockback && result.critical && monster.hp > 0 && !monster.boss) this.knockBack(monster);
    if (result.damage > 0) this.bleed(monster, this.hero);
    this.raiseAlarm(RULES.alarmCombat, monster);
    this.wakeNear(monster);
    // Arme enduite de poison (potion) : le coup qui porte empoisonne.
    if (result.hit && this.weaponPoison > 0 && monster.hp > 0) {
      this.weaponPoison--;
      this.poisonActor(monster, { damage: 1, turns: 4 });
    }
    // Potion glissante : le coup le fait glisser jusqu'au mur, où il rebondit et se cogne.
    if (result.hit && monster.hp > 0 && monster.slippery) this.slide(monster, this.hero);
    this.removeIfDead(monster);
    // Potion de vitesse : un second coup, s'il reste debout.
    if (!extra && this.hasteTurns > 0 && this.monsters.includes(monster)) this.heroAttacks(monster, true);
  }

  /**
   * Potion glissante (Thomas, 2026-11-13) : un coup reçu fait glisser le monstre loin de celui qui frappe, jusqu'à
   * `slipDistance` cases ; contre un mur (ou une porte fermée) il se cogne (1d4) et rebondit dans l'autre sens, au plus
   * `slipBounces` fois ; un autre personnage l'arrête net. Il peut finir sur un piège.
   */
  private slide(m: Actor, from: Point): void {
    let dx = Math.sign(m.x - from.x);
    let dy = Math.sign(m.y - from.y);
    if ((!dx && !dy) || m.petrified) return;
    const size = m.size ?? 1;
    const blockedBy = (x: number, y: number): "wall" | "actor" | null => {
      for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
          const cx = x + i;
          const cy = y + j;
          if (!this.map.isWalkable(cx, cy) || this.map.get(cx, cy) === Tile.DoorClosed) return "wall";
          const other = this.actorAt(cx, cy);
          if ((other && other !== m) || this.npcAt(cx, cy)) return "actor";
        }
      }
      return null;
    };
    const start = { x: m.x, y: m.y };
    const path: Point[] = [];
    let bumps = 0;
    let damage = 0;
    for (let k = 0; k < RULES.slipDistance; k++) {
      const nx = m.x + dx;
      const ny = m.y + dy;
      const stop = blockedBy(nx, ny) ?? (size === 1 && !canStep(this.map, m.x, m.y, dx, dy) ? "wall" : null);
      if (stop === "actor") break;
      if (stop === "wall") {
        bumps++;
        const d = rollDice(this.rng, RULES.slipWallDamage);
        damage += d;
        m.hp -= d;
        if (m.hp <= 0 || bumps > RULES.slipBounces) break;
        dx = -dx;
        dy = -dy;
        continue;
      }
      m.x = nx;
      m.y = ny;
      path.push({ x: nx, y: ny });
    }
    if (path.length === 0 && bumps === 0) return;
    this.closeDoorAt(start.x, start.y);
    this.events.push({ type: "slide", actor: m, fromX: start.x, fromY: start.y, x: m.x, y: m.y, bumps, damage, path });
    if (damage > 0) this.bleed(m, this.hero);
    if (m.hp > 0 && (m.x !== start.x || m.y !== start.y)) this.springTrap(m);
  }

  /** Projeté par un coup critique : une case dans l'axe du héros, si elle est libre ; il peut tomber sur un piège. */
  private knockBack(m: Actor): void {
    if (this.isInert(m)) return;
    const dx = Math.sign(m.x - this.hero.x);
    const dy = Math.sign(m.y - this.hero.y);
    const to = { x: m.x + dx, y: m.y + dy };
    const free = this.map.isWalkable(to.x, to.y) && this.map.get(to.x, to.y) !== Tile.DoorClosed && !this.actorAt(to.x, to.y) &&
      canStep(this.map, m.x, m.y, dx, dy) && !this.npcAt(to.x, to.y);
    if (!free) return;
    const from = { x: m.x, y: m.y };
    m.x = to.x;
    m.y = to.y;
    this.closeDoorAt(from.x, from.y);
    this.events.push({ type: "heavyBlow", actor: m, kind: "knockback", fromX: from.x, fromY: from.y });
    this.springTrap(m);
  }

  /**
   * Flèche de recul : le monstre recule de `steps` cases au plus, dans l'axe du tir, tant que la case suivante est libre
   * (ni mur, ni porte fermée, ni personnage). Il peut finir sur un piège.
   */
  private shoveBack(m: Actor, from: Point, steps: number): void {
    if (this.isInert(m) || m.petrified) return;
    const dx = Math.sign(m.x - from.x);
    const dy = Math.sign(m.y - from.y);
    if (!dx && !dy) return;
    const start = { x: m.x, y: m.y };
    for (let i = 0; i < steps; i++) {
      const to = { x: m.x + dx, y: m.y + dy };
      const free = this.map.isWalkable(to.x, to.y) && this.map.get(to.x, to.y) !== Tile.DoorClosed && !this.actorAt(to.x, to.y) &&
        canStep(this.map, m.x, m.y, dx, dy) && !this.npcAt(to.x, to.y);
      if (!free) break;
      m.x = to.x;
      m.y = to.y;
    }
    if (m.x === start.x && m.y === start.y) return;
    this.closeDoorAt(start.x, start.y);
    this.events.push({ type: "heavyBlow", actor: m, kind: "knockback", fromX: start.x, fromY: start.y });
    this.springTrap(m);
  }

  /** `byHero` faux : tué par un autre monstre (querelle) ; pas d'expérience pour le héros. */
  /** Les monstres à `reach` cases de ce point (potion, torche lancées) : touchés par le héros. */
  private markHeroHurt(at: Point, reach: number): void {
    for (const m of this.monsters) if (Math.max(Math.abs(m.x - at.x), Math.abs(m.y - at.y)) <= reach + (m.size ?? 1) - 1) m.heroHurt = true;
  }

  private removeIfDead(monster: Actor, byHero = true): void {
    if (monster.hp > 0) return;
    const sdef = MONSTERS[monster.defId as keyof typeof MONSTERS] as MonsterDef | undefined;
    // Kobold envahi (section 2) : le champignon le relève une fois, à moitié de ses PV, sauf s'il meurt en feu ; il reste
    // à terre 2 tours (le frapper alors l'achève pour de bon).
    // Squelette (section 3) : il s'effondre en tas d'os (la lune le relèvera), sauf crâne brisé (masse, critique, feu) ;
    // un tas d'os qu'on frappe encore est brisé pour de bon.
    const burnt = (monster.burning ?? 0) > 0 || this.isBurning(monster.x, monster.y);
    if (sdef?.bonePile && monster.pile === undefined && !monster.crush && !burnt && !this.current.restful) {
      monster.pile = sdef.bonePile;
      monster.hp = Math.ceil(monster.maxHp / 2);
      monster.prone = 1;
      monster.alerted = false;
      monster.asleep = false;
      monster.chanting = false;
      this.events.push({ type: "undead", actor: monster, what: "pile" });
      return;
    }
    if (sdef?.bonePile) this.events.push({ type: "undead", actor: monster, what: "crush" });
    if (sdef?.risesOnce && !monster.risen && !((monster.burning ?? 0) > 0) && !this.isBurning(monster.x, monster.y)) {
      monster.risen = true;
      monster.hp = Math.ceil(monster.maxHp / 2);
      monster.prone = 2;
      monster.alerted = true;
      monster.asleep = false;
      this.events.push({ type: "rise", actor: monster, what: "down" });
      return;
    }
    // Un Kobold mort dans les flammes laisse une escalope (Thomas, 2026-11-13).
    if ((monster.burning ?? 0) > 0 && !monster.boss && MONSTERS[monster.defId as keyof typeof MONSTERS]?.family === "kobolds") {
      this.dropItem(monster.x, monster.y, "escalope", 1);
    }
    this.monsters.splice(this.monsters.indexOf(monster), 1);
    this.closeDoorAt(monster.x, monster.y);
    // Le Colosse et ses morceaux (boss de la section 3).
    if (monster.defId === "colosse" || monster.defId === "brasColosse" || monster.defId === "craneColosse") this.colossusLoss(monster);
    // Le battant cassé : le Carillon ne sonne plus.
    if (monster.defId === "battant") {
      const bell = this.bossActor();
      if (bell?.boss) bell.boss.clapperUp = false;
      this.events.push({ type: "carillon", what: "clapper", actor: monster });
    }
    // Pas d'XP ni de victoire pour un monstre que le héros n'a jamais touché (piège, encre, spores, querelle…).
    if (!monster.heroHurt) byHero = false;
    if (byHero) this.perks().kills = (this.perks().kills ?? 0) + 1;
    // Soif de sang (voie rouge, Rang III) : un ennemi tué rend des PV, une fois par tour.
    const thirst = this.rank("soif_sang");
    if (byHero && thirst > 0 && this.thirstTurn !== this.turn && this.hero.hp > 0 && this.hero.hp < this.hero.maxHp) {
      this.thirstTurn = this.turn;
      const before = this.hero.hp;
      this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + (thirst >= 2 ? 3 : 2));
      this.events.push({ type: "power", power: "soif_sang", healed: this.hero.hp - before });
    }
    // Sporelin : il éclate en un nuage de spores (empoisonné) sur sa case et ses 4 voisines.
    if (sdef?.burstGas) {
      this.puffGas(monster, sdef.burstGas);
      this.events.push({ type: "burst", x: monster.x, y: monster.y });
    }
    // Kobold cueilleur : sa hotte tombe, avec des morilles.
    if (sdef?.dropsMorels) this.dropItem(monster.x, monster.y, "morille", this.rng.int(sdef.dropsMorels[0], sdef.dropsMorels[1]));
    this.events.push({ type: "death", actor: monster, fire: (monster.burning ?? 0) > 0 || undefined, unaware: (byHero && monster.struckUnaware) || undefined });
    // Butin : de l'expérience à coup sûr, parfois quelques pièces qui tombent au sol.
    const def = MONSTERS[monster.defId as keyof typeof MONSTERS];
    if (monster.purse) this.dropItem(monster.x, monster.y, "or", monster.purse);
    // L'or des monstres monte avec la section (2026-11-18, C : « or fixe à faire monter »).
    else if (def && this.rng.chance(def.goldChance)) this.dropItem(monster.x, monster.y, "or", lessGold(this.rng.int(1, def.goldMax) * (1 + sectionOf(this.depth))));
    // Le boss vaincu relève d'abord le niveau maximal : son XP compte.
    if (monster.boss) this.bossDefeated({ x: monster.x, y: monster.y });
    // Le Kobold du bain vaincu : sa dague tombe du porte-serviettes.
    if (monster.bather && this.current.bath) {
      this.current.bath.beaten = true;
      const rack = this.current.furniture.find((f) => f.kind === "towelRack");
      if (rack) {
        const at = this.landingCell(rack, "dague", rack);
        this.dropItem(at.x, at.y, "dague", 1);
        this.map.touch(rack.x, rack.y);
      }
    }
    if (def && byHero) {
      // XP encore divisée par deux (Thomas, 2026-11-12, soir : « je monte trop vite ») : les demi-points s'accumulent.
      this.xpCarry += this.rng.int(def.xpMin, def.xpMax) * RULES.xpGainFactor;
      const gain = Math.floor(this.xpCarry + 1e-9);
      this.xpCarry -= gain;
      if (gain > 0) this.gainXp(gain);
    }
    const q = this.quest;
    if (q && q.id === "gluck_rival" && q.target === monster.id) {
      this.events.push({ type: "quest", what: "lost", id: q.id });
      this.quest = null;
    }
    if (q && q.depth === this.depth && QUEST_TASKS[q.id].kind === "kill" && (QUEST_TASKS[q.id].targets === "squelettes" ? isSkeleton(monster) : isKobold(monster)) && q.got < q.need) {
      // Quêtes v3 : dans une zone, seuls ses Kobolds comptent (même tués par un autre, ou par un piège).
      if (QUEST_TASKS[q.id].zone) {
        if (this.current.zone?.sleepers.includes(monster.id)) q.got++;
      } else if (byHero) q.got++;
    }
    for (const o of this.monsters) if (o.feud === monster.id) o.feud = undefined;
  }

  /**
   * Tir à l'arc vers une case. La flèche file en ligne droite : elle s'arrête sur le premier monstre rencontré
   * (jet d'attaque), rebondit d'une case sur un mur, une colonne ou une porte fermée, ou se plante dans la case visée.
   */
  private heroShoots(target: Point): void {
    const profile = this.shotProfile();
    const ammo = this.currentAmmo();
    const endless = this.endlessAmmo(ammo);
    if (!profile || !ammo || (!endless && !this.inventory.take(ammo, 1))) return;
    const poison = (ITEMS[ammo] as ItemDef).poison;
    // Taché (crachat du Carillon) : ce tir-ci a le désavantage, puis c'est fini.
    const inked = this.inkBlind > 0;
    this.inkBlind = 0;
    this.reveal();
    const origin = { x: this.hero.x, y: this.hero.y };
    const trail: Point[] = [origin];
    let landing: Point = origin;
    let via: Point | undefined;
    let hit = false;
    let keepChance = RULES.arrowKeepOnScenery;
    let victim: Actor | undefined;
    let ricochet: { from: Point; target: Actor; result: ReturnType<typeof rollAttack> } | undefined;
    let missLine: { dx: number; dy: number; from: Point; next: number } | undefined;

    /** Avance d'une case ; renvoie faux si la flèche heurte un obstacle (et calcule alors le rebond). */
    const fly = (c: Point): boolean => {
      if (!this.map.isWalkable(c.x, c.y) || this.map.blocksSight(c.x, c.y)) {
        // Rebond : elle retombe une ou deux cases en arrière de l'endroit où elle a heurté l'obstacle.
        via = trail[trail.length - 1];
        const back = this.rng.int(RULES.arrowBounceMin, RULES.arrowBounceMax);
        landing = trail[Math.max(0, trail.length - 1 - back)];
        return false;
      }
      trail.push(c);
      landing = c;
      return true;
    };

    for (const c of lineBetween(origin, target)) {
      if (!fly(c)) break;
      victim = this.monsterAt(c.x, c.y);
      if (victim) break;
    }

    if (victim) {
      // Avantage sur une cible qui n'a rien vu ou prise dans une porte ; désavantage si un ennemi est au contact du tireur.
      // Une cible qu'on ne voit pas (tir à l'aveugle) : jamais d'avantage, et désavantage.
      const blind = !this.isVisible(victim.x, victim.y);
      // ARCHER et ŒIL DE LYNX (Elfe, à l'arc seulement) : pas de désavantage à l'aveugle ; avantage sur une cible lointaine.
      const bowShot = !profile.thrown;
      const favoured = !blind && (this.hasEdge(this.hero, victim) || (bowShot && this.lynxShot(victim)));
      // TIR AU CONTACT (Elfe, Thomas 2026-11-16) : à l'arc, un ennemi au contact ne gêne pas.
      const threatened = inked || (blind && !(bowShot && this.race.blindShot)) || (!(bowShot && this.race.closeShot) && this.monsters.some((m) => m.alerted && this.inReach(m, this.hero)));
      const mode = favoured && !threatened ? "advantage" : threatened && !favoured ? "disadvantage" : "normal";
      // Dans un couloir d'une case de large, la flèche n'a guère où passer à côté : bonus au jet.
      const open = (dx: number, dy: number) => this.map.isWalkable(victim!.x + dx, victim!.y + dy);
      const narrow = (!open(-1, 0) && !open(1, 0)) || (!open(0, -1) && !open(0, 1));
      // L'arc (ou la main qui lance) donne le jet ; la flèche (ou la javeline) donne les dégâts (Thomas, 2026-11-11).
      const attackBonus = profile.attackBonus + this.rangedBonus() + (bowShot ? this.race.bowBonus : 0) + (narrow ? RULES.narrowShotBonus : 0) + this.streakBonus();
      const ammoDamage = (ITEMS[ammo] as ItemDef).damage ?? UNARMED.damage;
      const shooter = { attackBonus, damage: { ...ammoDamage, bonus: ammoDamage.bonus + this.curseBonusOn(victim) }, grown: this.hero.grown };
      let result = rollAttack(this.rng, shooter, victim, mode, 20, () => this.useLuck(), () => this.useLuckyDie());
      // Têtu : le premier tir raté de l'étage est relancé.
      if (!result.hit && this.useStubborn()) result = rollAttack(this.rng, shooter, victim, mode, 20, () => this.useLuck(), () => this.useLuckyDie());
      this.noteHeroAttack(result.hit);
      if (result.hit) result = { ...result, damage: this.shotResist(victim, result.damage) };
      victim.crush = result.critical;
      victim.struckUnaware = !victim.alerted || victim.asleep;
      victim.alerted = true;
      victim.asleep = false;
      this.struckByHero(victim, result.hit);
      victim.hp -= result.damage;
      victim.heroHurt = true;
      this.noteBossHit(victim, result.damage);
      this.events.push({ type: "attack", attacker: this.hero, target: victim, result, ranged: true });
      if (result.damage > 0) this.bleed(victim, origin);
      hit = result.hit;
      // Potion glissante : la flèche le fait glisser.
      if (hit && victim.hp > 0 && victim.slippery) this.slide(victim, this.hero);
      if (hit && poison && victim.hp > 0) {
        // Un nouveau poison remet le compteur à zéro, il ne s'ajoute pas (C).
        this.poisonActor(victim, poison);
      }
      // Flèche de recul (Thomas, 2026-11-16) : la cible touchée recule, loin du tireur (pas un boss).
      const recoil = (ITEMS[ammo] as ItemDef).knockback;
      if (hit && recoil && victim.hp > 0 && !victim.boss) this.shoveBack(victim, origin, recoil);
      if (hit) {
        keepChance = RULES.arrowKeepOnHit;
        // Flèche ricochante (Thomas, 2026-11-15) : elle repart vers un autre monstre en vue, à 4 cases de la cible.
        if ((ITEMS[ammo] as ItemDef).ricochet) {
          const from = { x: victim.x, y: victim.y };
          const next = this.monsters
            .filter((m) => m !== victim && !m.boss && this.isVisible(m.x, m.y) && Math.max(Math.abs(m.x - from.x), Math.abs(m.y - from.y)) <= RULES.ricochetRange && hasLineOfSight(this.map, from, m))
            .sort((p, q) => Math.max(Math.abs(p.x - from.x), Math.abs(p.y - from.y)) - Math.max(Math.abs(q.x - from.x), Math.abs(q.y - from.y)))[0];
          if (next) {
            let second = rollAttack(this.rng, { attackBonus, damage: { ...ammoDamage, bonus: ammoDamage.bonus + this.curseBonusOn(next) }, grown: this.hero.grown }, next, "normal");
            if (second.hit) second = { ...second, damage: this.shotResist(next, second.damage) };
            this.struckByHero(next, second.hit);
            next.struckUnaware = !next.alerted || next.asleep;
            next.alerted = true;
            next.asleep = false;
            next.hp -= second.damage;
            next.heroHurt = true;
            ricochet = { from, target: next, result: second };
            if (second.damage > 0) this.bleed(next, from);
          }
        }
      } else {
        // Ratée : elle continue tout droit au-delà de la cible.
        keepChance = RULES.arrowKeepOnMiss;
        const dx = victim.x - origin.x;
        const dy = victim.y - origin.y;
        const n = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
        let k = 1;
        for (; k <= RULES.arrowOvershoot; k++) {
          if (!fly({ x: Math.round(victim.x + (dx / n) * k), y: Math.round(victim.y + (dy / n) * k) })) break;
        }
        missLine = { dx: dx / n, dy: dy / n, from: victim, next: k };
      }
    }

    // Flèche sans fin : elle ne se ramasse pas (le tirage a lieu quand même : le hasard des combats ne change pas).
    // La flèche enflammée se consume : elle ne se ramasse jamais.
    const kept = this.rng.chance(keepChance) && !endless && !(ITEMS[ammo] as ItemDef).ignites;
    // Ratée ET brisée (Thomas, 2026-11-16 : « remets certaines flèches manquées qui rebondissent derrière l'ennemi, mais
    // seulement celles qui se brisent ») : elle file plus loin derrière lui, et peut rebondir sur un mur. Celle qui
    // reste entière tombe juste derrière (on n'a pas à courir après).
    if (!kept && missLine && !via) {
      for (let k = missLine.next; k <= RULES.brokenArrowOvershoot; k++) {
        if (!fly({ x: Math.round(missLine.from.x + missLine.dx * k), y: Math.round(missLine.from.y + missLine.dy * k) })) break;
      }
    }
    // Orientation au sol : plantée dans le sens du tir, ou couchée de travers après un rebond.
    const end = trail[trail.length - 1];
    const flight = Math.atan2(end.y - origin.y, end.x - origin.x);
    const angle = via ? flight + Math.PI + (this.rng.next() - 0.5) * 2.2 : flight + (this.rng.next() - 0.5) * 0.3;
    const javelin = ammo === "javeline" || undefined;
    // Le lance-pierre du Halfelin (Thomas, 2026-11-16 : « il tire des pierres, pas des flèches ») : une pierre ne se
    // brise pas en morceaux (perdue, elle disparaît) et retombe à plat, sans orientation.
    const stone = (ITEMS[ammo] as ItemDef).ammoFamily === "pierre" || undefined;
    if (ricochet) landing = { x: ricochet.target.x, y: ricochet.target.y };
    // Flèche enflammée (Thomas, 2026-11-19) : le feu prend là où elle touche, ou là où elle tombe.
    if ((ITEMS[ammo] as ItemDef).ignites) {
      const at = hit && victim ? { x: victim.x, y: victim.y } : landing;
      if (this.map.get(at.x, at.y) !== Tile.Water && this.map.isWalkable(at.x, at.y)) {
        const old = this.fires.find((f) => f.x === at.x && f.y === at.y);
        if (old) old.turns = RULES.fireTurns;
        else this.fires.push({ x: at.x, y: at.y, turns: RULES.fireTurns });
        if (hit && victim) victim.burning = Math.max(victim.burning ?? 0, 2);
        this.igniteFurniture();
      }
    }
    if (kept) this.dropItem(landing.x, landing.y, ammo, 1, stone ? undefined : angle);
    else if (!stone && !endless) this.debris.push({ x: landing.x, y: landing.y, angle, until: this.turn + RULES.brokenArrowTurns, javelin });
    this.events.push({ type: "arrow", endless: endless || undefined, fromX: origin.x, fromY: origin.y, x: ricochet ? ricochet.from.x : landing.x, y: ricochet ? ricochet.from.y : landing.y, via, hit, kept: kept && !ricochet, javelin, stone, ammo, arrowKind: ARROW_KIND[ammo] });
    // Une flèche qui tombe sur une vesse-de-loup la crève (on peut les faire éclater de loin).
    const puffHit = this.puffballAt(landing.x, landing.y) ?? (via ? this.puffballAt(via.x, via.y) : null);
    if (puffHit) this.burstPuffball(puffHit);
    if (ricochet) {
      // Le ricochet : la flèche file de la première cible à la deuxième, puis tombe là.
      const r = ricochet;
      this.events.push({ type: "arrow", fromX: r.from.x, fromY: r.from.y, x: r.target.x, y: r.target.y, hit: r.result.hit, kept: false, ricochet: true, arrowKind: "ricochet" });
      this.events.push({ type: "attack", attacker: this.hero, target: r.target, result: r.result, ranged: true });
      this.removeIfDead(r.target);
    }
    if (victim) this.removeIfDead(victim);
    // Leurre : une flèche qui se plante dans une toile la fait vibrer ; la Tisseuse y accourt.
    else this.lureBoss(landing);
  }

  private dropItem(x: number, y: number, item: ItemId, count: number, angle?: number): void {
    noteUnique(item);
    // Rien ne reste sur un escalier : l'objet rebondit sur la marche et retombe à côté (Thomas, 2026-11-12).
    const t = this.map.get(x, y);
    // Une torche ne reste pas dans l'eau non plus (Thomas, 2026-11-12) : elle rebondit sur la berge.
    if (t === Tile.StairsDown || t === Tile.StairsUp || (item === "torche" && t === Tile.Water)) {
      const at = this.landingCell({ x, y }, item);
      if (at.x !== x || at.y !== y) {
        this.events.push({ type: "stairsBounce", item, fromX: x, fromY: y, x: at.x, y: at.y });
        x = at.x;
        y = at.y;
      }
    }
    // Un objet orienté (une flèche tombée) garde sa propre place au sol ; les autres s'empilent.
    const pile = angle === undefined ? this.ground.find((g) => g.x === x && g.y === y && g.item === item && g.angle === undefined) : undefined;
    if (pile) pile.count += count;
    else this.ground.push({ x, y, item, count, angle });
  }

  /** L'or se ramasse tout seul en marchant dessus, sans y passer de tour. */
  private collectGold(): void {
    for (const pile of this.itemsHere()) {
      const value = pile.item === "or" ? 1 : (ITEMS[pile.item] as ItemDef).value;
      if (!value) continue;
      // L'or et les gemmes vont tout seuls dans la bourse (une gemme vaut sa valeur en or).
      this.gold += pile.count * value;
      this.events.push({ type: "pickup", item: pile.item, count: pile.count });
      pile.count = 0;
    }
    this.ground = this.ground.filter((g) => g.count > 0);
  }

  /**
   * Le héros ramasse le premier objet de sa case (un seul tas à la fois), s'il a la place.
   * Renvoie vrai s'il reste sur la case un objet identique à ramasser au tour suivant.
   */
  private pickUpOne(): boolean {
    const pile = this.itemsHere().find((g) => g.item === this.pickingItem) ?? this.itemsHere()[0];
    if (!pile) return false;
    const item = pile.item;
    this.pickingItem = item;
    // Une clef garde la marque de son étage.
    const left = this.inventory.add(item, pile.count, ITEMS[item].kind === "key" ? this.depth : undefined);
    const taken = pile.count - left;
    pile.count = left;
    if (taken > 0) this.events.push({ type: "pickup", item, count: taken });
    // Sac plein : l'objet saute sur place et retombe (Thomas, 2026-11-12).
    else this.events.push({ type: "bagFull", item, x: this.hero.x, y: this.hero.y, messy: this.inventory.fitsIfTidied(item) });
    if (taken > 0 && this.equipAfterPick) {
      this.equipAfterPick = false;
      const mine = this.inventory.items.filter((i) => i.defId === item).sort((a, b) => b.uid - a.uid)[0];
      const ok = !!mine && this.equip(mine.uid);
      this.events.push({ type: "pickEquip", item, ok });
      if (ok) {
        this.ground = this.ground.filter((g) => g.count > 0);
        return false;
      }
    }
    this.ground = this.ground.filter((g) => g.count > 0);
    return left === 0 && this.itemsHere().some((g) => g.item === item);
  }

  private monstersAct(): void {
    // Les monstres ne contournent plus les pièges, même cachés (Thomas, 2026-11-14 : « les mobs marchent dans les
    // pièges, y compris invisibles ») : celui qui arrive sur un piège le déclenche.
    const before = new Map(this.monsters.map((m) => [m, m.x * 100000 + m.y] as const));
    this.monstersActInner();
    for (const [m, at] of before) {
      if (this.over || !this.monsters.includes(m) || m.boss || at === m.x * 100000 + m.y) continue;
      if (this.isTrap(m.x, m.y)) this.springTrap(m);
      const puff = this.puffballAt(m.x, m.y);
      if (puff) this.burstPuffball(puff);
      // Un monstre qui marche sur le gravier ou dans l'eau fait du bruit aussi (Thomas, 2026-11-11 : « pas encore ») : on
      // l'entend s'approcher, même hors de vue (« Crik », « Plic » au-dessus de sa case).
      const t = this.map.get(m.x, m.y);
      if ((t === Tile.Gravel || t === Tile.Water) && gapBetween(m, this.hero) <= RULES.gravelHearing) {
        this.events.push({ type: "gravel", x: m.x, y: m.y, alerted: 0, water: t === Tile.Water, monster: true });
      }
    }
  }

  private monstersActInner(): void {
    for (const m of [...this.monsters]) {
      if (this.over) return;
      if (!this.monsters.includes(m)) continue;
      if ((m.grown ?? 0) > 0 && --m.grown! === 0) this.events.push({ type: "grow", actor: m, back: true });
      if (m.boss) {
        // Potion de pierre lancée sur la Tisseuse : sa carapace se fige un court instant.
        if (m.petrified) {
          m.petrified--;
          if (m.petrified === 0) this.thaw(m);
          continue;
        }
        if (m.defId === "carillon") this.carillonAct(m);
        else if (m.defId === "pretresse") this.priestessAct(m);
        else this.bossAct(m);
        continue;
      }
      // Le Colosse ne bouge pas : ses bras frappent, son crâne tire ; ses morceaux cassés se ressoudent dans la lune.
      if (m.defId === "colosse") {
        this.colossusAct(m);
        continue;
      }
      if (m.defId === "craneColosse") {
        const beam = MONSTERS.craneColosse.beam;
        if (m.stunned) m.stunned--;
        else if (m.petrified) {
          if (--m.petrified === 0) this.thaw(m);
        } else if (m.beam) this.fireBeam(m, beam);
        else this.chargeBeam(m, beam);
        continue;
      }
      if (m.defId === "brasColosse") {
        if (!m.stunned && !m.petrified && gapBetween(m, this.hero) <= 1 && !this.over) this.monsterStrikes(m);
        else if (m.stunned) m.stunned--;
        else if (m.petrified && --m.petrified === 0) this.thaw(m);
        continue;
      }
      // Le battant du Carillon ne fait rien.
      if (this.isInert(m)) continue;
      // Abrité de l'onde du Carillon : il attend que ça passe.
      if (m.cower) {
        m.cower--;
        continue;
      }
      // Section 3 : le tas d'os attend la lune ; le gisant couché attend qu'elle le touche.
      if (m.pile !== undefined) {
        this.pileAct(m);
        continue;
      }
      if (m.effigy) {
        this.effigyWakes(m);
        continue;
      }
      if (m.prone) {
        // Renversé : il passe son tour à se relever (pas dans le tour même où il est tombé).
        if (m.proneSince === this.turn) continue;
        m.prone--;
        if (m.prone === 0) this.events.push(m.risen && m.defId === "envahi" && !m.riseShown ? { type: "rise", actor: m, what: "up" } : { type: "getUp", actor: m });
        if (m.prone === 0 && m.risen) m.riseShown = true;
        continue;
      }
      if (m.stunned) {
        // Sonné par une poussée : il perd ce tour.
        m.stunned--;
        continue;
      }
      // Fidèle du Carillon : le battant est tombé, il va le remettre.
      if (m.defId === "fidele" && this.fideleRepair(m)) continue;
      // Section 3 : le gisant hors de la lune se recouche ; le rat dévore ; l'acolyte chante.
      const odef = MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef;
      if (odef.effigy && this.effigyRests(m)) continue;
      if (odef.eatsFood && this.ratEats(m)) continue;
      if (odef.chanter && this.chantAct(m)) continue;
      if (odef.beam && m.beam) {
        this.fireBeam(m, odef.beam);
        continue;
      }
      if (m.slowed) {
        // Ralenti (bousculade) : il ne joue qu'un tour sur deux.
        m.slowed--;
        if (m.slowed % 2 === 0) continue;
      }
      // Pétrifié (potion de pierre lancée) : il ne fait rien, puis redevient lui-même.
      if (m.petrified) {
        m.petrified--;
        if (m.petrified === 0) this.thaw(m);
        continue;
      }
      if (m.feud !== undefined && this.feudAct(m)) continue;
      if (m.soapy) m.soapy--;
      if (m.cowed) m.cowed--;
      const sdef = MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef;
      // Myconide : lent, il ne joue qu'un tour sur deux.
      // Lent, sauf blessé à mort (Thomas, 2026-11-19 : « augmenter la difficulté du champignon ») : sous la moitié de sa
      // vie, le myconide s'emballe et joue à chaque tour.
      if (sdef.slow && m.hp * 2 > m.maxHp && (this.turn + m.id) % 2 === 0) continue;
      // Myconide : aveugle, il sent les pas (à travers les murs) ; un héros immobile 2 tours, il le perd.
      if (sdef.tremorSense && !this.peaceful && this.tremorAct(m, sdef.tremorSense)) continue;
      // Le héros est une statue : on perd sa trace, on erre.
      if (this.stoneTurns > 0) {
        m.alerted = false;
        m.wary = false;
        if (!m.asleep) this.wander(m);
        continue;
      }
      // Pris dans le brouillard (Thomas, 2026-11-13) : il ne voit plus rien, erre au hasard dans la nappe et ne frappe
      // personne jusqu'à ce qu'elle se dissipe ; deux monstres qui s'y cognent peuvent en venir aux mains.
      if (!m.boss && this.fogAt(m.x, m.y)) {
        m.alerted = false;
        m.wary = false;
        m.goal = undefined;
        const other = this.monsters.find((o) => o !== m && !o.boss && o.feud === undefined && this.fogAt(o.x, o.y) && gapBetween(o, m) <= 1);
        if (other && this.rng.chance(RULES.fogBrawlChance)) {
          this.startFeud(m, other, "fog");
          continue;
        }
        const steps: Point[] = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = m.x + dx;
            const y = m.y + dy;
            if ((dx || dy) && canStep(this.map, m.x, m.y, dx, dy) && this.fogAt(x, y) && !this.actorAt(x, y) && !this.npcAt(x, y) && !this.map.isDoor(x, y)) steps.push({ x, y });
          }
        }
        if (steps.length > 0 && this.rng.chance(0.7)) {
          const to = steps[this.rng.int(0, steps.length - 1)];
          this.faceToward(m, to);
          m.x = to.x;
          m.y = to.y;
        }
        continue;
      }
      // Le Kobold du bain, blessé : il s'enfuit en hurlant, et ses camarades accourent (Thomas, 2026-11-13).
      if (m.bather && !m.fleeing && m.alerted && m.hp * 2 < m.maxHp) {
        m.fleeing = true;
        this.raiseAlarm(RULES.bathFleeAlarm, m);
        this.callFoes(m, "schrat", 1);
        this.events.push({ type: "bath", what: "flee", x: m.x, y: m.y });
      }
      // Un Kobold mal en point prend parfois la fuite (Thomas, 2026-11-13) : une fois, sous le tiers de ses PV, un tirage ;
      // il détale quelques tours, puis revient.
      if (!m.bather && !m.boss && (m.defId === "schrat" || m.defId === "frondeur") && m.alerted && !m.fleeChecked && m.hp * 3 <= m.maxHp) {
        m.fleeChecked = true;
        if (this.rng.chance(RULES.koboldFleeChance)) {
          m.fleeTurns = RULES.koboldFleeTurns;
          this.events.push({ type: "flee", actor: m });
        }
      }
      if (m.fleeTurns || m.fleeing) {
        if (m.fleeTurns) m.fleeTurns--;
        const away = this.fleeStep(m) ?? this.stepAway(m);
        if (away) {
          const left = { x: m.x, y: m.y };
          const near = this.heroReaches(m);
          this.faceToward(m, away);
          m.x = away.x;
          m.y = away.y;
          this.closeDoorAt(left.x, left.y);
          this.heroOpportunity(m, near);
        }
        continue;
      }
      // Les combattants du tripot de Fifrelin ne s'occupent pas du héros, sauf s'il s'en mêle (il les a frappés).
      if (m.arena && m.arena !== "duel" && !m.alerted) continue;
      const dx = this.hero.x - m.x;
      const dy = this.hero.y - m.y;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));

      // Salle d'essai, combats coupés : personne ne remarque le héros, personne ne l'attaque.
      if (this.peaceful) m.alerted = false;
      if (!m.alerted && !this.peaceful) {
        const def = MONSTERS[m.defId as keyof typeof MONSTERS];
        const chance =
          def.noticeChance *
          (this.heroInLight() ? RULES.noticeInLight : RULES.noticeInDark) *
          (m.asleep ? RULES.noticeAsleep : RULES.noticeAwake) *
          (this.onRug() ? RULES.rugNotice : 1);
        // Caché, le héros ne peut être remarqué que par un monstre arrivé à son contact. Endormi, il n'entend que de
        // près ; éveillé, il ne voit que dans l'éventail devant lui (celui qu'on dessine), ou au contact.
        const range = m.asleep && m.deaf ? 0 : this.hidden || this.fogAt(this.hero.x, this.hero.y) ? 1 : m.asleep ? Math.min(m.vision, RULES.asleepHearing) : m.vision;
        const inSight = distance <= 1 || ((m.asleep || this.inGaze(m, this.hero)) && !this.fogBetween(m, this.hero));
        if (this.isVisible(m.x, m.y) && distance <= range && inSight && this.rng.chance(chance)) {
          this.faceToward(m, this.hero);
          m.alerted = true;
          m.asleep = false;
          this.events.push({ type: "noticed", actor: m });
          this.raiseAlarm(RULES.alarmNoticed);
          this.reveal();
          // Kobold cueilleur : il siffle l'alerte, une fois.
          const whistle = (MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef).alarmOnNotice;
          if (whistle && !m.whistled) {
            m.whistled = true;
            this.raiseAlarm(whistle, m);
            this.events.push({ type: "whistle", actor: m });
          }
        } else if (!m.asleep) {
          this.wander(m);
        }
        continue;
      }

      // Kobold frondeur : il tire de loin et garde ses distances (recule, de préférence près d'une colonne ou d'un meuble).
      const slinger = (MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef).sling;
      if (slinger && this.slingerAct(m, slinger, distance)) continue;
      // Crâne lunaire : aligné avec le héros, il se charge (la ligne s'allume), et tire au tour suivant.
      const beamer = (MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef).beam;
      if (beamer && this.chargeBeam(m, beamer)) continue;

      if (this.inReach(m, this.hero)) {
        // Embuscade : le monstre a l'avantage sur un héros pris dans une porte, ou qu'il frappe au coin d'un mur.
        // Jamais deux avantages de suite sur le héros (Thomas) : après un coup avec avantage, il se reprend.
        const ambush = this.hasEdge(m, this.hero);
        this.faceToward(m, this.hero);
        // Savonneux (sorti du bain) : il glisse, désavantage.
        // Cri de guerre : le monstre impressionné frappe avec le désavantage, comme savonneux.
        const soapy = (m.soapy ?? 0) > 0 || (m.cowed ?? 0) > 0;
        // Garde (voie bleue, Rang II) : +CA quand deux ennemis ou plus le touchent.
        const result = rollAttack(this.rng, m, { armorClass: this.hero.armorClass + this.guardBonus() + this.undeadWard(m) }, ambush && !soapy ? "advantage" : soapy && !ambush ? "disadvantage" : "normal");
        result.damage = this.absorb(result.damage);
        if (m.bather && result.hit && this.rng.chance(RULES.towelBlindChance)) {
          // Un coup de serviette dans la figure : le prochain coup du héros a le désavantage.
          this.towelBlind = 1;
          this.events.push({ type: "bath", what: "towel", x: this.hero.x, y: this.hero.y });
        }
        // Morsure d'araignée : parfois elle englue (le héros perd son prochain déplacement).
        const bite = MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef;
        if (result.damage > 0 && bite.webBite && this.rng.chance(bite.webBite)) {
          this.hero.stuck = Math.max(this.hero.stuck ?? 0, 1);
          this.events.push({ type: "webbed", by: m });
        }
        // Le monstre a rattrapé le héros : le combat reprend normalement.
        m.wary = false;
        this.events.push({ type: "attack", attacker: m, target: this.hero, result });
        if (result.damage > 0) this.bleed(this.hero, m);
        // Bastion (voie bleue, Rang III) : qui touche le héros au contact recule d'une case.
        if (result.damage > 0 && this.bastionActive() && !m.boss && (m.size ?? 1) === 1) this.knockBack(m);
        this.raiseAlarm(RULES.alarmCombat, this.hero);
        this.wakeNear(this.hero);
        this.hurtHero(result.damage, this.killerName(m));
        if (!result.hit) this.riposte(m);
        // Potion d'oursin (Thomas, 2026-11-12, soir) : 15 % des dégâts reçus au contact reviennent à l'attaquant.
        if (this.urchinTurns > 0 && result.damage > 0 && !this.over) {
          const back = Math.max(1, Math.round(result.damage * RULES.urchinReflect));
          m.hp -= back;
          m.heroHurt = true;
          this.events.push({ type: "thorns", actor: m, damage: back });
          this.removeIfDead(m);
        }
        continue;
      }

      // L'araignée fond sur sa proie : deux pas par tour (elle s'arrête si elle arrive au contact).
      const steps = (MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef).chaseSteps ?? 1;
      const before = { x: m.x, y: m.y };
      const shuns = !!(MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef).shunsMoon;
      for (let i = 0; i < steps && !this.inReach(m, this.hero); i++) {
        const prev = { x: m.x, y: m.y };
        if (!this.stepToward(m, this.hero)) break;
        // Le rat d'ossuaire n'entre pas dans la lumière de la lune : on s'y abrite.
        if (shuns && this.moonlit(m) && !this.moonlit(prev)) {
          m.x = prev.x;
          m.y = prev.y;
          break;
        }
      }
      // Il tourne un angle de mur derrière lequel le héros attend : il arrive en regardant devant lui, pas vers le héros
      // (Thomas, 2026-11-15) ; le héros l'aura avec l'avantage (embuscade).
      const moved = m.x !== before.x || m.y !== before.y;
      if (moved && !hasClearSight(this.map, before, this.hero)) this.faceToward(m, { x: m.x + Math.sign(m.x - before.x), y: m.y + Math.sign(m.y - before.y) });
      else this.faceToward(m, this.hero);
    }
  }

  /**
   * Tour d'un tireur (Kobold frondeur, Thomas 2026-11-11) : trop près, il recule d'une case (vers un abri si possible) ;
   * à portée et en vue, il tire ; sinon il s'approche (renvoie faux : le tour ordinaire d'un monstre s'applique).
   */
  private slingerAct(m: Actor, sling: NonNullable<MonsterDef["sling"]>, distance: number): boolean {
    const hero = this.hero;
    // Le héros hors de vue (derrière un mur, une porte, une colonne) : le frondeur le suit pour le retrouver
    // (Thomas, 2026-11-12, soir : « s'il se retire derrière un mur, une porte ou un poteau, ils suivent et tentent de se
    // rapprocher » ; remplace « il garde sa place »). Le tour ordinaire d'un monstre s'applique : il marche vers lui.
    const sees = hasLineOfSight(this.map, m, hero) && this.isVisible(m.x, m.y) && !this.fogBetween(m, hero);
    if (!sees && !this.inReach(m, hero)) return false;
    if (distance < sling.keep) {
      const away = this.stepAway(m);
      if (away) {
        const left = { x: m.x, y: m.y };
        const near = this.heroReaches(m);
        this.faceToward(m, hero);
        m.x = away.x;
        m.y = away.y;
        this.closeDoorAt(left.x, left.y);
        this.heroOpportunity(m, near);
        return true;
      }
      // Acculé : au contact il se défend à la dague, sinon il tire quand même.
      if (this.inReach(m, hero)) return false;
    }
    if (distance > sling.range || !hasLineOfSight(this.map, m, hero) || !this.isVisible(m.x, m.y) || this.fogBetween(m, hero)) return false;
    this.faceToward(m, hero);
    // Un autre monstre sur la trajectoire (Thomas, 2026-11-12) : c'est lui qui prend la pierre, et il peut le prendre mal.
    const inTheWay = this.lineCells(m, hero).map((c) => this.monsterAt(c.x, c.y)).find((o) => o && o !== m && !o.boss);
    if (inTheWay) {
      const shot = rollAttack(this.rng, { attackBonus: sling.attackBonus, damage: sling.damage }, inTheWay, "normal");
      inTheWay.hp -= shot.damage;
      inTheWay.asleep = false;
      this.events.push({ type: "infight", attacker: m, target: inTheWay, hit: shot.hit, damage: shot.damage, ranged: true });
      if (shot.damage > 0) this.bleed(inTheWay, m);
      if (inTheWay.hp <= 0) this.removeIfDead(inTheWay, false);
      else if (shot.hit && inTheWay.feud === undefined && m.feud === undefined && this.rng.chance(RULES.feudShotChance)) this.startFeud(inTheWay, m, "shot");
      return true;
    }
    // Le héros caché derrière une colonne ou un meuble, ou dans le noir : la pierre a du mal à l'atteindre.
    const covered = this.hasCover(hero) && !this.inReach(m, hero);
    const cowed = (m.cowed ?? 0) > 0;
    const result = rollAttack(this.rng, { attackBonus: sling.attackBonus, damage: sling.damage }, { armorClass: hero.armorClass + this.stanceBonus() + this.undeadWard(m) }, covered || cowed ? "disadvantage" : "normal");
    result.damage = this.absorb(result.damage);
    this.events.push({ type: "attack", attacker: m, target: hero, result, ranged: true });
    if (result.damage > 0) this.bleed(hero, m);
    this.raiseAlarm(RULES.alarmCombat, hero);
    this.hurtHero(result.damage, this.killerName(m));
    return true;
  }

  /** Les cases traversées en ligne droite de `a` à `b`, sans les deux bouts (tracé de Bresenham). */
  private lineCells(a: Point, b: Point): Point[] {
    const cells: Point[] = [];
    let x = a.x;
    let y = a.y;
    const dx = Math.abs(b.x - a.x);
    const dy = -Math.abs(b.y - a.y);
    const sx = a.x < b.x ? 1 : -1;
    const sy = a.y < b.y ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 64; guard++) {
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
      if (x === b.x && y === b.y) break;
      cells.push({ x, y });
    }
    return cells;
  }

  /** Une case voisine qui éloigne le monstre du héros, de préférence collée à un abri (colonne, meuble). */
  /** Le frondeur recule d'un pas : la case voisine la plus loin du héros à vol d'oiseau (pour garder sa portée). */
  private stepAway(m: Actor): Point | null {
    const d0 = Math.max(Math.abs(m.x - this.hero.x), Math.abs(m.y - this.hero.y));
    let best: Point | null = null;
    let bestScore = -Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = m.x + dx;
        const y = m.y + dy;
        if (!canStep(this.map, m.x, m.y, dx, dy) || this.actorAt(x, y) || this.isBurning(x, y) || this.map.isDoor(x, y)) continue;
        const d = Math.max(Math.abs(x - this.hero.x), Math.abs(y - this.hero.y));
        if (d <= d0) continue;
        const shelter = this.hasCover({ x, y }) ? 3 : 0;
        const score = d * 10 + shelter;
        if (score > bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    return best;
  }

  /** Un fuyard s'éloigne d'un pas. */
  private fleeStep(m: Actor): Point | null {
    // La fuite passe les portes et contourne les coins (Thomas, 2026-11-13 : « la fuite ne passe pas les portes ») :
    // on vise, à quelques pas, la case la plus éloignée du héros EN CHEMIN À PIED (pas à vol d'oiseau), puis on fait
    // le premier pas vers elle.
    const free = (x: number, y: number) => !this.isTrap(x, y) && !this.isBurning(x, y);
    const fromHero = distanceField(this.map, this.hero, free);
    const fromMe = distanceField(this.map, m, (x, y) => free(x, y) && !(x === this.hero.x && y === this.hero.y) && !this.actorAt(x, y));
    const here = fromHero[this.map.index(m.x, m.y)];
    let target = -1;
    let best = here;
    for (let i = 0; i < fromMe.length; i++) {
      const steps = fromMe[i];
      if (steps <= 0 || steps > RULES.fleeLookAhead || fromHero[i] < 0) continue;
      // Plus loin du héros ; à égalité, le moins de pas.
      const score = fromHero[i] * 4 - steps;
      if (fromHero[i] > here && score > best * 4) {
        best = fromHero[i];
        target = i;
      }
    }
    if (target < 0) return null;
    const tx = target % this.map.width;
    const ty = (target - tx) / this.map.width;
    const back = distanceField(this.map, { x: tx, y: ty }, (x, y) => free(x, y) && !this.actorAt(x, y) || (x === m.x && y === m.y));
    let step: Point | null = null;
    let stepDist = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = m.x + dx;
        const y = m.y + dy;
        if (!canStep(this.map, m.x, m.y, dx, dy) || this.actorAt(x, y) || this.npcAt(x, y) || !free(x, y)) continue;
        const d = back[this.map.index(x, y)];
        if (d >= 0 && d < stepDist) {
          stepDist = d;
          step = { x, y };
        }
      }
    }
    return step;
  }

  /** Le héros est-il dans l'éventail de regard de ce monstre (devant lui, à moins de `gazeHalfAngle`) ? */
  inGaze(m: Actor, p: Point): boolean {
    const dx = p.x - m.x;
    const dy = p.y - m.y;
    if (dx === 0 && dy === 0) return true;
    const facing = m.facing ?? "down";
    const look = facing === "right" ? 0 : facing === "down" ? Math.PI / 2 : facing === "left" ? Math.PI : -Math.PI / 2;
    let diff = Math.atan2(dy, dx) - look;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return Math.abs(diff) <= RULES.gazeHalfAngle + 1e-9;
  }

  /** Tourne un personnage vers une case (la direction dominante). */
  private faceToward(a: Actor, p: Point): void {
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    if (dx === 0 && dy === 0) return;
    a.facing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  }

  /** Avance un monstre d'une case vers une destination, en ouvrant les portes. Renvoie faux s'il n'y a pas de chemin. */
  private stepToward(m: Actor, target: Point): boolean {
    const allowed = this.avoidTraps(target, undefined, m);
    let step = findPath(this.map, m, target, allowed)?.[0];
    if (!step) return false;
    // Un autre devant lui (couloir de deux de large, Thomas 2026-11-19 : « les mobs restent l'un derrière l'autre ») :
    // il prend une case libre à côté qui le rapproche autant (de préférence plus) de sa destination, pour se mettre
    // de front au lieu d'attendre en file.
    if ((this.actorAt(step.x, step.y) || this.npcAt(step.x, step.y)) && m.size === undefined) {
      const field = distanceField(this.map, target, allowed, m);
      const here = field[this.map.index(m.x, m.y)];
      let best: Point | null = null;
      let bestD = here;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = m.x + dx;
          const y = m.y + dy;
          if ((!dx && !dy) || !canStep(this.map, m.x, m.y, dx, dy) || !this.map.isWalkable(x, y) || this.actorAt(x, y) || this.npcAt(x, y) || this.map.isDoor(x, y)) continue;
          const d = field[this.map.index(x, y)];
          if (d >= 0 && d < bestD) {
            best = { x, y };
            bestD = d;
          }
        }
      }
      if (best) step = best;
    }
    const blocker = this.monsterAt(step.x, step.y);
    if (blocker && blocker !== m) this.noteBlocked(m, blocker);
    else {
      m.blockedBy = undefined;
      m.blockedTurns = 0;
    }
    // Gluck (quête 01) occupe sa case : les monstres le contournent.
    if (!this.actorAt(step.x, step.y) && !this.npcAt(step.x, step.y)) {
      const left = { x: m.x, y: m.y };
      const doorMoved = this.map.get(step.x, step.y) === Tile.DoorClosed || this.map.get(left.x, left.y) === Tile.DoorOpen;
      this.faceToward(m, step);
      m.x = step.x;
      m.y = step.y;
      this.openDoorAt(m.x, m.y);
      this.closeDoorAt(left.x, left.y);
      if (doorMoved) this.updateVision();
    }
    return true;
  }

  /**
   * Deux monstres qui se bloquent mutuellement (face à face dans un couloir) finissent par se battre (Thomas,
   * 2026-11-12). Pas le boss, pas un monstre qui traque le héros au contact.
   */
  private noteBlocked(m: Actor, other: Actor): void {
    m.blockedTurns = m.blockedBy === other.id ? (m.blockedTurns ?? 0) + 1 : 1;
    m.blockedBy = other.id;
    if (m.boss || other.boss || m.feud !== undefined || other.feud !== undefined) return;
    if (other.blockedBy === m.id && (m.blockedTurns ?? 0) >= RULES.feudBlockedTurns && (other.blockedTurns ?? 0) >= RULES.feudBlockedTurns - 1) {
      this.startFeud(m, other, "blocked");
    }
  }

  /**
   * Araignées contre Kobolds (Thomas, 2026-11-13 : « mettre en scène, que le joueur le voie ») : de temps en temps, quand
   * le héros voit une araignée et un Kobold proches l'un de l'autre, l'araignée se jette sur lui. Au plus
   * `speciesBrawlsPerFloor` fois par étage ; jamais un monstre qui traque le héros au contact.
   */
  private speciesBrawl(): void {
    const st = this.current;
    if (this.over || st.boss || this.peaceful || (st.brawls ?? 0) >= RULES.speciesBrawlsPerFloor) return;
    const free = (m: Actor) => !m.boss && !m.bather && m.feud === undefined && !m.petrified && this.isVisible(m.x, m.y) && !(m.alerted && this.inReach(m, this.hero));
    const spiders = this.monsters.filter((m) => MONSTERS[m.defId as keyof typeof MONSTERS]?.family === "araignées" && free(m));
    const kobolds = this.monsters.filter((m) => MONSTERS[m.defId as keyof typeof MONSTERS]?.family === "kobolds" && free(m));
    for (const s of spiders) {
      const k = kobolds.find((o) => gapBetween(o, s) <= RULES.speciesBrawlRange);
      if (!k || !this.rng.chance(RULES.speciesBrawlChance)) continue;
      st.brawls = (st.brawls ?? 0) + 1;
      s.asleep = k.asleep = false;
      this.startFeud(s, k, "species");
      return;
    }
  }

  private startFeud(a: Actor, b: Actor, reason: "blocked" | "shot" | "fog" | "discord" | "species" | "bout"): void {
    a.feud = b.id;
    b.feud = a.id;
    a.blockedBy = b.blockedBy = undefined;
    a.blockedTurns = b.blockedTurns = 0;
    this.events.push({ type: "feud", a, b, reason });
  }

  /** Tour d'un monstre en pleine querelle : il frappe son rival s'il le touche, sinon il va vers lui. */
  private feudAct(m: Actor): boolean {
    const foe = this.monsters.find((o) => o.id === m.feud);
    if (!foe) {
      m.feud = undefined;
      return false;
    }
    // Le héros au contact et repéré : on règle d'abord son compte au héros.
    if (m.alerted && this.inReach(m, this.hero)) return false;
    if (!this.inReach(m, foe)) {
      if (!this.stepToward(m, foe)) m.feud = undefined;
      return true;
    }
    this.faceToward(m, foe);
    const result = rollAttack(this.rng, m, foe, "normal");
    foe.hp -= result.damage;
    foe.asleep = false;
    if (foe.feud === undefined) foe.feud = m.id;
    this.events.push({ type: "infight", attacker: m, target: foe, hit: result.hit, damage: result.damage });
    if (result.damage > 0) this.bleed(foe, m);
    this.raiseAlarm(RULES.alarmCombat, foe);
    if (foe.hp <= 0) {
      this.removeIfDead(foe, false);
      m.feud = undefined;
    }
    return true;
  }

  /** Promenade : le monstre va de salle en salle, au hasard. */
  private wander(m: Actor): void {
    // Il vient de perdre la trace du héros caché : il reste là, il regarde autour de lui.
    if (m.lost) {
      m.lost--;
      if (this.rng.chance(0.5)) this.faceToward(m, { x: m.x + this.rng.int(-1, 1), y: m.y + this.rng.int(-1, 1) });
      return;
    }
    if (!m.goal || (m.goal.x === m.x && m.goal.y === m.y)) {
      if (m.patrol) {
        // Ronde : une case libre au hasard de sa salle.
        const r = m.patrol;
        const x = this.rng.int(r.x, r.x + r.w - 1);
        const y = this.rng.int(r.y, r.y + r.h - 1);
        if (!this.map.isWalkable(x, y)) return;
        m.goal = { x, y };
      } else {
        const room = this.rooms[this.rng.int(0, this.rooms.length - 1)];
        m.goal = { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
      }
    }
    // Destination inaccessible (salle verrouillée) : il en choisira une autre au tour suivant.
    if (!this.stepToward(m, m.goal)) m.goal = undefined;
  }

  private updateVision(): void {
    // Une porte ouverte ou fermée depuis le dernier calcul : la lumière se refait (sinon elle passerait encore, ou plus,
    // par cette porte, et une partie reprise ne verrait pas la même chose).
    if (this.map.version !== this.lightVersion) this.refreshLight();
    this.visionVersion = this.map.version;
    this.visible = computeFov(this.map, this.hero, this.race.darkVision, this.race.sight, this.light);
    this.completeCorners();
    for (let i = 0; i < this.visible.length; i++) {
      if (this.visible[i]) this.explored[i] = 1;
    }
    this.revealPillarPockets();
    // Le poulet qui court : lui et les cases autour se voient, même dans le noir.
    const hen = this.chickenLight;
    if (hen) {
      for (let dy = -RULES.chickenGlowRadius; dy <= RULES.chickenGlowRadius; dy++)
        for (let dx = -RULES.chickenGlowRadius; dx <= RULES.chickenGlowRadius; dx++) {
          const x = hen.x + dx;
          const y = hen.y + dy;
          if (!this.map.inBounds(x, y) || !hasLineOfSight(this.map, hen, { x, y })) continue;
          const i = this.map.index(x, y);
          this.visible[i] = 1;
          this.explored[i] = 1;
        }
    }
    this.senseBeyond();
    // Après les cases devinées : on ne devine rien plus loin dans la pièce secrète que ce que montre le creux.
    this.peekSecret();
    // Un monstre qui entre dans le champ de vision interrompt le déplacement en cours.
    for (const m of this.visibleMonsters()) {
      if (!this.seenMonsters.has(m.id)) {
        this.seenMonsters.add(m.id);
        this.path = [];
        this.targetId = null;
        this.doorTarget = null;
      }
    }
  }

  /**
   * Le creux du mur de la pièce secrète (Thomas, 2026-11-14 : « à moins de 3 cases de certains creux, on voit quelques
   * tuiles derrière le mur ») : quand on le voit d'assez près, les cases derrière lui se voient aussi.
   */
  private peekSecret(): void {
    const s = this.current?.secretRoom;
    if (!s || s.found || !this.visible[this.map.index(s.peek.x, s.peek.y)]) return;
    if (Math.max(Math.abs(this.hero.x - s.peek.x), Math.abs(this.hero.y - s.peek.y)) > RULES.secretPeekRange) return;
    for (const p of s.view) {
      const i = this.map.index(p.x, p.y);
      this.visible[i] = 1;
      this.explored[i] = 1;
    }
    if (!s.glimpsed) {
      s.glimpsed = true;
      this.events.push({ type: "secret", what: "glimpse", x: s.peek.x, y: s.peek.y });
    }
  }

  /**
   * Recoins derrière une colonne (Thomas, 2026-11-13 : « coin d'une salle qui n'apparaît pas ») : les colonnes se
   * dessinent en blocs de mur aux coins intérieurs des salles, et la case de coin derrière elles restait un trou noir.
   * Quand on voit une colonne depuis sa salle, ses cases voisines et les murs qui les bordent se voient aussi (on fait
   * un pas de côté du regard).
   */
  private revealPillarPockets(): void {
    const room = this.rooms[this.roomIndexAt(this.hero)];
    if (!room) return;
    const inside = (x: number, y: number) => x >= room.x && y >= room.y && x < room.x + room.w && y < room.y + room.h;
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (this.map.get(x, y) !== Tile.Pillar || !this.visible[this.map.index(x, y)]) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const px = x + dx;
            const py = y + dy;
            if (!inside(px, py) || this.visible[this.map.index(px, py)]) continue;
            this.visible[this.map.index(px, py)] = 1;
            this.explored[this.map.index(px, py)] = 1;
            // Les murs qui bordent ce recoin.
            for (let ey = -1; ey <= 1; ey++)
              for (let ex = -1; ex <= 1; ex++) {
                if (!this.map.inBounds(px + ex, py + ey) || this.map.get(px + ex, py + ey) !== Tile.Wall) continue;
                const i = this.map.index(px + ex, py + ey);
                this.visible[i] = 1;
                this.explored[i] = 1;
              }
          }
        }
      }
    }
  }

  /**
   * Coins « logiques » : quand on voit deux pans de mur qui, prolongés tout droit sur quelques cases de mur,
   * se rejoignent en un coin, on montre aussi ce coin et les cases de mur qui y mènent. L'œil le devinait déjà.
   */
  private completeCorners(): void {
    const isWall = (x: number, y: number) => this.map.inBounds(x, y) && this.map.get(x, y) === Tile.Wall;
    const seen = (x: number, y: number) => this.visible[this.map.index(x, y)] === 1;
    // On ne révèle que de vrais parements : des murs qui touchent (même en diagonale) autre chose que du mur.
    // L'intérieur d'un massif de pierre reste caché.
    const faces = (x: number, y: number) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.map.inBounds(x + dx, y + dy) && this.map.get(x + dx, y + dy) !== Tile.Wall) return true;
      return false;
    };
    const reach = RULES.cornerReach;
    const reveal: number[] = [];
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (!isWall(x, y) || !seen(x, y)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          // On prolonge ce pan tout droit, tant que c'est du mur.
          const along: number[] = [];
          for (let k = 1; k <= reach; k++) {
            const px = x + dx * k;
            const py = y + dy * k;
            if (!isWall(px, py) || !faces(px, py)) break;
            along.push(this.map.index(px, py));
            if (seen(px, py)) continue;
            // Cette case serait un coin si, de là, un pan perpendiculaire rejoint un mur que l'on voit.
            for (const [ex, ey] of [[dy, dx], [-dy, -dx]]) {
              const across: number[] = [];
              for (let j = 1; j <= reach; j++) {
                const qx = px + ex * j;
                const qy = py + ey * j;
                if (!isWall(qx, qy) || !faces(qx, qy)) break;
                if (seen(qx, qy)) {
                  reveal.push(...along, ...across);
                  break;
                }
                across.push(this.map.index(qx, qy));
              }
            }
          }
        }
      }
    }
    for (const i of reveal) this.visible[i] = 1;
  }

  /** Devine les passages proches de ce qu'on voit : on « sent » un couloir sans le voir. */
  private senseBeyond(): void {
    let frontier: number[] = [];
    for (let i = 0; i < this.visible.length; i++) {
      const x = i % this.map.width;
      if (this.visible[i] && this.map.isWalkable(x, (i - x) / this.map.width)) frontier.push(i);
    }
    const reached = new Set(frontier);
    for (let depth = 0; depth < RULES.senseDepth; depth++) {
      const next: number[] = [];
      for (const i of frontier) {
        const x = i % this.map.width;
        const y = (i - x) / this.map.width;
        // On ne devine rien derrière une porte fermée.
        if (this.map.get(x, y) === Tile.DoorClosed) continue;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          if (!this.map.isWalkable(x + dx, y + dy)) continue;
          const n = this.map.index(x + dx, y + dy);
          if (reached.has(n)) continue;
          reached.add(n);
          this.sensed[n] = 1;
          next.push(n);
        }
      }
      frontier = next;
    }
  }

  /**
   * Prend l'escalier sur lequel le héros vient de marcher (vers le bas ou vers le haut).
   * Changer d'étage ne soigne plus : c'est le repos (un par étage) qui rend des PV.
   */
  takeStairs(): boolean {
    const direction = this.pendingStairs;
    if (this.over || !direction) return false;
    const target = this.depth + (direction === "down" ? 1 : -1);
    if (target < 1) return false;
    const healed = 0;
    // Fin de la démo (Thomas, 2026-11-14) : au bas de la section 2, l'escalier de l'étage 10 termine la partie.
    if (direction === "down" && !this.sandbox && this.depth >= this.lastDepth()) {
      this.over = true;
      this.won = true;
      this.events.push({ type: "demoEnd" });
      return true;
    }
    // Descendre sans être revenu voir le PNJ : la tâche est ratée (Thomas, 2026-11-12 : il reste sur l'étage).
    if (direction === "down" && this.quest && this.quest.depth === this.depth) this.failQuest();
    const left = this.perks();
    const unhurt = (direction === "down" && !left.hurt && !left.left && (left.kills ?? 0) > 0) || undefined;
    left.left = 1;
    this.enterFloor(target, direction);
    this.events.push({ type: "stairs", direction, healed, unhurt });
    if (direction === "down") this.settleKrik();
    return true;
  }
}

/**
 * Un éboulis (ou un autre meuble) posé devant la niche d'un escalier pouvait enfermer le héros (Thomas, 2026-11-17).
 * On cherche le chemin le moins encombré entre l'arrivée et l'escalier qui descend (et vers l'escalier qui monte) :
 * s'il ne passe que par des meubles, ceux qui bouchent ce chemin sont retirés (la case redevient du sol).
 */
function unblockStairs(state: FloorState): void {
  const map = state.map;
  const find = (t: Tile): Point | null => {
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (map.get(x, y) === t) return { x, y };
    return null;
  };
  const hub = floorHub(state);
  for (const target of [find(Tile.StairsDown), find(Tile.StairsUp)]) if (target) clearPath(state, hub, target);
}

/** Le milieu de la salle de départ (le point qu'on doit toujours pouvoir rejoindre). */
function floorHub(state: FloorState): Point {
  const r = state.rooms[0];
  return r ? { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) } : state.start;
}

/** Peut-on aller de `a` à `b` (pas droits ; une porte verrouillée compte comme passage) ? */
function linked(map: GameMap, a: Point, b: Point): boolean {
  const W = map.width;
  const seen = new Uint8Array(W * map.height);
  const todo = [a];
  seen[a.y * W + a.x] = 1;
  while (todo.length > 0) {
    const p = todo.pop()!;
    if (p.x === b.x && p.y === b.y) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (!map.inBounds(x, y) || seen[y * W + x]) continue;
      if (!(map.isWalkable(x, y) || map.get(x, y) === Tile.DoorLocked)) continue;
      seen[y * W + x] = 1;
      todo.push({ x, y });
    }
  }
  return false;
}

/** Ouvre le chemin le moins encombré de `from` à `to` : les meubles qui le bouchent sont retirés. Rend vrai si relié. */
function clearPath(state: FloorState, from: Point, to: Point): boolean {
  const map = state.map;
  const W = map.width;
  const cost = new Int32Array(W * map.height).fill(1e9);
  const prev = new Int32Array(W * map.height).fill(-1);
  const start = from.y * W + from.x;
  cost[start] = 0;
  const zero: number[] = [start];
  let head = 0;
  const one: number[] = [];
  while (head < zero.length || one.length > 0) {
    const k = head < zero.length ? zero[head++] : one.shift()!;
    const x = k % W;
    const y = Math.floor(k / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const t = map.get(nx, ny);
      if (t === Tile.Wall || t === Tile.Pillar) continue;
      const step = t === Tile.Furniture ? 1 : 0;
      const nk = ny * W + nx;
      if (cost[k] + step >= cost[nk]) continue;
      cost[nk] = cost[k] + step;
      prev[nk] = k;
      if (step === 0) zero.push(nk);
      else one.push(nk);
    }
  }
  const end = to.y * W + to.x;
  if (cost[end] >= 1e9) return false;
  if (cost[end] === 0) return true;
  for (let k = end; k !== start && k >= 0; k = prev[k]) {
    const x = k % W;
    const y = Math.floor(k / W);
    if (map.get(x, y) !== Tile.Furniture) continue;
    state.furniture = state.furniture.filter((f) => !furnitureCells(f).some((c) => c.x === x && c.y === y));
    map.set(x, y, Tile.Floor);
  }
  return true;
}

/** Un Kobold (ou un frondeur) : la famille que punit Sœur Osseuse et que fuit Krik. */
/** Un squelette de l'ossuaire (à l'épée ou à l'arc). */
function isSkeleton(m: Actor): boolean {
  return m.defId === "squelette" || m.defId === "squeletteArcher";
}

function isKobold(m: Actor): boolean {
  return m.defId === "schrat" || m.defId === "frondeur";
}
