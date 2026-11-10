import assert from "node:assert/strict";
import { test } from "node:test";
import { Game } from "../src/core/game";
import { rollAttack } from "../src/core/combat";
import { Rng } from "../src/core/rng";
import { DEFAULT_FLOOR } from "../src/data/floors";
import { generateFloor } from "../src/world/generator";
import { Tile } from "../src/world/map";
import { computeFov, hasLineOfSight } from "../src/world/fov";
import { distanceField, findPath } from "../src/world/pathfinding";

const FLOORS = 1000;

test(`${FLOORS} étages : tout est accessible, l'escalier existe, les bords sont des murs`, () => {
  for (let seed = 1; seed <= FLOORS; seed++) {
    const { map, rooms, start, stairs } = generateFloor(seed, DEFAULT_FLOOR);
    assert.ok(rooms.length >= DEFAULT_FLOOR.minRooms, `graine ${seed} : pas assez de salles`);
    assert.ok(stairs.x !== start.x || stairs.y !== start.y, `graine ${seed} : escalier sur le départ`);
    assert.equal(map.get(stairs.x, stairs.y), Tile.StairsDown);
    const dist = distanceField(map, start);
    let stairsCount = 0;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const border = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1;
        if (border) assert.equal(map.get(x, y), Tile.Wall, `graine ${seed} : bord ouvert en ${x},${y}`);
        if (map.isWalkable(x, y)) {
          assert.notEqual(dist[map.index(x, y)], -1, `graine ${seed} : case ${x},${y} inaccessible`);
        }
        if (map.get(x, y) === Tile.StairsDown) stairsCount++;
      }
    }
    assert.equal(stairsCount, 1, `graine ${seed} : ${stairsCount} escaliers`);
  }
});

test("même graine, même étage", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const a = generateFloor(seed, DEFAULT_FLOOR);
    const b = generateFloor(seed, DEFAULT_FLOOR);
    assert.deepEqual(a.map.tiles, b.map.tiles);
    assert.deepEqual(a.stairs, b.stairs);
  }
  const a = generateFloor(1, DEFAULT_FLOOR);
  const b = generateFloor(2, DEFAULT_FLOOR);
  assert.notDeepEqual(a.map.tiles, b.map.tiles);
});

test("les chemins avancent case par case sans traverser de mur", () => {
  const rng = new Rng(42);
  for (let seed = 1; seed <= 200; seed++) {
    const { map, start } = generateFloor(seed, DEFAULT_FLOOR);
    const target = { x: rng.int(0, map.width - 1), y: rng.int(0, map.height - 1) };
    const path = findPath(map, start, target);
    if (!map.isWalkable(target.x, target.y)) {
      assert.equal(path, null);
      continue;
    }
    assert.ok(path, `graine ${seed} : pas de chemin`);
    let prev = start;
    for (const p of path) {
      assert.ok(map.isWalkable(p.x, p.y));
      assert.ok(Math.abs(p.x - prev.x) <= 1 && Math.abs(p.y - prev.y) <= 1);
      prev = p;
    }
    assert.deepEqual(prev, target);
  }
});

test("jets d'attaque : 20 naturel critique, 1 naturel raté, l'avantage aide", () => {
  const rng = new Rng(7);
  const attacker = { attackBonus: 4, damage: { count: 1, sides: 8, bonus: 2 } };
  const hits = { normal: 0, advantage: 0, disadvantage: 0 };
  for (let i = 0; i < 6000; i++) {
    const mode = (["normal", "advantage", "disadvantage"] as const)[i % 3];
    const r = rollAttack(rng, attacker, { armorClass: 14 }, mode);
    assert.equal(r.rolls.length, mode === "normal" ? 1 : 2);
    if (r.d20 === 20) assert.ok(r.hit && r.critical);
    if (r.d20 === 1) assert.ok(!r.hit);
    assert.equal(r.hit, r.damage > 0);
    if (r.hit) assert.ok(r.damage >= 3 && r.damage <= (r.critical ? 18 : 10));
    if (r.hit) hits[mode]++;
  }
  assert.ok(hits.advantage > hits.normal && hits.normal > hits.disadvantage);
});

test("champ de vision : le héros se voit, rien n'est vu au-delà du rayon ni à travers un mur", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const { map, start } = generateFloor(seed, DEFAULT_FLOOR);
    const fov = computeFov(map, start, 7);
    assert.equal(fov[map.index(start.x, start.y)], 1);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!fov[map.index(x, y)]) continue;
        assert.ok(Math.hypot(x - start.x, y - start.y) <= 8);
        assert.ok(hasLineOfSight(map, start, { x, y }));
      }
    }
  }
});

/** Joueur automatique : attaque le monstre en vue le plus proche, sinon marche vers l'escalier. */
function playRun(seed: number, maxTurns: number): Game {
  const game = new Game(seed);
  while (!game.over && game.turn < maxTurns) {
    if (game.descendIfOnStairs()) continue; // comme la boucle d'affichage après chaque pas
    const foes = game.visibleMonsters();
    if (foes.length > 0) {
      const d = (m: { x: number; y: number }) => Math.max(Math.abs(m.x - game.hero.x), Math.abs(m.y - game.hero.y));
      const target = foes.reduce((a, b) => (d(b) < d(a) ? b : a));
      assert.ok(game.setDestination(target.x, target.y));
    } else {
      let stairs = { x: -1, y: -1 };
      for (let y = 0; y < game.map.height; y++) {
        for (let x = 0; x < game.map.width; x++) {
          if (game.map.get(x, y) === Tile.StairsDown) stairs = { x, y };
        }
      }
      assert.ok(game.setDestination(stairs.x, stairs.y, true));
    }
    assert.ok(game.tick(), `graine ${seed} : le héros est bloqué`);
    // Invariants : chacun sur une case libre et distincte, PV cohérents.
    const cells = new Set<number>();
    for (const a of [game.hero, ...game.monsters]) {
      assert.ok(game.map.isWalkable(a.x, a.y));
      assert.ok(!cells.has(game.map.index(a.x, a.y)), `graine ${seed} : deux acteurs sur la même case`);
      cells.add(game.map.index(a.x, a.y));
      assert.ok(a.hp <= a.maxHp && (a.kind === "hero" ? a.hp >= 0 : a.hp > 0));
    }
    assert.equal(game.over, game.hero.hp === 0);
    game.events.length = 0;
  }
  return game;
}

test("300 parties jouées par un joueur automatique, sans incohérence", () => {
  const depths: number[] = [];
  for (let seed = 1; seed <= 300; seed++) depths.push(playRun(seed, 3000).depth);
  depths.sort((a, b) => a - b);
  const mean = depths.reduce((a, b) => a + b, 0) / depths.length;
  console.log(
    `Équilibrage (joueur automatique fonceur) : étage moyen ${mean.toFixed(1)}, médian ${depths[150]}, max ${depths[299]}, morts à l'étage 1 : ${depths.filter((d) => d === 1).length}/300`,
  );
  assert.ok(mean > 1.5, "le jeu est trop dur dès le premier étage");
});

test("même graine et mêmes ordres : même partie", () => {
  const a = playRun(99, 400);
  const b = playRun(99, 400);
  assert.deepEqual([a.depth, a.turn, a.hero.hp, a.monsters.length], [b.depth, b.turn, b.hero.hp, b.monsters.length]);
});
