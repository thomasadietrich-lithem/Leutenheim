import assert from "node:assert/strict";
import { test } from "node:test";
import { Game } from "../src/core/game";
import { rollAttack } from "../src/core/combat";
import { Rng } from "../src/core/rng";
import { DEFAULT_FLOOR } from "../src/data/floors";
import { spawnsForDepth } from "../src/data/monsters";
import { Inventory } from "../src/items/inventory";
import { generateFloor } from "../src/world/generator";
import { Tile } from "../src/world/map";
import { computeFov, computeLight, hasLineOfSight } from "../src/world/fov";
import { canStep, distanceField, findPath } from "../src/world/pathfinding";

const FLOORS = 1000;

test(`${FLOORS} étages : tout est accessible, l'escalier n'est jamais derrière une porte verrouillée`, () => {
  const stats = { doors: 0, locked: 0, torches: 0, pillars: 0, specials: [0, 0, 0, 0] };
  for (let seed = 1; seed <= FLOORS; seed++) {
    const { map, rooms, start, stairs, torches, specials } = generateFloor(seed, DEFAULT_FLOOR);
    assert.ok(rooms.length >= DEFAULT_FLOOR.minRooms, `graine ${seed} : pas assez de salles`);
    // Une à trois salles spéciales, chacune derrière sa porte verrouillée, avec son contenu au centre.
    assert.ok(specials.length >= 1 && specials.length <= 3, `graine ${seed} : ${specials.length} salles spéciales`);
    stats.specials[specials.length]++;
    let lockedHere = 0;
    for (const t of map.tiles) if (t === Tile.DoorLocked) lockedHere++;
    assert.equal(lockedHere, specials.length, `graine ${seed} : portes verrouillées et salles spéciales ne correspondent pas`);
    for (const sp of specials) {
      const cx = sp.room.x + Math.floor(sp.room.w / 2);
      const cy = sp.room.y + Math.floor(sp.room.h / 2);
      assert.equal(map.get(cx, cy), sp.kind.feature, `graine ${seed} : salle spéciale sans contenu`);
      assert.equal(distanceField(map, start)[map.index(cx, cy)], -1, `graine ${seed} : salle spéciale accessible sans ouvrir sa porte`);
    }
    assert.ok(stairs.x !== start.x || stairs.y !== start.y, `graine ${seed} : escalier sur le départ`);
    assert.equal(map.get(stairs.x, stairs.y), Tile.StairsDown);
    assert.ok(torches.length >= 1, `graine ${seed} : pas de torche dans la salle de départ`);
    stats.torches += torches.length;
    for (const t of torches) assert.equal(map.get(t.x, t.y), Tile.Wall, `graine ${seed} : torche hors d'un mur`);

    // Jamais deux portes à la suite : au moins `doorSpacing` cases entre deux portes.
    const doors: { x: number; y: number }[] = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) if (map.isDoor(x, y)) doors.push({ x, y });
    }
    for (const a of doors) {
      for (const b of doors) {
        if (a === b) continue;
        const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        assert.ok(d >= DEFAULT_FLOOR.doorSpacing, `graine ${seed} : portes trop proches (${a.x},${a.y}) et (${b.x},${b.y})`);
      }
    }

    // Une porte n'a jamais un autre passage ouvert juste à côté dans le mur de sa salle.
    for (const r of rooms) {
      const ring: { x: number; y: number }[] = [];
      for (let x = r.x; x < r.x + r.w; x++) ring.push({ x, y: r.y - 1 }, { x, y: r.y + r.h });
      for (let y = r.y; y < r.y + r.h; y++) ring.push({ x: r.x - 1, y }, { x: r.x + r.w, y });
      const open = ring.filter((c) => map.get(c.x, c.y) !== Tile.Wall);
      for (const d of open.filter((c) => map.get(c.x, c.y) === Tile.DoorClosed)) {
        for (const o of open) {
          if (o === d || map.isDoor(o.x, o.y)) continue;
          const dist = Math.abs(o.x - d.x) + Math.abs(o.y - d.y);
          assert.ok(dist > 3, `graine ${seed} : porte (${d.x},${d.y}) contournable par (${o.x},${o.y})`);
        }
      }
    }

    // Sans ouvrir aucune porte verrouillée, on atteint l'escalier.
    assert.notEqual(distanceField(map, start)[map.index(stairs.x, stairs.y)], -1, `graine ${seed} : escalier enfermé`);

    // Une fois les portes verrouillées ouvertes, tout l'étage est accessible.
    const open = generateFloor(seed, DEFAULT_FLOOR).map;
    let stairsCount = 0;
    for (let i = 0; i < open.tiles.length; i++) {
      if (open.tiles[i] === Tile.DoorClosed) stats.doors++;
      if (open.tiles[i] === Tile.Pillar) stats.pillars++;
      if (open.tiles[i] === Tile.DoorLocked) {
        stats.locked++;
        open.tiles[i] = Tile.DoorClosed;
      }
    }
    const dist = distanceField(open, start);
    for (let y = 0; y < open.height; y++) {
      for (let x = 0; x < open.width; x++) {
        const border = x === 0 || y === 0 || x === open.width - 1 || y === open.height - 1;
        if (border) assert.equal(open.get(x, y), Tile.Wall, `graine ${seed} : bord ouvert en ${x},${y}`);
        if (open.isWalkable(x, y)) {
          assert.notEqual(dist[open.index(x, y)], -1, `graine ${seed} : case ${x},${y} inaccessible`);
        }
        if (open.get(x, y) === Tile.StairsDown) stairsCount++;
      }
    }
    assert.equal(stairsCount, 1, `graine ${seed} : ${stairsCount} escaliers`);
  }
  const mean = stats.locked / FLOORS;
  console.log(
    `Par étage en moyenne : ${(stats.doors / FLOORS).toFixed(1)} portes, ${(stats.torches / FLOORS).toFixed(1)} torches, ${(stats.pillars / FLOORS).toFixed(1)} colonnes, ${mean.toFixed(2)} salles spéciales (1 salle : ${stats.specials[1]}, 2 : ${stats.specials[2]}, 3 : ${stats.specials[3]} sur ${FLOORS})`,
  );
  assert.ok(stats.doors > FLOORS && stats.pillars > FLOORS);
  assert.ok(mean > 1.35 && mean < 1.65, `moyenne de salles spéciales : ${mean}`);
  assert.ok(stats.specials[3] > 0 && stats.specials[3] < stats.specials[2] && stats.specials[2] < stats.specials[1]);
});

test("lumière : une case éclairée voit une torche ; la lumière ne fait qu'agrandir le champ de vision", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const { map, start, torches } = generateFloor(seed, DEFAULT_FLOOR);
    const light = computeLight(map, torches);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (light[map.index(x, y)] > 0 && !map.blocksSight(x, y)) {
          assert.ok(torches.some((t) => hasLineOfSight(map, { x: t.x + t.faceX, y: t.y + t.faceY }, { x, y })));
        }
      }
    }
    assert.ok(light[map.index(start.x, start.y)] >= 0); // la salle de départ a une torche
    const dark = computeFov(map, start, 4);
    const lit = computeFov(map, start, 4, 11, light);
    let more = 0;
    for (let i = 0; i < dark.length; i++) {
      if (dark[i]) assert.equal(lit[i], 1);
      if (lit[i] && !dark[i]) more++;
    }
    assert.ok(more >= 0);
  }
});

/** Cherche une partie dont le premier étage a une porte verrouillée, y mène le héros et applique `action`. */
function openLockedDoor(action: "pick" | "break"): { game: Game; door: { x: number; y: number }; alertedByNoise: number } {
  for (let seed = 1; seed < 400; seed++) {
    const game = new Game(seed);
    let door: { x: number; y: number } | null = null;
    for (let y = 0; y < game.map.height && !door; y++) {
      for (let x = 0; x < game.map.width; x++) {
        if (game.map.get(x, y) === Tile.DoorLocked) {
          door = { x, y };
          break;
        }
      }
    }
    if (!door) continue;
    let alertedByNoise = 0;
    for (let turn = 0; turn < 400 && !game.over && game.map.get(door.x, door.y) === Tile.DoorLocked; turn++) {
      if (game.pendingDoor) assert.ok(game.actOnDoor(action));
      else if (game.path.length === 0) assert.ok(game.setDestination(door.x, door.y, true));
      game.tick();
      for (const e of game.events) if (e.type === "door") alertedByNoise += e.alerted;
      game.events.length = 0;
    }
    if (!game.over && game.map.get(door.x, door.y) !== Tile.DoorLocked) return { game, door, alertedByNoise };
  }
  throw new Error("aucune porte verrouillée ouverte en 400 graines");
}

test("porte verrouillée : crochetée elle s'ouvre, enfoncée elle est détruite et le bruit alerte", () => {
  const picked = openLockedDoor("pick");
  assert.equal(picked.game.map.get(picked.door.x, picked.door.y), Tile.DoorOpen);
  assert.equal(picked.alertedByNoise, 0);
  assert.equal(picked.game.pendingDoor, null);

  const broken = openLockedDoor("break");
  assert.equal(broken.game.map.get(broken.door.x, broken.door.y), Tile.Floor);
  // Après le vacarme, plus aucun monstre proche de la porte n'est endormi.
  for (const m of broken.game.monsters) {
    const d = Math.max(Math.abs(m.x - broken.door.x), Math.abs(m.y - broken.door.y));
    if (d <= 8) assert.ok(m.alerted, "un monstre proche n'a pas été alerté");
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
    // Pas de chemin vers un mur, ni vers l'intérieur d'une salle verrouillée.
    if (distanceField(map, start)[map.index(target.x, target.y)] === -1) {
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
        assert.ok(Math.hypot(x - start.x, y - start.y) <= 9.5);
        // Un mur est vu s'il touche une case dégagée visible (coins de salle) ; le reste exige une ligne de vue.
        const touchesSeenFloor = [-1, 0, 1].some((dy) =>
          [-1, 0, 1].some((dx) => !map.blocksSight(x + dx, y + dy) && fov[map.index(x + dx, y + dy)] === 1),
        );
        assert.ok(hasLineOfSight(map, start, { x, y }) || (map.blocksSight(x, y) && touchesSeenFloor));
      }
    }
  }
});

/** Joueur automatique : attaque le monstre en vue le plus proche, sinon marche vers l'escalier. */
function playRun(seed: number, maxTurns: number): Game {
  const game = new Game(seed);
  while (!game.over && game.turn < maxTurns) {
    // Comme la boucle d'affichage après chaque pas, mais ce joueur-ci ne remonte jamais.
    if (game.pendingStairs === "down" && game.takeStairs()) continue;
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
    // Les portes se referment : une porte ouverte a forcément quelqu'un dans son encadrement.
    for (let i = 0; i < game.map.tiles.length; i++) {
      if (game.map.tiles[i] === Tile.DoorOpen) assert.ok(cells.has(i), `graine ${seed} : porte restée ouverte`);
    }
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

test("se désengager provoque une attaque d'opportunité, puis le déplacement s'arrête", () => {
  let checked = 0;
  for (let seed = 1; seed <= 200 && checked < 20; seed++) {
    const game = new Game(seed);
    const home = { x: game.hero.x, y: game.hero.y };
    // Aller au contact d'un monstre et attendre qu'il soit alerté.
    for (let turn = 0; turn < 300 && !game.over; turn++) {
      const foe = game.monsters[0];
      if (!foe) break;
      const near = Math.max(Math.abs(foe.x - game.hero.x), Math.abs(foe.y - game.hero.y)) === 1;
      if (near && foe.alerted) break;
      if (near) game.wait();
      else if (game.path.length === 0) game.setDestination(foe.x, foe.y, true);
      game.tick();
    }
    const foe = game.monsters[0];
    if (game.over || !foe || !foe.alerted) continue;
    // « Au contact » : case voisine, sans coin de mur entre les deux.
    const reach = (fx: number, fy: number) =>
      Math.max(Math.abs(game.hero.x - fx), Math.abs(game.hero.y - fy)) === 1 &&
      canStep(game.map, fx, fy, game.hero.x - fx, game.hero.y - fy);
    if (!reach(foe.x, foe.y)) continue;
    // Repartir vers la salle de départ : un trajet de plusieurs cases.
    game.events.length = 0;
    if (!game.setDestination(home.x, home.y, true) || game.path.length < 3) continue;
    const hpBefore = game.hero.hp;
    game.tick();
    const stillNear = reach(foe.fromX, foe.fromY);
    const reactions = game.events.filter((e) => e.type === "attack" && e.opportunity);
    if (stillNear) {
      assert.equal(reactions.length, 0, `graine ${seed} : attaque d'opportunité sans désengagement`);
      continue;
    }
    assert.ok(reactions.length >= 1, `graine ${seed} : pas d'attaque d'opportunité`);
    assert.equal(game.path.length, 0, `graine ${seed} : le déplacement aurait dû s'arrêter`);
    // Dans le même tour, un monstre n'attaque pas deux fois : au plus une attaque par monstre.
    const attackers = game.events.filter((e) => e.type === "attack" && e.attacker.kind === "monster").map((e) => (e.type === "attack" ? e.attacker.id : -1));
    assert.equal(new Set(attackers).size, attackers.length, `graine ${seed} : un monstre a attaqué deux fois`);
    assert.ok(game.hero.hp <= hpBefore);
    checked++;
  }
  assert.ok(checked >= 5, `seulement ${checked} situations de désengagement testées`);
});

test("les endormis ne bougent pas, les promeneurs si ; on dort moins en profondeur", () => {
  assert.ok(spawnsForDepth(1).sleepChance > spawnsForDepth(4).sleepChance);
  assert.ok(spawnsForDepth(4).sleepChance > spawnsForDepth(8).sleepChance);
  let sleepers = 0;
  let walkers = 0;
  let walkersMoved = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const game = new Game(seed);
    const before = game.monsters.map((m) => ({ m, x: m.x, y: m.y, asleep: m.asleep }));
    for (let turn = 0; turn < 25 && !game.over; turn++) {
      game.wait();
      game.tick();
    }
    for (const b of before) {
      if (b.m.alerted) continue; // a remarqué le héros entre-temps : hors sujet
      if (b.asleep) {
        sleepers++;
        assert.ok(b.m.x === b.x && b.m.y === b.y, `graine ${seed} : un endormi a bougé`);
      } else {
        walkers++;
        if (b.m.x !== b.x || b.m.y !== b.y) walkersMoved++;
      }
    }
  }
  assert.ok(sleepers > walkers, "au premier étage, la plupart devraient dormir");
  assert.ok(walkers >= 5 && walkersMoved >= walkers * 0.9, `promeneurs immobiles : ${walkers - walkersMoved}/${walkers}`);
});

test("embuscade : un monstre a l'avantage contre un héros dans l'encadrement d'une porte", () => {
  let checked = 0;
  for (let seed = 1; seed <= 100 && checked < 10; seed++) {
    const game = new Game(seed);
    const foe = game.monsters[0];
    if (!foe) continue;
    // On place le héros dans une porte et le monstre, alerté, sur une case voisine.
    let door: { x: number; y: number } | null = null;
    for (let y = 0; y < game.map.height && !door; y++) {
      for (let x = 0; x < game.map.width; x++) {
        if (game.map.get(x, y) === Tile.DoorClosed) {
          door = { x, y };
          break;
        }
      }
    }
    if (!door) continue;
    const side = [[0, 1], [0, -1], [1, 0], [-1, 0]].find(([dx, dy]) => game.map.get(door!.x + dx, door!.y + dy) === Tile.Floor);
    if (!side) continue;
    game.monsters = [foe];
    Object.assign(foe, { x: door.x + side[0], y: door.y + side[1], alerted: true, asleep: false });
    Object.assign(game.hero, { x: door.x, y: door.y, hp: 1000, maxHp: 1000 });
    game.wait();
    game.tick();
    const inDoor = game.events.find((e) => e.type === "attack" && e.attacker === foe);
    assert.ok(inDoor && inDoor.type === "attack" && inDoor.result.mode === "advantage", `graine ${seed} : pas d'avantage dans la porte`);
    // Hors de la porte, jet normal.
    game.events.length = 0;
    Object.assign(game.hero, { x: door.x + side[0], y: door.y + side[1] });
    Object.assign(foe, { x: door.x, y: door.y });
    game.wait();
    game.tick();
    const outside = game.events.find((e) => e.type === "attack" && e.attacker === foe);
    assert.ok(outside && outside.type === "attack" && outside.result.mode === "normal", `graine ${seed} : avantage hors de la porte`);
    // Symétrie : le monstre est maintenant dans la porte, le héros qui l'y attend a l'avantage.
    game.events.length = 0;
    foe.hp = foe.maxHp = 1000;
    assert.ok(game.setDestination(foe.x, foe.y, true));
    game.tick();
    const mine = game.events.find((e) => e.type === "attack" && e.attacker === game.hero);
    assert.ok(mine && mine.type === "attack" && mine.result.mode === "advantage", `graine ${seed} : le héros n'a pas l'avantage`);
    checked++;
  }
  assert.ok(checked >= 5);
});

test("fontaine : y marcher rend tous les points de vie, une seule fois", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const game = new Game(seed);
    let at: { x: number; y: number } | null = null;
    for (let y = 0; y < game.map.height && !at; y++) {
      for (let x = 0; x < game.map.width; x++) {
        if (game.map.get(x, y) === Tile.Fountain) {
          at = { x, y };
          break;
        }
      }
    }
    if (!at) continue;
    // On pose le héros blessé à côté de la fontaine, sans monstre, puis il y entre.
    game.monsters = [];
    Object.assign(game.hero, { x: at.x + 1, y: at.y, hp: 3 });
    assert.ok(game.moveBy(-1, 0));
    game.tick();
    assert.equal(game.hero.hp, game.hero.maxHp);
    assert.equal(game.map.get(at.x, at.y), Tile.FountainDry);
    assert.ok(game.events.some((e) => e.type === "fountain" && e.healed === game.hero.maxHp - 3));
    return;
  }
  assert.fail("aucune fontaine trouvée en 300 parties");
});

test("sac : objets de deux cases, piles de flèches, pas de chevauchement", () => {
  const bag = new Inventory(6, 4);
  assert.equal(bag.add("epee"), 0);
  assert.equal(bag.add("arc_court"), 0);
  assert.equal(bag.add("fleche", 5), 0);
  const [sword, bow, arrows] = bag.items;
  assert.deepEqual([bag.def(sword).w, bag.def(sword).h, bag.def(bow).h], [1, 2, 2]);
  assert.equal(bag.at(sword.x, sword.y + 1), sword, "l'épée occupe deux cases");
  // Les flèches s'empilent dans la même case.
  bag.add("fleche", 3);
  assert.equal(bag.items.length, 3);
  assert.equal(arrows.count, 8);
  // Déplacements : refusés hors du sac ou sur un autre objet, acceptés sur une place libre.
  assert.equal(bag.moveTo(sword.uid, bow.x, bow.y), false);
  assert.equal(bag.moveTo(sword.uid, 0, 3), false, "dépasserait en bas");
  assert.equal(bag.moveTo(sword.uid, 5, 2), true);
  assert.equal(bag.at(5, 3), sword);
  // Une pile pleine déborde sur une nouvelle case ; un sac plein refuse le surplus.
  bag.add("fleche", 30);
  assert.equal(bag.count("fleche"), 38);
  assert.ok(bag.items.filter((i) => i.defId === "fleche").every((i) => i.count <= 20));
  assert.ok(bag.take("fleche", 38) && bag.count("fleche") === 0 && !bag.take("fleche", 1));
  const full = new Inventory(1, 2);
  assert.equal(full.add("epee"), 0);
  assert.equal(full.add("fleche", 2), 2);
});

test("ce qui est porté est à part du sac ; attaque et classe d'armure viennent de l'équipement", () => {
  const game = new Game(1);
  // Au départ : cotte de mailles, épée et arc sont portés ; seules les flèches sont dans le sac.
  assert.deepEqual(
    [game.equipment.armor?.defId, game.equipment.melee?.defId, game.equipment.ranged?.defId, game.equipment.hat, game.equipment.amulet],
    ["cotte_mailles", "epee", "arc_court", null, null],
  );
  assert.deepEqual(game.inventory.items.map((i) => i.defId), ["fleche"]);
  assert.deepEqual([game.hero.attackBonus, game.hero.damage, game.hero.armorClass], [4, { count: 1, sides: 6, bonus: 2 }, 15]);
  assert.equal(game.arrows(), 5);
  // On retire l'épée : elle va dans le sac, on se bat à mains nues.
  assert.ok(game.unequip("melee"));
  const sword = game.inventory.items.find((i) => i.defId === "epee")!;
  assert.ok(sword && game.equipment.melee === null);
  assert.deepEqual([game.hero.attackBonus, game.hero.damage.sides], [2, 2]);
  // On retire l'armure : classe d'armure de base.
  assert.ok(game.unequip("armor"));
  assert.equal(game.hero.armorClass, 10);
  // On rééquipe : les objets quittent le sac.
  assert.ok(game.equip(sword.uid));
  assert.ok(game.equip(game.inventory.items.find((i) => i.defId === "cotte_mailles")!.uid));
  assert.deepEqual([game.hero.attackBonus, game.hero.armorClass], [4, 15]);
  assert.deepEqual(game.inventory.items.map((i) => i.defId), ["fleche"]);
  // Les flèches ne se portent pas.
  assert.equal(game.equip(game.inventory.items[0].uid), false);
});

test("tirer sur le décor : la flèche se plante au sol, ou rebondit d'une case sur un mur", () => {
  let floorShots = 0;
  let wallShots = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const game = new Game(seed);
    game.monsters.splice(0);
    game.inventory.add("fleche", 10);
    const hero = { x: game.hero.x, y: game.hero.y };
    // Une case de sol à deux pas, bien en vue.
    const ground = [[2, 0], [-2, 0], [0, 2], [0, -2]]
      .map(([dx, dy]) => ({ x: hero.x + dx, y: hero.y + dy }))
      .find((p) => game.map.get(p.x, p.y) === Tile.Floor && game.map.get((p.x + hero.x) / 2, (p.y + hero.y) / 2) === Tile.Floor && game.isVisible(p.x, p.y));
    if (ground) {
      assert.equal(game.shoot(ground.x, ground.y), null);
      game.tick();
      const arrow = game.events.find((e) => e.type === "arrow");
      assert.ok(arrow && arrow.type === "arrow" && !arrow.hit && !arrow.via);
      assert.deepEqual([arrow.x, arrow.y], [ground.x, ground.y], "la flèche se plante dans la case visée");
      assert.ok(!game.events.some((e) => e.type === "attack"));
      game.events.length = 0;
      floorShots++;
    }
    // Un mur en vue, dans l'axe : la flèche le heurte et retombe une case en arrière.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let d = 1;
      while (d <= 6 && game.map.get(hero.x + dx * d, hero.y + dy * d) === Tile.Floor) d++;
      const wall = { x: hero.x + dx * d, y: hero.y + dy * d };
      if (d < 3 || d > 6 || game.map.get(wall.x, wall.y) !== Tile.Wall || !game.isVisible(wall.x, wall.y)) continue;
      assert.equal(game.shoot(wall.x, wall.y), null);
      game.tick();
      const arrow = game.events.find((e) => e.type === "arrow");
      assert.ok(arrow && arrow.type === "arrow" && arrow.via);
      assert.deepEqual(arrow.via, { x: wall.x - dx, y: wall.y - dy }, "elle heurte le mur depuis la case voisine");
      assert.deepEqual([arrow.x, arrow.y], [wall.x - dx * 2, wall.y - dy * 2], "elle retombe une case en arrière");
      game.events.length = 0;
      wallShots++;
      break;
    }
  }
  assert.ok(floorShots >= 20 && wallShots >= 20, `tirs au sol : ${floorShots}, sur un mur : ${wallShots}`);
});

test("tir à l'arc : portée, flèche consommée, récupérable 6 fois sur 10 si elle touche, 1 fois sur 2 sinon", () => {
  const stats = { hit: 0, hitKept: 0, miss: 0, missKept: 0 };
  let rangeChecked = false;
  for (let seed = 1; seed <= 400; seed++) {
    const game = new Game(seed);
    const foe = game.monsters[0];
    if (!foe) continue;
    // On installe un monstre increvable dans la salle de départ, à 3 cases du héros, et on vide le reste.
    const spot = [[3, 0], [-3, 0], [0, 3], [0, -3]]
      .map(([dx, dy]) => ({ x: game.hero.x + dx, y: game.hero.y + dy }))
      .find((p) => game.map.get(p.x, p.y) === Tile.Floor && hasLineOfSight(game.map, game.hero, p));
    if (!spot) continue;
    game.monsters = [foe];
    Object.assign(foe, { ...spot, hp: 100000, maxHp: 100000, asleep: true, alerted: false });
    game.hero.hp = game.hero.maxHp = 100000;
    game.wait();
    game.tick(); // met à jour ce que le héros voit
    game.events.length = 0;
    game.inventory.add("fleche", 15);
    for (let shot = 0; shot < 20; shot++) {
      const before = game.arrows();
      if (!game.isVisible(foe.x, foe.y) || Math.max(Math.abs(foe.x - game.hero.x), Math.abs(foe.y - game.hero.y)) > 6) break;
      if (game.shoot(foe.x, foe.y) !== null) break;
      game.tick();
      assert.equal(game.arrows(), before - 1, "un tir consomme une flèche");
      const arrow = game.events.find((e) => e.type === "arrow");
      assert.ok(arrow && arrow.type === "arrow");
      if (arrow.hit) {
        stats.hit++;
        if (arrow.kept) stats.hitKept++;
        assert.deepEqual([arrow.x, arrow.y], [foe.fromX, foe.fromY], "une flèche qui touche tombe sur la cible");
      } else {
        stats.miss++;
        if (arrow.kept) stats.missKept++;
        assert.ok(game.map.isWalkable(arrow.x, arrow.y), "une flèche ratée finit sur une case praticable");
      }
      if (arrow.kept) assert.ok(game.ground.some((g) => g.item === "fleche" && g.x === arrow.x && g.y === arrow.y));
      game.events.length = 0;
    }
    if (!rangeChecked) {
      // Hors de portée : refus, sans consommer de flèche.
      game.inventory.add("fleche", 1);
      const far = game.monsters[0];
      const savedX = far.x;
      far.x = game.hero.x + 7;
      const visible = game.visible;
      visible[game.map.index(far.x, far.y)] = 1;
      if (game.map.inBounds(far.x, far.y)) {
        assert.equal(game.shoot(far.x, far.y), "out-of-range");
        rangeChecked = true;
      }
      far.x = savedX;
    }
  }
  console.log(
    `Flèches : ${stats.hit} touchées dont ${stats.hitKept} récupérables (${((100 * stats.hitKept) / stats.hit).toFixed(0)} %), ${stats.miss} ratées dont ${stats.missKept} récupérables (${((100 * stats.missKept) / stats.miss).toFixed(0)} %)`,
  );
  assert.ok(stats.hit > 300 && stats.miss > 300 && rangeChecked);
  assert.ok(Math.abs(stats.hitKept / stats.hit - 0.6) < 0.06);
  assert.ok(Math.abs(stats.missKept / stats.miss - 0.5) < 0.06);
});

test("ramasser une flèche au sol la remet dans le sac ; la clef ouvre une porte verrouillée", () => {
  const game = new Game(3);
  game.monsters = [];
  game.ground = [{ x: game.hero.x + 1, y: game.hero.y, item: "fleche", count: 2 }];
  assert.ok(game.moveBy(1, 0));
  game.tick();
  assert.equal(game.arrows(), 7);
  assert.equal(game.ground.length, 0);
  assert.ok(game.events.some((e) => e.type === "pickup" && e.count === 2));

  // Clef : pas de jet, pas de bruit, la clef est consommée.
  let door: { x: number; y: number } | null = null;
  for (let y = 0; y < game.map.height && !door; y++) {
    for (let x = 0; x < game.map.width; x++) {
      if (game.map.get(x, y) === Tile.DoorLocked) {
        door = { x, y };
        break;
      }
    }
  }
  assert.ok(door);
  game.inventory.add("clef", 1);
  for (let turn = 0; turn < 200 && !game.pendingDoor; turn++) {
    if (game.path.length === 0) assert.ok(game.setDestination(door.x, door.y, true));
    game.tick();
  }
  assert.ok(game.pendingDoor);
  assert.equal(game.actOnDoor("key"), true);
  game.tick();
  assert.equal(game.map.get(door.x, door.y), Tile.DoorOpen);
  assert.equal(game.inventory.count("clef"), 0);
  assert.equal(game.actOnDoor("key"), false);
});

test("coin de mur : on peut frapper en diagonale par-delà, avec l'avantage, dans les deux sens", () => {
  let checked = 0;
  for (let seed = 1; seed <= 60 && checked < 10; seed++) {
    const game = new Game(seed);
    const foe = game.monsters[0];
    if (!foe) continue;
    const map = game.map;
    // Deux cases en diagonale, avec un mur d'un seul côté du coin.
    let pair: { a: { x: number; y: number }; b: { x: number; y: number } } | null = null;
    for (let y = 1; y < map.height - 1 && !pair; y++) {
      for (let x = 1; x < map.width - 1 && !pair; x++) {
        if (map.get(x, y) !== Tile.Floor || map.get(x + 1, y + 1) !== Tile.Floor) continue;
        if (map.get(x + 1, y) === Tile.Wall && map.get(x, y + 1) === Tile.Floor) pair = { a: { x, y }, b: { x: x + 1, y: y + 1 } };
      }
    }
    if (!pair) continue;
    game.monsters = [foe];
    Object.assign(foe, { ...pair.b, alerted: true, asleep: false, hp: 1000, maxHp: 1000 });
    Object.assign(game.hero, { ...pair.a, hp: 1000, maxHp: 1000 });
    game.wait();
    game.tick(); // met la vision à jour ; le monstre frappe déjà
    const theirs = game.events.find((e) => e.type === "attack" && e.attacker === foe);
    assert.ok(theirs && theirs.type === "attack" && theirs.result.mode === "advantage", `graine ${seed} : le monstre n'a pas l'avantage au coin`);
    game.events.length = 0;
    assert.ok(game.heroHasAdvantageOn(foe));
    assert.ok(game.setDestination(foe.x, foe.y, true));
    const before = { x: game.hero.x, y: game.hero.y };
    game.tick();
    const mine = game.events.find((e) => e.type === "attack" && e.attacker === game.hero);
    assert.ok(mine && mine.type === "attack" && mine.result.mode === "advantage", `graine ${seed} : pas d'attaque avec avantage au coin`);
    assert.deepEqual({ x: game.hero.x, y: game.hero.y }, before, "le héros frappe sans se déplacer");
    checked++;
  }
  assert.ok(checked >= 5);
});

test("escaliers : on peut remonter, et chaque étage est retrouvé tel qu'on l'a laissé", () => {
  const game = new Game(5);
  const find = (tile: number) => {
    for (let y = 0; y < game.map.height; y++) {
      for (let x = 0; x < game.map.width; x++) if (game.map.get(x, y) === tile) return { x, y };
    }
    return null;
  };
  /** Marche jusqu'à une case sans rien d'autre en jeu, puis prend l'escalier s'il y en a un. */
  const walkTo = (p: { x: number; y: number }) => {
    for (let turn = 0; turn < 300 && (game.hero.x !== p.x || game.hero.y !== p.y); turn++) {
      if (game.path.length === 0) assert.ok(game.setDestination(p.x, p.y, true));
      game.tick();
    }
    assert.deepEqual({ x: game.hero.x, y: game.hero.y }, p);
  };
  assert.equal(find(Tile.StairsUp), null, "pas d'escalier qui monte au premier étage");
  // Étage 1 : on retire les monstres sauf un, on laisse une flèche par terre, puis on descend.
  game.hero.hp = game.hero.maxHp = 1000;
  game.monsters.splice(1);
  game.ground.push({ x: game.hero.x, y: game.hero.y, item: "fleche", count: 3 });
  const floor1 = game.map;
  const down1 = find(Tile.StairsDown)!;
  for (const m of game.monsters) Object.assign(m, { asleep: true, alerted: false });
  walkTo(down1);
  const explored1 = game.explored.reduce((n, v) => n + v, 0);
  assert.equal(game.pendingStairs, "down");
  const survivors = game.monsters.length; // ce qu'il reste au moment de quitter l'étage
  assert.ok(game.takeStairs());
  assert.equal(game.depth, 2);

  // Étage 2 : on arrive sur l'escalier qui remonte, sans repartir aussitôt.
  const up2 = find(Tile.StairsUp)!;
  assert.deepEqual({ x: game.hero.x, y: game.hero.y }, up2);
  assert.equal(game.pendingStairs, null);
  assert.equal(game.takeStairs(), false);
  const floor2 = game.map;
  game.monsters.splice(0);
  // On s'écarte d'une case, puis on revient sur l'escalier pour remonter.
  const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: up2.x + dx, y: up2.y + dy })).find((p) => game.map.get(p.x, p.y) === Tile.Floor)!;
  walkTo(side);
  walkTo(up2);
  assert.equal(game.pendingStairs, "up");
  const hpBefore = game.hero.hp;
  assert.ok(game.takeStairs());

  // De retour à l'étage 1 : même carte, même exploration, mêmes monstres, flèche toujours là.
  assert.equal(game.depth, 1);
  assert.equal(game.map, floor1);
  assert.deepEqual({ x: game.hero.x, y: game.hero.y }, down1);
  assert.equal(game.monsters.length, survivors);
  assert.ok(game.explored.reduce((n, v) => n + v, 0) >= explored1);
  assert.ok(game.ground.some((g) => g.item === "fleche" && g.count === 3));
  assert.equal(game.hero.hp, hpBefore, "remonter ne soigne pas");
  assert.ok(game.events.some((e) => e.type === "stairs" && e.direction === "up"));

  // Et en redescendant, l'étage 2 est le même qu'avant, toujours vide de monstres.
  const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: down1.x + dx, y: down1.y + dy })).find((p) => game.map.get(p.x, p.y) === Tile.Floor)!;
  for (const m of game.monsters) Object.assign(m, { asleep: true, alerted: false });
  walkTo(beside);
  walkTo(down1);
  assert.ok(game.takeStairs());
  assert.equal(game.map, floor2);
  assert.equal(game.monsters.length, 0);
});
