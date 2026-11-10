export interface Point {
  x: number;
  y: number;
}

export const Tile = {
  Wall: 0,
  Floor: 1,
  StairsDown: 2,
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

  isWalkable(x: number, y: number): boolean {
    return this.get(x, y) !== Tile.Wall;
  }
}
