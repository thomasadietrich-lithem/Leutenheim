import { addRecord, loadRecords, recordLine } from "./ui/records";
import { DECOR, DECOR_PALETTE } from "./render/sprites/decor";
import { Sfx } from "./audio/sfx";
import { diceLabel } from "./core/dice";
import { expectedDamagePerTurn } from "./core/combat";
import { DoorAction, Game, GameEvent, GluckResult, NpcId } from "./core/game";
import { SOEUR_PALETTE, SOEUR_SPRITE } from "./render/sprites/soeur";
import { CLASSES, ClassDef } from "./data/classes";
import { ITEMS, ItemDef, ItemId, KIND_LABELS, RARITY_COLORS, RARITY_LABELS, Slot, SLOTS, UNARMORED_AC } from "./data/items";
import { MONSTERS, MonsterDef } from "./data/monsters";
import { RACES, RaceDef } from "./data/races";
import { RULES } from "./data/rules";
import { MERCHANT } from "./data/merchant";
import { Actor } from "./entities/actor";
import { bindInput } from "./input/pointer";
import { GLUCK_PALETTE, Renderer } from "./render/renderer";
import { SCHRAT } from "./render/sprites/schrat";
import { STAT_NAMES } from "./data/gluck";
import { StairsScene } from "./render/stairsScene";
import { PICTOS } from "./ui/pictos";
import { BELL, BELL_COLORS, buildIcon, GRIP_ICONS, HERO_HEAD, HERO_HEAD_PALETTE, itemIcon, PATH_ICONS, STATUS_ICONS, uiIcon } from "./ui/icons";
import { MAX_RANK, PATH_LEVEL, PATHS, PathId, PowerDef, StatId } from "./data/skills";
import { describe, REFUSALS } from "./ui/journal";

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
// Thomas (2026-11-11) : « un temps mort entre le coup et le dommage » : le dé roule moins longtemps, et le coup part
// dès que le dé se lance (les dégâts tombent quand la lame arrive).
const ROLL_MS = 200;
const HOLD_HERO_MS = 160;
const HOLD_FOE_MS = 360; // un peu plus long pour les attaques ennemies, pour avoir le temps de les lire
/** Le dé se vide ce délai après le dernier résultat affiché. */
const DIE_CLEAR_MS = 900;
const LOG_LINES = 3;
const OPTIONS_KEY = "leutenheim.options";

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const canvas = $("game") as HTMLCanvasElement;
const hpFill = $("hp-fill");
const hpBar = document.querySelector(".hp:not(.xp)") as HTMLElement;
const xpBar = document.querySelector(".hp.xp") as HTMLElement;
const mapFrame = document.querySelector(".frame") as HTMLElement;

/** Rejoue une petite animation CSS sur un élément (on retire la classe, puis on la remet). */
function pulse(node: HTMLElement, name: string): void {
  node.classList.remove(name);
  void node.offsetWidth; // force le navigateur à repartir de zéro
  node.classList.add(name);
}
const die = $("die");
const die2 = $("die2");
const dieWho = $("die-who");
const log = $("log");
const over = $("over");
const seedLabel = $("seed");
const doorActions = $("door-actions");
const menu = $("menu");

// ---------- Options (mémorisées sur l'appareil quand c'est possible) ----------

/** Réglages (Thomas, 2026-11-12) : bruitages et musique séparés ; langue (l'anglais viendra). */
const options = { sound: true, music: true, lang: "fr" as "fr" | "en" };
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
let shopOpen = false;
/** La conversation avec Gluck (quête 01) est ouverte. */
let talkOpen = false;
let wheelOpen = false;
/** Se dégager : on attend que le joueur touche une des cases proposées. */
let jumpMode = false;
/** Potion de feu sortie du sac : on attend la case où la lancer. */
let throwUid: number | null = null;
/** Pousser, avec plusieurs ennemis au contact : on attend que le joueur touche celui à pousser. */
let pushMode = false;
/** Genres d'objets déjà rencontrés dans cette partie : leur fiche ne s'affiche qu'à la première trouvaille. */
let seenItems = new Set<ItemId>();

// Encyclopédie : les objets déjà rencontrés, toutes parties confondues (mémorisés sur l'appareil).
const CODEX_KEY = "leutenheim.codex";
const codex = new Set<string>();
try {
  for (const id of JSON.parse(localStorage.getItem(CODEX_KEY) ?? "[]")) if (typeof id === "string") codex.add(id);
} catch {
  // Pas de mémoire disponible : l'encyclopédie repartira de zéro à chaque visite.
}
function discover(ids: Iterable<string>): void {
  const before = codex.size;
  for (const id of ids) codex.add(id);
  if (codex.size === before) return;
  try {
    localStorage.setItem(CODEX_KEY, JSON.stringify([...codex]));
  } catch {
    // Tant pis : la découverte vaut au moins pour cette visite.
  }
}
let started = false;
/** Partie trouvée sur l'appareil au lancement, proposée par « Reprendre ». */
let savedRun: Game | null = null;
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

// ---------- Sauvegarde (sur l'appareil) ----------

/** Deux emplacements : la partie de donjon et la salle d'essai ; « last » dit laquelle reprendre. */
/** Version publique (GitHub Pages) : pas de salle d'essai (Thomas, 2026-11-12). Fixé à la construction. */
declare const __PUBLIC__: boolean;
const PUBLIC_BUILD = typeof __PUBLIC__ !== "undefined" && __PUBLIC__;
if (PUBLIC_BUILD) $("menu-sandbox").remove();

const SAVE_KEYS = { donjon: "leutenheim.save", essai: "leutenheim.save.essai", last: "leutenheim.save.last" };
let lastSaveAt = 0;

function saveSlot(sandbox: boolean): string {
  return sandbox ? SAVE_KEYS.essai : SAVE_KEYS.donjon;
}

/** Écrit la partie en cours (au plus deux fois par seconde, sauf si on force). Sans effet si l'appareil refuse. */
function writeSave(force = false): void {
  if (!started || game.over) return;
  const now = performance.now();
  if (!force && now - lastSaveAt < 500) return;
  lastSaveAt = now;
  try {
    const data = game.snapshot();
    data.savedAt = new Date().toISOString();
    localStorage.setItem(saveSlot(game.sandbox), JSON.stringify(data));
    localStorage.setItem(SAVE_KEYS.last, game.sandbox ? "essai" : "donjon");
  } catch {
    /* stockage plein ou interdit : on joue sans sauvegarde */
  }
}

function eraseSave(sandbox: boolean): void {
  try {
    localStorage.removeItem(saveSlot(sandbox));
  } catch {
    /* sans gravité */
  }
}

/** La dernière partie sauvegardée, relue ; `null` s'il n'y en a pas (ou si elle est illisible). */
function readSave(): Game | null {
  try {
    const last = localStorage.getItem(SAVE_KEYS.last);
    const text = localStorage.getItem(last === "essai" && !PUBLIC_BUILD ? SAVE_KEYS.essai : SAVE_KEYS.donjon);
    return text ? Game.restore(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

// Le téléphone peut fermer l'application à tout moment : on sauvegarde dès qu'elle passe en arrière-plan.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") writeSave(true);
});
window.addEventListener("pagehide", () => writeSave(true));

function newRun(sandbox = false): void {
  // Seul endroit où le hasard « réel » intervient : le choix de la graine de la partie.
  setupRun(new Game(Math.floor(Math.random() * 0xffffffff), chosenRace, chosenClass, undefined, sandbox), null);
  started = true;
  savedRun = null;
  writeSave(true);
}

/** Reprend la partie sauvegardée. */
function resumeRun(saved: Game): void {
  setupRun(saved, [`Partie reprise : étage ${saved.depth}, tour ${saved.turn}.`]);
  started = true;
}

function setupRun(next: Game, lines: string[] | null): void {
  game = next;
  const sandbox = game.sandbox;
  $("test-tools").hidden = !sandbox;
  $("peace").textContent = "Combats : oui";
  aimMode = false;
  doorWasPending = false;
  foundOpen = false;
  $("found").hidden = true;
  seenItems = new Set<ItemId>(game.heroClass.startingItems.map((g) => g.item));
  discover(seenItems);
  stepping = false;
  queue = [];
  cue = null;
  ghosts = [];
  shownHp = game.hero.hp;
  orbHp = null;
  logLines = lines ?? (sandbox
    ? [
        "Salle d'essai : les dernières nouveautés, toujours au même endroit.",
        "Ici : les nouveaux objets (vous êtes niveau 4) et, dans le coin en bas à droite, L'ESCALIER DU BOSS : il descend à l'étage 2, la nichée de la Tisseuse (un plan différent à chaque partie). À l'est : colonnes, un Kobold qui fait sa ronde, cache à fouiller, piège à pointes, puis la CUISINE et la FORGE. Au sud-est : Kobolds à pousser, piège à gaz, un autre escalier vers le boss, puis la SALLE DE PRIÈRE et l'ALCHIMISTE. Plus au sud : l'antre de l'araignée (aiguille empoisonnée), puis la SALLE DE TORTURE (sarcophages). Au sud-ouest : un Kobold en ronde, une fosse, le dortoir. Bouton « Réveiller » : tous les monstres foncent sur vous.",
      ]
    : [`Vous incarnez un ${game.hero.name}. Touchez un monstre pour l'attaquer.`]);
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
  die.parentElement?.classList.toggle("pair", !die2.hidden);
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

const isRoll = (e: GameEvent): e is Extract<GameEvent, { type: "attack" | "door" | "hide" | "jump" | "searched" | "push" | "maiden" | "npcRoll" | "statue" }> =>
  e.type === "attack" ||
  e.type === "npcRoll" ||
  (e.type === "statue" && !e.look) ||
  e.type === "hide" ||
  e.type === "jump" ||
  e.type === "searched" ||
  e.type === "push" ||
  e.type === "maiden" ||
  (e.type === "door" && e.action !== "key");
const byFoe = (e: GameEvent): boolean => e.type === "attack" && e.attacker.kind === "monster";

/** Flèches déjà parties à l'écran (pour ne pas les faire voler deux fois). */
const launched = new WeakSet<object>();

/** Fait partir la flèche à l'écran : elle vole dès le tir, pas après le résultat du dé. */
function launchArrow(e: GameEvent | undefined): void {
  if (!e || e.type !== "arrow" || launched.has(e)) return;
  launched.add(e);
  const aim = e.via ?? e;
  renderer.heroShoots(aim.x - e.fromX, aim.y - e.fromY);
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
  die.parentElement?.classList.toggle("pair", !die2.hidden);
  die2.className = `die rolling${foe ? " foe" : ""}`;
  const who = e.type === "attack" && e.attacker.kind === "monster" ? e.attacker.name : "Vous";
  dieWho.textContent = mode === "advantage" ? `${who} · avantage` : mode === "disadvantage" ? `${who} · désavantage` : who;
  dieWho.className = mode === "normal" ? "" : mode;
  // Jet de dialogue (Gluck) : on dit quelle caractéristique est jetée.
  if (e.type === "npcRoll") dieWho.textContent = e.stat;
  sfx.play("dice");
  if (mode !== "normal") sfx.play(mode);
  if (e.type === "attack" && e.ranged && foe) renderer.addProjectile(e.attacker.x, e.attacker.y, e.target.x, e.target.y, 0, false, true);
  else if (e.type === "attack" && e.ranged) launchArrow(queue.find((q) => q.type === "arrow"));
  // Corps à corps : l'élan et la lame partent tout de suite, pendant que le dé roule.
  if (e.type === "attack" && !e.ranged) {
    renderer.addSlash(e.attacker.id, e.attacker.x, e.attacker.y, e.target.x, e.target.y, foe ? "#ff8a7a" : "#f4f6ff");
  }
  if (e.type === "attack") {
    if (mode !== "normal") {
      // Avantage au joueur ou contre lui : on l'annonce au-dessus de celui qui en profite ou en pâtit.
      const good = (mode === "advantage") !== foe;
      renderer.addFloatingText(e.attacker.x, e.attacker.y, mode === "advantage" ? "Avantage !" : "Désavantage", good ? "#ffd75e" : "#ff6b7a");
    }
    if (e.ranged && !foe) sfx.play("bow");
  }
}

function landDie(value: number, outcome: "hit" | "miss" | "crit", foe: boolean, other?: number): void {
  die.textContent = String(value);
  die.className = `die land ${outcome}${foe ? " foe" : ""}`;
  if (other === undefined) {
    die2.hidden = true;
    die.parentElement?.classList.toggle("pair", !die2.hidden);
  } else {
    // Le dé écarté reste visible, estompé.
    die2.textContent = String(other);
    die2.className = `die dropped${foe ? " foe" : ""}`;
  }
}

/** Le résultat d'un événement est montré : texte, son, effets. */
function reveal(e: GameEvent): void {
  const line = describe(e, { depth: game.depth, doorHopeless: game.doorOptions().length === 0, sees: (a) => game.isVisible(a.x, a.y) });
  if (line) logLines.push(line);
  if (e.type === "attack") {
    const r = e.result;
    const foe = e.attacker.kind === "monster";
    if (e.opportunity) renderer.addFloatingText(e.attacker.x, e.attacker.y, "Opportunité !", "#ffd75e");
    const dropped = r.rolls.length === 2 ? r.rolls[0] + r.rolls[1] - r.d20 : undefined;
    landDie(r.d20, r.critical ? "crit" : r.hit ? "hit" : "miss", foe, dropped);
    renderer.addFloatingText(
      e.target.x,
      e.target.y,
      r.hit ? `-${r.damage}` : "Raté",
      r.critical ? "#ffd75e" : r.hit ? (foe ? "#ff6b7a" : "#ffffff") : "#a8a2c0",
    );
    if (foe) shownHp = Math.max(0, shownHp - r.damage);
    if (!foe && r.hit) renderer.monsterHurt(e.target.id);
    if (r.hit && r.damage > 0) {
      const bloodColor = e.target.kind === "monster" ? (MONSTERS[e.target.defId as keyof typeof MONSTERS]?.blood ?? "red") : "red";
      renderer.addBloodBurst(e.target.x, e.target.y, e.attacker.x, e.attacker.y, bloodColor);
    }
    if (foe && r.hit) {
      renderer.heroHurt();
      pulse(hpBar, "hit");
      pulse(mapFrame, "hurt");
    }
    // Arme lourde (lente ou à deux mains) : un choc plus grave, pour sentir le poids de la lame.
    const melee = !foe && !e.ranged ? game.weapon("melee") : undefined;
    const heavy = !!melee && (melee.speed === "slow" || !!melee.twoHanded);
    sfx.play(r.critical ? "crit" : r.hit ? (foe ? "hurt" : heavy ? "heavy" : "hit") : "miss");
  } else if (e.type === "door") {
    if (e.action === "key") {
      sfx.play("key");
    } else {
      landDie(e.d20, e.success ? "hit" : "miss", false);
      if (e.action === "break") {
        // Le héros se jette contre la porte : élan, choc, et le fracas qui résonne.
        renderer.addSlash(game.hero.id, game.hero.x, game.hero.y, e.x, e.y, "", false);
        renderer.addFloatingText(e.x, e.y, e.success ? "CRAC !" : "BOUM", "#ffd75e");
        sfx.play(e.success ? "break" : "shoulder");
      } else {
        sfx.play(e.success ? "unlock" : "click");
      }
    }
  } else if (e.type === "shop") {
    openShop(e.line);
  } else if (e.type === "shatter") {
    // La fiole vole, se brise : « Cling ! », des éclats de sa couleur.
    renderer.addHop(e.item, e.fromX, e.fromY, e.x, e.y, true);
    window.setTimeout(() => {
      renderer.addSplash(e.x, e.y, POTION_SHADES[e.potion] ?? POTION_SHADES.youth);
      renderer.addFloatingText(e.x, e.y, "Cling !", "#e8f4ff");
      sfx.play("glass");
    }, 420);
  } else if (e.type === "luck") {
    renderer.addFloatingText(game.hero.x, game.hero.y, "Chance !", "#ffd75e");
  } else if (e.type === "statue") {
    if (!e.look) {
      landDie(e.d20!, e.success ? "hit" : "miss", false);
      renderer.addFloatingText(e.x, e.y, e.success ? "CRAC !" : "BONG", "#ffd75e");
      sfx.play(e.success ? "break" : "thud");
    }
  } else if (e.type === "npcRoll") {
    landDie(e.d20, e.success ? "hit" : "miss", false);
  } else if (e.type === "npc") {
    if (e.what === "talk") openTalk(e.who);
    // Il part : nuage et « Pouf ! » (la conversation est fermée : voir `talkLater`).
    else gluckPouf(e);
  } else if (e.type === "bounce") {
    renderer.addHop(e.item, e.fromX, e.fromY, e.x, e.y);
    renderer.addFloatingText(game.hero.x, game.hero.y, "Sac plein", "#ffd75e");
  } else if (e.type === "merchantLeaves") {
    if (e.seen) renderer.addFloatingText(e.x, e.y, "Pfft !", "#c8b8ff");
    if (shopOpen) closeShop();
  } else if (e.type === "merchantHides" || e.type === "merchantShows") {
    const m = game.merchant();
    if (m) renderer.addFloatingText(m.x, m.y, e.type === "merchantHides" ? "…" : "Psst !", "#c8b8ff");
  } else if (e.type === "maiden") {
    // Sarcophage à pointes : désamorcé ou forcé ; raté, une pointe jaillit (le héros saigne), il s'ouvre quand même.
    landDie(e.d20, e.success ? "hit" : "miss", false);
    renderer.addSlash(game.hero.id, game.hero.x, game.hero.y, e.x, e.y, "", false);
    if (e.damage > 0) {
      renderer.addFloatingText(game.hero.x, game.hero.y, `Pointe ! −${e.damage}`, "#ff6b7a");
      renderer.heroHurt();
      pulse(hpBar, "hit");
      shownHp = game.hero.hp;
      sfx.play("hurt");
    } else {
      renderer.addFloatingText(e.x, e.y, e.action === "pick" ? "Désamorcé" : "CRAC !", "#ffd75e");
      sfx.play(e.action === "pick" ? "unlock" : "break");
    }
  } else if (e.type === "arrow") {
    if (!launched.has(e)) sfx.play("bow");
    launchArrow(e);
  } else if (e.type === "pickup") {
    discover([e.item]);
    const found: ItemDef = ITEMS[e.item];
    sfx.play("pickup");
    // Ce qu'on ramasse s'affiche au-dessus de la tête du héros (demande de Thomas).
    if (found.kind === "gold") renderer.addFloatingText(game.hero.x, game.hero.y, `+${e.count} or`, "#f0c850");
    else if (found.kind === "gem") renderer.addFloatingText(game.hero.x, game.hero.y, `+${(found.value ?? 0) * e.count} or`, "#f0c850");
    else renderer.addFloatingText(game.hero.x, game.hero.y, `${found.name}${e.count > 1 ? ` ×${e.count}` : ""}`, "#fff3c8");
    // Ramasser n'ouvre jamais la fiche : seul le bouton « ? » de la languette la montre (demande de Thomas).
  } else if (e.type === "xp") {
    renderer.addFloatingText(game.hero.x, game.hero.y, `+${e.amount} XP`, "#8fc7ff");
    // Billes d'expérience (Thomas, 2026-11-11) : elles quittent le monstre vaincu et filent vers la jauge.
    if (lastKill) xpOrbs(lastKill, e.amount);
    else pulse(xpBar, "gain");
    lastKill = null;
  } else if (e.type === "levelup") {
    shownHp = game.hero.hp;
    sfx.play("heal");
  } else if (e.type === "trapDodged") {
    renderer.addFloatingText(e.x, e.y, "Évité !", "#9fe0a0");
  } else if (e.type === "boss" && e.what === "dead") {
    // Thomas (2026-11-11) : la démo s'arrête après la Tisseuse ; on peut continuer à explorer la nichée.
    setTimeout(showDemoEnd, 900);
  } else if (e.type === "death") {
    if (e.actor.kind === "hero") {
      renderer.heroFalls();
      showDeath();
      over.hidden = false;
      sfx.play("death");
    } else {
      ghosts = ghosts.filter((g) => g !== e.actor);
      renderer.monsterDies(e.actor);
      lastKill = { x: e.actor.x + ((e.actor.size ?? 1) - 1) / 2, y: e.actor.y + ((e.actor.size ?? 1) - 1) / 2 };
      sfx.play("kill");
    }
  } else if (e.type === "noise") {
    // Seulement les gros bruits (porte enfoncée) : pas d'ondes à chaque coup (Thomas, 2026-11-11).
    if (e.points >= RULES.alarmBreak) renderer.addNoise(e.x, e.y, e.points);
  } else if (e.type === "alarm") {
    // La cloche d'alerte sonne une fois par palier atteint (une, deux, trois fois).
    for (let k = 0; k < e.stage; k++) setTimeout(() => sfx.play("bell"), k * 650);
    renderer.addFloatingText(game.hero.x, game.hero.y, ["", "Le donjon s'agite", "Alerte !", "Traque !"][e.stage] ?? "", "#ff8a7a");
  } else if (e.type === "fire") {
    renderer.addFloatingText(e.x, e.y, "Feu !", "#ff9a3a");
    sfx.play("break");
  } else if (e.type === "burn") {
    if (e.actor.kind === "hero") {
      renderer.heroHurt();
      shownHp = Math.max(0, shownHp - e.damage);
    } else renderer.monsterHurt(e.actor.id);
    renderer.addFloatingText(e.actor.x, e.actor.y, `-${e.damage}`, "#ff9a3a");
  } else if (e.type === "skill") {
    if (e.path === "blue") {
      renderer.addFloatingText(game.hero.x, game.hero.y, `+${e.healed} PV`, "#9fd0f4");
      shownHp = game.hero.hp;
      sfx.play("heal");
    }
  } else if (e.type === "lastStand") {
    renderer.addFloatingText(game.hero.x, game.hero.y, "Dernier rempart !", "#9fd0f4");
    shownHp = game.hero.hp;
  } else if (e.type === "slowed") {
    renderer.addFloatingText(e.actor.x, e.actor.y, "Ralenti", "#9fe060");
  } else if (e.type === "potion") {
    sfx.play("heal");
  } else if (e.type === "poison") {
    if (e.actor.kind === "hero") {
      renderer.heroHurt();
      pulse(hpBar, "hit");
      shownHp = game.hero.hp;
    } else renderer.monsterHurt(e.actor.id);
    renderer.addFloatingText(e.actor.x, e.actor.y, `-${e.damage}`, "#9fe060");
  } else if (e.type === "used") {
    sfx.play(e.healed !== undefined ? "heal" : "pickup");
  } else if (e.type === "noticed") {
    renderer.addFloatingText(e.actor.x, e.actor.y, "!", "#ffd75e");
    sfx.play("notice");
  } else if (e.type === "counter") {
    // Le Kobold qui compte derrière sa porte (Thomas, 2026-11-12).
    // Un nombre par tour, toujours le même (Thomas, 2026-11-12 : « 17, 17, 17 plutôt que plusieurs à la fois »).
    if (e.what === "count") renderer.addFloatingText(e.x, e.y, `${e.n}…`, "#c8c0d4");
    else if (e.what === "poke") {
      renderer.addFloatingText(game.hero.x, game.hero.y, "Aïe ! L'œil !", "#ff6b7a");
      renderer.addFloatingText(e.x, e.y, `${e.n}…`, "#c8c0d4");
      renderer.heroHurt();
      shownHp = game.hero.hp;
      sfx.play("hurt");
    } else {
      renderer.addFloatingText(e.x, e.y, `…${e.n} ?`, "#ffd75e");
      sfx.play("notice");
    }
  } else if (e.type === "bell") {
    sfx.play("bell");
    renderer.ringBell(e.x, e.y);
    renderer.addFloatingText(e.x, e.y, "DONG !", "#ffd75e");
  } else if (e.type === "feud") {
    // Deux monstres se querellent : « Grr ! » au-dessus des deux.
    if (game.isVisible(e.a.x, e.a.y) || game.isVisible(e.b.x, e.b.y)) {
      renderer.addFloatingText(e.a.x, e.a.y, "Grr !", "#ff8a7a");
      renderer.addFloatingText(e.b.x, e.b.y, e.reason === "shot" ? "Hé !" : "Grr !", "#ff8a7a");
      sfx.play("notice");
    }
  } else if (e.type === "infight") {
    if (game.isVisible(e.attacker.x, e.attacker.y) || game.isVisible(e.target.x, e.target.y)) {
      if (e.ranged) renderer.addProjectile(e.attacker.x, e.attacker.y, e.target.x, e.target.y, 0, false, true);
      else renderer.addSlash(e.attacker.id, e.attacker.x, e.attacker.y, e.target.x, e.target.y, "#ff8a7a");
      renderer.addFloatingText(e.target.x, e.target.y, e.hit ? `-${e.damage}` : "Raté", e.hit ? "#ffb08a" : "#a8a2c0");
      if (e.hit) {
        renderer.monsterHurt(e.target.id);
        const bloodColor = MONSTERS[e.target.defId as keyof typeof MONSTERS]?.blood ?? "red";
        if (e.damage > 0) renderer.addBloodBurst(e.target.x, e.target.y, e.attacker.x, e.attacker.y, bloodColor);
      }
      sfx.play(e.hit ? "hit" : "miss");
    }
  } else if (e.type === "bagFull") {
    if (e.item && e.x !== undefined && e.y !== undefined) {
      renderer.addHop(e.item, e.x, e.y, e.x, e.y);
      renderer.addFloatingText(e.x, e.y, "Sac plein", "#ff8a7a");
    }
  } else if (e.type === "heavyBlow") {
    renderer.addFloatingText(e.actor.x, e.actor.y, e.kind === "stun" ? "Assommé !" : "Net !", e.kind === "stun" ? "#ffd75e" : "#ffffff");
    if (e.kind === "stun") sfx.play("thud");
  } else if (e.type === "stairs") {
    shownHp = game.hero.hp;
    sfx.play("descend");
  } else if (e.type === "hide") {
    landDie(e.d20, e.success ? "hit" : "miss", false);
    renderer.addFloatingText(game.hero.x, game.hero.y, e.success ? "Caché" : "Visible", e.success ? "#c8c8c8" : "#ff6b7a");
    if (!e.success) sfx.play("miss");
  } else if (e.type === "gravel") {
    sfx.play(e.water ? "splash" : "gravel");
    // « Crik », puis « Crak » sur le gravier ; « Plic », puis « Ploc » dans l'eau (Thomas, 2026-11-12).
    renderer.addFloatingText(e.x, e.y, e.water ? (gravelCrik ? "Plic" : "Ploc") : gravelCrik ? "Crik" : "Crak", e.water ? "#9fd0f4" : "#c8c0d4");
    gravelCrik = !gravelCrik;
  } else if (e.type === "revealed") {
  } else if (e.type === "jump") {
    landDie(e.d20, e.success ? "hit" : "miss", false);
    renderer.addFloatingText(e.x, e.y, e.success ? "Dégagé !" : "Raté", e.success ? "#ffd75e" : "#ff6b7a");
    sfx.play(e.success ? "step" : "miss");
  } else if (e.type === "push") {
    landDie(e.d20, e.success ? "hit" : "miss", false);
    renderer.addSlash(game.hero.id, game.hero.x, game.hero.y, e.target.x, e.target.y, "", false);
    if (e.slam > 0) renderer.addFloatingText(e.target.x, e.target.y, `BAM ! −${e.slam}`, "#ffd75e");
    else renderer.addFloatingText(e.target.x, e.target.y, e.success ? "Poussé !" : "Raté", e.success ? "#ffd75e" : "#ff6b7a");
    sfx.play(!e.success ? "miss" : e.slam > 0 ? "thud" : "hit");
  } else if (e.type === "trap") {
    const hero = e.victim.kind === "hero";
    renderer.trapSprung(e.x, e.y);
    const label = e.kind === "gas" ? "Gaz !" : e.kind === "pit" ? `Fosse ! −${e.damage}` : e.kind === "needle" ? `Aiguille ! −${e.damage}` : `Piège ! −${e.damage}`;
    renderer.addFloatingText(e.x, e.y, label, e.kind === "gas" || e.kind === "needle" ? "#9fe060" : "#ff6b7a");
    sfx.play(e.damage === 0 ? "gravel" : hero ? "hurt" : "hit");
    if (hero) {
      renderer.heroHurt();
      pulse(hpBar, "hit");
      pulse(mapFrame, "hurt");
      shownHp = game.hero.hp;
    }
  } else if (e.type === "search") {
    if (e.phase === "interrupted") renderer.addFloatingText(game.hero.x, game.hero.y, "!", "#ff6b7a");
  } else if (e.type === "searched") {
    landDie(e.d20, e.success ? "hit" : "miss", false);
    renderer.scanRoom(e.room, game.hero, e.found, game.interactiveIn(e.room));
    for (const f of e.found) renderer.addFloatingText(f.x, f.y, "Trouvé !", "#fff3a0");
    if (e.found.length > 0) sfx.play("advantage");
  } else if (e.type === "rest") {
    if (e.phase === "interrupted") {
      renderer.addFloatingText(game.hero.x, game.hero.y, "!", "#ff6b7a");
    } else if (e.phase === "done") {
      renderer.addFloatingText(game.hero.x, game.hero.y, `+${e.healed} PV`, "#8fe08f");
      shownHp = game.hero.hp;
      sfx.play("heal");
    }
  } else if (e.type === "opened") {
    sfx.play("door");
  } else if (e.type === "fountain") {
    shownHp = game.hero.hp;
    sfx.play("heal");
    renderer.addFloatingText(game.hero.x, game.hero.y, "Béni !", "#ffe27a");
  } else if (e.type === "chest") {
    sfx.play("unlock");
  }
  renderLog();
}

/**
 * Écran de fin (Thomas, 2026-11-11) : de quoi le héros est mort, plus le nombre de tours ; la partie entre dans les
 * records (sauf en salle d'essai), avec les trois meilleures dessous.
 */
/** Fin de la démo (Thomas, 2026-11-11) : après la victoire contre la Tisseuse. La partie reste ouverte derrière. */
function showDemoEnd(): void {
  over.replaceChildren();
  over.classList.add("over-win");
  over.append(el("div", "over-title", "Fin de la démo"), el("div", "over-line", "La Tisseuse est vaincue : la première section du donjon est terminée."));
  over.append(el("div", "over-line", `Niveau ${game.level} · ${game.gold} pièces d'or`));
  over.append(el("div", "over-sub", "Merci d'avoir joué ! La suite du donjon arrive bientôt."));
  const stay = el("button", "", "Continuer à explorer") as HTMLButtonElement;
  stay.type = "button";
  stay.addEventListener("click", () => {
    over.hidden = true;
    over.classList.remove("over-win");
  });
  const again = el("button", "", "Nouvelle partie") as HTMLButtonElement;
  again.type = "button";
  again.addEventListener("click", () => {
    over.classList.remove("over-win");
    showScreen("new");
  });
  over.append(stay, again);
  over.hidden = false;
}

/** PV affichés à l'image précédente : une baisse fait tomber des billes rouges de la jauge, une hausse en fait monter du
 * héros vers la jauge (Thomas, 2026-11-11). null = pas encore de référence (nouvelle partie, reprise). */
let orbHp: number | null = null;

function hpOrbs(): void {
  const before = orbHp;
  orbHp = shownHp;
  if (before === null || before === shownHp || !started) return;
  const delta = shownHp - before;
  const bar = hpBar.getBoundingClientRect();
  const max = Math.max(1, game.hero.maxHp);
  const count = Math.max(2, Math.min(7, Math.abs(delta)));
  if (delta < 0) {
    // Perte : les billes se détachent du morceau de jauge perdu, tombent en rebondissant un peu et s'effacent.
    const from = bar.left + (bar.width * shownHp) / max;
    const to = bar.left + (bar.width * before) / max;
    for (let i = 0; i < count; i++) {
      const orb = document.createElement("div");
      orb.className = "hp-orb";
      const sx = from + (to - from) * Math.random();
      const sy = bar.top + bar.height * (0.3 + Math.random() * 0.4);
      orb.style.left = `${sx}px`;
      orb.style.top = `${sy}px`;
      document.body.append(orb);
      const drift = (Math.random() - 0.5) * 36;
      const fall = 50 + Math.random() * 40;
      orb.animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          { transform: `translate(${drift * 0.4}px, -8px) scale(1)`, opacity: 1, offset: 0.15 },
          { transform: `translate(${drift}px, ${fall}px) scale(0.6)`, opacity: 0 },
        ],
        { duration: 700 + Math.random() * 200, delay: i * 40, easing: "cubic-bezier(.4,0,.9,.6)", fill: "forwards" },
      ).onfinish = () => orb.remove();
    }
  } else {
    // Soin : les billes partent du héros et remontent se fondre dans la jauge, qui s'allume.
    const box = canvas.getBoundingClientRect();
    const c = renderer.tileCenter(game.hero.x, game.hero.y);
    const end = bar.left + (bar.width * shownHp) / max;
    for (let i = 0; i < count; i++) {
      const orb = document.createElement("div");
      orb.className = "hp-orb";
      const sx = box.left + c.x + (Math.random() - 0.5) * 18;
      const sy = box.top + c.y + (Math.random() - 0.5) * 18;
      const tx = Math.max(bar.left + 6, end - Math.random() * Math.min(60, (bar.width * delta) / max + 10));
      const ty = bar.top + bar.height / 2;
      orb.style.left = `${sx}px`;
      orb.style.top = `${sy}px`;
      document.body.append(orb);
      orb.animate(
        [
          { transform: "translate(0, 0) scale(0.6)", opacity: 0 },
          { transform: `translate(${(Math.random() - 0.5) * 30}px, -20px) scale(1)`, opacity: 1, offset: 0.25 },
          { transform: `translate(${tx - sx}px, ${ty - sy}px) scale(0.7)`, opacity: 0.9 },
        ],
        { duration: 650, delay: 60 + i * 60, easing: "ease-in", fill: "forwards" },
      ).onfinish = () => {
        orb.remove();
        pulse(hpBar, "gain");
      };
    }
  }
}

/** Dernier monstre vaincu (sa case) : c'est de là que partent les billes d'expérience. */
let lastKill: { x: number; y: number } | null = null;
/** Points d'XP encore en vol (billes bleues pas arrivées) : la jauge ne les compte qu'à leur arrivée (Thomas, 2026-11-12). */
let xpInFlight = 0;

function xpNeed(level: number): number {
  const table = RULES.xpLevels as readonly number[];
  const n = level - 1;
  return n < table.length ? table[n] : table[table.length - 1] + (n - table.length + 1) * RULES.xpLevelStep;
}

/** Niveau et XP montrés par la jauge : ceux du héros, moins les billes encore en vol. */
function shownXp(): { level: number; xp: number; need: number } {
  let level = game.level;
  let xp = game.xp - xpInFlight;
  while (xp < 0 && level > 1) {
    level--;
    xp += xpNeed(level);
  }
  return { level, xp: Math.max(0, xp), need: xpNeed(level) };
}

/** Billes d'expérience : de petites perles bleues qui partent du monstre et volent jusqu'à la jauge, qui s'allume. */
function xpOrbs(cell: { x: number; y: number }, amount: number): void {
  const box = canvas.getBoundingClientRect();
  const c = renderer.tileCenter(cell.x, cell.y);
  const bar = xpBar.getBoundingClientRect();
  const count = Math.max(3, Math.min(8, amount));
  // Chaque bille porte sa part de l'XP gagnée ; la jauge avance quand elle arrive.
  const shares = Array.from({ length: count }, (_, i) => Math.floor(((i + 1) * amount) / count) - Math.floor((i * amount) / count));
  xpInFlight += amount;
  for (let i = 0; i < count; i++) {
    const orb = document.createElement("div");
    orb.className = "xp-orb";
    const sx = box.left + c.x + (Math.random() - 0.5) * 18;
    const sy = box.top + c.y + (Math.random() - 0.5) * 18;
    const tx = bar.left + bar.width * (0.25 + Math.random() * 0.5);
    const ty = bar.top + bar.height / 2;
    orb.style.left = `${sx}px`;
    orb.style.top = `${sy}px`;
    document.body.append(orb);
    const delay = 120 + i * 70;
    // Un petit saut vers le haut, puis le vol jusqu'à la jauge.
    orb.animate(
      [
        { transform: "translate(0, 0) scale(0.6)", opacity: 0 },
        { transform: `translate(${(Math.random() - 0.5) * 30}px, -22px) scale(1)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${tx - sx}px, ${ty - sy}px) scale(0.7)`, opacity: 0.9 },
      ],
      { duration: 650, delay, easing: "ease-in", fill: "forwards" },
    ).onfinish = () => {
      orb.remove();
      xpInFlight = Math.max(0, xpInFlight - shares[i]);
      pulse(xpBar, "gain");
    };
  }
}

function showDeath(): void {
  over.classList.remove("over-win");
  const cause = game.deathCause ?? "ses blessures";
  over.replaceChildren();
  over.append(el("div", "over-title", "Vous êtes mort"), el("div", "over-line", `À l'étage ${game.depth}, tué par ${cause}.`));
  over.append(el("div", "over-line", `Niveau ${game.level} · ${game.gold} pièces d'or`));
  if (!game.sandbox) {
    const d = new Date();
    const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const rank = addRecord({ deepest: game.deepest, level: game.level, gold: game.gold, cause, hero: game.heroClass.name, date, bosses: game.bossKills });
    if (rank === 1) over.append(el("div", "over-best", "Nouveau record !"));
    else if (rank > 0) over.append(el("div", "over-line", `${rank}e meilleure partie`));
  }
  const again = el("button", "", "Nouvelle partie") as HTMLButtonElement;
  again.type = "button";
  again.addEventListener("click", () => showScreen("new"));
  over.append(again);
  over.hidden = false;
}

function renderRecords(): void {
  const list = $("records-list");
  list.replaceChildren();
  const records = loadRecords();
  if (records.length === 0) list.append(el("p", "", "Aucune partie terminée pour l'instant."));
  records.forEach((r, i) => list.append(el("div", "over-record", recordLine(r, i + 1))));
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
    // Pendant le passage d'un étage à l'autre, toucher l'écran l'abrège.
    if (stairsScene) {
      stairsScene.skip();
      return;
    }
    if (menuOpen || bagOpen || foundOpen || shopOpen || talkOpen) return;
    const t = renderer.screenToTile(px, py);
    if (pushMode) {
      pushMode = false;
      renderer.jumpCells = [];
      const target = game.pushTargets().find((m) => m.x === t.x && m.y === t.y);
      if (target && game.push(target.id)) stepMs = COMBAT_STEP_MS;
      else {
        logLines.push("Vous renoncez à pousser.");
        renderLog();
      }
      return;
    }
    if (throwUid !== null) {
      // Potion à lancer : toucher une case proposée la lance ; toucher ailleurs renonce.
      const uid = throwUid;
      throwUid = null;
      renderer.jumpCells = [];
      if (game.throwPotion(uid, t.x, t.y)) stepMs = COMBAT_STEP_MS;
      else {
        logLines.push("Vous gardez la potion.");
        renderLog();
      }
      return;
    }
    if (jumpMode) {
      // Toucher une case proposée y fait sauter le héros ; toucher ailleurs renonce.
      jumpMode = false;
      renderer.jumpCells = [];
      if (game.disengage(t.x, t.y)) stepMs = COMBAT_STEP_MS;
      else {
        logLines.push("Vous renoncez à vous dégager.");
        renderLog();
      }
      return;
    }
    if (aimMode) {
      // Mode arc : toucher sa propre case renonce au tir ; tout autre toucher tire vers la case désignée.
      if (t.x === game.hero.x && t.y === game.hero.y) aimMode = false;
      else fireAt(t.x, t.y);
      return;
    }
    if (game.setDestination(t.x, t.y)) stepMs = stepDuration(game.path.length);
    // Ce qui arrive sans qu'un tour passe (conversation avec Gluck ou le Colporteur, déjà à côté) : on le montre tout de suite.
    if (game.events.length > 0) collectEvents();
    // Toucher l'escalier sur lequel on se tient : on le prend (Thomas, 2026-11-12).
    if (!stepping && game.pendingStairs) beginStairs();
  },
  onMove(dx, dy) {
    if (menuOpen || bagOpen || foundOpen || shopOpen || talkOpen) return;
    if (game.path.length === 0 && game.moveBy(dx, dy)) stepMs = KEYBOARD_STEP_MS;
  },
  onPan(dx, dy) {
    if (!menuOpen && !bagOpen) renderer.panBy(dx, dy);
  },
  onZoom(factor) {
    renderer.zoomBy(factor);
  },
  onLongPress(px, py) {
    if (menuOpen || bagOpen || foundOpen || shopOpen || talkOpen || game.over) return false;
    const t = renderer.screenToTile(px, py);
    if (t.x !== game.hero.x || t.y !== game.hero.y) return false;
    openWheel();
    return true;
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

// ---------- Roue d'actions ----------

const wheel = $("wheel");
/** Les cinq actions, dans l'ordre de la couronne (en partant du haut, dans le sens des aiguilles d'une montre). */
const WHEEL = [
  ["wheel-search", "search", "Fouiller"],
  ["wheel-push", "push", "Pousser"],
  ["wheel-disengage", "disengage", "Se dégager"],
  ["wheel-item", "item", "Utiliser un objet"],
  ["wheel-rest", "rest", "Se reposer"],
  ["wheel-hide", "hide", "Se cacher"],
  ["wheel-skill", "actions", "Compétence de voie"],
] as const;

function closeWheel(): void {
  wheelOpen = false;
  wheel.hidden = true;
}

function openWheel(): void {
  if (game.over) return;
  aimMode = false;
  jumpMode = false;
  pushMode = false;
  renderer.jumpCells = [];
  renderer.recenter();
  const frameBox = wheel.parentElement!.getBoundingClientRect();
  const radius = 72;
  // Autour du héros ; si la vue est décalée, la couronne reste entière dans le cadre.
  const hero = renderer.tileCenter(game.hero.x, game.hero.y);
  const cx = Math.max(radius + 28, Math.min(frameBox.width - radius - 28, hero.x));
  const cy = Math.max(radius + 28, Math.min(frameBox.height - radius - 28, hero.y));
  // Le pouvoir de la voie (bleue, rouge) a désormais son propre bouton dans la barre du bas (Thomas, 2026-11-11).
  const withSkill = false;
  $("wheel-skill").hidden = !withSkill;
  if (game.voie) $("wheel-skill").replaceChildren(buildIcon(PATH_ICONS[game.voie]));
  const shown = WHEEL.filter(([id]) => id !== "wheel-skill" || withSkill);
  shown.forEach(([id], i) => {
    const angle = ((-90 + (i * 360) / shown.length) * Math.PI) / 180;
    const b = $(id);
    b.style.left = `${cx + radius * Math.cos(angle)}px`;
    b.style.top = `${cy + radius * Math.sin(angle)}px`;
    // Une action impossible reste visible, grisée ; utiliser un objet n'existe pas encore.
    const possible =
      id === "wheel-rest" ? game.restRefusal() === null
      : id === "wheel-hide" ? game.hideRefusal() === null
      : id === "wheel-disengage" ? game.disengageRefusal() === null
      : id === "wheel-search" ? game.searchRefusal() === null
      : id === "wheel-push" ? game.pushRefusal() === null
      : id === "wheel-skill" ? game.skillRefusal() === null
      : false;
    b.classList.toggle("off", !possible);
  });
  wheelOpen = true;
  wheel.hidden = false;
}

for (const [id, icon, label] of WHEEL) {
  $(id).replaceChildren(uiIcon(icon));
  $(id).setAttribute("aria-label", label);
  $(id).addEventListener("click", (ev) => {
    ev.stopPropagation();
    sfx.unlock();
    sfx.play("click");
    closeWheel();
    if (id === "wheel-skill") {
      const refusal = game.skillRefusal();
      if (refusal) logLines.push(REFUSALS.skill[refusal]);
      else if (game.useSkill()) stepMs = COMBAT_STEP_MS;
    } else if (id === "wheel-rest") {
      const refusal = game.restRefusal();
      if (refusal) logLines.push(REFUSALS.rest[refusal]);
      else if (game.rest()) stepMs = COMBAT_STEP_MS;
    } else if (id === "wheel-push") {
      const targets = game.pushTargets();
      if (targets.length === 0) logLines.push("Personne à pousser : aucun ennemi au contact.");
      else if (targets.length === 1) {
        if (game.push(targets[0].id)) stepMs = COMBAT_STEP_MS;
      } else {
        pushMode = true;
        renderer.jumpCells = targets.map((m) => ({ x: m.x, y: m.y }));
        logLines.push("Touchez l'ennemi à pousser.");
      }
    } else if (id === "wheel-search") {
      const refusal = game.searchRefusal();
      if (refusal) logLines.push(REFUSALS.search[refusal]);
      else if (game.search()) stepMs = COMBAT_STEP_MS;
    } else if (id === "wheel-hide") {
      const refusal = game.hideRefusal();
      if (refusal) logLines.push(REFUSALS.hide[refusal]);
      else if (game.hide()) stepMs = COMBAT_STEP_MS;
    } else if (id === "wheel-disengage") {
      const refusal = game.disengageRefusal();
      if (refusal) logLines.push(REFUSALS.disengage[refusal]);
      else {
        jumpMode = true;
        renderer.jumpCells = game.jumpCells();
        logLines.push("Touchez la case où sauter.");
      }
    } else {
      logLines.push(`${label} : pas encore possible.`);
    }
    renderLog();
  });
}
wheel.addEventListener("click", closeWheel);
button("actions", () => (wheelOpen ? closeWheel() : openWheel()));
// Toucher le dé : frapper au corps à corps l'ennemi au contact (demande de Thomas).
const diceBox = die.parentElement!.parentElement!;
diceBox.addEventListener("click", () => {
  if (menuOpen || bagOpen || foundOpen || shopOpen || talkOpen || wheelOpen || game.over) return;
  sfx.unlock();
  jumpMode = false;
  pushMode = false;
  renderer.jumpCells = [];
  aimMode = false;
  if (game.strike()) stepMs = COMBAT_STEP_MS;
  else {
    logLines.push("Aucun ennemi au contact.");
    renderLog();
  }
});
button("over-new-run", () => showScreen("new"));
const doorButton = (id: string, action: DoorAction) => button(id, () => game.actOnDoor(action));
doorButton("door-peek", "peek");
doorButton("door-pick", "pick");
doorButton("door-break", "break");
doorButton("door-key", "key");
button("door-cancel", () => game.cancelDoor());
button("recenter", () => renderer.recenter());
/** Tire une flèche vers une case ; explique le refus s'il y en a un. Une flèche par visée. */
function fireAt(x: number, y: number): void {
  const refusal = game.shoot(x, y);
  if (refusal) {
    const why = {
      "no-bow": "Aucun arc en main.",
      "two-hands": "Votre arme se tient à deux mains : pas de main libre pour tirer ou lancer.",
      "no-ammo": "Plus de munitions.",
      "no-target": "Impossible de tirer là.",
      "out-of-range": `Hors de portée (${game.shotProfile()?.range ?? 0} cases).`,
    }[refusal];
    logLines.push(why);
    renderLog();
  } else {
    stepMs = COMBAT_STEP_MS;
    aimMode = false; // on revient à l'arme de corps à corps
  }
}

/** La cible visée d'office quand l'arc est bandé : le monstre en vue le plus proche, s'il est à portée. */
function aimTarget(): Actor | null {
  const range = game.shotProfile()?.range ?? 0;
  let best: Actor | null = null;
  let bestDist = Infinity;
  for (const m of game.visibleMonsters()) {
    const d = Math.max(Math.abs(m.x - game.hero.x), Math.abs(m.y - game.hero.y));
    if (d <= range && d < bestDist) {
      best = m;
      bestDist = d;
    }
  }
  return best;
}

// Bouton de tir : un premier appui vise le monstre le plus proche, un second tire sur lui.
button("aim", () => {
  if (aimMode) {
    const target = aimTarget();
    if (target) fireAt(target.x, target.y);
    else aimMode = false; // personne à viser : le second appui range l'arc
  } else if (game.twoHanded()) {
    logLines.push(`Votre ${game.weapon("melee")!.name.toLowerCase()} se tient à deux mains : pas de main libre pour tirer ou lancer.`);
  } else if (game.isThreatened()) {
    logLines.push("Un ennemi est au contact : pas le temps de bander l'arc.");
  } else if (game.arrows() < 1) {
    logLines.push("Plus de flèches.");
  } else {
    aimMode = true;
    logLines.push(aimTarget() ? "Cible visée : touchez encore la flèche pour tirer, ou une autre case." : "Personne à portée : touchez une case pour tirer.");
  }
  renderLog();
});

// ---------- Objet au sol : la languette pour ramasser (un à la fois) ou lire la fiche ----------

let hereKey = "";
function renderHere(): void {
  const piles = started && !game.over ? game.itemsHere() : [];
  const top = piles[0];
  $("here").classList.toggle("open", !!top);
  if (!top) return;
  const key = `${top.item}:${top.count}:${piles.length}`;
  if (key === hereKey) return;
  hereKey = key;
  const def: ItemDef = ITEMS[top.item];
  $("here-icon").replaceChildren(itemIcon(top.item));
  $("here-name").textContent = `${def.name}${top.count > 1 ? ` ×${top.count}` : ""}${piles.length > 1 ? `  (1/${piles.length})` : ""}`;
}
button("here-take", () => {
  if (game.pickUp()) stepMs = COMBAT_STEP_MS;
});
button("here-info", () => {
  const top = game.itemsHere()[0];
  if (!top) return;
  (document.querySelector("#found h2") as HTMLElement).textContent = "Au sol";
  $("found-card").replaceChildren(itemCard(ITEMS[top.item], top.count));
  $("found").hidden = false;
  foundOpen = true;
});
$("here-take").replaceChildren(uiIcon("take"));
$("here-take").setAttribute("aria-label", "Ramasser");
$("here-info").setAttribute("aria-label", "Fiche de l'objet");

// Boutons sans texte : un pictogramme, et un nom lisible par les aides à la lecture.
for (const [id, icon, label] of [
  ["wait", "wait", "Attendre un tour"],
  ["actions", "actions", "Actions"],
  ["open-menu", "menu", "Menu"],
  ["recenter", "recenter", "Recentrer la vue"],
  ["door-cancel", "cancel", "Ne rien faire"],
] as const) {
  $(id).replaceChildren(uiIcon(icon));
  $(id).setAttribute("aria-label", label);
  $(id).title = label;
}
$("aim").setAttribute("aria-label", "Tirer à l'arc");
// Le bouton de l'écran du héros : sa tête, et un « ! » doré quand un point ou une compétence attend (demande de Thomas).
{
  const bang = el("span", "", "!");
  bang.id = "bag-bang";
  bang.hidden = true;
  $("open-bag").replaceChildren(buildIcon(HERO_HEAD, HERO_HEAD_PALETTE), bang);
  $("open-bag").setAttribute("aria-label", "Le héros : inventaire et personnage");
  $("open-bag").title = "Le héros";
}
// L'étage, en haut à droite : l'escalier du jeu et son numéro (demande de Thomas).
$("floor-icon").replaceChildren(buildIcon(DECOR.stairsDown, DECOR_PALETTE));

// ---------- Sac : grille de cases à la Diablo ----------

/**
 * Fiche d'un objet : son image, son nom, son genre, ses chiffres et une phrase de description.
 * La même fiche sert dans l'écran d'équipement et quand on trouve un objet dans le donjon.
 */
/** Boutique du Colporteur (Thomas, 2026-11-11/12) : 4 articles à acheter, ou le sac à vendre ; rien ne prend de tour. */
let shopTab: "buy" | "sell" = "buy";
let shopPick: number | null = null;
let shopNote = "";

function openShop(line: number): void {
  shopOpen = true;
  shopTab = "buy";
  shopPick = null;
  shopNote = "";
  $("shop-line").textContent = `« ${MERCHANT.lines[line] ?? MERCHANT.lines[0]} »`;
  $("shop").hidden = false;
  // Pendant la conversation, l'encart du dé et la barre du bas disparaissent (Thomas).
  document.body.classList.add("shop-open");
  renderer.resize();
  sfx.play("click");
  renderShop();
}

function closeShop(): void {
  shopOpen = false;
  $("shop").hidden = true;
  document.body.classList.remove("shop-open");
  renderer.resize();
}

function renderShop(): void {
  if (!shopOpen) return;
  const m = game.merchant();
  if (!m || !game.canTrade()) {
    closeShop();
    return;
  }
  $("shop-tab-buy").classList.toggle("on", shopTab === "buy");
  $("shop-tab-sell").classList.toggle("on", shopTab === "sell");
  $("shop-purse").textContent = `Bourse : ${game.gold} or`;
  const list = $("shop-list");
  const detail = $("shop-detail");
  list.replaceChildren();
  detail.replaceChildren();
  list.className = shopTab === "buy" ? "shop-wares" : "shop-sell";
  if (shopTab === "buy") {
    if (m.wares.length === 0) list.append(el("div", "shop-empty", "Plus rien à vendre… mais je rachète."));
    m.wares.forEach((w, i) => {
      const card = el("button", `shop-ware${shopPick === i ? " picked" : ""}${game.gold < w.price ? " dear" : ""}`) as HTMLButtonElement;
      card.type = "button";
      const icon = el("div", "shop-icon");
      icon.append(itemIcon(w.item));
      card.append(icon, namedWithRarity("shop-name", ITEMS[w.item] as ItemDef, `${ITEMS[w.item].name}${w.count > 1 ? ` ×${w.count}` : ""}`), el("div", "shop-price", `${w.price} or`));
      card.addEventListener("click", () => {
        sfx.play("click");
        shopPick = shopPick === i ? null : i;
        shopNote = "";
        renderShop();
      });
      list.append(card);
    });
    const w = shopPick !== null ? m.wares[shopPick] : undefined;
    if (w) {
      const buy = el("button", "shop-act", `Acheter (${w.price} or)`) as HTMLButtonElement;
      buy.type = "button";
      buy.disabled = game.gold < w.price;
      buy.addEventListener("click", () => {
        const r = game.buy(shopPick!);
        shopNote = r === "gold" ? "Pas assez d'or." : r === "full" ? "Votre sac est plein." : "";
        if (r === "ok") {
          sfx.play("coin");
          shopPick = null;
        }
        collectEvents();
        renderShop();
      });
      detail.append(buy, itemCard(ITEMS[w.item], w.count));
    }
  } else {
    const bag = game.inventory.items.filter((it) => game.sellPrice(it.uid) !== null);
    if (bag.length === 0) list.append(el("div", "shop-empty", "Rien qui m'intéresse dans ce sac."));
    for (const it of bag) {
      const row = el("div", "shop-row");
      const icon = el("div", "shop-icon");
      icon.append(itemIcon(it.defId));
      const sell = el("button", "shop-act", `Vendre ${game.sellPrice(it.uid)} or`) as HTMLButtonElement;
      sell.type = "button";
      sell.addEventListener("click", () => {
        if (game.sell(it.uid)) sfx.play("coin");
        collectEvents();
        renderShop();
      });
      row.append(icon, namedWithRarity("shop-name", ITEMS[it.defId] as ItemDef, `${ITEMS[it.defId].name}${it.count > 1 ? ` ×${it.count}` : ""}`), sell);
      list.append(row);
    }
  }
  if (shopNote) detail.append(el("div", "shop-note", shopNote));
}

button("shop-close", closeShop);
button("talk-close", closeTalk);

// ---------- Quête 01 : la conversation avec Gluck (Thomas, 2026-11-12) ----------

/** Ce qui vient de se dire (le résultat du dernier choix), affiché au-dessus des choix suivants. */
let talkLast: GluckResult | null = null;

/** Le départ de Gluck (et sa ligne de journal), gardé pour la fermeture de la conversation : on le voit alors partir. */
let talkLater: GameEvent[] = [];
/** Couleurs des éclats d'une potion qui se brise (fiole jaune, verte, bleue, orange). */
const POTION_SHADES: Record<string, string[]> = {
  youth: ["#ffe27a", "#f0c050", "#fff6c8"],
  poison: ["#5cc860", "#b8e05a", "#2e7a38"],
  haste: ["#6ad0ff", "#4a8fd0", "#cfeeff"],
  fire: ["#ff9a3a", "#e8782a", "#ffd84a"],
};

/** À qui l'on parle : Gluck (quête 01) ou Sœur Osseuse (quête 02). */
let talkWho: NpcId = "gluck";
/** Combien de répliques imposées du héros (« Vous : … ») le joueur a déjà touchées dans cette scène. */
let talkSaid = 0;
/** Un jet est en train de rouler : les réponses attendent que le dé tombe. */
let talkBusy = false;

function gluckPouf(e: Extract<GameEvent, { type: "npc" }>): void {
  if (e.x === undefined || e.y === undefined) return;
  renderer.addPuff(e.x, e.y);
  renderer.addFloatingText(e.x, e.y, "Pouf !", "#e8e2f4");
  sfx.play("puff");
  for (const d of e.drops ?? []) renderer.addHop(d.item, e.x, e.y, d.x, d.y);
}

function openTalk(who: NpcId): void {
  if (!game.canTalk(who)) return;
  talkWho = who;
  talkOpen = true;
  talkLast = null;
  talkSaid = 0;
  talkBusy = false;
  talkLater = [];
  $("talk").hidden = false;
  $("talk").scrollTop = 0;
  $("talk-name").textContent = who === "gluck" ? "Gluck" : "Sœur Osseuse";
  $("talk-face").replaceChildren(who === "gluck" ? buildIcon(SCHRAT.idleDown[0], GLUCK_PALETTE) : buildIcon(SOEUR_SPRITE[0], SOEUR_PALETTE));
  // Le dé et le journal restent visibles sous la conversation (Thomas) : seule la barre du bas s'efface.
  document.body.classList.add("talk-open");
  renderer.resize();
  sfx.play("click");
  renderTalk();
}

function closeTalk(): void {
  talkOpen = false;
  $("talk").hidden = true;
  document.body.classList.remove("talk-open");
  renderer.resize();
  queue.push(...talkLater);
  talkLater = [];
}

function renderTalk(): void {
  const lines = $("talk-lines");
  const choices = $("talk-choices");
  lines.replaceChildren();
  choices.replaceChildren();
  const scene = game.npcScene(talkWho);
  let shown = talkLast ? talkLast.lines : scene.lines;
  // Espaces insécables autour des guillemets et avant « ! ? : » : jamais un « » » tout seul en bout de ligne.
  const glue = (t: string) => t.replace(/« /g, "«\u00a0").replace(/ ([»!?:;])/g, "\u00a0$1");
  // Réplique imposée du héros (« Vous : … ») : elle s'affiche comme un bouton, que le joueur touche pour la dire (Thomas).
  let imposed: string | null = null;
  if (!talkLast) {
    let seen = 0;
    const cut = shown.findIndex((l) => l.startsWith("Vous : ") && seen++ === talkSaid);
    if (cut >= 0) {
      imposed = shown[cut].slice("Vous : ".length);
      shown = shown.slice(0, cut);
    }
  }
  for (const l of shown) lines.append(el("div", l.startsWith("Vous") || l.startsWith("(") ? "talk-line me" : "talk-line", glue(l)));
  // L'or seulement : le nombre de pommes ne s'affiche pas (Thomas : « ça spoile »).
  $("talk-purse").textContent = `Bourse : ${game.gold} or`;
  if (imposed !== null) {
    const b = el("button", "talk-choice", glue(imposed));
    b.addEventListener("click", () => {
      talkSaid++;
      sfx.play("click");
      renderTalk();
    });
    choices.append(b);
    return;
  }
  if (talkLast?.done || !game.npc(talkWho)) {
    const b = el("button", "talk-choice", "Continuer");
    b.addEventListener("click", closeTalk);
    choices.append(b);
    return;
  }
  for (const c of scene.choices) {
    const b = el("button", c.off ? "talk-choice off" : "talk-choice", c.label) as HTMLButtonElement;
    if (c.off) {
      // Réponse impossible : grisée, avec sa raison (Thomas : « aucune pomme »).
      b.disabled = true;
      b.append(el("span", "talk-stat", c.off));
    } else if (c.stat) b.append(el("span", "talk-stat", `Jet de ${(STAT_NAMES[c.stat] ?? c.stat).toLowerCase()}`));
    b.addEventListener("click", () => {
      if (talkBusy || c.off) return;
      talkLast = game.npcChoose(talkWho, c.id);
      talkLater.push(...game.events.filter((e) => e.type === "npc" && e.what === "leave"));
      game.events = game.events.filter((e) => !(e.type === "npc" && e.what === "leave"));
      collectEvents();
      if (!talkLast.roll) {
        sfx.play("click");
        renderTalk();
        return;
      }
      // Le dé roule dans son encart, sous la conversation ; la réponse de Gluck vient quand il est tombé.
      talkBusy = true;
      for (const x of choices.querySelectorAll("button")) (x as HTMLButtonElement).disabled = true;
      window.setTimeout(() => {
        talkBusy = false;
        if (talkOpen) renderTalk();
      }, ROLL_MS + HOLD_HERO_MS + 120);
    });
    choices.append(b);
  }
}
button("shop-tab-buy", () => {
  shopTab = "buy";
  shopNote = "";
  renderShop();
});
button("shop-tab-sell", () => {
  shopTab = "sell";
  shopPick = null;
  shopNote = "";
  renderShop();
});

/**
 * Comparaison avec ce que le héros porte (Thomas, 2026-11-12 : « que le joueur sente vraiment la différence ») :
 * ▲ vert si l'objet est meilleur, ▼ rouge s'il est moins bon, « = » sinon. Armes : dégâts moyens par tour contre
 * un monstre ordinaire (CA 13) ; armures et casques : classe d'armure ; arcs : bonus au jet et portée.
 */
function compareNode(def: ItemDef): HTMLElement | null {
  const slot = def.kind === "melee" ? "melee" : def.kind === "armor" ? "armor" : def.kind === "hat" ? "hat" : def.kind === "ranged" ? "ranged" : null;
  if (!slot) return null;
  const worn = game.equipment[slot];
  if (worn && worn.defId === def.id) return null;
  const other = worn ? (ITEMS[worn.defId] as ItemDef) : undefined;
  let delta = 0;
  let text = "";
  const fmt = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1).replace(".", ",").replace(",0", "")}`;
  if (slot === "melee") {
    const dpt = (d?: ItemDef) => (d?.damage ? expectedDamagePerTurn(d.attackBonus ?? 0, d.damage, d.speed, 13, RULES.slowAttackTurns, RULES.fastAttackTurns) : 0.6);
    delta = Math.round((dpt(def) - dpt(other)) * 10) / 10;
    text = `${fmt(delta)} dégâts par tour`;
  } else if (slot === "armor") {
    delta = (def.armorClass ?? UNARMORED_AC) - (other?.armorClass ?? UNARMORED_AC);
    text = delta === 0 ? "même CA" : `${fmt(delta)} CA (${Math.abs(delta) * 5} % de coups ${delta > 0 ? "évités" : "reçus"} en plus)`;
  } else if (slot === "hat") {
    delta = (def.acBonus ?? 0) - (other?.acBonus ?? 0);
    text = `${fmt(delta)} CA`;
  } else {
    delta = (def.attackBonus ?? 0) - (other?.attackBonus ?? 0);
    const range = (def.range ?? 0) - (other?.range ?? 0);
    text = `${fmt(delta)} au jet, ${fmt(range)} de portée`;
    if (delta === 0) delta = range;
  }
  const node = el("div", `item-compare ${delta > 0 ? "up" : delta < 0 ? "down" : "same"}`, `${delta > 0 ? "▲" : delta < 0 ? "▼" : "="} ${text}${other ? ` que ${other.name.toLowerCase()}` : ""}`);
  return node;
}

function itemCard(def: ItemDef, count = 1, note = ""): HTMLElement {
  const card = el("div", "item-card");
  const picture = el("div", "item-card-icon");
  picture.append(itemIcon(def.id as ItemId));
  const body = el("div", "item-card-body");
  body.append(namedWithRarity("item-card-name", def, `${def.name}${count > 1 ? ` ×${count}` : ""}`), el("div", "item-card-kind", `${KIND_LABELS[def.kind]}${note}`));
  const rows: [string, string][] = [];
  if (def.attackBonus !== undefined) rows.push(["Attaque", `d20 ${signedBonus(def.attackBonus)}`]);
  if (def.damage) rows.push(["Dégâts", diceLabel(def.damage)]);
  if (def.range) rows.push(["Portée", `${def.range} cases`]);
  if (def.reach && def.reach > 1) rows.push(["Allonge", `${def.reach} cases`]);
  if (def.speed) rows.push(["Vitesse", def.speed === "slow" ? "Lente" : "Rapide"]);
  if (def.twoHanded) rows.push(["Prise", "Deux mains (l'arc retourne au sac ; ni javeline, ni torche)"]);
  if (def.stunOn) rows.push(["Assomme", `sur un ${def.stunOn} ou plus au dé`]);
  if (def.stealthPenalty) rows.push(["Discrétion", `−${def.stealthPenalty} (bruyante)`]);
  if (def.poison) rows.push(["Poison", `${def.poison.damage} / tour, ${def.poison.turns} tours`]);
  if (def.heal) rows.push(["Soin", `+${def.heal} PV`]);
  if (def.lightTurns) rows.push(["Lumière", `${def.lightTurns} tours`]);
  if (def.level) rows.push(["Niveau", `${def.level}${game.tooLow(def) ? " (trop bas)" : ""}`]);
  if (def.armorClass) rows.push(["Armure", `CA ${def.armorClass}`]);
  if (def.acBonus) rows.push(["Armure", `+${def.acBonus} CA`]);
  if (def.kind !== "gold") rows.push(["Place", `${def.w} × ${def.h}`]);
  const stats = el("div", "item-card-stats");
  for (const [label, value] of rows) stats.append(el("span", "", label), el("span", "item-card-value", value));
  body.append(stats);
  const cmp = compareNode(def);
  if (cmp) body.append(cmp);
  body.append(el("div", "item-card-desc", def.description));
  card.append(picture, body);
  return card;
}

/** Fiche courte d'un objet, pour l'inventaire : image, nom, chiffres clés sur une ligne, description. */
function miniCard(def: ItemDef, count: number, note: string): HTMLElement {
  const card = el("div", "item-mini");
  card.append(itemIcon(def.id as ItemId));
  const body = el("div", "");
  const bits: string[] = [];
  if (def.attackBonus !== undefined) bits.push(`d20 ${signedBonus(def.attackBonus)}`);
  if (def.damage) bits.push(diceLabel(def.damage));
  if (def.speed) bits.push(def.speed === "slow" ? "lente" : "rapide");
  if (def.twoHanded) bits.push("deux mains");
  if (def.reach && def.reach > 1) bits.push(`allonge ${def.reach}`);
  if (def.stunOn) bits.push(`assomme sur ${def.stunOn}+`);
  if (def.stealthPenalty) bits.push(`discrétion −${def.stealthPenalty}`);
  if (def.range) bits.push(`portée ${def.range}`);
  if (def.armorClass) bits.push(`CA ${def.armorClass}`);
  if (def.acBonus) bits.push(`+${def.acBonus} CA`);
  if (def.bagCols) bits.push(`${def.bagCols} × ${def.bagRows} cases`);
  if (def.level) bits.push(`Lv${def.level}${game.tooLow(def) ? " (trop bas)" : ""}`);
  if (note) bits.push(note);
  body.append(namedWithRarity("t", def, `${def.name}${count > 1 ? ` ×${count}` : ""}`), el("div", "s", bits.join(" · ")));
  const cmp = compareNode(def);
  if (cmp) body.append(cmp);
  body.append(el("div", "", def.description));
  card.append(body);
  return card;
}

/** Prise d'une arme de corps à corps (Thomas, 2026-11-11) : une paume ou deux, dans le coin de sa case. */
function gripBadge(id: ItemId): SVGSVGElement | null {
  const def = ITEMS[id] as ItemDef;
  if (def.kind !== "melee") return null;
  const badge = buildIcon(def.twoHanded ? GRIP_ICONS.two : GRIP_ICONS.one);
  badge.classList.add("grip");
  return badge;
}

function itemNode(item: { defId: ItemId; count: number }, className: string): HTMLElement {
  const node = el("div", className);
  node.append(itemIcon(item.defId));
  const grip = gripBadge(item.defId);
  if (grip) node.append(grip);
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
        const grip = gripBadge(worn.defId);
        if (grip) box.append(grip);
      } else {
        // Emplacement vide : la silhouette estompée de ce qui s'y porte, à la place d'un nom.
        const ghost = { amulet: uiIcon("amulet"), hat: uiIcon("helm"), artifact: uiIcon("artifact"), armor: itemIcon("tunique"), melee: itemIcon("epee"), ranged: itemIcon("arc_court"), bag: itemIcon("sac_toile") }[slot];
        ghost.classList.add("ghost");
        box.append(ghost);
      }
      node.append(box);
      node.title = label;
      node.setAttribute("aria-label", label);
      node.addEventListener("click", () => {
        sfx.play("click");
        selected = worn && selectedSlot !== slot ? { slot } : null;
        renderHeroScreen();
      });
      return node;
    }),
  );

  // En haut : l'or de la bourse (les caractéristiques sont dans l'onglet Personnage).
  $("bag-gold").replaceChildren(itemIcon("or"), document.createTextNode(String(game.gold)));

  // Le carquois, à côté du sac : la flèche qui partira et combien il en reste ; le toucher passe à l'autre sorte.
  const kinds = game.ammoKinds();
  const current = game.currentAmmo();
  const quiver = el("div", "slot slot-quiver");
  const qbox = el("div", "slot-box");
  if (current) {
    qbox.append(itemIcon(current), el("span", "slot-count", String(game.inventory.count(current))));
  } else {
    const ghost = itemIcon("fleche");
    ghost.classList.add("ghost");
    qbox.append(ghost);
  }
  quiver.append(qbox);
  quiver.title = "Carquois : touchez pour changer de flèches";
  quiver.addEventListener("click", () => {
    sfx.play("click");
    const usable = kinds.filter((id) => !game.tooLow(ITEMS[id] as ItemDef));
    const locked = kinds.find((id) => game.tooLow(ITEMS[id] as ItemDef));
    if (usable.length > 1 && current) {
      game.chooseAmmo(usable[(usable.indexOf(current) + 1) % usable.length]);
      aimShown = "";
    } else if (locked) {
      logLines.push(`Il faut être niveau ${(ITEMS[locked] as ItemDef).level} pour tirer ${ITEMS[locked].name.toLowerCase()}.`);
      renderLog();
    }
    renderHeroScreen();
  });
  $("doll").append(quiver);

  // Le sac : grille de cases.
  const grid = $("bag-grid");
  grid.style.setProperty("--cols", String(bag.cols));
  grid.style.setProperty("--rows", String(bag.rows));
  grid.replaceChildren(
    ...bag.items.map((item) => {
      const def = bag.def(item);
      // Une clef d'un autre étage ne sert plus ici : elle reste dans le sac, grisée.
      const spent = ITEMS[item.defId].kind === "key" && item.floor !== game.depth;
      const node = itemNode(item, `bag-item${item.uid === selectedUid ? " selected" : ""}${spent ? " spent" : ""}`);
      if (game.tooLow(def)) node.append(el("span", "item-level", `Lv${def.level}`));
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
    $("bag-drop").hidden = true;
    return;
  }
  const def: ItemDef = ITEMS[item.defId];
  const keyNote = def.kind === "key" && item.floor !== undefined ? ` — étage ${item.floor}${item.floor !== game.depth ? ", ne sert plus ici" : ""}` : "";
  // Une fiche courte s'ouvre sous le sac (l'écran ne défile pas) ; la croix la referme (demande de Thomas).
  const card = miniCard(def, item.count, selectedSlot ? "porté" : keyNote.replace(/^ — /, ""));
  const close = el("button", "item-close", "×") as HTMLButtonElement;
  close.type = "button";
  close.setAttribute("aria-label", "Fermer la fiche");
  close.addEventListener("click", () => {
    selected = null;
    renderHeroScreen();
  });
  card.prepend(close);
  info.replaceChildren(card);
  const wearable = def.kind !== "ammo" && def.kind !== "key" && def.kind !== "gold" && def.kind !== "use" && def.kind !== "gem";
  // Le sac porté ne s'enlève pas : on le remplace par un autre.
  action.hidden = (!wearable && def.kind !== "use") || selectedSlot === "bag";
  action.textContent = selectedSlot ? "Retirer" : def.throwRange ? "Lancer" : def.kind === "use" ? "Consommer" : "Équiper";
  // Jeter : tout objet du sac (pas ce qu'on porte).
  $("bag-drop").hidden = selectedSlot !== null;
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
  renderHeroScreen();
});
button("bag-drop", () => {
  if (selected && "uid" in selected) {
    if (game.dropFromBag(selected.uid)) {
      collectEvents();
      aimShown = "";
    }
  }
  selected = null;
  renderLog();
  renderHeroScreen();
});
button("bag-equip", () => {
  const chosen = selected && "uid" in selected ? game.inventory.get(selected.uid) : undefined;
  const chosenDef = chosen ? (ITEMS[chosen.defId] as ItemDef) : undefined;
  if (chosen && chosenDef && game.tooLow(chosenDef)) {
    logLines.push(`Il faut être niveau ${chosenDef.level} pour cela.`);
  } else if (chosen && chosenDef?.throwRange) {
    // Lancer (potion de feu) : on referme le sac, puis on touche la case visée.
    throwUid = chosen.uid;
    renderer.jumpCells = throwCells(chosen.uid);
    logLines.push("Touchez la case où lancer la potion.");
    bagOpen = false;
    $("bag").hidden = true;
  } else if (chosen && chosenDef?.kind === "use") {
    // Utiliser prend un tour : on referme le sac pour le laisser passer.
    if (!game.useItem(chosen.uid)) {
      logLines.push(chosenDef.lightTurns && game.twoHanded() ? "Votre arme se tient à deux mains : pas de main libre pour la torche." : "Vous êtes déjà en pleine santé.");
    }
    bagOpen = false;
    $("bag").hidden = true;
  } else if (selected && "uid" in selected) {
    const bagSwap = chosenDef?.kind === "bag";
    const hadBow = !!game.equipment.ranged;
    if (game.equip(selected.uid)) {
      const bounced = game.events.some((e) => e.type === "bounce");
      if (chosenDef?.twoHanded && hadBow && !game.equipment.ranged && !bounced) logLines.push("Arme à deux mains : votre arc retourne dans le sac.");
    } else {
      logLines.push(
        chosenDef?.twoHanded && game.torchTurns > 0
          ? "Une arme à deux mains ? Votre torche brûle encore dans l'autre main."
          : chosenDef?.kind === "ranged" && game.twoHanded()
            ? "Votre arme se tient à deux mains : rangez-la d'abord pour prendre un arc."
            : bagSwap
            ? "Ce sac est trop petit pour tout ce que vous portez."
            : "Pas assez de place dans le sac pour échanger.",
      );
    }
  } else if (selected && "slot" in selected) {
    game.unequip(selected.slot);
  }
  collectEvents();
  selected = null;
  aimShown = "";
  renderLog();
  renderHeroScreen();
});
// ---------- Bouton du pouvoir (voie bleue ou rouge) : picto de la voie et charges restantes, grisé sinon ----------
let powerShown = "";
function powerCharges(): number {
  if (game.voie === "blue") return Math.max(0, game.secondWindUses() - game.perks().secondWind);
  if (game.voie === "red") return game.perks().doubleStrikes;
  return 0;
}
function renderPower(): void {
  const b = $("power");
  const withPower = (game.voie === "blue" || game.voie === "red") && !game.over;
  const ready = withPower && game.skillRefusal() === null;
  const key = `${withPower}|${game.voie}|${powerCharges()}|${ready}`;
  if (key === powerShown) return;
  powerShown = key;
  b.hidden = !withPower;
  if (!withPower || !game.voie) return;
  const name = game.voie === "blue" ? "Second souffle" : "Double frappe";
  b.setAttribute("aria-label", name);
  b.title = name;
  b.replaceChildren(buildIcon(PATH_ICONS[game.voie]), document.createTextNode(`×${powerCharges()}`));
  b.classList.toggle("off", !ready);
}
button("power", () => {
  const refusal = game.skillRefusal();
  if (refusal) logLines.push(REFUSALS.skill[refusal]);
  else if (game.useSkill()) stepMs = COMBAT_STEP_MS;
  renderLog();
});

button("open-bag", () => {
  bagOpen = true;
  selected = null;
  pickedChoice = null;
  // Par défaut, l'inventaire (Thomas) ; mais quand un point, la voie ou un pouvoir attend, on ouvre directement la fiche
  // du personnage (Thomas, 2026-11-12 : « quand on a un niveau à monter, on tombe dans la fiche perso »).
  heroTab = game.hasPendingChoice() && !game.over ? "char" : "inv";
  statusOpen = null;
  $("bag").hidden = false;
  renderHeroScreen();
});
button("tab-inv", () => {
  heroTab = "inv";
  pickedChoice = null;
  renderHeroScreen();
});
button("tab-char", () => {
  heroTab = "char";
  renderHeroScreen();
});
button("char-confirm", () => {
  if (pickedChoice?.kind === "path") {
    if (game.choosePath(pickedChoice.id)) logLines.push(`Voie choisie : ${PATHS[pickedChoice.id].name}.`);
  }
  pickedChoice = null;
  collectEvents();
  renderLog();
  renderHeroScreen();
});

// ---------- Statuts du héros : petits pictos en haut à gauche de la carte, détail au toucher ----------

let statusShown = "";
let statusOpen: string | null = null;

function heroStatuses(): { id: keyof typeof STATUS_ICONS; name: string; detail: string }[] {
  const list: { id: keyof typeof STATUS_ICONS; name: string; detail: string }[] = [];
  if (game.hidden) list.push({ id: "cache", name: "Caché", detail: "Les monstres ne vous remarquent qu'au contact. Votre première attaque a l'avantage." });
  if (game.hero.burning || game.isBurning(game.hero.x, game.hero.y)) list.push({ id: "feu", name: "En feu", detail: "1d4 dégâts par tour. Sortez des flammes !" });
  if (game.hero.poison) list.push({ id: "poison", name: "Empoisonné", detail: `Vous perdez ${game.hero.poison.damage} PV par tour. Encore ${game.hero.poison.turns} tours.` });
  if (game.hero.stuck) list.push({ id: "ralenti", name: "Englué", detail: "Votre prochain pas servira à vous dégager. Vous pouvez encore frapper." });
  if (game.torchTurns > 0) list.push({ id: "torche", name: "Torche allumée", detail: `Vous éclairez autour de vous, mais on vous voit venir. Encore ${game.torchTurns} tours.` });
  if (game.weaponPoison > 0) list.push({ id: "arme_poison", name: "Arme empoisonnée", detail: `Vos coups qui portent empoisonnent. Encore ${game.weaponPoison} coups.` });
  if (game.blessTurns > 0) list.push({ id: "beni", name: "Béni", detail: `La pomme dorée de l'autel : +1 à l'attaque et +1 classe d'armure. Encore ${game.blessTurns} tours.` });
  if (game.protectTurns > 0) list.push({ id: "protection", name: "Protection", detail: `La bénédiction de Sœur Osseuse : +1 classe d'armure. Encore ${game.protectTurns} tours.` });
  if (game.clarityActive()) list.push({ id: "clarte", name: "Clarté", detail: "Le poison vous ronge deux fois moins longtemps, sur cet étage." });
  if (game.curseActive()) list.push({ id: "malediction", name: "Malédiction des Kobolds", detail: "+2 dégâts contre les Kobolds, sur cet étage." });
  if (game.luck > 0) list.push({ id: "chance", name: "Chance", detail: `Vos ${game.luck > 1 ? `${game.luck} prochains 1` : "prochain 1"} au dé ${game.luck > 1 ? "seront relancés" : "sera relancé"}.` });
  if (game.hasteTurns > 0) list.push({ id: "accelere", name: "Accéléré", detail: `Chaque attaque au contact frappe deux fois. Encore ${game.hasteTurns} tours.` });
  const rampart = game.rank("dernier_rempart");
  if (rampart > 0 && game.perks().lastStand < (rampart >= MAX_RANK ? 2 : 1)) {
    list.push({ id: "rempart", name: "Dernier rempart", detail: `Prêt : un coup qui vous tuerait vous laissera à ${rampart >= 2 ? 5 : 1} PV.` });
  }
  return list;
}

// ---------- Niveau d'alerte : la cloche à côté de l'étage, couleur du palier, barre qui se remplit ----------

const ALARM_NAMES = ["calme", "agité", "alerte", "traque"];
const ALARM_DETAILS = [
  "Le temps et le bruit la font monter.",
  "Des renforts arrivent.",
  "Les renforts arrivent plus vite.",
  "L'étage sait où vous êtes.",
];
let alarmShown = "";
function renderAlarm(): void {
  const { level, stage } = game.alarm();
  const off = game.alarmOff();
  const key = `${level}|${stage}|${off}`;
  if (key === alarmShown) return;
  alarmShown = key;
  // Étage du boss : la cloche d'alerte disparaît du haut de l'écran (et le bouton « + Alerte » de la salle d'essai).
  $("alarm-badge").style.visibility = off ? "hidden" : "";
  $("alarm-up").hidden = off;
  if (off && statusOpen === "tocsin") statusOpen = null;
  $("alarm-bell").replaceChildren(buildIcon(BELL, BELL_COLORS[stage]));
  const fill = $("alarm-fill");
  fill.style.width = `${level}%`;
  fill.style.background = BELL_COLORS[stage].L;
  if (statusOpen === "tocsin") statusShown = "";
}
$("alarm-badge").addEventListener("click", (ev) => {
  ev.stopPropagation();
  statusOpen = statusOpen === "tocsin" ? null : "tocsin";
  statusShown = "";
});

function renderHeroStatus(): void {
  const list = heroStatuses();
  const key = list.map((st) => `${st.id}:${st.detail}`).join("|") + `#${statusOpen}#${statusOpen === "tocsin" ? game.alarm().level : ""}`;
  if (key === statusShown) return;
  statusShown = key;
  $("hero-status").replaceChildren(
    ...list.map((st) => {
      const b = el("button", "", "") as HTMLButtonElement;
      b.type = "button";
      b.setAttribute("aria-label", st.name);
      b.append(buildIcon(STATUS_ICONS[st.id]));
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        statusOpen = statusOpen === st.id ? null : st.id;
        statusShown = "";
      });
      return b;
    }),
  );
  const pop = $("status-pop");
  if (statusOpen === "tocsin") {
    // Le détail du niveau d'alerte s'ouvre sous la cloche, à droite.
    const { stage } = game.alarm();
    pop.hidden = false;
    pop.classList.add("right");
    pop.replaceChildren(el("b", "", "Niveau d'alerte"), document.createTextNode(`${ALARM_NAMES[stage][0].toUpperCase()}${ALARM_NAMES[stage].slice(1)} : ${ALARM_DETAILS[stage].replace(/^./, (c) => c.toLowerCase())}`));
    return;
  }
  pop.classList.remove("right");
  const open = list.find((st) => st.id === statusOpen);
  if (!open) statusOpen = null;
  pop.hidden = !open;
  if (open) {
    pop.replaceChildren(el("b", "", open.name), document.createTextNode(open.detail));
  }
}
$("status-pop").addEventListener("click", () => {
  statusOpen = null;
  statusShown = "";
});

// ---------- Écran du héros : onglets Inventaire et Personnage ----------

let heroTab: "inv" | "char" = "inv";
/** Voie ou compétence touchée, en attente de confirmation (le choix est définitif). */
let pickedChoice: { kind: "path"; id: PathId } | null = null;

function renderHeroScreen(): void {
  $("tab-inv").classList.toggle("on", heroTab === "inv");
  $("tab-char").classList.toggle("on", heroTab === "char");
  $("tab-char-bang").hidden = !game.hasPendingChoice();
  $("pane-inv").hidden = heroTab !== "inv";
  $("pane-char").hidden = heroTab !== "char";
  if (heroTab === "inv") renderBag();
  else renderCharacter();
}

function renderCharacter(): void {
  const head = buildIcon(HERO_HEAD, HERO_HEAD_PALETTE);
  const who = el("span", "char-head");
  who.append(head, document.createTextNode(`${game.heroClass.name} · Niv ${game.level}`));
  $("char-who").replaceChildren(who);
  $("char-xp").textContent = `XP ${game.xp}/${game.xpToNext()}`;
  $("char-points").textContent =
    game.points > 0 ? `${game.points} point${game.points > 1 ? "s" : ""} à attribuer${game.inCombat() ? " (pas en combat)" : ""}` : "";

  // Caractéristiques sur deux colonnes (l'écran tient sans défiler).
  const row = (name: string, value: string, stat?: StatId, wide = false) => {
    const node = el("div", `r${wide ? " wide" : ""}`);
    node.append(el("span", "", name), el("b", "", value));
    if (stat && game.points > 0) {
      const plus = el("button", "plus") as HTMLButtonElement;
      plus.type = "button";
      plus.append(plusIcon());
      plus.setAttribute("aria-label", `Un point en ${name}`);
      // En combat, les « + » sont grisés (Thomas : on n'augmente pas ses caractéristiques en plein combat).
      if (game.inCombat()) plus.style.filter = "grayscale(1) brightness(0.6)";
      plus.addEventListener("click", () => {
        sfx.play("click");
        if (!game.allocate(stat) && game.inCombat()) {
          logLines.push("Pas pendant un combat : éloignez-vous d'abord des ennemis.");
          renderLog();
        }
        renderHeroScreen();
      });
      node.append(plus);
    }
    return node;
  };
  const c = game.heroClass;
  const grid = el("div", "char-grid");
  grid.append(
    row("Vie", String(game.hero.maxHp), "vie"),
    row("Force", signedBonus(game.pushBonus()), "force"),
    row("Agilité", signedBonus(game.disengageBonus()), "agilite"),
    row("Intellig.", signedBonus(game.alloc.intelligence), "intelligence"),
    row("Charisme", signedBonus(game.alloc.charisme), "charisme"),
    row("Fouille", signedBonus(c.searchBonus)),
    row("Discrétion", signedBonus(game.stealthBonus())),
    row("Attaque", signedBonus(game.hero.attackBonus)),
    row("Classe d'armure", String(game.hero.armorClass), undefined, true),
  );
  $("char-stats").replaceChildren(grid);

  // VOIE : la choisir (niveau 2, définitif), ou la voie prise. POUVOIRS : les compétences de la voie.
  const pathCards: HTMLElement[] = [];
  const powerCards: HTMLElement[] = [];
  const confirm = $("char-confirm") as HTMLButtonElement;
  let note = "";
  if (!game.voie) {
    for (const path of Object.values(PATHS)) {
      const picked = pickedChoice?.kind === "path" && pickedChoice.id === path.id;
      const card = el("div", `skill-card${picked ? " picked" : ""}${game.canChoosePath() ? "" : " locked"}`);
      card.append(buildIcon(PATH_ICONS[path.id]), el("b", "", path.name), document.createTextNode(path.description));
      if (game.canChoosePath()) {
        card.addEventListener("click", () => {
          sfx.play("click");
          pickedChoice = { kind: "path", id: path.id };
          renderCharacter();
        });
      }
      pathCards.push(card);
    }
    note = game.canChoosePath() ? "Choix définitif" : `Voie à choisir au niveau ${PATH_LEVEL}`;
    $("char-powers-title").hidden = true;
  } else {
    // Voie prise (Thomas, 2026-11-11) : un point de voie par niveau, chaque pouvoir monte jusqu'au rang 3 (« + »).
    const path = PATHS[game.voie];
    const points = game.pathPoints();
    const powerCard = (pw: PowerDef, main: boolean): HTMLElement => {
      const r = game.rank(pw.id);
      const card = el("div", `skill-card${main ? " main" : ""}${r > 0 ? " owned" : ""}`);
      const body = el("div", "");
      const now = r > 0 ? pw.ranks[r - 1] : "";
      const next = r < MAX_RANK ? `Rang ${r + 1} : ${pw.ranks[r]}` : "Rang maximal";
      // Nom, puis une rangée : 3 billes de rang (pleines jusqu'au rang atteint) et, à droite, le petit « + ».
      const pips = el("div", "rank-pips");
      for (let k = 0; k < MAX_RANK; k++) pips.append(rankPip(k < r));
      body.append(el("b", "", pw.name), pips);
      if (now) body.append(el("div", "rank-now", now));
      body.append(el("div", "rank-next", next));
      if (main) {
        const uses = game.voie === "blue" ? ` (${powerCharges()} à cet étage)` : ` (${game.perks().doubleStrikes} à cet étage)`;
        body.append(el("div", "rank-next", `Pouvoir du bouton${uses}`));
        card.append(buildIcon(PATH_ICONS[path.id]));
      }
      card.append(body);
      if (points > 0 && r < MAX_RANK) {
        const plus = el("button", "plus rank-plus") as HTMLButtonElement;
        plus.type = "button";
        plus.setAttribute("aria-label", `Améliorer ${pw.name}`);
        plus.append(plusIcon());
        if (game.inCombat()) plus.style.filter = "grayscale(1) brightness(0.6)";
        plus.addEventListener("click", (ev) => {
          ev.stopPropagation();
          sfx.play("click");
          if (game.improve(pw.id)) logLines.push(`${pw.name} : rang ${game.rank(pw.id)}.`);
          else if (game.inCombat()) logLines.push("Pas pendant un combat : éloignez-vous d'abord des ennemis.");
          renderLog();
          renderHeroScreen();
        });
        pips.append(plus);
      }
      return card;
    };
    pathCards.push(powerCard(path.main, true));
    $("char-powers-title").hidden = false;
    path.secondaries.forEach((pw) => powerCards.push(powerCard(pw, false)));
    if (points > 0) note = `${points} point${points > 1 ? "s" : ""} de voie à placer${game.inCombat() ? " (pas en combat)" : ""}`;
  }
  $("char-path").replaceChildren(...pathCards);
  $("char-path").classList.toggle("choose", !game.voie);
  $("char-skills").replaceChildren(...powerCards);
  $("char-note").textContent = note;
  confirm.hidden = pickedChoice === null;
  confirm.textContent = "Choisir cette voie (définitif)";
}

/** Cases où l'on peut lancer une potion : en vue, à portée. */
function throwCells(uid: number): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let y = game.hero.y - 6; y <= game.hero.y + 6; y++) {
    for (let x = game.hero.x - 6; x <= game.hero.x + 6; x++) {
      if ((x !== game.hero.x || y !== game.hero.y) && game.throwRefusal(uid, x, y) === null) cells.push({ x, y });
    }
  }
  return cells;
}

button("found-close", () => {
  foundOpen = false;
  $("found").hidden = true;
});
button("bag-close", () => {
  bagOpen = false;
  $("bag").hidden = true;
});

// ---------- Menus : accueil, nouvelle partie, paramètres ----------

// ---------- Encyclopédie : deux catégories (objets, créatures), seulement ce qu'on a déjà rencontré ----------
// Les lieux (salles, décor, passages) ne sont plus dans le jeu : ils sont décrits dans `claude/LIEUX.md` du Projet.

type CodexTab = "objets" | "creatures";
let codexTab: CodexTab = "objets";

/** Une fiche d'encyclopédie sans objet : un pictogramme de couleur, un nom, un genre, une description. */
function codexCard(shape: "diamond" | "square", color: string, name: string, kind: string, description: string): HTMLElement {
  const card = el("div", "item-card");
  const picture = el("div", "item-card-icon");
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.classList.add("codex-glyph");
  const mark = document.createElementNS(ns, shape === "diamond" ? "polygon" : "rect");
  if (shape === "diamond") mark.setAttribute("points", "8,1 15,8 8,15 1,8");
  else for (const [k, v] of [["x", "3"], ["y", "3"], ["width", "10"], ["height", "10"]]) mark.setAttribute(k, v);
  mark.setAttribute("fill", color);
  svg.append(mark);
  picture.append(svg);
  const body = el("div", "item-card-body");
  body.append(el("div", "item-card-name", name), el("div", "item-card-kind", kind), el("div", "item-card-desc", description));
  card.append(picture, body);
  return card;
}

function renderCodex(): void {
  const nodes: HTMLElement[] = [];
  /** Un titre de rubrique avec son compte « rencontrés / existants », puis les fiches ou un mot d'attente. */
  const section = (title: string, total: number, cards: HTMLElement[]) => {
    nodes.push(el("h3", "", `${title} · ${cards.length} / ${total}`));
    if (cards.length === 0) nodes.push(el("div", "codex-empty", total ? "Rien de rencontré pour l'instant." : "Rien encore."));
    nodes.push(...cards);
  };
  if (codexTab === "objets") {
    const groups: [string, ItemDef["kind"][]][] = [
      ["Armes de corps à corps", ["melee"]],
      ["Armes à distance et munitions", ["ranged", "ammo"]],
      ["Armures", ["armor"]],
      ["Heaumes", ["hat"]],
      ["Amulettes", ["amulet"]],
      ["Artefacts", ["artifact"]],
      ["Sacs", ["bag"]],
      ["Potions et vivres", ["use"]],
      ["Pierres précieuses et or", ["gem", "gold"]],
      ["Divers", ["key"]],
    ];
    for (const [title, kinds] of groups) {
      const all = (Object.values(ITEMS) as ItemDef[]).filter((d) => kinds.includes(d.kind));
      const cards = all
        .filter((d) => codex.has(d.id))
        .map((def) => {
          // Qui commence la partie avec cet objet ?
          const owners = Object.values(CLASSES).filter((c) => c.startingItems.some((s) => s.item === def.id)).map((c) => c.name);
          return itemCard(def, 1, owners.length ? ` — départ : ${owners.join(", ")}` : "");
        });
      section(title, all.length, cards);
    }
  } else if (codexTab === "creatures") {
    // Une rubrique par famille de créatures.
    const all = Object.values(MONSTERS) as MonsterDef[];
    for (const family of [...new Set(all.map((m) => m.family))]) {
      const members = all.filter((m) => m.family === family);
      const cards = members.filter((m) => codex.has(`m:${m.id}`)).map((m) => codexCard("diamond", m.color, m.name, "Créature", m.description));
      section(`Famille : ${family}`, members.length, cards);
    }
  }
  $("codex-list").replaceChildren(...nodes);
  $("codex-tabs").replaceChildren(
    ...([["objets", "Objets"], ["creatures", "Créatures"]] as const).map(([tab, label]) => {
      const b = el("button", tab === codexTab ? "active" : "", label) as HTMLButtonElement;
      b.type = "button";
      b.addEventListener("click", () => {
        codexTab = tab;
        sfx.play("click");
        renderCodex();
      });
      return b;
    }),
  );
}

/** Note dans l'encyclopédie les créatures que le héros a sous les yeux. */
let codexSeenAt = -1;
function discoverSurroundings(): void {
  const stamp = game.depth * 100000 + game.turn;
  if (stamp === codexSeenAt) return;
  codexSeenAt = stamp;
  const found: string[] = game.visibleMonsters().map((m) => `m:${m.defId}`);
  discover(found);
}

type Screen = "main" | "new" | "settings" | "codex" | "records";

function showScreen(screen: Screen | null): void {
  menuOpen = screen !== null;
  menu.hidden = !menuOpen;
  for (const name of ["main", "new", "settings", "codex", "records"] as const) $(`screen-${name}`).hidden = screen !== name;
  $("detail").hidden = true;
  // « Reprendre » : la partie en cours, ou, après avoir rouvert le jeu, la dernière partie sauvegardée.
  $("menu-resume").hidden = (!started || game.over) && savedRun === null;
  $("settings-sound").textContent = `Bruitages : ${options.sound ? "oui" : "non"}`;
  $("settings-music").textContent = `Musique : ${options.music ? "oui" : "non"}`;
  $("settings-lang").textContent = `Langue : ${options.lang === "en" ? "English" : "Français"}`;
  if (screen === "new") renderCards();
  if (screen === "codex") renderCodex();
  if (screen === "records") renderRecords();
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

/** Un « + » en pixels, aux deux branches égales (Thomas : celui de la police était plus haut que large). */
/** Bille de rang (Thomas, 2026-11-11 : « 3 billes vides qui symbolisent les niveaux d'amélioration ») : pleine (or) ou
 * vide (creux sombre cerclé), dessinée en pixels 7 × 7. */
function rankPip(filled: boolean): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 7 7");
  svg.classList.add("rank-pip");
  const rows = ["..OOO..", ".OxxxO.", "OxhxxxO", "OxxxxxO", "OxxxxxO", ".OxxxO.", "..OOO.."];
  const fill: Record<string, string> = filled ? { O: "#5a3a0c", x: "#e8b83a", h: "#fff3c8" } : { O: "#8a7450", x: "#120d08", h: "#120d08" };
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === ".") return;
      const r = document.createElementNS(ns, "rect");
      r.setAttribute("x", String(x));
      r.setAttribute("y", String(y));
      r.setAttribute("width", "1");
      r.setAttribute("height", "1");
      r.setAttribute("fill", fill[c]);
      svg.append(r);
    }),
  );
  return svg;
}

/** Pastille de rareté (Thomas, 2026-11-12) : une bille de couleur à la place du mot, dessinée en pixels 7 × 7. */
function rarityPip(rarity: keyof typeof RARITY_COLORS): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 7 7");
  svg.classList.add("rarity-pip");
  const [light, dark] = RARITY_COLORS[rarity];
  const title = document.createElementNS(ns, "title");
  title.textContent = rarity in RARITY_LABELS ? RARITY_LABELS[rarity as keyof typeof RARITY_LABELS] : rarity === "epic" ? "Épique" : "Légendaire";
  svg.append(title);
  const rows = ["..OOO..", ".OxxxO.", "OxhxxxO", "OxxxxxO", "OxxxxxO", ".OxxxO.", "..OOO.."];
  const fill: Record<string, string> = { O: dark, x: light, h: "#ffffff" };
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === ".") return;
      const r = document.createElementNS(ns, "rect");
      r.setAttribute("x", String(x));
      r.setAttribute("y", String(y));
      r.setAttribute("width", "1");
      r.setAttribute("height", "1");
      r.setAttribute("fill", fill[c]);
      svg.append(r);
    }),
  );
  return svg;
}

/** Un nom d'objet précédé de sa pastille de rareté (rien pour les objets de départ, sans rareté). */
function namedWithRarity(className: string, def: ItemDef, text: string): HTMLElement {
  const node = el("div", className);
  if (def.rarity) node.append(rarityPip(def.rarity));
  node.append(document.createTextNode(text));
  return node;
}

function plusIcon(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const cross = document.createElementNS(ns, "svg");
  cross.setAttribute("viewBox", "0 0 8 8");
  cross.classList.add("plus-icon");
  for (const [x, y, w, h] of [[3, 0, 2, 8], [0, 3, 8, 2]]) {
    const bar = document.createElementNS(ns, "rect");
    bar.setAttribute("x", String(x));
    bar.setAttribute("y", String(y));
    bar.setAttribute("width", String(w));
    bar.setAttribute("height", String(h));
    bar.setAttribute("fill", "currentColor");
    cross.append(bar);
  }
  return cross;
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
      const more = el("button", "more");
      more.append(plusIcon());
      more.setAttribute("aria-label", `Détail : ${card.name}`);
      more.addEventListener("click", (e) => {
        e.stopPropagation();
        sfx.play("click");
        showDetail(card);
      });
      // Picto de la race ou de la classe (Thomas, 2026-11-12 ; planche art/pictos_race_classe_v4.png).
      const picto = PICTOS[card.id];
      if (picto) {
        const icon = buildIcon(picto.rows, picto.palette);
        icon.classList.add("card-picto");
        node.append(icon);
      }
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
button("menu-resume", () => {
  if ((!started || game.over) && savedRun) {
    resumeRun(savedRun);
    savedRun = null;
  }
  showScreen(null);
});
button("menu-new", () => showScreen("new"));
button("menu-settings", () => {
  $("settings-note").textContent = "";
  showScreen("settings");
});
button("menu-codex", () => showScreen("codex"));
button("menu-records", () => showScreen("records"));
button("records-back", () => showScreen("main"));
button("codex-back", () => showScreen("main"));
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
// Salle d'essai : un étage fixe qui rassemble les derniers éléments créés (Humain Guerrier).
// Salle d'essai seulement : réveiller tous les monstres, pour tester les combats sans attendre (demande de Thomas).
button("wake-all", () => {
  game.wakeAll();
  logLines.push("Tous les monstres se réveillent et foncent sur vous !");
  renderLog();
});
// Salle d'essai : couper ou rétablir les combats (Thomas) — les monstres ne remarquent plus le héros.
button("peace", () => {
  game.setPeaceful(!game.peaceful);
  $("peace").textContent = game.peaceful ? "Combats : non" : "Combats : oui";
  logLines.push(game.peaceful ? "Combats coupés : les monstres sont retirés." : "Combats rétablis : les monstres reviennent.");
  renderLog();
});
button("alarm-up", () => {
  game.raiseAlarm(25);
  collectEvents();
});
button("level-up", () => {
  game.levelUpNow();
  collectEvents();
});
if (!PUBLIC_BUILD) button("menu-sandbox", () => {
  newRun(true);
  started = true;
  showScreen(null);
});
button("settings-music", () => {
  options.music = !options.music;
  saveOptions();
  sfx.play("click");
  showScreen("settings");
  $("settings-note").textContent = "Pas encore de musique dans le jeu : le réglage est gardé pour plus tard.";
});
button("settings-lang", () => {
  // L'anglais n'est pas encore traduit : le choix est gardé, le jeu reste en français pour l'instant.
  options.lang = options.lang === "fr" ? "en" : "fr";
  saveOptions();
  sfx.play("click");
  showScreen("settings");
  $("settings-note").textContent = options.lang === "en" ? "English is coming soon: the game is still in French for now." : "";
});
// Salle d'essai : Gluck et Sœur Osseuse reprennent à leur première scène (Thomas, 2026-11-12).
button("reset-talks", () => {
  game.resetDialogues();
  logLines.push("Dialogues remis à zéro : Gluck et Sœur Osseuse reprennent depuis le début.");
  renderLog();
});
button("settings-sound", () => {
  options.sound = !options.sound;
  sfx.enabled = options.sound;
  saveOptions();
  sfx.play("click");
  showScreen("settings");
});

let gravelCrik = true;

// ---------- Passage d'un étage à l'autre ----------

/** La petite scène dans le noir entre deux étages (Thomas, 2026-11-12) ; `null` hors passage. */
let stairsScene: StairsScene | null = null;

function beginStairs(forceFall?: boolean): void {
  const direction = game.pendingStairs;
  if (!direction || game.over || stairsScene) return;
  const target = game.depth + (direction === "down" ? 1 : -1);
  if (target < 1) return;
  // Une fois sur huit environ, en descendant, il se prend les pieds dans une marche (décor seulement).
  stairsScene = new StairsScene(direction, direction === "down" && (forceFall ?? Math.random() < 1 / 8), `ÉTAGE ${target}`);
}

function advanceStairs(dt: number): void {
  const scene = stairsScene;
  if (!scene) return;
  scene.update(dt);
  for (const sound of scene.sounds) sfx.play(sound);
  scene.sounds = [];
  if (!scene.done) return;
  stairsScene = null;
  if (game.takeStairs()) {
    renderer.snapTo(game);
    collectEvents();
    if (scene.tumbled) {
      logLines.push("Vous dégringolez l'escalier… et vous relevez, un peu sonné, mais entier.");
      renderLog();
    }
  }
}

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
      if (game.pendingStairs) beginStairs();
    }
  }
  // Le tour suivant ne commence que lorsque tout ce qui s'est passé a été montré.
  advanceStairs(dt);
  if (!stairsScene && !stepping && !cue && queue.length === 0 && !menuOpen && !bagOpen && !foundOpen && !shopOpen && !talkOpen && !wheelOpen) {
    shownHp = game.hero.hp;
    if (game.visibleMonsters().length > 0) stepMs = Math.max(stepMs, COMBAT_STEP_MS);
    const before = { x: game.hero.x, y: game.hero.y };
    if (game.tick()) {
      stepping = true;
      if (game.hero.x !== before.x || game.hero.y !== before.y) sfx.play("step");
      collectEvents();
      // Sauvegarde automatique après chaque tour (mort définitive : la sauvegarde s'efface à la mort).
      if (game.over) eraseSave(game.sandbox);
      else writeSave();
    } else {
      stepTime = 0;
    }
  }

  // Seules les cheminées crépitent (les torches sont muettes) : plus fort à mesure qu'on s'en approche.
  if (!menuOpen) {
    let fire = 0;
    for (const t of game.torches) {
      if (!t.hearth || t.lit === false || !game.isVisible(t.x + t.faceX, t.y + t.faceY)) continue;
      const d = Math.hypot(t.x - game.hero.x, t.y - game.hero.y);
      fire = Math.max(fire, 1 - d / 8);
    }
    sfx.fireplace(fire, dt);
  }
  // Les cases de saut ne s'affichent que pendant le choix.
  if ((!jumpMode || game.disengageRefusal() !== null) && !pushMode && throwUid === null) {
    jumpMode = false;
    renderer.jumpCells = [];
  }
  // Le dé s'entoure d'or quand un ennemi est au contact : le toucher le frappe.
  diceBox.classList.toggle("ready", !game.over && game.meleeTarget() !== null);
  if (!cue && queue.length === 0 && die.textContent === "") {
    const hint = game.meleeTarget() && !game.over ? "Frapper" : "";
    if (dieWho.textContent !== hint && (hint || dieWho.textContent === "Frapper")) dieWho.textContent = hint;
  }
  if (started) discoverSurroundings();
  const aimRange = aimMode && game.arrows() > 0 ? (game.shotProfile()?.range ?? null) : null;
  if (stairsScene) stairsScene.draw(canvas);
  else renderer.draw(game, stepping ? Math.min(stepTime / stepMs, 1) : 1, dt, ghosts, aimRange, aimRange !== null ? aimTarget() : null);
  $("bag-bang").hidden = !game.hasPendingChoice() || game.over;
  $("open-bag").classList.toggle("pending", game.hasPendingChoice() && !game.over);
  renderAlarm();
  renderHeroStatus();
  const floorText = String(game.depth);
  if ($("floor-num").textContent !== floorText) $("floor-num").textContent = floorText;
  hpFill.style.width = `${(100 * shownHp) / game.hero.maxHp}%`;
  hpOrbs();
  renderHere();
  $("hp-label").textContent = `PV ${shownHp}/${game.hero.maxHp}`;
  const xpShown = shownXp();
  $("xp-fill").style.width = `${(100 * xpShown.xp) / xpShown.need}%`;
  $("xp-label").textContent = `Niv ${xpShown.level} · XP ${xpShown.xp}/${xpShown.need}`;
  // Seules les méthodes encore possibles sur cette porte sont proposées.
  const doorOptions = game.doorOptions();
  // Avec la clef de l'étage, rien à choisir : elle sert toute seule.
  doorActions.hidden = doorOptions.length === 0 || game.over || cue !== null || game.usingKey();
  $("door-key").hidden = !doorOptions.includes("key");
  $("door-peek").hidden = !doorOptions.includes("peek");
  $("door-pick").hidden = !doorOptions.includes("pick");
  // Devant un sarcophage à pointes, les deux mêmes boutons : désamorcer (agilité) ou forcer (force).
  const maiden = game.pendingDoor !== null && game.maidenAt(game.pendingDoor.x, game.pendingDoor.y) !== null;
  const pickText = maiden ? "Désamorcer" : "Crocheter";
  const breakText = maiden ? "Forcer" : "Enfoncer";
  if ($("door-pick").textContent !== pickText) $("door-pick").textContent = pickText;
  if ($("door-break").textContent !== breakText) $("door-break").textContent = breakText;
  $("door-break").hidden = !doorOptions.includes("break");
  // En arrivant devant une porte verrouillée, le héros bute dessus.
  if (game.pendingDoor && !doorWasPending && !game.usingKey()) {
    renderer.addSlash(game.hero.id, game.hero.x, game.hero.y, game.pendingDoor.x, game.pendingDoor.y, "", false);
    sfx.play("knock");
  }
  doorWasPending = game.pendingDoor !== null;
  $("recenter").hidden = !renderer.isPanned();
  const bow = game.weapon("ranged");
  const aim = $("aim");
  // Le bouton de tir sert aussi à lancer une javeline, même sans arc.
  const canShoot = !!bow || game.shotProfile() !== null;
  aim.hidden = !canShoot;
  if (!canShoot) aimMode = false;
  // Dès qu'un ennemi arrive au contact, on repasse à l'arme de corps à corps.
  if (aimMode && game.isThreatened()) {
    aimMode = false;
    logLines.push("Ennemi au contact : vous reprenez votre arme de corps à corps.");
    renderLog();
  }
  // Le bouton : le pictogramme de l'arc et le nombre de flèches. Il s'allume quand l'arc est bandé.
  // Le dessin suit la munition choisie (flèche ordinaire ou empoisonnée, demande de Thomas).
  const ammo = game.currentAmmo();
  const aimKey = `${bow?.id}|${ammo}|${game.arrows()}`;
  if (aimKey !== aimShown) {
    aimShown = aimKey;
    aim.replaceChildren(ammo && ammo !== "fleche" ? itemIcon(ammo) : uiIcon("arrow"), document.createTextNode(`×${game.arrows()}`));
  }
  aim.classList.toggle("active", aimMode);
  renderPower();
  requestAnimationFrame(frame);
}

// Au lancement : une partie toute prête derrière le menu (non sauvegardée tant qu'on ne l'a pas lancée),
// et la dernière partie sauvegardée, proposée par « Reprendre ».
savedRun = readSave();
setupRun(new Game(Math.floor(Math.random() * 0xffffffff), chosenRace, chosenClass), null);
showScreen("main");
requestAnimationFrame(frame);

// Accès de débogage pour les tests automatiques dans un navigateur (sans effet sur le jeu).
(window as unknown as { leutenheim: unknown }).leutenheim = {
  game: () => game,
  renderer: () => renderer,
  /** Pour les captures : lance le passage d'escalier (le héros doit être sur un escalier). */
  stairs: (fall: boolean) => beginStairs(fall),
  /** Pour les captures : montre les événements en attente (comme après un toucher). */
  flush: () => collectEvents(),
};
