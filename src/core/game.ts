import { CLASSES, ClassDef } from "../data/classes";
import { DEFAULT_FLOOR, FloorConfig } from "../data/floors";
import { ITEMS, ItemDef, ItemId, Slot, UNARMED, UNARMORED_AC } from "../data/items";
import { MONSTERS, spawnsForDepth, MonsterDef } from "../data/monsters";
import { RACES, RaceDef } from "../data/races";
import { RULES } from "../data/rules";
import { Actor } from "../entities/actor";
import { BagItem, Inventory } from "../items/inventory";
import { computeFov, computeLight, LightSource, lineBetween } from "../world/fov";
import { generateFloor, Room } from "../world/generator";
import { GameMap, Point, Tile } from "../world/map";
import { canStep, findPath } from "../world/pathfinding";
import { AttackResult, rollAttack } from "./combat";
import { floorSeed, Rng } from "./rng";

/** Ce qui s'est passé pendant un tour, pour que l'affichage puisse le montrer. */
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
  /** Fouille : commencée, interrompue, ou finie avec le jet et les cases où l'on a trouvé quelque chose. */
  | { type: "search"; phase: "start" | "interrupted" }
  | { type: "searched"; d20: number; bonus: number; total: number; success: boolean; found: Point[]; room: Room }
  /** Repos : commencé, mené à son terme (avec les PV rendus) ou interrompu par un monstre. */
  | { type: "rest"; phase: "start" | "done" | "interrupted"; healed: number }
  | { type: "chest"; gold: number }
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

/** Tout ce qu'il faut garder d'un étage pour le retrouver tel quel en y revenant. */
interface FloorState {
  map: GameMap;
  start: Point;
  stairs: Point;
  rooms: Room[];
  torches: LightSource[];
  monsters: Actor[];
  ground: GroundItem[];
  debris: Debris[];
  explored: Uint8Array;
  sensed: Uint8Array;
  rng: Rng;
  seenMonsters: Set<number>;
  /** Repeuplement : nombre de monstres à l'origine, et tour du prochain renfort possible. */
  population: number;
  nextRespawn: number;
  /** Le héros s'est déjà reposé sur cet étage (un seul repos par étage). */
  rested: boolean;
  /** Caches de l'étage (butin enfoui dans une salle) et salles déjà fouillées (une fouille par salle). */
  secrets: Secret[];
  searched: Set<number>;
}

/** Une cache : un objet enfoui dans une salle, invisible tant qu'une fouille réussie ne l'a pas trouvé. */
export interface Secret {
  x: number;
  y: number;
  room: number;
  item: ItemId;
  count: number;
  found: boolean;
}

/** Débris sans usage (flèche brisée) : il reste au sol jusqu'au tour `until`, puis disparaît. */
export interface Debris {
  x: number;
  y: number;
  angle: number;
  until: number;
}

/** Un objet posé au sol. */
export interface GroundItem {
  x: number;
  y: number;
  item: ItemId;
  count: number;
  /** Orientation de l'objet posé au sol (radians), pour les flèches : dans quel sens elle est tombée ou plantée. */
  angle?: number;
}

/** Crocheter (silencieux) ou enfoncer (bruyant) une porte verrouillée. */
export type DoorAction = "pick" | "break" | "key";

/** État complet d'une partie. Ne connaît ni l'écran ni le tactile. */
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
  /** Le sac du héros, et à part ce qu'il porte sur lui : un objet par emplacement. */
  inventory = new Inventory();
  equipment: Record<Slot, BagItem | null> = { amulet: null, hat: null, artifact: null, armor: null, melee: null, ranged: null };
  /** Objets au sol sur l'étage courant (flèches à ramasser). */
  ground: GroundItem[] = [];
  /** Bourse, expérience et niveau du héros. */
  gold = 0;
  xp = 0;
  level = 1;
  /** Flèches brisées encore visibles au sol. */
  debris: Debris[] = [];
  /** Événements en attente d'affichage ; l'affichage les lit puis vide la liste. */
  events: GameEvent[] = [];

  private rng!: Rng;
  private nextId = 1;
  private targetId: number | null = null;
  private waiting = false;
  /** Attaques du héros manquées d'affilée. */
  heroMisses = 0;
  private picking = false;
  /** Le héros est caché : les monstres l'ont perdu de vue et ne le remarquent plus que s'ils arrivent à son contact. */
  hidden = false;
  /** Ordres de la roue d'actions en attente : se cacher, ou sauter vers une case. */
  private hideOrder = false;
  private jumpTarget: Point | null = null;
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
      this.current.monsters = this.monsters;
      this.current.ground = this.ground;
      this.current.debris = this.debris;
    }
    let state = this.floors.get(depth);
    const fresh = !state;
    if (!state) {
      const seed = floorSeed(this.runSeed, depth);
      const floor = generateFloor(seed, this.floorConfig);
      // À partir du deuxième étage, un escalier remonte depuis le point d'arrivée.
      if (depth > 1) floor.map.set(floor.start.x, floor.start.y, Tile.StairsUp);
      state = {
        map: floor.map,
        start: floor.start,
        stairs: floor.stairs,
        rooms: floor.rooms,
        torches: floor.torches,
        monsters: [],
        ground: [],
        debris: [],
        explored: new Uint8Array(floor.map.width * floor.map.height),
        sensed: new Uint8Array(floor.map.width * floor.map.height),
        rng: new Rng(seed ^ 0x5bd1e995), // hasard des combats et des monstres, propre à l'étage
        seenMonsters: new Set<number>(),
        population: 0,
        nextRespawn: 0,
        rested: false,
        secrets: [],
        searched: new Set<number>(),
      };
      this.floors.set(depth, state);
    }
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
    this.hidden = false;
    this.hideOrder = false;
    this.jumpTarget = null;
    this.shotTarget = null;
    this.pendingStairs = null;
    this.clearDoorOrders();
    this.light = computeLight(this.map, this.torches);
    if (fresh) {
      this.spawnMonsters(state.rooms);
      state.population = Math.max(1, this.monsters.length);
      state.nextRespawn = this.turn + RULES.respawnTurns;
      this.placeKey(state.rooms);
      this.placeSecrets(state, floorSeed(this.runSeed, depth));
    }
    for (const m of this.monsters) {
      m.fromX = m.x;
      m.fromY = m.y;
    }
    this.updateVision();
  }

  private spawnMonsters(rooms: Room[]): void {
    const spawns = spawnsForDepth(this.depth);
    const totalWeight = spawns.entries.reduce((sum, e) => sum + e.weight, 0);
    for (const room of rooms.slice(1)) {
      if (!this.rng.chance(spawns.roomChance)) continue;
      let pick = this.rng.next() * totalWeight;
      const entry = spawns.entries.find((e) => (pick -= e.weight) < 0) ?? spawns.entries[0];
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
    }
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
    };
  }

  /**
   * Repeuplement : de temps en temps, si l'étage a perdu des monstres, un promeneur arrive dans une salle
   * hors de vue et loin du héros. L'étage ne dépasse jamais sa population d'origine.
   */
  private respawn(): void {
    const state = this.current;
    if (this.turn < state.nextRespawn) return;
    state.nextRespawn = this.turn + RULES.respawnTurns;
    if (this.monsters.length >= state.population || this.rooms.length === 0) return;
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

  /** Avec un peu de chance, une clef traîne dans une salle de l'étage. */
  /** Éléments d'une salle (colonnes, cheminée) : plus il y en a, plus elle a de chances de cacher quelque chose. */
  roomElements(room: Room): number {
    let pillars = false;
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) if (this.map.get(x, y) === Tile.Pillar) pillars = true;
    }
    const hearth = this.torches.some(
      (t) => t.hearth && t.x >= room.x - 1 && t.x <= room.x + room.w && t.y >= room.y - 1 && t.y <= room.y + room.h,
    );
    return (pillars ? 1 : 0) + (hearth ? 1 : 0);
  }

  /** Enfouit des caches dans les salles garnies : une salle vide n'en a jamais. Hasard à part, pour ne rien changer au reste. */
  private placeSecrets(state: FloorState, seed: number): void {
    const rng = new Rng(seed ^ 0x2c1b3c6d);
    state.rooms.forEach((room, index) => {
      if (index === 0) return; // salle de départ
      const chance = Math.min(RULES.secretChanceMax, RULES.secretChancePerElement * this.roomElements(room));
      if (chance <= 0 || !rng.chance(chance)) return;
      for (let attempt = 0; attempt < 20; attempt++) {
        const x = rng.int(room.x, room.x + room.w - 1);
        const y = rng.int(room.y, room.y + room.h - 1);
        if (this.map.get(x, y) !== Tile.Floor) continue;
        const gold = rng.chance(RULES.secretGoldChance);
        state.secrets.push({
          x,
          y,
          room: index,
          item: gold ? "or" : "fleche",
          count: gold
            ? rng.int(RULES.secretGoldMin, RULES.secretGoldMax) + RULES.secretGoldPerDepth * (this.depth - 1)
            : rng.int(RULES.secretArrowsMin, RULES.secretArrowsMax),
          found: false,
        });
        return;
      }
    });
  }

  /** La salle où se tient le héros (son numéro), ou -1 dans un couloir. */
  roomIndexAt(p: Point): number {
    return this.rooms.findIndex((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
  }

  private placeKey(rooms: Room[]): void {
    if (!this.rng.chance(RULES.keyChance)) return;
    for (let attempt = 0; attempt < 30; attempt++) {
      const room = rooms[this.rng.int(0, rooms.length - 1)];
      const x = this.rng.int(room.x, room.x + room.w - 1);
      const y = this.rng.int(room.y, room.y + room.h - 1);
      if (this.map.get(x, y) !== Tile.Floor || (x === this.hero.x && y === this.hero.y)) continue;
      this.ground.push({ x, y, item: "clef", count: 1 });
      return;
    }
  }

  // ---------- Consultation ----------

  monsterAt(x: number, y: number): Actor | undefined {
    return this.monsters.find((m) => m.x === x && m.y === y);
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
    return this.monsters.filter((m) => this.isVisible(m.x, m.y));
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
    if (kind === "ammo" || kind === "key" || kind === "gold") return false;
    const previous = this.equipment[kind];
    const from = { x: item.x, y: item.y };
    this.inventory.removeItem(uid);
    if (previous && !this.inventory.placeItem(previous)) {
      // Pas de place pour ranger l'ancien : on annule.
      item.x = from.x;
      item.y = from.y;
      this.inventory.items.push(item);
      return false;
    }
    this.equipment[kind] = item;
    this.refreshStats();
    return true;
  }

  /** Retire ce qui est porté à cet emplacement et le range dans le sac, s'il y a de la place. */
  unequip(slot: Slot): boolean {
    const item = this.equipment[slot];
    if (!item || !this.inventory.placeItem(item)) return false;
    this.equipment[slot] = null;
    this.refreshStats();
    return true;
  }

  /** L'attaque du héros vient de son arme de mêlée (ou de ses poings), sa classe d'armure de son armure. */
  private refreshStats(): void {
    const melee = this.weapon("melee");
    this.hero.attackBonus = melee?.attackBonus ?? UNARMED.attackBonus;
    this.hero.damage = melee?.damage ?? UNARMED.damage;
    const armor = this.equipment.armor;
    this.hero.armorClass = (armor && (ITEMS[armor.defId] as ItemDef).armorClass) || UNARMORED_AC;
  }

  /** Expérience à réunir pour passer au niveau suivant. */
  xpToNext(): number {
    return RULES.xpPerLevel * this.level;
  }

  private gainXp(amount: number): void {
    if (amount <= 0) return;
    this.xp += amount;
    this.events.push({ type: "xp", amount });
    while (this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.level++;
      // PROPOSITION à valider : un niveau donne quelques points de vie de plus, et rien d'autre pour l'instant.
      this.hero.maxHp += RULES.hpPerLevel;
      this.hero.hp += RULES.hpPerLevel;
      this.events.push({ type: "levelup", level: this.level });
    }
  }

  arrows(): number {
    const ammo = this.weapon("ranged")?.ammo;
    return ammo ? this.inventory.count(ammo as ItemId) : 0;
  }

  // ---------- Ordres du joueur ----------

  /**
   * Tirer une flèche vers une case en vue, quelle qu'elle soit : monstre, sol, mur, porte.
   * Renvoie la raison du refus, ou null si le tir est lancé.
   */
  shoot(x: number, y: number): ShootRefusal | null {
    const bow = this.weapon("ranged");
    if (this.over || !bow) return "no-bow";
    if (this.arrows() < 1) return "no-ammo";
    // On peut tirer vers une case qu'on ne voit pas (à l'aveugle), mais pas sur soi ni hors de la carte.
    if (!this.map.inBounds(x, y) || (x === this.hero.x && y === this.hero.y)) return "no-target";
    const distance = Math.max(Math.abs(x - this.hero.x), Math.abs(y - this.hero.y));
    if (distance > (bow.range ?? 0)) return "out-of-range";
    this.clearDoorOrders();
    this.path = [];
    this.targetId = null;
    this.waiting = false;
    this.picking = false;
    this.resting = 0;
    this.searching = 0;
    this.hideOrder = false;
    this.jumpTarget = null;
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
      // Retoucher sa propre case : ramasser ce qui s'y trouve, sinon passer un tour.
      if (!this.pickUp()) this.wait();
      return true;
    }
    if (this.map.get(x, y) === Tile.DoorLocked && (ignoreFog || this.isExplored(x, y))) {
      return this.approachLockedDoor(x, y, ignoreFog);
    }
    const seen = this.monsterAt(x, y);
    const monster = seen && this.isVisible(x, y) ? seen : undefined;
    // Vers un monstre en vue, on trouve toujours un chemin ; sinon on ne passe que par les cases déjà vues.
    const known = ignoreFog || monster ? undefined : (cx: number, cy: number) => this.isKnown(cx, cy);
    const path = findPath(this.map, this.hero, { x, y }, known);
    if (!path) return false;
    this.clearDoorOrders();
    this.targetId = monster ? monster.id : null;
    this.path = path;
    this.waiting = false;
    this.picking = false;
    this.resting = 0;
    this.searching = 0;
    this.hideOrder = false;
    this.jumpTarget = null;
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
      const path = findPath(this.map, this.hero, { x: nx, y: ny }, known);
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
    this.path = best;
    if (best.length === 0) {
      this.pendingDoor = { x, y };
      this.useKeyIfAny();
    } else this.doorTarget = { x, y };
    return true;
  }

  /** Devant une porte verrouillée, la clef de l'étage sert d'elle-même : ce sera l'action du prochain tour. */
  private useKeyIfAny(): void {
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
    const options: DoorAction[] = [];
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
    this.pendingDoor = null;
    this.doorTarget = null;
    this.doorAction = null;
  }

  /** Déplacement ou attaque d'une case (clavier). */
  moveBy(dx: number, dy: number): boolean {
    if (this.over) return false;
    if ((dx === 0 || dy === 0) && this.map.get(this.hero.x + dx, this.hero.y + dy) === Tile.DoorLocked) {
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
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) if (this.map.get(p.x + dx, p.y + dy) === Tile.Pillar) return true;
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
  hideRefusal(): "hidden" | "threatened" | "no-cover" | null {
    if (this.hidden) return "hidden";
    if (this.isThreatened()) return "threatened";
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
        for (let i = 0; i < RULES.jumpDistance && ok; i++) {
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

    const wasResting = this.resting > 0;
    const wasSearching = this.searching > 0;
    const shotTarget = this.shotTarget;
    this.shotTarget = null;
    if (shotTarget) {
      this.heroShoots(shotTarget);
    } else if (this.doorAction && this.pendingDoor) {
      this.resolveDoor(this.doorAction, this.pendingDoor);
      this.doorAction = null;
    } else if (this.picking) {
      // Les objets identiques restés sur la case suivent d'eux-mêmes, un par tour.
      this.picking = this.pickUpOne();
    } else if (this.hideOrder) {
      this.hideOrder = false;
      this.resolveHide();
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
        this.path = target ? (this.inReach(this.hero, target) ? [{ x: target.x, y: target.y }] : (findPath(this.map, this.hero, target) ?? [])) : [];
        if (!target) this.targetId = null;
      }
      const next = this.path[0];
      if (!next) return false;
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
        if (this.path.length === 0 && this.doorTarget) {
          // Arrivé devant la porte verrouillée : au joueur de décider.
          this.pendingDoor = this.doorTarget;
          this.doorTarget = null;
          this.useKeyIfAny();
        }
      }
    }

    this.turn++;
    this.respawn();
    if (this.debris.some((d) => d.until <= this.turn)) this.debris = this.debris.filter((d) => d.until > this.turn);
    this.updateVision();
    const resting = wasResting;
    this.monstersAct();
    if (resting) this.afterRestTurn();
    if (wasSearching) this.afterSearchTurn();
    return true;
  }

  /** Jet pour se cacher. Réussi : les monstres perdent la trace du héros et redeviennent de simples promeneurs. */
  private resolveHide(): void {
    const bonus = this.heroClass.stealthBonus;
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
      }
    }
    this.events.push({ type: "hide", d20, bonus, total, success });
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
    const bonus = this.heroClass.disengageBonus;
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
      const healed = Math.ceil((this.hero.maxHp - this.hero.hp) * RULES.restHealShare);
      this.hero.hp += healed;
      this.current.rested = true;
      this.events.push({ type: "rest", phase: "done", healed });
    }
  }

  /**
   * Vrai si `a` peut frapper `b` : case voisine. En diagonale, on peut frapper par-delà un coin de mur,
   * mais pas à travers deux murs qui se touchent par le coin.
   */
  private inReach(a: Point, b: Point): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return false;
    if (dx === 0 || dy === 0) return true;
    return this.map.isWalkable(a.x + dx, a.y) || this.map.isWalkable(a.x, a.y + dy);
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
    if (!monster.alerted) return true;
    // Un avantage à la fois : le monstre semé en passant une porte s'attend à l'embuscade.
    if (monster.wary) return false;
    return this.map.isDoor(monster.x, monster.y) || this.aroundCorner(this.hero, monster);
  }

  /** Un ennemi alerté est-il au contact du héros ? */
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
      this.hero.hp = Math.max(0, this.hero.hp - result.damage);
      this.events.push({ type: "attack", attacker: m, target: this.hero, result, opportunity: true });
      attacked = true;
      if (this.hero.hp === 0) {
        this.over = true;
        this.events.push({ type: "death", actor: this.hero });
      }
    }
    return attacked;
  }

  /** Entrer dans une porte fermée l'ouvre ; la lumière et la vue passent alors au travers. */
  private openDoorAt(x: number, y: number): void {
    if (this.map.get(x, y) !== Tile.DoorClosed) return;
    this.map.set(x, y, Tile.DoorOpen);
    this.light = computeLight(this.map, this.torches);
    this.events.push({ type: "opened", x, y });
  }

  /** Une porte se referme dès que plus personne ne se tient dans son encadrement. */
  private closeDoorAt(x: number, y: number): void {
    if (this.map.get(x, y) !== Tile.DoorOpen || this.actorAt(x, y)) return;
    this.map.set(x, y, Tile.DoorClosed);
    this.light = computeLight(this.map, this.torches);
  }

  /** Ce qui se déclenche quand le héros marche sur une case particulière (fontaine, coffre). */
  private useFeatureAt(x: number, y: number): void {
    const t = this.map.get(x, y);
    if (t === Tile.Fountain) {
      const healed = this.hero.maxHp - this.hero.hp;
      this.hero.hp = this.hero.maxHp;
      this.map.set(x, y, Tile.FountainDry);
      this.events.push({ type: "fountain", healed });
    } else if (t === Tile.Chest) {
      this.map.set(x, y, Tile.ChestOpen);
      const gold = this.rng.int(RULES.chestGoldMin, RULES.chestGoldMax) + this.depth * RULES.chestGoldPerDepth;
      this.gold += gold;
      this.events.push({ type: "chest", gold });
    }
  }

  private resolveDoor(action: DoorAction, door: Point): void {
    if (action === "key") {
      // La clef ouvre sans jet, sans alerter personne (juste le bruit de la serrure) ; elle est consommée.
      if (!this.inventory.take("clef", 1, this.depth)) return;
      this.map.set(door.x, door.y, Tile.DoorOpen);
      this.light = computeLight(this.map, this.torches);
      this.pendingDoor = null;
      this.events.push({ type: "door", action, x: door.x, y: door.y, d20: 0, bonus: 0, total: 0, dc: 0, success: true, alerted: 0 });
      return;
    }
    const bonus = action === "pick" ? this.heroClass.lockpickBonus : this.heroClass.breakBonus;
    const dc = action === "pick" ? RULES.lockpickDc : RULES.breakDc;
    const d20 = this.rng.int(1, 20);
    const total = d20 + bonus;
    const success = d20 === 20 || (d20 !== 1 && total >= dc);
    if (success) {
      // Crochetée, la porte s'ouvre ; enfoncée, elle est détruite.
      this.map.set(door.x, door.y, action === "pick" ? Tile.DoorOpen : Tile.Floor);
      this.light = computeLight(this.map, this.torches);
      this.pendingDoor = null;
    } else {
      this.failedDoorAttempts.add(this.doorAttemptKey(door, action)); // raté : cette méthode ne marchera plus ici
    }
    let alerted = 0;
    if (action === "break") {
      this.reveal();
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

  private heroAttacks(monster: Actor): void {
    this.reveal();
    // Un monstre qui n'a rien remarqué est attaqué avec avantage (deux d20, on garde le meilleur).
    // De même contre un monstre pris dans l'encadrement d'une porte : celui qui attend derrière a l'avantage.
    const attacker = { attackBonus: this.hero.attackBonus + this.streakBonus(), damage: this.hero.damage };
    const result = rollAttack(this.rng, attacker, monster, this.heroHasAdvantageOn(monster) ? "advantage" : "normal");
    this.noteHeroAttack(result.hit);
    monster.alerted = true;
    monster.asleep = false;
    monster.hp -= result.damage;
    this.events.push({ type: "attack", attacker: this.hero, target: monster, result });
    this.removeIfDead(monster);
  }

  private removeIfDead(monster: Actor): void {
    if (monster.hp > 0) return;
    this.monsters.splice(this.monsters.indexOf(monster), 1);
    this.closeDoorAt(monster.x, monster.y);
    this.events.push({ type: "death", actor: monster });
    // Butin : de l'expérience à coup sûr, parfois quelques pièces qui tombent au sol.
    const def = MONSTERS[monster.defId as keyof typeof MONSTERS];
    if (def && this.rng.chance(def.goldChance)) this.dropItem(monster.x, monster.y, "or", this.rng.int(1, def.goldMax));
    if (def) this.gainXp(this.rng.int(def.xpMin, def.xpMax));
  }

  /**
   * Tir à l'arc vers une case. La flèche file en ligne droite : elle s'arrête sur le premier monstre rencontré
   * (jet d'attaque), rebondit d'une case sur un mur, une colonne ou une porte fermée, ou se plante dans la case visée.
   */
  private heroShoots(target: Point): void {
    const bow = this.weapon("ranged");
    if (!bow || !bow.ammo || !this.inventory.take(bow.ammo as ItemId, 1)) return;
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
      const favoured = !blind && (!victim.alerted || (!victim.wary && this.map.isDoor(victim.x, victim.y)));
      const threatened = blind || this.monsters.some((m) => m.alerted && this.inReach(m, this.hero));
      const mode = favoured && !threatened ? "advantage" : threatened && !favoured ? "disadvantage" : "normal";
      // Dans un couloir d'une case de large, la flèche n'a guère où passer à côté : bonus au jet.
      const open = (dx: number, dy: number) => this.map.isWalkable(victim!.x + dx, victim!.y + dy);
      const narrow = (!open(-1, 0) && !open(1, 0)) || (!open(0, -1) && !open(0, 1));
      const attackBonus = (bow.attackBonus ?? 0) + (narrow ? RULES.narrowShotBonus : 0) + this.streakBonus();
      const result = rollAttack(this.rng, { attackBonus, damage: bow.damage ?? UNARMED.damage }, victim, mode);
      this.noteHeroAttack(result.hit);
      victim.alerted = true;
      victim.asleep = false;
      victim.hp -= result.damage;
      this.events.push({ type: "attack", attacker: this.hero, target: victim, result, ranged: true });
      hit = result.hit;
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
    if (kept) this.dropItem(landing.x, landing.y, bow.ammo as ItemId, 1, angle);
    else this.debris.push({ x: landing.x, y: landing.y, angle, until: this.turn + RULES.brokenArrowTurns });
    this.events.push({ type: "arrow", fromX: origin.x, fromY: origin.y, x: landing.x, y: landing.y, via, hit, kept });
    if (victim) this.removeIfDead(victim);
  }

  private dropItem(x: number, y: number, item: ItemId, count: number, angle?: number): void {
    // Un objet orienté (une flèche tombée) garde sa propre place au sol ; les autres s'empilent.
    const pile = angle === undefined ? this.ground.find((g) => g.x === x && g.y === y && g.item === item && g.angle === undefined) : undefined;
    if (pile) pile.count += count;
    else this.ground.push({ x, y, item, count, angle });
  }

  /** L'or se ramasse tout seul en marchant dessus, sans y passer de tour. */
  private collectGold(): void {
    for (const pile of this.itemsHere()) {
      if (pile.item !== "or") continue;
      this.gold += pile.count;
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
    else this.events.push({ type: "bagFull" });
    this.ground = this.ground.filter((g) => g.count > 0);
    return left === 0 && this.itemsHere().some((g) => g.item === item);
  }

  private monstersAct(): void {
    for (const m of [...this.monsters]) {
      if (this.over) return;
      const dx = this.hero.x - m.x;
      const dy = this.hero.y - m.y;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));

      if (!m.alerted) {
        const def = MONSTERS[m.defId as keyof typeof MONSTERS];
        const chance =
          def.noticeChance *
          (this.heroInLight() ? RULES.noticeInLight : RULES.noticeInDark) *
          (m.asleep ? RULES.noticeAsleep : RULES.noticeAwake);
        // Caché, le héros ne peut être remarqué que par un monstre arrivé à son contact.
        const range = this.hidden ? 1 : m.vision;
        if (this.isVisible(m.x, m.y) && distance <= range && this.rng.chance(chance)) {
          m.alerted = true;
          m.asleep = false;
          this.events.push({ type: "noticed", actor: m });
          this.reveal();
        } else if (!m.asleep) {
          this.wander(m);
        }
        continue;
      }

      if (this.inReach(m, this.hero)) {
        // Embuscade : le monstre a l'avantage sur un héros pris dans une porte, ou qu'il frappe au coin d'un mur.
        const ambush = this.map.isDoor(this.hero.x, this.hero.y) || this.aroundCorner(m, this.hero);
        const result = rollAttack(this.rng, m, this.hero, ambush ? "advantage" : "normal");
        // Le monstre a rattrapé le héros : le combat reprend normalement.
        m.wary = false;
        this.hero.hp = Math.max(0, this.hero.hp - result.damage);
        this.events.push({ type: "attack", attacker: m, target: this.hero, result });
        if (this.hero.hp === 0) {
          this.over = true;
          this.path = [];
          this.events.push({ type: "death", actor: this.hero });
        }
        continue;
      }

      this.stepToward(m, this.hero);
    }
  }

  /** Avance un monstre d'une case vers une destination, en ouvrant les portes. Renvoie faux s'il n'y a pas de chemin. */
  private stepToward(m: Actor, target: Point): boolean {
    const step = findPath(this.map, m, target)?.[0];
    if (!step) return false;
    if (!this.actorAt(step.x, step.y)) {
      const left = { x: m.x, y: m.y };
      const doorMoved = this.map.get(step.x, step.y) === Tile.DoorClosed || this.map.get(left.x, left.y) === Tile.DoorOpen;
      m.x = step.x;
      m.y = step.y;
      this.openDoorAt(m.x, m.y);
      this.closeDoorAt(left.x, left.y);
      if (doorMoved) this.updateVision();
    }
    return true;
  }

  /** Promenade : le monstre va de salle en salle, au hasard. */
  private wander(m: Actor): void {
    if (!m.goal || (m.goal.x === m.x && m.goal.y === m.y)) {
      const room = this.rooms[this.rng.int(0, this.rooms.length - 1)];
      m.goal = { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
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
    this.enterFloor(target, direction);
    this.events.push({ type: "stairs", direction, healed });
    return true;
  }
}
