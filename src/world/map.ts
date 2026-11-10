export interface Point {
  x: number;
  y: number;
}

export const Tile = {
  Wall: 0,
  Floor: 1,
  StairsDown: 2,
  DoorClosed: 3,
  DoorOpen: 4,
  DoorLocked: 5,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** Grille de cases d'un étage. */
export class GameMap {
  readonly tiles: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.tiles = new Uint8Array(width * height); // tout en mur au départ
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): Tile {
    return this.inBounds(x, y) ? (this.tiles[this.index(x, y)] as Tile) : Tile.Wall;
  }

  set(x: number, y: number, tile: Tile): void {
    this.tiles[this.index(x, y)] = tile;
  }

  /** On peut y marcher. Une porte fermée s'ouvre en y entrant ; une porte verrouillée bloque. */
  isWalkable(x: number, y: number): boolean {
    const t = this.get(x, y);
    return t !== Tile.Wall && t !== Tile.DoorLocked;
  }

  /** Bloque la vue et la lumière : murs et portes non ouvertes. */
  blocksSight(x: number, y: number): boolean {
    const t = this.get(x, y);
    return t === Tile.Wall || t === Tile.DoorClosed || t === Tile.DoorLocked;
  }

  isDoor(x: number, y: number): boolean {
    const t = this.get(x, y);
    return t === Tile.DoorClosed || t === Tile.DoorOpen || t === Tile.DoorLocked;
  }
}
