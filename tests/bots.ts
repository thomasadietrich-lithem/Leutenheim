/**
 * Trois joueurs automatiques (Thomas, 2026-11-13 : « fais jouer un perso en débutant, moyen, ou maîtrise du jeu,
 * regardons les stats »). Hors de `npm test` : `node scripts/bots.mjs [parties]`.
 *
 * - DÉBUTANT : fonce sur tout ce qu'il voit, ne ramasse que ce qu'il trouve sous ses pieds, ne mange pas, ne se repose
 *   pas, place ses points au hasard, descend dès qu'il voit l'escalier.
 * - MOYEN : explore une bonne partie de l'étage, ramasse ce qu'il voit, met les armures plus solides, mange une pomme
 *   sous 40 % de PV, se repose sous 50 %, points en Vie et Force, voie bleue (Second souffle quand il est mal).
 * Tous parlent aux PNJ de quête qu'ils croisent (Gluck, Sœur Osseuse, Krik) : le débutant choisit au hasard et ne
 * revient que s'il passe à côté ; le moyen et le maîtrise choisissent les réponses qui donnent une tâche, la font
 * (objet à rapporter, statue, Kobolds) et reviennent la rendre.
 * - MAÎTRISE : explore tout l'étage, ramasse tout, s'équipe au mieux (armure, arme), tire à l'arc à distance, mange sous
 *   50 %, se repose sous 70 %, boit vitesse et lance le feu sur le boss, points en Force puis Vie, voie rouge.
 */
import { Game } from "../src/core/game";
import { ITEMS, ItemDef } from "../src/data/items";
import { expectedDamagePerTurn } from "../src/core/combat";
import type { StatId } from "../src/data/skills";
import { Tile } from "../src/world/map";
import { NPC_IDS, type NpcId } from "../src/core/game";
import { QUEST_TASKS } from "../src/data/quests";

type Level = "debutant" | "moyen" | "maitrise";

/** Petit hasard propre au joueur (la partie garde le sien). */
function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

const gap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function stairsSeen(game: Game): { x: number; y: number } | null {
  for (let y = 0; y < game.map.height; y++) for (let x = 0; x < game.map.width; x++) if (game.map.get(x, y) === Tile.StairsDown && game.isExplored(x, y)) return { x, y };
  return null;
}

/** La case connue la plus proche (à pied) qui touche de l'inconnu : là où explorer. */
function frontier(game: Game): { x: number; y: number } | null {
  const { map } = game;
  const seen = new Uint8Array(map.width * map.height);
  const queue = [{ x: game.hero.x, y: game.hero.y }];
  seen[map.index(game.hero.x, game.hero.y)] = 1;
  while (queue.length > 0) {
    const p = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (!map.inBounds(x, y) || seen[map.index(x, y)]) continue;
      seen[map.index(x, y)] = 1;
      if (!game.isExplored(x, y)) return p.x === game.hero.x && p.y === game.hero.y ? null : p;
      const t = map.get(x, y);
      if (!map.isWalkable(x, y) || t === Tile.StairsDown || t === Tile.StairsUp || game.isTrap(x, y)) continue;
      queue.push({ x, y });
    }
  }
  return null;
}

function explored(game: Game): number {
  let n = 0;
  let total = 0;
  for (let y = 0; y < game.map.height; y++) {
    for (let x = 0; x < game.map.width; x++) {
      if (!game.map.isWalkable(x, y)) continue;
      total++;
      if (game.isExplored(x, y)) n++;
    }
  }
  return total ? n / total : 1;
}

function bagUid(game: Game, id: string): number | null {
  return game.inventory.items.find((i) => i.defId === id)?.uid ?? null;
}

/** S'équipe au mieux : armure (CA), casque, arme de corps à corps (dégâts moyens contre CA 13). */
function equipBest(game: Game, weapons: boolean): void {
  for (const item of [...game.inventory.items]) {
    const def = ITEMS[item.defId] as ItemDef;
    if (game.tooLow(def)) continue;
    if (def.kind === "armor" || def.kind === "hat") {
      const worn = game.equipment[def.kind];
      const cur = worn ? ((ITEMS[worn.defId] as ItemDef).armorClass ?? 0) : 0;
      if ((def.armorClass ?? 0) > cur) game.equip(item.uid);
    } else if (weapons && def.kind === "melee" && def.damage) {
      const worn = game.equipment.melee;
      const score = (d: ItemDef) => expectedDamagePerTurn(d.attackBonus ?? 0, d.damage!, d.speed, 13);
      if (!worn || score(def) > score(ITEMS[worn.defId] as ItemDef) * 1.05) game.equip(item.uid);
    } else if (def.kind === "artifact" && !game.equipment.artifact) game.equip(item.uid);
  }
}

export interface RunStats {
  level: Level;
  seed: number;
  deepest: number;
  heroLevel: number;
  turns: number;
  gold: number;
  dead: boolean;
  cause: string | null;
  boss: boolean;
  kills: number;
  talks: number;
  questsStarted: number;
  questsDone: number;
  questsFailed: number;
  skillUses: number;
  healed: number;
  lastStands: number;
}

/**
 * Les réponses qui donnent une tâche que les bots savent faire (voir src/data/quests.ts). Les missions des zones
 * spéciales (quêtes v3 : tapisserie, tonneau creux, cierges…) ne sont pas encore apprises (2026-11-14).
 */
const TASK_CHOICES: Record<NpcId, string[]> = { gluck: ["deal"], soeur: ["punish"], krik: [], grum: [] };

/** Une conversation entière : on choisit, jusqu'à la fin de la scène. */
function talk(game: Game, id: NpcId, level: Level, rnd: () => number): void {
  for (let i = 0; i < 8; i++) {
    const scene = game.npcScene(id);
    const open = scene.choices.filter((c) => !c.off);
    if (open.length === 0) return;
    let pick = open.find((c) => c.id === "turnin");
    if (!pick && level !== "debutant") {
      const wanted = TASK_CHOICES[id].filter((w) => open.some((c) => c.id === w));
      if (wanted.length > 0) pick = open.find((c) => c.id === wanted[Math.floor(rnd() * wanted.length)]);
    }
    const real = open.filter((c) => c.id !== "leave" && c.id !== "refuse");
    pick ??= real.length > 0 ? real[Math.floor(rnd() * real.length)] : open[0];
    const r = game.npcChoose(id, pick.id);
    if (r.done) return;
  }
}

/** Pour comparer les voies : la voie imposée (« none » : aucune) et l'ordre où placer les points de voie. */
export interface BotOptions {
  voie?: "blue" | "red" | "none";
  build?: string[];
}

export function playBot(level: Level, seed: number, maxTurns = 8000, opts: BotOptions = {}): RunStats {
  const game = new Game(seed);
  const rnd = lcg(seed * 7919 + level.length);
  const stats: StatId[] = ["vie", "force", "agilite", "intelligence", "charisme"];
  let kills = 0;
  let skillUses = 0;
  let healed = 0;
  let lastStands = 0;
  let talks = 0;
  let questsStarted = 0;
  let questsDone = 0;
  let questsFailed = 0;
  const talked = new Set<string>();
  let idle = 0;
  let lastKey = "";
  while (!game.over && game.turn < maxTurns) {
    if (game.pendingStairs === "down" && game.takeStairs()) continue;
    // Points de caractéristique et voie.
    while (game.points > 0) {
      const stat = level === "debutant" ? stats[Math.floor(rnd() * 5)] : level === "moyen" ? (game.alloc.vie <= game.alloc.force ? "vie" : "force") : game.alloc.force <= game.alloc.vie ? "force" : "vie";
      if (!game.allocate(stat)) break;
    }
    if (game.canChoosePath() && opts.voie !== "none") game.choosePath(opts.voie ?? (level === "maitrise" ? "red" : level === "moyen" ? "blue" : rnd() < 0.5 ? "red" : "blue"));
    if (level !== "debutant" && game.voie && game.pathPoints() > 0 && !game.inCombat()) {
      const owned = opts.build ?? (game.voie === "red" ? ["double_frappe", "coup_puissant", "enchainement", "rage"] : ["second_souffle", "peau_dure", "esquive", "dernier_rempart"]);
      for (const id of owned) if (game.improve(id as never)) break;
    }
    if (level !== "debutant") equipBest(game, level === "maitrise");

    const hp = game.hero.hp / game.hero.maxHp;
    const foes = game.visibleMonsters();
    const queen = game.bossActor();
    let acted = false;
    // Se soigner.
    const apple = bagUid(game, "pomme");
    if (!acted && level !== "debutant" && apple !== null && hp < (level === "maitrise" ? 0.5 : 0.4) && game.hero.hp < game.hero.maxHp) acted = game.useItem(apple);
    if (!acted && game.voie === "blue" && level !== "debutant" && hp < 0.35) acted = game.useSkill();
    // Le boss (maîtrise) : potion de vitesse, potion de feu lancée.
    if (!acted && level === "maitrise" && queen && foes.includes(queen)) {
      const fire = bagUid(game, "potion_feu");
      if (fire !== null && gap(queen, game.hero) >= 2) acted = game.throwPotion(fire, queen.x, queen.y);
      const haste = bagUid(game, "potion_vitesse");
      if (!acted && haste !== null && game.hasteTurns === 0 && gap(queen, game.hero) <= 2) acted = game.useItem(haste);
    }
    if (!acted && foes.length > 0) {
      const target = foes.reduce((a, b) => (gap(b, game.hero) < gap(a, game.hero) ? b : a));
      // Maîtrise : un coup d'arc à distance avant le contact ; double frappe au contact.
      if (level === "maitrise" && gap(target, game.hero) >= 2 && game.arrows() > 0 && game.shoot(target.x, target.y) === null) acted = true;
      else if (level !== "debutant" && game.voie === "red" && gap(target, game.hero) <= 1 && game.useSkill()) acted = true;
      // Bousculade : pousser de temps en temps l'ennemi au contact (sonné, parfois contre un mur).
      else if (level !== "debutant" && game.rank("enchainement") > 0 && gap(target, game.hero) <= 1 && rnd() < 0.35 && game.pushTargets().some((m) => m.id === target.id) && game.push(target.id)) acted = true;
      else acted = game.setDestination(target.x, target.y);
    }
    if (!acted && game.restProgress() > 0) acted = true;
    if (!acted && level !== "debutant" && hp < (level === "maitrise" ? 0.7 : 0.5) && game.rest()) acted = true;
    // Quêtes : rendre la tâche, la faire, ou aller parler au PNJ qu'on a vu.
    const quest = game.quest && game.quest.depth === game.depth ? game.quest : null;
    if (!acted && quest) {
      const def = QUEST_TASKS[quest.id];
      const giver = game.npc(def.npc);
      if (game.questDone() && giver) {
        if (level !== "debutant" || gap(giver, game.hero) <= 8) {
          if (game.canTalk(def.npc)) {
            talk(game, def.npc, level, rnd);
            talks++;
            acted = true;
          } else acted = game.setDestination(giver.x, giver.y);
        }
      } else if (level !== "debutant" && def.kind === "fetch") {
        const it = game.ground.find((g) => g.item === def.item && game.isExplored(g.x, g.y));
        if (it) acted = game.itemsHere().some((g) => g.item === def.item) ? game.pickUp() : game.setDestination(it.x, it.y);
      } else if (level !== "debutant" && def.kind === "statue") {
        const st = game.furnitureList().find((f) => f.kind === "statue" && f.hollow && f.hinted);
        if (st) acted = game.setDestination(st.x, st.y);
      }
    }
    if (!acted && !quest && !game.inCombat()) {
      for (const id of NPC_IDS) {
        const g = game.npc(id);
        if (!g || !game.isExplored(g.x, g.y) || talked.has(`${game.depth}:${id}`)) continue;
        if (game.canTalk(id)) {
          talked.add(`${game.depth}:${id}`);
          talk(game, id, level, rnd);
          talks++;
          acted = true;
        } else acted = game.setDestination(g.x, g.y);
        if (acted) break;
      }
    }
    // Ramasser.
    if (!acted && game.itemsHere().length > 0 && (level !== "debutant" || rnd() < 0.5)) acted = game.pickUp();
    if (!acted && level !== "debutant") {
      const range = level === "maitrise" ? 99 : 6;
      const items = game.ground.filter((g) => game.isVisible(g.x, g.y) && gap(g, game.hero) <= range && game.map.get(g.x, g.y) !== Tile.StairsDown);
      if (items.length > 0) {
        const it = items.reduce((a, b) => (gap(b, game.hero) < gap(a, game.hero) ? b : a));
        acted = game.setDestination(it.x, it.y);
      }
    }
    // Explorer, puis descendre.
    if (!acted) {
      const stairs = stairsSeen(game);
      const want = level === "debutant" ? 0 : level === "moyen" ? 0.6 : 1;
      const front = frontier(game);
      // Une tâche en cours sur cet étage : on ne descend pas tant qu'on peut encore la faire (sauf le débutant).
      const busy = level !== "debutant" && !!quest && !!front;
      if (busy && front) acted = game.setDestination(front.x, front.y);
      else if (queen && !stairs) acted = game.setDestination(queen.x, queen.y, true);
      else if (stairs && (explored(game) >= want || !front)) acted = game.setDestination(stairs.x, stairs.y, true);
      else if (front) acted = game.setDestination(front.x, front.y);
      else if (stairs) acted = game.setDestination(stairs.x, stairs.y, true);
    }
    if (!acted) game.wait();
    game.tick();
    for (const e of game.events) {
      if (e.type === "death" && e.actor.kind === "monster") kills++;
      if (e.type === "skill") {
        skillUses++;
        healed += e.healed;
      }
      if (e.type === "lastStand") lastStands++;
      if (e.type === "quest") {
        if (e.what === "start") questsStarted++;
        else if (e.what === "complete") questsDone++;
        else questsFailed++;
      }
    }
    game.events.length = 0;
    // Bloqué (rien ne change) : il attend un tour, puis on arrête au bout d'un moment.
    const key = `${game.depth}:${game.hero.x},${game.hero.y}:${game.turn}`;
    idle = key.split(":").slice(0, 2).join(":") === lastKey ? idle + 1 : 0;
    lastKey = key.split(":").slice(0, 2).join(":");
    if (idle > 200) break;
  }
  return {
    level,
    seed,
    deepest: game.deepest,
    heroLevel: game.level,
    turns: game.turn,
    gold: game.gold,
    dead: game.over && game.hero.hp === 0,
    cause: game.deathCause,
    boss: game.bossKills > 0,
    kills,
    talks,
    questsStarted,
    questsDone,
    questsFailed,
    skillUses,
    healed,
    lastStands,
  };
}
