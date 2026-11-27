/**
 * Le quatrième joueur automatique : l'EXPERT (Thomas, 2026-11-16 : « de vraies stratégies de résolution et de gestion
 * de l'équipement » ; « il faut que les bots fonctionnent efficacement sur tous les domaines »).
 *
 * Les trois autres (débutant, moyen, maîtrise) ne bougent pas : leur historique reste comparable. L'expert, lui, joue
 * comme un bon joueur qui connaît le jeu, sans tricher : il ne lit ni les dés à venir, ni ce qu'il n'a pas vu (sauf le
 * plan des deux salles de boss, qu'un habitué connaît par cœur).
 *
 * ÉQUIPEMENT : compare armure, casque, arme (dégâts moyens par tour, allonge, assommoir), arc, amulette, bibelot, sac ;
 * choisit sa munition à chaque tir (empoisonnée, ricochante, javeline) ; range son sac, garde le rebut pour le vendre
 * au Colporteur, y achète vivres, potions et meilleur matériel ; boit la jouvence dès qu'il la trouve.
 * VIVRES ET POTIONS : repos d'abord (gratuit), puis la nourriture la mieux ajustée ; autel avant de descendre ; feu sur
 * les groupes, discorde, pierre, fumée, poison sur l'arme, vitesse / géant / oursin dans les gros combats.
 * TACTIQUE : tire tant qu'on vient à lui, attend l'ennemi au lieu de courir (premier coup, embuscade), recule dans un
 * couloir contre un groupe, pousse contre un mur (à terre : avantage), achève ceux qui sont à terre, sort du gaz, du
 * feu et de l'encre.
 * EXPLORATION : fouille chaque salle (caches, pièges, pièces secrètes), ouvre coffres, portes verrouillées, sarcophages,
 * grilles, alambics, dérange le poulet, prend la cuisse sur la table.
 * QUÊTES : choisit les réponses qui collent à sa Force, fait les tâches (statue, Kobolds, objet, zone) et les rend.
 * BOSS : Tisseuse (cocons crevés avant de la réveiller, feu sur la grande toile, œufs, ne la poursuit pas sur la
 * toile) ; Carillon (arrache le battant d'une poussée, feu, reste collé à lui, esquive l'encre).
 * SECTION 2 : une partie ordinaire ; depuis le 2026-11-16 l'escalier de la Tisseuse mène à l'étage 6, la démo finit au Carillon.
 */
import { Game, NPC_IDS, type NpcId } from "../src/core/game";
import { ITEMS, ItemDef, ItemId } from "../src/data/items";
import { MONSTERS, MonsterDef } from "../src/data/monsters";
import { expectedDamagePerTurn } from "../src/core/combat";
import { gapBetween, cellsOf } from "../src/core/boss";
import { Tile, Point } from "../src/world/map";
import { canStep } from "../src/world/pathfinding";
import { hasLineOfSight, lineBetween } from "../src/world/fov";
import { QUEST_TASKS } from "../src/data/quests";
import { RULES } from "../src/data/rules";
import { RACES } from "../src/data/races";
import type { Actor } from "../src/entities/actor";
import type { StatId } from "../src/data/skills";
import { lcg, stairsSeen, type RunStats } from "./bots";
import { endInfo } from "./botDiag";

const DIRS8: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const cheb = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const defOf = (id: string) => ITEMS[id as ItemId] as ItemDef;
const monsterDef = (m: Actor) => MONSTERS[m.defId as keyof typeof MONSTERS] as MonsterDef | undefined;
const avgDice = (d: { count: number; sides: number; bonus: number }) => (d.count * (d.sides + 1)) / 2 + d.bonus;

/** Réglages de l'expert (pour comparer des façons de jouer avec les mêmes graines). */
export interface ExpertOptions {
  /** APERÇU : la partie continue après le Carillon jusqu'à la section 3 (étages 11 à 15, la Grande Prêtresse), comme la
   *  « partie d'essai » du jeu. Sans cela, la démo s'arrête à l'étage 10. */
  preview?: boolean;
  /** Pour mesurer un atout de race : remplace certains de ses réglages (ex. `{ "agilite": 0 }`). */
  raceTweak?: Record<string, unknown>;
  /** La race du héros (Humain par défaut). */
  race?: keyof typeof RACES;
  voie?: "blue" | "red";
  /** Ordre des points de caractéristique, répété. */
  stats?: StatId[];
  /** Pouvoirs à ne jamais acheter (pour mesurer ce que chacun rapporte, sans changer l'ordre des autres). */
  without?: string[];
  /** Ordre où améliorer les pouvoirs. */
  build?: string[];
  /** Couper une famille de stratégies (mesurer ce qu'elle rapporte). */
  /** Pour comprendre une partie : appelé à chaque tour avec la règle qui a décidé. */
  trace?: (why: string, game: Game) => void;
  off?: Partial<Record<"hold" | "choke" | "push" | "search" | "shop" | "potions" | "bossPlan" | "features" | "quests" | "bow", boolean>>;
}

/** Ce dont l'expert se souvient pendant la partie. */
interface Memory {
  noGo: Set<string>;
  tries: Map<string, number>;
  leave: Set<string>;
  talked: Set<string>;
  shopDone: Set<number>;
  hold: number;
  anchor: Point | null;
  /** Monstres qu'on n'arrive pas à atteindre (derrière une grille, de l'autre côté d'un mur) : ignorés jusqu'à ce tour. */
  ignore: Map<number, number>;
  stale: number;
  staleSum: number;
  /** Étages où l'on a tout essayé : on force ce qui restait (portes à enfoncer, passages abandonnés). */
  desperate: Set<number>;
  openerDone: Set<number>;
  sawBell: boolean;
  bellDown: boolean;
  searches: number;
  chests: number;
  doors: number;
  bought: number;
  sold: number;
  potions: number;
  pushes: number;
  shots: number;
}

export interface ExpertStats extends RunStats {
  /** Le Carillon (boss de la section 2) est tombé ; la démo est finie. */
  boss2: boolean;
  /** Aperçu : la Grande Prêtresse (boss de la section 3) est tombée. */
  boss3: boolean;
  won: boolean;
  searches: number;
  chests: number;
  doors: number;
  bought: number;
  sold: number;
  potions: number;
  pushes: number;
  shots: number;
  armorClass: number;
  weapon: string;
}

// ---------- Chemins ----------

/** Chemin (sans la case de départ) vers la première case qui remplit `goal`, en ne passant que par `pass`. */
function route(game: Game, pass: (x: number, y: number) => boolean, goal: (x: number, y: number) => boolean, max = 1500): Point[] | null {
  const { map, hero } = game;
  if (goal(hero.x, hero.y)) return [];
  const W = map.width;
  const prev = new Int32Array(W * map.height).fill(-1);
  const start = map.index(hero.x, hero.y);
  prev[start] = start;
  const queue = [start];
  for (let head = 0; head < queue.length && head < max; head++) {
    const cur = queue[head];
    const cx = cur % W;
    const cy = (cur - cx) / W;
    for (const [dx, dy] of DIRS8) {
      if (!canStep(map, cx, cy, dx, dy)) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      const ni = map.index(nx, ny);
      if (prev[ni] !== -1) continue;
      const done = goal(nx, ny);
      if (!done && !pass(nx, ny)) continue;
      if (done && (game.monsterAt(nx, ny) || !pass(nx, ny))) continue;
      prev[ni] = cur;
      if (done) {
        const out: Point[] = [];
        for (let k = ni; k !== start; k = prev[k]) out.unshift({ x: k % W, y: Math.floor(k / W) });
        return out;
      }
      queue.push(ni);
    }
  }
  return null;
}

/** Nombre de cases libres autour d'une case (peu : un couloir, un goulet). */
function openness(game: Game, p: Point): number {
  let n = 0;
  for (const [dx, dy] of DIRS8) if (game.map.isWalkable(p.x + dx, p.y + dy)) n++;
  return n;
}

/** La case connue la plus proche (à pied) qui touche de l'inconnu, hors celles qu'on a renoncé à atteindre. */
function frontierX(game: Game, skip: (p: Point) => boolean): Point | null {
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
      if (!game.isExplored(x, y)) {
        if ((p.x === game.hero.x && p.y === game.hero.y) || skip(p)) continue;
        return p;
      }
      const t = map.get(x, y);
      if (!map.isWalkable(x, y) || t === Tile.StairsDown || t === Tile.StairsUp || game.knownTrap(x, y)) continue;
      queue.push({ x, y });
    }
  }
  return null;
}

// ---------- Équipement ----------

const ARTIFACT_RANK: Record<string, number> = { d20_enchante: 5, outils_voleur: 4, flute_pan: 3, oeil_chauve_souris: 2 };

/** Ce que vaut un objet à porter, dans son emplacement (plus c'est haut, mieux c'est). */
function gearScore(game: Game, d: ItemDef): number {
  switch (d.kind) {
    case "armor":
      return d.armorClass ?? 0;
    case "hat":
      return d.acBonus ?? 0;
    case "melee": {
      if (!d.damage) return 0;
      const dmg = { ...d.damage, bonus: d.damage.bonus + game.strength() };
      let s = expectedDamagePerTurn((d.attackBonus ?? 0) + game.gear("bonusHit"), dmg, d.speed, 13);
      if ((d.reach ?? 1) >= 2) s *= 1.12;
      if (d.stunOn) s *= 1 + (21 - d.stunOn) * 0.02;
      return s;
    }
    case "ranged":
      return (d.attackBonus ?? 0) + (d.range ?? 0) * 0.3;
    case "bag":
      return (d.bagCols ?? 6) * (d.bagRows ?? 4);
    case "amulet":
      return (d.bonusHit ?? 0) * 4 + (d.bonusForce ?? 0) * 2.5 + (d.bonusHp ?? 0) * 0.6 + (d.bonusAgility ?? 0) * 1 + (d.charisma ?? 0) * 0.1;
    case "artifact":
      return ARTIFACT_RANK[d.id] ?? 1;
    default:
      return 0;
  }
}

const GEAR_KINDS = ["armor", "hat", "melee", "ranged", "bag", "amulet", "artifact"];
const isGear = (d: ItemDef) => GEAR_KINDS.includes(d.kind);

function wornScore(game: Game, kind: string): number {
  const worn = game.equipment[kind as keyof typeof game.equipment];
  return worn ? gearScore(game, defOf(worn.defId)) : kind === "armor" ? 10 : 0;
}

/** S'équipe au mieux, sur tous les emplacements. Ne coûte pas de tour. */
function equipBestX(game: Game): void {
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const item of [...game.inventory.items]) {
      const d = defOf(item.defId);
      if (!isGear(d) || game.tooLow(d)) continue;
      const cur = wornScore(game, d.kind);
      if (gearScore(game, d) > cur * 1.02 + 1e-9 && game.equip(item.uid)) changed = true;
    }
    if (!changed) break;
  }
}

function freeCells(game: Game): number {
  const inv = game.inventory;
  return inv.cols * inv.rows - inv.items.reduce((n, i) => n + defOf(i.defId).w * defOf(i.defId).h, 0);
}

/** Un objet du sac dont l'expert n'a plus l'usage (à vendre, sinon à laisser). */
function isJunk(game: Game, item: { defId: string; floor?: number }): boolean {
  const d = defOf(item.defId);
  if (isGear(d)) {
    const mine = gearScore(game, d);
    const cur = wornScore(game, d.kind);
    // Mieux que ce qu'on porte, mais niveau trop bas : on le garde pour plus tard (s'il vient bientôt).
    if (mine > cur * 1.02 && (d.level ?? 1) <= game.level + 2) return false;
    return true;
  }
  if (d.kind === "key") return item.floor !== game.depth;
  if (d.id === "torche") return game.inventory.count("torche") > 2;
  return false;
}

/** Fait de la place : range, puis laisse le rebut le plus encombrant. Renvoie vrai si quelque chose a bougé. */
function makeRoom(game: Game, mem: Memory): boolean {
  game.inventory.tidy();
  const junk = game.inventory.items.filter((i) => isJunk(game, i) && !defOf(i.defId).potion);
  if (junk.length === 0) return false;
  junk.sort((a, b) => defOf(b.defId).w * defOf(b.defId).h - defOf(a.defId).w * defOf(a.defId).h);
  const it = junk[0];
  mem.leave.add(`${game.depth}:${it.defId}@${game.hero.x},${game.hero.y}`);
  return game.dropFromBag(it.uid);
}

const hasItem = (game: Game, id: string) => game.inventory.items.find((i) => i.defId === id)?.uid ?? null;

/** La munition du prochain tir, selon la cible. */
function pickAmmo(game: Game, target: Actor | null): void {
  const have = (id: ItemId) => game.inventory.count(id) > 0 && !game.tooLow(defOf(id));
  const bow = !!game.weapon("ranged");
  const d = target ? gapBetween(target, game.hero) : 99;
  let pick: ItemId | null = null;
  if (target) {
    const others = game.visibleMonsters().some((m) => m !== target && !game.isInert(m) && cheb(m, target) <= 4);
    // Flèche de recul : la cible qui arrive est renvoyée trois cases en arrière (de quoi tirer encore).
    if (bow && have("fleche_recul" as ItemId) && !target.boss && d >= 2 && d <= 3 && !monsterDef(target)?.sling) pick = "fleche_recul" as ItemId;
    else if (bow && have("fleche_ricochet") && others) pick = "fleche_ricochet";
    else if (bow && have("fleche_poison") && !target.boss && !target.poison && target.hp >= 6) pick = "fleche_poison";
    else if (have("javeline") && d <= (defOf("javeline").range ?? 6) && (target.hp >= 12 || !bow || game.inventory.count("fleche") === 0)) pick = "javeline";
  }
  // Flèche enflammée sur ce qui craint le feu ; flèche d'obsidienne (1d8) plutôt que la flèche simple (1d6).
  if (!pick && target && bow && have("fleche_feu" as ItemId) && (monsterDef(target)?.fireWeak || target.maxHp >= 20) && d >= 3) pick = "fleche_feu" as ItemId;
  if (!pick && bow && have("fleche_obsidienne" as ItemId)) pick = "fleche_obsidienne" as ItemId;
  // Sinon la munition ordinaire de l'arme en main (flèches pour l'arc, pierres pour le lance-pierre), puis ce qui reste.
  const family = game.weapon("ranged")?.ammo as ItemId | undefined;
  if (!pick) pick = family && have(family) ? family : (game.ammoKinds().find((id) => have(id)) ?? null);
  if (pick) game.chooseAmmo(pick);
}

/** Tirer sur ce monstre, si c'est possible et utile (pas d'ennemi au contact : désavantage). */
function tryShoot(game: Game, target: Actor, mem: Memory): boolean {
  pickAmmo(game, target);
  const profile = game.shotProfile();
  if (!profile || game.arrows() < 1) return false;
  if (game.isThreatened()) return false;
  const cells = cellsOf(target).filter((c) => game.isVisible(c.x, c.y) && cheb(c, game.hero) <= profile.range && cheb(c, game.hero) >= 2);
  if (cells.length === 0) return false;
  const c = cells.reduce((a, b) => (cheb(b, game.hero) < cheb(a, game.hero) ? b : a));
  if (!hasLineOfSight(game.map, game.hero, c)) return false;
  // La flèche s'arrête sur un meuble, un éboulis ou un autre monstre, même si l'on voit par-dessus : pas de tir perdu.
  for (const q of lineBetween(game.hero, c)) {
    if (q.x === c.x && q.y === c.y) break;
    if (!game.map.isWalkable(q.x, q.y) || game.monsterAt(q.x, q.y)) return false;
  }
  if (game.shoot(c.x, c.y) !== null) return false;
  mem.shots++;
  return true;
}

// ---------- Vivres ----------

function foods(game: Game): { uid: number; heal: number }[] {
  return game.inventory.items.filter((i) => defOf(i.defId).heal && !game.tooLow(defOf(i.defId))).map((i) => ({ uid: i.uid, heal: defOf(i.defId).heal! }));
}

/** Manger ce qui convient le mieux : le plus gros soin qui ne se gaspille pas ; en urgence, le plus gros tout court. */
function eat(game: Game, urgent: boolean): boolean {
  const list = foods(game);
  if (list.length === 0) return false;
  const missing = game.hero.maxHp - game.hero.hp;
  if (missing <= 0) return false;
  const fit = list.filter((f) => f.heal <= missing + 1).sort((a, b) => b.heal - a.heal);
  const pick = fit[0] ?? (urgent ? list.sort((a, b) => b.heal - a.heal)[0] : null);
  return pick ? game.useItem(pick.uid) : false;
}

/** Se soigner au calme : le repos d'abord (gratuit, une fois par étage), puis manger. */
function calmHeal(game: Game, restAt: number, eatAt: number): boolean {
  const r = game.hero.hp / game.hero.maxHp;
  // Un repos déjà commencé continue (le redemander le recommencerait).
  if (game.restProgress() > 0) return true;
  if (r < restAt && game.restRefusal() === null && game.rest()) return true;
  if (r < eatAt && eat(game, r < 0.35)) return true;
  return false;
}

// ---------- Dialogues ----------

/** Les réponses que l'expert préfère, dans l'ordre : celles qui donnent une tâche qu'il sait faire, puis les cadeaux. */
const CHOICES: Record<NpcId, string[]> = {
  gluck: ["turnin", "deal", "kind", "ask", "listen", "refuse", "decline", "leave"],
  soeur: ["turnin", "punish", "bless", "encourage", "silence", "leave"],
  krik: ["turnin", "protect", "lie", "leave"],
  grum: ["turnin", "hay", "leave"],
  fifrelin: ["turnin", "duel", "leave"],
  morillon: ["turnin", "leave"],
  vernis: ["turnin", "poulet", "leave"],
  maestro: ["turnin", "partition", "leave"],
  plumeau: ["turnin", "clef", "registre", "leave"],
  clavicule: ["turnin", "cranes", "soeur", "leave"],
  osselet: ["turnin", "corne", "leave"],
  fossoyeur: ["turnin", "ossements", "leave"],
  bandelette: ["turnin", "vases", "remede", "leave"],
  boletus: ["turnin", "champis", "leave"],
};

function talkX(game: Game, id: NpcId): void {
  for (let i = 0; i < 8; i++) {
    const scene = game.npcScene(id);
    const open = scene.choices.filter((c) => !c.off);
    if (open.length === 0) return;
    const wanted = CHOICES[id].find((w) => open.some((c) => c.id === w));
    const pick = open.find((c) => c.id === wanted) ?? open.find((c) => c.id === "leave" || c.id === "refuse") ?? open[0];
    if (game.npcChoose(id, pick.id).done) return;
  }
}

// ---------- La partie ----------

export function playExpert(seed: number, maxTurns = 24000, opts: ExpertOptions = {}): ExpertStats {
  const game = new Game(seed, opts.raceTweak ? ({ ...RACES[opts.race ?? "humain"], ...opts.raceTweak } as (typeof RACES)["humain"]) : RACES[opts.race ?? "humain"]);
  if (opts.preview) game.testRun = true;
  const rnd = lcg(seed * 7919 + 6);
  const off = opts.off ?? {};
  const statOrder: StatId[] = opts.stats ?? ["vie", "force"];
  const mem: Memory = {
    noGo: new Set(), tries: new Map(), leave: new Set(), talked: new Set(), shopDone: new Set(), hold: 0, anchor: null, ignore: new Map(), stale: 0, staleSum: 0, desperate: new Set(), openerDone: new Set(),
    sawBell: false, bellDown: false, searches: 0, chests: 0, doors: 0, bought: 0, sold: 0, potions: 0, pushes: 0, shots: 0,
  };
  let kills = 0, skillUses = 0, healed = 0, lastStands = 0, talks = 0, questsStarted = 0, questsDone = 0, questsFailed = 0;
  let spent = 0;
  let idle = 0;
  let lastKey = "";
  let weaverDown = false;
  let stalls = 0;
  let lastWhy = "";
  let sawPriestess = false;
  let priestessDown = false;

  const hero = game.hero;
  const hp = () => hero.hp / hero.maxHp;
  const key = (k: string) => `${game.depth}:${k}`;
  /** Un but qu'on poursuit : abandonné s'il échoue, ou s'il traîne trop (porte close, détour sans fin). */
  const aim = (k: string, limit: number, go: () => boolean): boolean => {
    const id = key(k);
    if (mem.noGo.has(id)) return false;
    const n = (mem.tries.get(id) ?? 0) + 1;
    mem.tries.set(id, n);
    if (n > limit) {
      mem.noGo.add(id);
      return false;
    }
    if (go()) return true;
    // Un échec peut être passager (un monstre dans le couloir, un nuage) : on n'abandonne qu'au troisième.
    const fails = (mem.tries.get(`${id}#`) ?? 0) + 1;
    mem.tries.set(`${id}#`, fails);
    if (fails >= 3) mem.noGo.add(id);
    return false;
  };
  const stepTo = (p: Point) => game.setDestination(p.x, p.y, true);
  const safeCell = (x: number, y: number) => game.map.isWalkable(x, y) && !game.monsterAt(x, y) && !game.merchantAt(x, y) && !game.npcAt(x, y) && !game.chickenAt(x, y) && !game.isBurning(x, y) && !game.isGassed(x, y) && !game.inkMarkedAt(x, y) && !game.knownTrap(x, y);
  const isFoe = (m: Actor) => !game.isInert(m) && !(m.arena && m.arena !== "duel") && m.feud === undefined;
  const awake = (m: Actor) => m.alerted && !m.asleep && !(m.petrified ?? 0);
  const heroHit = () => avgDice(hero.damage);
  const throwable = (id: string, x: number, y: number) => {
    const uid = hasItem(game, id);
    return uid !== null && game.throwRefusal(uid, x, y) === null ? uid : null;
  };
  const drink = (id: string): boolean => {
    const uid = hasItem(game, id);
    if (uid === null || !game.useItem(uid)) return false;
    mem.potions++;
    return true;
  };

  /** Points, voie, pouvoirs, équipement, sac : rien de tout cela ne prend de tour. */
  const upkeep = () => {
    while (game.points > 0 && !game.inCombat()) {
      const total = Object.values(game.alloc).reduce((a, b) => a + b, 0);
      if (!game.allocate(statOrder[total % statOrder.length])) break;
    }
    if (game.canChoosePath()) game.choosePath(opts.voie ?? "blue");
    if (game.voie && game.pathPoints() > 0 && !game.inCombat()) {
      // Ordre d'achat : (pouvoir, rang visé). Les pouvoirs du rang II (niveau 6) passent dès qu'ils s'ouvrent :
      // Encaisseur (chaque coup reçu fait moins mal), Riposte et Garde en bleu ; Tourbillon, Charge et Cri de guerre en rouge.
      const plan: [string, number][] = opts.build
        ? opts.build.map((id) => [id, 6] as [string, number])
        : game.voie === "red"
          ? [["double_frappe", 1], ["enchainement", 1], ["tourbillon", 1], ["charge", 1], ["rage", 1], ["cri_guerre", 1], ["soif_sang", 2], ["frenesie", 2], ["execution", 1], ["double_frappe", 2], ["coup_puissant", 1], ["tourbillon", 2], ["enchainement", 2], ["rage", 2], ["charge", 2], ["execution", 2], ["double_frappe", 6], ["coup_puissant", 2], ["cri_guerre", 2]]
          : [["second_souffle", 1], ["encaisseur", 2], ["dernier_rempart", 1], ["peau_dure", 1], ["riposte", 1], ["posture", 2], ["bastion", 1], ["sang_froid", 1], ["peau_dure", 2], ["second_souffle", 2], ["garde", 1], ["dernier_rempart", 2], ["riposte", 2], ["bastion", 2], ["sang_froid", 2], ["garde", 2], ["second_souffle", 6], ["esquive", 2]];
      // Rang III (niveau 11, après le Carillon) : Posture, Bastion, Sang-froid en bleu ; Soif de sang, Frénésie, Exécution en rouge.
      const skip = opts.without ?? [];
      for (let n = 0; n < 6 && game.pathPoints() > 0; n++) if (!plan.some(([id, rank]) => !skip.includes(id) && game.rank(id as never) < rank && game.improve(id as never))) break;
    }
    equipBestX(game);
    // Le rebut ne se garde que s'il y a un Colporteur devant et de la place.
    const sectionFloor = ((game.depth - 1) % RULES.floorsPerSection) + 1;
    const merchantAhead = !off.shop && sectionFloor <= 4 && !mem.shopDone.has(Math.floor((game.depth - 1) / RULES.floorsPerSection));
    if (!game.inCombat() && (freeCells(game) < 4 || (!merchantAhead && freeCells(game) < 10))) {
      for (let n = 0; n < 6 && freeCells(game) < (merchantAhead ? 4 : 10); n++) if (!makeRoom(game, mem)) break;
    }
  };

  // ---------- Combat ----------

  /** Une potion à lancer qui vaut le coup maintenant ? */
  const throwSomething = (alerted: Actor[]): boolean => {
    if (off.potions || alerted.length === 0) return false;
    const big = (m: Actor) => m.maxHp >= 14 || !!monsterDef(m)?.fireWeak;
    // Feu : deux ennemis dans la croix, ou un gros ; jamais sur soi (ni dans l'éclaboussure).
    if (hasItem(game, "potion_feu") !== null) {
      let best: { c: Point; score: number } | null = null;
      for (const m of alerted) {
        if (m.boss) continue;
        for (const c of [{ x: m.x, y: m.y }]) {
          if (cheb(c, hero) < 3) continue;
          const inCross = alerted.filter((o) => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) <= 1);
          const score = inCross.length + inCross.filter(big).length;
          if (score >= 2 && (!best || score > best.score)) best = { c, score };
        }
      }
      if (best) {
        const uid = throwable("potion_feu", best.c.x, best.c.y);
        if (uid !== null && game.throwPotion(uid, best.c.x, best.c.y)) return (mem.potions++, true);
      }
    }
    // Discorde : deux ennemis côte à côte se battent entre eux.
    if (hasItem(game, "potion_discorde") !== null) {
      for (const m of alerted) {
        if (m.boss) continue;
        const pals = alerted.filter((o) => o !== m && !o.boss && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= 1);
        if (pals.length === 0) continue;
        const uid = throwable("potion_discorde", m.x, m.y);
        if (uid !== null && game.throwPotion(uid, m.x, m.y)) return (mem.potions++, true);
      }
    }
    // Grenade sainte : elle brûle tout à deux cases (les morts deux fois plus) et bénit le héros ; sur un groupe ou un gros.
    if (hasItem(game, "grenade_sainte") !== null) {
      for (const m of alerted) {
        const hit = alerted.filter((o) => cheb(o, m) <= 2);
        if (hit.length < 2 && !(m.maxHp >= 20)) continue;
        const uid = throwable("grenade_sainte", m.x, m.y);
        if (uid !== null && game.throwPotion(uid, m.x, m.y)) return (mem.potions++, true);
      }
    }
    // Gel : deux ennemis dans la croix restent figés trois tours.
    if (hasItem(game, "potion_gel") !== null) {
      for (const m of alerted) {
        if (m.boss || cheb(m, hero) < 2) continue;
        const inCross = alerted.filter((o) => !o.boss && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= 1);
        if (inCross.length < 2) continue;
        const uid = throwable("potion_gel", m.x, m.y);
        if (uid !== null && game.throwPotion(uid, m.x, m.y)) return (mem.potions++, true);
      }
    }
    // Pierre : contre un groupe, on fige le plus dangereux.
    if (alerted.length >= 2 && hasItem(game, "potion_pierre") !== null) {
      const m = alerted.filter((o) => !o.boss).sort((a, b) => b.hp * avgDice(b.damage) - a.hp * avgDice(a.damage))[0];
      if (m && cheb(m, hero) >= 2) {
        const uid = throwable("potion_pierre", m.x, m.y);
        if (uid !== null && game.throwPotion(uid, m.x, m.y)) return (mem.potions++, true);
      }
    }
    // Fumée : mal en point et cerné, ceux qui sont tout près perdent la trace (et se font frapper par surprise).
    if (hp() < 0.5 && hasItem(game, "potion_brouillard") !== null) {
      const close = alerted.filter((o) => !o.boss && gapBetween(o, hero) <= 1);
      if (close.length >= 2) {
        const c = close[0];
        const uid = throwable("potion_brouillard", c.x, c.y);
        if (uid !== null && game.throwPotion(uid, c.x, c.y)) return (mem.potions++, true);
      }
    }
    return false;
  };

  /** Un couloir tout proche où un groupe ne peut plus encercler. */
  const chokeStep = (alerted: Actor[]): boolean => {
    if (off.choke) return false;
    const melee = alerted.filter((m) => !monsterDef(m)?.sling && !m.boss);
    if (melee.length < 2 || melee.some((m) => gapBetween(m, hero) <= 1)) return false;
    if (openness(game, hero) <= 2) return false;
    const far = (x: number, y: number) => melee.every((m) => cheb(m, { x, y }) >= 2);
    const pass = (x: number, y: number) => safeCell(x, y) && game.isExplored(x, y) && far(x, y);
    const near = Math.min(...melee.map((m) => cheb(m, hero)));
    const path = route(game, pass, (x, y) => openness(game, { x, y }) <= 2 && !game.map.isDoor(x, y) && Math.min(...melee.map((m) => cheb(m, { x, y }))) >= Math.min(near, 2), 120);
    if (!path || path.length === 0 || path.length > 5) return false;
    mem.anchor = path[path.length - 1];
    return stepTo(path[0]);
  };

  const combat = (foes: Actor[]): boolean => {
    const alerted = foes.filter((m) => awake(m) && !(m.cower ?? 0));
    if (alerted.length === 0) {
      mem.hold = 0;
      mem.anchor = null;
      return false;
    }
    const adj = alerted.filter((m) => gapBetween(m, hero) <= 1);
    const r = hp();
    // 1. Mal en point : second souffle, puis manger.
    if (r < 0.45 && game.voie === "blue" && game.skillRefusal() === null && game.useSkill()) return true;
    const danger = adj.reduce((n, m) => n + avgDice(m.damage), 0) + alerted.filter((m) => monsterDef(m)?.sling).length * 2.5;
    if ((r < 0.4 || hero.hp <= danger * 1.3) && hero.hp < hero.maxHp && eat(game, true)) return true;
    // 2. Potions à lancer.
    if (throwSomething(alerted)) return true;
    // Rang III. Bastion (bleu) : trois tours de dégâts divisés par deux, quand on est cerné, mal en point, ou face à un boss.
    if (game.voie === "blue" && game.rank("bastion" as never) > 0 && adj.length > 0 && (adj.length >= 2 || r < 0.5 || adj.some((m) => !!m.boss)) && game.powerRefusal("bastion" as never) === null && game.usePower("bastion" as never)) return true;
    // Exécution (rouge) : achever net un ennemi au contact déjà bien entamé, quand un coup ordinaire ne suffirait pas.
    if (game.voie === "red" && game.rank("execution" as never) > 0 && adj.some((m) => !m.boss && m.hp > heroHit() * 0.8) && game.powerRefusal("execution" as never) === null && game.usePower("execution" as never)) return true;
    // Voie rouge, rang II : le Cri de guerre contre un groupe (désavantage pour eux), le Tourbillon dès que deux
    // ennemis sont au contact.
    if (game.voie === "red") {
      const close = alerted.filter((m) => gapBetween(m, hero) <= 3).length;
      if (game.rank("cri_guerre" as never) > 0 && (close >= 3 || (close >= 2 && r < 0.6)) && game.powerRefusal("cri_guerre") === null && game.usePower("cri_guerre")) return true;
      if (game.rank("tourbillon" as never) > 0 && adj.length >= 2 && game.powerRefusal("tourbillon") === null && game.usePower("tourbillon")) return true;
    }
    // 3. Gros combat au contact : vitesse, oursin, poison sur l'arme.
    const bigFight = alerted.length >= 3 || alerted.some((m) => m.maxHp >= 20) || (alerted.length >= 2 && r < 0.6);
    if (!off.potions && adj.length > 0) {
      if (bigFight && game.hasteTurns === 0 && drink("potion_vitesse")) return true;
      if (bigFight && game.urchinTurns === 0 && adj.length >= 2 && drink("potion_oursin")) return true;
      if (game.weaponPoison === 0 && adj.some((m) => !m.boss && !monsterDef(m)?.inert && m.hp >= 9 && !m.poison) && drink("potion_poison")) return true;
    }
    if (adj.length > 0) {
      mem.hold = 0;
      // 4. Au contact : d'abord celui qui est à terre ou sonné (avantage), puis le plus abîmé.
      const down = (m: Actor) => (m.prone ?? 0) > 0 || (m.stunned ?? 0) > 0 || (m.boss?.fallen ?? 0) > 0;
      const target = adj.slice().sort((a, b) => Number(down(b)) - Number(down(a)) || a.hp - b.hp)[0];
      // Pousser contre un mur : il tombe à terre (1d6, il perd son tour, le coup suivant a l'avantage).
      if (!off.push && !down(target) && target.hp > heroHit() && game.pushTargets().some((m) => m.id === target.id)) {
        const dx = Math.sign(target.x - hero.x);
        const dy = Math.sign(target.y - hero.y);
        const bx = target.x + dx;
        const by = target.y + dy;
        const solid = !game.map.isWalkable(bx, by) || game.map.get(bx, by) === Tile.DoorClosed;
        const bonus = game.pushBonus() + [0, 2, 4][game.rank("enchainement")];
        const dangerous = avgDice(target.damage) >= 3 || adj.length >= 2 || r < 0.6;
        if (solid && bonus >= 4 && dangerous && !game.heroHasAdvantageOn(target) && game.push(target.id)) return (mem.pushes++, true);
      }
      // Sporelin : il éclate en nuage de spores sur sa case et ses quatre voisines. On le frappe en diagonale.
      if (monsterDef(target)?.burstGas && adj.length === 1 && (target.x === hero.x || target.y === hero.y)) {
        const k = key(`diag:${target.id}`);
        const n = mem.tries.get(k) ?? 0;
        const spot = DIRS8.map(([dx, dy]) => ({ x: hero.x + dx, y: hero.y + dy })).find((q) => Math.abs(q.x - target.x) === 1 && Math.abs(q.y - target.y) === 1 && canStep(game.map, hero.x, hero.y, q.x - hero.x, q.y - hero.y) && safeCell(q.x, q.y));
        if (spot && n < 2) {
          mem.tries.set(k, n + 1);
          return stepTo(spot);
        }
      }
      if (adj.length >= 2 && game.powerRefusal("tourbillon") === null && game.usePower("tourbillon")) return true;
      if (game.visibleMonsters().filter((f) => cheb(f, hero) <= 3).length >= 2 && game.powerRefusal("cri_guerre") === null && game.usePower("cri_guerre")) return true;
      if (game.voie === "red" && target.hp > heroHit() && game.skillRefusal() === null && game.useSkill()) return true;
      const c = cellsOf(target).reduce((a, b) => (cheb(b, hero) < cheb(a, hero) ? b : a));
      return game.setDestination(c.x, c.y);
    }
    // 5. Personne au contact. Allonge (lance) : on pique à deux cases.
    const reach = alerted.find((m) => game.inWeaponReach(m));
    if (reach) return game.setDestination(reach.x, reach.y);
    // Tirer : les frondeurs d'abord (ils ne viendront pas), puis le plus proche.
    const byNear = alerted.slice().sort((a, b) => Number(!!monsterDef(b)?.sling) - Number(!!monsterDef(a)?.sling) || gapBetween(a, hero) - gapBetween(b, hero));
    if (!off.bow) for (const m of byNear) if (tryShoot(game, m, mem)) return true;
    // Charge (voie rouge) : fondre sur celui qui approche, avec le bonus au toucher, plutôt que de l'attendre.
    if (game.voie === "red" && game.rank("charge" as never) > 0 && game.powerRefusal("charge") === null && game.usePower("charge")) return true;
    // Se replier dans un couloir contre un groupe.
    if (chokeStep(alerted)) return true;
    const nearest = alerted.reduce((a, b) => (gapBetween(b, hero) < gapBetween(a, hero) ? b : a));
    const comes = !monsterDef(nearest)?.sling && !(nearest.fleeTurns ?? 0) && !(nearest.lost ?? 0) && nearest.defId !== "carillon" && !(nearest.stuck ?? 0);
    // 6. L'attendre : il arrive, on frappe le premier (et souvent avec l'avantage de l'embuscade).
    if (!off.hold && comes && mem.hold < (nearest.boss ? 14 : 5)) {
      mem.hold++;
      game.wait();
      return true;
    }
    mem.hold = 0;
    const c = cellsOf(nearest).reduce((a, b) => (cheb(b, hero) < cheb(a, hero) ? b : a));
    return game.setDestination(c.x, c.y);
  };

  // ---------- Boss ----------

  const hubCells = (): Point[] => {
    const hub = game.bossLayout()!.hub;
    const out: Point[] = [];
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) out.push({ x: hub.x + dx, y: hub.y + dy });
    return out;
  };
  /** Feu sur la grande toile : où viser pour qu'elle s'effondre (plus de la moitié des 9 cases près d'une flamme). */
  const hubShot = (from: Point, torch: boolean): Point | null => {
    const cells = hubCells();
    let best: Point | null = null;
    for (const c of cells) {
      if (cheb(c, from) > 5 || cheb(c, from) < 2) continue;
      const flames = torch ? [c] : [c, { x: c.x + 1, y: c.y }, { x: c.x - 1, y: c.y }, { x: c.x, y: c.y + 1 }, { x: c.x, y: c.y - 1 }].filter((f) => game.map.isWalkable(f.x, f.y));
      const burnt = cells.filter((h) => flames.some((f) => cheb(f, h) <= 1)).length;
      if (burnt >= 5 && hasLineOfSight(game.map, from, c) && (!best || cheb(c, from) > cheb(best, from))) best = c;
    }
    return best;
  };

  const weaver = (queen: Actor, foes: Actor[]): boolean => {
    const st = queen.boss!;
    const fireId = hasItem(game, "potion_feu") !== null ? "potion_feu" : hasItem(game, "torche") !== null ? "torche" : null;
    const quiet = (x: number, y: number) => game.map.isWalkable(x, y) && !game.monsterAt(x, y) && !game.stickyAt(x, y) && !game.isBurning(x, y) && gapBetween(queen, { x, y }) > RULES.bossSenseRange;
    const fighting = st.engaged || st.fallen > 0;
    if (!fighting) {
      // Avant de la réveiller : se soigner, crever les cocons (sa nourriture), puis le feu sur sa grande toile.
      if (foes.every((m) => !awake(m)) && calmHeal(game, 0.9, 0.8)) return true;
      const cocoons = game.furnitureList().filter((f) => f.kind.startsWith("cocoon") && gapBetween(queen, f) > RULES.bossSenseRange + 1);
      let best: { path: Point[]; f: Point } | null = null;
      for (const f of cocoons) {
        if (mem.noGo.has(key(`cocoon:${f.x},${f.y}`))) continue;
        const path = route(game, quiet, (x, y) => cheb({ x, y }, f) === 1 && quiet(x, y));
        if (!path) {
          mem.noGo.add(key(`cocoon:${f.x},${f.y}`));
          continue;
        }
        if (!best || path.length < best.path.length) best = { path, f };
      }
      if (best) {
        const f = best.f;
        if (best.path.length === 0) return aim(`cocoon:${f.x},${f.y}`, 6, () => game.setDestination(f.x, f.y, true));
        return stepTo(best.path[0]);
      }
      if (fireId && st.hubUp && !mem.openerDone.has(game.depth) && cellsOf(queen).some((c) => hubCells().some((h) => h.x === c.x && h.y === c.y))) {
        const torch = fireId === "torche";
        const here = hubShot(hero, torch);
        if (here && game.isVisible(here.x, here.y)) {
          const uid = throwable(fireId, here.x, here.y);
          mem.openerDone.add(game.depth);
          if (uid !== null && game.throwPotion(uid, here.x, here.y)) return (mem.potions++, true);
        }
        const path = route(game, quiet, (x, y) => quiet(x, y) && hubShot({ x, y }, torch) !== null);
        if (path && path.length > 0) return stepTo(path[0]);
        mem.openerDone.add(game.depth);
      }
      // Sinon : une flèche de loin (elle ne s'y attend pas), puis on y va par les sentiers sans toile.
      if (tryShoot(game, queen, mem)) return true;
      const path = route(game, (x, y) => game.map.isWalkable(x, y) && !game.monsterAt(x, y) && !game.stickyAt(x, y), (x, y) => gapBetween(queen, { x, y }) === 1);
      if (path && path.length > 0) return stepTo(path[0]);
      const c = cellsOf(queen)[0];
      return game.setDestination(c.x, c.y, true);
    }
    // Le combat. Les soins et les petites araignées passent par les règles ordinaires.
    const gapQ = gapBetween(queen, hero);
    const others = foes.filter((m) => m !== queen && awake(m) && gapBetween(m, hero) <= 1);
    if (hp() < 0.4 || others.length > 0) return false;
    const onHub = st.hubUp && cellsOf(queen).some((c) => hubCells().some((h) => h.x === c.x && h.y === c.y));
    if (fireId && onHub && gapQ > 1) {
      const c = hubShot(hero, fireId === "torche");
      const uid = c ? throwable(fireId, c.x, c.y) : null;
      if (c && uid !== null && game.throwPotion(uid, c.x, c.y)) return (mem.potions++, true);
    }
    // Du feu sur elle quand elle arrive (elle brûle deux fois plus), hors de portée de l'éclaboussure.
    if (hasItem(game, "potion_feu") !== null && gapQ >= 3 && st.fallen === 0 && !cellsOf(queen).some((c) => game.isBurning(c.x, c.y))) {
      const c = cellsOf(queen).filter((q) => cheb(q, hero) >= 3).sort((a, b) => cheb(a, hero) - cheb(b, hero))[0];
      const uid = c ? throwable("potion_feu", c.x, c.y) : null;
      if (c && uid !== null && game.throwPotion(uid, c.x, c.y)) return (mem.potions++, true);
    }
    // Les œufs, tant qu'elle est loin : pas de petites araignées à mi-vie.
    if (!st.hatched && gapQ > 3) {
      const sacs = game.furnitureList().filter((f) => f.kind === "eggSac");
      for (const f of sacs) {
        const free = (x: number, y: number) => game.map.isWalkable(x, y) && !game.monsterAt(x, y) && !game.stickyAt(x, y) && !game.isBurning(x, y);
        const path = route(game, free, (x, y) => cheb({ x, y }, f) === 1 && free(x, y), 200);
        if (!path || path.length > 4) continue;
        if (path.length === 0) {
          if (aim(`egg:${f.x},${f.y}`, 4, () => game.setDestination(f.x, f.y, true))) return true;
        } else return stepTo(path[0]);
      }
    }
    if (!off.potions && gapQ <= 1 && queen.hp > 20) {
      if (!(hero.grown ?? 0) && drink("potion_geant")) return true;
      if (game.hasteTurns === 0 && drink("potion_vitesse")) return true;
      if (game.urchinTurns === 0 && drink("potion_oursin")) return true;
    }
    // Sur le dos : on fonce (avantage), par un chemin sans feu.
    if (st.fallen > 0 && gapQ > 1) {
      if (tryShoot(game, queen, mem)) return true;
      const free = (x: number, y: number) => game.map.isWalkable(x, y) && !game.monsterAt(x, y) && !game.isBurning(x, y);
      const path = route(game, free, (x, y) => gapBetween(queen, { x, y }) === 1 && free(x, y), 400);
      if (path && path.length > 0) return stepTo(path[0]);
    }
    // Elle recule : on ne la suit pas sur la toile ; on se place sur une case sans toile et on l'attend (ou on tire).
    if (gapQ > 1 && game.stickyAt(hero.x, hero.y)) {
      const free = (x: number, y: number) => game.map.isWalkable(x, y) && !game.monsterAt(x, y) && !game.isBurning(x, y);
      const path = route(game, free, (x, y) => free(x, y) && !game.stickyAt(x, y), 200);
      if (path && path.length > 0 && path.length <= 3) return stepTo(path[0]);
    }
    return false;
  };

  const bell = (boss: Actor, foes: Actor[]): boolean => {
    mem.sawBell = true;
    const st = boss.boss!;
    const layout = game.bossLayout()!;
    const inLair = game.inLairPublic(hero);
    if (!st.engaged && !inLair && foes.every((m) => !awake(m)) && calmHeal(game, 0.95, 0.85)) return true;
    const adds = foes.filter((m) => m !== boss && awake(m) && isFoe(m) && gapBetween(m, hero) <= 1);
    if (hp() < 0.4 || adds.length > 0) return false;
    const free = (x: number, y: number) => game.map.isWalkable(x, y) && !game.monsterAt(x, y) && !game.isBurning(x, y) && !game.inkMarkedAt(x, y);
    // 1. Le battant : une poussée réussie l'arrache, et il ne sonnera plus jamais.
    const clapper = game.monsters.find((m) => m.defId === "battant");
    if (clapper && st.clapperUp) {
      if (cheb(clapper, hero) <= 1) {
        if (!off.push && game.pushTargets().some((m) => m.id === clapper.id) && game.push(clapper.id)) return (mem.pushes++, true);
        return game.setDestination(clapper.x, clapper.y);
      }
      const path = route(game, free, (x, y) => cheb({ x, y }, clapper) === 1 && free(x, y), 600);
      if (path && path.length > 0) return stepTo(path[0]);
    }
    const gapB = gapBetween(boss, hero);
    // 2. Le feu (il brûle deux fois plus) : sur une de ses cases, loin de la nôtre.
    const burning = cellsOf(boss).some((c) => game.isBurning(c.x, c.y));
    if (!burning && inLair) {
      for (const id of ["potion_feu", "torche"]) {
        if (hasItem(game, id) === null) continue;
        const min = id === "torche" ? 2 : 3;
        const c = cellsOf(boss).filter((q) => cheb(q, hero) >= min).sort((a, b) => cheb(a, hero) - cheb(b, hero))[0];
        const uid = c ? throwable(id, c.x, c.y) : null;
        if (c && uid !== null && game.throwPotion(uid, c.x, c.y)) return (mem.potions++, true);
      }
    }
    // 3. Collé à lui (l'encre ne vise plus notre case) ; on s'écarte d'une goutte annoncée sans le lâcher.
    if (gapB <= 1) {
      if (game.inkMarkedAt(hero.x, hero.y) || game.isBurning(hero.x, hero.y)) {
        const spots = DIRS8.map(([dx, dy]) => ({ x: hero.x + dx, y: hero.y + dy })).filter((p) => canStep(game.map, hero.x, hero.y, p.x - hero.x, p.y - hero.y) && free(p.x, p.y) && !cellsOf(boss).some((c) => c.x === p.x && c.y === p.y));
        const keep = spots.filter((p) => gapBetween(boss, p) <= 1);
        const to = keep[0] ?? spots[0];
        if (to) return stepTo(to);
      }
      if (!off.potions && boss.hp > 30) {
        if (!(hero.grown ?? 0) && drink("potion_geant")) return true;
        if (game.hasteTurns === 0 && drink("potion_vitesse")) return true;
        if (game.urchinTurns === 0 && drink("potion_oursin")) return true;
      }
      if (game.voie === "red" && game.skillRefusal() === null && game.useSkill()) return true;
      const c = cellsOf(boss).reduce((a, b) => (cheb(b, hero) < cheb(a, hero) ? b : a));
      return game.setDestination(c.x, c.y);
    }
    // 4. Y aller, sans marcher dans le feu ni sous une goutte.
    const path = route(game, free, (x, y) => gapBetween(boss, { x, y }) === 1 && free(x, y) && !cellsOf(boss).some((c) => c.x === x && c.y === y), 900);
    if (path && path.length > 0) return stepTo(path[0]);
    void layout;
    return false;
  };

  /** La Grande Prêtresse : quand elle chante dans le puits (hors d'atteinte), le Colosse est debout. Son cœur n'est à nu
   *  qu'une fois le crâne cassé (ou les deux bras) : le crâne d'abord, puis le corps, vite, avant que la lune ne le répare. */
  const priestess = (boss: Actor, foes: Actor[]): boolean => {
    if (!(boss as { aloft?: boolean }).aloft) return false;
    if (hp() < 0.4 && (eat(game, true) || (game.voie === "blue" && game.skillRefusal() === null && game.useSkill()))) return true;
    const head = game.monsters.find((m) => m.defId === "craneColosse");
    const body = game.monsters.find((m) => m.defId === "colosse");
    const target = head ?? body;
    if (!target) return false;
    // Un mort ordinaire collé à nous passe d'abord (il frappe à chaque tour).
    const pest = foes.find((m) => m !== boss && awake(m) && !["colosse", "brasColosse", "craneColosse"].includes(m.defId) && gapBetween(m, hero) <= 1);
    if (pest) return game.setDestination(pest.x, pest.y);
    if (tryShoot(game, target, mem)) return true;
    const c = cellsOf(target).reduce((a, b) => (cheb(b, hero) < cheb(a, hero) ? b : a));
    if (gapBetween(target, hero) <= 1) {
      if (game.voie === "blue" && game.rank("bastion" as never) > 0 && game.powerRefusal("bastion" as never) === null && game.usePower("bastion" as never)) return true;
      return game.setDestination(c.x, c.y);
    }
    const free = (x: number, y: number) => game.map.isWalkable(x, y) && !game.monsterAt(x, y) && !game.isBurning(x, y);
    const path = route(game, free, (x, y) => gapBetween(target, { x, y }) === 1 && free(x, y), 900);
    if (path && path.length > 0) return stepTo(path[0]);
    return game.setDestination(c.x, c.y);
  };

  // ---------- Hors combat ----------

  /** Le Colporteur : vendre le rebut, acheter ce qui compte. */
  const trade = () => {
    const m = game.merchant()!;
    for (const item of [...game.inventory.items]) {
      if (!isJunk(game, item) || game.sellPrice(item.uid) === null) continue;
      if (game.sell(item.uid)) mem.sold++;
    }
    const potionValue: Record<string, number> = { youth: 60, fire: 30, haste: 28, grow: 26, urchin: 15, stone: 14, poison: 14, discord: 12, frost: 14, smoke: 10, fog: 2, slip: 2, night: 2 };
    const value = (id: ItemId, count: number): number => {
      const d = defOf(id);
      if (d.heal) {
        const stock = foods(game).reduce((n, f) => n + f.heal * (game.inventory.items.find((i) => i.uid === f.uid)?.count ?? 1), 0);
        return stock < 30 ? 45 - stock : 6;
      }
      if (isGear(d)) {
        if ((d.level ?? 1) > game.level + 1) return 0;
        const bagBest = Math.max(0, ...game.inventory.items.filter((i) => defOf(i.defId).kind === d.kind).map((i) => gearScore(game, defOf(i.defId))));
        const delta = gearScore(game, d) - Math.max(wornScore(game, d.kind), bagBest);
        if (delta <= 0) return 0;
        const weight: Record<string, number> = { armor: 25, hat: 25, melee: 18, ranged: 6, bag: 1, amulet: 8, artifact: 10 };
        return 20 + delta * (weight[d.kind] ?? 5);
      }
      if (d.id === "grenade_sainte") return 24;
      if (d.potion) return potionValue[d.potion] ?? 0;
      if (d.kind === "ammo") {
        if (game.tooLow(d)) return 0;
        if (d.ammoFamily === "jet") return game.inventory.count(id) < 3 ? 14 : 4;
        if (!game.weapon("ranged")) return 0;
        const arrows = game.inventory.count("fleche") + game.inventory.count("fleche_poison") + game.inventory.count("fleche_ricochet");
        return (arrows < 12 ? 26 : 8) + (id === "fleche" ? 0 : 4) + count * 0;
      }
      if (id === "torche") return game.inventory.count("torche") < 1 ? 10 : 0;
      return 0;
    };
    for (let n = 0; n < 8; n++) {
      let best = -1;
      let bestScore = 9;
      m.wares.forEach((w, i) => {
        if (w.price > game.gold) return;
        const v = value(w.item, w.count);
        // À valeur égale, le moins cher : on garde de quoi acheter autre chose.
        const score = v - w.price * 0.1;
        if (v >= 10 && score > bestScore) {
          best = i;
          bestScore = score;
        }
      });
      if (best < 0) break;
      const price = m.wares[best].price;
      if (game.buy(best) !== "ok") break;
      mem.bought++;
      spent += price;
      equipBestX(game);
    }
  };

  /** Les choses à ouvrir, forcer, toucher, connues sur l'étage. */
  const features = (): boolean => {
    if (off.features) return false;
    const { map } = game;
    const calm = game.alarm().stage < 2;
    // Le poulet : le déranger ouvre sa salle fermée (un coffre, une cuisse).
    const chickenDoors: Point[] = [];
    for (const c of game.chickens()) {
      if (c.door) chickenDoors.push(c.door);
      if (!c.done && game.isVisible(c.x, c.y) && aim(`chicken:${c.x},${c.y}`, 60, () => game.setDestination(c.x, c.y))) return true;
    }
    // Coffres, portes verrouillées : la plus proche d'abord.
    const spots: { p: Point; kind: string }[] = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!game.isExplored(x, y)) continue;
        const t = map.get(x, y);
        if (t === Tile.Chest) spots.push({ p: { x, y }, kind: "chest" });
        else if (t === Tile.DoorLocked && !chickenDoors.some((d) => d.x === x && d.y === y) && !game.sealedBlockedAt(x, y) && !game.zoneDoorAt(x, y)) spots.push({ p: { x, y }, kind: "door" });
      }
    }
    for (const f of game.furnitureList()) {
      if (!game.isExplored(f.x, f.y)) continue;
      if (game.maidenAt(f.x, f.y)) spots.push({ p: f, kind: "maiden" });
      else if (game.grilleAt(f.x, f.y) && calm) spots.push({ p: f, kind: "grille" });
      else if (game.alembicAt(f.x, f.y) && !f.drained) spots.push({ p: f, kind: "alembic" });
      else if (game.plateTableAt(f.x, f.y)?.plate) spots.push({ p: f, kind: "plate" });
    }
    spots.sort((a, b) => cheb(a.p, hero) - cheb(b.p, hero));
    for (const s of spots) {
      const k = `${s.kind}:${s.p.x},${s.p.y}`;
      const limit = s.kind === "grille" ? 3 : 90;
      if (s.kind === "grille" && cheb(s.p, hero) > 1) {
        // On ne compte que les essais au contact.
        if (mem.noGo.has(key(k))) continue;
        if (game.setDestination(s.p.x, s.p.y)) return true;
        mem.noGo.add(key(k));
        continue;
      }
      if (aim(k, limit, () => game.setDestination(s.p.x, s.p.y))) return true;
    }
    return false;
  };

  /** Devant une porte verrouillée ou un sarcophage : la clef, sinon crocheter, sinon enfoncer (si c'est raisonnable). */
  const door = (): boolean => {
    const d = game.pendingDoor;
    if (!d) return false;
    if (game.usingKey()) return true;
    const options = game.doorOptions().filter((o) => o !== "peek");
    const maiden = !!game.maidenAt(d.x, d.y);
    let pick = options.includes("pick") ? "pick" : null;
    if (!pick && options.includes("break") && (maiden || mem.desperate.has(game.depth) || (hp() >= 0.7 && game.alarm().stage < 1))) pick = "break";
    if (pick && game.actOnDoor(pick as never)) {
      mem.doors++;
      return true;
    }
    game.cancelDoor();
    mem.noGo.add(key(`door:${d.x},${d.y}`));
    mem.noGo.add(key(`maiden:${d.x},${d.y}`));
    return false;
  };

  /** Fouiller la salle où l'on se tient, puis les autres salles connues. */
  const searchRooms = (): boolean => {
    if (off.search || game.alarm().stage >= 2 || game.isBossDepth(game.depth)) return false;
    const here = game.roomIndexAt(hero);
    if (here >= 0 && !mem.noGo.has(key(`search:${here}`))) {
      const why = game.searchRefusal();
      if (why === null) {
        if (aim(`search:${here}`, 5, () => game.search())) return (mem.searches++, true);
      } else if (why === "searched") mem.noGo.add(key(`search:${here}`));
    }
    let best: { i: number; path: Point[] } | null = null;
    game.rooms.forEach((room, i) => {
      if (mem.noGo.has(key(`search:${i}`)) || mem.noGo.has(key(`goroom:${i}`))) return;
      const cx = room.x + Math.floor(room.w / 2);
      const cy = room.y + Math.floor(room.h / 2);
      if (!game.isExplored(cx, cy) && !game.isExplored(room.x, room.y)) return;
      const pass = (x: number, y: number) => safeCell(x, y) && game.isExplored(x, y) && map2(x, y);
      const path = route(game, pass, (x, y) => game.roomIndexAt({ x, y }) === i && pass(x, y), 1400);
      if (!path) {
        mem.noGo.add(key(`goroom:${i}`));
        return;
      }
      if (path.length > 0 && (!best || path.length < best.path.length)) best = { i, path };
    });
    const b = best as { i: number; path: Point[] } | null;
    if (b) return aim(`goroom:${b.i}`, 80, () => stepTo(b.path[0]));
    return false;
  };
  const map2 = (x: number, y: number) => {
    const t = game.map.get(x, y);
    return t !== Tile.StairsDown && t !== Tile.StairsUp;
  };

  const quests = (): boolean => {
    if (off.quests) return false;
    const quest = game.quest && game.quest.depth === game.depth ? game.quest : null;
    if (quest) {
      const def = QUEST_TASKS[quest.id];
      const giver = game.npc(def.npc);
      if (game.questDone() && giver) {
        if (game.canTalk(def.npc)) {
          talkX(game, def.npc);
          talks++;
          return true;
        }
        return aim(`turnin:${quest.id}`, 150, () => game.setDestination(giver.x, giver.y));
      }
      const zone = game.zone();
      if (def.zone && zone && !zone.open && aim(`zone:${zone.entry.x},${zone.entry.y}`, 90, () => game.setDestination(zone.entry.x, zone.entry.y, true))) return true;
      if (def.kind === "fetch") {
        const it = game.ground.find((g) => g.item === def.item && game.isExplored(g.x, g.y));
        if (it) {
          if (game.itemsHere().some((g) => g.item === def.item)) return game.pickUp();
          return aim(`fetch:${it.x},${it.y}`, 120, () => game.setDestination(it.x, it.y));
        }
      } else if (def.kind === "statue") {
        const st = game.furnitureList().find((f) => f.kind === "statue" && f.hollow && f.hinted);
        if (st && hp() > 0.5 && aim(`statue:${st.x},${st.y}`, 60, () => game.setDestination(st.x, st.y))) return true;
      }
      return false;
    }
    if (game.inCombat()) return false;
    for (const id of NPC_IDS) {
      const g = game.npc(id);
      if (!g || !game.isExplored(g.x, g.y) || mem.talked.has(key(id))) continue;
      if (game.canTalk(id)) {
        mem.talked.add(key(id));
        talkX(game, id);
        talks++;
        return true;
      }
      if (aim(`npc:${id}`, 120, () => game.setDestination(g.x, g.y))) return true;
    }
    return false;
  };

  const shop = (): boolean => {
    if (off.shop) return false;
    const m = game.merchant();
    const section = Math.floor((game.depth - 1) / RULES.floorsPerSection);
    if (!m || m.hidden || mem.shopDone.has(section) || !game.isExplored(m.x, m.y) || game.inCombat()) return false;
    if (game.canTrade()) {
      trade();
      mem.shopDone.add(section);
      return false;
    }
    return aim("shop", 160, () => game.setDestination(m.x, m.y));
  };

  /** Ramasser ce qui traîne : sous ses pieds d'abord, puis le plus proche des objets connus. */
  const loot = (): boolean => {
    const wanted = (g: { item: ItemId; x: number; y: number }) => {
      if (mem.leave.has(`${game.depth}:${g.item}@${g.x},${g.y}`)) return false;
      const d = defOf(g.item) as ItemDef | undefined;
      if (!d) return true;
      // L'Elfe (flèches sans fin) ne ramasse plus les flèches simples : inutile de courir après.
      if (g.item === "fleche" && game.endlessAmmo("fleche")) return false;
      if (d.kind === "quest") {
        const q = game.quest ? (QUEST_TASKS[game.quest.id] as { item?: string; items?: string[] }) : null;
        return !!q && (q.item === g.item || !!q.items?.includes(g.item));
      }
      return true;
    };
    const here = game.itemsHere().filter(wanted);
    if (here.length > 0 && here[0] === game.itemsHere()[0]) {
      const g = here[0];
      const k = `pick:${g.item}@${g.x},${g.y}`;
      const n = (mem.tries.get(key(k)) ?? 0) + 1;
      mem.tries.set(key(k), n);
      if (n > 3) {
        // Il ne rentre pas : on fait de la place une fois, sinon on le laisse.
        if (n === 4 && makeRoom(game, mem)) return game.pickUp();
        mem.leave.add(`${game.depth}:${g.item}@${g.x},${g.y}`);
      } else return game.pickUp();
    } else if (game.itemsHere().length > 0 && here.length > 0) {
      // Un objet laissé exprès est posé dessus : tant pis pour ceux du dessous.
      for (const g of here) mem.leave.add(`${game.depth}:${g.item}@${g.x},${g.y}`);
    }
    const items = game.ground.filter((g) => game.isExplored(g.x, g.y) && wanted(g) && map2(g.x, g.y) && !game.knownTrap(g.x, g.y) && !mem.noGo.has(key(`item:${g.x},${g.y}`)));
    if (items.length === 0) return false;
    items.sort((a, b) => cheb(a, hero) - cheb(b, hero));
    for (const it of items.slice(0, 4)) if (aim(`item:${it.x},${it.y}`, 110, () => game.setDestination(it.x, it.y))) return true;
    return false;
  };

  /** Descendre : autel d'abord (soin complet et bénédiction pour la suite), repos, puis l'escalier. */
  const leave = (): boolean => {
    const { map } = game;
    if (game.bossActor()) return false;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.get(x, y) === Tile.Fountain && game.isExplored(x, y) && aim(`altar:${x},${y}`, 110, () => game.setDestination(x, y))) return true;
      }
    }
    if (calmHeal(game, 0.85, 0.6)) return true;
    const seal = game.furnitureList().find((f) => f.kind === "sealedStairs");
    if (seal && game.isBossDepth(game.depth)) return aim("seal", 200, () => game.setDestination(seal.x, seal.y, true));
    const stairs = stairsSeen(game);
    // L'escalier : on n'y renonce jamais (un passage bouché un instant se rouvre).
    if (stairs) return game.setDestination(stairs.x, stairs.y, true);
    return false;
  };

  // ---------- La boucle ----------

  while (!game.over && game.turn < maxTurns) {
    if (game.pendingStairs === "down" && game.takeStairs()) continue;
    upkeep();
    const foes = game.visibleMonsters().filter((m) => isFoe(m) && (mem.ignore.get(m.id) ?? 0) < game.turn && !(m as { aloft?: boolean }).aloft);
    // Un combat qui n'avance pas (personne ne perd de vie pendant 40 tours) : ces monstres sont hors d'atteinte.
    const sum = hero.hp + game.monsters.reduce((n, m) => n + m.hp, 0) + game.depth * 100000;
    if (foes.some((m) => m.alerted && !m.asleep) && sum === mem.staleSum) mem.stale++;
    else mem.stale = 0;
    mem.staleSum = sum;
    if (mem.stale > 40) {
      for (const m of foes) if (!m.boss) mem.ignore.set(m.id, game.turn + 200);
      mem.stale = 0;
      continue;
    }
    const boss = game.bossActor();
    if (game.depth === RULES.bossDepths[0] && !boss) weaverDown = true;
    if (mem.sawBell && !boss) mem.bellDown = true;
    if (boss?.defId === "pretresse") sawPriestess = true;
    if (sawPriestess && !boss && game.depth === RULES.bossDepths[2]) priestessDown = true;
    let acted = false;

    // Un repos ou une fouille en cours continue tant que rien ne vient.
    const alertedNow = foes.some((m) => awake(m));
    // Sortir du feu, du gaz, de sous une goutte d'encre.
    if (!acted && (game.isBurning(hero.x, hero.y) || game.isGassed(hero.x, hero.y) || (game.inkMarkedAt(hero.x, hero.y) && (!boss || gapBetween(boss, hero) > 1)))) {
      const spots = DIRS8.map(([dx, dy]) => ({ x: hero.x + dx, y: hero.y + dy })).filter((p) => canStep(game.map, hero.x, hero.y, p.x - hero.x, p.y - hero.y) && safeCell(p.x, p.y) && map2(p.x, p.y));
      if (spots.length > 0) {
        const threats = foes.filter(awake);
        spots.sort((a, b) => threats.filter((m) => gapBetween(m, a) <= 1).length - threats.filter((m) => gapBetween(m, b) <= 1).length);
        acted = stepTo(spots[0]);
      }
    }
    let why = acted ? "danger" : "";
    const rule = (name: string, fn: () => boolean) => {
      if (acted) return;
      acted = fn();
      if (acted) why = name;
    };
    if (boss && !off.bossPlan) rule("boss", () => (boss.defId === "carillon" ? bell(boss, foes) : game.depth === RULES.bossDepths[0] ? weaver(boss, foes) : boss.defId === "pretresse" ? priestess(boss, foes) : false));
    rule("combat", () => combat(foes));
    rule("suite", () => !alertedNow && (game.restProgress() > 0 || game.searchProgress() > 0));
    rule("porte", () => !alertedNow && door());
    // Au calme : jouvence (tous les points reviennent, plus un), soins.
    rule("soin", () => foes.length === 0 && ((hasItem(game, "potion_jouvence") !== null && drink("potion_jouvence")) || calmHeal(game, 0.7, 0.5)));
    // Ceux qui ne nous ont pas vus : par surprise (avantage). Les dormeurs sont laissés quand l'XP est bloquée.
    rule("surprise", () => {
      const hunting = !!game.quest && game.quest.depth === game.depth && QUEST_TASKS[game.quest.id].kind === "kill";
      const prey = foes.filter((m) => !awake(m) && !(m.petrified ?? 0) && !(m.boss && !m.boss.engaged) && (hunting || !game.xpBlocked() || !m.asleep || gapBetween(m, hero) <= 2));
      if (prey.length === 0) return false;
      if (hp() < 0.5 && eat(game, false)) return true;
      const t = prey.reduce((a, b) => (gapBetween(b, hero) < gapBetween(a, hero) ? b : a));
      const tough = t.maxHp >= 10 || !!monsterDef(t)?.sling;
      if (!off.bow && tough && gapBetween(t, hero) >= 3 && tryShoot(game, t, mem)) return true;
      // Œil de lynx (Elfe) : de loin, l'arc a l'avantage ; on ouvre toujours à la flèche tant qu'il en reste assez.
      const lynx = (game.race as { lynxRange?: number }).lynxRange ?? 0;
      if (!off.bow && lynx > 0 && gapBetween(t, hero) >= lynx && (game.inventory.count("fleche") >= 6 || game.endlessAmmo("fleche")) && aim(`lynx:${t.id}`, 12, () => tryShoot(game, t, mem))) return true;
      return aim(`prey:${t.id}`, 80, () => game.setDestination(t.x, t.y));
    });
    rule("quête", quests);
    rule("boutique", shop);
    rule("butin", loot);
    rule("ouvrir", features);
    rule("fouille", searchRooms);
    if (!acted) {
      const front = frontierX(game, (p) => mem.noGo.has(key(`front:${p.x},${p.y}`)));
      if (front) {
        rule("explorer", () => aim(`front:${front.x},${front.y}`, 70, () => game.setDestination(front.x, front.y)));
        if (!acted) continue;
      }
    }
    rule("descendre", leave);
    // Plus rien à faire et pas d'escalier : on reprend tout ce qu'on avait abandonné, portes à enfoncer comprises.
    if (!acted && !boss && !mem.desperate.has(game.depth)) {
      mem.desperate.add(game.depth);
      for (const k of [...mem.noGo]) if (k.startsWith(`${game.depth}:`) && !k.includes(":search:")) mem.noGo.delete(k);
      for (const k of [...mem.tries.keys()]) if (k.startsWith(`${game.depth}:`) && !k.includes(":search:")) mem.tries.delete(k);
      continue;
    }
    lastWhy = why || "attendre";
    opts.trace?.(lastWhy, game);
    if (!acted) game.wait();
    const turnBefore = game.turn;
    const depthBefore = game.depth;
    game.tick();
    // L'ordre n'a rien donné (une boutique qui s'ouvre, un chemin vide) : on passe le tour plutôt que de tourner en rond.
    if (game.turn === turnBefore && game.depth === depthBefore && !game.over && game.pendingStairs === null && game.pendingDoor === null) {
      stalls++;
      if (stalls >= 2) {
        game.wait();
        game.tick();
        stalls = 0;
      }
    } else stalls = 0;
    for (const e of game.events) {
      if (e.type === "death" && e.actor.kind === "monster") kills++;
      if (e.type === "skill") {
        skillUses++;
        healed += e.healed;
      }
      if (e.type === "lastStand") lastStands++;
      if (e.type === "chest") mem.chests++;
      if (e.type === "quest") {
        if (e.what === "start") questsStarted++;
        else if (e.what === "complete") questsDone++;
        else if (e.what !== "resume") questsFailed++;
      }
    }
    game.events.length = 0;
    const k = `${game.depth}:${hero.x},${hero.y}`;
    idle = k === lastKey ? idle + 1 : 0;
    lastKey = k;
    if (idle > 260) break;
  }
  void rnd;
  void spent;
  const melee = game.weapon("melee");
  return {
    ...endInfo(game, maxTurns, lastWhy),
    level: "expert" as never,
    seed,
    deepest: game.deepest,
    heroLevel: game.level,
    turns: game.turn,
    gold: game.gold,
    dead: game.over && hero.hp === 0,
    cause: game.deathCause,
    boss: weaverDown || game.deepest > RULES.bossDepths[0],
    boss2: mem.bellDown || (game.won && game.deepest >= RULES.demoLastDepth),
    boss3: priestessDown,
    won: game.won,
    kills, talks, questsStarted, questsDone, questsFailed, skillUses, healed, lastStands,
    searches: mem.searches, chests: mem.chests, doors: mem.doors, bought: mem.bought, sold: mem.sold, potions: mem.potions, pushes: mem.pushes, shots: mem.shots,
    armorClass: hero.armorClass,
    weapon: melee?.id ?? "poings",
  };
}
