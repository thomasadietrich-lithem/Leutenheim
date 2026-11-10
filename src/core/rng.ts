/** Générateur aléatoire à graine (mulberry32) : même graine, même suite de nombres. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Nombre dans [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entier entre min et max inclus. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

/** Graine d'un étage, dérivée de la graine de la partie et de la profondeur. */
export function floorSeed(runSeed: number, depth: number): number {
  return (runSeed ^ Math.imul(depth, 0x9e3779b1)) >>> 0;
}
