import { Sfx } from "./audio/sfx";
import { diceLabel } from "./core/dice";
import { DoorAction, Game, GameEvent } from "./core/game";
import { RULES } from "./data/rules";
import { CLASSES, ClassDef } from "./data/classes";
import { ITEMS, ItemDef, ItemId, KIND_LABELS, Slot, SLOTS, UNARMORED_AC } from "./data/items";
import { RACES, RaceDef } from "./data/races";
import { Actor } from "./entities/actor";
import { bindInput } from "./input/pointer";
import { Renderer } from "./render/renderer";
import { itemIcon, uiIcon } from "./ui/icons";

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
const die2 = $("die2");
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
let bagOpen = false;
/** Objet sélectionné dans l'écran du sac : dans le sac (par identifiant) ou porté (par emplacement). */
let selected: { uid: number } | { slot: Slot } | null = null;
/** Vrai : l'arc est bandé, le prochain toucher tire une flèche. Puis on revient à l'arme de corps à corps. */
let aimMode = false;
let doorWasPending = false;
let aimShown = "";
/** Une fiche d'objet est affichée par-dessus le jeu (objet trouvé pour la première fois). */
let foundOpen = false;
/** Genres d'objets déjà rencontrés dans cette partie : leur fiche ne s'affiche qu'à la première trouvaille. */
let seenItems = new Set<ItemId>();
let started = false;
/** Race et classe choisies dans l'écran de nouvelle partie. */
let chosenRace: RaceDef = RACES.humain;
let chosenClass: ClassDef = CLASSES.guerrier;
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
  game = new Game(Math.floor(Math.random() * 0xffffffff), chosenRace, chosenClass);
  aimMode = false;
  doorWasPending = false;
  foundOpen = false;
  $("found").hidden = true;
  seenItems = new Set<ItemId>(game.heroClass.startingItems.map((g) => g.item));
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
  die2.hidden = true;
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
  e.type === "attack" || (e.type === "door" && e.action !== "key");
const byFoe = (e: GameEvent): boolean => e.type === "attack" && e.attacker.kind === "monster";

function describeAttack(e: Extract<GameEvent, { type: "attack" }>): string {
  const r = e.result;
  const who =
    e.attacker.kind === "hero"
      ? `${e.ranged ? "Vous tirez sur" : "Vous attaquez"} ${e.target.name}`
      : e.opportunity
        ? `Attaque d'opportunité de ${e.attacker.name}`
        : `${e.attacker.name} vous attaque`;
  const outcome = r.critical
    ? `coup critique, ${r.damage} dégâts`
    : r.hit
      ? `touché, ${r.damage} dégâts`
      : r.d20 === 1
        ? "échec critique"
        : "raté";
  const mode =
    r.mode === "advantage"
      ? ` (avantage : ${r.rolls.join(" et ")})`
      : r.mode === "disadvantage"
        ? ` (désavantage : ${r.rolls.join(" et ")})`
        : "";
  // La difficulté à atteindre n'est jamais affichée : seulement le jet et son résultat.
  return `${who} : ${r.d20} + ${r.bonus} = ${r.total}${mode} — ${outcome}`;
}

function describeDoor(e: Extract<GameEvent, { type: "door" }>): string {
  if (e.action === "key") return "Vous ouvrez la porte avec la clef.";
  const what = e.action === "pick" ? "Vous crochetez la serrure" : "Vous enfoncez la porte";
  const outcome =
    e.action === "pick" ? (e.success ? "elle s'ouvre" : "raté") : e.success ? "elle cède" : "elle résiste";
  const bonus = e.bonus >= 0 ? `+ ${e.bonus}` : `− ${-e.bonus}`;
  const dead = !e.success && game.doorOptions().length === 0 ? " Il vous faudrait une clef." : "";
  return `${what} : ${e.d20} ${bonus} = ${e.total} — ${outcome}.${dead}`;
}

/** Flèches déjà parties à l'écran (pour ne pas les faire voler deux fois). */
const launched = new WeakSet<object>();

/** Fait partir la flèche à l'écran : elle vole dès le tir, pas après le résultat du dé. */
function launchArrow(e: GameEvent | undefined): void {
  if (!e || e.type !== "arrow" || launched.has(e)) return;
  launched.add(e);
  if (e.via) {
    // Elle heurte l'obstacle, puis retombe en tournoyant.
    renderer.addProjectile(e.fromX, e.fromY, e.via.x, e.via.y);
    renderer.addProjectile(e.via.x, e.via.y, e.x, e.y, 170, true);
  } else {
    renderer.addProjectile(e.fromX, e.fromY, e.x, e.y);
  }
}

/** Le dé commence à rouler. Avec avantage ou désavantage, un second dé roule à côté, et ça s'entend. */
function startRoll(e: GameEvent): void {
  const foe = byFoe(e);
  const mode = e.type === "attack" ? e.result.mode : "normal";
  die.className = `die rolling${foe ? " foe" : ""}`;
  die2.hidden = mode === "normal";
  die2.className = `die rolling${foe ? " foe" : ""}`;
  const who = e.type === "attack" && e.attacker.kind === "monster" ? e.attacker.name : "Vous";
  dieWho.textContent = mode === "advantage" ? `${who} · avantage` : mode === "disadvantage" ? `${who} · désavantage` : who;
  dieWho.className = mode === "normal" ? "" : mode;
  sfx.play("dice");
  if (mode !== "normal") sfx.play(mode);
  if (e.type === "attack" && e.ranged) launchArrow(queue.find((q) => q.type === "arrow"));
  if (e.type === "attack") {
    if (mode !== "normal") {
      // Avantage au joueur ou contre lui : on l'annonce au-dessus de celui qui en profite ou en pâtit.
      const good = (mode === "advantage") !== foe;
      renderer.addFloatingText(e.attacker.x, e.attacker.y, mode === "advantage" ? "Avantage !" : "Désavantage", good ? "#ffd75e" : "#ff6b7a");
    }
    if (e.ranged) sfx.play("bow");
  }
}

function landDie(value: number, outcome: "hit" | "miss" | "crit", foe: boolean, other?: number): void {
  die.textContent = String(value);
  die.className = `die land ${outcome}${foe ? " foe" : ""}`;
  if (other === undefined) {
    die2.hidden = true;
  } else {
    // Le dé écarté reste visible, estompé.
    die2.textContent = String(other);
    die2.className = `die dropped${foe ? " foe" : ""}`;
  }
}

/** Le résultat d'un événement est montré : texte, son, effets. */
function reveal(e: GameEvent): void {
  if (e.type === "attack") {
    const r = e.result;
    const foe = e.attacker.kind === "monster";
    logLines.push(describeAttack(e));
    if (e.opportunity) renderer.addFloatingText(e.attacker.x, e.attacker.y, "Opportunité !", "#ffd75e");
    if (!e.ranged) renderer.addSlash(e.attacker.id, e.attacker.x, e.attacker.y, e.target.x, e.target.y, foe ? "#ff8a7a" : "#f4f6ff");
    const dropped = r.rolls.length === 2 ? r.rolls[0] + r.rolls[1] - r.d20 : undefined;
    landDie(r.d20, r.critical ? "crit" : r.hit ? "hit" : "miss", foe, dropped);
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
    if (e.action === "key") {
      sfx.play("unlock");
    } else {
      landDie(e.d20, e.success ? "hit" : "miss", false);
      if (e.action === "break") {
        // Le héros se jette contre la porte : élan, choc, et le fracas qui résonne.
        renderer.addSlash(game.hero.id, game.hero.x, game.hero.y, e.x, e.y, "", false);
        renderer.addFloatingText(e.x, e.y, e.success ? "CRAC !" : "BOUM", "#ffd75e");
        sfx.play(e.success ? "break" : "thud");
      } else {
        sfx.play(e.success ? "unlock" : "click");
      }
    }
  } else if (e.type === "arrow") {
    if (!launched.has(e)) sfx.play("bow");
    launchArrow(e);
    if (!e.kept) logLines.push("La flèche se brise.");
    else if (!e.hit) logLines.push(e.via ? "La flèche rebondit et retombe au sol." : "La flèche se plante au sol.");
  } else if (e.type === "pickup") {
    const found: ItemDef = ITEMS[e.item];
    logLines.push(found.kind === "gold" ? `Vous ramassez ${e.count} pièce${e.count > 1 ? "s" : ""} d'or.` : `Vous ramassez : ${found.name}${e.count > 1 ? ` ×${e.count}` : ""}.`);
    sfx.play("pickup");
    if (found.kind !== "gold" && found.kind !== "ammo" && !seenItems.has(e.item)) {
      // Première trouvaille de ce genre d'objet : on montre sa fiche.
      seenItems.add(e.item);
      $("found-card").replaceChildren(itemCard(found, e.count));
      $("found").hidden = false;
      foundOpen = true;
    }
  } else if (e.type === "xp") {
    renderer.addFloatingText(game.hero.x, game.hero.y, `+${e.amount} XP`, "#8fc7ff");
  } else if (e.type === "levelup") {
    logLines.push(`Niveau ${e.level} ! Vous gagnez ${RULES.hpPerLevel} points de vie.`);
    shownHp = game.hero.hp;
    sfx.play("heal");
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
  } else if (e.type === "stairs") {
    logLines.push(
      e.direction === "down"
        ? `Vous descendez à l'étage ${game.depth}.${e.healed > 0 ? ` Vous récupérez ${e.healed} PV.` : ""}`
        : `Vous remontez à l'étage ${game.depth}.`,
    );
    shownHp = game.hero.hp;
    sfx.play("descend");
  } else if (e.type === "opened") {
    sfx.play("door");
  } else if (e.type === "fountain") {
    logLines.push(e.healed > 0 ? `Vous buvez à la fontaine : +${e.healed} PV. Elle se tarit.` : "Vous buvez à la fontaine. Elle se tarit.");
    shownHp = game.hero.hp;
    sfx.play("heal");
  } else if (e.type === "chest") {
    logLines.push(`Le coffre contient ${e.gold} pièces d'or.`);
    sfx.play("unlock");
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
        die2.textContent = String(1 + Math.floor(Math.random() * 20));
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
    if (menuOpen || bagOpen || foundOpen) return;
    const t = renderer.screenToTile(px, py);
    if (aimMode) {
      // Mode arc : chaque toucher tire vers la case désignée, quelle qu'elle soit.
      const refusal = game.shoot(t.x, t.y);
      if (refusal) {
        const why = {
          "no-bow": "Aucun arc en main.",
          "no-ammo": "Plus de flèches.",
          "no-target": "Vous ne voyez pas cet endroit.",
          "out-of-range": `Hors de portée (${game.weapon("ranged")?.range ?? 0} cases).`,
        }[refusal];
        logLines.push(why);
        renderLog();
      } else {
        stepMs = COMBAT_STEP_MS;
        aimMode = false; // une flèche par visée : on revient à l'arme de corps à corps
      }
      return;
    }
    if (game.setDestination(t.x, t.y)) stepMs = stepDuration(game.path.length);
  },
  onMove(dx, dy) {
    if (menuOpen || bagOpen || foundOpen) return;
    if (game.path.length === 0 && game.moveBy(dx, dy)) stepMs = KEYBOARD_STEP_MS;
  },
  onPan(dx, dy) {
    if (!menuOpen && !bagOpen) renderer.panBy(dx, dy);
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
button("over-new-run", () => showScreen("new"));
const doorButton = (id: string, action: DoorAction) => button(id, () => game.actOnDoor(action));
doorButton("door-pick", "pick");
doorButton("door-break", "break");
doorButton("door-key", "key");
button("recenter", () => renderer.recenter());
button("aim", () => {
  if (!aimMode && game.isThreatened()) {
    logLines.push("Un ennemi est au contact : pas le temps de bander l'arc.");
  } else if (!aimMode && game.arrows() < 1) {
    logLines.push("Plus de flèches.");
  } else {
    aimMode = !aimMode;
    if (aimMode) logLines.push("Arc bandé : touchez une cible à portée pour tirer.");
  }
  renderLog();
});

// Boutons sans texte : un pictogramme, et un nom lisible par les aides à la lecture.
for (const [id, icon, label] of [
  ["wait", "wait", "Attendre un tour"],
  ["open-bag", "bag", "Équipement et sac"],
  ["open-menu", "menu", "Menu"],
  ["recenter", "recenter", "Recentrer la vue"],
] as const) {
  $(id).replaceChildren(uiIcon(icon));
  $(id).setAttribute("aria-label", label);
  $(id).title = label;
}
$("aim").setAttribute("aria-label", "Tirer à l'arc");

// ---------- Sac : grille de cases à la Diablo ----------

/**
 * Fiche d'un objet : son image, son nom, son genre, ses chiffres et une phrase de description.
 * La même fiche sert dans l'écran d'équipement et quand on trouve un objet dans le donjon.
 */
function itemCard(def: ItemDef, count = 1, note = ""): HTMLElement {
  const card = el("div", "item-card");
  const picture = el("div", "item-card-icon");
  picture.append(itemIcon(def.id as ItemId));
  const body = el("div", "item-card-body");
  body.append(el("div", "item-card-name", `${def.name}${count > 1 ? ` ×${count}` : ""}`), el("div", "item-card-kind", `${KIND_LABELS[def.kind]}${note}`));
  const rows: [string, string][] = [];
  if (def.attackBonus !== undefined) rows.push(["Attaque", `d20 ${signedBonus(def.attackBonus)}`]);
  if (def.damage) rows.push(["Dégâts", diceLabel(def.damage)]);
  if (def.range) rows.push(["Portée", `${def.range} cases`]);
  if (def.armorClass) rows.push(["Armure", `CA ${def.armorClass}`]);
  if (def.kind !== "gold") rows.push(["Place", `${def.w} × ${def.h}`]);
  const stats = el("div", "item-card-stats");
  for (const [label, value] of rows) stats.append(el("span", "", label), el("span", "item-card-value", value));
  body.append(stats, el("div", "item-card-desc", def.description));
  card.append(picture, body);
  return card;
}

function itemNode(item: { defId: ItemId; count: number }, className: string): HTMLElement {
  const node = el("div", className);
  node.append(itemIcon(item.defId));
  if (item.count > 1) node.append(el("span", "bag-count", String(item.count)));
  return node;
}

function renderBag(): void {
  const bag = game.inventory;
  const selectedUid = selected && "uid" in selected ? selected.uid : null;
  const selectedSlot = selected && "slot" in selected ? selected.slot : null;

  // Ce que le héros porte : un emplacement par type d'objet.
  $("doll").replaceChildren(
    ...SLOTS.map(({ slot, label }) => {
      const worn = game.equipment[slot];
      const node = el("div", `slot slot-${slot}${slot === selectedSlot ? " selected" : ""}${worn ? "" : " empty"}`);
      const box = el("div", "slot-box");
      if (worn) {
        box.append(itemIcon(worn.defId));
      } else {
        // Emplacement vide : la silhouette estompée de ce qui s'y porte, à la place d'un nom.
        const ghost = { amulet: uiIcon("amulet"), hat: uiIcon("hat"), armor: itemIcon("tunique"), melee: itemIcon("epee"), ranged: itemIcon("arc_court") }[slot];
        ghost.classList.add("ghost");
        box.append(ghost);
      }
      node.append(box);
      node.title = label;
      node.setAttribute("aria-label", label);
      node.addEventListener("click", () => {
        sfx.play("click");
        selected = worn && selectedSlot !== slot ? { slot } : null;
        renderBag();
      });
      return node;
    }),
  );

  // Le sac : grille de cases.
  const grid = $("bag-grid");
  grid.style.setProperty("--cols", String(bag.cols));
  grid.style.setProperty("--rows", String(bag.rows));
  grid.replaceChildren(
    ...bag.items.map((item) => {
      const def = bag.def(item);
      const node = itemNode(item, `bag-item${item.uid === selectedUid ? " selected" : ""}`);
      node.style.left = `${(100 * item.x) / bag.cols}%`;
      node.style.top = `${(100 * item.y) / bag.rows}%`;
      node.style.width = `${(100 * def.w) / bag.cols}%`;
      node.style.height = `${(100 * def.h) / bag.rows}%`;
      return node;
    }),
  );

  const info = $("bag-info");
  const action = $("bag-equip");
  const item = selectedUid !== null ? bag.get(selectedUid) : selectedSlot ? game.equipment[selectedSlot] : null;
  if (!item) {
    selected = null;
    info.replaceChildren(el("div", "", "Touchez un objet pour le sélectionner. Dans le sac, touchez ensuite une case libre pour le déplacer."));
    action.hidden = true;
    return;
  }
  const def: ItemDef = ITEMS[item.defId];
  info.replaceChildren(itemCard(def, item.count, selectedSlot ? " — porté" : ""));
  const wearable = def.kind !== "ammo" && def.kind !== "key" && def.kind !== "gold";
  action.hidden = !wearable;
  action.textContent = selectedSlot ? "Retirer" : "Équiper";
}

$("bag-grid").addEventListener("click", (e) => {
  const grid = $("bag-grid");
  const rect = grid.getBoundingClientRect();
  const bag = game.inventory;
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * bag.cols);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * bag.rows);
  const hit = bag.at(x, y);
  const selectedUid = selected && "uid" in selected ? selected.uid : null;
  if (hit) selected = hit.uid === selectedUid ? null : { uid: hit.uid };
  else if (selectedUid !== null) bag.moveTo(selectedUid, x, y);
  sfx.play("click");
  renderBag();
});
button("bag-equip", () => {
  if (selected && "uid" in selected) {
    if (!game.equip(selected.uid)) logLines.push("Pas assez de place dans le sac pour échanger.");
  } else if (selected && "slot" in selected) {
    if (!game.unequip(selected.slot)) logLines.push("Pas assez de place dans le sac.");
  }
  selected = null;
  aimShown = "";
  renderLog();
  renderBag();
});
button("open-bag", () => {
  bagOpen = true;
  selected = null;
  $("bag").hidden = false;
  renderBag();
});
button("found-close", () => {
  foundOpen = false;
  $("found").hidden = true;
});
button("bag-close", () => {
  bagOpen = false;
  $("bag").hidden = true;
});

// ---------- Menus : accueil, nouvelle partie, paramètres ----------

type Screen = "main" | "new" | "settings";

function showScreen(screen: Screen | null): void {
  menuOpen = screen !== null;
  menu.hidden = !menuOpen;
  for (const name of ["main", "new", "settings"] as const) $(`screen-${name}`).hidden = screen !== name;
  $("detail").hidden = true;
  $("menu-resume").hidden = !started || game.over;
  $("settings-sound").textContent = `Sons : ${options.sound ? "activés" : "désactivés"}`;
  if (screen === "new") renderCards();
}

interface Card {
  id: string;
  name: string;
  available: boolean;
  tagline: string;
  /** Deux lignes d'infos de base, visibles sur la case. */
  basics: string[];
  /** Fiche complète, ouverte par le bouton +. */
  details: string[];
}

const signedBonus = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

function raceCard(r: RaceDef): Card {
  return {
    id: r.id,
    name: r.name,
    available: r.available,
    tagline: r.tagline,
    basics: [`PV ${signedBonus(r.hpBonus)}`, `Vue ${r.darkVision} / ${r.sight}`],
    details: [
      r.tagline,
      `Points de vie : ${signedBonus(r.hpBonus)}`,
      `Vue dans le noir : ${r.darkVision} cases`,
      `Vue des zones éclairées : ${r.sight} cases`,
      `Trait — ${r.trait}`,
    ],
  };
}

function classCard(c: ClassDef): Card {
  // Les statistiques d'attaque sont celles des armes de départ, pas de la classe.
  const gear = c.startingItems.map((g) => ({ def: ITEMS[g.item] as ItemDef, count: g.count }));
  const weapons = gear.filter((g) => g.def.kind === "melee" || g.def.kind === "ranged");
  const armorClass = gear.find((g) => g.def.armorClass)?.def.armorClass ?? UNARMORED_AC;
  return {
    id: c.id,
    name: c.name,
    available: c.available,
    tagline: c.tagline,
    basics: [`PV ${c.hp} · CA ${armorClass}`, weapons.map((g) => g.def.name).join(" · ")],
    details: [
      c.tagline,
      `Points de vie : ${c.hp}`,
      `Crocheter une serrure : d20 ${signedBonus(c.lockpickBonus)}`,
      `Enfoncer une porte : d20 ${signedBonus(c.breakBonus)}`,
      "Équipement de départ :",
      ...gear.map((g) => {
        const d = g.def;
        if (d.armorClass) return `• ${d.name} : classe d'armure ${d.armorClass}`;
        if (d.attackBonus === undefined || !d.damage) return `• ${d.name} ×${g.count}`;
        return `• ${d.name} : d20 ${signedBonus(d.attackBonus)}, dégâts ${diceLabel(d.damage)}${d.range ? `, portée ${d.range} cases` : ""}`;
      }),
      `Style — ${c.trait}`,
    ],
  };
}

function el(tag: string, className: string, text = ""): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function buildCards(container: HTMLElement, cards: Card[], selectedId: string, onSelect: (id: string) => void): void {
  container.replaceChildren(
    ...cards.map((card) => {
      const node = el("div", `card${card.available ? "" : " locked"}${card.id === selectedId ? " selected" : ""}`);
      const more = el("button", "more", "+");
      more.setAttribute("aria-label", `Détail : ${card.name}`);
      more.addEventListener("click", (e) => {
        e.stopPropagation();
        sfx.play("click");
        showDetail(card);
      });
      node.append(more, el("div", "card-name", card.name), ...card.basics.map((line) => el("div", "card-info", line)));
      if (!card.available) node.append(el("div", "card-soon", "Bientôt"));
      node.addEventListener("click", () => {
        if (!card.available) return;
        sfx.play("click");
        onSelect(card.id);
        renderCards();
      });
      return node;
    }),
  );
}

function renderCards(): void {
  buildCards($("race-cards"), Object.values(RACES).map(raceCard), chosenRace.id, (id) => {
    chosenRace = RACES[id as keyof typeof RACES];
  });
  buildCards($("class-cards"), Object.values(CLASSES).map(classCard), chosenClass.id, (id) => {
    chosenClass = CLASSES[id as keyof typeof CLASSES];
  });
}

function showDetail(card: Card): void {
  $("detail-title").textContent = card.name;
  const lines = card.available ? card.details : [...card.details, "Pas encore jouable : valeurs provisoires."];
  $("detail-body").replaceChildren(...lines.map((line) => el("div", "", line)));
  $("detail").hidden = false;
}

button("open-menu", () => showScreen("main"));
button("menu-resume", () => showScreen(null));
button("menu-new", () => showScreen("new"));
button("menu-settings", () => showScreen("settings"));
button("new-back", () => showScreen("main"));
button("settings-back", () => showScreen("main"));
button("detail-close", () => {
  $("detail").hidden = true;
});
button("new-start", () => {
  newRun();
  started = true;
  showScreen(null);
});
button("settings-sound", () => {
  options.sound = !options.sound;
  sfx.enabled = options.sound;
  saveOptions();
  sfx.play("click");
  showScreen("settings");
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
      if (game.takeStairs()) {
        renderer.snapTo(game);
        collectEvents();
      }
    }
  }
  // Le tour suivant ne commence que lorsque tout ce qui s'est passé a été montré.
  if (!stepping && !cue && queue.length === 0 && !menuOpen && !bagOpen && !foundOpen) {
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

  if (!menuOpen) sfx.crackle(game.light[game.map.index(game.hero.x, game.hero.y)], dt);
  const aimRange = aimMode && game.arrows() > 0 ? (game.weapon("ranged")?.range ?? null) : null;
  renderer.draw(game, stepping ? Math.min(stepTime / stepMs, 1) : 1, dt, ghosts, aimRange);
  hudText.textContent = `Étage ${game.depth} · Niv ${game.level} · CA ${game.hero.armorClass} · Or ${game.gold}`;
  hpFill.style.width = `${(100 * shownHp) / game.hero.maxHp}%`;
  $("hp-label").textContent = `PV ${shownHp}/${game.hero.maxHp}`;
  $("xp-fill").style.width = `${(100 * game.xp) / game.xpToNext()}%`;
  $("xp-label").textContent = `XP ${game.xp}/${game.xpToNext()}`;
  // Seules les méthodes encore possibles sur cette porte sont proposées.
  const doorOptions = game.doorOptions();
  doorActions.hidden = doorOptions.length === 0 || game.over || cue !== null;
  $("door-key").hidden = !doorOptions.includes("key");
  $("door-pick").hidden = !doorOptions.includes("pick");
  $("door-break").hidden = !doorOptions.includes("break");
  // En arrivant devant une porte verrouillée, le héros bute dessus.
  if (game.pendingDoor && !doorWasPending) {
    renderer.addSlash(game.hero.id, game.hero.x, game.hero.y, game.pendingDoor.x, game.pendingDoor.y, "", false);
    sfx.play("knock");
  }
  doorWasPending = game.pendingDoor !== null;
  $("recenter").hidden = !renderer.isPanned();
  const bow = game.weapon("ranged");
  const aim = $("aim");
  aim.hidden = !bow;
  if (!bow) aimMode = false;
  // Dès qu'un ennemi arrive au contact, on repasse à l'arme de corps à corps.
  if (aimMode && game.isThreatened()) {
    aimMode = false;
    logLines.push("Ennemi au contact : vous reprenez votre arme de corps à corps.");
    renderLog();
  }
  // Le bouton : le pictogramme de l'arc et le nombre de flèches. Il s'allume quand l'arc est bandé.
  const aimKey = `${bow?.id}|${game.arrows()}`;
  if (aimKey !== aimShown) {
    aimShown = aimKey;
    aim.replaceChildren(uiIcon("arrow"), document.createTextNode(`×${game.arrows()}`));
  }
  aim.classList.toggle("active", aimMode);
  requestAnimationFrame(frame);
}

newRun();
showScreen("main");
requestAnimationFrame(frame);

// Accès de débogage pour les tests automatiques dans un navigateur (sans effet sur le jeu).
(window as unknown as { leutenheim: unknown }).leutenheim = { game: () => game };
