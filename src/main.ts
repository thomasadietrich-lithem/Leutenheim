import { Sfx } from "./audio/sfx";
import { DoorAction, Game, GameEvent } from "./core/game";
import { RULES } from "./data/rules";
import { Actor } from "./entities/actor";
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
/** Mise en scène d'un jet : le dé roule, puis le résultat reste affiché un instant. */
const ROLL_MS = 420;
const HOLD_HERO_MS = 240;
const HOLD_FOE_MS = 520; // un peu plus long pour les attaques ennemies, pour avoir le temps de les lire
/** Le dé se vide ce délai après le dernier résultat affiché. */
const DIE_CLEAR_MS = 900;
const LOG_LINES = 3;
const OPTIONS_KEY = "leutenheim.options";

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const canvas = $("game") as HTMLCanvasElement;
const hudText = $("hud-text");
const hpFill = $("hp-fill");
const die = $("die");
const dieWho = $("die-who");
const log = $("log");
const over = $("over");
const overText = $("over-text");
const seedLabel = $("seed");
const doorActions = $("door-actions");
const menu = $("menu");

// ---------- Options (mémorisées sur l'appareil quand c'est possible) ----------

const options = { sound: true };
try {
  Object.assign(options, JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? "{}"));
} catch {
  /* pas de stockage : on garde les réglages par défaut */
}
function saveOptions(): void {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  } catch {
    /* sans gravité */
  }
}

const sfx = new Sfx();
sfx.enabled = options.sound;
const renderer = new Renderer(canvas);

// ---------- État de l'affichage ----------

let game: Game;
let logLines: string[] = [];
let menuOpen = true;
let started = false;
/** Points de vie affichés : ils ne baissent qu'au moment où le coup est montré. */
let shownHp = 0;
/** Événements du tour en attente d'être montrés, l'un après l'autre. */
let queue: GameEvent[] = [];
let cue: { event: GameEvent; time: number; revealed: boolean; lastFace: number } | null = null;
/** Monstres vaincus dont la mort n'a pas encore été montrée : on continue de les dessiner. */
let ghosts: Actor[] = [];

let dieIdle = 0;
let stepMs = 125;
let stepping = false;
let stepTime = 0;

function newRun(): void {
  // Seul endroit où le hasard « réel » intervient : le choix de la graine de la partie.
  game = new Game(Math.floor(Math.random() * 0xffffffff));
  stepping = false;
  queue = [];
  cue = null;
  ghosts = [];
  shownHp = game.hero.hp;
  logLines = [`Vous incarnez un ${game.hero.name}. Touchez un monstre pour l'attaquer.`];
  renderLog();
  clearDie();
  over.hidden = true;
  seedLabel.textContent = `Graine ${game.runSeed}`;
  renderer.snapTo(game);
}

/** Le dé redevient vide : il ne montre un nombre que pendant et juste après un jet. */
function clearDie(): void {
  die.textContent = "";
  die.className = "die";
  dieWho.textContent = "";
}

function renderLog(): void {
  logLines = logLines.slice(-LOG_LINES);
  log.replaceChildren(
    ...logLines.map((line) => {
      const p = document.createElement("div");
      p.textContent = line;
      return p;
    }),
  );
}

// ---------- Mise en scène des événements ----------

const isRoll = (e: GameEvent): e is Extract<GameEvent, { type: "attack" | "door" }> =>
  e.type === "attack" || e.type === "door";
const byFoe = (e: GameEvent): boolean => e.type === "attack" && e.attacker.kind === "monster";

function describeAttack(e: Extract<GameEvent, { type: "attack" }>): string {
  const r = e.result;
  const who = e.attacker.kind === "hero" ? `Vous attaquez ${e.target.name}` : `${e.attacker.name} vous attaque`;
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

function describeDoor(e: Extract<GameEvent, { type: "door" }>): string {
  const what = e.action === "pick" ? "Vous crochetez la serrure" : "Vous enfoncez la porte";
  const outcome =
    e.action === "pick" ? (e.success ? "elle s'ouvre" : "raté") : e.success ? "elle cède" : "elle résiste";
  const noise =
    e.action === "break"
      ? e.alerted > 0
        ? ` Le vacarme alerte ${e.alerted} monstre${e.alerted > 1 ? "s" : ""}.`
        : " Le vacarme résonne, sans réponse."
      : "";
  return `${what} : ${e.d20} + ${e.bonus} = ${e.total} contre ${e.dc} — ${outcome}.${noise}`;
}

/** Le dé commence à rouler. */
function startRoll(e: GameEvent): void {
  die.className = `die rolling${byFoe(e) ? " foe" : ""}`;
  dieWho.textContent = e.type === "attack" && e.attacker.kind === "monster" ? e.attacker.name : "Vous";
  sfx.play("dice");
}

function landDie(value: number, outcome: "hit" | "miss" | "crit", foe: boolean): void {
  die.textContent = String(value);
  die.className = `die land ${outcome}${foe ? " foe" : ""}`;
}

/** Le résultat d'un événement est montré : texte, son, effets. */
function reveal(e: GameEvent): void {
  if (e.type === "attack") {
    const r = e.result;
    const foe = e.attacker.kind === "monster";
    logLines.push(describeAttack(e));
    landDie(r.d20, r.critical ? "crit" : r.hit ? "hit" : "miss", foe);
    renderer.addFloatingText(
      e.target.x,
      e.target.y,
      r.hit ? `-${r.damage}` : "Raté",
      r.critical ? "#ffd75e" : r.hit ? (foe ? "#ff6b7a" : "#ffffff") : "#a8a2c0",
    );
    if (foe) shownHp = Math.max(0, shownHp - r.damage);
    sfx.play(r.critical ? "crit" : r.hit ? (foe ? "hurt" : "hit") : "miss");
  } else if (e.type === "door") {
    logLines.push(describeDoor(e));
    landDie(e.d20, e.success ? "hit" : "miss", false);
    if (e.action === "break") {
      renderer.addFloatingText(e.x, e.y, e.success ? "CRAC !" : "BOUM", "#ffd75e");
      sfx.play(e.success ? "break" : "thud");
    } else {
      sfx.play(e.success ? "unlock" : "click");
    }
  } else if (e.type === "death") {
    if (e.actor.kind === "hero") {
      overText.textContent = `Vous êtes mort à l'étage ${game.depth}, au tour ${game.turn}.`;
      over.hidden = false;
      sfx.play("death");
    } else {
      ghosts = ghosts.filter((g) => g !== e.actor);
      logLines.push(`${e.actor.name} est vaincu.`);
      sfx.play("kill");
    }
  } else if (e.type === "noticed") {
    renderer.addFloatingText(e.actor.x, e.actor.y, "!", "#ffd75e");
    sfx.play("notice");
  } else if (e.type === "descend") {
    logLines.push(`Étage ${game.depth}.${e.healed > 0 ? ` Vous récupérez ${e.healed} PV.` : ""}`);
    shownHp = game.hero.hp;
    sfx.play("descend");
  } else if (e.type === "opened") {
    sfx.play("door");
  }
  renderLog();
}

/** Fait avancer la file : un jet à la fois, les autres événements sont immédiats. */
function advanceCues(dt: number): void {
  for (let guard = 0; guard < 16; guard++) {
    if (!cue) {
      const event = queue.shift();
      if (!event) return;
      cue = { event, time: 0, revealed: false, lastFace: 0 };
      if (isRoll(event)) startRoll(event);
    } else {
      cue.time += dt;
    }
    const roll = isRoll(cue.event) ? ROLL_MS : 0;
    if (!cue.revealed && cue.time < roll) {
      // Le dé roule : les faces défilent (pur effet visuel, le vrai jet est déjà fait par les règles).
      if (cue.time - cue.lastFace >= 55) {
        cue.lastFace = cue.time;
        die.textContent = String(1 + Math.floor(Math.random() * 20));
      }
      return;
    }
    if (!cue.revealed) {
      reveal(cue.event);
      cue.revealed = true;
    }
    const hold = isRoll(cue.event) ? (byFoe(cue.event) ? HOLD_FOE_MS : HOLD_HERO_MS) : 0;
    if (cue.time < roll + hold) return;
    cue = null;
  }
}

function collectEvents(): void {
  for (const e of game.events) {
    if (e.type === "death" && e.actor.kind === "monster") ghosts.push(e.actor);
    queue.push(e);
  }
  game.events.length = 0;
}

// ---------- Commandes ----------

bindInput(canvas, {
  onTap(px, py) {
    if (menuOpen) return;
    const t = renderer.screenToTile(px, py);
    if (game.setDestination(t.x, t.y)) stepMs = stepDuration(game.path.length);
  },
  onMove(dx, dy) {
    if (menuOpen) return;
    if (game.path.length === 0 && game.moveBy(dx, dy)) stepMs = KEYBOARD_STEP_MS;
  },
  onZoom(factor) {
    renderer.zoomBy(factor);
  },
});
window.addEventListener("pointerdown", () => sfx.unlock(), true);
window.addEventListener("resize", () => renderer.resize());

function button(id: string, action: () => void): void {
  $(id).addEventListener("click", () => {
    sfx.unlock();
    sfx.play("click");
    action();
  });
}

button("wait", () => {
  game.wait();
  stepMs = COMBAT_STEP_MS;
});
button("over-new-run", newRun);
const doorButton = (id: string, action: DoorAction) => button(id, () => game.actOnDoor(action));
doorButton("door-pick", "pick");
doorButton("door-break", "break");

// ---------- Menu principal ----------

function renderMenu(): void {
  menu.hidden = !menuOpen;
  $("menu-play").textContent = started ? "Reprendre" : "Jouer";
  $("menu-new").hidden = !started;
  $("menu-sound").textContent = `Sons : ${options.sound ? "activés" : "désactivés"}`;
}
button("open-menu", () => {
  menuOpen = true;
  renderMenu();
});
button("menu-play", () => {
  menuOpen = false;
  started = true;
  renderMenu();
});
button("menu-new", () => {
  newRun();
  menuOpen = false;
  renderMenu();
});
button("menu-sound", () => {
  options.sound = !options.sound;
  sfx.enabled = options.sound;
  saveOptions();
  sfx.play("click");
  renderMenu();
});

// ---------- Boucle d'affichage ----------

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(now - last, 100);
  last = now;

  advanceCues(dt);
  dieIdle = cue || queue.length > 0 ? 0 : dieIdle + dt;
  if (dieIdle >= DIE_CLEAR_MS && die.textContent !== "") clearDie();

  if (stepping) {
    stepTime += dt;
    if (stepTime >= stepMs) {
      // Tour terminé ; le reste de temps est reporté sur le suivant pour garder une vitesse constante.
      stepTime -= stepMs;
      stepping = false;
      if (game.descendIfOnStairs()) {
        renderer.snapTo(game);
        collectEvents();
      }
    }
  }
  // Le tour suivant ne commence que lorsque tout ce qui s'est passé a été montré.
  if (!stepping && !cue && queue.length === 0 && !menuOpen) {
    shownHp = game.hero.hp;
    if (game.visibleMonsters().length > 0) stepMs = Math.max(stepMs, COMBAT_STEP_MS);
    const before = { x: game.hero.x, y: game.hero.y };
    if (game.tick()) {
      stepping = true;
      if (game.hero.x !== before.x || game.hero.y !== before.y) sfx.play("step");
      collectEvents();
    } else {
      stepTime = 0;
    }
  }

  renderer.draw(game, stepping ? Math.min(stepTime / stepMs, 1) : 1, dt, ghosts);
  hudText.textContent = `Étage ${game.depth} · PV ${shownHp}/${game.hero.maxHp} · CA ${game.hero.armorClass} · Tour ${game.turn}`;
  hpFill.style.width = `${(100 * shownHp) / game.hero.maxHp}%`;
  doorActions.hidden = !game.pendingDoor || game.over || cue !== null;
  requestAnimationFrame(frame);
}

$("door-pick").textContent = `Crocheter (d20 + ${new Game(1).heroClass.lockpickBonus} contre ${RULES.lockpickDc})`;
$("door-break").textContent = `Enfoncer (d20 + ${new Game(1).heroClass.breakBonus} contre ${RULES.breakDc}) — bruyant`;
newRun();
renderMenu();
requestAnimationFrame(frame);

// Accès de débogage pour les tests automatiques dans un navigateur (sans effet sur le jeu).
(window as unknown as { leutenheim: unknown }).leutenheim = { game: () => game };
