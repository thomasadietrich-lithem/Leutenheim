import { CLASSES, ClassDef } from "../data/classes";
import { DEFAULT_FLOOR, FloorConfig } from "../data/floors";
import { MONSTERS, spawnsForDepth } from "../data/monsters";
import { RACES, RaceDef } from "../data/races";
import { Actor } from "../entities/actor";
import { computeFov } from "../world/fov";
import { generateFloor, Room } from "../world/generator";
import { GameMap, Point, Tile } from "../world/map";
import { canStep, findPath } from "../world/pathfinding";
import { AttackResult, rollAttack } from "./combat";
import { floorSeed, Rng } from "./rng";

/** Ce qui s'est passé pendant un tour, pour que l'affichage puisse le montrer. */
export type GameEvent =
  | { type: "attack"; attacker: Actor; target: Actor; result: AttackResult }
  | { type: "death"; actor: Actor }
  | { type: "noticed"; actor: Actor }
  | { type: "descend"; healed: number };

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
  /** Événements en attente d'affichage ; l'affichage les lit puis vide la liste. */
  events: GameEvent[] = [];

  private rng!: Rng;
  private nextId = 1;
  private targetId: number | null = null;
  private waiting = false;
  private seenMonsters = new Set<number>();

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
      attackBonus: heroClass.attackBonus,
      damage: heroClass.damage,
      vision: race.vision,
      alerted: true,
    };
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
    this.explored = new Uint8Array(this.map.width * this.map.height);
    this.spawnMonsters(floor.rooms);
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
          });
          break;
        }
      }
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

  visibleMonsters(): Actor[] {
    return this.monsters.filter((m) => this.isVisible(m.x, m.y));
  }

  // ---------- Ordres du joueur ----------

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
    const seen = this.monsterAt(x, y);
    const monster = seen && this.isVisible(x, y) ? seen : undefined;
    // Vers un monstre en vue, on trouve toujours un chemin ; sinon on ne passe que par les cases déjà vues.
    const known = ignoreFog || monster ? undefined : (cx: number, cy: number) => this.isExplored(cx, cy);
    const path = findPath(this.map, this.hero, { x, y }, known);
    if (!path) return false;
    this.targetId = monster ? monster.id : null;
    this.path = path;
    this.waiting = false;
    return true;
  }

  /** Déplacement ou attaque d'une case (clavier). */
  moveBy(dx: number, dy: number): boolean {
    if (this.over || !canStep(this.map, this.hero.x, this.hero.y, dx, dy)) return false;
    this.targetId = null;
    this.path = [{ x: this.hero.x + dx, y: this.hero.y + dy }];
    return true;
  }

  /** Passer un tour sur place. */
  wait(): void {
    if (this.over) return;
    this.path = [];
    this.targetId = null;
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

    if (this.waiting) {
      this.waiting = false;
    } else {
      if (this.targetId !== null) {
        // La cible a pu bouger : on recalcule le chemin vers elle.
        const target = this.monsters.find((m) => m.id === this.targetId);
        this.path = target ? (findPath(this.map, this.hero, target) ?? []) : [];
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
        this.path.shift();
        this.hero.x = next.x;
        this.hero.y = next.y;
      }
    }

    this.turn++;
    this.updateVision();
    this.monstersAct();
    return true;
  }

  private heroAttacks(monster: Actor): void {
    // Un monstre qui n'a rien remarqué est attaqué avec avantage (deux d20, on garde le meilleur).
    const result = rollAttack(this.rng, this.hero, monster, monster.alerted ? "normal" : "advantage");
    monster.alerted = true;
    monster.hp -= result.damage;
    this.events.push({ type: "attack", attacker: this.hero, target: monster, result });
    if (monster.hp <= 0) {
      this.monsters = this.monsters.filter((m) => m !== monster);
      this.events.push({ type: "death", actor: monster });
    }
  }

  private monstersAct(): void {
    for (const m of [...this.monsters]) {
      if (this.over) return;
      const dx = this.hero.x - m.x;
      const dy = this.hero.y - m.y;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));

      if (!m.alerted) {
        const def = MONSTERS[m.defId as keyof typeof MONSTERS];
        if (this.isVisible(m.x, m.y) && distance <= m.vision && this.rng.chance(def.noticeChance)) {
          m.alerted = true;
          this.events.push({ type: "noticed", actor: m });
        }
        continue;
      }

      if (distance === 1 && canStep(this.map, m.x, m.y, dx, dy)) {
        const result = rollAttack(this.rng, m, this.hero);
        this.hero.hp = Math.max(0, this.hero.hp - result.damage);
        this.events.push({ type: "attack", attacker: m, target: this.hero, result });
        if (this.hero.hp === 0) {
          this.over = true;
          this.path = [];
          this.events.push({ type: "death", actor: this.hero });
        }
        continue;
      }

      const step = findPath(this.map, m, this.hero)?.[0];
      if (step && !this.actorAt(step.x, step.y)) {
        m.x = step.x;
        m.y = step.y;
      }
    }
  }

  private updateVision(): void {
    this.visible = computeFov(this.map, this.hero, this.hero.vision);
    for (let i = 0; i < this.visible.length; i++) {
      if (this.visible[i]) this.explored[i] = 1;
    }
    // Un monstre qui entre dans le champ de vision interrompt le déplacement en cours.
    for (const m of this.visibleMonsters()) {
      if (!this.seenMonsters.has(m.id)) {
        this.seenMonsters.add(m.id);
        this.path = [];
        this.targetId = null;
      }
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
