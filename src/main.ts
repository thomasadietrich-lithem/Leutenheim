import { Game } from "./core/game";
import { bindInput } from "./input/pointer";
import { Renderer } from "./render/renderer";
import { Point } from "./world/map";

/** Durée d'un pas à l'écran (ms) : posé sur les trajets courts, rapide sur les longs. */
function stepDuration(pathLength: number): number {
  if (pathLength <= 3) return 180;
  if (pathLength <= 7) return 125;
  return 80;
}
const KEYBOARD_STEP_MS = 140;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLElement;
const newRunButton = document.getElementById("new-run") as HTMLButtonElement;

const renderer = new Renderer(canvas);
let game: Game;

// Animation du pas en cours : le héros glisse à vitesse constante de `stepFrom` vers sa case.
let stepMs = 125;
let stepFrom: Point | null = null;
let stepTime = 0;

function newRun(): void {
  // Seul endroit où le hasard « réel » intervient : le choix de la graine de la partie.
  game = new Game(Math.floor(Math.random() * 0xffffffff));
  stepFrom = null;
  renderer.snapTo(game);
}

bindInput(
  canvas,
  (px, py) => {
    const t = renderer.screenToTile(px, py);
    if (game.setDestination(t.x, t.y)) stepMs = stepDuration(game.path.length);
  },
  (dx, dy) => {
    if (game.path.length === 0 && game.moveBy(dx, dy)) stepMs = KEYBOARD_STEP_MS;
  },
);
newRunButton.addEventListener("click", newRun);
window.addEventListener("resize", () => renderer.resize());

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(now - last, 100);
  last = now;

  if (stepFrom) {
    stepTime += dt;
    if (stepTime >= stepMs) {
      // Pas terminé ; le reste de temps est reporté sur le pas suivant pour garder une vitesse constante.
      stepTime -= stepMs;
      stepFrom = null;
      if (game.descendIfOnStairs()) renderer.snapTo(game);
    }
  }
  if (!stepFrom) {
    const before = { ...game.hero };
    if (game.tick()) stepFrom = before;
    else stepTime = 0;
  }

  const k = stepFrom ? Math.min(stepTime / stepMs, 1) : 1;
  const shown: Point = stepFrom
    ? { x: stepFrom.x + (game.hero.x - stepFrom.x) * k, y: stepFrom.y + (game.hero.y - stepFrom.y) * k }
    : game.hero;
  renderer.draw(game, shown, dt);
  hud.textContent = `Étage ${game.depth} · Tour ${game.turn} · Graine ${game.runSeed}`;
  requestAnimationFrame(frame);
}

newRun();
requestAnimationFrame(frame);
