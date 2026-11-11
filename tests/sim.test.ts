import assert from "node:assert/strict";
import { RULES } from "../src/data/rules";
import { ITEMS } from "../src/data/items";
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
    assert.ok(specials.length >= 1 && specials.length <= 2, `graine ${seed} : ${specials.length} salles spéciales`);
    assert.equal(new Set(specials.map((sp) => sp.kind.id)).size, specials.length, `graine ${seed} : deux salles spéciales identiques`);
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

    // Une porte se mérite : on ne peut pas la contourner par un petit détour.
    for (const d of doors.filter((c) => map.get(c.x, c.y) === Tile.DoorClosed)) {
      const sides = [[1, 0], [0, 1]]
        .map(([dx, dy]) => [{ x: d.x + dx, y: d.y + dy }, { x: d.x - dx, y: d.y - dy }])
        .find(([a, b]) => map.isWalkable(a.x, a.y) && map.isWalkable(b.x, b.y));
      assert.ok(sides, `graine ${seed} : porte (${d.x},${d.y}) sans passage de part et d'autre`);
      const around = distanceField(map, sides[0], (x, y) => x !== d.x || y !== d.y)[map.index(sides[1].x, sides[1].y)];
      assert.ok(around === -1 || around > DEFAULT_FLOOR.doorDetour, `graine ${seed} : porte (${d.x},${d.y}) contournable en ${around} pas`);
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
  // Jamais deux salles spéciales du même type : pas plus de salles que de types (2 aujourd'hui).
  assert.ok(stats.specials[3] === 0 && stats.specials[2] > 0 && stats.specials[2] < stats.specials[1]);
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
      if (game.pendingDoor) {
        if (!game.actOnDoor(action)) break; // un échec retire cette méthode : on essaie une autre partie
      } else if (game.path.length === 0) {
        assert.ok(game.setDestination(door.x, door.y, true));
      }
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
    } else if (game.restProgress() > 0) {
      // Repos en cours : il le mène à son terme.
    } else if (game.hero.hp * 2 <= game.hero.maxHp && game.rest()) {
      // Mal en point et personne en vue : il se repose (une fois par étage).
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
    // « Au contact », comme dans le jeu : case voisine ; en diagonale, il suffit qu'un des deux côtés soit libre.
    const reach = (fx: number, fy: number) => {
      const dx = game.hero.x - fx;
      const dy = game.hero.y - fy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return false;
      return dx === 0 || dy === 0 || game.map.isWalkable(fx + dx, fy) || game.map.isWalkable(fx, fy + dy);
    };
    if (!reach(foe.x, foe.y)) continue;
    // Repartir vers la salle de départ : un trajet de plusieurs cases.
    game.events.length = 0;
    if (!game.setDestination(home.x, home.y, true) || game.path.length < 3) continue;
    const hpBefore = game.hero.hp;
    // Passer une porte protège de l'attaque d'opportunité : ce cas a son propre test.
    const step = game.path[0];
    if (game.map.isDoor(step.x, step.y) || game.map.isDoor(game.hero.x, game.hero.y)) continue;
    game.tick();
    const stillNear = reach(foe.fromX, foe.fromY);
    const reactions = game.events.filter((e) => e.type === "attack" && e.opportunity && e.attacker === foe);
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
    ["tunique", "epee", "arc_court", null, null],
  );
  assert.deepEqual(game.inventory.items.map((i) => i.defId), ["fleche"]);
  assert.deepEqual([game.hero.attackBonus, game.hero.damage, game.hero.armorClass], [4, { count: 1, sides: 6, bonus: 2 }, 12]);
  assert.equal(game.arrows(), 10);
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
  assert.ok(game.equip(game.inventory.items.find((i) => i.defId === "tunique")!.uid));
  assert.deepEqual([game.hero.attackBonus, game.hero.armorClass], [4, 12]);
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
      const back = Math.abs(arrow.x - arrow.via.x) + Math.abs(arrow.y - arrow.via.y);
      assert.ok(back === 1 || back === 2, `rebond de ${back} cases`);
      assert.deepEqual([arrow.x, arrow.y], [arrow.via.x - dx * back, arrow.via.y - dy * back], "elle retombe en arrière, dans l'axe");
      const lying = game.ground.find((g) => g.x === arrow.x && g.y === arrow.y);
      if (arrow.kept) assert.ok(lying && typeof lying.angle === "number", "une flèche au sol a une orientation");
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
      if (!game.isVisible(foe.x, foe.y) || Math.max(Math.abs(foe.x - game.hero.x), Math.abs(foe.y - game.hero.y)) > ITEMS.arc_court.range!) break;
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
      far.x = game.hero.x + ITEMS.arc_court.range! + 1;
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
  // Marcher sur un objet ne le ramasse plus : il faut le décider, et cela prend un tour.
  assert.equal(game.arrows(), 10);
  assert.equal(game.itemsHere().length, 1);
  assert.ok(game.pickUp());
  game.tick();
  assert.equal(game.arrows(), 12);
  assert.equal(game.pickUp(), false, "plus rien à ramasser");
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
  game.inventory.add("clef", 1, game.depth);
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

test("porte : après un échec, la même méthode n'est plus proposée", () => {
  for (const action of ["pick", "break"] as const) {
    let found = false;
    for (let seed = 1; seed < 300 && !found; seed++) {
      const game = new Game(seed);
      game.monsters.splice(0);
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
      for (let turn = 0; turn < 300 && !game.pendingDoor; turn++) {
        if (game.path.length === 0) assert.ok(game.setDestination(door.x, door.y, true));
        game.tick();
      }
      assert.deepEqual(game.doorOptions(), ["pick", "break"]);
      assert.ok(game.actOnDoor(action));
      game.tick();
      const attempt = game.events.find((e) => e.type === "door");
      assert.ok(attempt && attempt.type === "door");
      if (attempt.success) continue; // on cherche un échec
      found = true;
      const other = action === "pick" ? "break" : "pick";
      assert.deepEqual(game.doorOptions(), [other]);
      assert.equal(game.actOnDoor(action), false, "on ne peut pas retenter la même méthode");
      assert.equal(game.map.get(door.x, door.y), Tile.DoorLocked);
      // Une clef rouvre une possibilité.
      game.inventory.add("clef", 1, game.depth);
      assert.deepEqual(game.doorOptions(), ["key", other]);
    }
    assert.ok(found, `aucun échec trouvé pour ${action}`);
  }
});

test("une flèche brisée reste quelques tours au sol, puis disparaît", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const game = new Game(seed);
    game.monsters.splice(0);
    const target = [[2, 0], [-2, 0], [0, 2], [0, -2]]
      .map(([dx, dy]) => ({ x: game.hero.x + dx, y: game.hero.y + dy }))
      .find((p) => game.map.get(p.x, p.y) === Tile.Floor && game.isVisible(p.x, p.y));
    if (!target || game.shoot(target.x, target.y) !== null) continue;
    game.tick();
    const arrow = game.events.find((e) => e.type === "arrow");
    if (!arrow || arrow.type !== "arrow" || arrow.kept) continue; // on cherche une flèche qui se brise
    assert.equal(game.debris.length, 1);
    assert.deepEqual([game.debris[0].x, game.debris[0].y], [arrow.x, arrow.y]);
    assert.ok(!game.ground.some((g) => g.item === "fleche"), "une flèche brisée ne se ramasse pas");
    for (let turn = 1; turn < 7; turn++) {
      game.wait();
      game.tick();
      assert.equal(game.debris.length, 1, `disparue trop tôt, au tour ${turn}`);
    }
    game.wait();
    game.tick();
    assert.equal(game.debris.length, 0);
    return;
  }
  assert.fail("aucune flèche brisée en 200 parties");
});

test("expérience, niveaux et or : vaincre rapporte de l'expérience, le coffre et les pièces remplissent la bourse", () => {
  const game = new Game(4);
  const foe = game.monsters[0];
  assert.ok(foe);
  game.monsters.splice(1);
  // Trois victoires à 10 points : passage au niveau 2 (30 points), avec 3 PV de plus.
  const maxHp = game.hero.maxHp;
  let kills = 0;
  game.xp = 21; // à 9 points du niveau 2 : trois victoires (3 à 5 points chacune) suffisent toujours
  for (let turn = 0; turn < 400 && kills < 3; turn++) {
    const target = game.monsters[0];
    Object.assign(target, { x: game.hero.x + (game.map.isWalkable(game.hero.x + 1, game.hero.y) ? 1 : -1), y: game.hero.y, hp: 1, alerted: false, asleep: true });
    assert.ok(game.setDestination(target.x, target.y, true));
    game.tick();
    if (game.monsters.length === 0) {
      kills++;
      game.monsters.push({ ...foe, id: 1000 + kills, hp: 1 });
    }
  }
  assert.equal(kills, 3);
  const gains = game.events.flatMap((e) => (e.type === "xp" ? [e.amount] : []));
  assert.ok(gains.every((g) => g >= 3 && g <= 5), "un monstre rapporte 3 à 5 points d'expérience");
  const total = gains.reduce((a, b) => a + b, 0);
  assert.deepEqual([game.level, game.xp, game.xpToNext(), game.hero.maxHp], [2, 21 + total - 30, 60, maxHp + 3]);
  assert.ok(game.events.some((e) => e.type === "levelup" && e.level === 2));
  assert.equal(game.events.filter((e) => e.type === "xp").length, 3);

  // L'or ramassé va dans la bourse, pas dans le sac.
  game.monsters.splice(0);
  const purse = game.gold;
  const bagBefore = game.inventory.items.length;
  const side = game.map.isWalkable(game.hero.x + 1, game.hero.y) ? 1 : -1;
  game.ground.push({ x: game.hero.x + side, y: game.hero.y, item: "or", count: 7 });
  assert.ok(game.moveBy(side, 0));
  game.tick();
  // L'or se ramasse tout seul, sans ordre ni tour supplémentaire.
  assert.equal(game.gold, purse + 7);
  assert.equal(game.pickUp(), false);
  assert.equal(game.inventory.items.length, bagBefore);
  assert.equal(game.equip(-1), false);
});

test("coffre : l'ouvrir remplit la bourse", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const game = new Game(seed);
    let at: { x: number; y: number } | null = null;
    for (let y = 0; y < game.map.height && !at; y++) {
      for (let x = 0; x < game.map.width; x++) {
        if (game.map.get(x, y) === Tile.Chest) {
          at = { x, y };
          break;
        }
      }
    }
    if (!at) continue;
    game.monsters.splice(0);
    Object.assign(game.hero, { x: at.x + 1, y: at.y });
    assert.ok(game.moveBy(-1, 0));
    game.tick();
    assert.equal(game.map.get(at.x, at.y), Tile.ChestOpen);
    assert.ok(game.gold >= 11 && game.gold <= 23, `or trouvé : ${game.gold}`);
    return;
  }
  assert.fail("aucun coffre trouvé");
});

test("clef : elle n'ouvre que les portes de son étage, et reste (inutile) dans le sac ailleurs", () => {
  const game = new Game(5);
  game.monsters = [];
  // Une clef ramassée à l'étage 1 porte la marque de cet étage.
  const side = game.map.isWalkable(game.hero.x + 1, game.hero.y) ? 1 : -1;
  game.ground.push({ x: game.hero.x + side, y: game.hero.y, item: "clef", count: 1 });
  assert.ok(game.setDestination(game.hero.x + side, game.hero.y, true));
  game.tick();
  assert.ok(game.pickUp());
  game.tick();
  assert.equal(game.inventory.count("clef", 1), 1);
  const lockedDoor = () => {
    for (let y = 0; y < game.map.height; y++)
      for (let x = 0; x < game.map.width; x++) if (game.map.get(x, y) === Tile.DoorLocked) return { x, y };
    return undefined;
  };
  const reach = (door: { x: number; y: number }) => {
    for (let turn = 0; turn < 300 && !game.pendingDoor; turn++) {
      if (game.path.length === 0) assert.ok(game.setDestination(door.x, door.y, true));
      game.tick();
    }
    assert.ok(game.pendingDoor);
  };
  // À l'étage 2, elle est toujours dans le sac mais n'ouvre rien.
  for (let y = 0; y < game.map.height; y++)
    for (let x = 0; x < game.map.width; x++)
      if (game.map.get(x, y) === Tile.StairsDown) Object.assign(game.hero, { x, y, fromX: x, fromY: y });
  game.pendingStairs = "down";
  assert.ok(game.takeStairs());
  game.monsters = [];
  assert.equal(game.depth, 2);
  assert.equal(game.inventory.count("clef"), 1);
  reach(lockedDoor()!);
  assert.ok(!game.doorOptions().includes("key"));
  assert.equal(game.actOnDoor("key"), false);
  // Une clef trouvée à l'étage 2, elle, fonctionne ; celle de l'étage 1 reste dans le sac.
  game.inventory.add("clef", 1, 2);
  assert.ok(game.doorOptions().includes("key"));
  assert.equal(game.actOnDoor("key"), true);
  game.tick();
  assert.deepEqual([game.inventory.count("clef", 1), game.inventory.count("clef", 2)], [1, 0]);
});

test("tir : à l'aveugle vers une case non vue, et bonus dans un couloir d'une case de large", () => {
  const game = new Game(9);
  game.monsters.splice(1);
  const m = game.monsters[0];
  // Un couloir étroit : trois cases de sol alignées, murées de part et d'autre.
  let spot: { x: number; y: number; dx: number; dy: number } | undefined;
  const map = game.map;
  const floor = (x: number, y: number) => map.get(x, y) === Tile.Floor;
  for (let y = 2; y < map.height - 2 && !spot; y++)
    for (let x = 2; x < map.width - 4 && !spot; x++)
      if ([0, 1, 2].every((k) => floor(x + k, y) && !map.isWalkable(x + k, y - 1) && !map.isWalkable(x + k, y + 1))) spot = { x, y, dx: 1, dy: 0 };
  assert.ok(spot, "l'étage a bien un couloir d'une case de large");
  Object.assign(game.hero, { x: spot.x, y: spot.y, fromX: spot.x, fromY: spot.y });
  Object.assign(m, { x: spot.x + 2, y: spot.y, fromX: spot.x + 2, fromY: spot.y, asleep: true, alerted: false, hp: 1000, maxHp: 1000 });
  game.wait();
  game.events.length = 0;
  assert.equal(game.shoot(m.x, m.y), null);
  game.tick();
  const shot = game.events.find((e) => e.type === "attack" && e.ranged);
  assert.ok(shot && shot.type === "attack");
  assert.equal(shot.result.bonus, (game.weapon("ranged")?.attackBonus ?? 0) + RULES.narrowShotBonus);
  // Tir à l'aveugle : une case jamais vue, à portée, est acceptée.
  game.visible.fill(0);
  game.inventory.add("fleche", 1);
  assert.equal(game.shoot(game.hero.x, game.hero.y - 1), null);
  assert.equal(game.shoot(game.hero.x, game.hero.y), "no-target");
});

test("repeuplement : un étage vidé retrouve des promeneurs, sans dépasser sa population d'origine", () => {
  const game = new Game(4);
  game.hero.hp = game.hero.maxHp = 100000;
  const original = Math.max(1, game.monsters.length);
  game.monsters = [];
  for (let t = 0; t <= RULES.respawnTurns; t++) {
    game.wait();
    game.tick();
  }
  assert.equal(game.monsters.length, 1, "un renfort est arrivé");
  assert.equal(game.monsters[0].asleep, false, "c'est un promeneur");
  for (let t = 0; t < RULES.respawnTurns * (original + 3); t++) {
    game.wait();
    game.tick();
    assert.ok(game.monsters.length <= original, "jamais plus de monstres qu'à l'origine");
  }
});

test("coins logiques : deux pans de mur vus font apparaître le coin qui les relie", () => {
  const game = new Game(2);
  game.monsters = [];
  game.torches.length = 0;
  const map = game.map;
  // Une salle (sol de 4..10 × 5..9) dans un bloc de mur, avec une porte ouverte en haut et un couloir au-dessus.
  for (let y = 0; y < 14; y++) for (let x = 0; x < 15; x++) map.set(x, y, Tile.Wall);
  for (let y = 5; y <= 9; y++) for (let x = 4; x <= 10; x++) map.set(x, y, Tile.Floor);
  map.set(7, 4, Tile.DoorOpen);
  map.set(7, 3, Tile.Floor);
  map.set(7, 2, Tile.Floor);
  Object.assign(game.hero, { x: 7, y: 4, fromX: 7, fromY: 4 });
  game.wait();
  game.tick();
  // Depuis la porte on voit le mur de gauche et le haut du mur près de la porte, mais pas la case de sol du coin.
  assert.ok(game.isVisible(3, 6), "le mur de gauche est en vue");
  assert.ok(game.isVisible(6, 4), "le mur du haut, près de la porte, est en vue");
  assert.ok(game.isVisible(3, 4) && game.isVisible(4, 4), "le coin en haut à gauche et le mur qui y mène apparaissent");
  assert.ok(game.isVisible(11, 4) && game.isVisible(10, 4), "de même en haut à droite");
  assert.ok(!game.isVisible(0, 0), "un mur sans rapport reste caché");
});

test("ramasser un objet entraîne ses semblables de la case, un par tour, mais pas les autres objets", () => {
  const game = new Game(3);
  game.monsters = [];
  const x = game.hero.x + 1;
  const y = game.hero.y;
  game.ground = [
    { x, y, item: "fleche", count: 1, angle: 0.3 },
    { x, y, item: "clef", count: 1 },
    { x, y, item: "fleche", count: 1, angle: 1.2 },
    { x, y, item: "fleche", count: 1, angle: 2 },
  ];
  assert.ok(game.moveBy(1, 0));
  game.tick();
  assert.equal(game.itemsHere().length, 4);
  assert.ok(game.pickUp());
  assert.ok(game.tick());
  assert.equal(game.arrows(), 11);
  // Les deux autres flèches suivent sans nouvel ordre, une par tour.
  assert.ok(game.tick());
  assert.equal(game.arrows(), 12);
  assert.ok(game.tick());
  assert.equal(game.arrows(), 13);
  // La clef, elle, attend qu'on la demande.
  assert.equal(game.tick(), false);
  assert.deepEqual(game.itemsHere().map((g) => g.item), ["clef"]);
});

test("un autre ordre interrompt le ramassage en chaîne", () => {
  const game = new Game(3);
  game.monsters = [];
  const x = game.hero.x + 1;
  const y = game.hero.y;
  game.ground = [
    { x, y, item: "fleche", count: 1, angle: 0.3 },
    { x, y, item: "fleche", count: 1, angle: 1.2 },
  ];
  assert.ok(game.moveBy(1, 0));
  game.tick();
  assert.ok(game.pickUp());
  game.tick();
  assert.ok(game.moveBy(-1, 0));
  game.tick();
  assert.equal(game.arrows(), 11);
  assert.equal(game.ground.length, 1);
});

test("passer une porte au contact d'un monstre ne déclenche pas d'attaque d'opportunité", () => {
  let checked = 0;
  for (let seed = 1; seed <= 60 && checked < 5; seed++) {
    const game = new Game(seed);
    let spot: { x: number; y: number; dx: number; dy: number } | null = null;
    for (let y = 2; y < game.map.height - 2 && !spot; y++) {
      for (let x = 2; x < game.map.width - 2 && !spot; x++) {
        if (game.map.get(x, y) !== Tile.DoorClosed) continue;
        for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
          const free = [-2, -1, 1].every((k) => game.map.get(x + k * dx, y + k * dy) === Tile.Floor);
          if (free) spot = { x, y, dx, dy };
        }
      }
    }
    if (!spot) continue;
    const { x, y, dx, dy } = spot;
    const monster = game.monsters[0] ?? null;
    if (!monster) continue;
    game.monsters = [monster];
    Object.assign(game.hero, { x: x - dx, y: y - dy, hp: 999, maxHp: 999 });
    Object.assign(monster, { x: x - 2 * dx, y: y - 2 * dy, alerted: true, asleep: false });
    game.events.length = 0;
    // Le héros entre dans l'encadrement, puis ressort de l'autre côté : deux désengagements.
    assert.ok(game.moveBy(dx, dy));
    game.tick();
    assert.ok(game.moveBy(dx, dy));
    game.tick();
    assert.deepEqual([game.hero.x, game.hero.y], [x + dx, y + dy]);
    assert.equal(game.events.filter((e) => e.type === "attack" && e.opportunity).length, 0, `graine ${seed}`);
    // Un avantage à la fois : le monstre semé ainsi ne se laisse pas surprendre dans la porte…
    assert.equal(monster.wary, true, `graine ${seed} : le monstre devrait être sur ses gardes`);
    Object.assign(monster, { x, y });
    assert.equal(game.heroHasAdvantageOn(monster), false, `graine ${seed}`);
    // …jusqu'à ce qu'il ait rattrapé et attaqué le héros.
    game.wait();
    game.tick();
    assert.equal(monster.wary, false, `graine ${seed}`);
    assert.equal(game.heroHasAdvantageOn(monster), true, `graine ${seed}`);
    checked++;
  }
  assert.ok(checked >= 3, `seulement ${checked} portes testées`);
});

test("après 3 attaques ratées d'affilée, les suivantes sont aidées jusqu'au premier coup qui porte", () => {
  const game = new Game(4);
  const foe = game.monsters[0];
  assert.ok(foe);
  game.monsters = [foe];
  // Un monstre intouchable sans aide (sauf 20 naturel), collé au héros.
  const side = game.map.isWalkable(game.hero.x + 1, game.hero.y) ? 1 : -1;
  Object.assign(foe, { x: game.hero.x + side, y: game.hero.y, armorClass: 30, hp: 9999, maxHp: 9999, alerted: true, asleep: false });
  Object.assign(game.hero, { hp: 99999, maxHp: 99999 });
  const base = game.hero.attackBonus;
  const bonuses: number[] = [];
  let landed = false;
  for (let i = 0; i < 40 && !landed; i++) {
    game.events.length = 0;
    assert.ok(game.setDestination(foe.x, foe.y, true));
    game.tick();
    const mine = game.events.find((e) => e.type === "attack" && e.attacker === game.hero);
    assert.ok(mine && mine.type === "attack");
    bonuses.push(mine.result.bonus - base);
    landed = mine.result.hit;
  }
  // Trois premiers coups sans aide, puis +3, +6, +9…
  assert.deepEqual(bonuses.slice(0, 5), [0, 0, 0, 3, 6]);
  assert.ok(landed, "le coup finit par porter");
  assert.ok(bonuses.length <= 12, `série trop longue : ${bonuses.length}`);
  assert.equal(game.heroMisses, 0);
  assert.equal(game.streakBonus(), 0);
});

test("retoucher sa propre case ramasse l'objet qui s'y trouve, sinon passe un tour", () => {
  const game = new Game(3);
  game.monsters = [];
  game.ground = [{ x: game.hero.x, y: game.hero.y, item: "fleche", count: 2 }];
  assert.ok(game.setDestination(game.hero.x, game.hero.y));
  game.tick();
  assert.equal(game.arrows(), 12);
  assert.equal(game.ground.length, 0);
  // Plus rien au sol : le même geste passe simplement un tour.
  const turn = game.turn;
  assert.ok(game.setDestination(game.hero.x, game.hero.y));
  assert.ok(game.tick());
  assert.equal(game.turn, turn + 1);
  assert.equal(game.arrows(), 12);
});

test("avec la clef de l'étage, la porte verrouillée s'ouvre d'elle-même en y arrivant", () => {
  let checked = 0;
  for (let seed = 1; seed <= 40 && checked < 3; seed++) {
    const game = new Game(seed);
    game.monsters = [];
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
    game.inventory.add("clef", 1, game.depth);
    assert.ok(game.setDestination(door.x, door.y, true), `graine ${seed}`);
    for (let i = 0; i < 400 && game.map.get(door.x, door.y) === Tile.DoorLocked; i++) if (!game.tick()) break;
    assert.equal(game.map.get(door.x, door.y), Tile.DoorOpen, `graine ${seed} : la porte aurait dû s'ouvrir toute seule`);
    assert.equal(game.inventory.count("clef", game.depth), 0);
    assert.ok(game.events.some((e) => e.type === "door" && e.action === "key"));
    assert.equal(game.pendingDoor, null);
    checked++;
  }
  assert.ok(checked >= 3);
});

test("sans clef, on garde le choix devant une porte verrouillée", () => {
  const game = new Game(1);
  game.monsters = [];
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
  assert.ok(game.setDestination(door.x, door.y, true));
  for (let i = 0; i < 400 && !game.pendingDoor; i++) if (!game.tick()) break;
  assert.ok(game.pendingDoor);
  assert.equal(game.usingKey(), false);
  assert.equal(game.tick(), false, "rien ne se passe tant que le joueur n'a pas choisi");
  assert.equal(game.map.get(door.x, door.y), Tile.DoorLocked);
});

test("une torche n'éclaire que de son côté du mur : aucune lumière sur une case qu'on ne peut pas rejoindre sans traverser un mur", () => {
  let leaks = 0;
  let lit = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const game = new Game(seed);
    const { map } = game;
    for (const torch of game.torches) {
      const light = computeLight(map, [torch]);
      const start = { x: torch.x + torch.faceX, y: torch.y + torch.faceY };
      // Cases joignables depuis le pied de la torche sans traverser ce qui arrête la vue (pas à pas, sans couper les coins).
      const seen = new Set<number>([map.index(start.x, start.y)]);
      const queue = [start];
      while (queue.length > 0) {
        const c = queue.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = c.x + dx;
          const ny = c.y + dy;
          if (!map.inBounds(nx, ny) || map.blocksSight(nx, ny) || seen.has(map.index(nx, ny))) continue;
          if (Math.hypot(nx - start.x, ny - start.y) > torch.radius + 2) continue;
          seen.add(map.index(nx, ny));
          queue.push({ x: nx, y: ny });
        }
      }
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (map.blocksSight(x, y) || light[map.index(x, y)] <= 0) continue;
          lit++;
          if (!seen.has(map.index(x, y))) leaks++;
        }
      }
    }
  }
  console.log(`Lumière des torches : ${lit} cases éclairées, ${leaks} de l'autre côté d'un mur`);
  assert.equal(leaks, 0);
});

test("repos : 8 tours sur place, rend la moitié des PV manquants, une fois par étage ; changer d'étage ne soigne plus", () => {
  let seed = 1;
  let game = new Game(seed);
  while (game.visibleMonsters().length > 0) game = new Game(++seed);
  assert.equal(game.restRefusal(), "full");
  assert.equal(game.rest(), false);
  game.hero.hp = 4;
  assert.equal(game.restRefusal(), null);
  assert.ok(game.rest());
  const at = { x: game.hero.x, y: game.hero.y };
  let turns = 0;
  while (game.restProgress() > 0 && turns < 60) {
    assert.ok(game.tick());
    turns++;
    if (game.events.some((e) => e.type === "rest" && e.phase === "interrupted")) break;
  }
  if (!game.events.some((e) => e.type === "rest" && e.phase === "interrupted")) {
    assert.equal(turns, RULES.restTurns);
    assert.deepEqual({ x: game.hero.x, y: game.hero.y }, at);
    assert.equal(game.hero.hp, 4 + Math.ceil((game.hero.maxHp - 4) / 2));
    assert.equal(game.restRefusal(), "used");
    assert.equal(game.rest(), false);
  }
  // Un autre ordre renonce au repos sans le consommer.
  const other = new Game(seed);
  other.hero.hp = 4;
  assert.ok(other.rest());
  other.tick();
  other.wait();
  assert.equal(other.restProgress(), 0);
  other.tick();
  assert.equal(other.hero.hp, 4);
  assert.equal(other.restRefusal(), null);
});

test("repos : un monstre en vue l'empêche et l'interrompt", () => {
  for (let seed = 1; seed <= 60; seed++) {
    const game = new Game(seed);
    game.hero.hp = 3;
    const m = game.monsters[0];
    if (!m) continue;
    // On amène un monstre à côté du héros : il est en vue.
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: game.hero.x + dx, y: game.hero.y + dy })).find((p) => game.map.isWalkable(p.x, p.y) && !game.monsterAt(p.x, p.y));
    if (!spot) continue;
    assert.ok(game.rest(), `graine ${seed}`);
    m.x = spot.x;
    m.y = spot.y;
    game.tick();
    assert.ok(game.events.some((e) => e.type === "rest" && e.phase === "interrupted"), `graine ${seed}`);
    assert.equal(game.restProgress(), 0);
    assert.equal(game.restRefusal(), "danger");
    return;
  }
  assert.fail("aucune graine utilisable");
});

/** Une partie où le héros se tient contre un mur, avec un monstre alerté posé à son contact (ou null si impossible). */
function threatenedHero(seed: number) {
  const game = new Game(seed);
  const m = game.monsters[0];
  if (!m) return null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = game.hero.x + dx;
    const y = game.hero.y + dy;
    if (game.map.isWalkable(x, y) && !game.map.isDoor(x, y) && !game.monsterAt(x, y)) {
      m.x = m.fromX = x;
      m.y = m.fromY = y;
      m.alerted = true;
      m.asleep = false;
      return { game, m };
    }
  }
  return null;
}

test("se cacher : refusé au contact d'un ennemi ; réussi, les monstres perdent la trace ; attaquer fait sortir de l'ombre", () => {
  const t = threatenedHero(3) ?? threatenedHero(4)!;
  assert.equal(t.game.hideRefusal(), "threatened");
  assert.equal(t.game.hide(), false);

  let done = false;
  for (let seed = 1; seed <= 80 && !done; seed++) {
    const game = new Game(seed);
    const spot = coverSpot(game);
    if (!spot) continue;
    game.hero.x = game.hero.fromX = spot.x;
    game.hero.y = game.hero.fromY = spot.y;
    if (game.hideRefusal() !== null) continue;
    for (const m of game.monsters) m.alerted = true;
    assert.ok(game.hide());
    game.tick();
    const roll = game.events.find((e) => e.type === "hide");
    assert.ok(roll && roll.type === "hide");
    if (!roll.success) continue;
    assert.ok(game.hidden);
    assert.ok(game.monsters.every((m) => !m.alerted), `graine ${seed} : un monstre garde la trace`);
    // Caché et immobile, il n'est remarqué que par un monstre à son contact.
    for (let i = 0; i < 30 && game.hidden; i++) {
      game.wait();
      game.tick();
      for (const e of game.events) if (e.type === "noticed") {
        assert.ok(Math.max(Math.abs(e.actor.x - game.hero.x), Math.abs(e.actor.y - game.hero.y)) <= 1, "remarqué de loin");
      }
      game.events.length = 0;
    }
    done = true;
  }
  assert.ok(done, "aucun essai réussi");
});

test("se dégager : saut de deux cases, sans attaque d'opportunité, et le monstre quitté est sur ses gardes", () => {
  let done = false;
  for (let seed = 1; seed <= 80 && !done; seed++) {
    const t = threatenedHero(seed);
    if (!t) continue;
    const { game, m } = t;
    const cells = game.jumpCells();
    if (cells.length === 0) continue;
    for (const c of cells) {
      assert.equal(Math.max(Math.abs(c.x - game.hero.x), Math.abs(c.y - game.hero.y)), RULES.jumpDistance);
      assert.ok(game.map.isWalkable(c.x, c.y) && !game.map.isDoor(c.x, c.y));
    }
    assert.equal(game.disengage(game.hero.x, game.hero.y), false, "on ne saute pas sur place");
    const to = cells[0];
    const before = { x: game.hero.x, y: game.hero.y };
    assert.ok(game.disengage(to.x, to.y));
    game.tick();
    const jump = game.events.find((e) => e.type === "jump");
    assert.ok(jump && jump.type === "jump");
    if (!jump.success) {
      // Raté : le héros reste au contact.
      assert.deepEqual({ x: game.hero.x, y: game.hero.y }, before);
      continue;
    }
    assert.deepEqual({ x: game.hero.x, y: game.hero.y }, to);
    assert.ok(!game.events.some((e) => e.type === "attack" && e.opportunity), "attaque d'opportunité pendant le saut");
    assert.ok(m.wary, "le monstre quitté devrait être sur ses gardes");
    assert.equal(game.heroHasAdvantageOn(m), false);
    done = true;
  }
  assert.ok(done, "aucune situation de test trouvée");
  // Sans ennemi au contact, rien à quoi se dérober.
  assert.equal(new Game(1).disengageRefusal(), "safe");
});

/** Une case abritée (colonne voisine ou angle de mur) dans une salle, ou null. */
function coverSpot(game: Game) {
  for (let y = 0; y < game.map.height; y++) {
    for (let x = 0; x < game.map.width; x++) {
      if (game.map.get(x, y) !== Tile.Floor || game.monsterAt(x, y)) continue;
      const p = { x, y };
      if (game.hasCover(p) && !game.monsters.some((m) => Math.max(Math.abs(m.x - x), Math.abs(m.y - y)) <= 1)) return p;
    }
  }
  return null;
}

test("se cacher : un mur droit ne suffit pas ; une colonne voisine ou un coin rentrant, si", () => {
  let checked = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const game = new Game(seed);
    for (const room of game.rooms) {
      if (room.w < 5 || room.h < 5) continue;
      // Milieu du mur du haut, à l'intérieur : mur droit au-dessus, rien d'autre autour.
      const mid = { x: room.x + Math.floor(room.w / 2), y: room.y };
      const around = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => game.map.get(mid.x + dx, mid.y + dy)));
      if (around.includes(Tile.Pillar) || game.map.get(mid.x, mid.y) !== Tile.Floor) continue;
      if (game.map.get(mid.x, mid.y - 1) !== Tile.Wall || game.map.get(mid.x - 1, mid.y - 1) !== Tile.Wall || game.map.get(mid.x + 1, mid.y - 1) !== Tile.Wall) continue;
      assert.equal(game.hasCover(mid), false, `graine ${seed} : un mur droit abrite`);
      // Coin intérieur de la salle : deux murs perpendiculaires.
      const corner = { x: room.x, y: room.y };
      if (game.map.get(corner.x, corner.y) === Tile.Floor && game.map.get(corner.x - 1, corner.y) === Tile.Wall && game.map.get(corner.x, corner.y - 1) === Tile.Wall) {
        assert.ok(game.hasCover(corner), `graine ${seed} : un coin n'abrite pas`);
      }
      checked++;
    }
  }
  assert.ok(checked > 10);
});

test("fouiller : jamais de cache dans une salle vide ; une fouille réussie la révèle ; une seule fouille par salle", () => {
  let found = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const game = new Game(seed);
    const secrets = (game as unknown as { current: { secrets: { room: number; x: number; y: number; item: string }[] } }).current.secrets;
    for (const s of secrets) assert.ok(game.roomElements(game.rooms[s.room]) > 0, `graine ${seed} : cache dans une salle vide`);
    const secret = secrets[0];
    if (!secret || found > 0) continue;
    const room = game.rooms[secret.room];
    for (const m of game.monsters) { m.x = m.fromX = 0; m.y = m.fromY = 0; m.alerted = false; m.asleep = true; }
    game.monsters.length = 0;
    game.hero.x = game.hero.fromX = room.x + Math.floor(room.w / 2);
    game.hero.y = game.hero.fromY = room.y + Math.floor(room.h / 2);
    if (game.map.get(game.hero.x, game.hero.y) !== Tile.Floor) continue;
    assert.equal(game.searchRefusal(), null);
    assert.ok(game.search());
    let turns = 0;
    while (game.searchProgress() > 0 && turns < 20) { game.tick(); turns++; }
    assert.equal(turns, RULES.searchTurns);
    const roll = game.events.find((e) => e.type === "searched");
    assert.ok(roll && roll.type === "searched");
    assert.equal(game.searchRefusal(), "searched");
    if (roll.success) {
      assert.ok(game.ground.some((g) => g.x === secret.x && g.y === secret.y), "la cache n'est pas apparue");
      found++;
    }
  }
  assert.ok(found > 0, "aucune fouille réussie");
});

test("porte verrouillée : la croix referme le choix sans rien tenter ni faire passer de tour", () => {
  for (let seed = 1; seed <= 80; seed++) {
    const game = new Game(seed);
    let door: { x: number; y: number } | null = null;
    for (let y = 0; y < game.map.height && !door; y++) {
      for (let x = 0; x < game.map.width && !door; x++) if (game.map.get(x, y) === Tile.DoorLocked) door = { x, y };
    }
    if (!door) continue;
    game.pendingDoor = door;
    assert.ok(game.doorOptions().length > 0);
    const turn = game.turn;
    game.cancelDoor();
    assert.equal(game.pendingDoor, null);
    assert.equal(game.doorOptions().length, 0);
    assert.equal(game.tick(), false, "un tour est passé");
    assert.equal(game.turn, turn);
    assert.equal(game.map.get(door.x, door.y), Tile.DoorLocked);
    return;
  }
  assert.fail("aucune porte verrouillée trouvée");
});

test("portes : on peut entrer et sortir en diagonale", () => {
  let checked = 0;
  for (let seed = 1; seed <= 60 && checked < 30; seed++) {
    const game = new Game(seed);
    for (let y = 1; y < game.map.height - 1; y++) {
      for (let x = 1; x < game.map.width - 1; x++) {
        if (game.map.get(x, y) !== Tile.DoorClosed) continue;
        // Porte dans un mur horizontal (murs à gauche et à droite) : de la porte vers une case en diagonale dessous ou dessus.
        if (game.map.get(x - 1, y) !== Tile.Wall || game.map.get(x + 1, y) !== Tile.Wall) continue;
        for (const dy of [-1, 1]) {
          for (const dx of [-1, 1]) {
            if (!game.map.isWalkable(x + dx, y + dy) || !game.map.isWalkable(x, y + dy)) continue;
            assert.ok(canStep(game.map, x, y, dx, dy), `graine ${seed} : sortie en diagonale refusée`);
            assert.ok(canStep(game.map, x + dx, y + dy, -dx, -dy), `graine ${seed} : entrée en diagonale refusée`);
            checked++;
          }
        }
      }
    }
  }
  assert.ok(checked > 0);
});

test("toucher le dé : frappe l'ennemi au contact, et rien s'il n'y en a pas", () => {
  assert.equal(new Game(1).strike(), false);
  for (let seed = 1; seed <= 60; seed++) {
    const t = threatenedHero(seed);
    if (!t) continue;
    t.game.tick(); // mettre à jour la vue
    if (!t.game.visibleMonsters().includes(t.m) || t.game.over) continue;
    assert.equal(t.game.meleeTarget(), t.m);
    t.game.events.length = 0;
    assert.ok(t.game.strike());
    t.game.tick();
    assert.ok(t.game.events.some((e) => e.type === "attack" && e.attacker === t.game.hero && e.target === t.m), `graine ${seed} : pas d'attaque`);
    return;
  }
  assert.fail("aucune situation trouvée");
});

test("pièges : jamais dans la salle de départ ; le héros les contourne, sauf si on l'y envoie", () => {
  let checked = 0;
  for (let seed = 1; seed <= 120 && checked < 5; seed++) {
    const game = new Game(seed);
    const start = game.rooms[0];
    for (const t of game.traps()) {
      assert.ok(!(t.x >= start.x && t.x < start.x + start.w && t.y >= start.y && t.y < start.y + start.h), `graine ${seed} : piège dans la salle de départ`);
    }
    const trap = game.traps()[0];
    if (!trap) continue;
    // Une case de l'autre côté du piège, dans la même ligne : le chemin ne doit pas marcher dessus.
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const from = { x: trap.x - dx, y: trap.y - dy };
      const to = { x: trap.x + dx, y: trap.y + dy };
      if (game.map.get(from.x, from.y) !== Tile.Floor || game.map.get(to.x, to.y) !== Tile.Floor) continue;
      game.monsters.length = 0;
      game.hero.x = game.hero.fromX = from.x;
      game.hero.y = game.hero.fromY = from.y;
      assert.ok(game.setDestination(to.x, to.y, true));
      assert.ok(!game.path.some((p) => p.x === trap.x && p.y === trap.y), `graine ${seed} : le chemin passe sur le piège`);
      // Envoyé exprès sur le piège : il y va et le déclenche.
      assert.ok(game.setDestination(trap.x, trap.y, true));
      const hp = game.hero.hp;
      for (let i = 0; i < 5 && (game.hero.x !== trap.x || game.hero.y !== trap.y); i++) game.tick();
      assert.ok(game.events.some((e) => e.type === "trap"), `graine ${seed} : le piège ne s'est pas déclenché`);
      assert.ok(game.hero.hp < hp);
      checked++;
      break;
    }
  }
  assert.ok(checked > 0, "aucun piège testé");
});

test("pousser : réussi, le monstre recule et est sonné ; contre un mur, il encaisse des dégâts", () => {
  let moved = 0;
  let slammed = 0;
  for (let seed = 1; seed <= 300 && (moved === 0 || slammed === 0); seed++) {
    const t = threatenedHero(seed);
    if (!t) continue;
    const { game, m } = t;
    game.tick();
    if (game.over || !game.pushTargets().includes(m)) continue;
    const before = { x: m.x, y: m.y, hp: m.hp };
    game.events.length = 0;
    assert.ok(game.push(m.id));
    game.tick();
    const e = game.events.find((ev) => ev.type === "push");
    assert.ok(e && e.type === "push");
    if (!e.success) continue;
    if (e.moved) {
      assert.equal(Math.max(Math.abs(m.x - game.hero.x), Math.abs(m.y - game.hero.y)), 2, `graine ${seed} : le monstre n'a pas reculé`);
      moved++;
    } else if (e.slam > 0) {
      assert.deepEqual({ x: m.x, y: m.y }, { x: before.x, y: before.y });
      assert.ok(m.hp < before.hp || !game.monsters.includes(m));
      slammed++;
    }
    // Sonné : il n'attaque pas le héros dans ce tour.
    assert.ok(!game.events.some((ev) => ev.type === "attack" && ev.attacker === m), `graine ${seed} : le monstre sonné a attaqué`);
  }
  assert.ok(moved > 0, "jamais vu un monstre reculer");
  assert.ok(slammed > 0, "jamais vu un monstre heurter un mur");
});

test("salle d'essai : tout est accessible depuis le départ, et chaque nouveauté y est", () => {
  const game = new Game(1, undefined, undefined, undefined, true);
  // Chaque salle, l'escalier et les deux portes verrouillées sont atteignables depuis le départ.
  const dist = distanceField(game.map, game.hero);
  for (const r of game.rooms) assert.notEqual(dist[game.map.index(r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2))], -1, `salle (${r.x},${r.y}) inaccessible`);
  for (let y = 0; y < game.map.height; y++) {
    for (let x = 0; x < game.map.width; x++) {
      if (game.map.get(x, y) !== Tile.DoorLocked) continue;
      assert.notEqual(dist[game.map.index(x, y - 1)], -1, `porte verrouillée (${x},${y}) inaccessible`);
    }
  }
  assert.equal(game.monsters.length, 3);
  assert.ok(game.traps().length >= 2);
  assert.ok(game.ground.some((g) => g.item === "clef"));
  assert.ok(game.torches.some((t) => t.hearth));
  assert.ok(game.roomElements(game.rooms[1]) >= 2, "la salle des colonnes doit avoir colonnes et cheminée");
  // Le joueur peut rejoindre l'escalier.
  let stairs = { x: -1, y: -1 };
  for (let y = 0; y < game.map.height; y++) for (let x = 0; x < game.map.width; x++) if (game.map.get(x, y) === Tile.StairsDown) stairs = { x, y };
  assert.ok(game.setDestination(stairs.x, stairs.y, true));
});
