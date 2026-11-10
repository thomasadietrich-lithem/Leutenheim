import assert from "node:assert/strict";
import { test } from "node:test";
import { Game } from "../src/core/game";
import { Rng } from "../src/core/rng";
import { DEFAULT_FLOOR } from "../src/data/floors";
import { generateFloor } from "../src/world/generator";
import { Tile } from "../src/world/map";
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

test("une partie simulée descend 20 étages en visant l'escalier", () => {
  const game = new Game(12345);
  for (let depth = 1; depth <= 20; depth++) {
    assert.equal(game.depth, depth);
    let stairs = { x: -1, y: -1 };
    for (let y = 0; y < game.map.height; y++) {
      for (let x = 0; x < game.map.width; x++) {
        if (game.map.get(x, y) === Tile.StairsDown) stairs = { x, y };
      }
    }
    assert.ok(game.setDestination(stairs.x, stairs.y));
    let guard = 0;
    while (game.tick()) assert.ok(++guard < 500);
    assert.ok(game.descendIfOnStairs(), "le héros n'a pas atteint l'escalier");
  }
  assert.ok(game.turn > 0);
});
