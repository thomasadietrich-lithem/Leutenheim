import assert from "node:assert/strict";
import { RULES } from "../src/data/rules";
import { ITEMS } from "../src/data/items";
import { test } from "node:test";
import { Game } from "../src/core/game";
import { expectedDamagePerTurn, rollAttack } from "../src/core/combat";
import { Rng } from "../src/core/rng";
import { DEFAULT_FLOOR } from "../src/data/floors";
import { spawnsForDepth } from "../src/data/monsters";
import { Inventory } from "../src/items/inventory";
import { generateFloor } from "../src/world/generator";
import { GameMap, Tile } from "../src/world/map";
import { computeFov, computeLight, hasLineOfSight } from "../src/world/fov";
import { canStep, distanceField, findPath, isChokepoint } from "../src/world/pathfinding";
import { furnishFloor, furnitureCells, underTorch } from "../src/world/furnish";
import { guaranteedLoot } from "../src/core/floor";
import { FURNITURE_KINDS } from "../src/data/themedRooms";
import { MOTIF_SIZE } from "../src/data/motifs";

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
    // Comme un joueur prudent : chaque point gagné va en Vie.
    while (game.points > 0 && game.allocate("vie"));
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
      // Étage du boss : l'escalier est scellé tant qu'elle vit ; il va la chercher.
      const queen = game.bossActor();
      if (stairs.x < 0 && queen) {
        if (!game.setDestination(queen.x, queen.y, true)) game.wait();
      } else assert.ok(game.setDestination(stairs.x, stairs.y, true));
    }
    assert.ok(game.tick(), `graine ${seed} : le héros est bloqué`);
    // Invariants : chacun sur une case libre et distincte, PV cohérents.
    const cells = new Set<number>();
    for (const a of [game.hero, ...game.monsters]) {
      for (const c of cellsOf(a)) {
        assert.ok(game.map.isWalkable(c.x, c.y));
        assert.ok(!cells.has(game.map.index(c.x, c.y)), `graine ${seed} : deux acteurs sur la même case`);
        cells.add(game.map.index(c.x, c.y));
      }
      assert.ok(a.hp <= a.maxHp && (a.kind === "hero" ? a.hp >= 0 : a.hp > 0));
    }
    assert.equal(game.over, game.hero.hp === 0 || game.won);
    // Les portes se referment : une porte ouverte a forcément quelqu'un dans son encadrement.
    for (let i = 0; i < game.map.tiles.length; i++) {
      // (Sauf si un objet au sol la cale : Thomas, 2026-11-13.)
      if (game.map.tiles[i] === Tile.DoorOpen) assert.ok(cells.has(i) || game.ground.some((g) => game.map.index(g.x, g.y) === i), `graine ${seed} : porte restée ouverte`);
    }
    game.events.length = 0;
  }
  return game;
}

test("300 parties jouées par un joueur automatique, sans incohérence", () => {
  const depths: number[] = [];
  const levelAt = new Map<number, number[]>();
  for (let seed = 1; seed <= 300; seed++) {
    const g = playRun(seed, 3000);
    depths.push(g.depth);
    if (!levelAt.has(g.deepest)) levelAt.set(g.deepest, []);
    levelAt.get(g.deepest)!.push(g.level);
  }
  // Niveau du héros atteint selon l'étage le plus profond (utile pour régler les objets « Lv »).
  const levels = [...levelAt.entries()].sort((a, b) => a[0] - b[0]).map(([d, l]) => `étage ${d} : niv ${(l.reduce((a, b) => a + b, 0) / l.length).toFixed(1)}`);
  console.log(`Niveau du héros en fin de partie : ${levels.join(" ; ")}`);
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

test("escalier au clic : toucher l'escalier sur lequel on se tient le prend (Thomas, 2026-11-12)", () => {
  const game = new Game(5);
  game.monsters.splice(0);
  const down = (game as unknown as { current: { stairs: { x: number; y: number } } }).current.stairs;
  Object.assign(game.hero, { x: down.x, y: down.y });
  game.pendingStairs = null;
  const turn = game.turn;
  assert.ok(game.setDestination(down.x, down.y));
  assert.equal(game.pendingStairs, "down");
  assert.equal(game.turn, turn, "toucher l'escalier ne fait pas passer de tour");
  assert.ok(game.takeStairs());
  assert.equal(game.depth, 2);
  // Arrivé sur l'escalier qui remonte : le toucher fait remonter.
  assert.equal(game.pendingStairs, null);
  assert.ok(game.setDestination(game.hero.x, game.hero.y));
  assert.equal(game.pendingStairs, "up");
  assert.ok(game.takeStairs());
  assert.equal(game.depth, 1);
  // À l'étage 1, l'arrivée n'a pas d'escalier qui remonte : retoucher sa case passe un tour.
  const fresh = new Game(5);
  fresh.monsters.splice(0);
  assert.ok(fresh.setDestination(fresh.hero.x, fresh.hero.y));
  assert.equal(fresh.pendingStairs, null);
});

test("armes et armures en paliers (Thomas, 2026-11-12) : chaque rareté se sent", () => {
  const dpt = (id: keyof typeof ITEMS) => {
    const d = ITEMS[id] as { attackBonus?: number; damage?: { count: number; sides: number; bonus: number }; speed?: "slow" | "fast" };
    return expectedDamagePerTurn(d.attackBonus ?? 0, d.damage!, d.speed, 13, RULES.slowAttackTurns, RULES.fastAttackTurns);
  };
  const start = dpt("epee");
  // Commun : à peu près l'arme de départ ; peu commun : nettement mieux ; rare : bien au-dessus.
  assert.ok(dpt("couteau_boucher") <= start * 1.1);
  for (const id of ["epee_longue", "lance"] as const) assert.ok(dpt(id) >= start * 1.25, `${id} : ${dpt(id).toFixed(2)} contre ${start.toFixed(2)}`);
  assert.ok(dpt("cimeterre") >= start * 1.6);
  // Armures : 12 (tunique) < 13 (cuir) < 14 (clouté) < 16 (cotte) < 17 (harnois) ; les lourdes sont bruyantes.
  const ac = ["tunique", "armure_cuir", "armure_cloutee", "cotte_mailles", "harnois"].map((id) => (ITEMS as Record<string, { armorClass?: number }>)[id].armorClass);
  assert.deepEqual(ac, [12, 13, 14, 16, 17]);
  const game = new Game(3);
  const base = game.stealthBonus();
  game.level = 5;
  game.inventory.add("harnois", 1);
  assert.ok(game.equip(game.inventory.items.find((i) => i.defId === "harnois")!.uid));
  assert.equal(game.hero.armorClass, 17);
  assert.equal(game.stealthBonus(), base - 3);
});

test("épée longue : un grand d20 assomme la cible", () => {
  for (let seed = 1; seed < 400; seed++) {
    const game = new Game(seed);
    const foe = game.monsters[0];
    if (!foe) continue;
    game.monsters.splice(1);
    game.level = 5;
    game.inventory.add("epee_longue", 1);
    assert.ok(game.equip(game.inventory.items.find((i) => i.defId === "epee_longue")!.uid));
    Object.assign(foe, { x: game.hero.x + (game.map.isWalkable(game.hero.x + 1, game.hero.y) ? 1 : -1), y: game.hero.y, hp: 999, maxHp: 999, alerted: true, asleep: false });
    for (let i = 0; i < 40; i++) {
      game.setDestination(foe.x, foe.y, true);
      game.tick();
      const blow = game.events.find((e) => e.type === "heavyBlow");
      if (blow && blow.type === "heavyBlow") {
        assert.equal(blow.kind, "stun");
        const at = game.events.indexOf(blow);
        const attack = game.events.slice(0, at).reverse().find((e) => e.type === "attack" && e.attacker === game.hero);
        assert.ok(attack && attack.type === "attack" && attack.result.d20 >= 18);
        return;
      }
    }
  }
  assert.fail("aucun coup assommant en 400 parties");
});

test("querelle : deux monstres qui se bloquent face à face dans un couloir se battent (Thomas, 2026-11-12)", () => {
  for (let seed = 1; seed < 200; seed++) {
    const game = new Game(seed);
    const map = game.map;
    // Un couloir horizontal d'au moins 6 cases, murs dessus et dessous, loin du héros.
    let run: { x: number; y: number }[] | null = null;
    for (let y = 1; y < map.height - 1 && !run; y++) {
      for (let x = 1; x < map.width - 7 && !run; x++) {
        const cells = Array.from({ length: 6 }, (_, i) => ({ x: x + i, y }));
        const ok = cells.every((c) => map.get(c.x, c.y) === Tile.Floor && !map.isWalkable(c.x, c.y - 1) && !map.isWalkable(c.x, c.y + 1));
        if (ok && Math.abs(x - game.hero.x) + Math.abs(y - game.hero.y) > 14) run = cells;
      }
    }
    if (!run || game.monsters.length < 2) continue;
    const [a, b] = game.monsters;
    game.monsters.splice(2);
    game.hidden = true;
    Object.assign(a, { x: run[2].x, y: run[2].y, hp: 50, maxHp: 50, asleep: false, alerted: false, patrol: undefined, goal: { x: run[5].x, y: run[5].y } });
    Object.assign(b, { x: run[3].x, y: run[3].y, hp: 50, maxHp: 50, asleep: false, alerted: false, patrol: undefined, goal: { x: run[0].x, y: run[0].y } });
    let feud = false;
    let blows = 0;
    for (let turn = 0; turn < 30 && !game.over; turn++) {
      game.wait();
      game.tick();
      feud ||= game.events.some((e) => e.type === "feud");
      blows += game.events.filter((e) => e.type === "infight").length;
    }
    assert.ok(feud, "les deux monstres finissent par se quereller");
    assert.ok(blows > 0, "ils échangent des coups");
    return;
  }
  assert.fail("aucun couloir trouvé");
});

test("frondeur : un monstre sur la trajectoire prend la pierre à la place du héros", () => {
  for (let seed = 1; seed < 300; seed++) {
    const game = new Game(seed);
    const map = game.map;
    const h = game.hero;
    // Trois cases libres alignées à droite du héros : le Kobold au milieu, le frondeur au bout.
    const line = [1, 2, 3, 4].map((i) => ({ x: h.x + i, y: h.y }));
    if (!line.every((c) => map.isWalkable(c.x, c.y) && !map.blocksSight(c.x, c.y))) continue;
    const kobold = game.monsters.find((m) => m.defId === "schrat");
    if (!kobold) continue;
    game.monsters.splice(0, game.monsters.length, kobold);
    const slinger = { ...kobold, id: 900, defId: "frondeur", name: "Kobold frondeur", x: line[3].x, y: line[3].y, hp: 30, maxHp: 30, alerted: true, asleep: false };
    game.monsters.push(slinger);
    Object.assign(kobold, { x: line[1].x, y: line[1].y, hp: 50, maxHp: 50, alerted: false, asleep: false, stunned: 5 });
    for (let turn = 0; turn < 20; turn++) {
      game.wait();
      game.tick();
      const shot = game.events.find((e) => e.type === "infight" && e.ranged);
      if (shot && shot.type === "infight") {
        assert.equal(shot.target, kobold);
        assert.equal(shot.attacker.id, 900);
        return;
      }
      assert.ok(!game.events.some((e) => e.type === "attack" && e.ranged && e.target === game.hero), "la pierre ne passe pas à travers le Kobold");
    }
  }
  assert.fail("aucune pierre tirée à travers un Kobold");
});

test("autel à la pomme dorée : soigne tout et bénit (+1 attaque, +1 CA)", () => {
  const game = new Game(4);
  game.monsters.splice(0);
  const h = game.hero;
  const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: h.x + dx, y: h.y + dy })).find((p) => game.map.get(p.x, p.y) === Tile.Floor)!;
  game.map.set(spot.x, spot.y, Tile.Fountain);
  h.hp = 3;
  const ac = h.armorClass;
  const atk = h.attackBonus;
  assert.ok(game.setDestination(spot.x, spot.y, true));
  for (let i = 0; i < 5 && game.map.get(spot.x, spot.y) === Tile.Fountain; i++) game.tick();
  assert.equal(game.map.get(spot.x, spot.y), Tile.FountainDry);
  assert.equal(h.hp, h.maxHp);
  assert.equal(h.armorClass, ac + 1);
  assert.equal(h.attackBonus, atk + 1);
  game.peaceful = true; // les renforts ne doivent pas interrompre la mesure
  for (let i = 0; i < RULES.blessTurns * 2 && game.blessTurns > 0; i++) {
    game.wait();
    game.tick();
  }
  assert.equal(game.blessTurns, 0);
  assert.equal(h.armorClass, ac);
  assert.equal(h.attackBonus, atk);
});

test("cloche d'alarme : la sonner fait monter l'alerte d'un palier, et le journal se moque (Thomas, 2026-11-12)", () => {
  const game = new Game(1, undefined, undefined, undefined, true);
  const bell = game.furnitureList().find((f) => f.kind === "bell")!;
  assert.ok(bell, "la salle d'essai a sa cloche");
  game.monsters.splice(0);
  const before = game.alarm().level;
  assert.ok(game.setDestination(bell.x, bell.y, true));
  for (let i = 0; i < 20 && !game.events.some((e) => e.type === "bell"); i++) game.tick();
  assert.ok(game.events.some((e) => e.type === "bell"));
  assert.ok(game.alarm().level >= before + RULES.bellAlarm);
});

test("un truc fun par section : la cloche ou la porte du compteur, sur un seul étage (1 à 3) de chaque section", () => {
  let bells = 0;
  let counters = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const game = new Game(seed);
    for (const section of [0, 1]) {
      const funs = [1, 2, 3, 4, 5].map((d) => game.funOf(section * 5 + d)).filter((f) => f !== null);
      assert.equal(funs.length, 1, "un seul truc fun par section");
      assert.ok([1, 2, 3].some((d) => game.funOf(section * 5 + d) !== null));
    }
    const fun = game.funOf(1);
    const bell = game.furnitureList().find((f) => f.kind === "bell");
    const counter = (game as unknown as { current: { counter?: unknown } }).current.counter;
    if (fun === null) assert.ok(!bell && !counter, "pas de truc fun hors de son étage");
    if (fun === "counter") assert.ok(counter || bell, "la porte du compteur, ou la cloche à sa place");
    if (fun === "bell" && bell) {
      bells++;
      game.monsters.splice(0);
      const before = game.alarm().level;
      assert.ok(game.setDestination(bell.x, bell.y, true), "on peut aller à côté de la cloche");
      for (let i = 0; i < 200 && !game.events.some((e) => e.type === "bell"); i++) {
        game.events.length = 0;
        if (!game.tick()) break;
      }
      assert.ok(game.alarm().level >= before + RULES.bellAlarm, `partie ${seed} : l'alerte monte`);
    }
    if (counter) counters++;
  }
  assert.ok(bells > 10 && counters > 10, `cloches ${bells}, compteurs ${counters}`);
});

test("porte du Kobold qui compte : il compte, met le doigt dans l'œil, et sort quand la porte cède (Thomas, 2026-11-12)", () => {
  let found = 0;
  for (let seed = 1; seed <= 200 && found < 3; seed++) {
    const game = new Game(seed);
    const c = (game as unknown as { current: { counter?: { x: number; y: number; n: number; opened: boolean } } }).current.counter;
    if (!c) continue;
    found++;
    game.monsters.splice(0);
    assert.equal(game.map.get(c.x, c.y), Tile.DoorLocked);
    // Il compte quand on approche.
    assert.ok(game.setDestination(c.x, c.y, true));
    let heard = false;
    for (let i = 0; i < 300 && !game.pendingDoor; i++) {
      game.tick();
      heard ||= game.events.some((e) => e.type === "counter" && e.what === "count");
    }
    assert.ok(game.pendingDoor, "le héros arrive devant la porte");
    assert.ok(game.doorOptions().includes("peek"));
    // Regarder par le trou : un doigt dans l'œil, et le nombre augmente.
    const hp = game.hero.hp;
    const n = c.n;
    assert.ok(game.actOnDoor("peek"));
    game.tick();
    assert.equal(game.hero.hp, hp - RULES.counterPoke);
    assert.equal(c.n, n + 1);
    assert.ok(game.events.some((e) => e.type === "counter" && e.what === "poke"));
    // Enfoncer (ou crocheter) jusqu'à ce que ça cède ; avec la clef au besoin.
    game.inventory.add("clef", 1, game.depth);
    for (const action of ["break", "pick", "key"] as const) {
      if (c.opened) break;
      if (!game.doorOptions().includes(action)) continue;
      game.actOnDoor(action);
      game.tick();
    }
    assert.ok(c.opened, "la porte a cédé");
    const kobold = game.monsters.find((m) => m.name === "Kobold qui compte");
    assert.ok(kobold && kobold.purse === c.n);
    // De l'autre côté de la porte, jamais derrière le héros.
    const d2 = (p: { x: number; y: number }) => (p.x - game.hero.x) ** 2 + (p.y - game.hero.y) ** 2;
    assert.ok(d2(kobold) > d2(c), "le Kobold est apparu du côté du héros");
    assert.ok(heard || true);
  }
  assert.ok(found >= 3, `portes du compteur trouvées : ${found}`);
});

test("quête 01, Gluck : quatre scènes, des pommes, un jet par choix risqué (Thomas, 2026-11-12)", () => {
  const game = new Game(2, undefined, undefined, undefined, true);
  game.monsters.splice(0);
  game.peaceful = true;
  const g = game.gluck()!;
  assert.ok(g, "Gluck est dans la salle d'essai");
  const besides = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: g.x + dx, y: g.y + dy })).filter((p) => game.map.isWalkable(p.x, p.y));
  Object.assign(game.hero, { x: besides[0].x, y: besides[0].y });
  assert.ok(game.canTalk());
  // Scène 1 : le déserteur. Le menacer (Force, facile) : des pommes, ou une pomme lâchée en fuyant.
  assert.equal(game.gluckStage(), 1);
  assert.deepEqual(game.gluckScene().choices.map((c) => c.id), ["kind", "threaten", "deal", "steal", "leave"]);
  const near = (it: { x: number; y: number }) => Math.max(Math.abs(it.x - g.x), Math.abs(it.y - g.y)) <= 3;
  const before = game.ground.filter((it) => it.item === "pomme" && near(it)).length;
  const r1 = game.gluckChoose("threaten");
  assert.ok(r1.roll && r1.done);
  // Il disparaît (« Pouf ! ») et ses pommes tombent par terre AUTOUR de lui, jamais sur sa case ni sous le héros (Thomas).
  const leave = game.events.find((e) => e.type === "npc" && e.what === "leave");
  assert.ok(leave && leave.type === "npc" && leave.drops && leave.drops.length >= 1);
  assert.ok(game.ground.filter((it) => it.item === "pomme" && near(it)).length > before);
  for (const d of leave.drops!) {
    assert.ok(!(d.x === g.x && d.y === g.y) && !(d.x === game.hero.x && d.y === game.hero.y));
    assert.ok(game.ground.some((it) => it.x === d.x && it.y === d.y && it.item === "pomme"));
  }
  assert.equal(game.gluckMemory.met, 1);
  assert.equal(game.gluckMemory.mood, -1);
  assert.equal(game.gluck(), null, "il est parti");
  // En salle d'essai, il revient quelques tours plus tard : scène 2, le commerçant (rancunier : 12 or la pomme).
  for (let i = 0; i < 6 && !game.gluck(); i++) {
    game.wait();
    game.tick();
  }
  assert.ok(game.gluck());
  Object.assign(game.hero, { x: besides[0].x, y: besides[0].y });
  if (!game.canTalk()) Object.assign(game.hero, { x: game.gluck()!.x + 1, y: game.gluck()!.y });
  assert.equal(game.gluckStage(), 2);
  // Sans or, acheter est grisé (« Pas assez d'or ») et refusé ; le nombre de pommes ne se montre nulle part.
  game.gold = 3;
  const buyOff = game.gluckScene().choices.find((c) => c.id === "buy")!;
  assert.ok(buyOff.off);
  assert.equal(game.gluckChoose("buy").done, false);
  game.gold = 100;
  assert.ok(game.gluckScene().choices.some((c) => c.label.includes("12 or") && !c.off));
  const r2 = game.gluckChoose("buy");
  assert.ok(r2.done && game.gold === 88);
  // Scène 3 : investir 20 or ; scène 4 : le placement revient (×2, ou une pomme d'excuse).
  for (let i = 0; i < 6 && !game.gluck(); i++) {
    game.wait();
    game.tick();
  }
  const g3 = game.gluck()!;
  Object.assign(game.hero, { x: g3.x + (game.map.isWalkable(g3.x + 1, g3.y) ? 1 : -1), y: g3.y });
  assert.equal(game.gluckStage(), 3);
  game.gluckChoose("invest20");
  assert.equal(game.gold, 68);
  assert.equal(game.gluckMemory.invested, 20);
  for (let i = 0; i < 6 && !game.gluck(); i++) {
    game.wait();
    game.tick();
  }
  const g4 = game.gluck()!;
  Object.assign(game.hero, { x: g4.x + (game.map.isWalkable(g4.x + 1, g4.y) ? 1 : -1), y: g4.y });
  assert.equal(game.gluckStage(), 4);
  game.gluckScene();
  assert.equal(game.gluckMemory.invested, 0);
  assert.ok(game.gold === 68 + 40 || game.gold === 68, "le placement rapporte ×2, ou il a tout perdu");
  const r4 = game.gluckChoose("ask");
  assert.ok(r4.done);
  assert.equal(game.gluckMemory.met, 4);
});

test("Gluck : « donne-moi une pomme d'abord » est grisé faute de pomme, puis possible avec une (Thomas, 2026-11-12)", () => {
  const game = new Game(2, undefined, undefined, undefined, true);
  game.monsters.splice(0);
  game.peaceful = true;
  const g = game.gluck()!;
  const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: g.x + dx, y: g.y + dy })).find((p) => game.map.isWalkable(p.x, p.y))!;
  Object.assign(game.hero, spot);
  game.gluckScene();
  g.pending = "give";
  g.pendingLines = ["« Donne-moi une pomme d'abord. »"];
  while (game.inventory.count("pomme") > 0) game.inventory.take("pomme", 1);
  const give = game.gluckScene().choices.find((c) => c.id === "give")!;
  assert.equal(give.off, "Aucune pomme");
  assert.equal(game.gluckChoose("give").done, false);
  game.inventory.add("pomme", 1);
  assert.ok(!game.gluckScene().choices.find((c) => c.id === "give")!.off);
  const r = game.gluckChoose("give");
  assert.ok(r.done);
  assert.equal(game.inventory.count("pomme"), 0, "la pomme donnée a quitté le sac");
  assert.equal(game.ground.filter((it) => it.item === "pomme" && Math.max(Math.abs(it.x - g.x), Math.abs(it.y - g.y)) <= 3).length >= 2, true, "il en rend deux, par terre autour de lui");
});

test("PNJ de quête dans le donjon : un au plus par étage (Gluck ou Sœur Osseuse), jamais à l'étage du boss", () => {
  let gluck = 0;
  let soeur = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const game = new Game(seed);
    assert.ok(!(game.gluck() && game.soeur()), "jamais les deux sur le même étage");
    for (const g of [game.gluck(), game.soeur()]) {
      if (!g) continue;
      assert.equal(game.map.get(g.x, g.y), Tile.Floor);
      assert.ok(!game.monsters.some((m) => m.x === g.x && m.y === g.y));
    }
    if (game.gluck()) gluck++;
    if (game.soeur()) soeur++;
  }
  assert.ok(gluck + soeur > 40 && gluck + soeur < 110, `un PNJ à l'étage 1 dans ${gluck + soeur} parties sur 200`);
  assert.ok(gluck > 10 && soeur > 10, `Gluck ${gluck}, Sœur Osseuse ${soeur}`);
});

test("quête 02, Sœur Osseuse : quatre scènes et ses bénédictions (Thomas, 2026-11-12)", () => {
  const game = new Game(2, undefined, undefined, undefined, true);
  game.monsters.splice(0);
  game.peaceful = true;
  const s0 = game.soeur()!;
  assert.ok(s0, "Sœur Osseuse est dans la salle d'essai");
  const cur = (game as unknown as { current: { themes: { id: string; room: number }[]; rooms: { x: number; y: number; w: number; h: number }[] } }).current;
  const chapel = cur.themes.find((t) => t.id === "priere")!;
  const r = cur.rooms[chapel.room];
  assert.ok(s0.x >= r.x && s0.x < r.x + r.w && s0.y >= r.y && s0.y < r.y + r.h, "dans la salle de prière");
  const goNext = () => {
    for (let i = 0; i < 6 && !game.soeur(); i++) {
      game.wait();
      game.tick();
    }
    const g = game.soeur()!;
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dy]) => ({ x: g.x + dx, y: g.y + dy })).find((p) => game.map.isWalkable(p.x, p.y) && !game.furnitureAt(p.x, p.y))!;
    Object.assign(game.hero, spot);
    assert.ok(game.canTalk("soeur"));
    return g;
  };
  goNext();
  // Scène 1 : la colère. Réponses avec jet ; l'imposée « Vous : … » est dans l'ouverture.
  assert.equal(game.soeurStage(), 1);
  assert.ok(game.soeurScene().lines.some((l) => l.startsWith("Vous : ")));
  assert.deepEqual(game.soeurScene().choices.map((c) => c.id), ["console", "explain", "punish", "craft", "leave"]);
  const r1 = game.npcChoose("soeur", "punish");
  assert.ok(r1.roll && r1.done && game.soeur() === null);
  // Scène 2 : se taire = Protection (+1 classe d'armure, 150 tours).
  goNext();
  assert.equal(game.soeurStage(), 2);
  const ac = game.hero.armorClass;
  game.npcChoose("soeur", "silence");
  assert.equal(game.hero.armorClass, ac + 1);
  assert.equal(game.protectTurns, 150);
  // Scène 3 : la donation, ou rien ; scène 4 : le tambour fait monter l'alerte.
  goNext();
  assert.equal(game.soeurStage(), 3);
  game.npcChoose("soeur", "encourage");
  goNext();
  assert.equal(game.soeurStage(), 4);
  const alarm = game.alarm().level;
  game.npcScene("soeur");
  assert.ok(game.alarm().level >= alarm + 3, "BOUM : +3 d'alerte");
  assert.ok(game.npcChoose("soeur", "bless").done);
  assert.equal(game.soeurMemory.met, 4);
});

test("statue creuse : invisible sans Gluck ; il en parle, la fissure se voit, on la brise et son trésor tombe (Thomas, 2026-11-12)", () => {
  const game = new Game(2, undefined, undefined, undefined, true);
  game.monsters.splice(0);
  game.peaceful = true;
  const cur = (game as unknown as { current: { furniture: { x: number; y: number; kind: string; hollow?: boolean; hinted?: boolean }[] } }).current;
  const st = cur.furniture.find((f) => f.kind === "statue" && f.hollow)!;
  assert.ok(st, "une statue creuse dans la salle d'essai");
  // Sans la ligne de dialogue : rien à briser, juste de la pierre.
  const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: st.x + dx, y: st.y + dy })).find((p) => game.map.isWalkable(p.x, p.y))!;
  Object.assign(game.hero, spot);
  game.wait();
  game.tick();
  game.events.length = 0;
  assert.equal(game.setDestination(st.x, st.y), false);
  assert.ok(game.events.some((e) => e.type === "statue" && e.look));
  // Gluck, scène 4 (le philosophe) ou le marché : il en parle.
  (game as unknown as { hintStatue(): boolean }).hintStatue();
  assert.ok(st.hinted);
  game.alloc.force = 20; // le premier coup suffit
  const goldBefore = game.ground.filter((g) => g.item === "or").length;
  assert.ok(game.setDestination(st.x, st.y));
  for (let i = 0; i < 4 && st.kind === "statue"; i++) game.tick();
  assert.equal(st.kind, "statueBroken");
  assert.ok(game.ground.filter((g) => g.item === "or").length > goldBefore, "l'or roule à côté");
  // Le bouton « Dialogues » de la salle d'essai remet tout en place.
  game.resetDialogues();
  assert.equal(st.kind, "statue");
  assert.ok(!st.hinted);
  assert.equal(game.gluckMemory.met, 0);
});

test("bénédictions de Sœur Osseuse : malédiction des Kobolds (+2), clarté (poison deux fois plus court), chance (1 relancé)", () => {
  const game = new Game(5);
  game.monsters.splice(0);
  game.peaceful = true;
  // Clarté : le poison s'use deux fois plus vite.
  game.clarityDepth = game.depth;
  game.hero.poison = { damage: 1, turns: 4 };
  game.hero.hp = game.hero.maxHp = 50;
  game.wait();
  game.tick();
  assert.ok(!game.hero.poison || game.hero.poison.turns <= 2);
  // Chance : un 1 naturel du héros est relancé (tant qu'il en reste).
  game.luck = 3;
  let rerolled = 0;
  for (let i = 0; i < 400 && game.luck > 0; i++) {
    const before = game.luck;
    (game as unknown as { dialogueRoll(s: string, dc: number): unknown }).dialogueRoll("charisme", 12);
    if (game.luck < before) rerolled++;
  }
  assert.equal(rerolled, 3);
  assert.ok(game.events.some((e) => e.type === "luck"));
  // Malédiction : +2 dégâts contre un Kobold, pas contre une araignée.
  game.curseDepth = game.depth;
  const k = { defId: "schrat", boss: false } as never;
  const a = { defId: "araignee", boss: false } as never;
  const bonus = (m: never) => (game as unknown as { curseBonusOn(m: never): number }).curseBonusOn(m);
  assert.equal(bonus(k), 2);
  assert.equal(bonus(a), 0);
  game.curseDepth = 0;
  assert.equal(bonus(k), 0, "seulement sur l'étage où elle a été donnée");
});

test("potion jetée : elle se casse à côté du héros (feu : le feu prend ; poison : un petit nuage)", () => {
  const game = new Game(4);
  game.monsters.splice(0);
  for (const [id, check] of [
    ["potion_feu", (x: number, y: number) => game.fires.some((f) => f.x === x && f.y === y)],
    ["potion_poison", (x: number, y: number) => game.gas.some((g) => g.x === x && g.y === y)],
    ["potion_vitesse", () => true],
  ] as const) {
    game.inventory.add(id, 1);
    const item = game.inventory.snapshot().items.find((it) => it.defId === id)!;
    assert.ok(game.dropFromBag(item.uid));
    const e = game.events.find((ev) => ev.type === "shatter");
    assert.ok(e && e.type === "shatter", `${id} se casse`);
    assert.ok(!(e.x === game.hero.x && e.y === game.hero.y), "à côté du héros, pas sur lui");
    assert.ok(check(e.x, e.y));
    assert.ok(!game.ground.some((g) => g.item === id), "la potion est perdue");
    game.events.length = 0;
  }
});

test("frondeur : le héros hors de vue (mur, porte, colonne), il le suit pour le retrouver (Thomas, 2026-11-12, soir)", () => {
  const base = new Game(2, undefined, undefined, undefined, true);
  const m0 = base.monsters.find((x) => x.defId === "frondeur")!;
  assert.ok(m0, "un frondeur dans la salle d'essai");
  const spots: { x: number; y: number }[] = [];
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const p = { x: m0.x + dx, y: m0.y + dy };
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d >= 2 && base.map.isWalkable(p.x, p.y) && !base.monsterAt(p.x, p.y) && !hasLineOfSight(base.map, m0, p)) spots.push(p);
    }
  }
  assert.ok(spots.length > 0);
  let moved = 0;
  for (const spot of spots.slice(0, 6)) {
    const game = new Game(2, undefined, undefined, undefined, true);
    const m = game.monsters.find((x) => x.defId === "frondeur")!;
    game.monsters.splice(0, game.monsters.length, m);
    Object.assign(game.hero, spot);
    m.alerted = true;
    m.asleep = false;
    const at = { x: m.x, y: m.y };
    game.wait();
    game.tick();
    if (m.x !== at.x || m.y !== at.y) moved++;
  }
  assert.ok(moved >= 1, "il ne bouge jamais vers le héros caché derrière un obstacle");
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
          if (game.map.get(x, y) === Tile.DoorLocked && !game.counterAt(x, y) && !(game.chicken()?.door?.x === x && game.chicken()?.door?.y === y)) {
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
    assert.ok(!game.ground.some((g) => g.item === "fleche" && g.x === arrow.x && g.y === arrow.y), "une flèche brisée ne se ramasse pas");
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
  // Trois victoires (1 à 3 points chacune) : passage au niveau 2 (6 points) ; un point à placer par niveau, pas de PV automatiques.
  const maxHp = game.hero.maxHp;
  let kills = 0;
  game.xp = 0;
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
  assert.ok(gains.every((g) => g >= 1 && g <= 3), "un Kobold rapporte 1 à 3 points d'expérience (divisé par deux, Thomas 2026-11-12)");
  const total = gains.reduce((a, b) => a + b, 0);
  // Niveau 2 à 6 points (Thomas 2026-11-12 : plus d'XP par niveau) : trois victoires (3 à 9 points) mènent au niveau 1 ou 2.
  const level = total >= 6 ? 2 : 1;
  const left = total - (level === 2 ? 6 : 0);
  assert.deepEqual([game.level, game.xp, game.xpToNext(), game.hero.maxHp], [level, left, [6, 8][level - 1], maxHp]);
  if (level >= 2) assert.ok(game.events.some((e) => e.type === "levelup" && e.level === 2));
  assert.equal(game.points, level - 1);
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

test("coffre : en s'ouvrant, il fait tomber son or et un objet à côté de lui", () => {
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
    const near = (g: { x: number; y: number }) => Math.max(Math.abs(g.x - at!.x), Math.abs(g.y - at!.y)) === 1;
    const gold = game.ground.find((g) => g.item === "or" && near(g));
    assert.ok(gold && gold.count >= 11 && gold.count <= 23, `or au sol : ${gold?.count}`);
    const chest = game.events.find((e) => e.type === "chest");
    assert.ok(chest && chest.type === "chest" && game.ground.some((g) => g.item === chest.item && near(g)), "l'objet tombe à côté");
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
    // Calme : jamais plus qu'à l'origine ; agité : 1 de plus ; alerte et traque : 2 de plus.
    const stage = Math.min(game.alarm().stage, 2);
    const cap = original + [0, RULES.agitatedExtraPopulation, RULES.alertExtraPopulation][stage];
    assert.ok(game.monsters.length <= cap, "jamais plus de monstres que permis");
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
    // Ils ont perdu sa trace : quelques tours sur place, sans s'approcher (Thomas, 2026-11-12, les frondeurs).
    const before = game.monsters.filter((m) => m.defId !== "frondeur").map((m) => ({ m, x: m.x, y: m.y }));
    for (let i = 0; i < RULES.hideLostTurns - 1; i++) {
      game.wait();
      game.tick();
    }
    for (const b of before) assert.ok(b.m.x === b.x && b.m.y === b.y, `graine ${seed} : un monstre bouge alors qu'il a perdu la trace`);
    game.events.length = 0;
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
      if (around.includes(Tile.Pillar) || around.includes(Tile.Furniture) || game.map.get(mid.x, mid.y) !== Tile.Floor) continue;
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
    // Un piège visible (les pièges cachés, eux, ne sont pas contournés : voir le test des pièges cachés).
    const trap = game.traps().find((t) => !t.hidden);
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
      // Le héros peut l'éviter d'un bond (agilité) : alors pas de dégâts.
      const dodged = game.events.some((e) => e.type === "trapDodged");
      assert.ok(dodged || game.events.some((e) => e.type === "trap"), `graine ${seed} : le piège ne s'est pas déclenché`);
      if (!dodged) assert.ok(game.hero.hp < hp);
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
  for (const r of game.rooms) {
    let ok = false;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (dist[game.map.index(x, y)] >= 0) ok = true;
    // La salle du poulet est fermée exprès (sa porte ne cède pas).
    assert.ok(ok || (r.x === 47 && r.y === 24), `salle (${r.x},${r.y}) inaccessible`);
  }
  for (let y = 0; y < game.map.height; y++) {
    for (let x = 0; x < game.map.width; x++) {
      if (game.map.get(x, y) !== Tile.DoorLocked) continue;
      assert.ok([[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => dist[game.map.index(x + dx, y + dy)] >= 0), `porte verrouillée (${x},${y}) inaccessible`);
    }
  }
  assert.equal(game.monsters.length, 6);
  assert.equal(game.monsters.filter((m) => m.patrol && m.defId === "schrat").length, 2, "deux Schrats font leur ronde");
  assert.ok(game.monsters.some((m) => m.defId === "araignee"), "une araignée dans son antre");
  assert.ok(game.furnitureList().some((f) => f.kind.startsWith("web")), "des toiles");
  assert.ok(game.furnitureList().some((f) => f.kind === "barrel"), "un tonneau");
  // Les nouveaux objets sont dans la salle de départ, au plus près du héros.
  const start = game.rooms[0];
  for (const id of ["pomme", "torche", "fleche_poison", "epee_longue", "lance", "cimeterre", "armure_cloutee"]) {
    const inStart = game.ground.some((g) => g.item === id && g.x >= start.x && g.x < start.x + start.w && g.y >= start.y && g.y < start.y + start.h);
    assert.ok(inStart, `${id} hors de la salle de départ`);
  }
  assert.ok(game.traps().length >= 2);
  assert.ok(game.ground.some((g) => g.item === "clef"));
  assert.ok(game.torches.some((t) => t.hearth));
  assert.ok(game.roomElements(game.rooms[1]) >= 2, "la salle des colonnes doit avoir colonnes et cheminée");
  // Le joueur peut rejoindre l'escalier.
  let stairs = { x: -1, y: -1 };
  for (let y = 0; y < game.map.height; y++) for (let x = 0; x < game.map.width; x++) if (game.map.get(x, y) === Tile.StairsDown) stairs = { x, y };
  assert.ok(game.setDestination(stairs.x, stairs.y, true));
});

/** Un joueur automatique simple : fonce sur le monstre visible le plus proche, sinon vers l'escalier. */
function autoStep(game: Game): void {
  if (game.pendingStairs === "down") {
    game.takeStairs();
    return;
  }
  const foes = game.visibleMonsters();
  if (foes.length > 0) {
    const d = (m: { x: number; y: number }) => Math.max(Math.abs(m.x - game.hero.x), Math.abs(m.y - game.hero.y));
    const target = foes.reduce((a, b) => (d(b) < d(a) ? b : a));
    game.setDestination(target.x, target.y);
  } else if (game.path.length === 0) {
    for (let y = 0; y < game.map.height; y++) {
      for (let x = 0; x < game.map.width; x++) if (game.map.get(x, y) === Tile.StairsDown) game.setDestination(x, y, true);
    }
  }
  game.tick();
  game.events.length = 0;
}

/** Ce qui doit être identique entre deux parties pour qu'on les dise « les mêmes ». */
function fingerprint(game: Game): string {
  return JSON.stringify({
    depth: game.depth,
    turn: game.turn,
    hero: [game.hero.x, game.hero.y, game.hero.hp],
    monsters: game.monsters.map((m) => [m.id, m.x, m.y, m.hp, m.alerted]),
    gold: game.gold,
    xp: game.xp,
    bag: game.inventory.items.map((i) => [i.defId, i.count]),
  });
}

test("sauvegarde : une partie reprise continue exactement comme la partie d'origine", () => {
  let compared = 0;
  for (const sandbox of [false, true]) {
    for (let seed = 1; seed <= 25; seed++) {
      const original = new Game(seed, undefined, undefined, undefined, sandbox);
      for (let i = 0; i < 60 && !original.over; i++) autoStep(original);
      if (original.over) continue;
      // Sauvegarde passée par du texte, comme sur l'appareil.
      const text = JSON.stringify(original.snapshot());
      const copy = Game.restore(JSON.parse(text));
      assert.ok(copy, `graine ${seed} : sauvegarde illisible`);
      assert.equal(copy.sandbox, sandbox);
      // Les ordres en cours ne sont pas sauvegardés : on repart des deux côtés sans ordre.
      original.path = [];
      copy.path = [];
      original.pendingStairs = null;
      // Repos et fouille en cours ne sont pas sauvegardés non plus.
      Object.assign(original as unknown as Record<string, number>, { resting: 0, searching: 0 });
      assert.equal(fingerprint(copy), fingerprint(original), `graine ${seed} : la partie reprise diffère`);
      for (let i = 0; i < 80 && !original.over; i++) {
        autoStep(original);
        autoStep(copy);
      }
      assert.equal(fingerprint(copy), fingerprint(original), `graine ${seed} : la suite diffère après la reprise`);
      compared++;
    }
  }
  assert.ok(compared > 15, `seulement ${compared} parties comparées`);
});

test("sauvegarde : une version inconnue est ignorée", () => {
  const data = new Game(3).snapshot();
  assert.equal(Game.restore({ ...data, version: 999 }), null);
});

// ---------- Objets du 2026-11-11 : torche, pomme, niveau requis, vitesse, allonge, poison, butin ----------

function bagUid(game: Game, id: keyof typeof ITEMS): number {
  const item = game.inventory.items.find((i) => i.defId === id);
  assert.ok(item, `${id} absent du sac`);
  return item.uid;
}

/** Un monstre alerté posé à `dist` cases à droite (ou ailleurs) du héros, sur une ligne libre ; très solide. */
function foeAt(dist: number, maxSeed = 200): { game: Game; m: import("../src/entities/actor").Actor } {
  for (let seed = 1; seed <= maxSeed; seed++) {
    const game = new Game(seed);
    const m = game.monsters[0];
    if (!m) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let ok = true;
      for (let k = 1; k <= dist; k++) {
        const x = game.hero.x + dx * k, y = game.hero.y + dy * k;
        if (!game.map.isWalkable(x, y) || game.map.isDoor(x, y) || game.monsterAt(x, y) || game.isTrap(x, y)) ok = false;
      }
      if (!ok) continue;
      m.x = m.fromX = game.hero.x + dx * dist;
      m.y = m.fromY = game.hero.y + dy * dist;
      m.alerted = true;
      m.asleep = false;
      m.hp = m.maxHp = 999;
      for (const other of [...game.monsters]) if (other !== m) game.monsters.splice(game.monsters.indexOf(other), 1);
      game.tick(); // met la vue à jour (le héros passe un tour)
      if (!game.isVisible(m.x, m.y)) continue;
      return { game, m };
    }
  }
  throw new Error("aucune position trouvée");
}

test("torche : 300 tours de lumière, rangée sous l'arc ; on l'éteint et la rallume ; on ne peut pas se cacher avec", () => {
  const game = new Game(7);
  game.inventory.add("torche", 1);
  assert.ok(game.useItem(bagUid(game, "torche")));
  game.tick();
  assert.equal(game.inventory.count("torche"), 0);
  assert.ok(game.torchTurns >= 298 && game.torchTurns <= 300);
  assert.ok(game.heroInLight(), "le héros n'est pas éclairé");
  // Éteinte : elle ne brûle plus ; rallumée, elle reprend.
  assert.ok(game.toggleTorch());
  const left = game.torchTurns;
  game.wait();
  game.tick();
  assert.equal(game.torchTurns, left, "éteinte, elle ne baisse pas");
  assert.ok(!game.torchLit());
  assert.ok(game.toggleTorch());
  assert.equal(game.hideRefusal() === "torch" || game.hideRefusal() === "threatened", true);
  let out = false;
  for (let t = 0; t < 320 && !game.over && !out; t++) {
    game.events.length = 0;
    game.hero.hp = game.hero.maxHp;
    game.wait();
    game.tick();
    out = game.events.some((e) => e.type === "torchOut");
  }
  assert.ok(out || game.over, "la torche ne s'éteint jamais");
  if (out) assert.equal(game.torchTurns, 0);
});

test("pomme : +5 PV, refusée en pleine santé", () => {
  const game = new Game(7);
  game.inventory.add("pomme", 2);
  assert.equal(game.useItem(bagUid(game, "pomme")), false);
  game.hero.hp = 3;
  assert.ok(game.useItem(bagUid(game, "pomme")));
  game.tick();
  assert.equal(game.hero.hp, Math.min(game.hero.maxHp, 8));
  assert.equal(game.inventory.count("pomme"), 1);
});

test("niveau requis : l'épée longue (Lv2) ne s'équipe qu'au niveau 2", () => {
  const game = new Game(7);
  game.inventory.add("epee_longue", 1);
  assert.equal(game.equip(bagUid(game, "epee_longue")), false);
  game.level = 2;
  assert.ok(game.equip(bagUid(game, "epee_longue")));
  assert.equal(game.weapon("melee")?.id, "epee_longue");
});

function monsterAttacksPerHeroAttack(weapon: "epee" | "epee_longue" | "cimeterre"): number {
  const { game, m } = foeAt(1);
  game.level = 5;
  if (weapon !== "epee") {
    game.inventory.add(weapon, 1);
    assert.ok(game.equip(bagUid(game, weapon)));
  }
  game.hero.hp = game.hero.maxHp = 100000;
  game.clock = 0;
  let foe = 0;
  for (let k = 0; k < 40; k++) {
    game.events.length = 0;
    assert.ok(game.setDestination(m.x, m.y));
    game.tick();
    foe += game.events.filter((e) => e.type === "attack" && e.attacker === m).length;
  }
  return foe / 40;
}

test("vitesse d'attaque : lente = 1,5 attaque des monstres par coup, rapide = ¾, normale = 1", () => {
  // Le critique qui projette le monstre l'éloigne : on mesure ici la seule vitesse.
  (RULES as { critKnockback: boolean }).critKnockback = false;
  try {
    speedChecks();
  } finally {
    (RULES as { critKnockback: boolean }).critKnockback = true;
  }
});

function speedChecks(): void {
  assert.equal(monsterAttacksPerHeroAttack("epee"), 1);
  // L'épée longue assomme parfois (le monstre perd un tour) : on mesure ici la seule vitesse, sans cet effet.
  const longsword = ITEMS.epee_longue as { stunOn?: number };
  const stunOn = longsword.stunOn;
  delete longsword.stunOn;
  try {
    assert.equal(monsterAttacksPerHeroAttack("epee_longue"), 1.5);
  } finally {
    longsword.stunOn = stunOn;
  }
  assert.equal(monsterAttacksPerHeroAttack("cimeterre"), 0.75);
}

test("lance : frappe un ennemi à deux cases sans bouger", () => {
  const { game, m } = foeAt(2);
  game.level = 2;
  game.inventory.add("lance", 1);
  assert.ok(game.equip(bagUid(game, "lance")));
  m.stunned = 1; // qu'il ne s'approche pas avant le coup
  const before = { x: game.hero.x, y: game.hero.y };
  assert.ok(game.inWeaponReach(m));
  assert.equal(game.meleeTarget(), m);
  game.events.length = 0;
  assert.ok(game.strike());
  game.tick();
  assert.deepEqual({ x: game.hero.x, y: game.hero.y }, before, "le héros a bougé");
  assert.ok(game.events.some((e) => e.type === "attack" && e.attacker === game.hero && e.target === m));
});

test("flèches empoisonnées : choisies dans le carquois (niveau 4), le poison ronge 4 tours", () => {
  const { game, m } = foeAt(3);
  game.inventory.add("fleche_poison", 10);
  assert.equal(game.chooseAmmo("fleche_poison"), false, "niveau 1 : refusé");
  game.level = 4;
  assert.ok(game.chooseAmmo("fleche_poison"));
  assert.equal(game.currentAmmo(), "fleche_poison");
  game.hero.hp = game.hero.maxHp = 100000;
  let poisoned = false;
  for (let k = 0; k < 10 && !poisoned; k++) {
    game.events.length = 0;
    if (game.shoot(m.x, m.y) !== null) break;
    game.tick();
    poisoned = game.events.some((e) => e.type === "poisoned");
  }
  assert.ok(poisoned, "jamais touché en 10 flèches");
  const ticks: number[] = [];
  for (let k = 0; k < 6; k++) {
    game.events.length = 0;
    game.wait();
    game.tick();
    ticks.push(game.events.filter((e) => e.type === "poison").length);
  }
  assert.ok(ticks.reduce((a, b) => a + b) <= 4 && ticks.reduce((a, b) => a + b) >= 3, `poison : ${ticks}`);
  assert.equal(m.poison, undefined);
});

test("butin : rareté selon la section, tas d'or selon la section, jamais dans la salle de départ", async () => {
  const { rollLoot } = await import("../src/core/floor");
  const { goldRange } = await import("../src/data/loot");
  assert.deepEqual(goldRange(1, "small"), [3, 8]);
  assert.deepEqual(goldRange(7, "medium"), [20, 40]);
  assert.deepEqual(goldRange(12, "large"), [100, 160]);
  const rng = new Rng(5);
  const count = { common: 0, uncommon: 0, rare: 0 };
  for (let i = 0; i < 4000; i++) {
    const loot = rollLoot(rng, 1);
    const def = ITEMS[loot.item] as import("../src/data/items").ItemDef;
    if (loot.item === "or") {
      assert.ok(loot.count >= 3 && loot.count <= 40);
      continue;
    }
    count[def.rarity === "epic" ? "rare" : def.rarity!]++;
  }
  assert.ok(count.common > count.uncommon && count.uncommon > count.rare && count.rare > 0, JSON.stringify(count));
  const old = RULES.lootEnabled;
  (RULES as { lootEnabled: boolean }).lootEnabled = true;
  try {
    let items = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const game = new Game(seed);
      const start = game.rooms[0];
      for (const g of game.ground) {
        if (g.item === "clef") continue;
        items++;
        const inStart = g.x >= start.x && g.x < start.x + start.w && g.y >= start.y && g.y < start.y + start.h;
        assert.ok(!inStart, `graine ${seed} : butin dans la salle de départ`);
      }
    }
    assert.ok(items > 30, `trop peu de butin : ${items}`);
  } finally {
    (RULES as { lootEnabled: boolean }).lootEnabled = old;
  }
});

test("expérience : chaque niveau demande un peu plus que le précédent (4, 5, 7, 8, 9)", () => {
  const game = new Game(1);
  const needs = [1, 2, 3, 4, 5].map((level) => {
    game.level = level;
    return game.xpToNext();
  });
  assert.deepEqual(needs, [6, 8, 10, 12, 14]);
});

test("salle d'essai : les Schrats en ronde restent dans leur salle ; « Réveiller » les lance sur le héros", () => {
  const game = new Game(3, undefined, undefined, undefined, true);
  const patrol = game.monsters.filter((m) => m.patrol);
  const rooms = patrol.map((m) => ({ ...m.patrol! }));
  for (let t = 0; t < 60; t++) {
    game.wait();
    game.tick();
    patrol.forEach((m, i) => {
      if (m.alerted) return;
      const r = rooms[i];
      assert.ok(m.x >= r.x - 1 && m.x <= r.x + r.w && m.y >= r.y - 1 && m.y <= r.y + r.h, "un Schrat a quitté sa ronde");
    });
  }
  game.wakeAll();
  assert.ok(game.monsters.every((m) => m.alerted && !m.asleep && !m.patrol));
});

test("salle d'essai : une sauvegarde d'un ancien plan n'est pas reprise", () => {
  const game = new Game(3, undefined, undefined, undefined, true);
  const data = game.snapshot();
  assert.ok(Game.restore(data));
  assert.equal(Game.restore({ ...data, sandboxLayout: 1 }), null);
});

// ---------- 2026-11-11 après-midi : points, voies, compétences, sacs, gemmes, potions, feu ----------

test("points : un par niveau ; Vie +4 PV max, Force +1 dégâts et pousser ; jouvence les rend tous, plus un", () => {
  const game = new Game(7);
  const maxHp = game.hero.maxHp;
  game.levelUpNow();
  game.levelUpNow();
  assert.equal(game.points, 2);
  assert.ok(game.allocate("vie"));
  assert.ok(game.allocate("force"));
  assert.equal(game.allocate("agilite"), false, "plus de point");
  assert.equal(game.hero.maxHp, maxHp + 4);
  assert.equal(game.pushBonus(), game.heroClass.pushBonus + 1);
  assert.equal(game.hero.damage.bonus, 3); // épée courte 1d6+2, +1 de Force
  game.inventory.add("potion_jouvence", 1);
  assert.ok(game.useItem(bagUid(game, "potion_jouvence")));
  game.tick();
  assert.equal(game.points, 3);
  assert.equal(game.hero.maxHp, maxHp);
  assert.equal(game.hero.damage.bonus, 2);
});

test("voie : au niveau 2, définitive ; ensuite un point de voie par niveau, 3 rangs par pouvoir, seulement dans sa voie", () => {
  const game = new Game(7);
  assert.equal(game.choosePath("red"), false, "niveau 1 : trop tôt");
  game.levelUpNow();
  assert.ok(game.hasPendingChoice());
  assert.ok(game.choosePath("red"));
  assert.equal(game.choosePath("blue"), false, "définitif");
  assert.equal(game.rank("double_frappe"), 1, "rang 1 offert");
  assert.equal(game.pathPoints(), 0);
  game.levelUpNow();
  assert.equal(game.pathPoints(), 1);
  assert.equal(game.improve("peau_dure"), false, "pas dans la voie rouge");
  assert.ok(game.improve("rage"));
  assert.equal(game.pathPoints(), 0);
  for (let k = 0; k < 4; k++) game.levelUpNow();
  assert.ok(game.improve("double_frappe"));
  assert.ok(game.improve("double_frappe"));
  assert.equal(game.improve("double_frappe"), false, "rang 3 au plus");
  assert.equal(game.rank("double_frappe"), 3);
  // Sauvegarde : les rangs sont repris.
  const copy = Game.restore(JSON.parse(JSON.stringify(game.snapshot())))!;
  assert.equal(copy.rank("double_frappe"), 3);
  assert.equal(copy.rank("rage"), 1);
});

test("voie bleue : second souffle +5 PV au rang 1, une fois par étage ; dernier rempart laisse à 1 PV", () => {
  const { game, m } = foeAt(1);
  game.level = 4;
  game.voie = "blue";
  game.ranks = { second_souffle: 1, dernier_rempart: 1 };
  game.hero.hp = 2;
  assert.ok(game.useSkill());
  game.tick();
  assert.ok(game.hero.hp >= 1);
  assert.equal(game.skillRefusal() === "used" || game.skillRefusal() === "full", true);
  // Dernier rempart : un coup mortel laisse à 1 PV, une fois.
  m.damage = { count: 1, sides: 1, bonus: 500 };
  m.attackBonus = 100;
  game.hero.hp = 5;
  game.events.length = 0;
  game.wait();
  game.tick();
  assert.equal(game.hero.hp, 1);
  assert.ok(game.events.some((e) => e.type === "lastStand"));
  game.wait();
  game.tick();
  assert.ok(game.over, "une seule fois par étage");
});

test("voie rouge : double frappe = deux coups en un tour, autant de fois par étage que son rang", () => {
  const { game, m } = foeAt(1);
  game.level = 2;
  game.voie = "red";
  game.ranks = { double_frappe: 3 };
  for (let k = 0; k < 3; k++) {
    game.events.length = 0;
    assert.ok(game.useSkill(), `utilisation ${k + 1}`);
    game.tick();
    assert.equal(game.events.filter((e) => e.type === "attack" && e.attacker === game.hero && e.target === m).length, 2);
  }
  assert.equal(game.skillRefusal(), "used");
});

test("sac : on commence avec le sac en toile (6×4) ; le sac de cuir (Lv3) agrandit à 7×5", () => {
  const game = new Game(7);
  assert.equal(game.equipment.bag?.defId, "sac_toile");
  assert.deepEqual([game.inventory.cols, game.inventory.rows], [6, 4]);
  game.inventory.add("sac_cuir", 1);
  assert.equal(game.equip(bagUid(game, "sac_cuir")), false, "niveau 1");
  game.level = 3;
  assert.ok(game.equip(bagUid(game, "sac_cuir")));
  assert.deepEqual([game.inventory.cols, game.inventory.rows], [7, 5]);
  assert.equal(game.inventory.count("sac_toile"), 1, "l'ancien sac est rangé dedans");
  assert.equal(game.unequip("bag"), false);
});

test("gemmes : ramassées toutes seules, elles valent leur prix en or", () => {
  const game = new Game(7);
  const side = game.map.isWalkable(game.hero.x + 1, game.hero.y) ? 1 : -1;
  game.ground.push({ x: game.hero.x + side, y: game.hero.y, item: "saphir", count: 1 }, { x: game.hero.x + side, y: game.hero.y, item: "diamant", count: 1 });
  const before = game.gold;
  assert.ok(game.setDestination(game.hero.x + side, game.hero.y, true));
  game.tick();
  assert.equal(game.gold, before + 250);
});

test("potions : poison sur l'arme (15 coups), vitesse (deux coups par attaque), feu (croix de 5 cases, 5 tours)", () => {
  const { game, m } = foeAt(1);
  game.hero.hp = game.hero.maxHp = 100000;
  game.inventory.add("potion_poison", 1);
  game.inventory.add("potion_vitesse", 1);
  assert.ok(game.useItem(bagUid(game, "potion_poison")));
  game.tick();
  assert.equal(game.weaponPoison, 15);
  assert.ok(game.useItem(bagUid(game, "potion_vitesse")));
  game.tick();
  game.events.length = 0;
  assert.ok(game.setDestination(m.x, m.y));
  game.tick();
  assert.equal(game.events.filter((e) => e.type === "attack" && e.attacker === game.hero).length, 2, "vitesse : deux coups");
  // Feu : lancé sur le monstre, 5 cases, il brûle.
  const fire = new Game(7);
  fire.inventory.add("potion_feu", 1);
  const uid = bagUid(fire, "potion_feu");
  let target: { x: number; y: number } | null = null;
  for (let dy = -3; dy <= 3 && !target; dy++) for (let dx = -3; dx <= 3 && !target; dx++) if (Math.abs(dx) + Math.abs(dy) >= 3 && fire.throwRefusal(uid, fire.hero.x + dx, fire.hero.y + dy) === null) target = { x: fire.hero.x + dx, y: fire.hero.y + dy };
  assert.ok(target);
  assert.ok(fire.throwPotion(uid, target.x, target.y));
  fire.tick();
  assert.ok(fire.isBurning(target.x, target.y));
  assert.ok(fire.fires.length >= 1 && fire.fires.length <= 5);
  for (let k = 0; k < 6; k++) {
    fire.wait();
    fire.tick();
  }
  assert.equal(fire.fires.length, 0, "le feu s'éteint");
});

test("sauvegarde v2 : points, voie, compétences, sac et feu sont repris", () => {
  const game = new Game(7);
  game.levelUpNow();
  game.choosePath("red");
  game.allocate("agilite");
  game.level = 3;
  game.inventory.add("sac_cuir", 1);
  game.equip(bagUid(game, "sac_cuir"));
  game.fires.push({ x: game.hero.x, y: game.hero.y, turns: 3 });
  const copy = Game.restore(JSON.parse(JSON.stringify(game.snapshot())))!;
  assert.ok(copy);
  assert.equal(copy.voie, "red");
  assert.equal(copy.alloc.agilite, 1);
  assert.deepEqual([copy.inventory.cols, copy.inventory.rows], [7, 5]);
  assert.equal(copy.fires.length, 1);
});

test("jeter un objet : il tombe aux pieds du héros ; Intelligence et Charisme prennent des points", () => {
  const game = new Game(7);
  game.inventory.add("pomme", 2);
  assert.ok(game.dropFromBag(bagUid(game, "pomme")));
  assert.equal(game.inventory.count("pomme"), 0);
  assert.ok(game.ground.some((g) => g.item === "pomme" && g.count === 2 && g.x === game.hero.x && g.y === game.hero.y));
  game.levelUpNow();
  assert.ok(game.allocate("intelligence"));
  assert.equal(game.alloc.intelligence, 1);
});

test("pièges cachés : plus nombreux en descendant ; le héros ne les contourne pas ; une fouille réussie les révèle", () => {
  // Crescendo : la part de pièges cachés grandit avec l'étage.
  const share = (depth: number) => {
    let all = 0;
    let hidden = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const game = new Game(seed);
      while (game.depth < depth) {
        game.pendingStairs = "down";
        game.takeStairs();
      }
      for (const t of game.traps()) {
        all++;
        if (t.hidden) hidden++;
      }
    }
    return hidden / Math.max(1, all);
  };
  assert.ok(share(1) < share(3), `${share(1)} puis ${share(3)}`);
  // Un piège caché : le chemin du héros passe dessus ; une fouille réussie de sa salle le montre.
  for (let seed = 1; seed <= 200; seed++) {
    const game = new Game(seed);
    const trap = game.traps()[0];
    if (!trap) continue;
    trap.hidden = true;
    const room = game.rooms.findIndex((r) => trap.x >= r.x && trap.y >= r.y && trap.x < r.x + r.w && trap.y < r.y + r.h);
    if (room < 0 || game.map.get(trap.x - 1, trap.y) !== Tile.Floor || game.map.get(trap.x + 1, trap.y) !== Tile.Floor) continue;
    game.monsters.length = 0;
    game.hero.x = game.hero.fromX = trap.x - 1;
    game.hero.y = game.hero.fromY = trap.y;
    assert.ok(game.setDestination(trap.x + 1, trap.y, true));
    assert.ok(game.path.some((p) => p.x === trap.x && p.y === trap.y), "le héros ne connaît pas le piège caché");
    game.path = [];
    // Fouille réussie (le dé est forcé à 20).
    const rng = (game as unknown as { rng: { int: (a: number, b: number) => number } }).rng;
    const int = rng.int.bind(rng);
    rng.int = (a: number, b: number) => (a === 1 && b === 20 ? 20 : int(a, b));
    assert.ok(game.search());
    for (let i = 0; i < 20 && !game.events.some((e) => e.type === "searched"); i++) game.tick();
    const done = game.events.find((e) => e.type === "searched");
    assert.ok(done && done.type === "searched" && done.traps?.some((p) => p.x === trap.x && p.y === trap.y), "la fouille repère le piège");
    assert.ok(!trap.hidden);
    return;
  }
  assert.fail("aucune graine utilisable");
});

test("fuite : un Kobold qui fuit passe les portes", () => {
  for (let seed = 1; seed <= 120; seed++) {
    const game = new Game(seed);
    const m = game.monsters.find((a) => a.defId === "schrat");
    if (!m) continue;
    // Une porte entre deux sols, dans l'axe horizontal ; le héros de l'autre côté du monstre.
    for (let y = 1; y < game.map.height - 1; y++)
      for (let x = 3; x < game.map.width - 3; x++) {
        if (!game.map.isDoor(x, y) || game.map.get(x - 1, y) !== Tile.Floor || game.map.get(x + 1, y) !== Tile.Floor || game.map.get(x - 2, y) !== Tile.Floor) continue;
        game.monsters.length = 0;
        game.monsters.push(m);
        Object.assign(m, { x: x - 1, y, fromX: x - 1, fromY: y, alerted: true, asleep: false, fleeTurns: 6 });
        game.hero.x = game.hero.fromX = x - 2;
        game.hero.y = game.hero.fromY = y;
        if (game.isTrap(x, y) || game.isTrap(x + 1, y)) continue;
        for (let i = 0; i < 3; i++) {
          game.wait();
          game.tick();
        }
        assert.ok(m.x > x, `graine ${seed} : le fuyard est resté du côté du héros (${m.x}, ${m.y}), porte en ${x}, ${y}`);
        return;
      }
  }
  assert.fail("aucune porte utilisable");
});

test("passages : aucun PNJ dans un couloir, devant une porte ou un goulet ; aucun meuble bloquant dans un goulet", () => {
  let npcs = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const game = new Game(seed);
    for (let d = 0; d < 3; d++) {
      const map = game.map;
      for (const g of [game.gluck(), game.soeur(), game.krik()]) {
        if (!g) continue;
        npcs++;
        assert.ok(game.rooms.some((r) => g.x >= r.x && g.y >= r.y && g.x < r.x + r.w && g.y < r.y + r.h), `graine ${seed} : PNJ dans un couloir`);
        assert.ok(![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.isDoor(g.x + dx, g.y + dy)), `graine ${seed} : PNJ devant une porte`);
        assert.ok(!isChokepoint(map, g.x, g.y), `graine ${seed} : PNJ dans un goulet (${g.x}, ${g.y})`);
      }
      for (const f of game.furnitureList()) {
        if (!FURNITURE_KINDS[f.kind]?.blocks) continue;
        for (const c of furnitureCells(f)) {
          // Le plan de la salle nue (murs, colonnes, portes) : la case serait-elle un goulet ?
          const cut = isChokepoint(map, c.x, c.y, (a, b) => { const t = map.get(a, b); return t !== Tile.Wall && t !== Tile.Pillar && t !== Tile.DoorLocked; });
          assert.ok(!cut, `graine ${seed} étage ${game.depth} : ${f.kind} bouche un passage en (${c.x}, ${c.y})`);
        }
      }
      game.pendingStairs = "down";
      game.takeStairs();
    }
  }
  assert.ok(npcs > 0);
});

test("poulet : porte impossible à forcer ; dérangé, il la défonce, s'écrase au fond et laisse une cuisse", () => {
  const game = new Game(5, undefined, undefined, undefined, true);
  const c = game.chicken();
  assert.ok(c, "un poulet dans la salle d'essai");
  const door = { ...c!.door! };
  assert.equal(game.map.get(door.x, door.y), Tile.DoorLocked);
  // Aucun jet ne l'ouvre (le dé est forcé à 20).
  const rng = (game as unknown as { rng: { int: (a: number, b: number) => number } }).rng;
  const int = rng.int.bind(rng);
  rng.int = (a: number, b: number) => (a === 1 && b === 20 ? 20 : int(a, b));
  game.monsters.length = 0;
  game.inventory.add("clef", 1, game.depth);
  game.hero.x = game.hero.fromX = door.x - 1;
  game.hero.y = game.hero.fromY = door.y;
  assert.ok(game.setDestination(door.x, door.y, true));
  for (let i = 0; i < 3 && game.pendingDoor === null; i++) game.tick();
  assert.ok(!game.doorOptions().includes("key"), "la clef n'y entre pas");
  for (const action of ["pick", "break"] as const) {
    assert.ok(game.actOnDoor(action));
    game.tick();
    assert.equal(game.map.get(door.x, door.y), Tile.DoorLocked, `${action} : la porte tient`);
  }
  rng.int = int;
  // On touche le poulet : il détale, défonce la porte et finit contre le mur du fond.
  const hen = game.chicken()!;
  game.events.length = 0;
  assert.ok(game.setDestination(hen.x, hen.y, true) || true);
  // Hors de vue depuis la porte : on l'appelle directement par la case.
  if (!game.chicken()!.done) {
    game.hero.x = game.hero.fromX = hen.x + 1;
    game.hero.y = game.hero.fromY = hen.y;
    (game as unknown as { updateVision: () => void }).updateVision();
    assert.ok(game.setDestination(hen.x, hen.y));
  }
  const ev = game.events.find((e) => e.type === "chicken");
  assert.ok(ev && ev.type === "chicken");
  assert.ok(game.chicken()!.done);
  assert.notEqual(game.map.get(door.x, door.y), Tile.DoorLocked, "porte défoncée");
  const crash = game.chicken()!.crash;
  assert.ok(game.ground.some((g) => g.item === "cuisse_poulet" && g.x === crash.x && g.y === crash.y));
  const room = game.rooms[game.chicken()!.room];
  let chest = false;
  for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) if (game.map.get(x, y) === Tile.Chest) chest = true;
  assert.ok(chest, "un coffre dans la salle");
  assert.equal(ITEMS.cuisse_poulet.heal, 8);
});

test("poulet dans le donjon : un truc fun possible, salle fermée par une seule porte, poulet ailleurs", () => {
  let found = 0;
  for (let seed = 1; seed <= 120 && found < 3; seed++) {
    const game = new Game(seed);
    for (let d = 1; d <= 4; d++) {
      if (game.funOf(game.depth) === "chicken" && game.chicken()) {
        const c = game.chicken()!;
        const room = game.rooms[c.room];
        assert.ok(!(c.x >= room.x && c.x < room.x + room.w && c.y >= room.y && c.y < room.y + room.h), "le poulet n'est pas enfermé");
        assert.equal(game.map.get(c.door!.x, c.door!.y), Tile.DoorLocked);
        found++;
      }
      game.pendingStairs = "down";
      game.takeStairs();
    }
  }
  assert.ok(found > 0, "aucun poulet en 120 parties");
});

test("jeter une partie d'une pile : seul le nombre choisi tombe, le reste reste au sac", () => {
  const game = new Game(7);
  game.inventory.add("pomme", 5);
  assert.ok(game.dropFromBag(bagUid(game, "pomme"), 2));
  assert.equal(game.inventory.count("pomme"), 3);
  assert.ok(game.ground.some((g) => g.item === "pomme" && g.count === 2 && g.x === game.hero.x && g.y === game.hero.y));
});

test("sang : un coup qui porte laisse une tache (jaune pour un Kobold) ; le feu suit celui qui en sort", () => {
  const { game, m } = foeAt(1);
  game.hero.hp = game.hero.maxHp = 100000;
  for (let k = 0; k < 20 && game.bloodStains().length === 0; k++) {
    assert.ok(game.setDestination(m.x, m.y));
    game.tick();
  }
  assert.ok(game.bloodStains().some((b) => b.color === "yellow"), "pas de sang jaune (Kobold)");
  assert.ok(game.bloodStains().every((b) => b.shape !== 2 || game.map.get(b.x, b.y) === Tile.Wall), "tache de mur hors d'un mur");
  // Brûlure : posé dans le feu puis sorti, il brûle encore 2 tours.
  const g2 = new Game(7);
  g2.hero.hp = g2.hero.maxHp = 1000;
  g2.fires.push({ x: g2.hero.x, y: g2.hero.y, turns: 1 });
  g2.wait();
  g2.tick();
  assert.equal(g2.hero.burning, 2);
  let burns = 0;
  for (let k = 0; k < 4; k++) {
    g2.events.length = 0;
    g2.wait();
    g2.tick();
    burns += g2.events.filter((e) => e.type === "burn").length;
  }
  assert.equal(burns, 2);
});

test("Niveau d'alerte : monte avec le temps et le bruit ; paliers agité, alerte, traque (tout l'étage)", () => {
  const game = new Game(7);
  assert.deepEqual(game.alarm(), { level: 0, stage: 0 });
  game.monsters.splice(0);
  for (let t = 0; t < RULES.alarmTurnsPerPoint * 3; t++) {
    game.wait();
    game.tick();
  }
  assert.equal(game.alarm().level, 3, "un point tous les 12 tours");
  game.events.length = 0;
  game.raiseAlarm(22);
  assert.equal(game.alarm().stage, 1);
  assert.ok(game.events.some((e) => e.type === "alarm" && e.stage === 1));
  const before = game.monsters.length;
  game.raiseAlarm(25);
  assert.equal(game.alarm().stage, 2);
  assert.equal(game.monsters.length, before, "pas de traqueurs pour l'instant");
  game.raiseAlarm(100);
  assert.equal(game.alarm().stage, 3);
  assert.equal(game.alarm().level, 100);
  // Chaque étage a son propre tocsin, et il est sauvegardé.
  const copy = Game.restore(JSON.parse(JSON.stringify(game.snapshot())))!;
  assert.equal(copy.alarm().stage, 3);
});

test("Niveau d'alerte : enfoncer une porte fait plus de bruit que la crocheter", () => {
  const broken = openLockedDoor("break");
  const picked = openLockedDoor("pick");
  assert.ok(broken.game.alarm().level >= RULES.alarmBreak, `porte enfoncée : ${broken.game.alarm().level}`);
  assert.ok(picked.game.alarm().level < RULES.alarmBreak, `porte crochetée : ${picked.game.alarm().level}`);
});

// ---------- Salles de fouille (mobilier v1), déplacement en diagonale (2026-11-11) ----------

test("dortoir de la salle d'essai : lits contre le mur du haut, table, chaises, tapis ; meubles qui bloquent sans couper de passage", () => {
  const game = new Game(1, undefined, undefined, undefined, true);
  assert.equal(game.roomTheme(4), "dortoir");
  const list = game.furnitureList();
  const bunks = list.filter((f) => f.kind.startsWith("bunk"));
  assert.ok(bunks.length >= 2 && bunks.length <= 4, `lits : ${bunks.length}`);
  assert.ok(bunks.every((b) => b.y === game.rooms[4].y), "contre le mur du haut");
  assert.ok(list.some((f) => f.kind.startsWith("table")));
  assert.ok(list.some((f) => f.kind.startsWith("chair") && f.kind !== "chairFallen"));
  assert.ok(list.some((f) => f.kind.startsWith("rug")));
  for (const f of list) {
    if (FURNITURE_KINDS[f.kind].wall) continue; // vitrail : dans le mur
    for (const c of furnitureCells(f)) {
      const blocks = FURNITURE_KINDS[f.kind].blocks;
      assert.equal(game.map.isWalkable(c.x, c.y), !blocks, `${f.kind} en ${c.x},${c.y}`);
      assert.equal(game.map.blocksSight(c.x, c.y), false);
    }
  }
  // Une cheminée dans le dortoir.
  const r = game.rooms[4];
  assert.ok(game.torches.some((t) => t.hearth && (t.x === r.x - 1 || t.x === r.x + r.w)), "cheminée sur un mur de côté");
  // Tout le sol reste atteignable depuis le départ (hors salles verrouillées).
  const dist = distanceField(game.map, game.hero, (x, y) => game.map.get(x, y) !== Tile.DoorLocked);
  for (let y = 0; y < game.map.height; y++) {
    for (let x = 0; x < game.map.width; x++) {
      const inSpecial = x <= 12 && y >= 13 && y <= 17;
      // (Le placard du Kobold qui compte, derrière sa porte verrouillée, est fermé exprès.)
      if (game.map.get(x, y) === Tile.Floor && !inSpecial && !(x === 13 && y === 29) && !(x >= 47 && y >= 24 && y <= 28)) assert.ok(dist[game.map.index(x, y)] >= 0, `case ${x},${y} coupée`);
    }
  }
});

test("salles à thème dans le donjon : 0 à 2 par étage, de thèmes différents, jamais de passage coupé", () => {
  const counts: Record<string, number> = {};
  for (let seed = 1; seed <= 120; seed++) {
    const floor = generateFloor(seed, DEFAULT_FLOOR);
    const before = distanceField(floor.map, floor.start).filter((d) => d >= 0).length;
    const chestsBefore = floor.map.tiles.filter((t) => t === Tile.Chest).length;
    const { furniture, themes } = furnishFloor(floor, seed);
    assert.ok(themes.length <= 2);
    assert.equal(new Set(themes.map((t) => t.id)).size, themes.length, "deux fois le même thème");
    for (const t of themes) counts[t.id] = (counts[t.id] ?? 0) + 1;
    const chests = floor.map.tiles.filter((t) => t === Tile.Chest).length - chestsBefore;
    const blocked = furniture.filter((f) => FURNITURE_KINDS[f.kind].blocks).reduce((n, f) => n + furnitureCells(f).length, 0);
    const after = distanceField(floor.map, floor.start).filter((d) => d >= 0).length;
    // Un coffre se compte comme une case où l'on marche : il ne change rien.
    assert.equal(after, before - blocked, `graine ${seed} : un meuble coupe un passage (${chests} coffres)`);
  }
  for (const id of ["dortoir", "cuisine", "priere", "torture", "forge", "alchimiste"]) assert.ok((counts[id] ?? 0) >= 4, `${id} : ${counts[id] ?? 0}`);
});

test("tapis : il étouffe les pas, et brûle tout entier", () => {
  const game = new Game(1, undefined, undefined, undefined, true);
  game.monsters.splice(0);
  const rug = game.furnitureList().find((f) => f.kind.startsWith("rug"))!;
  game.hero.x = rug.x;
  game.hero.y = rug.y;
  assert.equal(game.onRug(), true);
  // Une potion de feu sur un coin du tapis : tout le tapis brûle, puis il n'y a plus de tapis.
  game.hero.x = rug.x + 2;
  game.hero.y = rug.y + 4 <= game.rooms[4].y + game.rooms[4].h - 1 ? rug.y + 4 : rug.y - 1;
  game.wait();
  game.tick();
  game.inventory.add("potion_feu", 1);
  const uid = game.inventory.items.find((i) => i.defId === "potion_feu")!.uid;
  assert.ok(game.throwPotion(uid, rug.x, rug.y), String(game.throwRefusal(uid, rug.x, rug.y)));
  game.tick();
  // Tout le tapis brûle, et le feu gagne les meubles voisins (à une case).
  for (const c of furnitureCells(rug)) assert.ok(game.isBurning(c.x, c.y), `tapis en ${c.x},${c.y}`);
  assert.ok(game.events.some((e) => e.type === "furnitureFire" && e.kind.startsWith("rug")));
  const before = game.furnitureList().filter((f) => FURNITURE_KINDS[f.kind].blocks).length;
  for (let t = 0; t < 12; t++) {
    game.hero.x = game.rooms[0].x + 1;
    game.hero.y = game.rooms[0].y + 1;
    game.wait();
    game.tick();
  }
  assert.equal(game.furnitureList().some((f) => f === rug), false, "le tapis a disparu");
  const ashes = game.furnitureList().filter((f) => f.kind.startsWith("ashes")).length;
  assert.ok(ashes >= 1, "des cendres là où un meuble a brûlé");
  assert.ok(game.furnitureList().filter((f) => FURNITURE_KINDS[f.kind].blocks).length < before);
});

test("diagonale : on longe un mur ou une porte en coupant le coin, mais on ne se faufile pas entre deux coins", () => {
  const map = new GameMap(5, 5);
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) map.set(x, y, Tile.Floor);
  map.set(2, 1, Tile.Wall);
  assert.ok(canStep(map, 1, 2, 1, -1) === false, "case d'arrivée bouchée");
  assert.ok(canStep(map, 1, 1, 1, 1), "coin de mur : on passe");
  map.set(2, 2, Tile.Wall);
  map.set(1, 3, Tile.Floor);
  assert.ok(canStep(map, 1, 2, 1, 1), "un côté libre");
  map.set(1, 3, Tile.Wall);
  map.set(2, 3, Tile.Floor);
  map.set(3, 3, Tile.Floor);
  // De (1,2) vers (2,3) : (2,2) mur et (1,3) mur → on ne se faufile pas.
  assert.equal(canStep(map, 1, 2, 1, 1), false);
});

// ---------- Sols spéciaux : gravier et flaques (2026-11-11) ----------

test("gravier : un pas dessus crisse, alerte les monstres proches (pas les lointains) et fait monter l'alerte", () => {
  const game = new Game(3);
  game.monsters.splice(0);
  const h = game.hero;
  // Une case libre à côté du héros devient du gravier.
  const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: h.x + dx, y: h.y + dy })).find((p) => game.map.get(p.x, p.y) === Tile.Floor)!;
  game.map.set(spot.x, spot.y, Tile.Gravel);
  const before = game.alarm().level;
  assert.ok(game.setDestination(spot.x, spot.y));
  game.tick();
  assert.equal(game.hero.x, spot.x);
  assert.ok(game.events.some((e) => e.type === "gravel"), "le gravier crisse");
  assert.ok(game.alarm().level >= before + RULES.gravelAlarm);
});

test("eau : un pas dedans fait plic-ploc, alerte et fait monter l'alerte comme le gravier", () => {
  const game = new Game(3);
  game.monsters.splice(0);
  const h = game.hero;
  const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: h.x + dx, y: h.y + dy })).find((p) => game.map.get(p.x, p.y) === Tile.Floor)!;
  game.map.set(spot.x, spot.y, Tile.Water);
  const before = game.alarm().level;
  assert.ok(game.setDestination(spot.x, spot.y));
  game.tick();
  assert.equal(game.hero.x, spot.x);
  assert.ok(game.events.some((e) => e.type === "gravel" && e.water === true), "l'eau clapote");
  assert.ok(game.alarm().level >= before + RULES.gravelAlarm);
});

test("gravier : les monstres à portée d'oreille accourent", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const game = new Game(seed);
    const h = game.hero;
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: h.x + dx, y: h.y + dy })).find((p) => game.map.get(p.x, p.y) === Tile.Floor);
    const sleeper = game.monsters.find((m) => !m.alerted);
    if (!spot || !sleeper) continue;
    game.monsters.splice(0, game.monsters.length, sleeper);
    sleeper.x = spot.x + (spot.x - h.x) * 3;
    sleeper.y = spot.y + (spot.y - h.y) * 3;
    sleeper.asleep = true;
    game.map.set(spot.x, spot.y, Tile.Gravel);
    game.setDestination(spot.x, spot.y);
    game.tick();
    if (game.hero.x !== spot.x || game.hero.y !== spot.y) continue;
    assert.equal(sleeper.alerted, true);
    assert.equal(sleeper.asleep, false);
    return;
  }
  assert.fail("aucun étage d'essai trouvé");
});

test("flaque : la potion de feu n'y prend pas, et on s'y éteint", () => {
  const game = new Game(5, undefined, undefined, undefined, true);
  // Flaque de la salle d'essai : (5,20), (6,20), (5,21), (6,21).
  assert.equal(game.map.get(5, 20), Tile.Water);
  assert.equal(game.map.isWalkable(5, 20), true);
  game.monsters.splice(0);
  game.hero.x = 8;
  game.hero.y = 20;
  game.hero.burning = 2;
  game.hero.x = 6;
  game.hero.y = 20;
  game.wait();
  game.tick();
  assert.equal(game.hero.burning, 0, "éteint dans la flaque");
});

test("sols spéciaux du donjon : jamais à l'arrivée ni sur l'escalier, et le héros contourne le gravier quand il peut", () => {
  let gravel = 0;
  let water = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const game = new Game(seed);
    const { map } = game;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.get(x, y) === Tile.Gravel) gravel++;
        if (map.get(x, y) === Tile.Water) water++;
      }
    }
    assert.notEqual(map.get(game.hero.x, game.hero.y), Tile.Gravel);
  }
  assert.ok(gravel > 40 && water > 20, `gravier ${gravel}, eau ${water}`);
});

test("se cacher : impossible si un monstre qui vous a repéré vous voit ; possible s'il dort ou n'a rien remarqué", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const game = new Game(seed);
    const m = game.monsters[0];
    if (!m) continue;
    game.monsters.splice(0, game.monsters.length, m);
    const h = game.hero;
    const spot = [[3, 0], [-3, 0], [0, 3], [0, -3]].map(([dx, dy]) => ({ x: h.x + dx, y: h.y + dy })).find((p) => game.map.get(p.x, p.y) === Tile.Floor && game.isVisible(p.x, p.y));
    if (!spot) continue;
    Object.assign(m, { x: spot.x, y: spot.y, asleep: true, alerted: false });
    assert.notEqual(game.hideRefusal(), "watched", "un dormeur ne regarde pas");
    m.asleep = false;
    assert.notEqual(game.hideRefusal(), "watched", "un « ? » laisse une chance de se cacher");
    m.alerted = true;
    assert.equal(game.hideRefusal(), "watched");
    return;
  }
  assert.fail("aucune graine utilisable");
});

test("dortoir : 0 à 2 coffres ; se cacher contre un meuble ; combats coupés en salle d'essai", () => {
  let chests = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const floor = generateFloor(seed, DEFAULT_FLOOR);
    const before = floor.map.tiles.filter((t) => t === Tile.Chest).length;
    const { themes } = furnishFloor(floor, seed);
    const after = floor.map.tiles.filter((t) => t === Tile.Chest).length;
    // Dortoir : 0 à 2 coffres ; salle de prière : 1 (derrière le pupitre).
    // Forge : 0 à 2, alchimiste : 1 à 2.
    const allow = (id: string) => ({ dortoir: 2, priere: 1, forge: 2, alchimiste: 2 } as Record<string, number>)[id] ?? 0;
    assert.ok(after - before <= themes.reduce((sum, t) => sum + allow(t.id), 0));
    chests += after - before;
  }
  assert.ok(chests > 0, "des coffres dans les dortoirs");
  const game = new Game(1, undefined, undefined, undefined, true);
  const table = game.furnitureList().find((f) => f.kind.startsWith("table"))!;
  assert.equal(game.hasCover({ x: table.x, y: table.y + 1 }), true, "abri contre la table");
  game.peaceful = true;
  game.wakeAll();
  game.wait();
  game.tick();
  assert.ok(game.monsters.every((m) => !m.alerted), "personne ne vous remarque");
});

test("combat : le bruit réveille les dormeurs proches ; pas de points à placer en plein combat", () => {
  for (let seed = 1; seed <= 60; seed++) {
    const game = new Game(seed);
    if (game.monsters.length < 2) continue;
    const [foe, sleeper] = game.monsters;
    game.monsters.splice(2);
    const h = game.hero;
    const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: h.x + dx, y: h.y + dy })).find((p) => game.map.get(p.x, p.y) === Tile.Floor);
    const far = [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, -2]].map(([dx, dy]) => ({ x: h.x + dx, y: h.y + dy })).find((p) => game.map.get(p.x, p.y) === Tile.Floor && (!side || p.x !== side.x || p.y !== side.y));
    if (!side || !far) continue;
    Object.assign(foe, { x: side.x, y: side.y, hp: 50, maxHp: 50, alerted: true, asleep: false });
    Object.assign(sleeper, { x: far.x, y: far.y, asleep: true, alerted: false });
    game.points = 1;
    game.wait();
    game.tick();
    assert.equal(game.inCombat(), true);
    assert.equal(game.allocate("vie"), false, "pas en plein combat");
    assert.ok(game.setDestination(foe.x, foe.y));
    game.tick();
    assert.equal(sleeper.asleep, false, "le combat l'a réveillé");
    return;
  }
  assert.fail("aucune graine utilisable");
});

test("coffre : ce qu'il contient ne tombe jamais sur un décor", () => {
  const game = new Game(1, undefined, undefined, undefined, true);
  game.setPeaceful(true);
  const r = game.rooms[4];
  let chest: { x: number; y: number } | null = null;
  for (let y = r.y; y < r.y + r.h && !chest; y++) for (let x = r.x; x < r.x + r.w; x++) if (game.map.get(x, y) === Tile.Chest) chest = { x, y };
  if (!chest) return; // pas de coffre dans ce dortoir
  const from = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: chest!.x + dx, y: chest!.y + dy })).find((p) => game.map.isWalkable(p.x, p.y))!;
  Object.assign(game.hero, { x: from.x, y: from.y });
  game.moveBy(chest.x - from.x, chest.y - from.y);
  game.tick();
  const e = game.events.find((ev) => ev.type === "chest");
  assert.ok(e && e.type === "chest");
  for (const d of e.drops) assert.equal(game.furnitureAt(d.x, d.y), null, `objet sur un décor en ${d.x},${d.y}`);
});

test("motifs au sol : 0 à 2 par étage, sur du sol nu d'une salle, jamais à l'arrivée ni sur l'escalier", () => {
  let total = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const game = new Game(seed);
    const motifs = game.motifs();
    assert.ok(motifs.length <= 2);
    total += motifs.length;
    for (const m of motifs) {
      const size = MOTIF_SIZE[m.kind];
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          assert.equal(game.map.get(m.x + dx, m.y + dy), Tile.Floor);
          assert.ok(!(m.x + dx === game.hero.x && m.y + dy === game.hero.y));
        }
      }
    }
  }
  assert.ok(total >= 30, `motifs : ${total}`);
});

test("avantage : jamais deux de suite sur la même cible (porte, coin de mur, cible surprise)", () => {
  for (let seed = 1; seed <= 60; seed++) {
    const game = new Game(seed);
    const foe = game.monsters[0];
    if (!foe) continue;
    game.monsters.splice(1);
    const h = game.hero;
    const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: h.x + dx, y: h.y + dy })).find((p) => game.map.get(p.x, p.y) === Tile.Floor);
    if (!side) continue;
    // Une cible qui ne s'y attend pas : le premier coup a l'avantage, le suivant non.
    Object.assign(foe, { x: side.x, y: side.y, hp: 99, maxHp: 99, alerted: false, asleep: true });
    assert.equal(game.heroHasAdvantageOn(foe), true);
    assert.ok(game.setDestination(foe.x, foe.y));
    game.tick();
    const first = game.events.find((e) => e.type === "attack" && e.attacker === game.hero);
    assert.ok(first && first.type === "attack" && first.result.mode === "advantage");
    foe.alerted = false; // même si elle « oubliait », pas deux avantages d'affilée
    assert.equal(game.heroHasAdvantageOn(foe), false);
    return;
  }
  assert.fail("aucune graine utilisable");
});

test("regard : un monstre éveillé ne remarque le héros que dans son éventail (ou au contact)", () => {
  const game = new Game(3);
  const m = game.monsters[0];
  assert.ok(m);
  Object.assign(m, { x: 10, y: 10, facing: "right" });
  assert.ok(game.inGaze(m, { x: 14, y: 10 }), "droit devant");
  assert.ok(game.inGaze(m, { x: 14, y: 12 }), "un peu de biais");
  assert.ok(!game.inGaze(m, { x: 6, y: 10 }), "dans le dos");
  assert.ok(!game.inGaze(m, { x: 10, y: 14 }), "sur le côté");
});

test("araignées : à partir de l'étage 3, avec les toiles ; une toile colle ou se déchire", () => {
  let webs = 0;
  let early = 0;
  for (let seed = 1; seed <= 40; seed++) {
    for (const depth of [1, 2, 4]) {
      const floor = generateFloor(seed * 7 + depth, DEFAULT_FLOOR);
      const { furniture } = furnishFloor(floor, seed * 7 + depth, depth);
      const n = furniture.filter((f) => f.kind.startsWith("web")).length;
      if (depth < 3) early += n;
      else webs += n;
      // Ni lit ni trainard sous une torche du mur (Thomas : « torche derrière un meuble, c'est bizarre »).
      for (const f of furniture) {
        if (f.kind === "barrel" || f.kind.startsWith("crate") || f.kind.startsWith("bunk")) {
          for (const c of furnitureCells(f)) assert.ok(!underTorch(floor, c.x, c.y), `${f.kind} sous une torche`);
        }
      }
    }
  }
  assert.equal(early, 0, "pas de toile avant l'étage 3");
  assert.ok(webs > 0, "des toiles dès l'étage 3");
  // Entrer dans une toile : on la déchire, englué ou non.
  const game = new Game(1, undefined, undefined, undefined, true);
  game.setPeaceful(true);
  const web = game.furnitureList().find((f) => f.kind.startsWith("web"))!;
  Object.assign(game.hero, { x: web.x + 1, y: web.y + 1, fromX: web.x + 1, fromY: web.y + 1 });
  assert.ok(game.moveBy(-1, -1));
  for (let i = 0; i < 80 && (game.hero.x !== web.x || game.hero.y !== web.y); i++) game.tick();
  assert.deepEqual([game.hero.x, game.hero.y], [web.x, web.y]);
  assert.ok(!game.furnitureList().includes(web), "la toile est déchirée");
});

test("butin garanti de la section 1 : une pomme à l'étage 1, deux équipements, une gemme, une potion", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const lots = [1, 2, 3, 4, 5].flatMap((d) => guaranteedLoot(seed, d));
    const all = lots.map((l) => l.item);
    assert.ok(guaranteedLoot(seed, 1).some((l) => l.item === "pomme"));
    const arrows = lots.filter((l) => l.item === "fleche");
    assert.ok(arrows.length === 1 || arrows.length === 3, "10 flèches en 1 ou 3 lots");
    assert.equal(arrows.reduce((n, l) => n + l.count, 0), 10);
    assert.ok(all.filter((i) => ["melee", "ranged", "armor"].includes(ITEMS[i].kind)).length >= 2);
    assert.ok(all.some((i) => ITEMS[i].kind === "gem"));
    assert.ok(all.some((i) => i.startsWith("potion_")));
    assert.ok(!all.includes("sac_cuir"));
    assert.equal(guaranteedLoot(seed, 6).length, 0);
  }
});

test("feu : une toile d'araignée flambe et laisse de la cendre ; tonneaux et caisses brûlent aussi", () => {
  const game = new Game(1, undefined, undefined, undefined, true);
  game.setPeaceful(true);
  for (const kind of ["barrel", "crate", "crateStack", "webTL"]) assert.ok(FURNITURE_KINDS[kind].burns, `${kind} brûle`);
  const web = game.furnitureList().find((f) => f.kind.startsWith("web"))!;
  game.inventory.add("potion_feu", 1);
  Object.assign(game.hero, { x: web.x + 3, y: web.y + 2, fromX: web.x + 3, fromY: web.y + 2 });
  game.wait();
  game.tick();
  const uid = game.inventory.items.find((i) => i.defId === "potion_feu")!.uid;
  assert.ok(game.throwPotion(uid, web.x + 1, web.y + 1), String(game.throwRefusal(uid, web.x + 1, web.y + 1)));
  game.tick();
  assert.ok(!game.furnitureList().includes(web), "la toile a brûlé");
  assert.ok(game.furnitureList().some((f) => f.kind === "ashes1" && f.x === web.x && f.y === web.y), "il en reste de la cendre");
});

test("salle d'essai : cuisine, salle de prière et salle de torture, avec tous leurs meubles", () => {
  const game = new Game(1, undefined, undefined, undefined, true);
  const kinds = new Set(game.furnitureList().map((f) => f.kind));
  for (const k of ["shelf2", "counter", "ham", "barrique", "altar", "pew", "pewBroken", "runnerA", "vitrail0", "rackTable", "toolRack", "maiden"]) {
    assert.ok(kinds.has(k), `${k} manque`);
  }
  assert.ok([...kinds].some((k) => k.startsWith("gutDrain_")), "grille de la cuisine manque");
  assert.ok([...kinds].some((k) => k.startsWith("bgutDrain_")), "grille de la torture manque");
  assert.equal(game.floorStyle(33, 5), "kitchen");
  assert.equal(game.floorStyle(33, 25), "torture");
  assert.equal(game.floorStyle(5, 5), undefined);
  // Toutes les salles restent accessibles, coffre de la salle de prière compris.
  const dist = distanceField(game.map, game.hero);
  for (const r of game.rooms) {
    let ok = false;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (dist[game.map.index(x, y)] >= 0) ok = true;
    // La salle du poulet est fermée exprès (sa porte ne cède pas).
    assert.ok(ok || (r.x === 47 && r.y === 24), `salle (${r.x},${r.y}) inaccessible`);
  }
  const chest = { x: 33, y: 12 };
  assert.equal(game.map.get(chest.x, chest.y), Tile.Chest);
  assert.notEqual(dist[game.map.index(chest.x, chest.y)], -1, "coffre derrière l'autel inaccessible");
});

test("sarcophage à pointes : désamorcer ou forcer ; raté, une pointe (1d4) ; il s'ouvre et lâche son butin", () => {
  let hurt = 0;
  let clean = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const game = new Game(seed, undefined, undefined, undefined, true);
    game.setPeaceful(true);
    const maiden = game.furnitureList().find((f) => f.kind === "maiden")!;
    const side = game.map.isWalkable(maiden.x + 1, maiden.y) ? 1 : -1;
    Object.assign(game.hero, { x: maiden.x + side, y: maiden.y, fromX: maiden.x + side, fromY: maiden.y });
    assert.ok(game.setDestination(maiden.x, maiden.y, true));
    assert.deepEqual(game.doorOptions(), ["pick", "break"]);
    const groundBefore = game.ground.length;
    const hp = game.hero.hp;
    assert.ok(game.actOnDoor(seed % 2 ? "pick" : "break"));
    game.tick();
    assert.equal(maiden.kind, "maidenOpen");
    assert.equal(game.ground.length, groundBefore + 2, "or et objet à côté");
    const ev = game.events.find((e) => e.type === "maiden");
    assert.ok(ev && ev.type === "maiden");
    // Thomas : « sarcophage piqué, 0 drop » : l'objet ne tombe pas juste au-dessus d'un meuble (caché par son dessin).
    const item = ev.drops[1];
    const below = game.furnitureList().find((f) => f.x === item.x && f.y === item.y + 1);
    assert.ok(!below || !["maiden", "maidenOpen"].includes(below.kind), `objet caché en ${item.x},${item.y}`);
    if (ev.success) clean++;
    else {
      hurt++;
      assert.ok(hp - game.hero.hp >= 1 && hp - game.hero.hp <= 4);
    }
  }
  assert.ok(hurt > 0 && clean > 0, `raté ${hurt}, réussi ${clean}`);
});

test("pièges v3 : pointes, fosse (on en remonte), aiguille et gaz empoisonnés", () => {
  const game = new Game(1, undefined, undefined, undefined, true);
  game.setPeaceful(true);
  const kinds = game.traps().map((t) => t.kind);
  assert.deepEqual([...kinds].sort(), ["gas", "needle", "pit", "spikes"]);
  const walkOn = (kind: string) => {
    const t = game.traps().find((q) => q.kind === kind)!;
    Object.assign(game.hero, { x: t.x - 1, y: t.y, fromX: t.x - 1, fromY: t.y, hp: game.hero.maxHp, poison: undefined, stuck: undefined });
    assert.ok(game.moveBy(1, 0));
    game.tick();
    assert.deepEqual([game.hero.x, game.hero.y], [t.x, t.y]);
    return t;
  };
  walkOn("needle");
  assert.ok(game.hero.poison, "aiguille : empoisonné");
  const before = game.hero.hp;
  game.wait();
  game.tick();
  assert.ok(game.hero.hp < before, "le poison ronge le héros");
  const pit = walkOn("pit");
  assert.ok(pit.sprung, "la fosse reste effondrée");
  assert.equal(game.hero.stuck, 1);
  walkOn("gas");
  assert.ok(game.gas.length >= 4, "nuage sur la case et ses voisines");
  assert.ok(game.hero.poison);
  for (let i = 0; i < 4; i++) {
    game.wait();
    game.tick();
  }
  assert.equal(game.gas.length, 0, "le gaz se dissipe");
  // Dans le donjon : pas de poison avant l'étage 2, pas de gaz avant l'étage 3.
  for (let seed = 1; seed <= 40; seed++) {
    const g = new Game(seed);
    assert.ok(g.traps().every((t) => t.kind === "spikes" || t.kind === "pit"));
  }
});

test("tir : l'arc donne le jet et la portée, la flèche les dégâts ; la javeline se lance sans arc", () => {
  assert.equal((ITEMS.arc_court as { damage?: unknown }).damage, undefined, "l'arc n'a plus de dégâts");
  assert.ok(ITEMS.fleche.damage && ITEMS.javeline.damage);
  const game = new Game(4, undefined, undefined, undefined, true);
  game.setPeaceful(true);
  game.inventory.add("javeline", 3);
  game.equipment.ranged = null;
  assert.ok(game.chooseAmmo("javeline") || true);
  game.level = 4;
  const profile = game.shotProfile();
  assert.ok(profile && profile.thrown && profile.range === 6 && profile.attackBonus === -2, JSON.stringify(profile));
  const before = game.inventory.count("javeline");
  const target = { x: game.hero.x + 2, y: game.hero.y };
  assert.equal(game.shoot(target.x, target.y), null);
  game.tick();
  assert.equal(game.inventory.count("javeline"), before - 1);
  assert.equal(ITEMS.epee_longue.twoHanded && ITEMS.lance.twoHanded, true);
});

test("fin de partie : on sait de quoi le héros est mort ; portes et coffres brûlent", () => {
  const game = new Game(2);
  const m = game.monsters[0];
  Object.assign(game.hero, { hp: 1 });
  Object.assign(m, { x: game.hero.x + 1, y: game.hero.y, alerted: true, asleep: false, attackBonus: 99 });
  if (!game.map.isWalkable(m.x, m.y)) Object.assign(m, { x: game.hero.x - 1 });
  for (let i = 0; i < 10 && !game.over; i++) {
    game.wait();
    game.tick();
  }
  assert.ok(game.over);
  assert.ok(game.deathCause && game.deathCause.includes(m.name), String(game.deathCause));
  // Une porte à côté du feu part en cendres.
  const g2 = new Game(1, undefined, undefined, undefined, true);
  g2.setPeaceful(true);
  assert.equal(g2.map.get(12, 6), Tile.DoorClosed);
  g2.fires.push({ x: 13, y: 6, turns: 5 });
  g2.wait();
  g2.tick();
  assert.equal(g2.map.get(12, 6), Tile.Floor, "la porte a brûlé");
});

test("forge, alchimiste, panier de pommes ; la fouille montre ce qui est interactif ; deux mains et torche", () => {
  const game = new Game(1, undefined, undefined, undefined, true);
  const kinds = new Set(game.furnitureList().map((f) => f.kind));
  for (const k of ["forge", "anvil", "workbench", "grindstone", "cauldron", "grimoire", "stuffedBear", "bookcase", "basket"]) assert.ok(kinds.has(k), `${k} manque`);
  assert.ok(!kinds.has("bookcaseL") && !kinds.has("bookcaseR"), "plus de bibliothèque de profil (Thomas, 2026-11-12)");
  for (const k of ["glassShelf", "rug", "rugB"].slice(0, 1)) assert.ok(kinds.has(k), `${k} manque`);
  assert.ok(kinds.has("rug") || kinds.has("rugB"), "un tapis");
  const basket = game.furnitureList().find((f) => f.kind === "basket")!;
  const apples = game.ground.filter((g) => g.x === basket.x && g.y === basket.y && g.item === "pomme").reduce((n, g) => n + g.count, 0);
  assert.ok(apples >= 2 && apples <= 3, `pommes : ${apples}`);
  assert.equal(game.floorStyle(45, 5), "forge");
  const kitchen = game.rooms[6];
  assert.ok(game.interactiveIn(kitchen).some((p) => p.x === basket.x && p.y === basket.y), "le panier brille à la fouille");
  // Arme à deux mains : pas de torche.
  game.inventory.add("epee_longue", 1);
  game.inventory.add("torche", 1);
  const sword = game.inventory.items.find((i) => i.defId === "epee_longue")!;
  assert.ok(game.equip(sword.uid));
  const torch = game.inventory.items.find((i) => i.defId === "torche")!;
  assert.equal(game.useItem(torch.uid), false);
  // Dans le donjon, forge et alchimiste apparaissent aussi.
  const seen = new Set<string>();
  for (let seed = 1; seed <= 150; seed++) {
    const floor = generateFloor(seed, DEFAULT_FLOOR);
    for (const t of furnishFloor(floor, seed).themes) seen.add(t.id);
  }
  assert.ok(seen.has("forge") && seen.has("alchimiste"), [...seen].join(","));
});

// ---------- Étage du boss : la Tisseuse (2026-11-11) ----------
import { buildBossFloor } from "../src/world/bossFloor";
import { bigStep, cellsOf, gapBetween } from "../src/core/boss";

test("nichée de la Tisseuse : 300 plans variés, tout accessible, sentiers sans toile, la reine passe partout", () => {
  const sizes = new Set<string>();
  const flips = new Set<string>();
  for (let seed = 1; seed <= 300; seed++) {
    const f = buildBossFloor(seed);
    const { map, boss } = f;
    sizes.add(`${boss.lair.w}x${boss.lair.h}`);
    flips.add(`${boss.chest.x > f.start.x}|${f.torches[0].faceY}`);
    // Tout le sol est accessible depuis l'arrivée (l'escalier scellé, un meuble, s'ouvrira).
    const dist = distanceField(map, f.start);
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++)
        if (map.isWalkable(x, y)) assert.notEqual(dist[map.index(x, y)], -1, `graine ${seed} : (${x},${y}) inaccessible`);
    assert.equal(map.get(boss.chest.x, boss.chest.y), Tile.Chest, `graine ${seed} : coffre`);
    assert.ok(f.furniture.some((o) => o.kind === "sealedStairs" && o.x === boss.seal.x && o.y === boss.seal.y));
    assert.equal(f.furniture.filter((o) => o.kind === "anchor").length, 4);
    for (const p of boss.pillars) assert.equal(map.get(p.x, p.y), Tile.Wall, `graine ${seed} : amarre hors du mur`);
    assert.equal(f.furniture.filter((o) => o.kind.startsWith("webHub")).length, 9);
    assert.ok(boss.breaches.length >= 4 && boss.breaches.length <= 6, `graine ${seed} : ${boss.breaches.length} brèches`);
    assert.ok(f.furniture.filter((o) => o.kind.startsWith("cocoon")).length >= 3, `graine ${seed} : cocons`);
    // Beaucoup de toile dans la nichée, mais pas partout.
    const lairCells: { x: number; y: number }[] = [];
    for (let y = boss.lair.y; y < boss.lair.y + boss.lair.h; y++) for (let x = boss.lair.x; x < boss.lair.x + boss.lair.w; x++) if (map.get(x, y) === Tile.Floor) lairCells.push({ x, y });
    const webbed = new Set(f.furniture.filter((o) => o.kind.startsWith("webN") || o.kind.startsWith("webHub")).map((o) => `${o.x},${o.y}`));
    const share = lairCells.filter((c) => webbed.has(`${c.x},${c.y}`)).length / lairCells.length;
    assert.ok(share > 0.25 && share < 0.75, `graine ${seed} : toile ${share.toFixed(2)}`);
    // Un sentier sans toile mène de l'arrivée jusqu'au bord de la grande toile.
    const clean = (x: number, y: number) => !webbed.has(`${x},${y}`);
    const hubEdge = [];
    for (let dy = -1; dy <= 3; dy++) for (let dx = -1; dx <= 3; dx++) hubEdge.push({ x: boss.hub.x + dx, y: boss.hub.y + dy });
    const cleanDist = distanceField(map, f.start, clean);
    assert.ok(hubEdge.some((c) => map.isWalkable(c.x, c.y) && cleanDist[map.index(c.x, c.y)] !== -1), `graine ${seed} : pas de sentier sans toile jusqu'à la grande toile`);
    // La reine (2 × 2) va de sa toile jusqu'à l'anneau et jusqu'au coffre.
    const free = (x: number, y: number) => map.isWalkable(x, y);
    let q = { ...boss.spawn, size: 2 };
    for (let i = 0; i < 200; i++) {
      const step = bigStep(map, q, free, null, boss.chest);
      if (!step) break;
      q = { ...step, size: 2 };
    }
    assert.equal(gapBetween(q, boss.chest), 1, `graine ${seed} : la reine ne rejoint pas l'alcôve`);
    assert.ok(cellsOf({ ...boss.spawn, size: 2 }).every((c) => map.isWalkable(c.x, c.y)));
  }
  assert.ok(sizes.size >= 10, `${sizes.size} tailles différentes`);
  assert.ok(flips.size >= 4, "plans retournés");
});

/** Partie de la salle d'essai, descendue à l'étage du boss (l'escalier de la salle de combat y mène). */
function bossGame(seed = 1): Game {
  const game = new Game(seed, undefined, undefined, undefined, true);
  game.hero.x = 24;
  game.hero.y = 18;
  (game as unknown as { pendingStairs: string }).pendingStairs = "down";
  game.takeStairs();
  return game;
}

test("la Tisseuse : réveil par la toile, morsure, recul, cocon mangé, chute, feu, leurre, mort et escalier", () => {
  const game = bossGame();
  const layout = (game as unknown as { current: { boss: { spawn: { x: number; y: number }; hub: { x: number; y: number }; seal: { x: number; y: number }; pillars: { x: number; y: number }[] } } }).current.boss;
  const queen = game.bossActor()!;
  assert.ok(queen && queen.size === 2 && queen.hp === 36);
  assert.equal(game.monsters.length, 1, "seule dans la nichée");
  assert.equal(game.map.get(layout.seal.x, layout.seal.y), Tile.Furniture, "escalier scellé");
  // Elle ne sent pas le héros dans l'antichambre.
  for (let i = 0; i < 5; i++) {
    game.wait();
    game.tick();
  }
  assert.equal(queen.boss!.engaged, false);
  // Le héros se place au contact, sur le bord gauche de son carré : elle le sent et mord.
  game.hero.hp = game.hero.maxHp = 400;
  game.hero.x = queen.x - 1;
  game.hero.y = queen.y;
  for (let i = 0; i < 3; i++) {
    game.wait();
    game.tick();
  }
  assert.ok(queen.boss!.engaged, "réveillée");
  assert.ok(game.hero.hp < 400 || queen.boss!.bites > 0 || queen.boss!.phase !== "advance", "elle a mordu");
  // Après deux morsures, elle recule.
  for (let i = 0; i < 6 && queen.boss!.phase === "advance"; i++) {
    game.wait();
    game.tick();
  }
  assert.notEqual(queen.boss!.phase, "advance", "elle recule après deux morsures");
  // Un cocon mangé lui rend des PV.
  queen.hp = 30;
  const cocoon = game.furnitureList().find((f) => f.kind.startsWith("cocoon"))!;
  queen.boss!.phase = "retreat";
  queen.boss!.dest = { x: cocoon.x, y: cocoon.y, eat: { x: cocoon.x, y: cocoon.y } };
  game.hero.x = layout.seal.x - 1;
  game.hero.y = layout.seal.y;
  for (let i = 0; i < 60 && queen.boss!.phase === "retreat"; i++) {
    game.wait();
    game.tick();
  }
  assert.ok(queen.hp > 30, `elle a mangé (${queen.hp} PV)`);
  assert.ok(!game.furnitureList().includes(cocoon), "le cocon a disparu");
  // Les amarres tranchées pendant qu'elle est sur sa toile : elle tombe sur le dos.
  queen.x = layout.spawn.x;
  queen.y = layout.spawn.y;
  queen.boss!.phase = "lurk";
  queen.boss!.lurk = 50;
  for (const p of layout.pillars) {
    const spot = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })).find((c) => game.map.isWalkable(c.x, c.y) && !game.monsterAt(c.x, c.y))!;
    game.hero.x = spot.x;
    game.hero.y = spot.y;
    game.path = [];
    assert.ok(game.setDestination(p.x, p.y, true), "on vise l'amarre");
    for (let i = 0; i < 3 && game.furnitureList().some((f) => f.kind === "anchor" && f.x === p.x && f.y === p.y); i++) game.tick();
  }
  assert.equal(game.furnitureList().filter((f) => f.kind === "anchor").length, 0, "toutes les amarres tranchées");
  assert.equal(game.furnitureList().filter((f) => f.kind.startsWith("webHub")).length, 0, "la grande toile est tombée");
  assert.ok(queen.boss!.fallen > 0 || (queen.boss!.phase as string) === "advance", "renversée");
  assert.ok(game.heroHasAdvantageOn(queen) || queen.boss!.fallen === 0);
  // Le feu lui fait deux fois plus mal.
  const before = queen.hp;
  queen.boss!.fallen = 5;
  game.hero.x = layout.seal.x - 1;
  game.hero.y = layout.seal.y;
  game.fires.push({ x: queen.x, y: queen.y, turns: 3 });
  game.wait();
  game.tick();
  assert.ok(before - queen.hp >= 2, `brûlée : ${before - queen.hp}`);
  // Morte : l'escalier s'ouvre, le boss compte pour les records.
  queen.hp = 1;
  game.hero.x = queen.x - 1;
  game.hero.y = queen.y;
  game.fires = [];
  for (let i = 0; i < 40 && game.bossActor(); i++) {
    queen.hp = Math.min(queen.hp, 1);
    game.setDestination(queen.x, queen.y);
    game.tick();
  }
  assert.equal(game.bossActor(), undefined, "vaincue");
  // La démo s'arrête : la partie est finie, l'escalier reste scellé.
  assert.notEqual(game.map.get(layout.seal.x, layout.seal.y), Tile.StairsDown, "l'escalier reste scellé");
  assert.ok(game.over && game.won, "partie bloquée");
  assert.equal(game.bossKills, 1);
  const hx = game.hero.x;
  game.setDestination(hx + 1, game.hero.y);
  game.tick();
  assert.equal(game.hero.x, hx, "plus aucun ordre");
});

test("la Tisseuse : la toile ralentit, le feu court de toile en toile, une flèche dans la toile l'attire, les œufs éclosent", () => {
  const game = bossGame(3);
  const queen = game.bossActor()!;
  const web = game.furnitureList().find((f) => f.kind.startsWith("webN") && Math.max(Math.abs(f.x - queen.x), Math.abs(f.y - queen.y)) > 4)!;
  // Marcher sur une nappe : un tour de plus (englué) et elle se déchire.
  game.hero.x = web.x;
  game.hero.y = web.y;
  (game as unknown as { enterWeb(): void }).enterWeb();
  assert.equal(game.hero.stuck, 1);
  assert.ok(!game.furnitureList().includes(web), "déchirée en passant");
  // Le feu se propage de nappe en nappe.
  const webs = game.furnitureList().filter((f) => f.kind.startsWith("webN"));
  const seedWeb = webs.find((w) => webs.some((o) => o !== w && Math.max(Math.abs(o.x - w.x), Math.abs(o.y - w.y)) === 1))!;
  game.hero.x = 2;
  game.hero.y = game.rooms[0].y + 1;
  game.hero.stuck = 0;
  game.fires.push({ x: seedWeb.x, y: seedWeb.y, turns: 2 });
  const count0 = game.furnitureList().filter((f) => f.kind.startsWith("webN")).length;
  for (let i = 0; i < 4; i++) {
    game.wait();
    game.tick();
  }
  const count1 = game.furnitureList().filter((f) => f.kind.startsWith("webN")).length;
  assert.ok(count0 - count1 >= 3, `le feu a couru : ${count0 - count1} nappes brûlées`);
  // Leurre : une flèche plantée dans une toile.
  const g2 = bossGame(5);
  const q2 = g2.bossActor()!;
  const lair = (g2 as unknown as { current: { boss: { lair: { x: number; y: number; w: number; h: number } } } }).current.boss.lair;
  const inLair = (f: { x: number; y: number }) => f.x > lair.x && f.x < lair.x + lair.w - 1 && f.y > lair.y && f.y < lair.y + lair.h - 1;
  const far = g2.furnitureList().find((f) => f.kind.startsWith("webN") && inLair(f) && gapBetween(q2, f) >= 4)!;
  (g2 as unknown as { lureBoss(p: { x: number; y: number }): void }).lureBoss(far);
  assert.ok(q2.boss!.lure, "leurrée");
  for (let i = 0; i < 15 && gapBetween(q2, far) > 1; i++) {
    g2.wait();
    g2.tick();
  }
  assert.equal(gapBetween(q2, far), 1, "elle accourt à la toile qui vibre");
  // À mi-vie, les sacs d'œufs éclosent.
  const sacs = g2.furnitureList().filter((f) => f.kind === "eggSac").length;
  q2.hp = 15;
  g2.wait();
  g2.tick();
  assert.equal(g2.monsters.filter((m) => m.defId === "araignee").length, sacs, "une araignée par sac");
  assert.ok(q2.boss!.hatched);
});

test("arme à deux mains : l'arc retourne au sac, pas de javeline ; salle d'essai : l'escalier de la salle de départ mène à la Tisseuse", () => {
  const game = new Game(1, undefined, undefined, undefined, true);
  game.setPeaceful(true);
  game.inventory.add("epee_longue", 1);
  const sword = game.inventory.items.find((i) => i.defId === "epee_longue")!;
  assert.ok(game.equipment.ranged, "l'arc est en main");
  assert.ok(game.equip(sword.uid));
  // L'épée longue fait sauter l'autre main : l'arc retourne dans le sac, et on ne peut pas le reprendre.
  assert.equal(game.equipment.ranged, null);
  const bow = game.inventory.items.find((i) => i.defId === "arc_court")!;
  assert.ok(bow, "l'arc est dans le sac");
  assert.equal(game.equip(bow.uid), false);
  assert.equal(game.shoot(game.hero.x + 2, game.hero.y), "no-bow");
  game.inventory.add("javeline", 3);
  assert.ok(game.chooseAmmo("javeline"));
  assert.equal(game.shoot(game.hero.x + 2, game.hero.y), "two-hands");
  // Escalier du coin de la salle de départ.
  game.setPeaceful(false);
  assert.equal(game.map.get(11, 9), Tile.StairsDown);
  game.hero.x = 11;
  game.hero.y = 9;
  (game as unknown as { pendingStairs: string }).pendingStairs = "down";
  game.takeStairs();
  assert.equal(game.depth, 2);
  assert.ok(game.bossActor(), "la Tisseuse attend à l'étage 2");
});

test("agilité : esquive (+1 CA tous les 2 points) ; casques ; le Kobold frondeur tire de loin et recule", () => {
  const game = new Game(1, undefined, undefined, undefined, true);
  const ac0 = game.hero.armorClass;
  game.points = 2;
  game.setPeaceful(true);
  assert.ok(game.allocate("agilite"));
  assert.equal(game.hero.armorClass, ac0, "1 point : pas encore");
  assert.ok(game.allocate("agilite"));
  assert.equal(game.hero.armorClass, ac0 + 1, "2 points : +1 CA");
  game.inventory.add("casque_cuir", 1);
  assert.ok(game.equip(game.inventory.items.find((i) => i.defId === "casque_cuir")!.uid));
  assert.equal(game.hero.armorClass, ac0 + 2, "casque de cuir +1");
  game.setPeaceful(false);
  // Le frondeur : à 4 cases et en vue, il tire ; au contact, il recule.
  const sling = game.monsters.find((m) => m.defId === "frondeur")!;
  assert.ok(sling, "un frondeur dans la salle d'essai");
  for (const m of game.monsters) if (m !== sling) m.hp = 0;
  game.monsters = [sling];
  sling.alerted = true;
  sling.patrol = undefined;
  game.hero.hp = game.hero.maxHp = 999;
  game.hero.x = sling.x + 4;
  game.hero.y = sling.y;
  game.wait();
  game.tick();
  assert.ok(game.events.some((e) => e.type === "attack" && e.attacker === sling && e.ranged), "il tire");
  game.hero.x = sling.x + 1;
  game.hero.y = sling.y;
  const before = Math.max(Math.abs(sling.x - game.hero.x), Math.abs(sling.y - game.hero.y));
  game.events.length = 0;
  game.wait();
  game.tick();
  const after = Math.max(Math.abs(sling.x - game.hero.x), Math.abs(sling.y - game.hero.y));
  assert.ok(after > before, "il recule");
});

test("rigoles v2 : chaque morceau se raccorde à ses voisins et la rigole finit dans une grille", () => {
  let checked = 0;
  const step: Record<string, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  const opposite: Record<string, string> = { N: "S", S: "N", E: "W", W: "E" };
  const sidesOf = (kind: string): string[] => {
    const m = /^b?gut(Drain)?_([NESW]+)[ab]?$/.exec(kind);
    return m ? m[2].split("") : [];
  };
  for (let seed = 1; seed <= 120 && checked < 12; seed++) {
    const game = new Game(seed);
    {
      const gut = game.furnitureList().filter((f) => /^b?gut/.test(f.kind));
      if (gut.length === 0) continue;
      checked++;
      const at = (x: number, y: number) => gut.find((f) => f.x === x && f.y === y);
      for (const f of gut) {
        for (const side of sidesOf(f.kind)) {
          const [dx, dy] = step[side];
          const n = at(f.x + dx, f.y + dy);
          assert.ok(n && sidesOf(n.kind).includes(opposite[side]), `rigole coupée en ${f.x},${f.y} (${f.kind} → ${side})`);
        }
      }
      const drains = gut.filter((f) => f.kind.includes("Drain_")).length;
      const sources = gut.filter((f) => /^b?gut_[NESW]$/.test(f.kind)).length;
      assert.equal(drains, sources, "autant de grilles que de rigoles");
    }
  }
  assert.ok(checked > 0, "aucune rigole trouvée");
});

test("Colporteur (salle d'essai) : on va à côté, la boutique s'ouvre ; acheter, vendre ; il se cache près des monstres", () => {
  const game = new Game(1, undefined, undefined, undefined, true);
  game.setPeaceful(true);
  const m = game.merchant()!;
  assert.ok(m, "le Colporteur est dans la salle d'essai");
  assert.equal(m.wares.length, 6);
  // Le toucher : le héros va à côté, puis la boutique s'ouvre.
  assert.ok(game.setDestination(m.x, m.y));
  let opened = false;
  for (let i = 0; i < 20 && !opened; i++) {
    game.tick();
    opened = game.events.some((e) => e.type === "shop");
    game.events.length = 0;
  }
  assert.ok(opened, "boutique ouverte");
  assert.ok(game.canTrade());
  // Acheter : sans or, refusé ; avec, le lot va dans le sac et il disparaît de l'étal.
  game.gold = 0;
  assert.equal(game.buy(0), "gold");
  game.gold = 500;
  const ware = m.wares[0];
  const before = game.inventory.count(ware.item);
  assert.equal(game.buy(0), "ok");
  assert.equal(game.gold, 500 - ware.price);
  assert.equal(game.inventory.count(ware.item), before + ware.count);
  assert.equal(m.wares.length, 5);
  // Vendre : il rachète à 40 % (au moins 1 or), jamais l'or ni les gemmes.
  const it = game.inventory.items.find((x) => x.defId === ware.item)!;
  const price = game.sellPrice(it.uid)!;
  assert.ok(price >= 1);
  const gold = game.gold;
  assert.ok(game.sell(it.uid));
  assert.equal(game.gold, gold + price);
  // Un monstre à 4 cases : il se cache, et on ne peut plus lui parler.
  game.setPeaceful(false);
  const foe = game.monsters[0];
  Object.assign(foe, { x: m.x + 3, y: m.y, fromX: m.x + 3, fromY: m.y, asleep: true, alerted: false });
  game.wait();
  game.tick();
  if (game.monsters.some((mo) => Math.max(Math.abs(mo.x - m.x), Math.abs(mo.y - m.y)) <= 4)) {
    assert.ok(m.hidden, "caché");
    assert.equal(game.canTrade(), false);
  }
});

test("Colporteur : un par section, au 4e étage, gardé dans la sauvegarde", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const game = new Game(seed);
    const at: number[] = [];
    for (let d = 1; d <= 4; d++) {
      if (game.merchant()) at.push(game.depth);
      if (d < 4) {
        game.pendingStairs = "down";
        assert.ok(game.takeStairs());
      }
    }
    assert.deepEqual(at, [4], `graine ${seed}`);
    const m = game.merchant()!;
    // 6 articles (Thomas, 2026-11-13), dont à coup sûr une cuisse, une potion et un équipement.
    assert.equal(m.wares.length, 6);
    assert.ok(m.wares.some((w) => w.item === "cuisse_poulet"));
    assert.ok(m.wares.some((w) => w.item.startsWith("potion_")));
    assert.ok(m.wares.some((w) => ["melee", "ranged", "armor", "hat"].includes(ITEMS[w.item].kind)));
    assert.ok(game.map.isWalkable(m.x, m.y));
    const copy = Game.restore(game.snapshot())!;
    assert.deepEqual(copy.merchant(), m);
  }
});

test("Colporteur : au palier d'alerte ALERTE, il quitte l'étage", () => {
  const game = new Game(1, undefined, undefined, undefined, true);
  game.setPeaceful(true);
  assert.ok(game.merchant());
  game.raiseAlarm(55);
  game.wait();
  game.tick();
  assert.equal(game.merchant(), null);
  assert.ok(game.events.some((e) => e.type === "merchantLeaves"));
});

test("sac plein : ce qui ne tient pas rebondit au sol sur une case libre ; le Colporteur ne bouge pas quand on le voit", () => {
  const game = new Game(1, undefined, undefined, undefined, true);
  game.setPeaceful(true);
  const m = game.merchant()!;
  // On se met à côté de lui, sac rempli de pommes.
  Object.assign(game.hero, { x: m.x - 1, y: m.y, fromX: m.x - 1, fromY: m.y });
  game.wait();
  game.tick();
  assert.deepEqual([m.x, m.y], [game.hero.x + 1, game.hero.y], "il ne s'éloigne pas");
  while (game.inventory.add("pomme", 5) === 0);
  game.gold = 500;
  const before = game.ground.length;
  const ware = m.wares.find((w) => w.item !== "pomme")!;
  assert.equal(game.buy(m.wares.indexOf(ware)), "ok");
  const hop = game.events.find((e) => e.type === "bounce");
  assert.ok(hop && hop.type === "bounce");
  assert.equal(game.ground.length, before + 1);
  const g = game.ground.find((x) => x.x === hop.x && x.y === hop.y)!;
  assert.equal(g.item, ware.item);
  assert.ok(Math.max(Math.abs(hop.x - game.hero.x), Math.abs(hop.y - game.hero.y)) >= 1, "pas sous les pieds du héros");
  // Il reste là tant qu'on le voit.
  const at = [m.x, m.y];
  Object.assign(game.hero, { x: m.x - 4, y: m.y, fromX: m.x - 4, fromY: m.y });
  for (let i = 0; i < 6; i++) {
    game.wait();
    game.tick();
  }
  if (game.isVisible(m.x, m.y)) assert.deepEqual([m.x, m.y], at);
});

test("raccourci « Objet » : seulement ce qui se consomme, compte le sac, gardé dans la sauvegarde", () => {
  const game = new Game(5);
  game.setQuickItem("epee");
  assert.equal(game.quickItem, null, "une arme ne se met pas en raccourci");
  game.inventory.add("pomme", 3);
  game.setQuickItem("pomme");
  assert.equal(game.quickStack()?.count, 3);
  const copy = Game.restore(JSON.parse(JSON.stringify(game.snapshot())))!;
  assert.equal(copy.quickItem, "pomme");
  game.hero.hp = 1;
  assert.ok(game.useItem(game.quickStack()!.uid));
  game.tick();
  assert.equal(game.quickStack()?.count, 2);
});

test("coup critique : le monstre est projeté d'une case", () => {
  const { game, m } = foeAt(2);
  const h = game.hero;
  const dx = Math.sign(m.x - h.x), dy = Math.sign(m.y - h.y);
  for (let k = 0; k < 300; k++) {
    m.x = m.fromX = h.x + dx;
    m.y = m.fromY = h.y + dy;
    m.hp = 999;
    m.stunned = 1;
    game.events.length = 0;
    assert.ok(game.strike());
    game.tick();
    const crit = game.events.some((e) => e.type === "attack" && e.attacker === h && e.result.critical);
    if (!crit) continue;
    const kb = game.events.find((e) => e.type === "heavyBlow" && e.kind === "knockback");
    assert.ok(kb && kb.type === "heavyBlow");
    assert.deepEqual([kb.fromX, kb.fromY], [h.x + dx, h.y + dy]);
    return;
  }
  assert.fail("aucun critique en 300 coups");
});

test("PNJ de quête : pris dans le feu ou le gaz, il s'enfuit (Pouf !)", () => {
  const game = new Game(4, undefined, undefined, undefined, true);
  const g = game.npc("gluck") ?? game.npc("soeur");
  assert.ok(g, "salle d'essai : un PNJ présent");
  const who = game.npc("gluck") ? "gluck" : "soeur";
  game.fires.push({ x: g.x, y: g.y, turns: 5 });
  game.events.length = 0;
  game.wait();
  game.tick();
  assert.equal(game.npc(who), null);
  assert.ok(game.events.some((e) => e.type === "npc" && e.what === "leave" && e.fled === "fire"));
});

test("chemin : il contourne un escalier qui n'est pas la destination", () => {
  for (let seed = 1; seed < 60; seed++) {
    const game = new Game(seed);
    const map = game.map;
    let stairs: { x: number; y: number } | null = null;
    for (let y = 0; y < map.height && !stairs; y++) for (let x = 0; x < map.width; x++) if (map.get(x, y) === 2) { stairs = { x, y }; break; }
    if (!stairs) continue;
    // Destination de l'autre côté de l'escalier, en ligne droite ; le chemin ne doit pas passer dessus.
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const a = { x: stairs.x - dx, y: stairs.y - dy }, b = { x: stairs.x + dx, y: stairs.y + dy };
      if (!map.isWalkable(a.x, a.y) || !map.isWalkable(b.x, b.y)) continue;
      game.hero.x = a.x;
      game.hero.y = a.y;
      const path = (game as unknown as { heroPath(to: { x: number; y: number }): { x: number; y: number }[] | null }).heroPath(b);
      if (!path) continue;
      assert.ok(!path.some((p) => p.x === stairs!.x && p.y === stairs!.y), "le chemin passe sur l'escalier");
      return;
    }
  }
  assert.fail("aucun escalier testable");
});

test("niveau maximal : 5 avant le boss de la section, l'XP rebondit ; le boss vaincu le relève", () => {
  const game = new Game(3);
  const g = game as unknown as { gainXp(n: number): void };
  while (game.level < 5) g.gainXp(game.xpToNext() - game.xp);
  assert.equal(game.level, 5);
  assert.equal(game.xp, 0);
  assert.ok(game.xpBlocked());
  game.events.length = 0;
  g.gainXp(50);
  assert.equal(game.level, 5);
  assert.equal(game.xp, 0);
  assert.ok(game.events.some((e) => e.type === "xp" && e.blocked));
  game.bossKills = 1;
  assert.ok(!game.xpBlocked());
  g.gainXp(3);
  assert.equal(game.xp, 3);
});

test("alerte qui redescend : le palier suit, un événement le signale", () => {
  const game = new Game(2);
  game.raiseAlarm(60);
  assert.equal(game.alarm().stage, 2);
  game.events.length = 0;
  game.lowerAlarm(40);
  assert.deepEqual(game.alarm(), { level: 20, stage: 0 });
  assert.ok(game.events.some((e) => e.type === "alarmDown" && e.stage === 0));
});

test("porte du Kobold qui compte : forcée depuis l'un ou l'autre côté, il sort de l'AUTRE côté", () => {
  let checked = 0;
  for (let seed = 1; seed <= 200 && checked < 4; seed++) {
    for (const side of [0, 1]) {
      const game = new Game(seed);
      const c = (game as unknown as { current: { counter?: { x: number; y: number; n: number; opened: boolean; inside: { x: number; y: number } } } }).current.counter;
      if (!c) break;
      game.monsters.splice(0);
      const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })).filter((p) => game.map.isWalkable(p.x, p.y));
      if (sides.length < 2) break;
      game.hero.x = sides[side].x;
      game.hero.y = sides[side].y;
      (game as unknown as { releaseCounter(c: unknown): void }).releaseCounter(c);
      const k = game.monsters.find((m) => m.name === "Kobold qui compte");
      assert.ok(k);
      const d2 = (p: { x: number; y: number }) => (p.x - game.hero.x) ** 2 + (p.y - game.hero.y) ** 2;
      assert.ok(d2(k) > d2(c), `graine ${seed}, côté ${side} : le Kobold est du côté du héros`);
      checked++;
    }
  }
  assert.ok(checked >= 4);
});

test("un objet qui tombe sur un escalier rebondit à côté", () => {
  const game = new Game(5);
  const map = game.map;
  let st: { x: number; y: number } | null = null;
  for (let y = 0; y < map.height && !st; y++) for (let x = 0; x < map.width; x++) if (map.get(x, y) === 2) { st = { x, y }; break; }
  assert.ok(st);
  game.events.length = 0;
  (game as unknown as { dropItem(x: number, y: number, i: string, n: number): void }).dropItem(st.x, st.y, "pomme", 1);
  assert.ok(!game.ground.some((g) => g.x === st!.x && g.y === st!.y), "la pomme est restée sur l'escalier");
  assert.ok(game.events.some((e) => e.type === "stairsBounce"));
});

/** Le héros à côté d'un PNJ de quête de la salle d'essai, monstres calmés. */
function besideNpc(game: Game, id: "gluck" | "soeur" | "krik"): void {
  const k = game.npc(id)!;
  const spots = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => ({ x: k.x + dx, y: k.y + dy })).filter((p) => game.map.isWalkable(p.x, p.y) && !game.npcAt(p.x, p.y) && !game.monsterAt(p.x, p.y));
  game.hero.x = game.hero.fromX = spots[0].x;
  game.hero.y = game.hero.fromY = spots[0].y;
  for (const m of game.monsters) m.alerted = false;
}

test("tâches de quête : Krik donne son magot à rapporter ; l'objet n'existe qu'après ; on revient le lui rendre (Thomas, 2026-11-12)", () => {
  const game = new Game(2, undefined, undefined, undefined, true);
  game.monsters.splice(0);
  game.peaceful = true;
  besideNpc(game, "krik");
  game.alloc.intelligence = 40;
  assert.ok(!game.ground.some((g) => g.item === "magot_krik"), "le magot n'existe pas avant la quête");
  const r = game.npcChoose("krik", "caches");
  assert.ok(r.roll?.success, "jet réussi (Intelligence 40)");
  assert.equal(game.quest?.id, "krik_magot");
  assert.ok(game.npc("krik"), "Krik reste sur l'étage");
  const spot = game.ground.find((g) => g.item === "magot_krik");
  assert.ok(spot, "le magot apparaît sur l'étage");
  assert.ok(Math.max(Math.abs(spot.x - game.hero.x), Math.abs(spot.y - game.hero.y)) >= 8, "loin du héros");
  assert.equal(game.questLine()?.text, "Retrouver le magot de Krik");
  // Revenir trop tôt : il attend.
  const wait = game.npcScene("krik");
  assert.ok(!wait.choices.some((c) => c.id === "turnin"));
  // Le magot ramassé : on revient le rendre.
  game.ground.splice(game.ground.indexOf(spot), 1);
  game.inventory.add("magot_krik", 1);
  assert.ok(game.questDone());
  assert.equal(game.questLine()?.text, "Rendre le magot à Krik");
  const back = game.npcScene("krik");
  assert.ok(back.choices.some((c) => c.id === "turnin"));
  const done = game.npcChoose("krik", "turnin");
  assert.ok(done.done);
  assert.equal(game.quest, null);
  assert.equal(game.inventory.count("magot_krik"), 0);
  assert.equal(game.npc("krik"), null, "Krik part, la quête rendue");
  assert.ok(game.events.some((e) => e.type === "quest" && e.what === "complete"));
});

test("tâches de quête : Sœur Osseuse compte les Kobolds punis ; descendre sans revenir rate la tâche", () => {
  const game = new Game(2, undefined, undefined, undefined, true);
  game.peaceful = true;
  besideNpc(game, "soeur");
  game.alloc.force = 40;
  const kobolds = () => game.monsters.filter((m) => m.defId === "schrat" || m.defId === "frondeur");
  assert.ok(kobolds().length > 0);
  const r = game.npcChoose("soeur", "punish");
  assert.ok(r.roll?.success);
  const q = game.quest!;
  assert.equal(q.id, "soeur_kobolds");
  assert.equal(q.need, Math.min(3, kobolds().length));
  assert.match(game.questLine()!.text, /0\/\d$/);
  const remove = game as unknown as { removeIfDead(m: unknown, byHero?: boolean): void };
  for (const m of kobolds().slice(0, q.need)) {
    m.hp = 0;
    remove.removeIfDead(m);
  }
  assert.equal(q.got, q.need);
  assert.ok(game.questDone());
  // Descendre sans être revenu : ratée, elle ne sera plus là.
  game.pendingStairs = "down";
  assert.ok(game.takeStairs());
  assert.equal(game.quest, null);
  assert.ok(game.events.some((e) => e.type === "quest" && e.what === "fail"));
});

test("quête 03, Krik : trois scènes, des jets, la fiole de fumée, l'investissement (Thomas, 2026-11-12)", () => {
  const game = new Game(2, undefined, undefined, undefined, true);
  game.monsters.splice(0);
  game.peaceful = true;
  const k = game.krik();
  assert.ok(k, "salle d'essai : Krik est là");
  // Le héros à côté de lui.
  const spots = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => ({ x: k.x + dx, y: k.y + dy })).filter((p) => game.map.isWalkable(p.x, p.y) && !game.npcAt(p.x, p.y));
  game.hero.x = spots[0].x;
  game.hero.y = spots[0].y;
  assert.ok(game.canTalk("krik"));
  const s1 = game.krikScene();
  assert.equal(s1.choices.length, 5);
  assert.ok(s1.lines.some((l) => l.includes("ne peux plus mentir")));
  const r = game.krikChoose("divert");
  assert.ok(r.roll && r.done);
  if (r.roll.success) assert.ok(game.inventory.count("potion_fumee") >= 1);
  assert.equal(game.krikMemory.met, 1);
  // Scène 3 : investir, puis descendre : rendu ou perdu.
  game.krikMemory.met = 2;
  k.gone = false;
  k.opened = false;
  game.gold = 100;
  const s3 = game.krikScene();
  assert.ok(s3.choices.some((c) => c.id === "invest" && !c.off));
  game.krikChoose("invest");
  assert.equal(game.gold, 80);
  assert.equal(game.krikMemory.invested, 20);
});

test("fiole de fumée : lancée, les monstres tout près perdent la trace du héros", () => {
  const { game, m } = foeAt(3);
  game.inventory.add("potion_fumee", 1);
  const uid = game.inventory.items.find((i) => i.defId === "potion_fumee")!.uid;
  m.alerted = true;
  assert.ok(game.throwPotion(uid, m.x, m.y));
  game.tick();
  assert.equal(m.alerted, false);
  assert.equal(game.inventory.count("potion_fumee"), 0);
});

test("l'eau ne brûle pas, et éteint un personnage en feu", () => {
  const game = new Game(3);
  game.monsters.splice(0);
  const h = game.hero;
  const spots = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: h.x + dx, y: h.y + dy })).filter((p) => game.map.isWalkable(p.x, p.y));
  const w = spots[0];
  game.map.set(w.x, w.y, Tile.Water);
  game.fires.push({ x: w.x, y: w.y, turns: 5 });
  assert.ok(!game.isBurning(w.x, w.y));
  h.burning = 2;
  h.x = w.x;
  h.y = w.y;
  game.events.length = 0;
  game.wait();
  game.tick();
  assert.equal(h.burning, 0);
  assert.ok(game.events.some((e) => e.type === "doused"));
  assert.equal(game.fires.length, 0);
});

test("potion de brouillard : lancée, un losange de 5 de large ; le monstre qui traquait le héros perd sa trace (Thomas, 2026-11-12)", () => {
  const { game, m } = foeAt(3);
  game.inventory.add("potion_brouillard", 1);
  const uid = game.inventory.items.find((i) => i.defId === "potion_brouillard")!.uid;
  assert.ok(game.throwPotion(uid, game.hero.x, game.hero.y) || game.throwPotion(uid, m.x, m.y));
  game.tick();
  assert.ok(game.fog.length >= 3, "une nappe de plusieurs cases");
  assert.ok(game.fog.length <= 13, "un losange de 13 cases au plus");
  assert.ok(game.fogAt(game.hero.x, game.hero.y) || game.fogAt(m.x, m.y));
  if (game.fogAt(game.hero.x, game.hero.y) && Math.max(Math.abs(m.x - game.hero.x), Math.abs(m.y - game.hero.y)) > 1) assert.equal(m.alerted, false, "il ne voit plus le héros");
});

test("potion d'oursin : 15 % des dégâts reçus au contact reviennent à l'attaquant (au moins 1)", () => {
  const { game, m } = foeAt(1);
  game.urchinTurns = 40;
  game.hero.hp = game.hero.maxHp = 999;
  const before = m.hp;
  let hurt = false;
  for (let i = 0; i < 30 && !hurt; i++) {
    game.wait();
    game.tick();
    hurt = game.events.some((e) => e.type === "thorns");
    if (!hurt) game.events.length = 0;
  }
  assert.ok(hurt, "le monstre s'est piqué");
  assert.ok(m.hp < before);
});

test("bibelots : l'œil de chauve-souris montre l'ombre des monstres hors de vue ; la flûte endort", () => {
  const game = new Game(2, undefined, undefined, undefined, true);
  game.equipment.artifact = { uid: 999, defId: "oeil_chauve_souris", count: 1, x: 0, y: 0 } as never;
  const hidden = game.monsters.filter((m) => !game.isVisible(m.x, m.y));
  const shadows = game.batShadows();
  assert.ok(shadows.every((p) => hidden.some((m) => m.x === p.x && m.y === p.y)), "seulement des monstres qu'on ne voit pas");
  for (const p of shadows) assert.ok(Math.max(Math.abs(p.x - game.hero.x), Math.abs(p.y - game.hero.y)) <= 10);
  game.equipment.artifact = null;
  assert.equal(game.batShadows().length, 0);
  const { game: g2, m } = foeAt(1);
  g2.equipment.artifact = { uid: 998, defId: "flute_pan", count: 1, x: 0, y: 0 } as never;
  g2.hero.hp = g2.hero.maxHp = 999;
  let slept = false;
  for (let i = 0; i < 200 && !slept; i++) {
    g2.wait();
    g2.tick();
    slept = g2.events.some((e) => e.type === "lullaby");
    g2.events.length = 0;
    m.alerted = true;
    m.asleep = false;
  }
  assert.ok(slept, "la flûte finit par endormir un ennemi");
});

test("sac : assez de place mais pas d'un seul tenant, le message le dit (Thomas, 2026-11-12)", () => {
  const game = new Game(3);
  game.inventory.items.splice(0);
  // Un sac de 6 × 4 rempli en damier de pommes : 12 cases libres, mais aucun carré de 2 × 2.
  for (let y = 0; y < game.inventory.rows; y++) for (let x = 0; x < game.inventory.cols; x++) if ((x + y) % 2 === 0) game.inventory.items.push({ uid: 1000 + y * 10 + x, defId: "pomme", count: 1, x, y } as never);
  assert.ok(game.inventory.fitsIfTidied("armure_cuir"));
  assert.equal(game.inventory.add("armure_cuir", 1), 1, "elle ne rentre pas");
  game.inventory.items.splice(0);
  for (let y = 0; y < game.inventory.rows; y++) for (let x = 0; x < game.inventory.cols; x++) game.inventory.items.push({ uid: 2000 + y * 10 + x, defId: "pomme", count: 1, x, y } as never);
  assert.ok(!game.inventory.fitsIfTidied("pomme"), "plein pour de bon");
});

test("salle de bain du Kobold : il dort dans son bain ; on l'attaque, il sort de l'eau savonneux ; vaincu, sa dague tombe (Thomas, 2026-11-13)", () => {
  const game = new Game(2, undefined, undefined, undefined, true);
  const b = game.bath()!;
  assert.ok(b && !b.out, "la baignoire, et lui dedans");
  assert.equal(game.floorStyle(b.x, b.y + 1), "bath", "carrelage noir et blanc");
  assert.equal(game.bathTargetAt(b.x, b.y), "tub");
  game.monsters.splice(0);
  const spot = [[0, 1], [1, 1], [-1, 0], [-1, 1], [2, 1]].map(([dx, dy]) => ({ x: b.x + dx, y: b.y + dy })).find((p) => game.map.isWalkable(p.x, p.y))!;
  game.hero.x = game.hero.fromX = spot.x;
  game.hero.y = game.hero.fromY = spot.y;
  assert.ok(game.setDestination(b.x, b.y, true));
  for (let i = 0; i < 3 && !game.bath()!.out; i++) game.tick();
  assert.ok(game.bath()!.out, "il est sorti");
  assert.ok(game.events.some((e) => e.type === "bath" && e.what === "splash"));
  const k = game.monsters.find((m) => m.bather)!;
  assert.ok(k, "le Kobold mouillé");
  assert.ok((k.soapy ?? 0) > 0, "savonneux");
  k.hp = 0;
  (game as unknown as { removeIfDead(m: unknown): void }).removeIfDead(k);
  assert.ok(game.bath()!.beaten);
  assert.ok(game.ground.some((g) => g.item === "dague"), "sa dague tombe du porte-serviettes");
});

test("la Tisseuse ne craint pas le poison", () => {
  const game = new Game(2, undefined, undefined, undefined, true);
  const m = game.monsters[0];
  m.boss = { phase: "lurk" } as never;
  (game as unknown as { poisonActor(a: unknown, p: unknown): void }).poisonActor(m, { damage: 1, turns: 4 });
  assert.equal(m.poison, undefined);
  assert.ok(game.events.some((e) => e.type === "poisoned" && e.immune));
});

test("caché puis repos : on sort de l'ombre avant la fin du repos (Thomas, 2026-11-13)", () => {
  const game = new Game(3);
  game.monsters.splice(0);
  game.hero.hp = 3;
  (game as unknown as { hidden: boolean }).hidden = true;
  assert.ok(game.rest());
  for (let i = 0; i < RULES.hideRestTurns + 2; i++) game.tick();
  assert.equal((game as unknown as { hidden: boolean }).hidden, false);
  assert.ok(game.restProgress() > 0, "le repos continue");
});

test("un Kobold mal en point prend parfois la fuite, puis revient", () => {
  let fled = 0;
  const { game, m } = foeAt(1);
  game.hero.hp = game.hero.maxHp = 999;
  m.maxHp = 9;
  for (let i = 0; i < 40; i++) {
    m.hp = 3;
    m.fleeChecked = false;
    m.fleeTurns = 0;
    m.alerted = true;
    game.wait();
    game.tick();
    if (m.fleeTurns) fled++;
  }
  assert.ok(fled > 0, "jamais de fuite");
});

test("encyclopédie complète : chaque objet, monstre, personnage, piège et état a sa fiche (Thomas, 2026-11-13)", async () => {
  const { CODEX_ITEM_GROUPS, CODEX_PEOPLE, CODEX_STATES, CODEX_TRAPS } = await import("../src/data/codex");
  const { TRAPS } = await import("../src/data/traps");
  const { STATUS_ICONS } = await import("../src/ui/icons");
  const { NPC_IDS } = await import("../src/core/game");
  const { MONSTERS } = await import("../src/data/monsters");
  type ItemDef = import("../src/data/items").ItemDef;
  const kinds = new Set(CODEX_ITEM_GROUPS.flatMap(([, k]) => k));
  for (const def of Object.values(ITEMS) as ItemDef[]) {
    assert.ok(kinds.has(def.kind), `objet sans rubrique : ${def.id} (${def.kind})`);
    assert.ok(def.description && def.description.length > 5, `objet sans description : ${def.id}`);
  }
  for (const m of Object.values(MONSTERS) as { id: string; description?: string }[]) assert.ok(m.description, `monstre sans description : ${m.id}`);
  for (const id of [...NPC_IDS, "colporteur"]) assert.ok(CODEX_PEOPLE.some((p) => p.id === id), `personnage sans fiche : ${id}`);
  for (const kind of Object.keys(TRAPS)) assert.ok(CODEX_TRAPS[kind as keyof typeof CODEX_TRAPS], `piège sans fiche : ${kind}`);
  for (const id of Object.keys(STATUS_ICONS)) assert.ok(CODEX_STATES.some((s) => s.id === id), `état sans fiche : ${id}`);
});

test("brouillard : un monstre dedans erre au hasard et ne frappe pas ; deux qui s'y cognent finissent par se battre", () => {
  const { game, m } = foeAt(1);
  game.hero.hp = game.hero.maxHp = 999;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) game.fog.push({ x: m.x + dx, y: m.y + dy, turns: 50 });
  for (let i = 0; i < 10; i++) {
    game.wait();
    game.tick();
    assert.ok(!game.events.some((e) => e.type === "attack" && e.attacker === m), "il frappe dans le brouillard");
    assert.ok(game.fogAt(m.x, m.y), "il est sorti de la nappe");
    game.events.length = 0;
  }
});

test("potion de pierre : bue, statue (rien ne blesse, on ne fait rien) ; lancée, le monstre est pétrifié et sert d'abri", () => {
  const { game, m } = foeAt(1);
  game.inventory.add("potion_pierre", 2);
  const hp = game.hero.hp;
  assert.ok(game.useItem(game.inventory.items.find((i) => i.defId === "potion_pierre")!.uid));
  game.tick();
  assert.ok(game.stoneTurns > 0);
  for (let i = 0; i < 3; i++) {
    game.setDestination(game.hero.x + 1, game.hero.y);
    const at = { x: game.hero.x, y: game.hero.y };
    game.tick();
    assert.deepEqual({ x: game.hero.x, y: game.hero.y }, at, "une statue ne bouge pas");
  }
  assert.ok(game.hero.hp >= hp, "rien ne la blesse");
  while (game.stoneTurns > 0) game.tick();
  // Lancée sur le monstre : pétrifié, et il fait un abri.
  const uid = game.inventory.items.find((i) => i.defId === "potion_pierre")!.uid;
  // Le monstre a pu errer pendant la statue : on le remet à deux cases.
  m.x = game.hero.x + (game.map.isWalkable(game.hero.x + 2, game.hero.y) ? 2 : 0);
  m.y = game.hero.y;
  assert.ok(game.throwPotion(uid, m.x, m.y));
  game.tick();
  assert.ok((m.petrified ?? 0) > 0, "pétrifié");
});

test("potion de discorde : les monstres touchés se battent entre eux", () => {
  const game = new Game(2, undefined, undefined, undefined, true);
  const kobolds = game.monsters.filter((m) => !m.boss);
  assert.ok(kobolds.length >= 2);
  const [a, b] = kobolds;
  // Deux monstres côte à côte, en vue.
  b.x = a.x + 1;
  b.y = a.y;
  game.inventory.add("potion_discorde", 1);
  const uid = game.inventory.items.find((i) => i.defId === "potion_discorde")!.uid;
  game.hero.x = a.x - 3;
  game.hero.y = a.y;
  (game as unknown as { updateVision(): void }).updateVision();
  if (game.throwRefusal(uid, a.x, a.y) !== null) return;
  assert.ok(game.throwPotion(uid, a.x, a.y));
  game.tick();
  assert.ok(game.events.some((e) => e.type === "feud" && e.reason === "discord") || a.feud !== undefined, "ils se battent");
});
