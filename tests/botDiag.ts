/**
 * DIAGNOSTIC DES PARTIES BLOQUÉES (Thomas, 2026-11-18 : « comprendre qui et quand ils sont bloqués »).
 * Une partie est « bloquée » quand le joueur automatique s'arrête sans être mort ni avoir gagné. À la fin de chaque
 * partie, on regarde l'état du jeu et on range l'arrêt dans une cause lisible. Ne change rien au jeu ni aux bots.
 */
import type { Game } from "../src/core/game";
import { Tile } from "../src/world/map";
import { gapBetween } from "../src/core/boss";

export interface EndInfo {
  /** Comment la partie s'est finie. */
  end: "mort" | "victoire" | "bloqué" | "limite de tours";
  /** Si elle est bloquée : où, quand et pourquoi. */
  stuck?: { floor: number; turn: number; hp: string; cause: string; detail: string; last?: string };
}

function knownStairs(game: Game): boolean {
  for (let y = 0; y < game.map.height; y++) for (let x = 0; x < game.map.width; x++) if (game.map.get(x, y) === Tile.StairsDown && game.isExplored(x, y)) return true;
  return false;
}

/** Reste-t-il de l'inconnu à portée de marche (cases connues qui touchent une case jamais vue) ? */
function unexploredReachable(game: Game): boolean {
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
      if (!game.isExplored(x, y)) return true;
      if (map.isWalkable(x, y)) queue.push({ x, y });
    }
  }
  return false;
}

export function endInfo(game: Game, maxTurns: number, last?: string): EndInfo {
  if (game.over && game.hero.hp === 0) return { end: "mort" };
  if (game.over && game.won) return { end: "victoire" };
  const boss = game.bossActor();
  const seen = game.visibleMonsters();
  const hunters = seen.filter((m) => m.alerted && !m.asleep);
  const names = (list: typeof seen) => list.slice(0, 4).map((m) => `${m.name} (${gapBetween(m, game.hero)} cases, ${m.hp} PV)`).join(", ");
  let cause: string;
  let detail = "";
  if (boss && game.isBossDepth(game.depth)) {
    cause = hunters.includes(boss) || boss.boss?.engaged ? "combat de boss qui n'avance pas" : "devant le boss sans l'engager";
    detail = `${boss.name} : ${boss.hp}/${boss.maxHp} PV, à ${gapBetween(boss, game.hero)} cases${boss.boss ? `, phase « ${boss.boss.phase} »` : ""}`;
  } else if (hunters.length > 0) {
    cause = "combat qui n'avance pas";
    detail = names(hunters);
  } else if (game.pendingDoor) {
    cause = "arrêté devant une porte verrouillée";
    detail = `porte en (${game.pendingDoor.x}, ${game.pendingDoor.y})`;
  } else if (seen.length > 0) {
    cause = "monstre en vue qu'il n'attaque pas";
    detail = names(seen);
  } else if (knownStairs(game)) {
    cause = "escalier connu, mais il n'y va pas";
  } else if (unexploredReachable(game)) {
    cause = "exploration arrêtée (il reste de l'inconnu)";
  } else {
    cause = "pas d'escalier trouvé, plus rien à explorer";
  }
  if ((game.hero.stuck ?? 0) > 0) detail += `${detail ? " ; " : ""}héros englué`;
  return {
    end: game.turn >= maxTurns ? "limite de tours" : "bloqué",
    stuck: { floor: game.depth, turn: game.turn, hp: `${game.hero.hp}/${game.hero.maxHp}`, cause, detail, last },
  };
}
