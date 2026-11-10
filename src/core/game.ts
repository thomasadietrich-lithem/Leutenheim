import { DEFAULT_FLOOR, FloorConfig } from "../data/floors";
import { generateFloor } from "../world/generator";
import { GameMap, Point, Tile } from "../world/map";
import { canStep, findPath } from "../world/pathfinding";
import { floorSeed } from "./rng";

/** État complet d'une partie. Ne connaît ni l'écran ni le tactile. */
export class Game {
  depth = 0;
  turn = 0;
  map!: GameMap;
  hero: Point = { x: 0, y: 0 };
  /** Cases restant à parcourir vers la destination choisie. */
  path: Point[] = [];

  constructor(
    readonly runSeed: number,
    private readonly floorConfig: FloorConfig = DEFAULT_FLOOR,
  ) {
    this.enterFloor(1);
  }

  private enterFloor(depth: number): void {
    const floor = generateFloor(floorSeed(this.runSeed, depth), this.floorConfig);
    this.depth = depth;
    this.map = floor.map;
    this.hero = { ...floor.start };
    this.path = [];
  }

  /** Le joueur désigne une case : on calcule le chemin. Renvoie faux si elle est inaccessible. */
  setDestination(x: number, y: number): boolean {
    const path = findPath(this.map, this.hero, { x, y });
    if (!path) return false;
    this.path = path;
    return true;
  }

  /** Déplacement d'une case (clavier). */
  moveBy(dx: number, dy: number): boolean {
    if (!canStep(this.map, this.hero.x, this.hero.y, dx, dy)) return false;
    this.path = [{ x: this.hero.x + dx, y: this.hero.y + dy }];
    return true;
  }

  /** Joue un tour si une action est en attente. Renvoie vrai si un tour a été joué. */
  tick(): boolean {
    const next = this.path.shift();
    if (!next) return false;
    this.hero = next;
    this.turn++;
    return true;
  }

  /** Si le héros est sur l'escalier, passe à l'étage suivant. */
  descendIfOnStairs(): boolean {
    if (this.map.get(this.hero.x, this.hero.y) !== Tile.StairsDown) return false;
    this.enterFloor(this.depth + 1);
    return true;
  }
}
