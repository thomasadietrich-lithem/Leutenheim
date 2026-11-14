import { Rng } from "../core/rng";
import { ItemId } from "../data/items";
import { Furniture } from "./furnish";
import { LightSource } from "./fov";
import { Floor, Room } from "./generator";
import { GameMap, Point, Tile } from "./map";

/**
 * ÉTAGE DU BOSS DE LA SECTION 1 : la NICHÉE de la Tisseuse (planche art/boss_v2.png ; Thomas, 2026-11-11 : « beaucoup
 * plus de toile, une salle plus grande, des couloirs autour », « prévoir des chemins hors toile », « générer des
 * variations »).
 *
 * Plan : ANTICHAMBRE éclairée (arrivée) → couloir → ANNEAU de couloirs de 2 cases qui fait le tour de la NICHÉE, reliés à
 * elle par 4 à 6 BRÈCHES de 2 cases (la Tisseuse fait 2 × 2 cases et passe partout) ; au bout de l'anneau, une alcôve avec
 * le coffre du boss et l'escalier SCELLÉ par une toile. Dans la nichée : 4 colonnes portant les AMARRES de la grande toile
 * (3 × 3, au centre), des NAPPES de toile un peu partout (moins dans l'anneau) sauf sur 3 ou 4 SENTIERS dégagés, des cocons
 * contre les murs, deux sacs d'œufs près de la grande toile, deux restes d'aventuriers (une cache chacun).
 *
 * Variations par graine : taille de la nichée (18 à 22 × 12 à 15), place de la grande toile et des colonnes, nombre et
 * place des brèches, sentiers, cocons, densité des toiles, longueur du couloir, côté de l'alcôve, et le plan peut être
 * retourné de gauche à droite et de haut en bas.
 */
export interface BossFloor extends Floor {
  furniture: Furniture[];
  /** Caches : les restes d'aventuriers (dans la nichée, salle n° 1). */
  secrets: { x: number; y: number; room: number; item: ItemId; count: number }[];
  boss: BossLayout;
}

/** Ce que la partie doit savoir de la nichée (gardé dans la sauvegarde de l'étage). */
export interface BossLayout {
  /** Case du haut à gauche de la Tisseuse au départ (au centre de sa grande toile). */
  spawn: Point;
  /** Case du haut à gauche de la grande toile (3 × 3). */
  hub: Point;
  /** Les quatre colonnes qui portent les amarres. */
  pillars: Point[];
  /** Brèches entre l'anneau et la nichée (case du haut à gauche de chaque passage de 2 cases). */
  breaches: Point[];
  /** Coffre du boss et escalier scellé. */
  chest: Point;
  seal: Point;
  /** La salle de la nichée (pour la barre de vie : le combat est engagé quand le héros y entre). */
  lair: Room;
}

export function buildBossFloor(seed: number): BossFloor {
  const rng = new Rng(seed ^ 0x7b055e11);
  const NW = rng.int(18, 22);
  const NH = rng.int(12, 15);
  const corr = rng.int(2, 4);
  // Repères sans retournement : antichambre à gauche (x 1 à 5), couloir, anneau, alcôve à droite.
  const H = NH + 8;
  const ring: Room = { x: 1 + 5 + corr, y: 1, w: NW + 6, h: NH + 6 };
  const lair: Room = { x: ring.x + 3, y: ring.y + 3, w: NW, h: NH };
  const W = ring.x + ring.w + 4;
  const map = new GameMap(W, H);
  const fill = (r: Room, t: Tile) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map.set(x, y, t);
  };
  const cy = rng.int(lair.y + 2, lair.y + NH - 4);
  const ante: Room = { x: 1, y: Math.max(1, Math.min(H - 6, cy - 2)), w: 5, h: 5 };
  fill(ante, Tile.Floor);
  fill({ x: 6, y: cy, w: corr, h: 1 }, Tile.Floor);
  // L'anneau : le rectangle extérieur, puis le mur d'une case qui sépare l'anneau de la nichée.
  fill(ring, Tile.Floor);
  fill({ x: ring.x + 2, y: ring.y + 2, w: NW + 2, h: NH + 2 }, Tile.Wall);
  fill(lair, Tile.Floor);
  // Brèches : toujours une à gauche (près de l'arrivée), une à droite, et 2 à 4 en haut et en bas, bien espacées.
  const breaches: Point[] = [];
  const wallX0 = ring.x + 2;
  const wallX1 = ring.x + ring.w - 3;
  const wallY0 = ring.y + 2;
  const wallY1 = ring.y + ring.h - 3;
  const sideY = () => rng.int(lair.y + 1, lair.y + NH - 3);
  breaches.push({ x: wallX0, y: Math.max(lair.y, Math.min(lair.y + NH - 2, cy + (rng.chance(0.5) ? -3 : 2))) });
  breaches.push({ x: wallX1, y: sideY() });
  const extra = rng.int(2, 4);
  const along: number[] = [];
  for (let i = 0; i < extra; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const x = rng.int(lair.x + 1, lair.x + NW - 3);
      if (along.some((a) => Math.abs(a - x) < 5)) continue;
      along.push(x);
      breaches.push({ x, y: i % 2 === 0 ? wallY0 : wallY1 });
      break;
    }
  }
  for (const b of breaches) {
    const vertical = b.x === wallX0 || b.x === wallX1;
    for (let k = 0; k < 2; k++) map.set(b.x + (vertical ? 0 : k), b.y + (vertical ? k : 0), Tile.Floor);
  }
  // Alcôve du coffre et de l'escalier, à droite de l'anneau.
  const ay = rng.int(ring.y + 2, ring.y + ring.h - 3);
  const chest = { x: ring.x + ring.w, y: ay };
  const seal = { x: ring.x + ring.w + 1, y: ay };
  map.set(chest.x, chest.y, Tile.Chest);
  map.set(seal.x, seal.y, Tile.Furniture);

  // Grande toile au centre (à une ou deux cases près) et ses quatre colonnes.
  const hub = {
    x: lair.x + Math.floor(NW / 2) - 1 + rng.int(-2, 2),
    y: lair.y + Math.floor(NH / 2) - 1 + rng.int(-1, 1),
  };
  const px = rng.int(4, 6);
  const py = rng.int(3, 4);
  const pillars = [
    { x: hub.x + 1 - px, y: hub.y + 1 - py },
    { x: hub.x + 1 + px, y: hub.y + 1 - py },
    { x: hub.x + 1 - px, y: hub.y + 1 + py },
    { x: hub.x + 1 + px, y: hub.y + 1 + py },
  ].map((p) => ({ x: Math.max(lair.x + 2, Math.min(lair.x + NW - 3, p.x)), y: Math.max(lair.y + 2, Math.min(lair.y + NH - 3, p.y)) }));
  // Plus de colonnes (Thomas, 2026-11-13 : « retire les poteaux du boss, ils n'apportent rien ») : les quatre amarres
  // sont nouées au MUR de la nichée, dans le prolongement des diagonales de la grande toile. On les tranche depuis la
  // case voisine, comme avant.
  for (const p of pillars) {
    const sx = Math.sign(p.x - (hub.x + 1)) || 1;
    const sy = Math.sign(p.y - (hub.y + 1)) || 1;
    let x = p.x;
    let y = p.y;
    for (let k = 0; k < 40 && map.get(x, y) !== Tile.Wall; k++) {
      // On avance en diagonale tant qu'on reste dans la nichée, puis tout droit vers le mur le plus proche.
      if (x + sx >= lair.x && x + sx < lair.x + NW) x += sx;
      else if (y + sy >= lair.y && y + sy < lair.y + NH) y += sy;
      else {
        x += sx;
        if (map.get(x, y) !== Tile.Wall) y += sy;
      }
    }
    p.x = x;
    p.y = y;
  }

  const furniture: Furniture[] = [];
  const taken = new Set<number>();
  const take = (x: number, y: number) => taken.add(map.index(x, y));
  const isTaken = (x: number, y: number) => taken.has(map.index(x, y));
  for (let i = 0; i < 9; i++) {
    const x = hub.x + (i % 3);
    const y = hub.y + Math.floor(i / 3);
    furniture.push({ x, y, kind: `webHub${i}` });
    take(x, y);
  }
  furniture.push({ x: seal.x, y: seal.y, kind: "sealedStairs" });

  // Sentiers sans toile : de la brèche d'arrivée à la grande toile, et entre des brèches (trajets un peu sinueux).
  const clear = new Set<number>();
  const trail = (from: Point, to: Point) => {
    let { x, y } = from;
    for (let guard = 0; guard < 200 && (x !== to.x || y !== to.y); guard++) {
      clear.add(map.index(x, y));
      const dx = Math.sign(to.x - x);
      const dy = Math.sign(to.y - y);
      // On avance surtout vers le but, parfois de travers : le sentier serpente.
      const r = rng.next();
      let nx = x;
      let ny = y;
      const horizontal = dx !== 0 && (dy === 0 || r < 0.5);
      if (horizontal) nx += dx;
      else ny += dy;
      // Un pas de travers (perpendiculaire au pas fait) : le sentier serpente, sans jamais sauter de case.
      if (r > 0.85) {
        if (horizontal) ny += rng.chance(0.5) ? 1 : -1;
        else nx += rng.chance(0.5) ? 1 : -1;
      }
      if (nx < lair.x || nx >= lair.x + NW || ny < lair.y || ny >= lair.y + NH || map.get(nx, ny) === Tile.Pillar) {
        nx = x + dx;
        ny = y + (dx === 0 ? dy : 0);
      }
      x = nx;
      y = ny;
    }
    clear.add(map.index(x, y));
  };
  const inside = (b: Point): Point => {
    // La case de la nichée juste derrière une brèche.
    if (b.x === wallX0) return { x: lair.x, y: b.y };
    if (b.x === wallX1) return { x: lair.x + NW - 1, y: b.y };
    if (b.y === wallY0) return { x: b.x, y: lair.y };
    return { x: b.x, y: lair.y + NH - 1 };
  };
  const hubSide = { x: hub.x - 1, y: hub.y + 1 };
  // De l'arrivée dans l'anneau jusqu'à la première brèche : la colonne intérieure de l'anneau reste sans toile.
  for (let y = Math.min(cy, breaches[0].y); y <= Math.max(cy, breaches[0].y + 1); y++) clear.add(map.index(ring.x, y)).add(map.index(ring.x + 1, y));
  for (let k = 0; k < 2; k++) clear.add(map.index(breaches[0].x, breaches[0].y + k));
  trail(inside(breaches[0]), hubSide);
  trail(inside(breaches[1]), { x: hub.x + 3, y: hub.y + 1 });
  const order = breaches.slice(2);
  for (let i = 0; i < order.length; i++) trail(inside(order[i]), i % 2 === 0 ? hubSide : inside(breaches[(i + 1) % breaches.length]));
  // Dans l'anneau, un sentier aussi : la rangée (ou colonne) extérieure reste libre sur une bonne moitié.
  const ringClearSide = rng.int(0, 3);

  // Cocons contre les murs de la nichée, loin des brèches ; sacs d'œufs à 3 ou 4 cases de la grande toile.
  const nearBreach = (x: number, y: number) => breaches.some((b) => Math.abs(b.x - x) <= 3 && Math.abs(b.y - y) <= 3);
  const wallCells: Point[] = [];
  for (let x = lair.x; x < lair.x + NW; x++) wallCells.push({ x, y: lair.y }, { x, y: lair.y + NH - 1 });
  for (let y = lair.y + 1; y < lair.y + NH - 1; y++) wallCells.push({ x: lair.x, y }, { x: lair.x + NW - 1, y });
  const cocoons = rng.int(4, 6);
  for (let n = 0, tries = 0; n < cocoons && tries < 200; tries++) {
    const c = wallCells[rng.int(0, wallCells.length - 1)];
    if (nearBreach(c.x, c.y) || isTaken(c.x, c.y) || clear.has(map.index(c.x, c.y))) continue;
    if (furniture.some((f) => f.kind.startsWith("cocoon") && Math.abs(f.x - c.x) + Math.abs(f.y - c.y) < 4)) continue;
    furniture.push({ x: c.x, y: c.y, kind: rng.chance(0.5) ? "cocoonA" : "cocoonB" });
    map.set(c.x, c.y, Tile.Furniture);
    take(c.x, c.y);
    n++;
  }
  for (let n = 0, tries = 0; n < 2 && tries < 200; tries++) {
    const x = hub.x + 1 + rng.int(-5, 5);
    const y = hub.y + 1 + rng.int(-4, 4);
    const d = Math.max(Math.abs(x - hub.x - 1), Math.abs(y - hub.y - 1));
    if (d < 3 || x <= lair.x || y <= lair.y || x >= lair.x + NW - 1 || y >= lair.y + NH - 1) continue;
    if (map.get(x, y) !== Tile.Floor || isTaken(x, y) || clear.has(map.index(x, y))) continue;
    if (pillars.some((p) => Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1)) continue;
    if (furniture.some((f) => f.kind === "eggSac" && Math.abs(f.x - x) + Math.abs(f.y - y) < 5)) continue;
    furniture.push({ x, y, kind: "eggSac" });
    map.set(x, y, Tile.Furniture);
    take(x, y);
    n++;
  }
  // Restes d'aventuriers (2 cases, plats) : chacun cache quelque chose, à trouver en fouillant la nichée.
  const secrets: BossFloor["secrets"] = [];
  const loot: { item: ItemId; count: number }[] = [
    { item: "or", count: rng.int(12, 24) },
    rng.chance(0.5) ? { item: "potion_feu", count: 1 } : { item: "fleche", count: rng.int(4, 6) },
  ];
  for (let n = 0, tries = 0; n < 2 && tries < 300; tries++) {
    const x = rng.int(lair.x + 1, lair.x + NW - 3);
    const y = rng.int(lair.y + 1, lair.y + NH - 2);
    if (map.get(x, y) !== Tile.Floor || map.get(x + 1, y) !== Tile.Floor || isTaken(x, y) || isTaken(x + 1, y)) continue;
    if (Math.abs(x - hub.x - 1) < 4 && Math.abs(y - hub.y - 1) < 3) continue;
    if (furniture.some((f) => f.kind === "bonesA" && Math.abs(f.x - x) + Math.abs(f.y - y) < 6)) continue;
    furniture.push({ x, y, kind: "bonesA" }, { x: x + 1, y, kind: "bonesB" });
    take(x, y);
    take(x + 1, y);
    secrets.push({ x, y, room: 1, ...loot[n] });
    n++;
  }

  // Nappes de toile : des plaques (bruit à gros grain), plus serrées dans la nichée que dans l'anneau.
  const density = 0.5 + rng.next() * 0.15;
  const noise = (x: number, y: number, s: number) => {
    let h = Math.imul(x * 374761393 + y * 668265263 + (seed ^ s), 1274126177);
    h ^= h >>> 13;
    h = Math.imul(h, 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const inLair = (x: number, y: number) => x >= lair.x && x < lair.x + NW && y >= lair.y && y < lair.y + NH;
  const inRing = (x: number, y: number) => x >= ring.x && x < ring.x + ring.w && y >= ring.y && y < ring.y + ring.h && !inLair(x, y);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (map.get(x, y) !== Tile.Floor || isTaken(x, y) || clear.has(map.index(x, y))) continue;
      let p: number;
      if (inLair(x, y)) p = density;
      else if (inRing(x, y)) {
        // Le côté de l'anneau choisi garde sa rangée extérieure libre (un chemin pour faire le tour).
        const outer = [y === ring.y, x === ring.x + ring.w - 1, y === ring.y + ring.h - 1, x === ring.x][ringClearSide];
        p = outer ? 0 : 0.32;
      } else continue;
      const v = noise(x >> 1, y >> 1, 0x51) * 0.6 + noise(x, y, 0x77) * 0.4;
      if (v < p) furniture.push({ x, y, kind: `webN${Math.floor(noise(x, y, 0x99) * 6)}` });
    }
  }

  const torches: LightSource[] = [{ x: ante.x + 2, y: ante.y - 1, radius: 6, faceX: 0, faceY: 1 }];
  const floor: BossFloor = {
    map,
    rooms: [ante, lair],
    start: { x: ante.x + 1, y: ante.y + 2 },
    stairs: seal,
    torches,
    specials: [],
    furniture,
    secrets,
    boss: { spawn: { x: hub.x + 1, y: hub.y }, hub, pillars, breaches, chest, seal, lair },
  };
  return mirror(floor, rng.chance(0.5), rng.chance(0.5));
}

/** Retourne le plan de gauche à droite et / ou de haut en bas (variation). Les meubles de plusieurs cases suivent. */
function mirror(f: BossFloor, flipX: boolean, flipY: boolean): BossFloor {
  if (!flipX && !flipY) return f;
  const W = f.map.width;
  const H = f.map.height;
  const mx = (x: number, w = 1) => (flipX ? W - x - w : x);
  const my = (y: number, h = 1) => (flipY ? H - y - h : y);
  const p = (q: Point, w = 1, h = 1): Point => ({ x: mx(q.x, w), y: my(q.y, h) });
  const r = (q: Room): Room => ({ ...p(q, q.w, q.h), w: q.w, h: q.h });
  const map = new GameMap(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) map.set(mx(x), my(y), f.map.get(x, y));
  // Grande toile : les 9 morceaux du dessin restent dans le bon ordre, on ne retourne que leurs places.
  const hub = p(f.boss.hub, 3, 3);
  const furniture = f.furniture.map((o) => {
    if (o.kind.startsWith("webHub")) {
      const i = Number(o.kind.slice(6));
      return { ...o, x: hub.x + (i % 3), y: hub.y + Math.floor(i / 3) };
    }
    // Restes d'aventurier : les deux moitiés échangent leur place quand on retourne de gauche à droite.
    if (flipX && (o.kind === "bonesA" || o.kind === "bonesB")) return { ...o, x: mx(o.x), kind: o.kind === "bonesA" ? "bonesB" : "bonesA", y: my(o.y) };
    return { ...o, ...p(o) };
  });
  const secrets = f.secrets.map((s) => ({ ...s, ...p(s, 2, 1) }));
  // Une cache désigne la moitié gauche des restes : après retournement, c'est toujours la case de gauche.
  return {
    ...f,
    map,
    rooms: f.rooms.map(r),
    start: p(f.start),
    stairs: p(f.stairs),
    torches: f.torches.map((t) => ({ ...t, ...p(t), faceX: flipX ? -t.faceX : t.faceX, faceY: flipY ? -t.faceY : t.faceY })),
    furniture,
    secrets,
    boss: {
      spawn: p(f.boss.spawn, 2, 2),
      hub,
      pillars: f.boss.pillars.map((q) => p(q)),
      breaches: f.boss.breaches.map((q) => p(q)),
      chest: p(f.boss.chest),
      seal: p(f.boss.seal),
      lair: r(f.boss.lair),
    },
  };
}
