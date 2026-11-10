import { Game } from "./core/game";
import { bindInput } from "./input/pointer";
import { Renderer } from "./render/renderer";

/** Durée d'un tour à l'écran, en millisecondes. */
const TURN_MS = 90;

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
    game.setDestination(t.x, t.y);
  },
  (dx, dy) => {
    if (game.path.length === 0) game.moveBy(dx, dy);
  },
);
newRunButton.addEventListener("click", newRun);
window.addEventListener("resize", () => renderer.resize());

let last = performance.now();
let pending = 0;
function frame(now: number): void {
  pending += Math.min(now - last, 250);
  last = now;
  while (pending >= TURN_MS) {
    pending -= TURN_MS;
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
