import { CLASSES, ClassDef } from "../data/classes";
import { DEFAULT_FLOOR, FloorConfig } from "../data/floors";
import { ITEMS, ItemDef, ItemId, UNARMED } from "../data/items";
import { MONSTERS, spawnsForDepth } from "../data/monsters";
import { RACES, RaceDef } from "../data/races";
import { RULES } from "../data/rules";
import { Actor } from "../entities/actor";
import { Inventory } from "../items/inventory";
import { computeFov, computeLight, LightSource } from "../world/fov";
import { generateFloor, Room } from "../world/generator";
import { GameMap, Point, Tile } from "../world/map";
import { canStep, findPath } from "../world/pathfinding";
import { AttackResult, rollAttack } from "./combat";
import { floorSeed, Rng } from "./rng";

/** Ce qui s'est passé pendant un tour, pour que l'affichage puisse le montrer. */
export type GameEvent =
  | { type: "attack"; attacker: Actor; target: Actor; result: AttackResult; opportunity?: boolean; ranged?: boolean }
  | { type: "arrow"; fromX: number; fromY: number; x: number; y: number; hit: boolean; kept: boolean }
  | { type: "pickup"; item: ItemId; count: number }
  | { type: "death"; actor: Actor }
  | { type: "noticed"; actor: Actor }
  | { type: "descend"; healed: number }
  | { type: "opened"; x: number; y: number }
  | { type: "fountain"; healed: number }
  | { type: "chest" }
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

/** Un objet posé au sol. */
export interface GroundItem {
  x: number;
  y: number;
  item: ItemId;
  count: number;
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
  /** Le sac du héros, et les armes qu'il a en main (identifiants d'objets du sac). */
  inventory = new Inventory();
  equipped: { melee: number | null; ranged: number | null } = { melee: null, ranged: null };
  /** Objets au sol sur l'étage courant (flèches à ramasser). */
  ground: GroundItem[] = [];
  /** Événements en attente d'affichage ; l'affichage les lit puis vide la liste. */
  events: GameEvent[] = [];

  private rng!: Rng;
  private nextId = 1;
  private targetId: number | null = null;
  private waiting = false;
  private shotTargetId: number | null = null;
  private doorTarget: Point | null = null;
  private doorAction: DoorAction | null = null;
  private seenMonsters = new Set<number>();
  private rooms: Room[] = [];

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
      armorClass: heroClass.armorClass,
      attackBonus: UNARMED.attackBonus,
      damage: UNARMED.damage,
      vision: race.darkVision,
      alerted: true,
      asleep: false,
    };
    for (const start of heroClass.startingItems) {
      this.inventory.add(start.item, start.count);
      if (start.equip) {
        const placed = this.inventory.items.find((i) => i.defId === start.item);
        const kind = ITEMS[start.item].kind;
        if (placed && (kind === "melee" || kind === "ranged")) this.equipped[kind] = placed.uid;
      }
    }
    this.refreshWeapon();
    this.enterFloor(1);
  }

  // ---------- Mise en place d'un étage ----------

  private enterFloor(depth: number): void {
    const seed = floorSeed(this.runSeed, depth);
    const floor = generateFloor(seed, this.floorConfig);
    this.rng = new Rng(seed ^ 0x5bd1e995); // hasard des combats et des monstres, propre à l'étage
    this.depth = depth;
    this.map = floor.map;
    this.hero.x = this.hero.fromX = floor.start.x;
    this.hero.y = this.hero.fromY = floor.start.y;
    this.path = [];
    this.targetId = null;
    this.waiting = false;
    this.shotTargetId = null;
    this.ground = [];
    this.clearDoorOrders();
    this.explored = new Uint8Array(this.map.width * this.map.height);
    this.sensed = new Uint8Array(this.map.width * this.map.height);
    this.torches = floor.torches;
    this.rooms = floor.rooms;
    this.light = computeLight(this.map, this.torches);
    this.spawnMonsters(floor.rooms);
    this.placeKey(floor.rooms);
    this.seenMonsters.clear();
    this.updateVision();
  }

  private spawnMonsters(rooms: Room[]): void {
    this.monsters = [];
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
          this.monsters.push({
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
          });
          break;
        }
      }
    }
  }

  /** Avec un peu de chance, une clef traîne dans une salle de l'étage. */
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
    const uid = this.equipped[kind];
    const item = uid === null ? undefined : this.inventory.get(uid);
    return item ? ITEMS[item.defId] : undefined;
  }

  /** Prend en main une arme du sac, ou la range si elle y est déjà. Ne coûte pas de tour. */
  toggleEquip(uid: number): boolean {
    const item = this.inventory.get(uid);
    if (!item) return false;
    const kind = ITEMS[item.defId].kind;
    if (kind !== "melee" && kind !== "ranged") return false;
    this.equipped[kind] = this.equipped[kind] === uid ? null : uid;
    this.refreshWeapon();
    return true;
  }

  /** Les statistiques d'attaque du héros sont celles de son arme de mêlée (ou ses poings). */
  private refreshWeapon(): void {
    const melee = this.weapon("melee");
    this.hero.attackBonus = melee?.attackBonus ?? UNARMED.attackBonus;
    this.hero.damage = melee?.damage ?? UNARMED.damage;
  }

  arrows(): number {
    const ammo = this.weapon("ranged")?.ammo;
    return ammo ? this.inventory.count(ammo as ItemId) : 0;
  }

  // ---------- Ordres du joueur ----------

  /** Tirer sur le monstre qui se trouve sur cette case. Renvoie la raison du refus, ou null si le tir est lancé. */
  shoot(x: number, y: number): ShootRefusal | null {
    const bow = this.weapon("ranged");
    if (this.over || !bow) return "no-bow";
    if (this.arrows() < 1) return "no-ammo";
    const target = this.monsterAt(x, y);
    if (!target || !this.isVisible(x, y)) return "no-target";
    const distance = Math.max(Math.abs(x - this.hero.x), Math.abs(y - this.hero.y));
    if (distance > (bow.range ?? 0)) return "out-of-range";
    this.clearDoorOrders();
    this.path = [];
    this.targetId = null;
    this.waiting = false;
    this.shotTargetId = target.id;
    return null;
  }


  /**
   * Le joueur désigne une case. Sur un monstre en vue : on va l'attaquer. Sur sa propre case : on attend un tour.
   * Sinon on s'y rend. `ignoreFog` (réservé aux tests) autorise les cases jamais vues.
   */
  setDestination(x: number, y: number, ignoreFog = false): boolean {
    if (this.over) return false;
    if (x === this.hero.x && y === this.hero.y) {
      this.wait();
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
    this.shotTargetId = null;
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
    this.path = best;
    if (best.length === 0) this.pendingDoor = { x, y };
    else this.doorTarget = { x, y };
    return true;
  }

  /** Le joueur choisit de crocheter ou d'enfoncer la porte devant lui : ce sera l'action du prochain tour. */
  actOnDoor(action: DoorAction): boolean {
    if (this.over || !this.pendingDoor) return false;
    if (action === "key" && this.inventory.count("clef") < 1) return false;
    this.doorAction = action;
    return true;
  }

  private clearDoorOrders(): void {
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
    this.shotTargetId = null;
    this.path = [{ x: this.hero.x + dx, y: this.hero.y + dy }];
    return true;
  }

  /** Passer un tour sur place. */
  wait(): void {
    if (this.over) return;
    this.clearDoorOrders();
    this.path = [];
    this.targetId = null;
    this.shotTargetId = null;
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

    const shotTarget = this.shotTargetId === null ? undefined : this.monsters.find((m) => m.id === this.shotTargetId);
    this.shotTargetId = null;
    if (shotTarget) {
      this.heroShoots(shotTarget);
    } else if (this.doorAction && this.pendingDoor) {
      this.resolveDoor(this.doorAction, this.pendingDoor);
      this.doorAction = null;
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
        this.pickUpAt(next.x, next.y);
        if (this.opportunityAttacks(threats)) {
          // Après une attaque d'opportunité, le déplacement s'arrête : au joueur de décider de la suite.
          this.path = [];
          this.doorTarget = null;
        }
        if (this.path.length === 0 && this.doorTarget) {
          // Arrivé devant la porte verrouillée : au joueur de décider.
          this.pendingDoor = this.doorTarget;
          this.doorTarget = null;
        }
      }
    }

    this.turn++;
    this.updateVision();
    this.monstersAct();
    return true;
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
    return !monster.alerted || this.map.isDoor(monster.x, monster.y) || this.aroundCorner(this.hero, monster);
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
      this.events.push({ type: "chest" }); // le butin arrivera avec les objets (jalon J4)
    }
  }

  private resolveDoor(action: DoorAction, door: Point): void {
    if (action === "key") {
      // La clef ouvre sans jet et sans bruit ; elle est consommée.
      if (!this.inventory.take("clef", 1)) return;
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
    }
    let alerted = 0;
    if (action === "break") {
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

  private heroAttacks(monster: Actor): void {
    // Un monstre qui n'a rien remarqué est attaqué avec avantage (deux d20, on garde le meilleur).
    // De même contre un monstre pris dans l'encadrement d'une porte : celui qui attend derrière a l'avantage.
    const result = rollAttack(this.rng, this.hero, monster, this.heroHasAdvantageOn(monster) ? "advantage" : "normal");
    monster.alerted = true;
    monster.asleep = false;
    monster.hp -= result.damage;
    this.events.push({ type: "attack", attacker: this.hero, target: monster, result });
    this.removeIfDead(monster);
  }

  private removeIfDead(monster: Actor): void {
    if (monster.hp > 0) return;
    this.monsters = this.monsters.filter((m) => m !== monster);
    this.closeDoorAt(monster.x, monster.y);
    this.events.push({ type: "death", actor: monster });
  }

  /** Tir à l'arc : consomme une flèche, qui pourra parfois être ramassée ensuite. */
  private heroShoots(monster: Actor): void {
    const bow = this.weapon("ranged");
    if (!bow || !bow.ammo || !this.inventory.take(bow.ammo as ItemId, 1)) return;
    // Avantage sur une cible qui n'a rien vu ou prise dans une porte ; désavantage si un ennemi est au contact du tireur.
    const favoured = !monster.alerted || this.map.isDoor(monster.x, monster.y);
    const threatened = this.monsters.some((m) => m.alerted && this.inReach(m, this.hero));
    const mode = favoured && !threatened ? "advantage" : threatened && !favoured ? "disadvantage" : "normal";
    const result = rollAttack(this.rng, { attackBonus: bow.attackBonus ?? 0, damage: bow.damage ?? UNARMED.damage }, monster, mode);
    monster.alerted = true;
    monster.asleep = false;
    monster.hp -= result.damage;
    this.events.push({ type: "attack", attacker: this.hero, target: monster, result, ranged: true });

    // Où finit la flèche ? Sur la cible si elle touche, plus loin dans le décor si elle rate.
    const landing = result.hit ? { x: monster.x, y: monster.y } : this.flyPast(monster);
    const kept = this.rng.chance(result.hit ? RULES.arrowKeepOnHit : RULES.arrowKeepOnMiss);
    if (kept) this.dropItem(landing.x, landing.y, bow.ammo as ItemId, 1);
    this.events.push({ type: "arrow", fromX: this.hero.x, fromY: this.hero.y, x: landing.x, y: landing.y, hit: result.hit, kept });
    this.removeIfDead(monster);
  }

  /** Une flèche ratée continue tout droit au-delà de la cible, jusqu'à un mur ou une porte fermée. */
  private flyPast(target: Point): Point {
    const dx = target.x - this.hero.x;
    const dy = target.y - this.hero.y;
    const n = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
    let last = { x: target.x, y: target.y };
    for (let k = 1; k <= RULES.arrowOvershoot; k++) {
      const cx = Math.round(target.x + (dx / n) * k);
      const cy = Math.round(target.y + (dy / n) * k);
      if (!this.map.isWalkable(cx, cy) || this.map.blocksSight(cx, cy)) break;
      last = { x: cx, y: cy };
    }
    return last;
  }

  private dropItem(x: number, y: number, item: ItemId, count: number): void {
    const pile = this.ground.find((g) => g.x === x && g.y === y && g.item === item);
    if (pile) pile.count += count;
    else this.ground.push({ x, y, item, count });
  }

  /** Le héros ramasse ce qui traîne sur sa case, tant qu'il a de la place. */
  private pickUpAt(x: number, y: number): void {
    for (const pile of this.ground.filter((g) => g.x === x && g.y === y)) {
      const left = this.inventory.add(pile.item, pile.count);
      const taken = pile.count - left;
      pile.count = left;
      if (taken > 0) this.events.push({ type: "pickup", item: pile.item, count: taken });
    }
    this.ground = this.ground.filter((g) => g.count > 0);
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
        if (this.isVisible(m.x, m.y) && distance <= m.vision && this.rng.chance(chance)) {
          m.alerted = true;
          m.asleep = false;
          this.events.push({ type: "noticed", actor: m });
        } else if (!m.asleep) {
          this.wander(m);
        }
        continue;
      }

      if (this.inReach(m, this.hero)) {
        // Embuscade : le monstre a l'avantage sur un héros pris dans une porte, ou qu'il frappe au coin d'un mur.
        const ambush = this.map.isDoor(this.hero.x, this.hero.y) || this.aroundCorner(m, this.hero);
        const result = rollAttack(this.rng, m, this.hero, ambush ? "advantage" : "normal");
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
   * Si le héros est sur l'escalier, passe à l'étage suivant.
   * PROVISOIRE (jusqu'aux rations et au repos du jalon J4) : descendre rend la moitié des PV manquants.
   */
  descendIfOnStairs(): boolean {
    if (this.over || this.map.get(this.hero.x, this.hero.y) !== Tile.StairsDown) return false;
    const healed = Math.ceil((this.hero.maxHp - this.hero.hp) / 2);
    this.hero.hp += healed;
    this.enterFloor(this.depth + 1);
    this.events.push({ type: "descend", healed });
    return true;
  }
}
