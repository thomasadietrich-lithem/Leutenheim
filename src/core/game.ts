import { QUEST_TASKS, type QuestTask, type QuestTaskId } from "../data/quests";
import { CLASSES, ClassDef } from "../data/classes";
import { DEFAULT_FLOOR, FloorConfig } from "../data/floors";
import { ITEMS, ItemDef, ItemId, Slot, UNARMED, UNARMORED_AC } from "../data/items";
import { MAX_RANK, PATH_LEVEL, PathId, PATHS, PowerId, StatId } from "../data/skills";
import { MONSTERS, spawnsForDepth, MonsterDef } from "../data/monsters";
import { TRAPS } from "../data/traps";
import { RACES, RaceDef } from "../data/races";
import { RULES } from "../data/rules";
import { GLUCK, GLUCK_OPENING, GluckChoice, STAT_NAMES } from "../data/gluck";
import { SOEUR, SOEUR_OPENING } from "../data/soeur";
import { KRIK, KRIK_OPENING } from "../data/krik";
import { Actor } from "../entities/actor";
import { BagItem, Inventory } from "../items/inventory";
import { computeFov, computeLight, hasLineOfSight, LightSource, lineBetween } from "../world/fov";
import { generateFloor, Room } from "../world/generator";
import { buildSandbox, SANDBOX_LAYOUT, SandboxFloor } from "../world/sandbox";
import { BossFloor, buildBossFloor } from "../world/bossFloor";
import { bigStep, cellsOf, gapBetween, occupies, sizeOf } from "./boss";
import { furnishFloor, Furniture, furnitureCells, placeBell, reachable } from "../world/furnish";
import { FURNITURE_KINDS } from "../data/themedRooms";
import { Motif, placeGrounds, placeMotifs } from "../world/grounds";
import { GameMap, Point, Tile } from "../world/map";
import { canStep, findPath } from "../world/pathfinding";
import { rollAttack } from "./combat";
import { rollDice } from "./dice";
import { DoorAction, GameEvent, ShootRefusal } from "./events";
import { bytesToText, clone, SAVE_VERSION, SaveData, SavedFloor, textToBytes } from "./save";
import { BloodStain, CounterDoor, StainColor, Debris, FloorState, GluckSpot, GroundItem, Trap, guaranteedLoot, lootPool, placeGuaranteed, placeKey, placeLoot, placeSecrets, placeTraps, rollLoot, roomElements } from "./floor";

// Les autres fichiers continuent d'importer ces types depuis la partie.
export type { DoorAction, GameEvent, ShootRefusal } from "./events";
export type { Debris, GroundItem, Secret } from "./floor";
import { floorSeed, Rng } from "./rng";
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
}

/** Les PNJ de quête : Gluck (quête 01), Sœur Osseuse (quête 02), Krik (quête 03). */
export type NpcId = "gluck" | "soeur" | "krik";
export const NPC_IDS: readonly NpcId[] = ["gluck", "soeur", "krik"];

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
const POTION_STAIN: Record<string, StainColor> = { youth: "pYouth", poison: "pPoison", haste: "pHaste", fire: "pFire", smoke: "soot", fog: "soot", urchin: "pHaste" };

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
  torchTurns = 0;
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
  private throwOrder: { uid: number; x: number; y: number } | null = null;
  private skillOrder: number | null = null;
  private useOrder: number | null = null;
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
  /** Tours de fouille restant à passer sur place (0 : pas de fouille en cours). */
  private searching = 0;
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
    for (const start of heroClass.startingItems) {
      this.inventory.add(start.item, start.count);
      const placed = this.inventory.items.find((i) => i.defId === start.item);
      if (start.equip && placed) this.equip(placed.uid);
    }
    this.refreshStats();
    this.enterFloor(1, "down");
  }

  // ---------- Mise en place d'un étage ----------

  /**
   * Arrive sur un étage. S'il a déjà été visité, on le retrouve exactement comme on l'a laissé (monstres,
   * portes, objets au sol, carte explorée). `via` : par quel escalier on arrive.
   */
  private enterFloor(depth: number, via: "down" | "up"): void {
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
      if (this.sandbox && depth === 1) sandboxFloor = buildSandbox();
      // Étage du boss (le dernier de la section ; en salle d'essai, l'escalier y mène directement).
      const bossFloor: BossFloor | null = !sandboxFloor && this.isBossDepth(depth) ? buildBossFloor(seed) : null;
      const floor = sandboxFloor ?? bossFloor ?? generateFloor(seed, this.floorConfig);
      // À partir du deuxième étage, un escalier remonte depuis le point d'arrivée.
      if (depth > 1) floor.map.set(floor.start.x, floor.start.y, Tile.StairsUp);
      // Salles de fouille : à la main en salle d'essai ; dans le donjon, seulement quand le mobilier sera validé.
      const furnished = sandboxFloor
        ? { furniture: sandboxFloor.furniture, themes: sandboxFloor.themes }
        : bossFloor
          ? { furniture: bossFloor.furniture, themes: [] }
          : RULES.themedRoomsInDungeon
          ? furnishFloor(floor, seed, depth, this.funOf(depth) === "bell")
          : { furniture: [], themes: [] };
      // Statues de pierre (Thomas, 2026-11-12) : une sur un étage sur trois (C), du décor ; seule une statue CREUSE, posée
      // avec Gluck, cache quelque chose, et on ne le sait que s'il le dit.
      if (!sandboxFloor && !bossFloor && new Rng(seed ^ 0x57a7e).chance(RULES.statueChance)) {
        placeBell(floor, new Rng(seed ^ 0x57a7f), furnished.furniture, new Set(furnished.themes.map((t) => t.room)), "statue");
      }
      // Gravier et flaques : à la main en salle d'essai ; dans le donjon, quelques-uns par étage.
      if (!sandboxFloor && !bossFloor && RULES.groundsInDungeon) placeGrounds(floor, seed, depth);
      const motifs = sandboxFloor ? sandboxFloor.motifs : bossFloor ? [] : placeMotifs(floor, seed);
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
      if (bossFloor) for (const sec of bossFloor.secrets) state.secrets.push({ ...sec, found: false });
      // Le Colporteur : dans la salle d'essai, et au 4e étage de chaque section (Thomas, 2026-11-12).
      if (sandboxFloor) state.merchant = makeMerchant(sandboxFloor.merchant, sandboxFloor.merchant.home, SANDBOX_WARES, seed);
      else if (!bossFloor && (depth - 1) % 5 === MERCHANT.floorInSection - 1) state.merchant = this.placeMerchant(floor, seed, depth) ?? undefined;
      if (!bossFloor && (sandboxFloor || this.funOf(depth) === "counter")) {
        state.counter = this.placeCounterDoor(floor, state, seed, !!sandboxFloor) ?? undefined;
        // Pas de porte qui convienne : la cloche prend sa place (il y a toujours un truc fun dans la section).
        if (!state.counter && !sandboxFloor) {
          const special = new Set((state.themes ?? []).map((t) => t.room));
          placeBell(floor, new Rng(seed ^ 0x5b311e7d), state.furniture ?? [], special);
        }
      }
      this.floors.set(depth, state);
    }
    this.useFloor(state, depth);
    this.fires = [];
    this.gas = [];
    this.fog = [];
    this.furnitureFire.clear();
    // En descendant, on arrive en haut de l'étage ; en remontant, au pied de l'escalier qui descend.
    const arrival = via === "down" ? state.start : state.stairs;
    this.hero.x = this.hero.fromX = arrival.x;
    this.hero.y = this.hero.fromY = arrival.y;
    this.path = [];
    this.targetId = null;
    this.waiting = false;
    this.picking = false;
    this.resting = 0;
    this.searching = 0;
    this.hideOrder = false;
    this.jumpTarget = null;
    this.pushTargetId = null;
    this.useOrder = null;
    this.throwOrder = null;
    this.skillOrder = null;
    this.hidden = false;
    this.hideOrder = false;
    this.jumpTarget = null;
    this.pushTargetId = null;
    this.useOrder = null;
    this.throwOrder = null;
    this.skillOrder = null;
    this.shotTarget = null;
    this.pendingStairs = null;
    this.clearDoorOrders();
    // Paniers à fruits : leurs pommes sont de vrais objets au sol, qu'on ramasse (le panier les montre).
    if (fresh) for (const f of state.furniture) if (f.kind === "basket" && f.count) state.ground.push({ x: f.x, y: f.y, item: "pomme", count: f.count });
    if (fresh && sandboxFloor) {
      this.populateSandbox(state, sandboxFloor);
    } else if (fresh && state.boss) {
      // La nichée : la Tisseuse seule, au centre de sa grande toile ; ni renforts, ni clef, ni pièges, ni butin au sol.
      const queen = this.newMonster(MONSTERS.tisseuse, state.boss.spawn.x, state.boss.spawn.y, false);
      queen.boss = { phase: "lurk", bites: 0, hpMark: queen.hp, lurk: 0, fallen: 0, hatched: false, hubUp: true, engaged: false };
      this.monsters.push(queen);
      state.population = 0;
    } else if (fresh) {
      this.spawnMonsters(state.rooms);
      state.population = Math.max(1, this.monsters.length);
      state.nextRespawn = this.turn + RULES.respawnTurns;
      placeKey(state, this.rng, this.hero);
      placeSecrets(state, depth, floorSeed(this.runSeed, depth));
      placeTraps(state, floorSeed(this.runSeed, depth), depth);
      if (RULES.lootEnabled) placeLoot(state, depth, floorSeed(this.runSeed, depth));
      // Garanties de la section 1 (une pomme à l'étage 1, deux équipements, une gemme, une potion).
      placeGuaranteed(state, guaranteedLoot(this.runSeed, depth), floorSeed(this.runSeed, depth));
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
    rooms.slice(1).forEach((room) => {
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
  private placeCounterDoor(floor: { map: GameMap; start: Point; stairs: Point; rooms: Room[] }, state: FloorState, seed: number, sandbox: boolean): CounterDoor | null {
    const rng = new Rng(seed ^ 0x2a7c11e3);
    const { map } = floor;
    if (sandbox) {
      // Salle d'essai : le placard au bout du couloir du dortoir.
      if (map.get(13, 28) !== Tile.DoorClosed) return null;
      map.set(13, 28, Tile.DoorLocked);
      return { x: 13, y: 28, inside: { x: 13, y: 29 }, n: RULES.counterStart, heard: false, opened: false };
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
  funOf(depth: number): "bell" | "counter" | null {
    if (this.sandbox && depth === 1) return null;
    const section = Math.floor((depth - 1) / RULES.floorsPerSection);
    const rng = new Rng((this.runSeed ^ Math.imul(section + 1, 0x9e3779b1)) >>> 0);
    const floor = section * RULES.floorsPerSection + rng.int(1, RULES.funMaxFloor);
    if (floor !== depth) return null;
    return rng.chance(0.5) ? "bell" : "counter";
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
  isBossDepth(depth: number): boolean {
    return this.sandbox ? depth === 2 : (RULES.bossDepths as readonly number[]).includes(depth);
  }

  /** Le plan de la nichée (étage du boss), pour le dessin des amarres. */
  bossLayout(): { hub: Point; pillars: Point[] } | undefined {
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

  /** La cloche d'alarme sur cette case, s'il y en a une. */
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
    const bell = this.bellAt(at.x, at.y);
    if (bell) {
      this.ringBell(bell);
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
    if (f.kind.startsWith("cocoon") && this.rng.chance(0.5)) this.dropItem(f.x, f.y, "or", this.rng.int(2, 6));
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
    const anchors = this.current.furniture.filter((f) => f.kind === "anchor").length;
    const cells = this.current.furniture.filter((f) => f.kind.startsWith("webHub"));
    if (anchors > 0 && cells.length > 4) return;
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

  /** La Tisseuse est morte : la toile qui scellait l'escalier tombe. */
  private bossDefeated(): void {
    const layout = this.current.boss;
    this.bossKills++;
    if (!layout) return;
    this.current.furniture = this.current.furniture.filter((f) => f.kind !== "sealedStairs");
    this.map.set(layout.seal.x, layout.seal.y, Tile.StairsDown);
    this.events.push({ type: "boss", what: "dead", x: layout.seal.x, y: layout.seal.y });
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
    // Ce qu'elle sent : le héros qui marche sur sa toile (les vibrations), ou tout près d'elle. Sinon, un leurre.
    const sensed = this.stickyAt(hero.x, hero.y) || gapBetween(m, hero) <= RULES.bossSenseRange || (st.engaged && this.hidden === false && gapBetween(m, hero) <= 1);
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
      const steps = onWeb() ? RULES.bossWebSteps : 1;
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

  /** Cases où un chemin peut passer : on contourne les pièges, sauf si l'on veut y aller. */
  private avoidTraps(to: Point, base?: (x: number, y: number) => boolean, from: Point = this.hero): (x: number, y: number) => boolean {
    // Pièges et cases en feu : on les contourne (sauf si c'est la destination ou le point de départ).
    return (x, y) => (!base || base(x, y)) && ((x === to.x && y === to.y) || (x === from.x && y === from.y) || (!this.isTrap(x, y) && !this.isBurning(x, y) && !this.isGassed(x, y)));
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
    const plain0 = findPath(this.map, this.hero, to, this.avoidTraps(to, known));
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
    const kind = trap.kind ?? "spikes";
    const def = TRAPS[kind];
    // Agilité (Thomas, 2026-11-11) : le héros qui marche sur un piège peut l'éviter d'un bond (d20 + agilité).
    if (actor.kind === "hero") {
      const d20 = this.rng.int(1, 20);
      const bonus = this.alloc.agilite;
      if (d20 !== 1 && (d20 === 20 || d20 + bonus >= RULES.trapDodgeDc)) {
        if (kind === "pit") trap.sprung = true;
        this.events.push({ type: "trapDodged", x: actor.x, y: actor.y, kind, d20, bonus });
        return;
      }
    }
    const damage = def.damage ? rollDice(this.rng, def.damage) : 0;
    this.events.push({ type: "trap", x: actor.x, y: actor.y, victim: actor, damage, kind });
    if (kind === "pit") trap.sprung = true;
    if (def.stuck) actor.stuck = Math.max(actor.stuck ?? 0, def.stuck);
    if (def.poison && kind === "needle") this.poisonActor(actor, def.poison);
    if (def.gasTurns) {
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = trap.x + dx;
        const y = trap.y + dy;
        if (!this.map.isWalkable(x, y) && this.map.get(x, y) !== Tile.Furniture) continue;
        const old = this.gas.find((g) => g.x === x && g.y === y);
        if (old) old.turns = Math.max(old.turns, def.gasTurns);
        else this.gas.push({ x, y, turns: def.gasTurns });
      }
      this.gasPoison();
    }
    if (damage > 0) {
      this.bleed(actor, actor);
      if (actor.kind === "hero") {
        this.hurtHero(damage, { spikes: "un piège à pointes", pit: "une chute dans une fosse", needle: "une aiguille empoisonnée", gas: "le gaz" }[kind]);
      } else {
        actor.hp = Math.max(0, actor.hp - damage);
        this.removeIfDead(actor);
      }
    }
  }

  /** « un Kobold », « une Araignée » : le nom du monstre, pour l'écran de fin. */
  private killerName(m: Actor): string {
    if (m.boss) return m.name;
    return m.defId === "araignee" ? `une ${m.name}` : `un ${m.name}`;
  }

  /** Empoisonne un personnage (un nouveau poison remet le compteur, il ne s'ajoute pas). */
  private poisonActor(actor: Actor, poison: { damage: number; turns: number }): void {
    actor.poison = { ...poison };
    this.events.push({ type: "poisoned", actor });
  }

  /** Nuages de gaz empoisonné (piège à gaz) : case par case, tours restants. */
  gas: { x: number; y: number; turns: number }[] = [];
  /** Brouillard noir (potion de brouillard) : on ne voit ni à travers ni dedans ; personne ne s'y empoisonne. */
  fog: { x: number; y: number; turns: number }[] = [];
  /** Potion d'oursin : tours restants pendant lesquels les coups reçus au contact renvoient une part des dégâts. */
  urchinTurns = 0;

  isGassed(x: number, y: number): boolean {
    return this.gas.some((g) => g.x === x && g.y === y);
  }

  /** Qui se tient dans le gaz est empoisonné (s'il ne l'est pas déjà plus longtemps). */
  private gasPoison(): void {
    const poison = TRAPS.gas.poison!;
    for (const a of [this.hero, ...this.monsters]) {
      if (!this.isGassed(a.x, a.y) || (a.poison && a.poison.turns >= poison.turns)) continue;
      this.poisonActor(a, poison);
    }
  }

  /** Fin de tour : le gaz empoisonne, puis se dissipe. */
  private gasTick(): void {
    if (this.gas.length === 0) return;
    this.gasPoison();
    for (const g of this.gas) g.turns--;
    this.gas = this.gas.filter((g) => g.turns > 0);
  }

  /** Du brouillard sur cette case ? */
  fogAt(x: number, y: number): boolean {
    return this.fog.some((f) => f.x === x && f.y === y);
  }

  /** Le brouillard cache-t-il `b` aux yeux de `a` (b dedans, ou une nappe sur la ligne) ? */
  private fogBetween(a: Point, b: Point): boolean {
    if (this.fog.length === 0) return false;
    return this.fogAt(b.x, b.y) || this.lineCells(a, b).some((c) => this.fogAt(c.x, c.y));
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

  /** Fin de tour : le brouillard aveugle, puis se dissipe. */
  private fogTick(): void {
    if (this.fog.length === 0) return;
    this.fogBlinds();
    for (const f of this.fog) f.turns--;
    this.fog = this.fog.filter((f) => f.turns > 0);
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
    for (const c of cells) {
      const old = this.fog.find((f) => f.x === c.x && f.y === c.y);
      if (old) old.turns = Math.max(old.turns, RULES.fogTurns);
      else this.fog.push({ x: c.x, y: c.y, turns: RULES.fogTurns });
    }
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
  private populateSandbox(state: FloorState, plan: SandboxFloor): void {
    for (const m of plan.monsters) {
      const monster = this.newMonster(MONSTERS[m.monster ?? "schrat"], m.x, m.y, m.asleep);
      if (m.patrol) monster.patrol = state.rooms.find((r) => m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h);
      this.monsters.push(monster);
    }
    // Niveau 4 dans la salle d'essai : on peut y essayer l'épée longue, la lance et les flèches empoisonnées ;
    // le cimeterre et le cuir clouté (niveau 5) montrent le refus.
    this.level = plan.heroLevel;
    // Les points des niveaux déjà passés sont à attribuer (et la voie à choisir).
    this.points = plan.heroLevel - 1;
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
  floorStyle(x: number, y: number): "kitchen" | "torture" | "forge" | undefined {
    const id = this.themeAt(x, y);
    return id === "cuisine" ? "kitchen" : id === "torture" ? "torture" : id === "forge" ? "forge" : undefined;
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
  private useFloor(state: FloorState, depth: number): void {
    this.current = state;
    this.depth = depth;
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
    }));
    return clone({
      version: SAVE_VERSION,
      savedAt: new Date(0).toISOString(), // l'heure est mise par l'affichage (la logique ne lit pas l'horloge)
      runSeed: this.runSeed,
      race: this.race.id,
      heroClass: this.heroClass.id,
      sandbox: this.sandbox,
      depth: this.depth,
      deepest: this.deepest,
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
      gluck: this.gluckMemory,
      soeur: this.soeurMemory,
      krik: this.krikMemory,
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
        secrets: f.secrets,
        traps: f.traps,
        searched: new Set(f.searched),
        furniture: f.furniture ?? [],
        themes: f.themes ?? [],
        motifs: f.motifs ?? [],
        boss: f.boss,
        merchant: f.merchant,
        counter: f.counter,
        gluck: f.gluck,
        soeur: f.soeur,
        krik: f.krik,
      });
    }
    game.turn = saved.turn;
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
    const known = (id: string) => game.voie !== null && [PATHS[game.voie].main, ...PATHS[game.voie].secondaries].some((pw) => pw.id === id);
    game.ranks = {};
    if (saved.ranks) for (const [id, r] of Object.entries(saved.ranks)) if (known(id)) game.ranks[id as PowerId] = r;
    else if (game.voie) {
      game.ranks[PATHS[game.voie].main.id] = 1;
      for (const id of saved.skills) if (known(id)) game.ranks[id as PowerId] = 1;
    }
    game.floorPerks = {};
    for (const [d, pk] of Object.entries(saved.floorPerks ?? {})) {
      const old = pk as unknown as { secondWind: boolean | number; doubleStrikes: number; lastStand: boolean | number; chainRefunds?: number };
      game.floorPerks[Number(d)] = { secondWind: Number(old.secondWind), doubleStrikes: old.doubleStrikes, lastStand: Number(old.lastStand), chainRefunds: old.chainRefunds ?? 0 };
    }
    game.weaponPoison = saved.weaponPoison;
    game.hasteTurns = saved.hasteTurns;
    game.urchinTurns = saved.urchinTurns ?? 0;
    game.gluckMemory = saved.gluck ?? { met: 0, mood: 0, invested: 0 };
    game.blessTurns = saved.blessTurns ?? 0;
    game.soeurMemory = saved.soeur ?? { met: 0 };
    game.krikMemory = saved.krik ?? { met: 0 };
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
    game.clock = saved.clock ?? 0;
    game.ammoChoice = ((saved.ammoChoice ?? "fleche") in ITEMS ? saved.ammoChoice : "fleche") as ItemId;
    game.heroMisses = saved.heroMisses;
    game.bossKills = saved.bossKills ?? 0;
    game.nextId = saved.nextId;
    game.lastFoeId = saved.lastFoeId;
    game.failedDoorAttempts = new Set(saved.failedDoorAttempts);
    game.events = [];
    game.useFloor(game.floors.get(saved.depth)!, saved.depth);
    game.deepest = saved.deepest;
    game.fires = saved.fires;
    game.gas = saved.gas ?? [];
    game.fog = saved.fog ?? [];
    game.refreshStats();
    game.hidden = saved.hidden;
    for (const a of [game.hero, ...game.monsters]) {
      a.fromX = a.x;
      a.fromY = a.y;
    }
    game.updateVision();
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
    // Arme à deux mains (Thomas, 2026-11-11) : pas tant qu'une torche brûle dans l'autre main.
    if ((ITEMS[item.defId] as ItemDef).twoHanded && this.torchTurns > 0) return false;
    // Pas d'arc tant qu'une arme à deux mains est en main : il faut d'abord la ranger.
    if (kind === "ranged" && this.twoHanded()) return false;
    const previous = this.equipment[kind];
    const from = { x: item.x, y: item.y };
    this.inventory.removeItem(uid);
    // Arme à deux mains (Thomas, 2026-11-11) : elle fait sauter l'autre main, l'arc retourne dans le sac.
    const bow = (ITEMS[item.defId] as ItemDef).twoHanded ? this.equipment.ranged : null;
    if (bow) {
      // Sac plein (Thomas) : l'arc rebondit au sol, sur une case libre à côté.
      if (!this.inventory.placeItem(bow)) this.bounceFromHero(bow.defId, bow.count);
      this.equipment.ranged = null;
    }
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
    this.hero.attackBonus = (melee?.attackBonus ?? UNARMED.attackBonus) + blessed;
    // Chaque point de Force ajoute 1 aux dégâts au contact.
    const base = melee?.damage ?? UNARMED.damage;
    this.hero.damage = { ...base, bonus: base.bonus + this.alloc.force };
    const armor = this.equipment.armor;
    // Classe d'armure : l'armure, le casque, la peau dure, et l'ESQUIVE (Thomas, 2026-11-11 : +1 tous les 2 points
    // d'agilité).
    const hat = this.equipment.hat;
    this.hero.armorClass =
      ((armor && (ITEMS[armor.defId] as ItemDef).armorClass) || UNARMORED_AC) +
      ((hat && (ITEMS[hat.defId] as ItemDef).acBonus) || 0) +
      this.rank("peau_dure") +
      Math.floor(this.alloc.agilite / RULES.agilityPerDodge) +
      blessed +
      (this.protectTurns > 0 ? SOEUR.protectBonus : 0);
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
  private refreshLight(): void {
    const carried = this.torchTurns > 0 ? [{ x: this.hero.x, y: this.hero.y, faceX: 0, faceY: 0, radius: RULES.torchRadius }] : [];
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
    this.light = computeLight(this.map, [...fixed, ...carried, ...dropped]);
  }

  /** Le héros tient-il une arme à deux mains (épée longue, lance) ? */
  twoHanded(): boolean {
    return !!this.weapon("melee")?.twoHanded;
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
    // Une torche se tient d'une main : impossible avec une arme à deux mains (Thomas, 2026-11-11).
    if (def.lightTurns && this.twoHanded()) return false;
    // La potion de feu ne se boit pas : elle se lance. (Celle de poison s'enduit OU se lance.)
    if (def.kind !== "use" || this.tooLow(def) || def.potion === "fire" || def.potion === "smoke" || def.potion === "fog") return false;
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
      this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + def.heal);
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
    } else if (def.potion === "urchin") {
      this.urchinTurns = RULES.urchinTurns + 1;
      this.events.push({ type: "potion", potion: "urchin" });
    }
    if (def.lightTurns) {
      this.torchTurns = def.lightTurns;
      this.refreshLight();
      this.events.push({ type: "used", item: item.defId });
      // On ne se cache pas une torche à la main.
      this.reveal();
    }
  }

  /** Jeter un objet du sac : il tombe aux pieds du héros (sans prendre de tour). Le sac porté ne se jette pas. */
  dropFromBag(uid: number): boolean {
    const item = this.inventory.get(uid);
    if (!item || this.over) return false;
    this.inventory.removeItem(uid);
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
      if (potion === "fog") this.spreadFog(at, 1);
      // Une flaque de sa couleur reste au sol (Thomas, 2026-11-12).
      if (this.map.get(at.x, at.y) !== Tile.Water) this.stain(at.x, at.y, POTION_STAIN[potion] ?? "pYouth");
      this.events.push({ type: "shatter", item: item.defId, potion, fromX: this.hero.x, fromY: this.hero.y, x: at.x, y: at.y });
      return true;
    }
    this.dropItem(this.hero.x, this.hero.y, item.defId, item.count);
    this.events.push({ type: "dropped", item: item.defId, count: item.count });
    return true;
  }

  /** Les munitions présentes dans le sac : celles de l'arc (ordinaires d'abord), puis ce qui se lance à la main (javelines). */
  ammoKinds(): ItemId[] {
    const family = this.weapon("ranged")?.ammo;
    return (Object.keys(ITEMS) as ItemId[]).filter((id) => {
      const f = (ITEMS[id] as ItemDef).ammoFamily;
      return (f === "jet" || (!!family && f === family)) && this.inventory.count(id) > 0;
    });
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
    const usable = (id: ItemId) => !this.tooLow(ITEMS[id] as ItemDef) && this.inventory.count(id) > 0;
    if ((chosen.ammoFamily === "jet" || (!!family && chosen.ammoFamily === family)) && usable(this.ammoChoice)) return this.ammoChoice;
    if (family && this.inventory.count(family as ItemId) > 0) return family as ItemId;
    // Sans arc (ou sans flèches) : on peut encore lancer une javeline.
    return this.ammoKinds().find((id) => (ITEMS[id] as ItemDef).ammoFamily === "jet" && usable(id)) ?? null;
  }

  // ---------- Points, voie, compétences ----------

  /** Ce qui ne sert qu'un nombre limité de fois sur l'étage courant. */
  perks(): FloorPerks {
    return (this.floorPerks[this.depth] ??= { secondWind: 0, doubleStrikes: this.rank("double_frappe"), lastStand: 0, chainRefunds: 0 });
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
    return this.rank("second_souffle") >= MAX_RANK ? 2 : 1;
  }

  /** Place un point dans une caractéristique (ne prend pas de tour). */
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
    return this.heroClass.pushBonus + this.alloc.force;
  }
  disengageBonus(): number {
    return this.heroClass.disengageBonus + this.alloc.agilite;
  }
  rangedBonus(): number {
    return this.alloc.agilite;
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
    if (id === "red") this.perks().doubleStrikes = Math.max(this.perks().doubleStrikes, 1);
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
    const path = PATHS[this.voie];
    if (![path.main, ...path.secondaries].some((pw) => pw.id === id) || this.rank(id) >= MAX_RANK) return false;
    this.ranks[id] = this.rank(id) + 1;
    // Une double frappe de plus tout de suite, sur l'étage en cours.
    if (id === "double_frappe") this.perks().doubleStrikes++;
    this.refreshStats();
    return true;
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
    if (damage <= 0) return;
    const rampart = this.rank("dernier_rempart");
    if (this.hero.hp - damage <= 0 && rampart > 0 && this.perks().lastStand < (rampart >= MAX_RANK ? 2 : 1)) {
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

  // ---------- Potion de feu ----------

  /** Pourquoi on ne peut pas lancer cette potion sur cette case (null : c'est possible). */
  throwRefusal(uid: number, x: number, y: number): "far" | "unseen" | "wall" | null {
    const def = this.inventory.get(uid) ? (ITEMS[this.inventory.get(uid)!.defId] as ItemDef) : undefined;
    if (!def?.throwRange) return "far";
    if (Math.max(Math.abs(x - this.hero.x), Math.abs(y - this.hero.y)) > def.throwRange) return "far";
    if (!this.isVisible(x, y)) return "unseen";
    if (!this.map.isWalkable(x, y)) return "wall";
    return null;
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
    const potion = (ITEMS[item.defId] as ItemDef).potion ?? "fire";
    this.reveal();
    // La croix, plus une éclaboussure au hasard sur une case voisine de la croix (Thomas).
    const cross = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const splash = [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const extra = splash[this.rng.int(0, splash.length - 1)];
    // La flaque de sa couleur, là où la fiole éclate (Thomas, 2026-11-12).
    if (this.map.get(order.x, order.y) !== Tile.Water) this.stain(order.x, order.y, POTION_STAIN[potion] ?? "pFire");
    if (potion === "fog") {
      // Potion de brouillard (Thomas, 2026-11-12, soir) : une épaisse nappe noire en croix de 5 cases, pour fuir.
      const cells = this.spreadFog(order, RULES.fogArm);
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
      for (const c of cells) {
        const old = this.gas.find((g) => g.x === c.x && g.y === c.y);
        if (old) old.turns = Math.max(old.turns, RULES.thrownPoisonGasTurns);
        else this.gas.push({ x: c.x, y: c.y, turns: RULES.thrownPoisonGasTurns });
      }
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
    for (const fire of [...this.fires]) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = fire.x + dx;
          const y = fire.y + dy;
          const t = this.map.get(x, y);
          const door = t === Tile.DoorClosed || t === Tile.DoorOpen || t === Tile.DoorLocked;
          if (!door && t !== Tile.Chest) continue;
          if (t === Tile.Chest) {
            const gold = this.rng.int(RULES.chestGoldMin, RULES.chestGoldMax) + this.depth * RULES.chestGoldPerDepth;
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
      const damage = rollDice(this.rng, RULES.fireDamage) * (a.boss ? RULES.bossFireFactor : 1);
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
    for (const f of this.fires) {
      for (const a of [this.hero, ...this.monsters]) {
        if (!occupies(a, f.x, f.y) || this.over || !this.monsters.concat(this.hero).includes(a)) continue;
        // Un grand monstre sur plusieurs cases en feu ne brûle qu'une fois par tour.
        if (a.boss && burnedBoss) continue;
        if (a.boss) burnedBoss = true;
        a.burning = RULES.burnAfter;
        const damage = rollDice(this.rng, RULES.fireDamage) * (a.boss ? RULES.bossFireFactor : 1);
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
      // Le feu éteint laisse de la SUIE au sol (Thomas, 2026-11-12).
      if (f.turns <= 0 && this.map.get(f.x, f.y) !== Tile.Water && this.map.isWalkable(f.x, f.y)) this.stain(f.x, f.y, "soot");
    }
    this.fires = this.fires.filter((f) => f.turns > 0);
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
    return RULES.levelCapPerSection * (this.bossKills + 1);
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
    // Arme à deux mains (Thomas, 2026-11-11) : elle empêche toute autre arme, ni arc ni javeline.
    if (this.twoHanded()) return "two-hands";
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
  setDestination(x: number, y: number, ignoreFog = false): boolean {
    if (this.over) return false;
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
    if ((this.breakableAt(x, y) || this.bellAt(x, y)) && (ignoreFog || this.isExplored(x, y))) return this.approachBreakable(x, y, ignoreFog);
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
    this.targetId = monster ? monster.id : null;
    this.path = path;
    this.waiting = false;
    this.picking = false;
    this.resting = 0;
    this.searching = 0;
    this.hideOrder = false;
    this.jumpTarget = null;
    this.pushTargetId = null;
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
    if (this.inventory.count("clef", this.depth) > 0) this.doorAction = "key";
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
    return this.ground.filter((g) => g.x === this.hero.x && g.y === this.hero.y);
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
    this.useOrder = null;
    this.throwOrder = null;
    this.skillOrder = null;
    this.picking = true;
    this.pickingItem = null;
    return true;
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
    return this.resting > 0 ? Math.max(0.06, 1 - this.resting / RULES.restTurns) : 0;
  }

  /**
   * Y a-t-il de quoi se cacher ici ? Une colonne sur une des 8 cases voisines, ou un mur qui fait un angle :
   * un coin rentrant (mur d'un côté ET mur d'un côté perpendiculaire), ou l'arête d'un mur (le bout d'un pan,
   * en diagonale, derrière lequel on peut se glisser, comme pour l'embuscade au coin). Un mur droit ne suffit pas.
   */
  hasCover(p: Point): boolean {
    const wall = (x: number, y: number) => this.map.get(x, y) === Tile.Wall;
    // Une colonne, ou un meuble qui bloque (lit, table, chaise renversée…), sur une des 8 cases voisines.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = this.map.get(p.x + dx, p.y + dy);
        if (t === Tile.Pillar || t === Tile.Furniture) return true;
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
    if (room < 0) return "corridor";
    if (this.current.searched.has(room)) return "searched";
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
  hideRefusal(): "hidden" | "threatened" | "watched" | "no-cover" | "torch" | null {
    if (this.hidden) return "hidden";
    if (this.torchTurns > 0) return "torch";
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
        const distance = RULES.jumpDistance;
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
  }

  /** Ordre : se reposer sur place plusieurs tours. Tout autre ordre y renonce, un monstre en vue l'interrompt. */
  rest(): boolean {
    if (this.over || this.restRefusal() !== null) return false;
    this.wait();
    this.waiting = false;
    this.resting = RULES.restTurns;
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
    if (this.over) return false;
    for (const a of [this.hero, ...this.monsters]) {
      a.fromX = a.x;
      a.fromY = a.y;
    }
    if (this.current.merchant) {
      this.current.merchant.fromX = this.current.merchant.x;
      this.current.merchant.fromY = this.current.merchant.y;
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
    this.useOrder = null;
    this.throwOrder = null;
    this.skillOrder = null;
      if (target && this.inReach(this.hero, target)) this.resolvePush(target);
    } else if (this.jumpTarget) {
      this.resolveJump(this.jumpTarget);
      this.jumpTarget = null;
    } else if (this.searching > 0) {
      this.searching--;
    } else if (this.resting > 0) {
      this.resting--;
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
      } else if (this.hero.stuck) {
        // Englué : ce déplacement passe à se dépêtrer (on peut toujours frapper).
        this.hero.stuck--;
        this.events.push({ type: "stuck" });
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
        if (!throughDoor && this.opportunityAttacks(threats)) {
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

    this.turn++;
    // Tocsin : le temps passé sur l'étage fait monter l'alerte, et chaque coup échangé fait du bruit.
    if (this.turn % RULES.alarmTurnsPerPoint === 0) this.raiseAlarm(1);
    this.respawn();
    if (this.debris.some((d) => d.until <= this.turn)) this.debris = this.debris.filter((d) => d.until > this.turn);
    if (this.torchTurns > 0) {
      this.torchTurns--;
      if (this.torchTurns === 0) this.events.push({ type: "torchOut" });
    }
    // La lumière suit la torche portée et celles qu'on ramasse ou qu'on pose.
    const groundTorches = this.ground.filter((g) => g.item === "torche").length;
    if (this.torchTurns > 0 || groundTorches !== this.lastGroundTorches || this.torchWasLit) this.refreshLight();
    this.lastGroundTorches = groundTorches;
    this.torchWasLit = this.torchTurns > 0;
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
    this.gasTick();
    this.fogTick();
    this.npcsFlee();
    this.counterChatter();
    // Salle d'essai : Gluck et Sœur Osseuse reviennent quelques tours après être partis, pour montrer la scène suivante.
    for (const gk of [this.current.gluck, this.current.soeur, this.current.krik]) {
      if (gk && gk.gone && gk.backAt !== undefined && this.turn >= gk.backAt && !this.actorAt(gk.x, gk.y)) {
        Object.assign(gk, { gone: false, backAt: undefined, opened: false, intro: undefined, pending: undefined, pendingLines: undefined, haggled: false, drumDone: false });
      }
    }
    if (this.hasteTurns > 0) this.hasteTurns--;
    if (this.urchinTurns > 0) this.urchinTurns--;
    this.fluteTick();
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
    const armor = this.equipment.armor;
    return this.heroClass.stealthBonus - ((armor && (ITEMS[armor.defId] as ItemDef).stealthPenalty) || 0);
  }

  /** Jet pour se cacher. Réussi : les monstres perdent la trace du héros et redeviennent de simples promeneurs. */
  private resolveHide(): void {
    const bonus = this.stealthBonus();
    const d20 = this.rng.int(1, 20);
    const total = d20 + bonus;
    const success = d20 === 20 || (d20 !== 1 && total >= RULES.hideDc);
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
  }

  /**
   * Poussée : réussie, le monstre recule d'une case dans l'axe du héros et perd son prochain tour ;
   * s'il bute sur un mur, une colonne ou une porte fermée, il reste en place mais encaisse des dégâts en plus.
   * S'il recule sur un piège, le piège se déclenche.
   */
  private resolvePush(m: Actor): void {
    this.reveal();
    const bonus = this.pushBonus();
    const d20 = this.rng.int(1, 20);
    const total = d20 + bonus;
    const success = d20 === 20 || (d20 !== 1 && total >= RULES.pushDc);
    m.alerted = true;
    m.asleep = false;
    let moved = false;
    let slam = 0;
    if (success) {
      const dx = Math.sign(m.x - this.hero.x);
      const dy = Math.sign(m.y - this.hero.y);
      const distance = 1;
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
      m.stunned = 1;
    }
    this.events.push({ type: "push", target: m, d20, bonus, total, success, moved, slam });
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
    if (index < 0) return;
    this.current.searched.add(index);
    const bonus = this.heroClass.searchBonus;
    const d20 = this.rng.int(1, 20);
    const total = d20 + bonus;
    const success = d20 === 20 || (d20 !== 1 && total >= RULES.searchDc);
    const found: Point[] = [];
    if (success) {
      for (const s of this.current.secrets) {
        if (s.room !== index || s.found) continue;
        s.found = true;
        this.dropItem(s.x, s.y, s.item, s.count);
        found.push({ x: s.x, y: s.y });
      }
    }
    this.events.push({ type: "searched", d20, bonus, total, success, found, room: this.rooms[index] });
  }

  /** Saut pour se dégager : il faut réussir un jet. Réussi, pas d'attaque d'opportunité, mais ceux qu'on quitte restent sur leurs gardes. */
  private resolveJump(to: Point): void {
    const threats = this.monsters.filter((m) => m.alerted && this.inReach(m, this.hero));
    const from = { x: this.hero.x, y: this.hero.y };
    const bonus = this.disengageBonus();
    const d20 = this.rng.int(1, 20);
    const total = d20 + bonus;
    const success = d20 === 20 || (d20 !== 1 && total >= RULES.disengageDc);
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
      const share = [RULES.restHealShare, 0.65, 0.8, 1][this.rank("recuperation")];
      const healed = Math.ceil((this.hero.maxHp - this.hero.hp) * share);
      this.hero.hp += healed;
      this.current.rested = true;
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
  private aroundCorner(a: Point, b: Point): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) !== 1 || Math.abs(dy) !== 1) return false;
    return this.map.isWalkable(a.x + dx, a.y) !== this.map.isWalkable(a.x, a.y + dy);
  }

  /** Le héros aurait-il l'avantage en frappant ce monstre maintenant ? (cible distraite, dans une porte, ou au coin d'un mur) */
  heroHasAdvantageOn(monster: Actor): boolean {
    // Jamais deux avantages de suite sur la même cible (Thomas) : après un coup avec avantage, elle se reprend.
    if (this.hero.lastAdvantageOn === monster.id) return false;
    // La Tisseuse renversée sur le dos : on la frappe avec avantage.
    if (monster.boss && monster.boss.fallen > 0) return true;
    if (!monster.alerted) return true;
    // Un avantage à la fois : le monstre semé en passant une porte s'attend à l'embuscade.
    if (monster.wary) return false;
    return this.map.isDoor(monster.x, monster.y) || this.aroundCorner(this.hero, monster);
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

  /** Acheter le lot n° `index` : il faut l'or et la place dans le sac ; ne prend pas de tour. */
  buy(index: number): "ok" | "gold" | "full" | "none" | "away" {
    const m = this.current.merchant;
    const ware = m?.wares[index];
    if (!m || !ware) return "none";
    if (!this.canTrade()) return "away";
    if (this.gold < ware.price) return "gold";
    const left = this.inventory.add(ware.item, ware.count);
    // Sac plein (Thomas) : ce qui ne tient pas rebondit au sol à côté du héros.
    if (left > 0) this.bounceFromHero(ware.item, left);
    this.gold -= ware.price;
    m.wares.splice(index, 1);
    this.events.push({ type: "bought", item: ware.item, count: ware.count, price: ware.price });
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
    // Trop de bruit (Thomas : « il disparaît quand le niveau d'alerte est important ») : au palier ALERTE, il plie
    // bagage et quitte l'étage pour de bon.
    if (this.current.alarmStage >= MERCHANT.leaveAtAlarmStage) {
      this.current.merchant = undefined;
      this.events.push({ type: "merchantLeaves", x: m.x, y: m.y, seen: this.isVisible(m.x, m.y) });
      return;
    }
    const near = (p: Point, r: number) => Math.max(Math.abs(p.x - m.x), Math.abs(p.y - m.y)) <= r;
    // Il se cache dès qu'un monstre approche (6 cases), ou qu'un monstre éveillé entre dans sa salle
    // (Thomas, 2026-11-12 : « le colpo n'est pas devenu invisible » : à 4 cases, il restait visible pendant les combats).
    const r0 = m.home;
    const inRoom = (p: Point) => p.x >= r0.x - 1 && p.x <= r0.x + r0.w && p.y >= r0.y - 1 && p.y <= r0.y + r0.h;
    const hide = this.monsters.some((mo) => mo.hp > 0 && (near(mo, MERCHANT.hideRadius) || (!mo.asleep && inRoom(mo))));
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
    if (this.sandbox) {
      if (depth !== 1) return;
      state.gluck = this.placeGluck(state, depth) ?? undefined;
      state.soeur = this.placeSoeur(state, new Rng(this.runSeed ^ 0x50e0)) ?? undefined;
      state.krik = this.placeKrik(state, new Rng(this.runSeed ^ 0x6b1c)) ?? undefined;
      this.placeHollowStatue(state, new Rng(this.runSeed ^ 0x57a7));
      return;
    }
    const rng = new Rng(floorSeed(this.runSeed, depth) ^ 0x6a1b2c3d);
    if ((depth - 1) % RULES.floorsPerSection > 3 || !rng.chance(GLUCK.chance)) return;
    const who = NPC_IDS.filter((id) => this.npcMemory(id).met < this.npcMax(id));
    if (who.length === 0) return;
    const pick = who[rng.int(0, who.length - 1)];
    if (pick === "gluck") {
      state.gluck = this.placeGluck(state, depth, rng) ?? undefined;
      if (state.gluck) this.placeHollowStatue(state, rng);
    }
    else if (pick === "soeur") state.soeur = this.placeSoeur(state, rng) ?? undefined;
    else state.krik = this.placeKrik(state, rng) ?? undefined;
  }

  /** Combien de fois on peut croiser ce PNJ dans une partie. */
  npcMax(id: NpcId): number {
    return id === "gluck" ? GLUCK.maxEncounters : id === "soeur" ? SOEUR.maxEncounters : KRIK.maxEncounters;
  }

  /** Avec Gluck, une statue CREUSE sur l'étage : rien ne la distingue des autres tant qu'il n'en a pas parlé. */
  private placeHollowStatue(state: FloorState, rng: Rng): void {
    const furniture = state.furniture ?? (state.furniture = []);
    const special = new Set((state.themes ?? []).map((t) => t.room));
    const floor = state as unknown as Parameters<typeof placeBell>[0];
    // Ni sur un PNJ, ni sur un objet, un monstre, un motif au sol ou une flaque.
    const avoid = (x: number, y: number) =>
      [state.gluck, state.soeur, state.krik, state.merchant].some((p) => p && p.x === x && p.y === y) ||
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
    const gold = this.rng.int(10, 20) + this.depth * 3;
    this.spillLoot(f.x, f.y, gold, rollLoot(this.rng, this.depth + RULES.floorsPerSection));
  }

  /** Salle d'essai : les PNJ de quête oublient tout et reviennent à leur première scène (Thomas, 2026-11-12). */
  resetDialogues(): void {
    if (!this.sandbox) return;
    this.gluckMemory = { met: 0, mood: 0, invested: 0 };
    this.soeurMemory = { met: 0 };
    this.krikMemory = { met: 0 };
    this.quest = null;
    for (const g of [this.current.gluck, this.current.soeur, this.current.krik]) {
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
      state.map.get(x, y) === Tile.Floor && !this.monsters.some((m) => m.x === x && m.y === y) && !state.furniture.some((f) => f.x === x && f.y === y) &&
      !(state.merchant && state.merchant.x === x && state.merchant.y === y) && !state.ground.some((g) => g.x === x && g.y === y) &&
      !(state.gluck && state.gluck.x === x && state.gluck.y === y) && !(state.soeur && state.soeur.x === x && state.soeur.y === y) &&
      !(state.krik && state.krik.x === x && state.krik.y === y)
    );
  }

  /** Gluck se tient dans une salle ordinaire (de préférence un dortoir ou une forge), loin de l'arrivée. */
  private placeGluck(state: FloorState, depth: number, rng?: Rng): GluckSpot | null {
    const free = (x: number, y: number) => this.npcFree(state, x, y);
    if (this.sandbox && depth === 1) {
      for (const [x, y] of [[20, 5], [21, 5], [20, 6], [22, 6]]) if (free(x, y)) return { x, y, gone: false };
      return null;
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
   * Krik se tient dans une forge ou un dortoir, sinon n'importe où sur du sol nu, salle ou COULOIR (fiche de Thomas),
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
    return id === "gluck" ? this.gluckMemory : id === "soeur" ? this.soeurMemory : this.krikMemory;
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
    return id === "gluck" ? this.gluckScene() : id === "soeur" ? this.soeurScene() : this.krikScene();
  }

  npcChoose(id: NpcId, choice: string): GluckResult {
    if (this.questWith(id)) return this.questChoose(id, choice);
    return id === "gluck" ? this.gluckChoose(choice) : id === "soeur" ? this.soeurChoose(choice) : this.krikChoose(choice);
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
      const at = this.landingCell(g, "or", g);
      this.dropItem(at.x, at.y, "or", g.gold);
      drops.push({ item: "or", x: at.x, y: at.y, count: g.gold });
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
    const bonus = stat === "force" ? this.pushBonus() : stat === "agilite" ? this.disengageBonus() : this.alloc[stat];
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
          leave,
        ],
      };
    }
    if (stage === 3) {
      return { lines, choices: [...GLUCK.invest.map((n) => ({ id: `invest${n}`, label: `Investir ${n} or`, off: noGold(n) })), { id: "decline", label: "Refuser poliment" }] };
    }
    return { lines, choices: [{ id: "ask", label: "« Et pour moi, un petit quelque chose ? »" }, leave] };
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
    const lines = SOEUR_OPENING[stage](!!this.soeurMemory.grudge);
    const leave = { id: "leave", label: "Partir" };
    if (stage === 1) {
      return {
        lines,
        choices: [
          { id: "console", label: "La consoler", stat: "charisme", dc: "medium" },
          { id: "explain", label: "Lui dire que la cloche est perdue (fondue pour son métal)", stat: "intelligence", dc: "medium" },
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
          this.grantProtection();
          return end(["« … Merci. Vous êtes moins grossier que vous n'en avez l'air. »", "(Protection : +1 classe d'armure pendant 150 tours.)"]);
        }
        return end(["« Vous êtes particulièrement mauvais en consolation. »"]);
      case "explain":
        if (test()) {
          this.clarityDepth = this.depth;
          return end(["« Fondue… Bien. Au moins, c'est clair. »", "(Clarté : le poison vous ronge deux fois moins longtemps, sur cet étage.)"]);
        }
        return end(["« Je préfère croire qu'ils savent jouer de la musique. »"]);
      case "punish":
        if (test()) {
          this.curseDepth = this.depth;
          if (this.giveTask("soeur_kobolds")) {
            return { lines: ["« Oui. OUI. Que leurs écailles tombent. »", "« Punissez-les. Puis revenez me raconter. »", "(Malédiction des Kobolds : +2 dégâts contre eux, sur cet étage.)"], roll, done: true };
          }
          return end(["« Oui. OUI. Que leurs écailles tombent. »", "(Malédiction des Kobolds : +2 dégâts contre eux, sur cet étage.)"]);
        }
        return end(["« Vous manquez de conviction. »"]);
      case "craft":
        if (test()) {
          this.grantLuck();
          return end(["Vous assemblez une gamelle, une cuillère et un bout de ficelle. Ding !", "« … C'est presque joli. »", "(Chance : vos 3 prochains 1 au dé seront relancés.)"]);
        }
        this.raiseAlarm(SOEUR.craftAlarm, g);
        return end(["Vous assemblez une gamelle, une cuillère et un bout de ficelle. CLONK !", "« Ce n'est pas une cloche. C'est une insulte. »"]);
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
        g.gold = (g.gold ?? 0) + this.rng.int(KRIK.hushMin, KRIK.hushMax);
        return end(["« Toi ? Tu ne protégerais pas une pomme. »", "« Tiens, prends ça et laisse-moi tranquille. C'est tout ce que je vaux. »", "(Il laisse quelques pièces.)"]);
      case "caches":
        if (test()) {
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
        if (test()) {
          const l = loot();
          leaves(l.item, l.count);
          return end(["« D'accord, d'accord ! Prends ça ! C'était volé de toute façon. »", "(Il lâche une partie de sa marchandise.)"]);
        }
        this.raiseAlarm(KRIK.shoutAlarm, g);
        this.callSlinger(g);
        return end(["« AU SECOURS ! UN AVENTURIER ME MENACE ! … C'est vrai, en plus. »", "(Un Kobold frondeur accourt.)"]);
      case "divert":
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
        for (const m of this.monsters) {
          if (m.boss) continue;
          m.alerted = false;
          m.wary = false;
        }
        this.lowerAlarm(KRIK.lieAlarm);
        return end(["Krik file voir ses anciens camarades. « L'aventurier ? Il est parti par là-bas. Très loin. Il a peur de vous. »", "« … Ils m'ont cru ! »", "(Les monstres perdent votre trace ; l'étage se calme.)"]);
      case "denounce":
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
    return def.kind === "fetch" ? this.inventory.count(def.item!) > 0 : q.got >= q.need;
  }

  /** Le texte du bandeau : l'objectif et où on en est, ou « revenir voir… » quand c'est fait. */
  questLine(): { text: string; done: boolean } | null {
    const q = this.quest;
    if (!q) return null;
    const def = QUEST_TASKS[q.id];
    const done = this.questDone();
    return { text: done ? def.back : def.goal.replace("{0}", String(Math.min(q.got, q.need))).replace("{1}", String(q.need)), done };
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
      need = Math.min(def.count ?? 1, this.monsters.filter((m) => isKobold(m) && !m.boss).length);
      if (need <= 0) return false;
    }
    if (def.kind === "fetch") {
      const at = this.questSpot();
      if (!at) return false;
      this.dropItem(at.x, at.y, def.item!, 1);
      this.revealRoomAt(at);
    }
    this.quest = { id, depth: this.depth, got: 0, need };
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
    for (let y = box.y - 1; y <= box.y + box.h; y++) for (let x = box.x - 1; x <= box.x + box.w; x++) if (this.map.inBounds(x, y)) this.explored[this.map.index(x, y)] = 1;
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
    }
    this.quest = null;
    this.events.push({ type: "quest", what: "complete", id: q.id });
    this.npcLeaves(id, g, this.npcMax(id));
    return { lines: def.thanks, done: true };
  }

  /** Descendre sans être revenu : la tâche est ratée, le PNJ s'en va. Le magot de Krik, lui, est gardé (en or). */
  private failQuest(): void {
    const q = this.quest!;
    const def = QUEST_TASKS[q.id];
    let gold: number | undefined;
    if (def.kind === "fetch" && this.inventory.take(def.item!, 1) && q.id === "krik_magot") {
      gold = KRIK.keptMagot;
      this.gold += gold;
    }
    const g = this.current[def.npc];
    if (g) g.gone = true;
    if (def.npc === "gluck") this.gluckMemory.mood = Math.max(-1, this.gluckMemory.mood - 1);
    this.quest = null;
    this.events.push({ type: "quest", what: "fail", id: q.id, gold });
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
    for (const m of this.monsters) {
      if (m.boss || Math.max(Math.abs(m.x - at.x), Math.abs(m.y - at.y)) > radius) continue;
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
  private callFoes(from: Point, kind: "frondeur" | "schrat", count: number): void {
    for (let n = 0; n < count; n++) this.callOne(from, kind);
  }

  private callOne(from: Point, kind: "frondeur" | "schrat"): void {
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
    return makeMerchant(at, room, rollWares(depth, seed), seed);
  }

  inCombat(): boolean {
    return this.monsters.some((m) => m.alerted && this.isVisible(m.x, m.y));
  }

  /** Le bruit d'un combat réveille les dormeurs proches : ils se lèvent et viennent (Thomas). */
  private wakeNear(at: Point): void {
    for (const m of this.monsters) {
      if (!m.asleep || Math.max(Math.abs(m.x - at.x), Math.abs(m.y - at.y)) > RULES.combatWakeRadius) continue;
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
    return (foes.length > 0 && this.map.isDoor(this.hero.x, this.hero.y)) || foes.some((m) => this.aroundCorner(m, this.hero));
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
    this.map.set(x, y, Tile.DoorClosed);
    this.refreshLight();
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
    } else if (t === Tile.Chest) {
      this.map.set(x, y, Tile.ChestOpen);
      const gold = (this.rng.int(RULES.chestGoldMin, RULES.chestGoldMax) + this.depth * RULES.chestGoldPerDepth) * (this.current.boss ? 2 : 1);
      // Coffre de la forge : une arme ; de l'alchimiste : une potion (Thomas). Ailleurs, un objet au hasard.
      const theme = this.themeAt(x, y);
      const pool = theme === "forge" ? lootPool(this.depth, (k) => k === "melee" || k === "ranged") : theme === "alchimiste" ? lootPool(this.depth, (_, id) => id.startsWith("potion_")) : [];
      // Coffre du boss : un objet RARE à coup sûr, et plus d'or.
      const bossChest = this.current.boss && this.current.boss.chest.x === x && this.current.boss.chest.y === y;
      if (bossChest) pool.push(...lootPool(this.depth, () => true, "rare"));
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
      this.dropItem(goldAt.x, goldAt.y, "or", gold);
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
    const success = d20 === 20 || (d20 !== 1 && total >= RULES.maidenDc);
    const damage = success ? 0 : rollDice(this.rng, RULES.maidenSpike);
    maiden.kind = "maidenOpen";
    this.map.touch(at.x, at.y);
    if (action === "break") {
      this.reveal();
      this.raiseAlarm(RULES.alarmMaiden, at);
    }
    const gold = this.rng.int(RULES.chestGoldMin, RULES.chestGoldMax) + this.depth * RULES.chestGoldPerDepth;
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
    const bonus = action === "pick" ? this.heroClass.lockpickBonus + this.alloc.agilite : this.heroClass.breakBonus + this.alloc.force;
    const dc = action === "pick" ? RULES.lockpickDc : RULES.breakDc;
    const d20 = this.rng.int(1, 20);
    const total = d20 + bonus;
    const success = d20 === 20 || (d20 !== 1 && total >= dc);
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
    this.events.push({ type: "door", action, x: door.x, y: door.y, d20, bonus, total, dc, success, alerted });
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
  private heroAttacks(monster: Actor, extra = false): void {
    this.reveal();
    this.lastFoeId = monster.id;
    // Un monstre qui n'a rien remarqué est attaqué avec avantage (deux d20, on garde le meilleur).
    // De même contre un monstre pris dans l'encadrement d'une porte : celui qui attend derrière a l'avantage.
    let damageBonus = 0;
    // Rage (voie rouge) : plus de dégâts sous la moitié des PV.
    if (this.rank("rage") > 0 && this.hero.hp * 2 < this.hero.maxHp) damageBonus += this.rank("rage");
    damageBonus += this.curseBonusOn(monster);
    const attacker = { attackBonus: this.hero.attackBonus + this.streakBonus(), damage: { ...this.hero.damage, bonus: this.hero.damage.bonus + damageBonus } };
    const critFrom = 20 - this.rank("coup_puissant");
    const advantaged = this.heroHasAdvantageOn(monster);
    const result = rollAttack(this.rng, attacker, monster, advantaged ? "advantage" : "normal", critFrom, () => this.useLuck());
    this.hero.lastAdvantageOn = advantaged ? monster.id : undefined;
    this.noteHeroAttack(result.hit);
    if (!extra) {
      // Vitesse de l'arme : une attaque lente laisse plus de temps aux monstres, une rapide moins.
      const speed = this.weapon("melee")?.speed;
      this.actionCost = speed === "slow" ? RULES.slowAttackTurns : speed === "fast" ? RULES.fastAttackTurns : 1;
    }
    monster.alerted = true;
    monster.asleep = false;
    const intact = monster.hp >= monster.maxHp;
    monster.hp -= result.damage;
    this.events.push({ type: "attack", attacker: this.hero, target: monster, result });
    // Arme lourde (épée longue) : un grand d20 assomme la cible, qui perd son prochain tour.
    const stunOn = this.weapon("melee")?.stunOn;
    if (result.hit && stunOn && result.d20 >= stunOn && monster.hp > 0 && !monster.boss) {
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
      monster.poison = { damage: 1, turns: 4 };
      this.events.push({ type: "poisoned", actor: monster });
    }
    const wasAlive = this.monsters.includes(monster);
    this.removeIfDead(monster);
    // Enchaînement (voie rouge) : tuer rend une double frappe.
    if (wasAlive && !this.monsters.includes(monster) && this.perks().chainRefunds < this.rank("enchainement")) {
      this.perks().chainRefunds++;
      this.perks().doubleStrikes = Math.min(this.rank("double_frappe"), this.perks().doubleStrikes + 1);
    }
    // Potion de vitesse : un second coup, s'il reste debout.
    if (!extra && this.hasteTurns > 0 && this.monsters.includes(monster)) this.heroAttacks(monster, true);
  }

  /** Projeté par un coup critique : une case dans l'axe du héros, si elle est libre ; il peut tomber sur un piège. */
  private knockBack(m: Actor): void {
    const dx = Math.sign(m.x - this.hero.x);
    const dy = Math.sign(m.y - this.hero.y);
    const to = { x: m.x + dx, y: m.y + dy };
    const free = this.map.isWalkable(to.x, to.y) && this.map.get(to.x, to.y) !== Tile.DoorClosed && !this.actorAt(to.x, to.y) &&
      canStep(this.map, m.x, m.y, dx, dy) && !this.npcAt(to.x, to.y);
    if (!free) return;
    const from = { x: m.x, y: m.y };
    m.x = to.x;
    m.y = to.y;
    this.events.push({ type: "heavyBlow", actor: m, kind: "knockback", fromX: from.x, fromY: from.y });
    this.springTrap(m);
  }

  /** `byHero` faux : tué par un autre monstre (querelle) ; pas d'expérience pour le héros. */
  private removeIfDead(monster: Actor, byHero = true): void {
    if (monster.hp > 0) return;
    this.monsters.splice(this.monsters.indexOf(monster), 1);
    this.closeDoorAt(monster.x, monster.y);
    this.events.push({ type: "death", actor: monster });
    // Butin : de l'expérience à coup sûr, parfois quelques pièces qui tombent au sol.
    const def = MONSTERS[monster.defId as keyof typeof MONSTERS];
    if (monster.purse) this.dropItem(monster.x, monster.y, "or", monster.purse);
    else if (def && this.rng.chance(def.goldChance)) this.dropItem(monster.x, monster.y, "or", this.rng.int(1, def.goldMax));
    // Le boss vaincu relève d'abord le niveau maximal : son XP compte.
    if (monster.boss) this.bossDefeated();
    if (def && byHero) {
      // XP encore divisée par deux (Thomas, 2026-11-12, soir : « je monte trop vite ») : les demi-points s'accumulent.
      this.xpCarry += this.rng.int(def.xpMin, def.xpMax) * RULES.xpGainFactor;
      const gain = Math.floor(this.xpCarry + 1e-9);
      this.xpCarry -= gain;
      if (gain > 0) this.gainXp(gain);
    }
    const q = this.quest;
    if (byHero && q && q.depth === this.depth && QUEST_TASKS[q.id].kind === "kill" && isKobold(monster) && q.got < q.need) q.got++;
    for (const o of this.monsters) if (o.feud === monster.id) o.feud = undefined;
  }

  /**
   * Tir à l'arc vers une case. La flèche file en ligne droite : elle s'arrête sur le premier monstre rencontré
   * (jet d'attaque), rebondit d'une case sur un mur, une colonne ou une porte fermée, ou se plante dans la case visée.
   */
  private heroShoots(target: Point): void {
    const profile = this.shotProfile();
    const ammo = this.currentAmmo();
    if (!profile || !ammo || !this.inventory.take(ammo, 1)) return;
    const poison = (ITEMS[ammo] as ItemDef).poison;
    this.reveal();
    const origin = { x: this.hero.x, y: this.hero.y };
    const trail: Point[] = [origin];
    let landing: Point = origin;
    let via: Point | undefined;
    let hit = false;
    let keepChance = RULES.arrowKeepOnScenery;
    let victim: Actor | undefined;

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
      const favoured =
        !blind && this.hero.lastAdvantageOn !== victim.id && (!victim.alerted || (!victim.wary && this.map.isDoor(victim.x, victim.y)));
      const threatened = blind || this.monsters.some((m) => m.alerted && this.inReach(m, this.hero));
      const mode = favoured && !threatened ? "advantage" : threatened && !favoured ? "disadvantage" : "normal";
      // Dans un couloir d'une case de large, la flèche n'a guère où passer à côté : bonus au jet.
      const open = (dx: number, dy: number) => this.map.isWalkable(victim!.x + dx, victim!.y + dy);
      const narrow = (!open(-1, 0) && !open(1, 0)) || (!open(0, -1) && !open(0, 1));
      // L'arc (ou la main qui lance) donne le jet ; la flèche (ou la javeline) donne les dégâts (Thomas, 2026-11-11).
      const attackBonus = profile.attackBonus + this.rangedBonus() + (narrow ? RULES.narrowShotBonus : 0) + this.streakBonus();
      const ammoDamage = (ITEMS[ammo] as ItemDef).damage ?? UNARMED.damage;
      const result = rollAttack(this.rng, { attackBonus, damage: { ...ammoDamage, bonus: ammoDamage.bonus + this.curseBonusOn(victim) } }, victim, mode, 20, () => this.useLuck());
      this.hero.lastAdvantageOn = mode === "advantage" ? victim.id : undefined;
      this.noteHeroAttack(result.hit);
      victim.alerted = true;
      victim.asleep = false;
      victim.hp -= result.damage;
      this.events.push({ type: "attack", attacker: this.hero, target: victim, result, ranged: true });
      if (result.damage > 0) this.bleed(victim, origin);
      hit = result.hit;
      if (hit && poison && victim.hp > 0) {
        // Un nouveau poison remet le compteur à zéro, il ne s'ajoute pas (C).
        victim.poison = { ...poison };
        this.events.push({ type: "poisoned", actor: victim });
      }
      if (hit) {
        keepChance = RULES.arrowKeepOnHit;
      } else {
        // Ratée : elle continue tout droit au-delà de la cible.
        keepChance = RULES.arrowKeepOnMiss;
        const dx = victim.x - origin.x;
        const dy = victim.y - origin.y;
        const n = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
        for (let k = 1; k <= RULES.arrowOvershoot; k++) {
          if (!fly({ x: Math.round(victim.x + (dx / n) * k), y: Math.round(victim.y + (dy / n) * k) })) break;
        }
      }
    }

    const kept = this.rng.chance(keepChance);
    // Orientation au sol : plantée dans le sens du tir, ou couchée de travers après un rebond.
    const end = trail[trail.length - 1];
    const flight = Math.atan2(end.y - origin.y, end.x - origin.x);
    const angle = via ? flight + Math.PI + (this.rng.next() - 0.5) * 2.2 : flight + (this.rng.next() - 0.5) * 0.3;
    const javelin = ammo === "javeline" || undefined;
    if (kept) this.dropItem(landing.x, landing.y, ammo, 1, angle);
    else this.debris.push({ x: landing.x, y: landing.y, angle, until: this.turn + RULES.brokenArrowTurns, javelin });
    this.events.push({ type: "arrow", fromX: origin.x, fromY: origin.y, x: landing.x, y: landing.y, via, hit, kept, javelin });
    if (victim) this.removeIfDead(victim);
    // Leurre : une flèche qui se plante dans une toile la fait vibrer ; la Tisseuse y accourt.
    else this.lureBoss(landing);
  }

  private dropItem(x: number, y: number, item: ItemId, count: number, angle?: number): void {
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
    this.ground = this.ground.filter((g) => g.count > 0);
    return left === 0 && this.itemsHere().some((g) => g.item === item);
  }

  private monstersAct(): void {
    for (const m of [...this.monsters]) {
      if (this.over) return;
      if (!this.monsters.includes(m)) continue;
      if (m.boss) {
        this.bossAct(m);
        continue;
      }
      if (m.stunned) {
        // Sonné par une poussée : il perd ce tour.
        m.stunned--;
        continue;
      }
      if (m.slowed) {
        // Ralenti (bousculade) : il ne joue qu'un tour sur deux.
        m.slowed--;
        if (m.slowed % 2 === 0) continue;
      }
      if (m.feud !== undefined && this.feudAct(m)) continue;
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
        const range = this.hidden || this.fogAt(this.hero.x, this.hero.y) ? 1 : m.asleep ? Math.min(m.vision, RULES.asleepHearing) : m.vision;
        const inSight = distance <= 1 || ((m.asleep || this.inGaze(m, this.hero)) && !this.fogBetween(m, this.hero));
        if (this.isVisible(m.x, m.y) && distance <= range && inSight && this.rng.chance(chance)) {
          this.faceToward(m, this.hero);
          m.alerted = true;
          m.asleep = false;
          this.events.push({ type: "noticed", actor: m });
          this.raiseAlarm(RULES.alarmNoticed);
          this.reveal();
        } else if (!m.asleep) {
          this.wander(m);
        }
        continue;
      }

      // Kobold frondeur : il tire de loin et garde ses distances (recule, de préférence près d'une colonne ou d'un meuble).
      const slinger = (MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef).sling;
      if (slinger && this.slingerAct(m, slinger, distance)) continue;

      if (this.inReach(m, this.hero)) {
        // Embuscade : le monstre a l'avantage sur un héros pris dans une porte, ou qu'il frappe au coin d'un mur.
        // Jamais deux avantages de suite sur le héros (Thomas) : après un coup avec avantage, il se reprend.
        const ambush = m.lastAdvantageOn !== this.hero.id && (this.map.isDoor(this.hero.x, this.hero.y) || this.aroundCorner(m, this.hero));
        this.faceToward(m, this.hero);
        const result = rollAttack(this.rng, m, this.hero, ambush ? "advantage" : "normal");
        m.lastAdvantageOn = ambush ? this.hero.id : undefined;
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
        this.raiseAlarm(RULES.alarmCombat, this.hero);
        this.wakeNear(this.hero);
        this.hurtHero(result.damage, this.killerName(m));
        // Potion d'oursin (Thomas, 2026-11-12, soir) : 15 % des dégâts reçus au contact reviennent à l'attaquant.
        if (this.urchinTurns > 0 && result.damage > 0 && !this.over) {
          const back = Math.max(1, Math.round(result.damage * RULES.urchinReflect));
          m.hp -= back;
          this.events.push({ type: "thorns", actor: m, damage: back });
          this.removeIfDead(m);
        }
        continue;
      }

      // L'araignée fond sur sa proie : deux pas par tour (elle s'arrête si elle arrive au contact).
      const steps = (MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef).chaseSteps ?? 1;
      for (let i = 0; i < steps && !this.inReach(m, this.hero); i++) if (!this.stepToward(m, this.hero)) break;
      this.faceToward(m, this.hero);
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
        this.faceToward(m, hero);
        m.x = away.x;
        m.y = away.y;
        this.closeDoorAt(left.x, left.y);
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
    const result = rollAttack(this.rng, { attackBonus: sling.attackBonus, damage: sling.damage }, hero, covered ? "disadvantage" : "normal");
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
  private stepAway(m: Actor): Point | null {
    const d0 = Math.max(Math.abs(m.x - this.hero.x), Math.abs(m.y - this.hero.y));
    let best: Point | null = null;
    let bestScore = -Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = m.x + dx;
        const y = m.y + dy;
        if (!canStep(this.map, m.x, m.y, dx, dy) || this.actorAt(x, y) || this.isTrap(x, y) || this.isBurning(x, y) || this.map.isDoor(x, y)) continue;
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
    const step = findPath(this.map, m, target, this.avoidTraps(target, undefined, m))?.[0];
    if (!step) return false;
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

  private startFeud(a: Actor, b: Actor, reason: "blocked" | "shot"): void {
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
    this.visible = computeFov(this.map, this.hero, this.race.darkVision, this.race.sight, this.light);
    this.completeCorners();
    for (let i = 0; i < this.visible.length; i++) {
      if (this.visible[i]) this.explored[i] = 1;
    }
    this.senseBeyond();
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
    // Descendre sans être revenu voir le PNJ : la tâche est ratée (Thomas, 2026-11-12 : il reste sur l'étage).
    if (direction === "down" && this.quest && this.quest.depth === this.depth) this.failQuest();
    this.enterFloor(target, direction);
    this.events.push({ type: "stairs", direction, healed });
    if (direction === "down") this.settleKrik();
    return true;
  }
}

/** Un Kobold (ou un frondeur) : la famille que punit Sœur Osseuse et que fuit Krik. */
function isKobold(m: Actor): boolean {
  return m.defId === "schrat" || m.defId === "frondeur";
}
