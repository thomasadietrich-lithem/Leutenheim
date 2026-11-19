import { Rng } from "../core/rng";
import { BossFloor } from "./bossFloor";
import { Furniture } from "./furnish";
import { GameMap, Point, Tile } from "./map";
import { Room } from "./generator";

/**
 * ÉTAGE DU BOSS DE LA SECTION 3 : la SALLE DE LA LUNE de la Grande Prêtresse (Thomas, 2026-11-19 : piste C « la
 * Prêtresse et son Colosse », planche art/ossuaire_boss_v1.png ; « fonce sur boss »).
 *
 * Plan : ANTICHAMBRE (arrivée) → couloir → LA SALLE DE LA LUNE (18 × 13). Au fond, le SOCLE VIDE aux chaînes brisées,
 * l'escalier scellé derrière lui. Six GISANTS en arc (couchés : la lune les relève), six CIERGES VIOLETS (chaque cierge
 * éteint rétrécit la lumière du puits), le PUITS DE LUNE au milieu (elle le déplace). La Prêtresse attend devant le
 * socle. Variante : retournée de gauche à droite.
 */
export function buildPriestessFloor(seed: number): BossFloor {
  const rng = new Rng(seed ^ 0x9e1e57);
  const W = 22;
  const H = 24;
  const map = new GameMap(W, H);
  const lair: Room = { x: 2, y: 2, w: 18, h: 13 };
  for (let y = lair.y; y < lair.y + lair.h; y++) {
    for (let x = lair.x; x < lair.x + lair.w; x++) {
      const cx = Math.min(x - lair.x, lair.x + lair.w - 1 - x);
      const cy = Math.min(y - lair.y, lair.y + lair.h - 1 - y);
      if (cx + cy < 1) continue;
      map.set(x, y, Tile.Floor);
    }
  }
  const ante: Room = { x: 8, y: 18, w: 6, h: 5 };
  for (let y = ante.y; y < ante.y + ante.h; y++) for (let x = ante.x; x < ante.x + ante.w; x++) map.set(x, y, Tile.Floor);
  for (let y = lair.y + lair.h; y < ante.y; y++) map.set(10, y, Tile.Floor);

  const seal = { x: 10, y: 1 };
  const spawn = { x: 10, y: 4 };
  const chest = { x: 11, y: 4 };
  map.set(seal.x, seal.y, Tile.Furniture);
  const furniture: Furniture[] = [{ x: seal.x, y: seal.y, kind: "sealedStairs" }];
  // Le socle vide (3 cases) contre le mur du fond, devant l'escalier scellé.
  for (const x of [9, 10, 11]) map.set(x, 2, Tile.Furniture);
  furniture.push({ x: 9, y: 2, kind: "socle" });
  // Six cierges violets (allumés) : quatre aux coins, deux près du socle.
  for (const p of [{ x: 3, y: 3 }, { x: 18, y: 3 }, { x: 3, y: 13 }, { x: 18, y: 13 }, { x: 6, y: 3 }, { x: 15, y: 3 }]) {
    map.set(p.x, p.y, Tile.Furniture);
    furniture.push({ x: p.x, y: p.y, kind: "ciergeViolet" });
  }
  // Le puits de lune, au milieu (il bougera).
  const well = { x: 10 + rng.int(0, 1), y: 8 };
  furniture.push({ x: well.x, y: well.y, kind: "moonWell", variant: "boss" });
  // Six gisants en arc : des gisants éveillés couchés (la lune les relève).
  const sleepers = [{ x: 4, y: 6 }, { x: 16, y: 6 }, { x: 5, y: 9 + rng.int(0, 1) }, { x: 15, y: 9 + rng.int(0, 1) }, { x: 7, y: 12 }, { x: 13, y: 12 }];
  const floor: BossFloor = {
    map,
    rooms: [ante, lair],
    start: { x: 10, y: 20 },
    stairs: seal,
    torches: [{ x: 10, y: ante.y - 1, radius: 5, faceX: 0, faceY: 1 }],
    specials: [],
    furniture,
    secrets: [],
    boss: { spawn, hub: spawn, pillars: [], breaches: [], chest, seal, lair, kind: "pretresse", sleepers, sprouts: [well] },
  };
  return rng.chance(0.5) ? flipX(floor) : floor;
}

/** Le même plan, retourné de gauche à droite. */
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
    furniture: f.furniture.map((o) => ({ ...o, ...p(o, o.kind === "socle" ? 3 : 1) })),
    boss: {
      ...b,
      spawn: p(b.spawn),
      hub: p(b.hub),
      chest: p(b.chest),
      seal: p(b.seal),
      lair: { ...b.lair, x: W - b.lair.x - b.lair.w },
      sleepers: b.sleepers?.map((q) => p(q)),
      sprouts: b.sprouts?.map((q) => p(q)),
    },
  };
}
