import { Game, GameEvent } from "./core/game";
import { bindInput } from "./input/pointer";
import { Renderer } from "./render/renderer";

/** Durée d'un tour à l'écran (ms) : posé sur les trajets courts, rapide sur les longs. */
function stepDuration(pathLength: number): number {
  if (pathLength <= 3) return 180;
  if (pathLength <= 7) return 125;
  return 80;
}
const KEYBOARD_STEP_MS = 140;
/** En présence de monstres, on ne descend pas sous cette durée, pour pouvoir suivre le combat. */
const COMBAT_STEP_MS = 170;
const LOG_LINES = 3;

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const canvas = $("game") as HTMLCanvasElement;
const hudText = $("hud-text");
const hpFill = $("hp-fill");
const die = $("die");
const log = $("log");
const over = $("over");
const overText = $("over-text");
const seedLabel = $("seed");

const renderer = new Renderer(canvas);
let game: Game;
let logLines: string[] = [];

// Animation du tour en cours.
let stepMs = 125;
let stepping = false;
let stepTime = 0;

function newRun(): void {
  // Seul endroit où le hasard « réel » intervient : le choix de la graine de la partie.
  game = new Game(Math.floor(Math.random() * 0xffffffff));
  stepping = false;
  logLines = [`Vous incarnez un ${game.hero.name}. Touchez un monstre pour l'attaquer.`];
  die.textContent = "d20";
  die.className = "die";
  over.hidden = true;
  seedLabel.textContent = `Graine ${game.runSeed}`;
  renderer.snapTo(game);
}

function describe(e: Extract<GameEvent, { type: "attack" }>): string {
  const r = e.result;
  const byHero = e.attacker.kind === "hero";
  const who = byHero ? `Vous attaquez ${e.target.name}` : `${e.attacker.name} vous attaque`;
  const outcome = r.critical
    ? `coup critique, ${r.damage} dégâts`
    : r.hit
      ? `touché, ${r.damage} dégâts`
      : r.d20 === 1
        ? "échec critique"
        : "raté";
  const mode = r.mode === "advantage" ? ` (avantage : ${r.rolls.join(" et ")})` : "";
  return `${who} : ${r.d20} + ${r.bonus} = ${r.total} contre CA ${r.targetAc}${mode} — ${outcome}`;
}

function showEvents(): void {
  for (const e of game.events) {
    if (e.type === "attack") {
      const r = e.result;
      logLines.push(describe(e));
      die.textContent = String(r.d20);
      die.className = `die ${r.critical ? "crit" : r.hit ? "hit" : "miss"} ${e.attacker.kind === "hero" ? "" : "foe"}`;
      renderer.addFloatingText(
        e.target.x,
        e.target.y,
        r.hit ? `-${r.damage}` : "Raté",
        r.critical ? "#ffd75e" : r.hit ? (e.target.kind === "hero" ? "#ff6b7a" : "#ffffff") : "#a8a2c0",
      );
    } else if (e.type === "death") {
      if (e.actor.kind === "hero") {
        overText.textContent = `Vous êtes mort à l'étage ${game.depth}, au tour ${game.turn}.`;
        over.hidden = false;
      } else {
        logLines.push(`${e.actor.name} est vaincu.`);
      }
    } else if (e.type === "noticed") {
      renderer.addFloatingText(e.actor.x, e.actor.y, "!", "#ffd75e");
    } else if (e.type === "descend") {
      logLines.push(`Étage ${game.depth}.${e.healed > 0 ? ` Vous récupérez ${e.healed} PV.` : ""}`);
    }
  }
  game.events.length = 0;
  logLines = logLines.slice(-LOG_LINES);
  log.replaceChildren(
    ...logLines.map((line) => {
      const p = document.createElement("div");
      p.textContent = line;
      return p;
    }),
  );
}

bindInput(canvas, {
  onTap(px, py) {
    const t = renderer.screenToTile(px, py);
    if (game.setDestination(t.x, t.y)) stepMs = stepDuration(game.path.length);
  },
  onMove(dx, dy) {
    if (game.path.length === 0 && game.moveBy(dx, dy)) stepMs = KEYBOARD_STEP_MS;
  },
  onZoom(factor) {
    renderer.zoomBy(factor);
  },
});
$("new-run").addEventListener("click", newRun);
$("over-new-run").addEventListener("click", newRun);
$("wait").addEventListener("click", () => {
  game.wait();
  stepMs = COMBAT_STEP_MS;
});
window.addEventListener("resize", () => renderer.resize());

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(now - last, 100);
  last = now;

  if (stepping) {
    stepTime += dt;
    if (stepTime >= stepMs) {
      // Tour terminé ; le reste de temps est reporté sur le suivant pour garder une vitesse constante.
      stepTime -= stepMs;
      stepping = false;
      if (game.descendIfOnStairs()) renderer.snapTo(game);
    }
  }
  if (!stepping) {
    if (game.visibleMonsters().length > 0) stepMs = Math.max(stepMs, COMBAT_STEP_MS);
    if (game.tick()) stepping = true;
    else stepTime = 0;
  }
  if (game.events.length > 0) showEvents();

  renderer.draw(game, stepping ? Math.min(stepTime / stepMs, 1) : 1, dt);
  hudText.textContent = `Étage ${game.depth} · PV ${game.hero.hp}/${game.hero.maxHp} · CA ${game.hero.armorClass} · Tour ${game.turn}`;
  hpFill.style.width = `${(100 * game.hero.hp) / game.hero.maxHp}%`;
  requestAnimationFrame(frame);
}

newRun();
showEvents();
requestAnimationFrame(frame);

// Accès de débogage pour les tests automatiques dans un navigateur (sans effet sur le jeu).
(window as unknown as { leutenheim: unknown }).leutenheim = { game: () => game };
