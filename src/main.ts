import { Game } from "./core/game";
import { bindInput } from "./input/pointer";
import { Renderer } from "./render/renderer";

/** Durée d'un pas à l'écran (ms) : posé sur les trajets courts, rapide sur les longs. */
function stepDuration(pathLength: number): number {
  if (pathLength <= 3) return 220;
  if (pathLength <= 7) return 150;
  return 90;
}
let turnMs = 150;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLElement;
const newRunButton = document.getElementById("new-run") as HTMLButtonElement;

const renderer = new Renderer(canvas);
let game: Game;

function newRun(): void {
  // Seul endroit où le hasard « réel » intervient : le choix de la graine de la partie.
  game = new Game(Math.floor(Math.random() * 0xffffffff));
  renderer.snapTo(game);
}

bindInput(
  canvas,
  (px, py) => {
    const t = renderer.screenToTile(px, py);
    if (game.setDestination(t.x, t.y)) {
      turnMs = stepDuration(game.path.length);
      pending = turnMs; // le premier pas part tout de suite
    }
  },
  (dx, dy) => {
    if (game.path.length === 0 && game.moveBy(dx, dy)) turnMs = 170;
  },
);
newRunButton.addEventListener("click", newRun);
window.addEventListener("resize", () => renderer.resize());

let last = performance.now();
let pending = 0;
function frame(now: number): void {
  pending += Math.min(now - last, 250);
  last = now;
  while (pending >= turnMs) {
    pending -= turnMs;
    const depth = game.depth;
    game.tick();
    if (game.depth !== depth) renderer.snapTo(game);
  }
  renderer.draw(game);
  hud.textContent = `Étage ${game.depth} · Tour ${game.turn} · Graine ${game.runSeed}`;
  requestAnimationFrame(frame);
}

newRun();
requestAnimationFrame(frame);
