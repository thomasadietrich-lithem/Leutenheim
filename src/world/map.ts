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
  Fountain: 6,
  FountainDry: 7,
  Chest: 8,
  ChestOpen: 9,
  Pillar: 10,
  StairsUp: 11,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** Grille de cases d'un étage. */
export class GameMap {
  readonly tiles: Uint8Array;
  /**
   * Pour l'affichage : numéro de la dernière modification qui touche chaque case ou une voisine (jusqu'à deux cases),
   * pour savoir quand redessiner une case gardée en mémoire. Ne sert pas aux règles.
   */
  readonly changed: Uint32Array;
  private revision = 0;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.tiles = new Uint8Array(width * height); // tout en mur au départ
    this.changed = new Uint32Array(width * height);
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
    const i = this.index(x, y);
    if (this.tiles[i] === tile) return;
    this.tiles[i] = tile;
    this.revision++;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) if (this.inBounds(x + dx, y + dy)) this.changed[this.index(x + dx, y + dy)] = this.revision;
    }
  }

  /** On peut y marcher. Une porte fermée s'ouvre en y entrant ; une porte verrouillée bloque. */
  isWalkable(x: number, y: number): boolean {
    const t = this.get(x, y);
    return t !== Tile.Wall && t !== Tile.DoorLocked && t !== Tile.Pillar;
  }

  /** Bloque la vue et la lumière : murs et portes non ouvertes. */
  blocksSight(x: number, y: number): boolean {
    const t = this.get(x, y);
    return t === Tile.Wall || t === Tile.DoorClosed || t === Tile.DoorLocked || t === Tile.Pillar;
  }

  isDoor(x: number, y: number): boolean {
    const t = this.get(x, y);
    return t === Tile.DoorClosed || t === Tile.DoorOpen || t === Tile.DoorLocked;
  }
}
