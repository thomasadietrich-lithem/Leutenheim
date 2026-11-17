import { Rng } from "../core/rng";
import { BossFloor } from "./bossFloor";
import { Furniture } from "./furnish";
import { GameMap, Point, Tile } from "./map";
import { Room } from "./generator";

/**
 * ÉTAGE DU BOSS DE LA SECTION 2 : la grotte du CARILLON (Thomas, 2026-11-16 : « Carillon go », « A fonce » ; planches
 * art/carillon_v1.png et carillon_v2.png ; détail claude/BOSS_CARILLON.md).
 *
 * Plan : ANTICHAMBRE (arrivée) → couloir → LA GROTTE (15 × 11, coins arrondis). Le Carillon (3 × 3) au fond, au milieu,
 * contre le mur du haut ; son BATTANT pend sous son chapeau (la case sous son milieu). L'escalier vers la section 3 est
 * dans le mur, derrière lui (scellé). Six SOUCHES DE PIERRE en arc (abris), trois Kobolds envahis endormis ; deux coins
 * de mycélium d'où d'autres sortent à mi-vie. Des petits lumineux contre les murs. Variante : retourné de gauche à droite.
 */
export function buildCarillonFloor(seed: number): BossFloor {
  const rng = new Rng(seed ^ 0xca2111);
  const W = 19;
  const H = 22;
  const map = new GameMap(W, H);
  const lair: Room = { x: 2, y: 2, w: 15, h: 11 };
  for (let y = lair.y; y < lair.y + lair.h; y++) {
    for (let x = lair.x; x < lair.x + lair.w; x++) {
      // Coins arrondis : on retire un petit triangle à chaque coin.
      const cx = Math.min(x - lair.x, lair.x + lair.w - 1 - x);
      const cy = Math.min(y - lair.y, lair.y + lair.h - 1 - y);
      if (cx + cy < 2) continue;
      map.set(x, y, Tile.Floor);
    }
  }
  const ante: Room = { x: 7, y: 16, w: 5, h: 5 };
  for (let y = ante.y; y < ante.y + ante.h; y++) for (let x = ante.x; x < ante.x + ante.w; x++) map.set(x, y, Tile.Floor);
  for (let y = lair.y + lair.h; y < ante.y; y++) map.set(9, y, Tile.Floor);

  const spawn = { x: 8, y: 2 };
  const seal = { x: 9, y: 1 };
  const chest = { x: 9, y: 2 };
  const clapper = { x: 9, y: 5 };
  map.set(seal.x, seal.y, Tile.Furniture);
  const furniture: Furniture[] = [{ x: seal.x, y: seal.y, kind: "sealedStairs" }];
  // Les souches de pierre (abris), resserrées (Thomas, 2026-11-16 : « rapproche les poteaux pour se cacher plus
  // facilement ») : d'où qu'on soit dans la grotte, une souche est à deux pas ; un peu de jeu d'une partie à l'autre.
  const stumps: Point[] = [
    { x: 6, y: 5 }, { x: 12, y: 5 },
    { x: 4, y: 7 + rng.int(0, 1) }, { x: 8, y: 7 }, { x: 10, y: 7 }, { x: 14, y: 7 + rng.int(0, 1) },
    { x: 6, y: 9 + rng.int(0, 1) }, { x: 12, y: 9 + rng.int(0, 1) },
    { x: 9, y: 10 },
  ];
  for (const p of stumps) {
    map.set(p.x, p.y, Tile.Furniture);
    furniture.push({ x: p.x, y: p.y, kind: "souche" });
  }
  // Petits lumineux contre les murs.
  const glow = ["lueursB1", "lueursB2", "lueursG1", "lueursG3", "lueursP1", "lueursP2"];
  for (const p of [{ x: 4, y: 2 }, { x: 14, y: 2 }, { x: 2, y: 5 }, { x: 16, y: 5 }, { x: 3, y: 11 }, { x: 15, y: 11 }, { x: 2, y: 9 }, { x: 16, y: 9 }]) {
    if (map.get(p.x, p.y) === Tile.Floor) furniture.push({ x: p.x, y: p.y, kind: glow[rng.int(0, glow.length - 1)] });
  }
  // Pas d'envahi face au couloir d'arrivée (Thomas, 2026-11-17 : « ne fais pas apparaître un mob face à toi ») :
  // les trois dorment sur les côtés de la grotte.
  const sleepers = [{ x: 6, y: 6 }, { x: 12, y: 6 }, { x: 4, y: 10 }];
  const sprouts = [{ x: 4, y: 10 }, { x: 14, y: 10 }];
  const floor: BossFloor = {
    map,
    rooms: [ante, lair],
    start: { x: 9, y: 18 },
    stairs: seal,
    // La torche de l'antichambre, sur son mur du haut (et non sur la case du couloir).
    torches: [{ x: 8, y: ante.y - 1, radius: 6, faceX: 0, faceY: 1 }],
    specials: [],
    furniture,
    secrets: [],
    boss: { spawn, hub: spawn, pillars: [], breaches: [], chest, seal, lair, kind: "carillon", clapper, sleepers, sprouts },
  };
  return rng.chance(0.5) ? flipX(floor) : floor;
}

/** Le même plan, retourné de gauche à droite (le Carillon reste au milieu). */
function flipX(f: BossFloor): BossFloor {
  const W = f.map.width;
  const H = f.map.height;
  const m = new GameMap(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m.set(W - 1 - x, y, f.map.get(x, y));
  const p = (q: Point, w = 1): Point => ({ x: W - q.x - w, y: q.y });
  const b = f.boss;
  return {
    ...f,
    map: m,
    rooms: f.rooms.map((r) => ({ ...r, x: W - r.x - r.w })),
    start: p(f.start),
    stairs: p(f.stairs),
    torches: f.torches.map((t) => ({ ...t, ...p(t) })),
    furniture: f.furniture.map((o) => ({ ...o, ...p(o) })),
    boss: {
      ...b,
      spawn: p(b.spawn, 3),
      hub: p(b.hub, 3),
      chest: p(b.chest),
      seal: p(b.seal),
      lair: { ...b.lair, x: W - b.lair.x - b.lair.w },
      clapper: b.clapper && p(b.clapper),
      sleepers: b.sleepers?.map((q) => p(q)),
      sprouts: b.sprouts?.map((q) => p(q)),
    },
  };
}
