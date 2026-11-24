import { CHAMPI_TUNE } from "./render/champiTune";
import { medalLine, onEvents, playUnlock, renderWall, splitMedal, type Unlock } from "./ui/achievements";
import { medal } from "./ui/medals";
import { portrait } from "./ui/portraits";
import { setSandboxSection } from "./world/sandbox";
import { addRecord, loadRecords } from "./ui/records";
import { FERMIER } from "./render/sprites/ferme";
import { ESCALIERS, ESCALIERS_PALETTE, STAIRS_STYLE } from "./render/sprites/escaliers";
import { Sfx } from "./audio/sfx";
import { Music } from "./audio/music";
import { diceLabel } from "./core/dice";
import { expectedDamagePerTurn, type AttackResult } from "./core/combat";
import { DoorAction, Game, GameEvent, GluckResult, NpcId } from "./core/game";
import { SOEUR_PALETTE, SOEUR_SPRITE } from "./render/sprites/soeur";
import { CLASSES, ClassDef } from "./data/classes";
import { INTRO_LINES, introLines, SECTION_LINES } from "./data/intro";
import { ITEMS, ItemDef, ItemId, KIND_LABELS, RARITY_COLORS, RARITY_LABELS, Slot, SLOTS, UNARMORED_AC } from "./data/items";
import { MONSTERS, MonsterDef } from "./data/monsters";
import { RACES, RaceDef } from "./data/races";
import { RULES } from "./data/rules";
import { MERCHANT } from "./data/merchant";
import { Actor } from "./entities/actor";
import { bindInput } from "./input/pointer";
import { GLUCK_PALETTE, KRIK_PALETTE, FIFRELIN_PALETTE, MAESTRO_PALETTE, MORILLON_FRAMES, MORILLON_PALETTE, Renderer } from "./render/renderer";
import { EXPO } from "./render/sprites/expo";
import { CHAPELLE } from "./render/sprites/chapelle";
import { MOBS_OSS } from "./render/sprites/mobsOss";
import { SECRET } from "./render/sprites/secret";
import { SCHRAT } from "./render/sprites/schrat";
import { STAT_NAMES } from "./data/gluck";
import { StairsScene, StairsVariant } from "./render/stairsScene";
import { heroLook, heroSprites } from "./render/heroLook";
import { RACE_PICTOS } from "./ui/racePictos";
import { TIPS } from "./data/tips";
import { MANUAL } from "./data/manual";
import { NPC_IDS } from "./core/game";
import { CODEX_ITEM_GROUPS, CODEX_PEOPLE, CODEX_STATES, CODEX_TRAPS } from "./data/codex";
import { TRAPS } from "./data/traps";
import { getLang, missing as i18nMissing, setLang, tr } from "./i18n/i18n";
import { TELEMETRY } from "./data/telemetry";
import { detectPlatform, Telemetry } from "./telemetry/telemetry";
import { PICTOS } from "./ui/pictos";
import { BELL, BELL_COLORS, buildIcon, HERO_HEAD, HERO_HEAD_PALETTE, itemIcon, PATH_ICONS, SKILL_ICONS, type SkillIconId, STATUS_ICONS, uiIcon } from "./ui/icons";
import { PATH_LEVEL, PATHS, PathId, PowerDef, StatId, TIER2_LEVEL, TIER3_LEVEL } from "./data/skills";
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
/** N'écrit dans la page que si ça change (audit du 2026-11-13) : réécrire la même chose à chaque image forçait le
 *  navigateur à tout recalculer, 60 fois par seconde. */
function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}
function setHidden(node: HTMLElement, hidden: boolean): void {
  if (node.hidden !== hidden) node.hidden = hidden;
}
function setWidth(node: HTMLElement, width: string): void {
  if (node.style.width !== width) node.style.width = width;
}
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
const diceLog = $("dice-log");
/** Frise des jets : le tour du dernier jet (un trait sépare les tours). */
let rollTurn = -1;
/** Jets gardés dans la frise (on peut la faire défiler pour les relire). */
const ROLL_KEEP = 60;
/** Tours sans jet avant que la frise s'éteigne, son historique avec (Thomas : « quelques pas »). */
const ROLL_QUIET_TURNS = 4;
/** Vrai quand le joueur a fait défiler la frise vers les anciens jets : elle reste alors ouverte. */
let rollUnrolled = false;
/** Au plus 4 dés de dégâts montrés par jet ; au-delà, un dernier « +N » fait la somme. */
const ROLL_DICE = 4;
const log = $("log");
const over = $("over");
const seedLabel = $("seed");
const doorActions = $("door-actions");
const menu = $("menu");

// ---------- Options (mémorisées sur l'appareil quand c'est possible) ----------

/** Réglages (Thomas, 2026-11-12) : bruitages et musique séparés ; langue (français ou anglais). */
const options = { sound: true, music: true, blood: true, lang: "fr" as "fr" | "en", soundLevel: 4, musicLevel: 4, soundOn: true, musicOn: true };
try {
  const saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? "{}") as Partial<typeof options>;
  Object.assign(options, saved);
  // Avant le mélangeur (Thomas, 2026-11-16) : « oui / non » ; « non » devient le niveau 0.
  if (saved.soundLevel === undefined) options.soundLevel = options.sound ? 4 : 0;
  if (saved.musicLevel === undefined) options.musicLevel = options.music ? 4 : 0;
} catch {
  /* pas de stockage : on garde les réglages par défaut */
}
/** Mélangeur à 5 niveaux (0 : coupé) ; le niveau 4 est le volume d'origine. */
const VOLUME_STEPS = [0, 0.25, 0.5, 0.75, 1, 1.4];
function saveOptions(): void {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  } catch {
    /* sans gravité */
  }
}

setLang(options.lang);
/** Textes écrits dans la page (boutons, titres) : traduits une fois au lancement ; l'original français est gardé. */
const frOriginal = new WeakMap<Node, string>();
const frAttr = new WeakMap<Element, Record<string, string>>();
function translatePage(root: Node = document.body): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n: Node | null = walker.currentNode; n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const tag = n.parentElement?.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || !n.textContent?.trim()) continue;
      const fr = frOriginal.get(n) ?? n.textContent ?? "";
      if (!frOriginal.has(n)) frOriginal.set(n, fr);
      n.textContent = tr(fr);
    } else if (n instanceof Element) {
      const saved = frAttr.get(n) ?? {};
      for (const a of ["aria-label", "title"]) {
        const v = saved[a] ?? n.getAttribute(a);
        if (v === null) continue;
        saved[a] = v;
        n.setAttribute(a, tr(v));
      }
      frAttr.set(n, saved);
    }
  }
  document.title = tr("Cave Roller — démo");
}
translatePage();

const sfx = new Sfx();
// Musique « Crypte », en direct : elle suit le niveau d'alerte de l'étage (Thomas, 2026-11-12).
const music = new Music(() => sfx.context());
function applyAudio(): void {
  options.sound = options.soundOn && options.soundLevel > 0;
  options.music = options.musicOn && options.musicLevel > 0;
  sfx.enabled = options.sound;
  sfx.setVolume(VOLUME_STEPS[options.soundLevel]);
  music.enabled = options.music;
  music.setVolume(VOLUME_STEPS[options.musicLevel]);
}
applyAudio();
const renderer = new Renderer(canvas);
renderer.setBlood(options.blood);

// ---------- État de l'affichage ----------

let game: Game;
let logLines: string[] = [];
let menuOpen = true;
let bagOpen = false;
/** Une torche allumée dans le sac : sa lumière s'étend quand le sac se referme. */
let flarePending = false;
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
/** Pinceau magique : on choisit la case du faux mur. */
let paintMode = false;
/** Une fiole lancée touche le sol au bout de ce temps (les ¾ de son vol). */
const THROW_LAND_MS = 420;
/** Message d'un appui long dans le sac (raccourci choisi ou retiré), montré une fois sur la fiche. */
let quickNote = "";
/** Durée d'un appui long dans le sac. */
const LONG_PRESS_MS = 450;
/** Pousser, avec plusieurs ennemis au contact : on attend que le joueur touche celui à pousser. */
let pushMode = false;
/** Le héros à terre : combien de temps on l'a vu couché avant que son tour perdu ne passe. */
let proneShown = 0;
const PRONE_HOLD_MS = 900;
const STUCK_HOLD_MS = 600;
/** Désamorcer : on touche le piège voisin choisi (plusieurs pièges autour). */
let disarmMode = false;
/** Genres d'objets déjà rencontrés dans cette partie : leur fiche ne s'affiche qu'à la première trouvaille. */
let seenItems = new Set<ItemId>();

// Encyclopédie : les objets déjà rencontrés, toutes parties confondues (mémorisés sur l'appareil).
// Clé changée le 2026-11-14 : l'ancienne liste était remplie par la salle d'essai, qui ne compte plus.
const CODEX_KEY = "leutenheim.codex2";
const codex = new Set<string>();
try {
  for (const id of JSON.parse(localStorage.getItem(CODEX_KEY) ?? "[]")) if (typeof id === "string") codex.add(id);
} catch {
  // Pas de mémoire disponible : l'encyclopédie repartira de zéro à chaque visite.
}
function discover(ids: Iterable<string>): void {
  // La salle d'essai montre tout : elle ne remplit pas l'encyclopédie (la partie d'essai non plus).
  if (game.sandbox || game.testRun) return;
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
/** Les petits de la Tisseuse qui s'enfuient après sa mort, et la durée d'un de leurs pas. */
let broodFlight: { id: number; path: { x: number; y: number }[] }[] = [];
const BROOD_STEP_MS = 240;
let stepping = false;
/** Depuis combien de temps la boucle attend un événement ou un pas (filet de sécurité contre un héros « figé »). */
let stuckMs = 0;
let stepTime = 0;
/** Après un lancer : les monstres attendent que l'objet soit tombé avant de bouger (ms dans le tour). */
let throwLag = 0;

// ---------- Sauvegarde (sur l'appareil) ----------

/** Deux emplacements : la partie de donjon et la salle d'essai ; « last » dit laquelle reprendre. */
/** Version publique (GitHub Pages) : pas de salle d'essai (Thomas, 2026-11-12). Fixé à la construction. */
declare const __PUBLIC__: boolean;
declare const __VERSION__: string;
const PUBLIC_BUILD = typeof __PUBLIC__ !== "undefined" && __PUBLIC__;

// Statistiques anonymes (Thomas, 2026-11-15) : navigateur et future appli (Capacitor) ; rien sans son accord.
const stats = new Telemetry({
  version: typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev",
  platform: detectPlatform(),
  build: PUBLIC_BUILD ? "public" : "demo",
  lang: getLang(),
});
stats.start();
// Première fois (et seulement si l'adresse d'envoi est réglée) : on demande.
if (TELEMETRY.url && stats.consent() === "unset") $("stats-ask").hidden = false;

/** Ce que le jeu vient de vivre, traduit en événements de statistiques (quelques-uns seulement, sans détail). */
function trackEvents(events: readonly GameEvent[]): void {
  if (!stats.enabled()) return;
  const base = { depth: game.depth, level: game.level, turn: game.turn, test: game.sandbox || game.testRun };
  for (const e of events) {
    if (e.type === "stairs" && e.direction === "down") stats.track("floor", { ...base, hp: game.hero.hp, maxHp: game.hero.maxHp, gold: game.gold, unhurt: !!e.unhurt });
    else if (e.type === "death" && e.actor.kind === "hero") stats.track("death", { ...base, cause: game.deathCause ?? "", gold: game.gold, deepest: game.deepest });
    else if (e.type === "boss" && e.what === "dead") stats.track("boss_kill", { ...base, hp: game.hero.hp, maxHp: game.hero.maxHp });
    else if (e.type === "quest") stats.track("quest", { ...base, id: e.id, what: e.what });
    else if (e.type === "levelup") stats.track("level_up", { ...base, level: e.level });
    else if (e.type === "sectionIntro") stats.track("section", { ...base, section: e.section });
    else if (e.type === "demoEnd") stats.track("demo_end", { ...base, deepest: game.deepest, bosses: game.bossKills });
  }
}
if (PUBLIC_BUILD) $("menu-sandbox").remove();

const SAVE_KEYS = { donjon: "leutenheim.save", essai: "leutenheim.save.essai", last: "leutenheim.save.last" };
/**
 * PLUSIEURS PARTIES (Thomas, 2026-11-14 : « on ne devrait pas garder qu'une seule sauvegarde ») : trois emplacements pour
 * le donjon (le premier garde l'ancienne clef), plus la salle d'essai. Une nouvelle partie prend le premier emplacement
 * libre, sinon le plus ancien.
 */
const DUNGEON_SLOTS = [SAVE_KEYS.donjon, "leutenheim.save.2", "leutenheim.save.3"];
let lastSaveAt = 0;
/** L'emplacement de la partie en cours. */
let currentSlot = SAVE_KEYS.donjon;

function savedAtOf(key: string): number {
  try {
    const text = localStorage.getItem(key);
    if (!text) return -1;
    const at = Date.parse((JSON.parse(text) as { savedAt?: string }).savedAt ?? "");
    return isNaN(at) ? 0 : at;
  } catch {
    return 0;
  }
}

/** L'emplacement d'une nouvelle partie : la salle d'essai a le sien ; le donjon, le premier libre ou le plus ancien. */
function freshSlot(sandbox: boolean): string {
  if (sandbox) return SAVE_KEYS.essai;
  const free = DUNGEON_SLOTS.find((k) => savedAtOf(k) < 0);
  if (free) return free;
  return [...DUNGEON_SLOTS].sort((a, b) => savedAtOf(a) - savedAtOf(b))[0];
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
    localStorage.setItem(currentSlot, JSON.stringify(data));
    localStorage.setItem(SAVE_KEYS.last, currentSlot);
  } catch {
    /* stockage plein ou interdit : on joue sans sauvegarde */
  }
}

function eraseSave(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* sans gravité */
  }
}

/** La dernière partie sauvegardée, relue ; `null` s'il n'y en a pas (ou si elle est illisible). */
function readSave(): Game | null {
  try {
    const last = localStorage.getItem(SAVE_KEYS.last);
    let key = last === "essai" ? SAVE_KEYS.essai : last === "donjon" || !last ? SAVE_KEYS.donjon : last;
    if (PUBLIC_BUILD && key === SAVE_KEYS.essai) key = SAVE_KEYS.donjon;
    // Plus rien à cet emplacement (partie finie) : la plus récente des autres sauvegardes (Thomas, 2026-11-15 :
    // « Reprendre doit toujours reprendre la dernière partie »).
    if (!localStorage.getItem(key)) {
      const slots = PUBLIC_BUILD ? DUNGEON_SLOTS : [...DUNGEON_SLOTS, SAVE_KEYS.essai];
      key = [...slots].sort((a, b) => savedAtOf(b) - savedAtOf(a))[0];
    }
    const text = localStorage.getItem(key);
    const saved = text ? Game.restore(JSON.parse(text)) : null;
    if (saved) savedSlot = key;
    return saved;
  } catch {
    return null;
  }
}

// Le téléphone peut fermer l'application à tout moment : on sauvegarde dès qu'elle passe en arrière-plan.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    writeSave(true);
    void stats.flush();
  }
});
window.addEventListener("pagehide", () => writeSave(true));

/** L'emplacement de la partie relue au lancement (reprise par « Reprendre »). */
let savedSlot = SAVE_KEYS.donjon;

function newRun(sandbox = false, testRun = false): void {
  currentSlot = freshSlot(sandbox || testRun);
  stats.newRun();
  // Seul endroit où le hasard « réel » intervient : le choix de la graine de la partie.
  const next = new Game(Math.floor(Math.random() * 0xffffffff), chosenRace, chosenClass, undefined, sandbox);
  // SECTION : ALL (Thomas, 2026-11-14) : une vraie partie, avec les outils d'essai et le téléporteur d'étage.
  next.testRun = testRun;
  setupRun(next, testRun ? ["Partie d'essai : toutes les sections. Les boutons « Étage − / + » téléportent d'un étage."] : null);
  started = true;
  stats.track("run_start", { race: next.race.id, cls: next.heroClass.id, test: sandbox || testRun, sandbox });
  savedRun = null;
  writeSave(true);
}

/** Reprend la partie sauvegardée. */
function resumeRun(saved: Game): void {
  setupRun(saved, [`Partie reprise : étage ${saved.depth}, tour ${saved.turn}.`]);
  started = true;
}

const CARILLON_MODES = ["douce", "onde", "dure"] as const;
const CARILLON_LABELS = { douce: "Carillon : doux", onde: "Carillon : onde seule", dure: "Carillon : dur" } as const;
function applyCarillonMode(): void {
  let mode: (typeof CARILLON_MODES)[number] = "douce";
  try {
    const saved = localStorage.getItem("leutenheim.carillonMode");
    if (saved === "onde" || saved === "dure") mode = saved;
  } catch {
    /* sans stockage : doux */
  }
  game.carillonMode = game.sandbox || game.testRun ? mode : "douce";
  $("carillon-mode").textContent = tr(CARILLON_LABELS[game.carillonMode]);
}

function setupRun(next: Game, lines: string[] | null): void {
  game = next;
  applyCarillonMode();
  const sandbox = game.sandbox;
  // Outils d'essai : en salle d'essai, et dans la partie d'essai « toutes les sections » (avec le téléporteur).
  $("test-tools").hidden = !sandbox && !game.testRun;
  $("test-tools").classList.toggle("folded", localStorage.getItem("leutenheim.cheat") !== "open");
  $("reset-talks").hidden = !sandbox;
  $("reset-floor").hidden = !sandbox;
  $("tp-up").hidden = !game.testRun;
  $("tp-down").hidden = !game.testRun;
  $("peace").textContent = tr("Combats : oui");
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
  capNoted = false;
  alarmBefore = null;
  logLines = lines ?? (sandbox
    ? [
        "Salle d'essai : les dernières nouveautés, toujours au même endroit.",
        "Le HUB : une sortie par type de salle (écriteaux au mur). Y revenir remet tout l'étage à neuf.",
      ]
    : [`Vous incarnez un ${game.hero.name}. Touchez un monstre pour l'attaquer.`]);
  renderLog();
  clearDie();
  clearRollLog();
  over.hidden = true;
  seedLabel.textContent = tr(`Graine ${game.runSeed}`);
  renderer.snapTo(game);
}

/** Le dé redevient vide : il ne montre un nombre que pendant et juste après un jet. */
function clearDie(): void {
  die.textContent = tr("");
  die.className = "die";
  die2.hidden = true;
  die.parentElement?.classList.toggle("pair", !die2.hidden);
  dieWho.textContent = tr("");
}

/** Un jet dans l'historique : le d20 (vert touché, gris raté, or critique), les dés de dégâts, puis le total. */
function rollChip(r: AttackResult, foe: boolean): HTMLElement {
  const chip = document.createElement("span");
  chip.className = "rc";
  const d = document.createElement("span");
  d.className = `mini ${r.critical ? "crit" : r.hit ? "hit" : "miss"}`;
  d.textContent = String(r.d20);
  chip.append(d);
  const faces = r.hit ? r.damageRoll?.faces ?? [] : [];
  const shown = faces.length > ROLL_DICE ? [...faces.slice(0, ROLL_DICE - 1).map(String), `+${faces.slice(ROLL_DICE - 1).reduce((a, b) => a + b, 0)}`] : faces.map(String);
  shown.forEach((v, i) => {
    const s = document.createElement("span");
    const more = faces.length > ROLL_DICE && i === shown.length - 1;
    s.className = `sd d${r.damageRoll?.dice.sides ?? 6}${foe ? " foe" : ""}${more ? " more" : ""}`;
    s.textContent = v;
    chip.append(s);
  });
  const t = document.createElement("span");
  t.className = `rt${r.hit ? (foe ? " foe" : "") : " miss"}`;
  t.textContent = r.hit ? `-${r.damage}` : tr("raté");
  chip.append(t);
  return chip;
}

/** Ajoute un jet d'attaque au bout de la frise : le premier à gauche, les suivants à sa droite (Thomas, 2026-11-13,
 *  après essai du sens inverse) ; un chevron « › » sépare deux tours ; les anciens pâlissent ; la frise défile pour
 *  montrer le dernier, sauf si on la déroule. */
function logRoll(e: Extract<GameEvent, { type: "attack" }>): void {
  const foe = e.attacker.kind === "monster";
  if (rollTurn !== -1 && rollTurn !== game.turn) {
    const sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = "›";
    diceLog.append(sep);
  }
  rollTurn = game.turn;
  const chip = rollChip(e.result, foe);
  if (foe) chip.classList.add("foe");
  diceLog.append(chip);
  while (diceLog.children.length > ROLL_KEEP || diceLog.firstElementChild?.classList.contains("sep")) diceLog.firstElementChild!.remove();
  const chips = [...diceLog.children] as HTMLElement[];
  chips.forEach((c, i) => (c.style.opacity = String(Math.max(0.15, 1 - (chips.length - 1 - i) * 0.11))));
  diceLog.classList.remove("fade");
  syncFrieze();
  if (!rollUnrolled) diceLog.scrollLeft = diceLog.scrollWidth;
}

/** Signale au reste de l'écran que la frise est allumée (la languette et les barres montent au-dessus). */
function syncFrieze(): void {
  document.body.classList.toggle("frieze-on", diceLog.childElementCount > 0 && !diceLog.classList.contains("fade"));
}

/** La frise s'éteint au bout de quelques tours sans jet, et oublie ses jets ; pas tant qu'on la déroule. */
function quietRollLog(): void {
  if (!diceLog.childElementCount || rollUnrolled) return;
  if (game.turn - rollTurn >= ROLL_QUIET_TURNS) {
    if (!diceLog.classList.contains("fade")) {
      diceLog.classList.add("fade");
      syncFrieze();
    } else if (game.turn - rollTurn >= ROLL_QUIET_TURNS + 1) clearRollLog();
  }
}

// Dérouler la frise du doigt : on relit les anciens jets, nets. Seul un vrai glissement compte ; on lâche, et après
// quelques secondes elle revient d'elle-même au dernier jet. Un simple toucher passe à la carte en dessous.
let rollDown: { x: number; y: number; id: number } | null = null;
let rollBack: ReturnType<typeof setTimeout> | undefined;
diceLog.addEventListener("pointerdown", (e) => {
  rollDown = { x: e.clientX, y: e.clientY, id: e.pointerId };
  clearTimeout(rollBack);
});
diceLog.addEventListener("pointerup", (e) => {
  const down = rollDown;
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10) {
    // Un toucher, pas un glissement : on le rend à la carte.
    const init = { clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, isPrimary: true, bubbles: true };
    canvas.dispatchEvent(new PointerEvent("pointerdown", init));
    canvas.dispatchEvent(new PointerEvent("pointerup", init));
  }
  rollRelease();
});
/** Le doigt quitte la frise (même quand le navigateur a pris la main pour la faire défiler) : retour au dernier jet
 *  4 secondes plus tard. */
function rollRelease(): void {
  // Le défilement qui suit le lâcher (l'élan) compte encore comme voulu pendant un court instant.
  setTimeout(() => (rollDown = null), 600);
  clearTimeout(rollBack);
  rollBack = setTimeout(() => {
    rollUnrolled = false;
    diceLog.classList.remove("open");
    diceLog.scrollLeft = diceLog.scrollWidth;
  }, 4000);
}
diceLog.addEventListener("touchend", rollRelease);
diceLog.addEventListener("scroll", () => {
  // Le défilement voulu par le joueur seulement (pas celui qui suit le dernier jet).
  if (!rollDown) return;
  rollUnrolled = diceLog.scrollLeft + diceLog.clientWidth < diceLog.scrollWidth - 4;
  diceLog.classList.toggle("open", rollUnrolled);
});

/** La frise se vide (nouvelle partie, escalier). */
function clearRollLog(): void {
  rollTurn = -1;
  rollUnrolled = false;
  diceLog.replaceChildren();
  diceLog.classList.remove("fade");
  syncFrieze();
}


function renderLog(): void {
  logLines = logLines.slice(-LOG_LINES);
  log.replaceChildren(
    ...logLines.map((line) => {
      const p = document.createElement("div");
      // Une ligne de succès : le mini médaillon devant (son texte est déjà traduit).
      const m = splitMedal(line);
      if (m) {
        p.className = "log-medal";
        const icon = medal(m.id, m.tier, 1);
        p.append(icon, document.createTextNode(m.text));
        return p;
      }
      p.textContent = capFirst(tr(line));
      return p;
    }),
  );
}

// ---------- Mise en scène des événements ----------

const isRoll = (e: GameEvent): e is Extract<GameEvent, { type: "attack" | "door" | "hide" | "jump" | "searched" | "push" | "maiden" | "npcRoll" | "statue" | "disarm" }> =>
  e.type === "attack" ||
  e.type === "disarm" ||
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
  if (e.ricochet) {
    // Le ricochet part de la première cible, un peu après le premier vol.
    renderer.addProjectile(e.fromX, e.fromY, e.x, e.y, e.delay ?? 200, false, false, false, "ricochet");
    renderer.addFloatingText(e.fromX, e.fromY, "Ricochet !", "#8fd0f0");
    return;
  }
  renderer.heroShoots(aim.x - e.fromX, aim.y - e.fromY);
  if (e.via) {
    // Elle heurte l'obstacle, puis retombe en tournoyant.
    renderer.addProjectile(e.fromX, e.fromY, e.via.x, e.via.y, 0, false, !!e.stone, !!e.javelin, e.arrowKind);
    renderer.addProjectile(e.via.x, e.via.y, e.x, e.y, 170, true, !!e.stone, !!e.javelin, e.arrowKind);
  } else {
    renderer.addProjectile(e.fromX, e.fromY, e.x, e.y, 0, false, !!e.stone, !!e.javelin, e.arrowKind);
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
  dieWho.textContent = tr(mode === "advantage" ? `${who} · avantage` : mode === "disadvantage" ? `${who} · désavantage` : who);
  dieWho.className = mode === "normal" ? "" : mode;
  // Jet de dialogue (Gluck) : on dit quelle caractéristique est jetée.
  if (e.type === "npcRoll") dieWho.textContent = tr(e.stat);
  sfx.play("dice");
  if (mode !== "normal") sfx.play(mode);
  // Le crachat d'encre du Carillon part du milieu de son chapeau (3 × 3).
  if (e.type === "attack" && e.ranged && foe && e.ink) renderer.addProjectile(e.attacker.x + 1, e.attacker.y + 1, e.target.x, e.target.y, 0, false, false, false, undefined, true);
  else if (e.type === "attack" && e.ranged && foe) renderer.addProjectile(e.attacker.x, e.attacker.y, e.target.x, e.target.y, 0, false, e.attacker.defId !== "squeletteArcher");
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
    logRoll(e);
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
    // Arme lourde (lente) : un choc plus grave, pour sentir le poids de la lame.
    const melee = !foe && !e.ranged ? game.weapon("melee") : undefined;
    const heavy = !!melee && melee.speed === "slow";
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
  } else if (e.type === "potionThrown") {
    // On voit la fiole voler, puis éclater au sol (Thomas, 2026-11-12).
    renderer.addHop(e.item, e.fromX, e.fromY, e.x, e.y, true);
    // Le feu ou le gaz n'apparaît qu'à l'éclatement (Thomas, 2026-11-12) ; le poison fait une grosse bouffée verte.
    renderer.holdEffects(e.cells, THROW_LAND_MS);
    window.setTimeout(() => {
      renderer.addSplash(e.x, e.y, POTION_SHADES[e.potion] ?? POTION_SHADES.fire);
      sfx.play("glass");
      if (e.potion === "poison") for (const c of e.cells) renderer.addPuff(c.x, c.y, true);
      if (e.potion === "smoke") for (const c of e.cells) renderer.addPuff(c.x, c.y);
    }, THROW_LAND_MS);
  } else if (e.type === "shatter") {
    // La fiole vole, se brise : « Cling ! », des éclats de sa couleur.
    renderer.addHop(e.item, e.fromX, e.fromY, e.x, e.y, true);
    renderer.holdEffects([{ x: e.x, y: e.y }], THROW_LAND_MS);
    window.setTimeout(() => {
      renderer.addSplash(e.x, e.y, POTION_SHADES[e.potion] ?? POTION_SHADES.youth);
      renderer.addFloatingText(e.x, e.y, "Cling !", "#e8f4ff");
      sfx.play("glass");
      if (e.potion === "poison") renderer.addPuff(e.x, e.y, true);
      if (e.potion === "smoke") renderer.addPuff(e.x, e.y);
    }, THROW_LAND_MS);
  } else if (e.type === "luckyDie") {
    renderer.addFloatingText(game.hero.x, game.hero.y, "D20 enchanté !", "#c8a0ff");
  } else if (e.type === "luck") {
    renderer.addFloatingText(game.hero.x, game.hero.y, "Chance !", "#ffd75e");
  } else if (e.type === "stubborn") {
    renderer.addFloatingText(game.hero.x, game.hero.y, "Têtu !", "#ffd75e");
  } else if (e.type === "opportunist") {
    renderer.addFloatingText(game.hero.x, game.hero.y, "Opportuniste !", "#ffd75e");
  } else if (e.type === "statue") {
    if (!e.look) {
      landDie(e.d20!, e.success ? "hit" : "miss", false);
      renderer.addFloatingText(e.x, e.y, e.grille ? (e.success ? "CLANG !" : "CLANG") : e.success ? "CRAC !" : "BONG", "#ffd75e");
      sfx.play(e.success ? "break" : "thud");
    }
  } else if (e.type === "npcRoll") {
    landDie(e.d20, e.success ? "hit" : "miss", false);
  } else if (e.type === "npc") {
    if (e.what === "talk") openTalk(e.who);
    // Il part : nuage et « Pouf ! » (la conversation est fermée : voir `talkLater`).
    else gluckPouf(e);
  } else if (e.type === "doused") {
    renderer.addFloatingText(e.actor.x, e.actor.y, "Pschh !", "#9fd0f4");
    sfx.play("splash");
  } else if (e.type === "grow") {
    renderer.addFloatingText(e.actor.x, e.actor.y, e.back ? "Rétréci" : "Géant !", "#c8a8f0");
    sfx.play(e.back ? "click" : "heavy");
  } else if (e.type === "slippery") {
    renderer.addFloatingText(e.actor.x, e.actor.y, "Glissant !", "#b8e05a");
  } else if (e.type === "slide") {
    renderer.startSlide(e.actor);
    renderer.addFloatingText(e.x, e.y, e.bumps > 0 ? (e.bumps > 1 ? "Bong ! Bong !" : "Bong !") : "Ziiip", "#b8e05a");
    sfx.play(e.bumps > 0 ? "thud" : "slide");
  } else if (e.type === "poisoned" && e.immune) {
    renderer.addFloatingText(e.actor.x, e.actor.y, "Immunisée", "#9fe060");
    renderer.poisonShrug(e.actor.x, e.actor.y, e.actor.size ?? 1);
  } else if (e.type === "bath") {
    if (e.what === "splash") {
      renderer.addFloatingText(e.x, e.y, "SPLASH !", "#d6e4f4");
      renderer.addPuff(e.x, e.y);
      sfx.play("splash");
    } else if (e.what === "scratch") {
      renderer.addFloatingText(e.x, e.y, "Scrrratch !", "#ffd75e");
      sfx.play("click");
    } else if (e.what === "towel") {
      renderer.addFloatingText(e.x, e.y, "Clac !", "#ff8a7a");
      sfx.play("hit");
    } else {
      renderer.addFloatingText(e.x, e.y, "AU SECOURS !", "#ff8a7a");
      sfx.play("notice");
    }
  } else if (e.type === "stone") {
    renderer.addFloatingText(e.actor.x, e.actor.y, e.what === "petrified" ? "Pétrifié !" : e.what === "heroBack" ? "Crac !" : "Crac !", "#c3cbe0");
    sfx.play(e.what === "petrified" ? "thud" : "break");
  } else if (e.type === "flee") {
    renderer.addFloatingText(e.actor.x, e.actor.y, "Il fuit !", "#ffd75e");
  } else if (e.type === "thorns") {
    renderer.addFloatingText(e.actor.x, e.actor.y, `Piqué ! −${e.damage}`, "#d8a060");
    sfx.play("hit");
  } else if (e.type === "lullaby") {
    renderer.addFloatingText(e.actor.x, e.actor.y, "♪ Zzz", "#b48ce0");
    sfx.play("flute");
  } else if (e.type === "quest") {
    if (e.what === "start") renderer.addFloatingText(game.hero.x, game.hero.y, "Nouvelle quête !", "#ffd75e");
    if (e.what === "fail" && e.gold) renderer.addFloatingText(game.hero.x, game.hero.y, `+${e.gold} or`, "#f0c850");
  } else if (e.type === "krikReturn") {
    if (e.amount > 0) {
      renderer.addFloatingText(game.hero.x, game.hero.y, `+${e.amount} or`, "#f0c850");
      sfx.play("coin");
    }
  } else if (e.type === "stairsBounce") {
    renderer.addHop(e.item, e.fromX, e.fromY, e.x, e.y);
  } else if (e.type === "bounce") {
    renderer.addHop(e.item, e.fromX, e.fromY, e.x, e.y);
    renderer.addFloatingText(game.hero.x, game.hero.y, e.messy ? "Sac à ranger" : "Sac plein", "#ffd75e");
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
    if (!launched.has(e)) sfx.play(e.stone ? "whoosh" : "bow");
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
  } else if (e.type === "xp" && e.blocked) {
    // Niveau maximal de la section : les billes rebondissent sur la jauge et retombent (Thomas, 2026-11-12).
    if (lastKill) xpOrbs(lastKill, e.amount, true);
    lastKill = null;
    if (!capNoted) {
      capNoted = true;
      logLines.push(`Niveau ${game.level} : le maximum avant le boss. L'expérience rebondit ; battez le boss pour progresser.`);
    }
  } else if (e.type === "xp") {
    renderer.addFloatingText(game.hero.x, game.hero.y, `+${e.amount} XP`, "#8fc7ff");
    // Billes d'expérience (Thomas, 2026-11-11) : elles quittent le monstre vaincu et filent vers la jauge.
    if (lastKill) xpOrbs(lastKill, e.amount);
    else pulse(xpBar, "gain");
    lastKill = null;
  } else if (e.type === "levelup") {
    shownHp = game.hero.hp;
    renderer.levelUp();
    sfx.play("heal");
  } else if (e.type === "beam") {
    if (e.what === "charge") {
      if (game.isVisible(e.actor.x, e.actor.y)) renderer.addFloatingText(e.actor.x, e.actor.y, "Il se charge…", "#bfe0ff");
    } else {
      renderer.beamFlash(e.actor.x, e.actor.y, e.cells);
      sfx.play("whoosh");
    }
  } else if (e.type === "numb") {
    renderer.addFloatingText(e.actor.x, e.actor.y, "Engourdi…", "#c8a6ec");
  } else if (e.type === "priestess") {
    const words: Record<string, [string, string]> = {
      awake: ["« La Lune pâle vous voit. »", "#bfe0ff"], call: ["La lune vient…", "#dcecff"], moved: ["", "#dcecff"], snuff: ["Pfff…", "#c8a6ec"],
      colossus: ["LE COLOSSE !", "#e2d6b8"], regrow: ["Il se ressoude !", "#bfe0ff"], partDown: ["Crac !", "#e2d6b8"], colossusDown: ["Le cœur éclate !", "#ffe27a"], aloft: ["Hors d'atteinte", "#a8a2c0"],
    };
    const [text, color] = words[e.what];
    if (text) renderer.addFloatingText(e.x, e.y, text, color);
    if (e.what === "colossus" || e.what === "colossusDown") sfx.play("heavy");
    if (e.what === "awake") sfx.play("bell");
  } else if (e.type === "enigma") {
    // Salles à énigme (Thomas, 2026-11-21).
    const words: Record<string, [string, string, string]> = {
      locked: ["Fermé à clef", "#c8d0dc", "thud"], opened: ["Clic !", "#e6ecf4", "unlock"], planted: ["Tchok !", "#e8d8b0", "thud"],
      recoil: ["Elle recule !", "#8fc7ff", "heavy"], bounce: ["Tink !", "#c8d0dc", "click"], key: ["Une clef d'argent !", "#e6ecf4", "unlock"],
      plate: ["La dalle s'enfonce…", "#c8c0b0", "heavy"], gate: ["La herse se lève !", "#e6ecf4", "unlock"], seen: ["Vu ! La herse tombe", "#ff9a7a", "heavy"],
      lift: ["La herse se relève", "#c8d0dc", "click"], torch: ["Des pièges !", "#ff9a7a", "click"], sink: ["Plouf !", "#8fd0f0", "splash"],
    };
    const [text, color, sound] = words[e.what];
    renderer.addFloatingText(e.x, e.y, text, color);
    sfx.play(sound as Parameters<typeof sfx.play>[0]);
  } else if (e.type === "iceSlide") {
    renderer.addFloatingText(e.x, e.y, "Glisse… Boum !", "#bfe6ff");
    sfx.play("thud");
  } else if (e.type === "frost") {
    renderer.addFloatingText(e.actor.x, e.actor.y, e.what === "freeze" ? "Gelé !" : "Crac…", "#bfe6ff");
  } else if (e.type === "undead") {
    const words: Record<string, [string, string]> = {
      pile: ["Il s'effondre…", "#e8e0c8"], crush: ["Crac !", "#e8e0c8"], rise: ["Debout !", "#bfe0ff"], chant0: ["Il entonne…", "#bfe0ff"],
      chant: ["♪ Lune pâle ♪", "#bfe0ff"], daze: ["Sonné !", "#ffd75e"], wake: ["La pierre craque…", "#bfe0ff"], rest: ["…", "#9a9aa8"], eat: ["Il l'a mangé !", "#e08a6a"],
    };
    const [text, color] = words[e.what];
    renderer.addFloatingText(e.actor.x, e.actor.y, text, color);
  } else if (e.type === "rise") {
    renderer.addFloatingText(e.actor.x, e.actor.y, e.what === "down" ? "Il palpite…" : "Debout !", "#7fe0c8");
  } else if (e.type === "melt") {
    if (e.seen) renderer.addFloatingText(e.x, e.y, "Ploc… ploc…", "#9fd0f4");
    sfx.play("splash");
    logLines.push(e.seen ? "La chaleur fait fondre la neige : le bonhomme s'affaisse en une flaque, l'igloo s'effondre." : "Quelque part, de l'eau ruisselle…");
    renderLog();
  } else if (e.type === "snowman") {
    renderer.addFloatingText(e.x, e.y, "Plop !", "#ffb060");
    sfx.play("pickup");
    logLines.push("La carotte se décroche du nez du bonhomme de neige. Elle brille un peu.");
    renderLog();
  } else if (e.type === "alembic") {
    renderer.addFloatingText(e.x, e.y, "Glou glou…", "#cfe8ff");
    sfx.play("pickup");
  } else if (e.type === "burst") {
    renderer.addPuff(e.x, e.y, true);
    sfx.play("gravel");
  } else if (e.type === "whistle") {
    renderer.addFloatingText(e.actor.x, e.actor.y, "FUIIIT !", "#ffd75e");
  } else if (e.type === "lostTrack") {
    renderer.addFloatingText(e.actor.x, e.actor.y, "?", "#cfc3e0");
  } else if (e.type === "watered") {
    renderer.addFloatingText(e.x, e.y, "Arrosé", "#8fd0f0");
  } else if (e.type === "disarm") {
    landDie(e.d20, e.success ? "hit" : "miss", false);
    renderer.addFloatingText(e.x, e.y, e.success ? "Désamorcé !" : e.sprung ? "Clac !" : "Raté", e.success ? "#9fe0a0" : "#ff6b7a");
    sfx.play(e.success ? "unlock" : e.sprung ? "hurt" : "miss");
    if (e.sprung) pulse(hpBar, "hit");
  } else if (e.type === "trapDodged") {
    renderer.addFloatingText(e.x, e.y, "Évité !", "#9fe0a0");
  } else if (e.type === "bout") {
    // Le tripot de Fifrelin : le vainqueur salue et s'en va ; l'or tombe dans la bourse.
    if (e.what === "win" || e.what === "lose") {
      renderer.addPuff(e.x, e.y);
      sfx.play("puff");
    }
    if (e.gold) {
      renderer.addFloatingText(game.hero.x, game.hero.y, `+${e.gold} or`, "#ffd75e");
      sfx.play("coin");
    }
  } else if (e.type === "boss" && e.what === "eat") {
    // Elle se soigne : des croix de santé montent d'elle (Thomas, 2026-11-14).
    const queen = game.monsters.find((m) => m.boss);
    if (queen) renderer.addHealCrosses(queen.x, queen.y, 2);
  } else if (e.type === "boss" && e.what === "dead") {
    music.bossDied();
    // Ses petits s'éloignent de quelques pas, puis fuient dans un nuage de fumée (Thomas, 2026-11-14).
    broodFlight = (e.fled ?? []).filter((f) => game.monsters.some((m) => m.id === f.id));
    const steps = Math.max(0, ...broodFlight.map((f) => f.path.length));
    // La partie continue (Thomas, 2026-11-14 : la section 2 existe) : l'escalier s'ouvre, un coffre doré apparaît.
    void steps;
    logLines.push(
      game.bossLayout()?.kind === "pretresse"
        ? "Un coffre doré luit au pied du socle. L'escalier, derrière, termine l'aperçu de l'Ossuaire."
        : game.bossLayout()?.kind === "carillon"
        ? "Le Carillon s'effondre. Ce n'était pas la cloche : celle de Leutenheim sonne plus bas encore. Un coffre doré luit à côté de lui ; l'escalier, derrière, termine la démo."
        : "Un coffre doré luit là où la Tisseuse est tombée. La toile de l'escalier se déchire : il mène plus bas.",
    );
    renderLog();
  } else if (e.type === "clank") {
    renderer.addFloatingText(e.actor.x, e.actor.y, "Hein ?", "#c8c0a8");
  } else if (e.type === "carillon") {
    // Le Carillon (boss de la section 2, Thomas, 2026-11-16).
    const b = game.bossLayout();
    const mid = { x: e.actor.x + 1, y: e.actor.y + 1 };
    if (e.what === "wake") {
      sfx.play("bell");
      logLines.push("Le Carillon s'ébranle. Tous les huit tours, il sonne : à l'abri derrière une souche quand il se balance ! Entre deux, son encre pleut là où le sol s'assombrit : ne restez pas dessous.");
    } else if (e.what === "warn") {
      renderer.addFloatingText(mid.x, mid.y - 1, "Il se balance…", "#ffd75e");
    } else if (e.what === "ring") {
      const from = b?.clapper ?? { x: mid.x, y: mid.y + 1 };
      renderer.proneHold = false;
      renderer.carillonRing(from.x, from.y);
      sfx.play("bell");
      const heroHit = (e.hit ?? []).includes(game.hero);
      if (heroHit) renderer.addFloatingText(game.hero.x, game.hero.y, "À terre !", "#ff6b7a");
      for (const o of e.hit ?? []) if (o !== game.hero) renderer.addFloatingText(o.x, o.y, "À terre !", "#ffd75e");
      logLines.push(heroHit ? "DONG ! L'onde vous jette à terre." : "DONG ! L'onde passe sur vous : à l'abri, vous ne bronchez pas.");
    } else if (e.what === "false") {
      renderer.addFloatingText(mid.x, mid.y - 1, "Il sonne faux !", "#ffd75e");
      sfx.play("cowbell");
      logLines.push("Frappé en plein élan, le Carillon sonne faux : il se fêle et reste sonné. À vous !");
    } else if (e.what === "clapper") {
      renderer.addFloatingText(e.actor.x, e.actor.y, "Crac !", "#c4d660");
      sfx.play("break");
      logLines.push("Le battant se brise : le Carillon ne sonnera plus. Mais son chapeau se met à fondre…");
    } else if (e.what === "ink") {
      sfx.play("splash");
      if (e.cells) renderer.inkFall(e.cells);
      for (const o of e.hit ?? []) renderer.addFloatingText(o.x, o.y, "Splotch !", o === game.hero ? "#ff6b7a" : "#b7a6d6");
      if ((e.hit ?? []).includes(game.hero)) logLines.push("Une goutte d'encre vous tombe dessus.");
    } else if (e.what === "echo") {
      sfx.play("bell");
      if (e.cells?.[0]) {
        renderer.carillonRing(e.cells[0].x, e.cells[0].y);
        renderer.addFloatingText(e.cells[0].x, e.cells[0].y, "Écho !", "#b7a6d6");
      }
      if ((e.hit ?? []).includes(game.hero)) logLines.push("L'onde rebondit sur la paroi et revient vous frapper dans le dos.");
      else logLines.push("L'écho de l'onde revient du mur d'en face.");
    } else if (e.what === "knell") {
      renderer.addFloatingText(e.actor.x + 1, e.actor.y, "GLAS", "#e2ded6");
      logLines.push("Le Carillon chancelle et sonne le glas : trois ondes, coup sur coup !");
    } else if (e.what === "slump") {
      renderer.addFloatingText(e.actor.x + 1, e.actor.y, "Il s'affaisse !", "#c4d660");
      logLines.push("Épuisé, le Carillon s'affaisse et se fêle. Finissez-le !");
    } else if (e.what === "stumpCrack" && e.cells?.[0]) {
      renderer.addFloatingText(e.cells[0].x, e.cells[0].y, "Crac", "#c9c2ae");
      logLines.push("La souche qui vous abrite se fend.");
    } else if (e.what === "stumpBreak" && e.cells?.[0]) {
      renderer.addFloatingText(e.cells[0].x, e.cells[0].y, "Crac !", "#c9c2ae");
      sfx.play("break");
      logLines.push("La souche éclate : il faut trouver un autre abri.");
    } else if (e.what === "repair") {
      renderer.addFloatingText(e.actor.x, e.actor.y, "Toc toc", "#c8a0e8");
      logLines.push("Un fidèle s'affaire autour du battant tombé. Arrêtez-le !");
    } else if (e.what === "repaired") {
      renderer.addFloatingText(e.actor.x, e.actor.y, "Réparé !", "#c8a0e8");
      sfx.play("bell");
      logLines.push("Les fidèles ont remis le battant : le Carillon sonnera de nouveau.");
    } else if (e.what === "cower") {
      renderer.addFloatingText(e.actor.x, e.actor.y, "À l'abri !", "#b7a6d6");
    } else if (e.what === "inkMark") {
      // L'ombre est dessinée par le renderer (état du boss) ; la coulée (sans battant) s'annonce.
      if (e.kind === "drip") {
        renderer.addFloatingText(e.actor.x + 1, e.actor.y, "Il fond…", "#b7a6d6");
        logLines.push("Le chapeau du Carillon dégouline : l'encre va couler tout autour de lui. Écartez-vous !");
      }
    } else if (e.what === "sprout") {
      renderer.addFloatingText(e.actor.x, e.actor.y, "!", "#7f9a84");
      logLines.push("Le mycélium se soulève : un fidèle du Carillon en sort.");
    }
    renderLog();
  } else if (e.type === "sealed") {
    renderer.addFloatingText(game.hero.x, game.hero.y, "Scellé", "#e2ded6");
    logLines.push(game.bossLayout()?.kind === "carillon" ? "Un rideau de mycélium scelle l'escalier. Derrière vous, quelque chose se balance…" : "Une toile épaisse scelle l'escalier. Vous entendez quelque chose derrière vous…");
    renderLog();
  } else if (e.type === "demoEnd") {
    setTimeout(showDemoEnd, 300);
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
    for (let k = 0; k < e.stage; k++)
      setTimeout(() => {
        sfx.play("bell");
        alarmWaves(e.stage);
      }, k * 650);
    renderer.addFloatingText(game.hero.x, game.hero.y, ["", "Le donjon s'agite", "Alerte !", "Traque !"][e.stage] ?? "", "#ff8a7a");
  } else if (e.type === "holy") {
    // Grenade sainte (Thomas, 2026-11-19) : elle vole, puis éclate en lumière jaune.
    renderer.addHop("grenade_sainte", e.fromX, e.fromY, e.x, e.y);
    renderer.holdEffects([{ x: e.x, y: e.y }], THROW_LAND_MS);
    window.setTimeout(() => {
      renderer.holyFlash(e.x, e.y, e.cells);
      renderer.addFloatingText(e.x, e.y, "Lumière !", "#ffe27a");
      if (e.blessed) renderer.addFloatingText(game.hero.x, game.hero.y, e.healed > 0 ? `Béni ! +${e.healed}` : "Béni !", "#ffd75e");
      sfx.play("heal");
      sfx.play("heavy");
    }, THROW_LAND_MS);
    logLines.push(
      e.hit > 0
        ? e.blessed
          ? `La grenade sainte éclate en lumière jaune : ennemis brûlés : ${e.hit}, et vous êtes béni.`
          : `La grenade sainte éclate en lumière jaune : ennemis brûlés : ${e.hit}.`
        : e.blessed
          ? "La grenade sainte éclate en lumière jaune : vous êtes béni."
          : "La grenade sainte éclate en lumière jaune.",
    );
    renderLog();
  } else if (e.type === "bomb") {
    // Bombe arcanique (Thomas, 2026-11-16) : elle vole, se pose, compte, puis explose en croix.
    if (e.what === "thrown") {
      renderer.addHop("bombe_arcanique", e.fromX, e.fromY, e.x, e.y);
      logLines.push("La bombe arcanique se pose et bourdonne. Elle explosera dans 3 tours : éloignez-vous !");
      renderLog();
    } else if (e.what === "tick") {
      if (game.isVisible(e.x, e.y)) renderer.addFloatingText(e.x, e.y, `${e.n}…`, "#c8a0ff");
      sfx.play("click");
    } else {
      for (const c of e.cells) renderer.addPuff(c.x, c.y, true);
      renderer.addFloatingText(e.x, e.y, "BOUM !", "#e0d0ff");
      for (const d of e.doors) renderer.addFloatingText(d.x, d.y, "Crac !", "#d8c8a0");
      sfx.play("heavy");
      sfx.play("break");
      logLines.push(e.doors.length > 0 ? "BOUM ! La bombe arcanique explose et souffle la porte." : "BOUM ! La bombe arcanique explose.");
      renderLog();
    }
  } else if (e.type === "torchThrown") {
    // La torche vole en tournoyant ; sa case ne prend feu qu'à l'impact (Thomas, 2026-11-14).
    renderer.addHop("torche", e.fromX, e.fromY, e.x, e.y, true);
    renderer.holdEffects([{ x: e.x, y: e.y }], THROW_LAND_MS);
    window.setTimeout(() => {
      renderer.addFloatingText(e.x, e.y, e.doused ? "Pschh !" : "Fwouf !", e.doused ? "#a8d0f0" : "#ff9a3a");
      sfx.play(e.doused ? "splash" : "whoosh");
    }, THROW_LAND_MS);
  } else if (e.type === "fire") {
    // Après l'éclatement de la fiole.
    window.setTimeout(() => {
      renderer.addFloatingText(e.x, e.y, "Feu !", "#ff9a3a");
      sfx.play("break");
    }, THROW_LAND_MS);
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
  } else if (e.type === "mushHush") {
    if (e.dark) renderer.addFloatingText(e.x, e.y, "Les lueurs s'éteignent…", "#7fb8a8");
  } else if (e.type === "sporeBlast") {
    for (const c of e.cells) renderer.addFloatingText(c.x, c.y, "Boum !", "#ffb04a");
    sfx.play("break");
  } else if (e.type === "puffball") {
    renderer.addFloatingText(e.x, e.y, e.what === "sleep" ? "Pfff… Zzz" : "Pfff !", e.what === "sleep" ? "#9fc4f0" : "#f0a0c8");
    sfx.play("puff");
  } else if (e.type === "niche") {
    renderer.addFloatingText(e.x, e.y, "Grrrrr…", "#c8c0d4");
    sfx.play("thud");
  } else if (e.type === "skeleton") {
    sfx.play("pickup");
  } else if (e.type === "theft") {
    renderer.addFloatingText(game.hero.x, game.hero.y, e.success ? (e.what === "apple" ? "Chipée !" : "Coin !") : "Au voleur !", e.success ? "#ffd75e" : "#ff6b7a");
  } else if (e.type === "artifact") {
    if (e.what === "paint" && e.x !== undefined) renderer.addFloatingText(e.x, e.y!, "Faux mur", "#d8c8a0");
    if (e.what === "fork") renderer.addFloatingText(game.hero.x, game.hero.y, "♪ La !", "#bedcf0");
  } else if (e.type === "power") {
    const words = { riposte: "Riposte !", tourbillon: "Tourbillon !", charge: "Charge !", cri_guerre: "Cri de guerre !", bastion: "Bastion !", execution: "Exécution !", soif_sang: `+${e.healed ?? 0} PV` };
    renderer.addFloatingText(game.hero.x, game.hero.y, words[e.power], e.power === "riposte" || e.power === "bastion" ? "#9fd0f4" : e.power === "soif_sang" ? "#7ee08a" : "#ff8a7a");
    if (e.power === "soif_sang") sfx.play("heal");
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
    // Allumée depuis le sac : l'animation attend qu'on le referme (Thomas, 2026-11-16).
    if (e.item === "torche") flarePending = true;
  } else if (e.type === "noticed") {
    renderer.addFloatingText(e.actor.x, e.actor.y, "!", "#ffd75e");
    sfx.play("notice");
  } else if (e.type === "counter") {
    discover(["n:compteur"]);
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
    // Ce n'est pas la bonne cloche (Thomas, 2026-11-13, après le synopsis) : une cloche à vache.
    sfx.play("cowbell");
    renderer.ringBell(e.x, e.y);
    renderer.addFloatingText(e.x, e.y, "CLONC !", "#ffd75e");
  } else if (e.type === "feud") {
    // Deux monstres se querellent : « Grr ! » au-dessus des deux.
    if (game.isVisible(e.a.x, e.a.y) || game.isVisible(e.b.x, e.b.y)) {
      renderer.addFloatingText(e.a.x, e.a.y, "Grr !", "#ff8a7a");
      renderer.addFloatingText(e.b.x, e.b.y, e.reason === "shot" ? "Hé !" : e.reason === "species" ? "Iiik !" : "Grr !", "#ff8a7a");
      if (e.reason === "species") renderer.addFloatingText(e.a.x, e.a.y, "Sssss !", "#c8a8f0");
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
      renderer.addFloatingText(e.x, e.y, e.messy ? "Sac à ranger" : "Sac plein", "#ff8a7a");
    }
  } else if (e.type === "heavyBlow") {
    renderer.addFloatingText(e.actor.x, e.actor.y, e.kind === "stun" ? "Assommé !" : e.kind === "knockback" ? "Projeté !" : "Net !", e.kind === "oneShot" ? "#ffffff" : "#ffd75e");
    if (e.kind !== "oneShot") sfx.play("thud");
  } else if (e.type === "chicken") {
    // Le poulet (Thomas, 2026-11-13) : un cri, puis sa course à l'écran ; la porte défoncée ; le mur, les plumes.
    renderer.addFloatingText(e.path[0].x, e.path[0].y, "Côôt ?!", "#fff3c8");
    sfx.play("squeak");
    const door = e.door;
    renderer.runChicken(
      e.path,
      door,
      () => {
        if (!door) return;
        game.chickenDoorBroken(door);
        renderer.addFloatingText(door.x, door.y, "Crac !", "#ffd75e");
        sfx.play("break");
      },
      () => {
        renderer.addFloatingText(e.crash.x, e.crash.y, "Plof !", "#fff3c8");
        sfx.play("thud");
        game.chickenGlow(null);
      },
      (p) => game.chickenGlow(p),
    );
  } else if (e.type === "pickEquip") {
    const name = ITEMS[e.item].name;
    logLines.push(e.ok ? `Vous vous équipez : ${name.toLowerCase()}.` : `Impossible de porter ${name.toLowerCase()} : il reste dans le sac.`);
  } else if (e.type === "sectionIntro") {
    const lines = SECTION_LINES[e.section];
    if (lines) showIntro(lines);
  } else if (e.type === "stairs") {
    clearRollLog();
    shownHp = game.hero.hp;
    sfx.play("descend");
  } else if (e.type === "hide") {
    landDie(e.d20, e.success ? "hit" : "miss", false);
    renderer.addFloatingText(game.hero.x, game.hero.y, e.success ? "Caché" : "Visible", e.success ? "#c8c8c8" : "#ff6b7a");
    if (!e.success) sfx.play("miss");
  } else if (e.type === "gravel" && e.monster) {
    // Un monstre sur le gravier : plus bas et plus pâle, même hors de vue (on l'entend venir).
    if (!game.isVisible(e.x, e.y)) renderer.addFloatingText(e.x, e.y, e.water ? "Plic" : "Crik", e.water ? "#6f93b4" : "#8e8698");
    sfx.play(e.water ? "splash" : "gravel");
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
    else renderer.addFloatingText(e.target.x, e.target.y, e.prone ? "À terre !" : e.success ? "Poussé !" : "Raté", e.success ? "#ffd75e" : "#ff6b7a");
    sfx.play(!e.success ? "miss" : e.slam > 0 ? "thud" : "hit");
  } else if (e.type === "trap") {
    const hero = e.victim.kind === "hero";
    renderer.trapSprung(e.x, e.y);
    const label = e.kind === "tombSlab" ? `Caveau ! −${e.damage}` : e.kind === "boneHands" ? `Agrippé ! −${e.damage}` : e.kind === "censer" ? "Encens !" : e.kind === "moonMirror" ? "Lune !" : e.kind === "pendulum" ? `Fauché ! −${e.damage}` : e.kind === "snare" ? "Ligoté !" : e.kind === "hooks" ? `Racines ! −${e.damage}` : e.kind === "spores" ? "Spores !" : e.kind === "gas" ? "Gaz !" : e.kind === "pit" ? `Fosse ! −${e.damage}` : e.kind === "needle" ? `Aiguille ! −${e.damage}` : `Piège ! −${e.damage}`;
    renderer.addFloatingText(e.x, e.y, label, e.kind === "gas" || e.kind === "needle" || e.kind === "spores" ? "#9fe060" : e.kind === "snare" ? "#cfe8e0" : "#ff6b7a");
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
/** Fin de la démo (Thomas, 2026-11-11) : après la victoire contre la Tisseuse. La partie est finie (Thomas, 2026-11-13 : « bloque le jeu après le boss »). */
function showDemoEnd(): void {
  over.replaceChildren();
  over.classList.add("over-win");
  over.append(el("div", "over-title", "Fin de la démo"), el("div", "over-line", game.depth >= 11 ? "La Grande Prêtresse est tombée : l'Ossuaire est traversé. C'est tout pour l'instant." : game.depth >= 6 ? "La champignonnière est traversée : c'est tout pour l'instant." : "La Tisseuse est vaincue : la première section du donjon est terminée."));
  over.append(el("div", "over-line", `Niveau ${game.level} · ${game.gold} pièces d'or`));
  over.append(el("div", "over-sub", "Merci d'avoir joué ! La suite du donjon arrive bientôt."));
  if (!game.sandbox && !game.testRun) {
    const d = new Date();
    const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const rank = addRecord({ deepest: game.deepest, level: game.level, gold: game.gold, cause: "victoire", hero: game.heroClass.name, date, bosses: game.bossKills, turns: game.turn, race: game.race.id, heroClass: game.heroClass.id });
    if (rank === 1) over.append(el("div", "over-best", "Nouveau record !"));
    else if (rank > 0) over.append(el("div", "over-line", `${rank}e meilleure partie`));
  }
  const again = el("button", "", "Nouvelle partie") as HTMLButtonElement;
  again.type = "button";
  again.addEventListener("click", () => {
    over.classList.remove("over-win");
    showScreen("new");
  });
  over.append(again);
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
/** La phrase sur le niveau maximal n'est écrite qu'une fois par partie. */
let capNoted = false;
$("xp-stop").addEventListener("click", (ev) => {
  ev.stopPropagation();
  logLines.push(`Niveau ${game.level} : le maximum avant d'avoir vaincu le boss de la section.`);
  renderLog();
});

function xpOrbs(cell: { x: number; y: number }, amount: number, blocked = false): void {
  const box = canvas.getBoundingClientRect();
  const c = renderer.tileCenter(cell.x, cell.y);
  const bar = xpBar.getBoundingClientRect();
  const count = Math.max(3, Math.min(8, amount));
  // Chaque bille porte sa part de l'XP gagnée ; la jauge avance quand elle arrive.
  const shares = Array.from({ length: count }, (_, i) => Math.floor(((i + 1) * amount) / count) - Math.floor((i * amount) / count));
  if (blocked) {
    // Elles volent jusqu'à la jauge, rebondissent dessus et retombent en s'éteignant.
    for (let i = 0; i < count; i++) {
      const orb = document.createElement("div");
      orb.className = "xp-orb";
      const sx = box.left + c.x + (Math.random() - 0.5) * 18;
      const sy = box.top + c.y + (Math.random() - 0.5) * 18;
      const tx = bar.left + bar.width * (0.25 + Math.random() * 0.5);
      const ty = bar.top + bar.height / 2;
      const side = (Math.random() - 0.5) * 70;
      orb.style.left = `${sx}px`;
      orb.style.top = `${sy}px`;
      document.body.append(orb);
      orb.animate(
        [
          { transform: "translate(0, 0) scale(0.6)", opacity: 0 },
          { transform: `translate(${(Math.random() - 0.5) * 30}px, -22px) scale(1)`, opacity: 1, offset: 0.15 },
          { transform: `translate(${tx - sx}px, ${ty - sy}px) scale(0.8)`, opacity: 1, offset: 0.45, easing: "ease-out" },
          { transform: `translate(${tx - sx + side * 0.5}px, ${ty - sy - 14}px) scale(0.8)`, opacity: 1, offset: 0.6, easing: "ease-in" },
          { transform: `translate(${tx - sx + side}px, ${ty - sy + 140}px) scale(0.6)`, opacity: 0 },
        ],
        { duration: 1300, delay: 120 + i * 70, fill: "forwards" },
      ).onfinish = () => orb.remove();
      window.setTimeout(() => pulse(xpBar, "hit"), 120 + i * 70 + 585);
    }
    return;
  }
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
  if (!game.sandbox && !game.testRun) {
    const d = new Date();
    const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const rank = addRecord({ deepest: game.deepest, level: game.level, gold: game.gold, cause, hero: game.heroClass.name, date, bosses: game.bossKills, turns: game.turn, race: game.race.id, heroClass: game.heroClass.id });
    if (rank === 1) over.append(el("div", "over-best", "Nouveau record !"));
    else if (rank > 0) over.append(el("div", "over-line", `${rank}e meilleure partie`));
  }
  // Revivre (Thomas, 2026-11-15 : « un bouton sur l'écran de mort », partie en cours comprise) : dans la démo
  // d'essai, pour toutes les parties ; jamais dans la version publique.
  if (!PUBLIC_BUILD) {
    const back = el("button", "", "Revivre") as HTMLButtonElement;
    back.type = "button";
    back.addEventListener("click", () => {
      if (!game.revive()) return;
      stats.track("revive", { depth: game.depth, level: game.level, turn: game.turn, test: game.sandbox || game.testRun });
      renderer.heroRises();
      over.hidden = true;
      shownHp = game.hero.hp;
      logLines.push("Vous revivez (partie d'essai) : tous vos PV, sur place.");
      renderLog();
      writeSave(true);
    });
    over.append(back);
  }
  const again = el("button", "", "Nouvelle partie") as HTMLButtonElement;
  again.type = "button";
  again.addEventListener("click", () => showScreen("new"));
  over.append(again);
  over.hidden = false;
}

/**
 * Gestionnaire de sauvegardes (Thomas, 2026-11-12 : « rappel des pictos de race et classe, étage, dernière connexion ;
 * option pour supprimer ») : une carte par emplacement (donjon, salle d'essai), Reprendre ou Supprimer (deux touchers).
 */
function renderSaves(): void {
  const list = $("saves-list");
  list.replaceChildren();
  const slots = PUBLIC_BUILD ? DUNGEON_SLOTS : [...DUNGEON_SLOTS, SAVE_KEYS.essai];
  let any = false;
  for (const key of slots) {
    const sandbox = key === SAVE_KEYS.essai;
    let data: { race?: string; heroClass?: string; depth?: number; level?: number; savedAt?: string } | null = null;
    try {
      const text = localStorage.getItem(key);
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!data) continue;
    any = true;
    const card = el("div", "save-card");
    const pictos = el("div", "save-pictos");
    for (const id of [data.race, data.heroClass]) {
      const p = id ? PICTOS[id] : undefined;
      if (p) pictos.append(buildIcon(p.rows, p.palette));
    }
    const race = RACES[data.race as keyof typeof RACES]?.name ?? "";
    const cls = CLASSES[data.heroClass as keyof typeof CLASSES]?.name ?? "";
    const text = el("div", "save-text");
    const title = el("div", "save-title");
    title.textContent = `${tr(race)} ${tr(cls)} · ${sandbox ? tr("Salle d'essai") : tr("Partie {0}").replace("{0}", String(DUNGEON_SLOTS.indexOf(key) + 1))}`;
    const when = data.savedAt ? new Date(data.savedAt) : null;
    const whenText =
      when && !isNaN(when.getTime())
        ? new Intl.DateTimeFormat(options.lang === "en" ? "en-GB" : "fr-FR", { dateStyle: "short", timeStyle: "short" }).format(when)
        : "?";
    text.append(title, el("div", "", `Étage ${data.depth ?? 1} · Niv ${data.level ?? 1}`), el("div", "save-when", `Dernière partie : ${whenText}`));
    const buttons = el("div", "save-buttons");
    const resume = el("button", "", "Reprendre");
    resume.addEventListener("click", () => {
      sfx.play("click");
      try {
        const saved = Game.restore(JSON.parse(localStorage.getItem(key) ?? "null"));
        if (!saved) throw new Error("illisible");
        currentSlot = key;
        resumeRun(saved);
        savedRun = null;
        showScreen(null);
      } catch {
        logLines.push("Sauvegarde illisible.");
        renderLog();
      }
    });
    const erase = el("button", "danger", "Supprimer");
    let armed = false;
    erase.addEventListener("click", () => {
      sfx.play("click");
      if (!armed) {
        armed = true;
        erase.classList.add("armed");
        erase.textContent = tr("Sûr ?");
        return;
      }
      eraseSave(key);
      // La partie en cours, si c'est elle : elle s'arrête (sinon elle se réécrirait aussitôt).
      if (started && !game.over && currentSlot === key) started = false;
      if (savedRun && savedSlot === key) savedRun = null;
      showScreen("saves");
    });
    buttons.append(resume, erase);
    card.append(pictos, text, buttons);
    list.append(card);
  }
  if (!any) list.append(el("p", "", "Aucune sauvegarde."));
}

/** Le manuel (onglet de l'Encyclopédie, Thomas 2026-11-12) : caractéristiques, avantage, opportunité (src/data/manual.ts). */
function manualNodes(): HTMLElement[] {
  const nodes: HTMLElement[] = [];
  for (const section of MANUAL) {
    nodes.push(el("h3", "", section.title));
    if (section.intro) nodes.push(el("p", "manual-intro", section.intro));
    for (const entry of section.entries) {
      const div = el("div", "manual-entry");
      div.append(el("b", "", entry.title), document.createElement("br"));
      div.append(document.createTextNode(entry.lines.map((l) => tr(l)).join(" ")));
      nodes.push(div);
    }
  }
  return nodes;
}

/** Le bandeau de la tâche de quête, sous les jauges : l'objectif, puis « revenir voir… » (il clignote quand c'est fait). */
let questShown = "";
let questWasDone = false;
function renderQuest(): void {
  const banner = $("quest-banner");
  const q = game.over ? null : game.questLine();
  setHidden(banner, !q);
  if (!q) {
    questShown = "";
    questWasDone = false;
    return;
  }
  const text = tr(q.text);
  if (text !== questShown) {
    banner.textContent = text;
    questShown = text;
  }
  banner.classList.toggle("done", q.done);
  if (q.done && !questWasDone) {
    banner.classList.remove("flash");
    void banner.offsetWidth;
    banner.classList.add("flash");
    renderer.addFloatingText(game.hero.x, game.hero.y, "Objectif rempli !", "#ffd75e");
    sfx.play("advantage");
  }
  questWasDone = q.done;
}

/**
 * Records (Thomas, 2026-11-14 : « revois le mur des records, reprends la même structure visuelle que les sauvegardes ») :
 * une carte par partie, comme une sauvegarde : le rang, les pictos de race et de classe l'un sur l'autre, le héros, l'étage,
 * le niveau, l'or, les tours, la cause, la date ; une couronne pour une partie où la Tisseuse est tombée.
 */
function renderRecords(): void {
  const list = $("records-list");
  list.replaceChildren();
  const records = loadRecords();
  if (records.length === 0) list.append(el("p", "", "Aucune partie terminée pour l'instant."));
  records.forEach((r, i) => {
    const card = el("div", `save-card record-card${i === 0 ? " best" : ""}`);
    card.append(el("div", "record-rank", String(i + 1)));
    const pictos = el("div", "save-pictos");
    // Les records d'avant le 2026-11-14 ne gardaient pas la race : Humain Guerrier (les seuls jouables alors).
    for (const id of [r.race ?? "humain", r.heroClass ?? "guerrier"]) {
      const p = PICTOS[id];
      if (p) pictos.append(buildIcon(p.rows, p.palette));
    }
    const race = RACES[(r.race ?? "humain") as keyof typeof RACES]?.name ?? "";
    const cls = CLASSES[(r.heroClass ?? "guerrier") as keyof typeof CLASSES]?.name ?? r.hero;
    const text = el("div", "save-text");
    const won = r.cause === "victoire" || (r.bosses ?? 0) > 0;
    text.append(
      el("div", "save-title", `${tr(race)} ${tr(cls)}`),
      el("div", "", `Étage ${r.deepest} · Niv ${r.level} · ${r.gold} or · ${r.turns ?? "?"} tours`),
      el("div", won ? "record-win" : "save-when", r.cause === "victoire" ? (r.deepest >= 15 ? "La Grande Prêtresse est tombée." : r.deepest >= 10 ? "Le Carillon est tombé." : "La Tisseuse est tombée.") : `Mort : ${r.cause}`),
      el("div", "save-when", `Le ${r.date}`),
    );
    card.append(pictos, text);
    if (won) card.append(medal("tisseuse", 2, 2));
    list.append(card);
  });
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
  trackEvents(game.events);
  for (const e of game.events) {
    if (e.type === "death" && e.actor.kind === "monster") ghosts.push(e.actor);
    // Glissade : le monstre reste à son point de départ jusqu'à ce que la glissade soit montrée (après le dé).
    if (e.type === "slide") renderer.slideActor(e.actor, { x: e.fromX, y: e.fromY }, e.path);
    // Renversé par l'onde (Thomas, 2026-11-17 : « je suis couché avant l'onde de choc ») : couché seulement une fois
    // l'onde montrée.
    if (e.type === "carillon" && e.what === "ring") renderer.proneHold = true;
    // UN LANCER ARRIVE AVANT LA RÉPONSE DES MONSTRES (Thomas, 2026-11-24) : la fiole ou la torche vole d'abord, les
    // monstres ne bougent qu'une fois l'objet tombé ; et rien ne brûle autour de l'impact avant qu'il ne touche.
    const thrown = e.type === "potionThrown" || e.type === "torchThrown" || e.type === "shatter" || (e.type === "bomb" && e.what === "thrown") || e.type === "holy";
    if (thrown) {
      throwLag = THROW_LAND_MS;
      stepMs = Math.max(stepMs, THROW_LAND_MS + COMBAT_STEP_MS);
      const around: { x: number; y: number }[] = [];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) around.push({ x: e.x + dx, y: e.y + dy });
      renderer.holdEffects(around, THROW_LAND_MS);
    }
    queue.push(e);
  }
  // Le mur de succès (Thomas, 2026-11-14) : la première fois, l'animation ; ensuite, une ligne au journal.
  for (const u of onEvents(game.events, game)) {
    logLines.push(medalLine(u.id, u.tier, u.line));
    if (u.first) unlockQueue.push(u);
  }
  if (unlockQueue.length > 0 && !unlockPlaying) nextUnlock();
  game.events.length = 0;
}

/** Les succès obtenus pour la première fois, montrés l'un après l'autre. */
const unlockQueue: Unlock[] = [];
let unlockPlaying = false;
function nextUnlock(): void {
  const u = unlockQueue.shift();
  if (!u) {
    unlockPlaying = false;
    return;
  }
  unlockPlaying = true;
  sfx.play("unlock");
  playUnlock(document.querySelector(".frame") as HTMLElement, $("open-menu"), u, nextUnlock);
  renderLog();
}

// ---------- Commandes ----------

bindInput(canvas, {
  onTap(px, py) {
    // Toucher la carte en sortant de l'escalier : l'astuce s'efface vite, pour ne pas couvrir ce qui va s'afficher
    // (Thomas, 2026-11-24 : « les textes se superposent »).
    dismissTip();
    // Pendant le passage d'un étage à l'autre, toucher l'écran l'abrège.
    if (stairsScene) {
      stairsScene.skip();
      return;
    }
    if (menuOpen || bagOpen || foundOpen || shopOpen || talkOpen) return;
    const t = renderer.screenToTile(px, py);
    if (disarmMode) {
      disarmMode = false;
      renderer.jumpCells = [];
      if (game.disarmTargets().some((c) => c.x === t.x && c.y === t.y) && game.disarm(t.x, t.y)) stepMs = COMBAT_STEP_MS;
      else {
        logLines.push("Vous renoncez à désamorcer.");
        renderLog();
      }
      return;
    }
    if (pushMode) {
      pushMode = false;
  disarmMode = false;
      renderer.jumpCells = [];
      const target = game.pushTargets().find((m) => m.x === t.x && m.y === t.y);
      if (target && game.push(target.id)) stepMs = COMBAT_STEP_MS;
      else {
        logLines.push("Vous renoncez à pousser.");
        renderLog();
      }
      return;
    }
    if (paintMode) {
      paintMode = false;
      renderer.jumpCells = [];
      if (game.paintWall(t.x, t.y)) stepMs = COMBAT_STEP_MS;
      else {
        logLines.push("Vous rangez le pinceau.");
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
        logLines.push(game.inventory.get(uid)?.defId === "torche" ? "Vous gardez la torche." : "Vous gardez la potion.");
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
    noteTravel(t.x, t.y);
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
/** Les deux barres qui montent au-dessus du dé (Thomas, 2026-11-19, planche art/pictos_capacites_v2.png) :
 *  ACTIONS (bronze), ce que tout héros sait faire ; CAPACITÉS (couleur de la voie), le pouvoir principal puis ceux du Rang II. */
const WHEEL = [
  ["wheel-search", "search", "Fouiller"],
  ["wheel-hide", "hide", "Se cacher"],
  ["wheel-push", "push", "Pousser"],
  ["wheel-disengage", "disengage", "Se dégager"],
  ["wheel-rest", "rest", "Se reposer"],
  ["wheel-disarm", "disarm", "Désamorcer un piège"],
  ["wheel-skill", "actions", "Pouvoir de la voie"],
  ["wheel-tourbillon", "whirl", "Tourbillon"],
  ["wheel-charge", "charge", "Charge"],
  ["wheel-cri", "cry", "Cri de guerre"],
  ["wheel-bastion", "actions", "Bastion"],
  ["wheel-execution", "actions", "Exécution"],
] as const;
const WHEEL_POWERS = { "wheel-tourbillon": "tourbillon", "wheel-charge": "charge", "wheel-cri": "cri_guerre", "wheel-bastion": "bastion", "wheel-execution": "execution" } as const;
const ACTION_IDS = ["wheel-search", "wheel-hide", "wheel-push", "wheel-disengage", "wheel-rest", "wheel-disarm"];
let wheelMode: "actions" | "skills" | "ammo" = "actions";

function closeWheel(): void {
  wheelOpen = false;
  wheel.hidden = true;
}

/** Des billes : une par charge restante. */
function pips(n: number): HTMLElement {
  const box = el("span", "pips");
  for (let k = 0; k < Math.min(n, 6); k++) box.append(el("i", ""));
  return box;
}

/** Le pouvoir principal de la voie : son picto et son nom court. */
function mainSkill(): { icon: SkillIconId; short: string } | null {
  if (game.voie === "blue") return { icon: "second_souffle", short: "Souffle" };
  if (game.voie === "red") return { icon: "double_frappe", short: "Double" };
  return null;
}

/** Les pouvoirs du Rang II acquis (voie rouge). */
function ownedPowers(): (keyof typeof WHEEL_POWERS)[] {
  return (Object.keys(WHEEL_POWERS) as (keyof typeof WHEEL_POWERS)[]).filter((id) => game.rank(WHEEL_POWERS[id]) > 0);
}

function openWheel(mode: "actions" | "skills" | "ammo" = "actions"): void {
  if (game.over) return;
  aimMode = false;
  jumpMode = false;
  pushMode = false;
  disarmMode = false;
  renderer.jumpCells = [];
  wheelMode = mode;
  $("wheel-bar").hidden = mode !== "actions";
  $("wheel-pow").hidden = mode !== "skills";
  $("wheel-ammo").hidden = mode !== "ammo";
  if (mode === "ammo") renderAmmoBar();
  else if (mode === "actions") {
    // DÉSAMORCER : seulement à côté d'un piège connu (Thomas, 2026-11-17) ; toucher le piège y marche toujours.
    $("wheel-disarm").hidden = game.disarmTargets().length === 0;
    for (const id of ACTION_IDS) {
      // Une action impossible reste visible, grisée.
      const possible =
        id === "wheel-rest" ? game.restRefusal() === null
        : id === "wheel-hide" ? game.hideRefusal() === null
        : id === "wheel-disengage" ? game.disengageRefusal() === null
        : id === "wheel-search" ? game.searchRefusal() === null
        : id === "wheel-push" ? game.pushRefusal() === null
        : game.disarmRefusal() === null;
      $(id).classList.toggle("off", !possible);
    }
  } else {
    const main = mainSkill();
    const sk = $("wheel-skill");
    if (main) sk.replaceChildren(buildIcon(SKILL_ICONS[main.icon]), el("span", "wheel-label", main.short), pips(powerCharges()));
    sk.classList.toggle("off", game.skillRefusal() !== null);
    const owned = ownedPowers();
    for (const id of Object.keys(WHEEL_POWERS) as (keyof typeof WHEEL_POWERS)[]) {
      const b = $(id);
      b.hidden = !owned.includes(id);
      if (b.hidden) continue;
      const pw = WHEEL_POWERS[id];
      b.replaceChildren(buildIcon(SKILL_ICONS[pw]), el("span", "wheel-label", WHEEL_SHORT[id]), pips(game.powerUsesLeft(pw)));
      b.classList.toggle("off", game.powerRefusal(pw) !== null);
    }
  }
  wheelOpen = true;
  wheel.hidden = false;
}

/** Le bouton OBJET (vert) de la barre du bas : l'objet choisi en raccourci et combien il en reste ; sinon le picto habituel. */
let quickShown = "";
function renderQuickButton(): void {
  const b = $("quick");
  const stack = game.quickStack();
  const key = `${game.quickItem}|${stack?.count ?? 0}`;
  if (key === quickShown) return;
  quickShown = key;
  if (game.quickItem) b.replaceChildren(itemIcon(game.quickItem), document.createTextNode(tr(`×${stack?.count ?? 0}`)));
  else b.replaceChildren(uiIcon("item"));
  b.classList.toggle("off", !stack);
}

/** Raccourci « Objet » sur une potion risquée : en attente du toucher qui confirme. */
let quickSure: string | null = null;
/** Utiliser le raccourci « Objet » : boire, manger, allumer, enduire ; la potion de feu se vise ensuite. */
function useQuickItem(): void {
  const stack = game.quickStack();
  if (!game.quickItem) {
    logLines.push("Aucun raccourci : dans le sac, restez appuyé sur une pomme, une torche ou une potion.");
    return;
  }
  const def = ITEMS[game.quickItem] as ItemDef;
  if (!stack) {
    logLines.push(`Plus de ${def.name.toLowerCase()} dans le sac.`);
    return;
  }
  if (game.tooLow(def)) {
    logLines.push(`Il faut être niveau ${def.level} pour cela.`);
    return;
  }
  // Potion risquée à boire (Thomas, 2026-11-14) : un deuxième toucher sur « Objet » confirme.
  if (def.drinkWarning && quickSure !== game.quickItem) {
    quickSure = game.quickItem;
    logLines.push(`Êtes-vous sûr ? ${tr(def.drinkWarning)} Touchez « Objet » encore une fois pour boire.`);
    return;
  }
  quickSure = null;
  if (def.bomb || def.holy || def.potion === "fire" || def.potion === "smoke" || def.potion === "fog" || def.potion === "discord" || def.potion === "slip") {
    throwUid = stack.uid;
    renderer.jumpCells = throwCells(stack.uid);
    logLines.push("Touchez la case où lancer la potion.");
    return;
  }
  if (game.useItem(stack.uid)) stepMs = COMBAT_STEP_MS;
  else logLines.push("Vous êtes déjà en pleine santé.");
}

// Noms courts sous les pictogrammes (barre d'actions, design C).
const WHEEL_SHORT: Record<string, string> = { "wheel-tourbillon": "Tourbillon", "wheel-charge": "Charge", "wheel-cri": "Cri", "wheel-bastion": "Bastion", "wheel-execution": "Exécuter", "wheel-search": "Fouiller", "wheel-push": "Pousser", "wheel-disengage": "Dégager", "wheel-rest": "Repos", "wheel-hide": "Cacher", "wheel-disarm": "Désarmer", "wheel-skill": "Voie" };
for (const [id, icon, label] of WHEEL) {
  $(id).replaceChildren(uiIcon(icon), el("span", "wheel-label", WHEEL_SHORT[id] ?? label));
  $(id).setAttribute("aria-label", tr(label));
  $(id).addEventListener("click", (ev) => {
    ev.stopPropagation();
    sfx.unlock();
    sfx.play("click");
    closeWheel();
    if (id in WHEEL_POWERS) {
      const pw = WHEEL_POWERS[id as keyof typeof WHEEL_POWERS];
      const refusal = game.powerRefusal(pw);
      if (refusal) logLines.push(pw === "charge" && refusal === "no-target" ? REFUSALS.chargeNoTarget : REFUSALS.power[refusal]);
      else if (game.usePower(pw)) stepMs = COMBAT_STEP_MS;
    } else if (id === "wheel-skill") {
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
    } else if (id === "wheel-disarm") {
      const refusal = game.disarmRefusal();
      const traps = game.disarmTargets();
      if (refusal) logLines.push(refusal === "none" ? "Aucun piège connu à côté de vous." : "Pas avec un ennemi au contact.");
      else if (traps.length === 1) {
        if (game.disarm(traps[0].x, traps[0].y)) stepMs = COMBAT_STEP_MS;
      } else {
        disarmMode = true;
        renderer.jumpCells = traps;
        logLines.push("Touchez le piège à désamorcer.");
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

/** Le menu du bouton Tir (Thomas, 2026-11-19 : « la flèche devrait avoir son menu aussi ») : toutes les munitions du
 *  sac ; celles qui ne partent pas avec ce qu'on porte (flèches sans arc, pierres sans lance-pierre) ou dont le niveau
 *  manque sont grisées. En choisir une la met au carquois et bande l'arc. */
function renderAmmoBar(): void {
  const family = game.weapon("ranged")?.ammo;
  const ids = (Object.keys(ITEMS) as ItemId[]).filter((id) => (ITEMS[id] as ItemDef).kind === "ammo" && (game.inventory.count(id) > 0 || game.endlessAmmo(id)));
  const current = game.currentAmmo();
  const bar = $("wheel-ammo");
  if (ids.length === 0) {
    bar.replaceChildren(el("span", "wheel-label", "Aucune munition dans le sac."));
    return;
  }
  bar.replaceChildren(
    ...ids.map((id) => {
      const def = ITEMS[id] as ItemDef;
      const fits = def.ammoFamily === "jet" || (!!family && def.ammoFamily === family);
      const why = !fits ? (def.ammoFamily === "pierre" ? "Il faut un lance-pierre." : "Il faut un arc.") : game.tooLow(def) ? `Il faut être niveau ${def.level}.` : null;
      const b = el("button", `${why ? "off" : ""}${id === current ? " chosen" : ""}`) as HTMLButtonElement;
      b.type = "button";
      const n = game.endlessAmmo(id) ? "∞" : `×${game.inventory.count(id)}`;
      b.append(itemIcon(id), el("span", "wheel-label", tr(n)));
      b.setAttribute("aria-label", tr(def.name));
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        sfx.unlock();
        sfx.play("click");
        closeWheel();
        if (why) logLines.push(`${tr(def.name)} : ${tr(why)}`);
        else {
          game.chooseAmmo(id);
          aimShown = "";
          if (game.isThreatened() && !closeThrowOk()) logLines.push(`Munition choisie : ${tr(def.name)}. Un ennemi est au contact : pas le temps de bander l'arc.`);
          else {
            aimMode = true;
            logLines.push(aimTarget() ? `${tr(def.name)} : touchez encore la flèche pour tirer, ou une autre case.` : `${tr(def.name)} : touchez une case pour tirer.`);
          }
        }
        renderLog();
      });
      return b;
    }),
  );
}
button("actions", () => (wheelOpen && wheelMode === "actions" ? closeWheel() : openWheel("actions")));
// CAPACITÉS : sans pouvoir du Rang II, un toucher lance directement le pouvoir principal (comme l'ancien bouton) ;
// sinon la barre des capacités s'ouvre.
button("skills", () => {
  if (wheelOpen && wheelMode === "skills") return closeWheel();
  if (ownedPowers().length > 0) return openWheel("skills");
  closeWheel();
  const refusal = game.skillRefusal();
  if (refusal) logLines.push(REFUSALS.skill[refusal]);
  else if (game.useSkill()) stepMs = COMBAT_STEP_MS;
  renderLog();
});
button("quick", () => {
  closeWheel();
  useQuickItem();
  renderLog();
});
// Toucher le dé : frapper au corps à corps l'ennemi au contact (demande de Thomas).
const diceBox = die.parentElement!.parentElement!;
diceBox.addEventListener("click", () => {
  if (menuOpen || bagOpen || foundOpen || shopOpen || talkOpen || wheelOpen || game.over) return;
  sfx.unlock();
  jumpMode = false;
  pushMode = false;
  disarmMode = false;
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

// ---------- Reprendre un trajet interrompu (Thomas, 2026-11-13) ----------
/** Le trajet en cours (une case de sol libre touchée de loin), et celui qu'on peut reprendre s'il a été coupé. */
let travel: { x: number; y: number; depth: number } | null = null;
let resumeTo: { x: number; y: number; depth: number } | null = null;
/** Un nouvel ordre au toucher : on retient la destination si c'est un vrai trajet vers une case libre. */
function noteTravel(x: number, y: number): void {
  resumeTo = null;
  const free = game.map.isWalkable(x, y) && !game.monsterAt(x, y) && !game.npcAt(x, y);
  travel = free && game.path.length > 1 ? { x, y, depth: game.depth } : null;
}
/** À chaque image : un trajet qui s'arrête avant sa case devient « à reprendre ». */
function watchTravel(): void {
  if (resumeTo && (resumeTo.depth !== game.depth || game.over || (game.hero.x === resumeTo.x && game.hero.y === resumeTo.y))) resumeTo = null;
  if (travel && !stepping && game.path.length === 0 && queue.length === 0) {
    const arrived = game.hero.x === travel.x && game.hero.y === travel.y;
    if (!arrived && travel.depth === game.depth && !game.over) resumeTo = travel;
    travel = null;
  }
  setHidden($("resume"), !resumeTo);
}
button("resume", () => {
  const to = resumeTo;
  if (!to) return;
  if (game.resumeTravel(to.x, to.y)) {
    stepMs = stepDuration(game.path.length);
    noteTravel(to.x, to.y);
  } else resumeTo = null;
});
/** Tire une flèche vers une case ; explique le refus s'il y en a un. Une flèche par visée. */
function fireAt(x: number, y: number): void {
  const refusal = game.shoot(x, y);
  if (refusal) {
    const why = {
      "no-bow": "Aucun arc en main.",
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
// Appui long sur le bouton de tir : passer à la munition suivante (Thomas, 2026-11-16), comme en touchant le carquois.
let aimHeld = false;
{
  let timer = 0;
  const stop = () => window.clearTimeout(timer);
  $("aim").addEventListener("pointerdown", () => {
    aimHeld = false;
    stop();
    timer = window.setTimeout(() => {
      aimHeld = true;
      // Appui long : le menu des munitions (il remplace le simple défilement).
      openWheel("ammo");
    }, LONG_PRESS_MS);
  });
  for (const name of ["pointerup", "pointerleave", "pointercancel"]) $("aim").addEventListener(name, stop);
  $("aim").addEventListener("contextmenu", (e) => e.preventDefault());
}
/** Au contact, on peut quand même lancer une javeline (pas d'arc à bander ; avec le désavantage), et l'Elfe tire
 *  (Thomas, 2026-11-18 : « pas le temps de bander l'arc avec les javelines »). */
function closeThrowOk(): boolean {
  const profile = game.shotProfile();
  return !!profile && (profile.thrown || !!game.race.closeShot);
}
button("aim", () => {
  // Le toucher qui termine un appui long ne tire pas.
  if (aimHeld) {
    aimHeld = false;
    return;
  }
  if (aimMode) {
    const target = aimTarget();
    if (target) fireAt(target.x, target.y);
    else aimMode = false; // personne à viser : le second appui range l'arc
  } else if (game.isThreatened() && !closeThrowOk()) {
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
/** La case où la languette a été fermée par la croix : elle ne revient qu'en remarchant sur la case (Thomas, 2026-11-13). */
let hereDismissed = "";
function renderHere(): void {
  const piles = started && !game.over ? game.itemsHere() : [];
  const cell = `${game.hero.x},${game.hero.y}`;
  if (hereDismissed && hereDismissed !== cell) hereDismissed = "";
  const top = hereDismissed ? undefined : piles[0];
  $("here").classList.toggle("open", !!top);
  // L'objet prend la place du journal dans le panneau tant qu'il est proposé.
  $("log").parentElement!.classList.toggle("picking", !!top);
  if (!top) return;
  const key = `${top.item}:${top.count}:${piles.length}`;
  if (key === hereKey) return;
  hereKey = key;
  const def: ItemDef = ITEMS[top.item];
  $("here-icon").replaceChildren(itemIcon(top.item));
  $("here-name").textContent = tr(`${def.name}${top.count > 1 ? ` ×${top.count}` : ""}${piles.length > 1 ? `  (1/${piles.length})` : ""}`);
  // S'équiper directement depuis le sol (Thomas, 2026-11-15) : seulement ce qui se porte ; grisé si le niveau manque.
  const equip = $("here-equip") as HTMLButtonElement;
  equip.hidden = !game.wearable(def);
  equip.disabled = game.tooLow(def);
}
button("here-take", () => {
  if (game.pickUp()) stepMs = COMBAT_STEP_MS;
});
button("here-equip", () => {
  if (game.pickUpAndEquip()) stepMs = COMBAT_STEP_MS;
});
button("here-close", () => {
  hereDismissed = `${game.hero.x},${game.hero.y}`;
  renderHere();
});
button("here-info", () => {
  const top = game.itemsHere()[0];
  if (!top) return;
  (document.querySelector("#found h2") as HTMLElement).textContent = tr("Au sol");
  $("found-card").replaceChildren(itemCard(ITEMS[top.item], top.count));
  $("found").hidden = false;
  foundOpen = true;
});
$("here-take").replaceChildren(uiIcon("take"));
$("here-take").setAttribute("aria-label", tr("Ramasser"));
$("here-info").setAttribute("aria-label", tr("Fiche de l'objet"));
$("here-equip").replaceChildren(uiIcon("equip"));
$("here-equip").setAttribute("aria-label", tr("S'équiper"));
$("here-close").setAttribute("aria-label", tr("Fermer"));

// Boutons sans texte : un pictogramme, et un nom lisible par les aides à la lecture.
for (const [id, icon, label] of [
  ["wait", "wait", "Attendre un tour"],
  ["actions", "actions", "Actions"],
  ["open-menu", "menu", "Menu"],
  ["recenter", "recenter", "Recentrer la vue"],
  ["resume", "resume", "Reprendre le trajet"],
  ["door-cancel", "cancel", "Ne rien faire"],
] as const) {
  $(id).replaceChildren(uiIcon(icon));
  $(id).setAttribute("aria-label", tr(label));
  $(id).title = tr(label);
}
$("aim").setAttribute("aria-label", tr("Tirer à l'arc"));
// Le bouton de l'écran du héros : sa tête, et un « ! » doré quand un point ou une compétence attend (demande de Thomas).
{
  const bang = el("span", "", "!");
  bang.id = "bag-bang";
  bang.hidden = true;
  $("open-bag").replaceChildren(buildIcon(HERO_HEAD, HERO_HEAD_PALETTE), bang);
  $("open-bag").setAttribute("aria-label", tr("Le héros : inventaire et personnage"));
  $("open-bag").title = tr("Le héros");
}
// L'étage, en haut à droite : l'escalier du jeu et son numéro (demande de Thomas).
// La dernière marche (le noir du fond) en gris foncé dans le picto du haut (Thomas, 2026-11-17 : « peu lisible »).
$("floor-icon").replaceChildren(buildIcon(ESCALIERS[STAIRS_STYLE].down, { ...ESCALIERS_PALETTE, I: "#3a3846", F: "#2a2632" }));

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
  dismissTip();
  shopOpen = true;
  shopTab = "buy";
  shopPick = null;
  shopNote = "";
  $("shop-line").textContent = tr(`« ${MERCHANT.lines[line] ?? MERCHANT.lines[0]} »`);
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
  $("shop-purse").textContent = tr(`Bourse : ${game.gold} or`);
  const list = $("shop-list");
  const detail = $("shop-detail");
  list.replaceChildren();
  detail.replaceChildren();
  list.className = shopTab === "buy" ? "shop-wares" : "shop-sell";
  if (shopTab === "buy") {
    if (m.wares.length === 0) list.append(el("div", "shop-empty", "Plus rien à vendre… mais je rachète."));
    m.wares.forEach((w, i) => {
      const card = el("button", `shop-ware${shopPick === i ? " picked" : ""}${game.gold < game.buyPrice(w.price) ? " dear" : ""}`) as HTMLButtonElement;
      card.type = "button";
      const icon = el("div", "shop-icon");
      icon.append(itemIcon(w.item));
      card.append(icon, namedWithRarity("shop-name", ITEMS[w.item] as ItemDef, `${ITEMS[w.item].name}${w.count > 1 ? ` ×${w.count}` : ""}`), el("div", "shop-price", game.buyPrice(w.price) === 0 ? "Gratuit (ticket)" : `${game.buyPrice(w.price)} or`));
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
      const buy = el("button", "shop-act", game.buyPrice(w.price) === 0 ? "Prendre (ticket)" : `Acheter (${game.buyPrice(w.price)} or)`) as HTMLButtonElement;
      buy.type = "button";
      buy.disabled = game.gold < game.buyPrice(w.price);
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
  smoke: ["#c3cbe0", "#7f88a6", "#e8ecf4"],
  // Toutes les potions éclatent de leur couleur (Thomas, 2026-11-13 : « vérifie l'éclatement sur toutes »).
  fog: ["#3a3a50", "#0c0a0e", "#5a5466"],
  urchin: ["#9a6a34", "#5a3817", "#b9824a"],
  stone: ["#a4abc8", "#7f88a6", "#d8dce8"],
  discord: ["#f08ab8", "#b04a7a", "#ffd0e4"],
  grow: ["#b48ce0", "#7a5aa0", "#e0ccf8"],
  slip: ["#b8e05a", "#5e8a2a", "#e8f4b0"],
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
  dismissTip();
  if (!game.canTalk(who)) return;
  talkWho = who;
  talkOpen = true;
  talkLast = null;
  talkSaid = 0;
  talkBusy = false;
  talkLater = [];
  $("talk").hidden = false;
  $("talk").scrollTop = 0;
  $("talk-name").textContent = tr(who === "gluck" ? "Gluck" : who === "soeur" ? "Sœur Osseuse" : who === "grum" ? "Grum" : who === "fifrelin" ? "Fifrelin" : who === "morillon" ? "Morillon" : who === "vernis" ? "Vernis" : who === "maestro" ? "Le Maestro" : who === "plumeau" ? "Plumeau" : who === "clavicule" ? "Sœur Clavicule" : who === "osselet" ? "Maître Osselet" : "Krik");
  $("talk-face").replaceChildren(
    who === "gluck"
      ? buildIcon(SCHRAT.idleDown[0], GLUCK_PALETTE)
      : who === "soeur"
        ? buildIcon(SOEUR_SPRITE[0], SOEUR_PALETTE)
        : who === "grum"
          ? buildIcon(FERMIER.rows, FERMIER.palette)
          : who === "fifrelin"
            ? buildIcon(SCHRAT.idleDown[0], FIFRELIN_PALETTE)
            : who === "morillon"
              ? buildIcon(MORILLON_FRAMES.idleDown0, MORILLON_PALETTE)
              : who === "vernis"
                ? buildIcon(EXPO.vernis.rows, EXPO.vernis.palette)
                : who === "maestro"
                  ? buildIcon(SCHRAT.idleDown[0], MAESTRO_PALETTE)
                  : who === "plumeau"
                    ? buildIcon(SECRET.plumeau0.rows, SECRET.plumeau0.palette)
                    : who === "clavicule"
                    ? buildIcon(CHAPELLE.clavicule0.rows, CHAPELLE.clavicule0.palette)
                    : who === "osselet"
                    ? buildIcon(MOBS_OSS.conservateur.frames.idleDown0, MOBS_OSS.conservateur.palette)
                    : buildIcon(SCHRAT.idleDown[0], KRIK_PALETTE),
  );
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
  $("talk-purse").textContent = tr(`Bourse : ${game.gold} or`);
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
/** Petits pictos de la comparaison (Thomas, 2026-11-19 : « plus court, avec un picto flèche rouge / vert ; et des
 *  pictos pour la vitesse et la portée »). */
const CMP_ICONS = {
  up: ["....K....", "...KEK...", "..KEEEK..", ".KEEEEEK.", "KKKEEEKKK", "..KEEEK..", "..KEEEK..", "..KKKKK.."],
  down: ["..KKKKK..", "..KRRRK..", "..KRRRK..", "KKKRRRKKK", ".KRRRRRK.", "..KRRRK..", "...KRK...", "....K...."],
  same: [".......", ".......", "KKKKKKK", "KSSSSSK", "KKKKKKK", "KSSSSSK", "KKKKKKK"],
  damage: ["......KK", ".....KWK", "....KWK.", ".K.KWK..", "..KWK...", "..KGK...", ".KGKK...", "KK......"],
  speed: ["...KKK..", "..KYYK..", "..KYK...", ".KYYYYK.", "...KYK..", "..KYK...", "..KK....", "........"],
  range: ["..KKKK..", ".KRWWRK.", "KRWRRWRK", "KWRYYRWK", "KWRYYRWK", "KRWRRWRK", ".KRWWRK.", "..KKKK.."],
  armor: ["KKKKKKKK", "KSSSSSDK", "KSSUUSDK", "KSUUUUDK", ".KSUUDK.", ".KSSSDK.", "..KSDK..", "...KK..."],
  hit: ["..KKKK..", ".KWWWWK.", "KWKKKKWK", "KWK..KWK", "KWKKKKWK", ".KWWWWK.", "..KKKK..", "........"],
} as const;

/**
 * Comparaison avec ce que le héros porte (Thomas, 2026-11-12 : « que le joueur sente vraiment la différence ») : une
 * pastille par chiffre, son picto (dégâts, vitesse, portée, armure, jet), une flèche verte (mieux), rouge (moins bien)
 * ou « = », et l'écart. Armes : dégâts moyens par tour contre un monstre ordinaire (CA 13).
 */
function compareNode(def: ItemDef): HTMLElement | null {
  const slot = def.kind === "melee" ? "melee" : def.kind === "armor" ? "armor" : def.kind === "hat" ? "hat" : def.kind === "ranged" ? "ranged" : null;
  if (!slot) return null;
  const worn = game.equipment[slot];
  if (worn && worn.defId === def.id) return null;
  const other = worn ? (ITEMS[worn.defId] as ItemDef) : undefined;
  const fmt = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1).replace(".", ",").replace(",0", "")}`;
  const chips: { icon: keyof typeof CMP_ICONS; delta: number; text: string }[] = [];
  if (slot === "melee") {
    const dpt = (d?: ItemDef) => (d?.damage ? expectedDamagePerTurn(d.attackBonus ?? 0, d.damage, d.speed, 13, RULES.slowAttackTurns, RULES.fastAttackTurns) : 0.6);
    const delta = Math.round((dpt(def) - dpt(other)) * 10) / 10;
    chips.push({ icon: "damage", delta, text: `${fmt(delta)} /tour` });
    const pace = (d?: ItemDef) => (d?.speed === "fast" ? 1 : d?.speed === "slow" ? -1 : 0);
    const dp = pace(def) - pace(other);
    if (dp !== 0) chips.push({ icon: "speed", delta: dp, text: dp > 0 ? "plus vite" : "plus lent" });
    const reach = (def.reach ?? 1) - (other?.reach ?? 1);
    if (reach !== 0) chips.push({ icon: "range", delta: reach, text: `${fmt(reach)} case${Math.abs(reach) > 1 ? "s" : ""}` });
  } else if (slot === "armor" || slot === "hat") {
    const delta = slot === "armor" ? (def.armorClass ?? UNARMORED_AC) - (other?.armorClass ?? UNARMORED_AC) : (def.acBonus ?? 0) - (other?.acBonus ?? 0);
    chips.push({ icon: "armor", delta, text: delta === 0 ? "même CA" : `${fmt(delta)} CA` });
  } else {
    const delta = (def.attackBonus ?? 0) - (other?.attackBonus ?? 0);
    const range = (def.range ?? 0) - (other?.range ?? 0);
    chips.push({ icon: "hit", delta, text: `${fmt(delta)} jet` });
    chips.push({ icon: "range", delta: range, text: `${fmt(range)} cases` });
  }
  const node = el("div", "item-compare");
  for (const c of chips) {
    const chip = el("span", `cmp-chip ${c.delta > 0 ? "up" : c.delta < 0 ? "down" : "same"}`);
    chip.append(buildIcon(CMP_ICONS[c.icon]), buildIcon(CMP_ICONS[c.delta > 0 ? "up" : c.delta < 0 ? "down" : "same"]), el("span", "", c.text));
    node.append(chip);
  }
  if (other) node.append(el("span", "cmp-vs", `vs ${other.name.toLowerCase()}`));
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
  if (def.stunOn) rows.push(["Assomme", `sur un ${def.stunOn} ou plus au dé`]);
  if (def.poison) rows.push(["Poison", `${def.poison.damage} / tour, ${def.poison.turns} tours`]);
  if (def.heal) rows.push(["Soin", `+${def.heal + game.race.foodBonus} PV`]);
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
  if (def.reach && def.reach > 1) bits.push(`allonge ${def.reach}`);
  if (def.stunOn) bits.push(`assomme sur ${def.stunOn}+`);
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
        const ghost = { amulet: uiIcon("amulet"), hat: uiIcon("helm"), artifact: uiIcon("artifact"), armor: itemIcon("tunique"), melee: itemIcon("epee"), ranged: itemIcon("arc_court"), bag: itemIcon("sac_toile") }[slot];
        ghost.classList.add("ghost");
        box.append(ghost);
      }
      node.append(box);
      node.title = tr(label);
      node.setAttribute("aria-label", tr(label));
      node.addEventListener("click", () => {
        sfx.play("click");
        // Double toucher sur un objet porté (Thomas, 2026-11-16) : il retourne au sac.
        if (worn && isDoubleTap(`slot-${slot}`)) {
          selected = { slot };
          ($("bag-equip") as HTMLButtonElement).click();
          return;
        }
        selected = worn && selectedSlot !== slot ? { slot } : null;
        renderHeroScreen();
      });
      return node;
    }),
  );

  // En haut : l'or de la bourse (les caractéristiques sont dans l'onglet Personnage).
  $("bag-gold").replaceChildren(itemIcon("or"), document.createTextNode(tr(String(game.gold))));

  // Le carquois, à côté du sac : la flèche qui partira et combien il en reste ; le toucher passe à l'autre sorte.
  const kinds = game.ammoKinds();
  const current = game.currentAmmo();
  const quiver = el("div", "slot slot-quiver");
  const qbox = el("div", "slot-box");
  if (current) {
    qbox.append(itemIcon(current), el("span", "slot-count", game.endlessAmmo(current) ? "∞" : String(game.inventory.count(current))));
  } else {
    const ghost = itemIcon("fleche");
    ghost.classList.add("ghost");
    qbox.append(ghost);
  }
  quiver.append(qbox);
  quiver.title = tr("Carquois : touchez pour changer de flèches");
  quiver.addEventListener("click", () => {
    sfx.play("click");
    const usable = kinds.filter((id) => !game.tooLow(ITEMS[id] as ItemDef));
    const locked = kinds.find((id) => game.tooLow(ITEMS[id] as ItemDef));
    if (usable.length > 1 && current) {
      game.chooseAmmo(usable[(usable.indexOf(current) + 1) % usable.length]);
      aimShown = "";
    } else if (locked) {
      // Le refus se lit sur la fiche des flèches (le journal est caché sous l'écran du héros).
      const stack = game.inventory.snapshot().items.find((i) => i.defId === locked);
      if (stack) selected = { uid: stack.uid };
      quickNote = `Il faut être niveau ${(ITEMS[locked] as ItemDef).level} pour tirer ${ITEMS[locked].name.toLowerCase()} (vous êtes niveau ${game.level}).`;
    }
    renderHeroScreen();
  });
  $("doll").append(quiver);

  // La torche, sous l'arc (Thomas, 2026-11-13) : son icône et une jauge qui descend ; la toucher l'éteint ou la rallume.
  const torch = el("div", `slot slot-torch${game.torchTurns > 0 ? "" : " empty"}${game.torchOff ? " off" : ""}`);
  const tbox = el("div", "slot-box");
  const ticon = itemIcon("torche");
  if (game.torchTurns <= 0) ticon.classList.add("ghost");
  tbox.append(ticon);
  if (game.torchTurns > 0) {
    const gauge = el("div", "torch-gauge");
    const fill = el("i", "");
    fill.style.width = `${Math.max(2, (100 * game.torchTurns) / ((ITEMS.torche as ItemDef).lightTurns ?? 300))}%`;
    gauge.append(fill);
    tbox.append(gauge);
  }
  torch.append(tbox);
  torch.title = tr(game.torchTurns > 0 ? (game.torchOff ? "Torche éteinte : touchez pour la rallumer" : "Torche : touchez pour l'éteindre") : "Torche : utilisez-en une depuis le sac");
  torch.addEventListener("click", () => {
    sfx.play("click");
    if (game.torchTurns <= 0) {
      logLines.push("Pas de torche : utilisez-en une depuis le sac.");
    } else if (game.toggleTorch()) {
      logLines.push(game.torchOff ? "Vous éteignez la torche." : "Vous rallumez la torche.");
      if (!game.torchOff) flarePending = true;
    }
    renderLog();
    renderHeroScreen();
  });
  $("doll").append(torch);

  // Le sac : grille de cases.
  const grid = $("bag-grid");
  grid.style.setProperty("--cols", String(bag.cols));
  grid.style.setProperty("--rows", String(bag.rows));
  // Filtres par sorte, dès le deuxième sac (Thomas, 2026-11-19).
  const withFilters = bag.cols * bag.rows > 24;
  if (!withFilters) bagFilter = "all";
  $("bag-filters").hidden = !withFilters;
  if (withFilters) {
    $("bag-filters").replaceChildren(
      ...BAG_FILTERS.map(([id, label]) => {
        const b = el("button", id === bagFilter ? "on" : "") as HTMLButtonElement;
        b.type = "button";
        b.textContent = tr(label);
        b.addEventListener("click", () => {
          sfx.play("click");
          bagFilter = bagFilter === id ? "all" : id;
          renderHeroScreen();
        });
        return b;
      }),
    );
  }
  grid.classList.toggle("filtered", bagFilter !== "all");
  if (bagFilter !== "all") {
    const shown = bag.items.filter((item) => bagSort(item.defId) === bagFilter);
    const cells = shown.reduce((n, item) => n + bag.def(item).w * bag.def(item).h, 0);
    grid.style.setProperty("--frows", String(Math.max(2, Math.ceil(cells / 6) + 1)));
    grid.replaceChildren(
      ...shown.map((item) => {
        const def = bag.def(item);
        const node = itemNode(item, `bag-item${item.uid === selectedUid ? " selected" : ""}${item.defId === game.quickItem ? " quick" : ""}`);
        if (game.tooLow(def)) node.append(el("span", "item-level", `Lv${def.level}`));
        node.dataset.uid = String(item.uid);
        // Chaque objet garde sa forme (une épée prend deux ou trois cases de haut), en grandes cases.
        node.style.gridColumn = `span ${Math.min(6, def.w)}`;
        node.style.gridRow = `span ${def.h}`;
        return node;
      }),
    );
    if (shown.length === 0) grid.append(el("div", "bag-empty", "Rien de cette sorte dans le sac."));
  } else grid.replaceChildren(
    ...bag.items.map((item) => {
      const def = bag.def(item);
      // Une clef d'un autre étage ne sert plus ici : elle reste dans le sac, grisée.
      const spent = ITEMS[item.defId].kind === "key" && item.floor !== game.depth;
      const node = itemNode(item, `bag-item${item.uid === selectedUid ? " selected" : ""}${spent ? " spent" : ""}${item.defId === game.quickItem ? " quick" : ""}`);
      if (game.tooLow(def)) node.append(el("span", "item-level", `Lv${def.level}`));
      node.style.left = `${(100 * item.x) / bag.cols}%`;
      node.style.top = `${(100 * item.y) / bag.rows}%`;
      node.style.width = `${(100 * def.w) / bag.cols}%`;
      node.style.height = `${(100 * def.h) / bag.rows}%`;
      return node;
    }),
  );

  showDropQty(false);
  hideSure();
  const info = $("bag-info");
  const action = $("bag-equip");
  const item = selectedUid !== null ? bag.get(selectedUid) : selectedSlot ? game.equipment[selectedSlot] : null;
  if (!item) {
    selected = null;
    info.replaceChildren(el("div", "", "Touchez un objet pour le choisir, puis une case libre pour le déplacer. Appui long sur une pomme, une torche ou une potion : raccourci « Objet »."));
    action.hidden = true;
    $("bag-drop").hidden = true;
    $("bag-throw").hidden = true;
    $("bag-art").hidden = true;
    return;
  }
  const def: ItemDef = ITEMS[item.defId];
  const keyNote = def.kind === "key" && item.floor !== undefined ? ` — étage ${item.floor}${item.floor !== game.depth ? ", ne sert plus ici" : ""}` : "";
  // Une fiche courte s'ouvre sous le sac (l'écran ne défile pas) ; la croix la referme (demande de Thomas).
  const card = miniCard(def, item.count, selectedSlot ? "porté" : keyNote.replace(/^ — /, ""));
  const close = el("button", "item-close", "×") as HTMLButtonElement;
  close.type = "button";
  close.setAttribute("aria-label", tr("Fermer la fiche"));
  close.addEventListener("click", () => {
    selected = null;
    renderHeroScreen();
  });
  card.prepend(close);
  if (quickNote) card.append(el("div", "quick-note", quickNote));
  else if (!selectedSlot && item.defId === game.quickItem) card.append(el("div", "quick-note", "Raccourci « Objet » de la barre d'actions."));
  quickNote = "";
  info.replaceChildren(card);
  const wearable = def.kind !== "ammo" && def.kind !== "key" && def.kind !== "gold" && def.kind !== "use" && def.kind !== "gem" && def.kind !== "quest";
  // Le sac porté ne s'enlève pas : on le remplace par un autre.
  // Les munitions s'« équipent » aussi : elles passent au carquois (Thomas, 2026-11-14).
  action.hidden = (!wearable && def.kind !== "use" && def.kind !== "ammo") || selectedSlot === "bag";
  // Potions (Thomas, 2026-11-12) : celle de feu se LANCE, celle de poison s'ENDUIT (et se lance aussi, bouton à part),
  // les autres se BOIVENT.
  action.textContent = selectedSlot
    ? "Retirer"
    : def.bomb || def.holy || def.potion === "fire" || def.potion === "smoke" || def.potion === "fog" || def.potion === "discord" || def.potion === "slip" ? "Lancer"
    : def.potion === "poison" ? "Enduire"
    : def.potion ? "Boire"
    : def.lightTurns ? "Utiliser"
    : def.kind === "use" ? "Consommer" : "Équiper";
  action.textContent = tr(action.textContent ?? "");
  // Toutes les potions se lancent (Thomas, 2026-11-14) : celles qu'on boit ont leur bouton « Lancer » à part.
  $("bag-throw").hidden = selectedSlot !== null || def.bomb || def.holy || ((!def.potion || ["fire", "smoke", "fog", "discord", "slip"].includes(def.potion)) && def.id !== "torche");
  // Jeter : tout objet du sac (pas ce qu'on porte).
  $("bag-drop").hidden = selectedSlot !== null;
  // Pinceau magique et diapason, portés en artefact (Thomas, 2026-11-18) : « Peindre », « Faire vibrer ».
  const art = $("bag-art") as HTMLButtonElement;
  art.hidden = selectedSlot !== "artifact" || (def.id !== "pinceau_magique" && def.id !== "diapason");
  art.textContent = tr(def.id === "diapason" ? "Faire vibrer" : "Peindre");
  art.disabled = game.artifactRefusal() !== null;
}
button("bag-art", () => {
  const refusal = game.artifactRefusal();
  if (refusal) {
    logLines.push(refusal === "used" ? "Déjà servi sur cet étage." : "Il faut le porter en artefact.");
    renderLog();
    return;
  }
  bagOpen = false;
  $("bag").hidden = true;
  selected = null;
  if (game.equipment.artifact?.defId === "diapason") {
    if (game.useDiapason()) stepMs = COMBAT_STEP_MS;
  } else {
    const cells = game.paintCells();
    if (cells.length === 0) logLines.push("Aucune case de couloir libre en vue, à 4 cases.");
    else {
      paintMode = true;
      renderer.jumpCells = cells;
      logLines.push("Touchez la case de couloir où peindre le faux mur.");
    }
  }
  renderLog();
});

// Appui long sur un objet du sac : il devient le raccourci « Objet » de la barre d'actions (Thomas, 2026-11-12).
// Rechoisir le même retire le raccourci. Ne prend pas de tour.
let pressTimer: number | null = null;
let pressStart: { x: number; y: number } | null = null;
let pressDone = false;
/** Filtres du sac : une sorte d'objet par bouton. */
const BAG_FILTERS = [
  ["all", "Tout"],
  ["arms", "Armes"],
  ["gear", "Tenue"],
  ["potions", "Potions"],
  ["food", "Vivres"],
  ["misc", "Divers"],
] as const;
type BagFilter = (typeof BAG_FILTERS)[number][0];
let bagFilter: BagFilter = "all";
function bagSort(id: ItemId): BagFilter {
  const def = ITEMS[id] as ItemDef;
  if (def.kind === "melee" || def.kind === "ranged" || def.kind === "ammo") return "arms";
  if (def.kind === "armor" || def.kind === "hat" || def.kind === "amulet" || def.kind === "artifact" || def.kind === "bag") return "gear";
  if (def.kind === "use") return def.potion || def.bomb || def.holy ? "potions" : "food";
  return "misc";
}
/** L'objet du sac sous le doigt (en vue filtrée : la case touchée). */
function bagHit(e: { clientX: number; clientY: number; target: EventTarget | null }) {
  if (bagFilter !== "all") {
    const node = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-uid]");
    return node ? game.inventory.get(Number(node.dataset.uid)) ?? null : null;
  }
  const cell = bagCellAt(e.clientX, e.clientY);
  return game.inventory.at(cell.x, cell.y);
}
function bagCellAt(clientX: number, clientY: number): { x: number; y: number } {
  const rect = $("bag-grid").getBoundingClientRect();
  const bag = game.inventory;
  return { x: Math.floor(((clientX - rect.left) / rect.width) * bag.cols), y: Math.floor(((clientY - rect.top) / rect.height) * bag.rows) };
}
function cancelPress(): void {
  if (pressTimer !== null) window.clearTimeout(pressTimer);
  pressTimer = null;
}
$("bag-grid").addEventListener("pointerdown", (e) => {
  pressDone = false;
  cancelPress();
  const hit = bagHit(e);
  if (!hit) return;
  pressStart = { x: e.clientX, y: e.clientY };
  pressTimer = window.setTimeout(() => {
    pressTimer = null;
    pressDone = true;
    const def = ITEMS[hit.defId] as ItemDef;
    if (!game.canQuick(hit.defId)) {
      quickNote = `${def.name} : pas de raccourci (seulement pomme, torche, potions).`;
      sfx.play("click");
    } else if (game.quickItem === hit.defId) {
      game.setQuickItem(null);
      quickNote = "Raccourci « Objet » retiré.";
      sfx.play("click");
    } else {
      game.setQuickItem(hit.defId);
      quickNote = `Raccourci « Objet » : ${def.name.toLowerCase()}.`;
      sfx.play("pickup");
      navigator.vibrate?.(30);
    }
    selected = { uid: hit.uid };
    renderHeroScreen();
  }, LONG_PRESS_MS);
});
/** Deux touchers sur la même chose en moins de 0,4 s. */
let lastTap = { key: "", at: 0 };
function isDoubleTap(key: string): boolean {
  const now = performance.now();
  const double = lastTap.key === key && now - lastTap.at < 400;
  lastTap = double ? { key: "", at: 0 } : { key, at: now };
  return double;
}
const WEARABLE_KINDS = new Set(["melee", "ranged", "armor", "hat", "amulet", "artifact", "bag"]);
$("bag-grid").addEventListener("pointermove", (e) => {
  if (pressStart && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 10) cancelPress();
});
for (const ev of ["pointerup", "pointercancel", "pointerleave"]) $("bag-grid").addEventListener(ev, cancelPress);
$("bag-grid").addEventListener("contextmenu", (e) => e.preventDefault());
$("bag-grid").addEventListener("click", (e) => {
  if (pressDone) {
    pressDone = false;
    return;
  }
  const grid = $("bag-grid");
  const rect = grid.getBoundingClientRect();
  const bag = game.inventory;
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * bag.cols);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * bag.rows);
  const hit = bagHit(e);
  const selectedUid = selected && "uid" in selected ? selected.uid : null;
  // Double toucher sur un équipement du sac (Thomas, 2026-11-16 : « double clic équipement ») : il est porté ; sur un
  // consommable (pomme, potion…), il est consommé (ou lancé, ou « Êtes-vous sûr ? », comme le bouton).
  // Munitions (flèches, javelines, pierres ; Thomas, 2026-11-18) : le double toucher les met au carquois.
  if (hit && isDoubleTap(`bag-${hit.uid}`) && (WEARABLE_KINDS.has(ITEMS[hit.defId].kind) || ITEMS[hit.defId].kind === "use" || ITEMS[hit.defId].kind === "ammo")) {
    selected = { uid: hit.uid };
    ($("bag-equip") as HTMLButtonElement).click();
    return;
  }
  if (hit) selected = hit.uid === selectedUid ? null : { uid: hit.uid };
  else if (selectedUid !== null && bagFilter === "all") bag.moveTo(selectedUid, x, y);
  sfx.play("click");
  renderHeroScreen();
});
// Lancer la potion de poison (son bouton à part ; « Enduire » est l'action principale).
button("bag-throw", () => {
  const chosen = selected && "uid" in selected ? game.inventory.get(selected.uid) : undefined;
  if (!chosen) return;
  throwUid = chosen.uid;
  renderer.jumpCells = throwCells(chosen.uid);
  logLines.push(chosen.defId === "torche" ? "Touchez la case où lancer la torche." : "Touchez la case où lancer la potion.");
  bagOpen = false;
  $("bag").hidden = true;
  selected = null;
  renderLog();
});
/** Jeter une pile : le choix du nombre (Thomas, 2026-11-13). */
let dropQty = 1;
function showDropQty(open: boolean): void {
  const item = selected && "uid" in selected ? game.inventory.get(selected.uid) : undefined;
  const show = open && !!item && item.count > 1;
  $("bag-qty").hidden = !show;
  $("bag-buttons").hidden = show;
  if (show) $("qty-n").textContent = `${dropQty} / ${item!.count}`;
}
function stepDropQty(to: number): void {
  const item = selected && "uid" in selected ? game.inventory.get(selected.uid) : undefined;
  if (!item) return showDropQty(false);
  dropQty = Math.max(1, Math.min(item.count, to));
  showDropQty(true);
}
button("qty-minus", () => stepDropQty(dropQty - 1));
button("qty-plus", () => stepDropQty(dropQty + 1));
button("qty-all", () => stepDropQty(Infinity));
button("qty-cancel", () => showDropQty(false));
button("qty-ok", () => {
  showDropQty(false);
  dropSelected(dropQty);
});
button("bag-drop", () => {
  const item = selected && "uid" in selected ? game.inventory.get(selected.uid) : undefined;
  if (item && item.count > 1) {
    dropQty = 1;
    showDropQty(true);
    return;
  }
  dropSelected();
});
function dropSelected(count?: number): void {
  if (selected && "uid" in selected) {
    const potion = !!(ITEMS[game.inventory.get(selected.uid)?.defId ?? "pomme"] as ItemDef).potion;
    if (game.dropFromBag(selected.uid, count)) {
      collectEvents();
      aimShown = "";
      // Une potion jetée se brise à vos pieds : on referme le sac pour la voir éclater (Thomas, 2026-11-14).
      if (potion) {
        bagOpen = false;
        $("bag").hidden = true;
      }
    }
  }
  selected = null;
  renderLog();
  renderHeroScreen();
}
var drinkSure = false; // « var » : lue par renderHeroScreen, qui peut tourner avant cette ligne.
function hideSure(): void {
  drinkSure = false;
  $("bag-sure").hidden = true;
}
button("sure-ok", () => {
  drinkSure = true;
  $("bag-sure").hidden = true;
  $("bag-buttons").hidden = false;
  ($("bag-equip") as HTMLButtonElement).click();
  drinkSure = false;
});
button("sure-cancel", () => {
  hideSure();
  $("bag-buttons").hidden = false;
});
// Ranger le sac (Thomas, 2026-11-15) : piles réunies, grands objets d'abord. Ne prend pas de tour.
button("bag-tidy", () => {
  if (game.inventory.tidy()) {
    selected = null;
    sfx.play("click");
  } else logLines.push("Impossible de mieux ranger le sac.");
  renderBag();
  renderLog();
});
button("bag-equip", () => {
  let keepUid: number | null = null;
  const chosen = selected && "uid" in selected ? game.inventory.get(selected.uid) : undefined;
  const chosenDef = chosen ? (ITEMS[chosen.defId] as ItemDef) : undefined;
  if (chosen && chosenDef && game.tooLow(chosenDef)) {
    // Le refus se lit sur la fiche (le journal est caché sous l'écran du héros).
    quickNote = `Il faut être niveau ${chosenDef.level} pour cela (vous êtes niveau ${game.level}).`;
    sfx.play("click");
    renderHeroScreen();
    return;
  } else if (chosen && chosenDef?.kind === "ammo") {
    // Équiper des flèches : elles deviennent celles du carquois.
    const fits = chosenDef.ammoFamily === "jet" || chosenDef.ammoFamily === game.weapon("ranged")?.ammo;
    game.chooseAmmo(chosen.defId);
    quickNote = fits ? `Au carquois : ${chosenDef.name.toLowerCase()}.` : "Au carquois, mais il vous faut un arc pour les tirer.";
    sfx.play("pickup");
    aimShown = "";
    renderHeroScreen();
    return;
  } else if (chosen && (chosenDef?.bomb || chosenDef?.holy || chosenDef?.potion === "fire" || chosenDef?.potion === "smoke" || chosenDef?.potion === "fog" || chosenDef?.potion === "discord" || chosenDef?.potion === "slip")) {
    // Lancer (potion de feu) : on referme le sac, puis on touche la case visée.
    throwUid = chosen.uid;
    renderer.jumpCells = throwCells(chosen.uid);
    logLines.push("Touchez la case où lancer la potion.");
    bagOpen = false;
    $("bag").hidden = true;
  } else if (chosen && chosenDef?.drinkWarning && !drinkSure) {
    // Potion risquée à boire (Thomas, 2026-11-14) : « Êtes-vous sûr ? », et pourquoi.
    $("sure-text").textContent = `${tr("Êtes-vous sûr ?")} ${tr(chosenDef.drinkWarning)}`;
    $("bag-sure").hidden = false;
    $("bag-buttons").hidden = true;
    return;
  } else if (chosen && chosenDef?.kind === "use") {
    drinkSure = false;
    // Utiliser prend un tour (Thomas, 2026-11-15 : « le menu ne devrait pas se fermer ») : le tour se joue aussitôt,
    // le sac reste ouvert, et l'objet reste choisi s'il en reste (on peut en reprendre un, un tour de plus).
    // EN COMBAT (Thomas, 2026-11-17 : « on ne peut pas enchaîner les consommables ») : un seul, puis le sac se
    // referme : on voit ce que font les monstres avant d'en reprendre un.
    const fighting = game.inCombat();
    if (game.useItem(chosen.uid)) {
      game.tick();
      if (game.inventory.get(chosen.uid) && !fighting) keepUid = chosen.uid;
      if (game.over || fighting) {
        bagOpen = false;
        $("bag").hidden = true;
      }
    } else logLines.push("Vous êtes déjà en pleine santé.");
  } else if (selected && "uid" in selected) {
    const bagSwap = chosenDef?.kind === "bag";
    if (!game.equip(selected.uid)) {
      logLines.push(
        bagSwap
            ? "Ce sac est trop petit pour tout ce que vous portez."
            : "Pas assez de place dans le sac pour échanger.",
      );
    }
  } else if (selected && "slot" in selected) {
    game.unequip(selected.slot);
  }
  collectEvents();
  selected = keepUid !== null ? { uid: keepUid } : null;
  aimShown = "";
  renderLog();
  renderHeroScreen();
});
// ---------- Bouton du pouvoir (voie bleue ou rouge) : picto de la voie et charges restantes, grisé sinon ----------
let powerShown = "";
const POWER_BUTTONS = { tourbillon: 1, charge: 1, cri_guerre: 1, bastion: 1, execution: 1 } as const;
function powerCharges(): number {
  if (game.voie === "blue") return Math.max(0, game.secondWindUses() - game.perks().secondWind);
  if (game.voie === "red") return game.perks().doubleStrikes;
  return 0;
}
/** Le bouton CAPACITÉS (couleur de la voie) : picto du pouvoir principal, une bille par charge qui reste sur l'étage
 *  (pouvoir principal et Rang II), grisé quand plus rien ne peut servir. */
function renderPower(): void {
  const b = $("skills");
  const main = game.over ? null : mainSkill();
  const owned = ownedPowers();
  const left = powerCharges() + owned.reduce((n, id) => n + game.powerUsesLeft(WHEEL_POWERS[id]), 0);
  const ready = !!main && (game.skillRefusal() === null || owned.some((id) => game.powerRefusal(WHEEL_POWERS[id]) === null));
  const key = `${main?.icon}|${left}|${ready}|${owned.length}`;
  if (key === powerShown) return;
  powerShown = key;
  b.hidden = !main;
  if (!main || !game.voie) return;
  document.body.style.setProperty("--voie", PATHS[game.voie].color);
  b.setAttribute("aria-label", tr("Capacités"));
  b.title = tr("Capacités");
  b.replaceChildren(buildIcon(SKILL_ICONS[main.icon]), pips(left));
  b.classList.toggle("off", !ready);
}

button("open-bag", () => {
  // Un objet consommé n'a pas encore fait son tour : le sac reste fermé jusque-là (Thomas, 2026-11-15 : on pouvait
  // en consommer un autre aussitôt).
  if (game.usePending()) return;
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
  if (game.inkBlind > 0) list.push({ id: "tache", name: "Taché", detail: "De l'encre dans les yeux : votre prochain tir aura le désavantage." });
  if (game.hero.stuck) list.push({ id: "ralenti", name: "Englué", detail: "Vous perdez votre prochain tour à vous dégager : ni frapper, ni bouger, ni manger." });
  if (game.torchLit()) list.push({ id: "torche", name: "Torche allumée", detail: `Vous éclairez autour de vous, mais on vous voit venir. Encore ${game.torchTurns} tours.` });
  if (game.weaponPoison > 0) list.push({ id: "arme_poison", name: "Arme empoisonnée", detail: `Vos coups qui portent empoisonnent. Encore ${game.weaponPoison} coups.` });
  if (game.blessTurns > 0) list.push({ id: "beni", name: "Béni", detail: `La pomme dorée de l'autel : +1 à l'attaque et +1 classe d'armure. Encore ${game.blessTurns} tours.` });
  if (game.protectTurns > 0) list.push({ id: "protection", name: "Protection", detail: `La bénédiction de Sœur Osseuse : +1 classe d'armure. Encore ${game.protectTurns} tours.` });
  if (game.clarityActive()) list.push({ id: "clarte", name: "Clarté", detail: "Le poison vous ronge deux fois moins longtemps, sur cet étage." });
  if (game.curseActive()) list.push({ id: "malediction", name: "Malédiction des Kobolds", detail: "+2 dégâts contre les Kobolds, sur cet étage." });
  if (game.luck > 0) list.push({ id: "chance", name: "Chance", detail: `Vos ${game.luck > 1 ? `${game.luck} prochains 1` : "prochain 1"} au dé ${game.luck > 1 ? "seront relancés" : "sera relancé"}.` });
  if (game.stoneTurns > 0) list.push({ id: "pierre", name: "Statue", detail: `Rien ne vous blesse, mais vous ne pouvez rien faire. Encore ${game.stoneTurns} tours.` });
  if (game.urchinTurns > 0) list.push({ id: "oursin", name: "Oursin", detail: `15 % des dégâts reçus au contact reviennent à l'attaquant. Encore ${game.urchinTurns} tours.` });
  if ((game.hero.grown ?? 0) > 0) list.push({ id: "geant", name: "Géant", detail: `Vos coups font deux fois plus mal, mais vous ne passez plus les portes. Encore ${game.hero.grown} tours.` });
  if (game.hasteTurns > 0) list.push({ id: "accelere", name: "Accéléré", detail: `Chaque attaque au contact frappe deux fois. Encore ${game.hasteTurns} tours.` });
  const rampart = game.rank("dernier_rempart");
  if (rampart > 0 && game.perks().lastStand < 1) {
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
/**
 * Ondes sonores autour de la cloche d'alerte quand le palier change (Thomas, 2026-11-12 : « génère des ondes sonores
 * pour attirer l'attention sur le picto ») : trois anneaux de la couleur du palier s'élargissent depuis la cloche,
 * qui se balance.
 */
function alarmWaves(stage: number): void {
  const badge = $("alarm-badge");
  if (badge.style.visibility === "hidden") return;
  const r = $("alarm-bell").getBoundingClientRect();
  const color = BELL_COLORS[stage]?.L ?? "#ffd75e";
  for (let i = 0; i < 3; i++) {
    const w = document.createElement("div");
    w.className = "alarm-wave";
    w.style.left = `${r.left + r.width / 2}px`;
    w.style.top = `${r.top + r.height / 2}px`;
    w.style.borderColor = color;
    w.style.animationDelay = `${i * 160}ms`;
    document.body.append(w);
    w.addEventListener("animationend", () => w.remove());
  }
  pulse($("alarm-bell"), "ring");
}

/**
 * L'alerte redescend (Thomas, 2026-11-12 : « quand le niveau baisse, des billes qui tombent, de la couleur du tocsin ») :
 * des billes de la couleur du palier quittent le morceau de jauge perdu et tombent ; la cloche se balance doucement.
 * Aussi en changeant d'étage vers un étage plus calme.
 */
let alarmBefore: { level: number; stage: number } | null = null;
function alarmDrops(fromLevel: number, toLevel: number, stage: number): void {
  const bar = $("alarm-fill").parentElement!.getBoundingClientRect();
  const color = BELL_COLORS[stage]?.L ?? "#ffd75e";
  const count = Math.max(3, Math.min(9, Math.round((fromLevel - toLevel) / 4)));
  const from = bar.left + (bar.width * toLevel) / 100;
  const to = bar.left + (bar.width * fromLevel) / 100;
  for (let i = 0; i < count; i++) {
    const orb = document.createElement("div");
    orb.className = "alarm-orb";
    orb.style.background = color;
    orb.style.color = color;
    const sx = from + (to - from) * Math.random();
    orb.style.left = `${sx}px`;
    orb.style.top = `${bar.top + bar.height / 2}px`;
    document.body.append(orb);
    const drift = (Math.random() - 0.5) * 30;
    orb.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${drift * 0.4}px, -7px) scale(1)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${drift}px, ${55 + Math.random() * 40}px) scale(0.6)`, opacity: 0 },
      ],
      { duration: 750 + Math.random() * 250, delay: i * 50, easing: "cubic-bezier(.4,0,.9,.6)", fill: "forwards" },
    ).onfinish = () => orb.remove();
  }
}

let alarmShown = "";
function renderAlarm(): void {
  const { level, stage } = game.alarm();
  const off = game.alarmOff();
  const key = `${level}|${stage}|${off}`;
  if (key === alarmShown) return;
  alarmShown = key;
  const before = alarmBefore;
  alarmBefore = { level, stage };
  if (before && level < before.level && !off && started) {
    alarmDrops(before.level, level, before.stage);
    if (stage < before.stage) pulse($("alarm-bell"), "ring");
  }
  // Étage du boss : la cloche d'alerte disparaît du haut de l'écran (et le bouton « + Alerte » de la salle d'essai).
  $("alarm-badge").style.visibility = off ? "hidden" : "";
  $("alarm-up").hidden = off;
  $("alarm-down").hidden = off;
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
  const key = list.map((st) => `${st.id}:${st.detail}`).join("|") + `#${game.torchTurns}#${statusOpen}#${statusOpen === "tocsin" ? game.alarm().level : ""}`;
  if (key === statusShown) return;
  statusShown = key;
  $("hero-status").replaceChildren(
    ...list.map((st) => {
      const b = el("button", "", "") as HTMLButtonElement;
      b.type = "button";
      b.setAttribute("aria-label", tr(st.name));
      b.append(buildIcon(STATUS_ICONS[st.id]));
      // Torche (Thomas, 2026-11-16) : une mini jauge de ce qu'il lui reste à brûler.
      if (st.id === "torche") {
        const full = (ITEMS.torche as ItemDef).lightTurns ?? 300;
        const left = Math.max(0, Math.min(1, game.torchTurns / full));
        const gauge = el("span", left < 0.2 ? "st-gauge low" : "st-gauge");
        const bar = el("i", "");
        bar.style.width = `${Math.round(left * 100)}%`;
        gauge.append(bar);
        b.append(gauge);
      }
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
    pop.replaceChildren(el("b", "", open.name), document.createTextNode(tr(open.detail)));
  }
}
$("status-pop").addEventListener("click", () => {
  statusOpen = null;
  statusShown = "";
});
// Toucher ailleurs referme le détail d'un statut ou de la cloche d'alerte (Thomas, 2026-11-12).
window.addEventListener(
  "pointerdown",
  (ev) => {
    if (statusOpen === null) return;
    const t = ev.target as Node | null;
    if (t && ["status-pop", "alarm-badge", "hero-status"].some((id) => $(id).contains(t))) return;
    statusOpen = null;
    statusShown = "";
  },
  true,
);

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
  // Vie et expérience en haut de l'écran du héros (Thomas, 2026-11-19).
  $("menu-hp-fill").style.width = `${(100 * Math.max(0, game.hero.hp)) / game.hero.maxHp}%`;
  $("menu-hp-label").textContent = tr(`PV ${game.hero.hp}/${game.hero.maxHp}`);
  const xpNeed = game.xpToNext();
  const top = game.xpBlocked();
  $("menu-xp-fill").style.width = top ? "100%" : `${(100 * game.xp) / Math.max(1, xpNeed)}%`;
  $("menu-xp-label").textContent = tr(top ? `Niv ${game.level} · MAX` : `Niv ${game.level} · XP ${game.xp}/${xpNeed}`);
  if (heroTab === "inv") renderBag();
  else renderCharacter();
}

function renderCharacter(): void {
  const head = heroHeadIcon();
  const who = el("span", "char-head");
  who.append(head, document.createTextNode(tr(`${game.heroClass.name} · Niv ${game.level}`)));
  $("char-who").replaceChildren(who);
  $("char-xp").textContent = tr(`XP ${game.xp}/${game.xpToNext()}`);
  // Le ruban reste toujours là (Thomas, 2026-11-13) : points de caractéristique et de compétence à attribuer, 0 compris.
  const pathLeft = game.voie ? game.pathPoints() : 0;
  const ribbon = $("char-points");
  ribbon.replaceChildren(
    el("div", "", `Points à attribuer : ${game.points}`),
    el("div", "", `Compétences à attribuer : ${pathLeft}`),
    ...(game.inCombat() && game.points + pathLeft > 0 ? [el("div", "char-points-note", "Pas en combat")] : []),
  );
  ribbon.classList.toggle("idle", game.points + pathLeft === 0);

  // Caractéristiques sur deux colonnes (l'écran tient sans défiler).
  const row = (name: string, value: string, stat?: StatId, wide = false) => {
    const node = el("div", `r${wide ? " wide" : ""}`);
    node.append(el("span", "", name), el("b", "", value));
    if (stat && game.points > 0) {
      const plus = el("button", "plus") as HTMLButtonElement;
      plus.type = "button";
      plus.append(plusIcon());
      plus.setAttribute("aria-label", tr(`Un point en ${name}`));
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
    row("Charisme", signedBonus(game.charisma()), "charisme"),
    row("Fouille", signedBonus(c.searchBonus)),
    row("Discrétion", signedBonus(game.stealthBonus())),
    row("Attaque", signedBonus(game.hero.attackBonus)),
    row("Classe d'armure", String(game.hero.armorClass), undefined, true),
  );
  $("char-stats").replaceChildren(grid);

  // VOIE : la choisir (niveau 2, définitif), ou la voie prise. POUVOIRS : les compétences de la voie.
  const pathCards: HTMLElement[] = [];
  const powerCards: HTMLElement[] = [];
  let tier2Cards: HTMLElement[] = [];
  let tier3Cards: HTMLElement[] = [];
  const confirm = $("char-confirm") as HTMLButtonElement;
  let note = "";
  if (!game.voie) {
    for (const path of Object.values(PATHS)) {
      const picked = pickedChoice?.kind === "path" && pickedChoice.id === path.id;
      const card = el("div", `skill-card${picked ? " picked" : ""}${game.canChoosePath() ? "" : " locked"}`);
      card.append(buildIcon(PATH_ICONS[path.id]), el("b", "", path.name), document.createTextNode(tr(path.description)));
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
      const top = game.maxRank(pw.id);
      const why = game.improveRefusal(pw.id);
      const card = el("div", `skill-card${main ? " main" : ""}${r > 0 ? " owned" : ""}${why === "locked" && r === 0 ? " locked" : ""}`);
      const body = el("div", "");
      const now = r > 0 ? pw.ranks[r - 1] : "";
      // Rang I gelé dès le niveau 6, Rang II ouvert au niveau 6 (Thomas, 2026-11-17).
      const next =
        r >= top ? "Rang maximal"
        : why === "frozen" ? (game.voie && PATHS[game.voie].tier2.some((t) => t.id === pw.id) ? "Rang II terminé" : "Rang I terminé")
        : why === "locked" ? `Au niveau ${game.voie && (PATHS[game.voie].tier3.some((t) => t.id === pw.id) || (main && r >= 4)) ? TIER3_LEVEL : TIER2_LEVEL} : ${pw.ranks[r]}`
        : `Rang ${r + 1} : ${pw.ranks[r]}`;
      // Nom, puis une rangée : les billes de rang (pleines jusqu'au rang atteint) et, à droite, le petit « + ».
      const pips = el("div", "rank-pips");
      for (let k = 0; k < top; k++) pips.append(rankPip(k < r));
      // Le picto de la capacité, et ACTIVE (un bouton, des charges) ou PASSIVE (toujours là) (Thomas, 2026-11-19).
      const active = main || pw.id in POWER_BUTTONS;
      if (pw.id in SKILL_ICONS) {
        const pic = el("div", `skill-pic ${active ? "active" : "passive"}`);
        pic.append(buildIcon(SKILL_ICONS[pw.id as SkillIconId]));
        card.append(pic);
      }
      body.append(el("b", "", pw.name), el("div", "skill-kind", active ? "Active" : "Passive"), pips);
      if (now) body.append(el("div", "rank-now", now));
      body.append(el("div", "rank-next", next));
      if (main) {
        const uses = game.voie === "blue" ? ` (${powerCharges()} à cet étage)` : ` (${game.perks().doubleStrikes} à cet étage)`;
        body.append(el("div", "rank-next", `Bouton Capacités${uses}`));
      }
      card.append(body);
      if (points > 0 && why === null) {
        const plus = el("button", "plus rank-plus") as HTMLButtonElement;
        plus.type = "button";
        plus.setAttribute("aria-label", tr(`Améliorer ${pw.name}`));
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
    tier2Cards = path.tier2.map((pw) => powerCard(pw, false));
    // Rang III (niveau 11) : montré dès que le Rang II est ouvert.
    tier3Cards = game.tier2Open() ? path.tier3.map((pw) => powerCard(pw, false)) : [];
    if (points > 0) note = `${points} point${points > 1 ? "s" : ""} de voie à placer${game.inCombat() ? " (pas en combat)" : ""}`;
  }
  $("char-path").replaceChildren(...pathCards);
  $("char-path").classList.toggle("choose", !game.voie);
  $("char-skills").replaceChildren(...powerCards);
  $("char-tier2").replaceChildren(...tier2Cards);
  $("char-tier2").hidden = $("char-tier2-title").hidden = tier2Cards.length === 0;
  $("char-tier3").replaceChildren(...tier3Cards);
  $("char-tier3").hidden = $("char-tier3-title").hidden = tier3Cards.length === 0;
  $("char-note").textContent = tr(note);
  confirm.hidden = pickedChoice === null;
  confirm.textContent = tr("Choisir cette voie (définitif)");
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

// ---------- Encyclopédie : objets et créatures (seulement ce qu'on a déjà rencontré), et le manuel ----------
// Les lieux (salles, décor, passages) ne sont plus dans le jeu : ils sont décrits dans `claude/LIEUX.md` du Projet.

type CodexTab = "objets" | "creatures" | "manuel";
let codexTab: CodexTab = "objets";

/** Une fiche d'encyclopédie sans objet : un pictogramme de couleur, un nom, un genre, une description. */
function codexCard(shape: "diamond" | "square", color: string, name: string, kind: string, description: string, art?: SVGSVGElement | null): HTMLElement {
  const card = el("div", "item-card");
  const picture = el("div", "item-card-icon");
  if (art) {
    art.classList.add("codex-portrait");
    picture.append(art);
    const body = el("div", "item-card-body");
    body.append(el("div", "item-card-name", name), el("div", "item-card-kind", kind), el("div", "item-card-desc", description));
    card.append(picture, body);
    return card;
  }
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
    const groups = CODEX_ITEM_GROUPS;
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
      const cards = members.filter((m) => codex.has(`m:${m.id}`)).map((m) => codexCard("diamond", m.color, m.name, m.boss ? "Boss" : "Créature", m.description, portrait(`m:${m.id}`)));
      section(`Famille : ${family}`, members.length, cards);
    }
    // Les personnages (non hostiles), découverts en les voyant.
    const people = CODEX_PEOPLE.filter((p) => codex.has(`n:${p.id}`)).map((p) => codexCard("square", p.color, p.name, "Personnage", p.description, portrait(`n:${p.id}`)));
    section("Personnages", CODEX_PEOPLE.length, people);
  } else {
    nodes.push(...manualNodes());
    // Pièges et états : toujours lisibles (ils servent à comprendre ce qui arrive).
    nodes.push(el("h3", "", "Pièges"));
    for (const [kind, text] of Object.entries(CODEX_TRAPS)) {
      const name = TRAPS[kind as keyof typeof TRAPS].name;
      nodes.push(codexCard("square", "#8a7656", name.charAt(0).toUpperCase() + name.slice(1), "Piège", text));
    }
    nodes.push(el("h3", "", "États"));
    for (const st of CODEX_STATES) {
      const card = el("div", "item-card");
      const picture = el("div", "item-card-icon");
      const icon = STATUS_ICONS[st.id as keyof typeof STATUS_ICONS];
      if (icon) picture.append(buildIcon(icon));
      const body = el("div", "item-card-body");
      body.append(el("div", "item-card-name", st.name), el("div", "item-card-kind", "État"), el("div", "item-card-desc", st.description));
      card.append(picture, body);
      nodes.push(card);
    }
  }
  $("codex-list").replaceChildren(...nodes);
  $("codex-tabs").replaceChildren(
    ...([["objets", "Objets"], ["creatures", "Créatures"], ["manuel", "Manuel"]] as const).map(([tab, label]) => {
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
  // Personnages : les PNJ de quête, le Colporteur, le Kobold du bain (dans sa baignoire), le Kobold qui compte.
  for (const id of NPC_IDS) {
    const g = game.npc(id);
    if (g && game.isVisible(g.x, g.y)) found.push(`n:${id}`);
  }
  const shop = game.merchant();
  if (shop && game.isVisible(shop.x, shop.y)) found.push("n:colporteur");
  const tub = game.bath();
  if (tub && game.isVisible(tub.x, tub.y)) found.push("n:bain");
  if (game.chickens().some((hen) => !hen.done && game.isVisible(hen.x, hen.y))) found.push("n:poulet");
  discover(found);
}

type Screen = "main" | "new" | "settings" | "codex" | "saves" | "succes" | "pause" | "essai" | "more";

function showScreen(screen: Screen | null): void {
  menuOpen = screen !== null;
  menu.hidden = !menuOpen;
  // Chaque écran du menu s'ouvre en haut (le mur de succès défile).
  menu.scrollTop = 0;
  for (const name of ["main", "new", "settings", "codex", "saves", "succes", "pause", "essai", "more"] as const) $(`screen-${name}`).hidden = screen !== name;
  $("detail").hidden = true;
  // « Reprendre » : la partie en cours, ou, après avoir rouvert le jeu, la dernière partie sauvegardée.
  // Toujours là (Thomas, 2026-11-15) ; grisé seulement s'il n'y a aucune partie à reprendre.
  if ((!started || game.over) && savedRun === null) savedRun = readSave();
  $("menu-resume").hidden = false;
  ($("menu-resume") as HTMLButtonElement).disabled = (!started || game.over) && savedRun === null;
  if (screen === "settings") showSettingsPane(settingsPane);
  $("settings-blood").textContent = tr(`Sang : ${options.blood ? "oui" : "non"}`);
  // Statistiques anonymes : le réglage n'apparaît que lorsque l'adresse d'envoi est réglée.
  $("settings-stats").hidden = !TELEMETRY.url;
  $("settings-stats").textContent = tr(`Statistiques : ${stats.consent() === "yes" ? "oui" : "non"}`);
  // Code joueur : seulement si le joueur a accepté les statistiques (sinon rien n'est envoyé, le code ne sert à rien).
  $("settings-code").hidden = !stats.enabled();
  if (stats.enabled()) $("settings-code").textContent = tr(`Code joueur : ${stats.code()}`);
  $("settings-lang").textContent = tr(`Langue : ${options.lang === "en" ? "English" : "Français"}`);
  if (screen === "new") renderCards();
  if (screen === "codex") renderCodex();
  if (screen === "saves") renderSaves();
  if (screen === "succes") showSuccesTab(succesTab);
}

interface Card {
  /** Une race : sa fiche « + » a sa propre mise en page (stats, capacités, inventaire bonus). */
  race?: RaceDef;
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
    race: r,
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
      ...r.traits,
    ],
  };
}

function classCard(c: ClassDef): Card {
  // Les statistiques d'attaque sont celles des armes de départ, pas de la classe (le Halfelin en change certaines).
  const gear = c.startingItems.map((g) => ({ def: ITEMS[chosenRace.swapItems?.[g.item] ?? g.item] as ItemDef, count: g.count }));
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
  title.textContent = tr(rarity in RARITY_LABELS ? RARITY_LABELS[rarity as keyof typeof RARITY_LABELS] : rarity === "epic" ? "Épique" : "Légendaire");
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
  node.append(document.createTextNode(tr(text)));
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
  node.textContent = tr(text);
  return node;
}

function buildCards(container: HTMLElement, cards: Card[], selectedId: string, onSelect: (id: string) => void): void {
  container.replaceChildren(
    ...cards.map((card) => {
      const node = el("div", `card${card.available ? "" : " locked"}${card.id === selectedId ? " selected" : ""}`);
      const more = el("button", "more");
      more.append(plusIcon());
      more.setAttribute("aria-label", tr(`Détail : ${card.name}`));
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
    // L'équipement de la classe dépend de la race (le Halfelin) : les cartes de classe se refont.
    buildCards($("class-cards"), Object.values(CLASSES).map(classCard), chosenClass.id, (cid) => {
      chosenClass = CLASSES[cid as keyof typeof CLASSES];
    });
  });
  buildCards($("class-cards"), Object.values(CLASSES).map(classCard), chosenClass.id, (id) => {
    chosenClass = CLASSES[id as keyof typeof CLASSES];
  });
}

function showDetail(card: Card): void {
  $("detail-title").textContent = tr(card.name);
  $("detail-body").classList.toggle("race-sheet", !!card.race);
  if (card.race) {
    $("detail-body").replaceChildren(...raceSheet(card.race));
  } else {
    const lines = card.available ? card.details : [...card.details, "Pas encore jouable : valeurs provisoires."];
    $("detail-body").replaceChildren(...lines.map((line) => el("div", "", line)));
  }
  $("detail").hidden = false;
}

/**
 * Fiche d'une race (Thomas, 2026-11-16 : « les stats en haut ; en bas les capacités spéciales, un picto par capacité avec
 * la couleur de leur race ; en bas l'inventaire bonus »).
 */
function raceSheet(r: RaceDef): HTMLElement[] {
  const color = PICTOS[r.id]?.palette.F ?? "#e0b040";
  const head = el("div", "race-head");
  const picto = PICTOS[r.id];
  if (picto) {
    const icon = buildIcon(picto.rows, picto.palette);
    icon.classList.add("race-picto");
    head.append(icon);
  }
  head.append(el("div", "race-tagline", r.tagline));
  // Les stats : les PV sont ceux de la classe choisie, plus ceux de la race.
  const stat = (label: string, value: string, tone: number): HTMLElement => {
    const cell = el("div", `race-stat${tone > 0 ? " up" : tone < 0 ? " down" : ""}`);
    cell.append(el("span", "race-stat-name", label), el("span", "race-stat-value", value));
    return cell;
  };
  const stats = el("div", "race-stats");
  stats.append(
    stat("Vie", String(chosenClass.hp + r.hpBonus), r.hpBonus),
    stat("Vue", `${r.darkVision} / ${r.sight}`, r.darkVision - 4),
    stat("Force", signedBonus(r.force), r.force),
    stat("Agilité", signedBonus(r.agilite), r.agilite),
    stat("Charisme", signedBonus(r.charisme), r.charisme),
    stat("Discrétion", signedBonus(r.stealthBonus), r.stealthBonus),
  );
  if (r.pushBonus) stats.append(stat("Pousser", signedBonus(r.pushBonus), r.pushBonus));
  const abilities = el("div", "race-abilities");
  for (const a of r.abilities) {
    const row = el("div", "race-ability");
    const rows = RACE_PICTOS[a.id];
    if (rows) {
      const icon = buildIcon(rows, { X: color });
      icon.classList.add("race-ability-picto");
      row.append(icon);
    }
    const text = el("div", "race-ability-text");
    const name = el("div", "race-ability-name", a.name);
    name.style.color = color;
    text.append(name, el("div", "", a.text));
    row.append(text);
    abilities.append(row);
  }
  const items = el("div", "race-items");
  // Ce que la race change dans l'équipement de la classe (le Halfelin : serpe, lance-pierre, pierres), puis ses bonus.
  const swapped = chosenClass.startingItems.filter((g) => r.swapItems?.[g.item]).map((g) => ({ item: r.swapItems![g.item]!, count: g.count }));
  for (const it of [...swapped, ...r.startingItems]) {
    const box = el("div", "race-item");
    box.append(itemIcon(it.item), el("span", "", `${tr(ITEMS[it.item].name)}${it.count > 1 ? ` ×${it.count}` : ""}`));
    items.append(box);
  }
  return [head, el("h3", "", "Statistiques"), stats, el("h3", "", "Capacités spéciales"), abilities, el("h3", "", "Inventaire bonus"), items];
}

// Le menu en jeu, allégé (Thomas, 2026-11-14) : reprendre, réglages, menu principal.
button("open-menu", () => showScreen(started && !game.over ? "pause" : "main"));
button("pause-resume", () => showScreen(null));
button("pause-settings", () => {
  settingsFrom = "pause";
  settingsPane = "general";
  showScreen("settings");
});
button("pause-main", () => showScreen("main"));
button("menu-resume", () => {
  if ((!started || game.over) && savedRun) {
    currentSlot = savedSlot;
    resumeRun(savedRun);
    savedRun = null;
  }
  showScreen(null);
});
button("menu-new", () => showScreen("new"));
/** D'où l'on est venu aux réglages : le menu en jeu ou le menu principal (le bouton Retour y revient). */
let settingsFrom: "main" | "pause" = "main";
let settingsPane: "general" | "son" | "lang" = "general";
button("menu-settings", () => {
  settingsFrom = "main";
  settingsPane = "general";
  $("settings-note").textContent = tr("");
  showScreen("settings");
});
button("menu-codex", () => showScreen("codex"));
// « En savoir plus » (Thomas, 2026-11-13 ; la page de soutien n'a pas encore d'adresse : 2026-11-18).
button("menu-more", () => showScreen("more"));
button("more-back", () => showScreen("main"));
// Succès et records fusionnés (Thomas, 2026-11-14) : un écran « Succès », deux onglets.
let succesTab: "succes" | "records" = "succes";
function showSuccesTab(tab: "succes" | "records"): void {
  succesTab = tab;
  $("tab-succes").classList.toggle("active", tab === "succes");
  $("tab-records").classList.toggle("active", tab === "records");
  $("pane-succes").hidden = tab !== "succes";
  $("records-list").hidden = tab !== "records";
  // La page de la race de la partie en cours (une page par race, Thomas 2026-11-16).
  const racePage = (["humain", "halfelin", "elfe"] as const).find((r) => r === game?.race.id);
  if (tab === "succes") renderWall($("succes-grid"), $("succes-detail"), $("succes-tally"), racePage);
  else renderRecords();
}
button("menu-succes", () => showScreen("succes"));
button("tab-succes", () => showSuccesTab("succes"));
button("tab-records", () => showSuccesTab("records"));
button("succes-back", () => showScreen("main"));
// Toucher le bandeau de quête : l'objectif en entier au journal (le bandeau peut être coupé).
button("quest-banner", () => {
  const q = game.questLine();
  if (q) {
    logLines.push(q.text);
    renderLog();
  }
});
button("menu-saves", () => showScreen("saves"));
button("saves-back", () => showScreen("main"));
button("codex-back", () => showScreen("main"));
button("new-back", () => showScreen("main"));
// « Retour » : d'un sous-menu (Son, Langue) vers les Paramètres, puis vers le menu d'où l'on vient.
button("settings-back", () => (settingsPane === "general" ? showScreen(settingsFrom) : showSettingsPane("general")));
button("detail-close", () => {
  $("detail").hidden = true;
});
button("new-start", () => {
  newRun();
  started = true;
  showScreen(null);
  showIntro(introLines(game.race.id));
});

/** Le synopsis (Thomas, 2026-11-13), au début de chaque nouvelle partie : une ligne toutes les 0,7 s (« accélère »). */
const INTRO_STEP_S = 0.7;
function showIntro(lines: string[] = INTRO_LINES): void {
  const box = $("intro");
  box.classList.remove("all");
  $("intro-lines").replaceChildren(
    ...lines.map((line, i) => {
      const p = el("p", "", line);
      p.style.animationDelay = `${0.2 + i * INTRO_STEP_S}s`;
      return p;
    }),
  );
  $("intro-go").style.animationDelay = `${0.2 + lines.length * INTRO_STEP_S}s`;
  box.hidden = false;
}
// Toucher l'écran : tout le texte d'un coup ; le bouton (une fois visible) lance la partie.
$("intro").addEventListener("click", () => $("intro").classList.add("all"));
button("intro-go", () => {
  $("intro").hidden = true;
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
  $("peace").textContent = tr(game.peaceful ? "Combats : non" : "Combats : oui");
  logLines.push(game.peaceful ? "Combats coupés : les monstres sont retirés." : "Combats rétablis : les monstres reviennent.");
  renderLog();
});
button("alarm-up", () => {
  game.raiseAlarm(25);
  collectEvents();
});
button("alarm-down", () => {
  game.lowerAlarm(25);
  collectEvents();
});
button("level-up", () => {
  game.levelUpNow();
  collectEvents();
});
// Salle d'essai (Thomas, 2026-11-14) : un menu pour choisir la section (1 : le plan historique ; 2 : la champignonnière).
if (!PUBLIC_BUILD) {
  button("menu-sandbox", () => showScreen("essai"));
  for (const s of [1, 2] as const) {
    button(`essai-s${s}`, () => {
      setSandboxSection(s);
      newRun(true);
      started = true;
      showScreen(null);
    });
  }
  // Zone d'essai des salles à énigme (Thomas, 2026-11-21).
  button("essai-enigme", () => {
    setSandboxSection(3);
    newRun(true);
    started = true;
    showScreen(null);
  });
  button("essai-all", () => {
    newRun(false, true);
    started = true;
    showScreen(null);
  });
  // Section 3, l'Ossuaire (Thomas, 2026-11-19) : une partie d'essai qui commence à l'étage 11 (décor seul, pas encore de monstres).
  button("essai-s3", () => {
    newRun(false, true);
    started = true;
    showScreen(null);
    if (game.testSection3()) logLines.push("Téléporté à l'étage 11 : l'Ossuaire de la Lune pâle (aperçu : niveau 10, équipement élevé, flèches d'obsidienne et potions de gel).");
    collectEvents();
    renderLog();
  });
  button("essai-back", () => showScreen("main"));
  // Triche « Boss 2 » (Thomas, 2026-11-17) : depuis n'importe quel essai, une partie d'essai au Carillon, niveau 10.
  button("boss2", () => {
    if (!game.testRun) {
      newRun(false, true);
      started = true;
      showScreen(null);
    }
    if (game.testBoss2()) logLines.push("Téléporté devant le Carillon : niveau 10, points et pouvoirs placés, équipement élevé.");
    collectEvents();
    renderLog();
    renderHeroScreen();
  });
  // Téléporteur d'étage (partie d'essai).
  for (const [id, step] of [["tp-up", -1], ["tp-down", 1]] as const) {
    button(id, () => {
      if (game.teleport(game.depth + step)) {
        logLines.push(`Téléporté à l'étage ${game.depth}.`);
        collectEvents();
      } else collectEvents();
    });
  }
}
button("settings-stats", () => {
  stats.setConsent(stats.consent() === "yes" ? "no" : "yes");
  sfx.play("click");
  showScreen("settings");
});
button("stats-yes", () => {
  stats.setConsent("yes");
  $("stats-ask").hidden = true;
});
button("stats-no", () => {
  stats.setConsent("no");
  $("stats-ask").hidden = true;
});
button("settings-blood", () => {
  options.blood = !options.blood;
  renderer.setBlood(options.blood);
  saveOptions();
  sfx.play("click");
  showScreen("settings");
});
// Paramètres (Thomas, 2026-11-16, soir) : une seule liste ; « Son » (mélangeur à 5 niveaux) et « Langue » sont des
// sous-menus, plus d'onglets Général / Son.
function showSettingsPane(pane: "general" | "son" | "lang"): void {
  settingsPane = pane;
  $("pane-general").hidden = pane !== "general";
  $("pane-son").hidden = pane !== "son";
  $("pane-lang").hidden = pane !== "lang";
  $("settings-title").textContent = tr(pane === "son" ? "Son" : pane === "lang" ? "Langue" : "Paramètres");
  $("lang-fr").classList.toggle("active", options.lang !== "en");
  $("lang-en").classList.toggle("active", options.lang === "en");
  renderMixer();
}
button("settings-son", () => showSettingsPane("son"));
button("settings-lang", () => showSettingsPane("lang"));
function chooseLang(lang: "fr" | "en"): void {
  sfx.play("click");
  if (options.lang !== lang) {
    options.lang = lang;
    saveOptions();
    setLang(options.lang);
    translatePage();
    logLines = [...logLines];
    renderLog();
  }
  showScreen("settings");
}
button("lang-fr", () => chooseLang("fr"));
button("lang-en", () => chooseLang("en"));
function setLevel(which: "soundLevel" | "musicLevel", level: number): void {
  options[which] = Math.max(0, Math.min(5, level));
  // Toucher les barres d'une ligne coupée la rallume.
  if (which === "soundLevel") options.soundOn = true;
  else options.musicOn = true;
  applyAudio();
  saveOptions();
  sfx.play("click");
  renderMixer();
}
function renderMixer(): void {
  for (const [key, on] of [["sound", options.soundOn], ["music", options.musicOn]] as const) {
    $(`vol-${key}-on`).textContent = tr(on ? "Oui" : "Non");
    $(`mix-${key}`).classList.toggle("muted", !on);
  }
  for (const [id, which] of [["vol-sound", "soundLevel"], ["vol-music", "musicLevel"]] as const) {
    const level = options[which];
    $(id).replaceChildren(
      ...[1, 2, 3, 4, 5].map((n) => {
        const bar = el("button", n <= level ? "on" : "") as HTMLButtonElement;
        bar.type = "button";
        bar.style.height = `${30 + n * 14}%`;
        bar.setAttribute("aria-label", `${n} / 5`);
        // Toucher la barre la plus haute allumée l'éteint (on descend d'un cran ; la première : coupé).
        bar.addEventListener("click", () => setLevel(which, n === level ? n - 1 : n));
        return bar;
      }),
    );
  }
}
// Couper / rallumer une ligne sans perdre son niveau (Thomas, 2026-11-17).
for (const key of ["sound", "music"] as const) {
  button(`vol-${key}-on`, () => {
    if (key === "sound") options.soundOn = !options.soundOn;
    else options.musicOn = !options.musicOn;
    applyAudio();
    saveOptions();
    sfx.play("click");
    renderMixer();
  });
}
button("vol-sound-minus", () => setLevel("soundLevel", options.soundLevel - 1));
button("vol-sound-plus", () => setLevel("soundLevel", options.soundLevel + 1));
button("vol-music-minus", () => setLevel("musicLevel", options.musicLevel - 1));
button("vol-music-plus", () => setLevel("musicLevel", options.musicLevel + 1));
// Salle d'essai : Gluck et Sœur Osseuse reprennent à leur première scène (Thomas, 2026-11-12).
button("reset-talks", () => {
  game.resetDialogues();
  logLines.push("Dialogues remis à zéro : Gluck, Sœur Osseuse, Krik et Grum reprennent depuis le début.");
  renderLog();
});
// Salle d'essai v21 (Thomas, 2026-11-14) : tout l'étage remis à neuf ; l'arène remise, ou un monstre de plus.
button("cheat-toggle", () => {
  const folded = $("test-tools").classList.toggle("folded");
  try {
    localStorage.setItem("leutenheim.cheat", folded ? "closed" : "open");
  } catch {
    /* sans stockage : le choix ne dure que la partie */
  }
});
button("reset-floor", () => {
  game.resetSandbox();
  collectEvents();
});
// Partie d'essai (Thomas, 2026-11-15) : chercher un objet dans le répertoire et le recevoir (au sac, ou à côté).
const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function renderSpawn(): void {
  const query = plain(($("spawn-search") as HTMLInputElement).value.trim());
  const list = $("spawn-list");
  list.replaceChildren();
  const kinds = Object.keys(KIND_LABELS) as ItemDef["kind"][];
  for (const kind of kinds) {
    const defs = (Object.values(ITEMS) as ItemDef[])
      .filter((d) => d.kind === kind && d.kind !== "gold")
      .filter((d) => !query || plain(tr(d.name)).includes(query) || plain(d.name).includes(query) || plain(tr(KIND_LABELS[kind])).includes(query))
      .sort((a, b) => (a.level ?? 1) - (b.level ?? 1) || tr(a.name).localeCompare(tr(b.name)));
    if (defs.length === 0) continue;
    list.append(el("div", "spawn-kind", KIND_LABELS[kind]));
    for (const d of defs) {
      const row = el("button", "spawn-row") as HTMLButtonElement;
      row.type = "button";
      const dot = el("span", "spawn-dot");
      dot.style.background = RARITY_COLORS[d.rarity ?? "common"][0];
      row.append(itemIcon(d.id as ItemId), dot, el("span", "spawn-name", d.name), el("span", "spawn-meta", `Lv ${d.level ?? 1}`));
      row.addEventListener("click", () => {
        const where = game.testGive(d.id as ItemId);
        if (!where) return;
        collectEvents();
        logLines.push(where === "bag" ? `Ajouté au sac : ${d.name.toLowerCase()}.` : `Sac plein : ${d.name.toLowerCase()} tombe à côté.`);
        renderLog();
        sfx.play("click");
        row.classList.add("on");
        setTimeout(() => row.classList.remove("on"), 250);
      });
      list.append(row);
    }
  }
}
button("spawn-open", () => {
  if (!game.sandbox && !game.testRun) return;
  foundOpen = true;
  ($("spawn-search") as HTMLInputElement).placeholder = tr("Chercher un objet…");
  $("spawn").hidden = false;
  renderSpawn();
});
// Triche « Stuff » (Thomas, 2026-11-16) : un équipement complet tiré au hasard, et ses consommables.
for (const tier of ["faible", "moyen", "eleve"] as const) {
  button(`kit-${tier}`, () => {
    const given = game.testKit(tier);
    if (!given) return;
    collectEvents();
    const list = given.map((id) => ITEMS[id].name.toLowerCase()).join(", ");
    logLines.push(tier === "faible" ? `Stuff faible : ${list}.` : tier === "moyen" ? `Stuff moyen : ${list}.` : `Stuff élevé : ${list}.`);
    renderLog();
    sfx.play("click");
  });
}
// Mode du Carillon (Thomas, 2026-11-16 : « fais un mode dans le test ») : doux, onde seule, dur.
button("carillon-mode", () => {
  const next = CARILLON_MODES[(CARILLON_MODES.indexOf(game.carillonMode) + 1) % CARILLON_MODES.length];
  try {
    localStorage.setItem("leutenheim.carillonMode", next);
  } catch {
    /* sans stockage */
  }
  applyCarillonMode();
  logLines.push(next === "douce" ? "Carillon doux : l'encre ne commence qu'après la première onde, un tour sur deux." : next === "onde" ? "Carillon : l'onde seule, ni encre ni chapeau." : "Carillon dur : l'encre dès l'arrivée, à chaque tour.");
  renderLog();
  sfx.play("click");
});
button("spawn-close", () => {
  foundOpen = false;
  $("spawn").hidden = true;
});
$("spawn-search").addEventListener("input", renderSpawn);
button("arena-reset", () => {
  game.arenaReset();
  logLines.push("L'arène est remise : un monstre de chaque sorte.");
  renderLog();
});
for (const kind of ["schrat", "frondeur", "araignee"] as const) {
  button(`arena-${kind}`, () => {
    if (game.arenaSpawn(kind)) logLines.push("Un monstre de plus entre dans l'arène.");
    renderLog();
  });
}


let gravelCrik = true;

// ---------- Passage d'un étage à l'autre ----------

/** La petite scène dans le noir entre deux étages (Thomas, 2026-11-12) ; `null` hors passage. */
let stairsScene: StairsScene | null = null;

/** Salle d'essai : les scènes d'escalier défilent dans l'ordre, pour toutes les voir. */
let sandboxStairs = 0;
/** La partie des derniers escaliers : une nouvelle salle d'essai recommence par la descente ordinaire. */
let stairsGame: unknown = null;
const STAIRS_ORDER: StairsVariant[] = ["rain", "normal", "tumble", "kobold", "flute", "vines", "basin"];

function beginStairs(force?: StairsVariant): void {
  const direction = game.pendingStairs;
  if (!direction || game.over || stairsScene) return;
  const target = game.depth + (direction === "down" ? 1 : -1);
  if (target < 1) return;
  // Scènes rares (Thomas, 2026-11-12 ; décor seulement) : en descendant, dégringolade 1 fois sur 12, Kobold croisé,
  // flûte, lianes et bassine 1 fois sur 20 chacune (C) ; en montant, Kobold et flûte seulement.
  let variant: StairsVariant = "normal";
  if (force) variant = force;
  else if (game.sandbox) {
    if (stairsGame !== game) sandboxStairs = 0;
    variant = STAIRS_ORDER[sandboxStairs++ % STAIRS_ORDER.length];
  }
  // La toute première descente d'une partie est toujours la descente ordinaire (Thomas, 2026-11-13).
  else if (direction === "down" && game.depth === 1) variant = "normal";
  else {
    const r = Math.random();
    const table: [StairsVariant, number][] = direction === "down"
      ? [["tumble", 1 / 12], ["kobold", 1 / 20], ["flute", 1 / 20], ["vines", 1 / 20], ["basin", 1 / 20], ["rain", 1 / 20]]
      : [["kobold", 1 / 20], ["flute", 1 / 20], ["rain", 1 / 20]];
    let acc = 0;
    for (const [v, p] of table) if (r < (acc += p)) { variant = v; break; }
  }
  stairsGame = game;
  // Une astuce défile pendant le passage, puis reste au journal (Thomas, 2026-11-16).
  tipIndex = (tipIndex + 1) % TIPS.length;
  stairsTip = tr(TIPS[tipIndex]);
  // Le héros de la scène a la tête de sa race, sans son équipement.
  // L'astuce s'affiche avec le MÊME élément que sur la carte (Thomas, 2026-11-21 : « les astuces n'ont pas la même
  // taille ni le même dessin entre l'escalier et la carte ») : elle reste pendant tout le passage, puis 7 s.
  stairsScene = new StairsScene(direction, variant, tr(`ÉTAGE ${target}`), heroSprites(heroLook(game.race.id, { melee: "epee" })), "");
  holdTip(stairsTip);
}

/** L'astuce reste affichée (pendant le passage d'escalier), sans s'effacer. */
function holdTip(text: string): void {
  const el = $("tip-toast");
  el.textContent = text;
  el.classList.remove("out", "fast");
  el.hidden = false;
  window.clearTimeout(tipTimer);
}

/** L'astuce s'efface tout de suite (le joueur agit : une conversation, un objet, un texte vont s'afficher). */
function dismissTip(): void {
  const el = $("tip-toast");
  if (el.hidden || stairsScene) return;
  window.clearTimeout(tipTimer);
  el.classList.add("out", "fast");
  tipTimer = window.setTimeout(() => {
    el.hidden = true;
    el.classList.remove("fast");
  }, 250);
}

/** L'astuce reste sur la carte quelques secondes après l'escalier, puis s'efface (Thomas, 2026-11-17 : « elles
 *  apparaissent et disparaissent trop vite »). Elle ne gêne pas le jeu : on joue à travers. */
const TIP_SHOWN_MS = 7000;
let tipTimer = 0;
function showTip(text: string): void {
  const el = $("tip-toast");
  el.textContent = text;
  el.classList.remove("out", "fast");
  el.hidden = false;
  window.clearTimeout(tipTimer);
  tipTimer = window.setTimeout(() => {
    el.classList.add("out");
    tipTimer = window.setTimeout(() => (el.hidden = true), 1000);
  }, TIP_SHOWN_MS);
}

/** L'astuce du passage d'escalier en cours ; on les fait défiler dans l'ordre, à partir d'une astuce tirée au hasard. */
let tipIndex = Math.floor(Math.random() * TIPS.length);
let stairsTip = "";
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
    if (scene.tumbled) logLines.push("Vous dégringolez l'escalier… et vous relevez, un peu sonné, mais entier.");
    if (stairsTip) logLines.push(`Astuce : ${stairsTip}`);
    renderLog();
    if (stairsTip) showTip(stairsTip);
  }
}

// ---------- Boucle d'affichage ----------

let last = performance.now();
/**
 * Qualité qui s'adapte (Thomas, 2026-11-12 : « la performance semble meilleure, mais pas encore parfaite ») : si les
 * images arrivent trop lentement (moins de ~45 par seconde en moyenne sur 2 secondes, menus fermés), le jeu se dessine
 * un peu moins fin. Il ne remonte pas pendant la partie (pas de va-et-vient).
 */
let speedSum = 0;
let speedCount = 0;
function watchSpeed(dt: number): void {
  if (menuOpen || document.hidden || dt >= 100) return;
  speedSum += dt;
  speedCount++;
  if (speedSum < 2000) return;
  const average = speedSum / speedCount;
  speedSum = 0;
  speedCount = 0;
  if (average > 22) renderer.lowerQuality();
}

function frame(now: number): void {
  // Pas plus de 60 images par seconde (les écrans à 90 ou 120 Hz doublaient le travail pour rien).
  if (now - last < 15) {
    requestAnimationFrame(frame);
    return;
  }
  const dt = Math.min(now - last, 100);
  last = now;
  watchSpeed(dt);
  if (flarePending && !bagOpen && !menuOpen) {
    flarePending = false;
    renderer.torchFlare();
  }
  // Étage du boss : pas d'alerte ; la musique y reste tendue (palier « alerte »), puis « le cœur du boss » pendant le
  // combat (Thomas, 2026-11-16) : son tempo suit la vie du boss.
  music.stage = game.alarmOff() ? 2 : game.alarm().stage;
  music.heroHeart = !game.over && game.hero.hp > 0 && game.hero.hp < game.hero.maxHp * 0.25;
  const fighting = started && !game.over ? game.bossActor() : undefined;
  if (fighting?.boss?.engaged) {
    const left = fighting.hp / fighting.maxHp;
    music.boss = left > 2 / 3 ? 0 : left > 1 / 3 ? 1 : 2;
  } else music.boss = null;
  music.update();

  // Les boutons de l'arène n'apparaissent que dans l'arène (salle d'essai).
  const arenaTools = $("arena-tools");
  const showArena = started && game.sandbox && game.inArena();
  if (arenaTools.hidden === showArena) arenaTools.hidden = !showArena;
  advanceCues(dt);
  dieIdle = cue || queue.length > 0 ? 0 : dieIdle + dt;
  if (dieIdle >= DIE_CLEAR_MS && die.textContent !== "") clearDie();
  quietRollLog();

  if (stepping) {
    stepTime += dt;
    if (stepTime >= stepMs) {
      // Tour terminé ; le reste de temps est reporté sur le suivant pour garder une vitesse constante.
      stepTime -= stepMs;
      stepping = false;
      throwLag = 0;
      if (game.pendingStairs) beginStairs();
    }
  }
  // Les petits de la Tisseuse qui fuient (la partie est finie : on les fait marcher à la main, un pas à la fois).
  if (!stepping && broodFlight.length > 0) {
    for (const f of broodFlight) {
      const m = game.monsters.find((o) => o.id === f.id);
      if (!m) continue;
      m.fromX = m.x;
      m.fromY = m.y;
      const next = f.path.shift();
      if (next) {
        m.x = next.x;
        m.y = next.y;
      } else {
        // Pouf : un nuage de fumée, et il n'est plus là.
        renderer.addPuff(m.x, m.y);
        if (game.isVisible(m.x, m.y)) sfx.play("puff");
        game.monsters.splice(game.monsters.indexOf(m), 1);
      }
    }
    broodFlight = broodFlight.filter((f) => game.monsters.some((m) => m.id === f.id));
    stepping = true;
    stepTime = 0;
    stepMs = BROOD_STEP_MS;
  }
  // Le tour suivant ne commence que lorsque tout ce qui s'est passé a été montré.
  advanceStairs(dt);
  // FILET DE SÉCURITÉ (Thomas, 2026-11-21 : « mon perso est figé », non reproduit) : si un événement à montrer ou une
  // animation de pas reste coincé plus de 6 s (aucun menu ouvert), on le laisse tomber pour rendre la main au joueur.
  const busy = (cue !== null || queue.length > 0 || stepping) && !menuOpen && !bagOpen && !foundOpen && !shopOpen && !talkOpen && !stairsScene;
  stuckMs = busy ? stuckMs + dt : 0;
  if (stuckMs > 6000) {
    console.warn("Boucle de jeu débloquée", { cue: cue?.event.type, queue: queue.map((e) => e.type), stepping });
    cue = null;
    queue = [];
    stepping = false;
    stuckMs = 0;
  }
  // À TERRE (Thomas, 2026-11-17 : « fais durer au moins un tour le fait d'être couché ») : le tour perdu à se relever
  // passe tout seul, mais pas avant qu'on ait vu le héros couché un moment.
  // Entoilé (Thomas, 2026-11-18) : pareil, le tour perdu passe tout seul après un court instant.
  const held = (game.hero.prone ?? 0) > 0 || ((game.hero.stuck ?? 0) > 0 && game.stoneTurns <= 0);
  if (held && !stepping && !cue && queue.length === 0) proneShown += dt;
  else if (!held) proneShown = 0;
  const proneWait = held && proneShown < ((game.hero.prone ?? 0) > 0 ? PRONE_HOLD_MS : STUCK_HOLD_MS);
  if (!proneWait && !stairsScene && !stepping && !cue && queue.length === 0 && !menuOpen && !bagOpen && !foundOpen && !shopOpen && !talkOpen && !wheelOpen) {
    shownHp = game.hero.hp;
    if (game.visibleMonsters().length > 0) stepMs = Math.max(stepMs, COMBAT_STEP_MS);
    const before = { x: game.hero.x, y: game.hero.y };
    if (game.tick()) {
      stepping = true;
      if (game.hero.x !== before.x || game.hero.y !== before.y) sfx.play("step");
      collectEvents();
      // Sauvegarde automatique après chaque tour (mort définitive : la sauvegarde s'efface à la mort).
      // Partie d'essai : la sauvegarde reste (on reprend juste avant la mort, ou l'on revit).
      if (game.over && !game.sandbox && !game.testRun) eraseSave(currentSlot);
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
  if ((!jumpMode || game.disengageRefusal() !== null) && !pushMode && throwUid === null && !paintMode) {
    jumpMode = false;
    renderer.jumpCells = [];
  }
  // Le dé s'entoure d'or quand un ennemi est au contact : le toucher le frappe.
  diceBox.classList.toggle("ready", !game.over && game.meleeTarget() !== null);
  if (!cue && queue.length === 0 && die.textContent === "") {
    const hint = game.meleeTarget() && !game.over ? "Frapper" : "";
    if (dieWho.textContent !== tr(hint) && (hint || dieWho.textContent === tr("Frapper"))) dieWho.textContent = tr(hint);
  }
  if (started) discoverSurroundings();
  const aimRange = aimMode && game.arrows() > 0 ? (game.shotProfile()?.range ?? null) : null;
  renderer.monsterProgress = stepping && throwLag > 0 ? Math.max(0, Math.min((stepTime - throwLag) / Math.max(1, stepMs - throwLag), 1)) : null;
  if (stairsScene) stairsScene.draw(canvas);
  else renderer.draw(game, stepping ? Math.min(stepTime / stepMs, 1) : 1, dt, ghosts, aimRange, aimRange !== null ? aimTarget() : null);
  $("bag-bang").hidden = !game.hasPendingChoice() || game.over;
  refreshHeroHead();
  $("open-bag").classList.toggle("pending", game.hasPendingChoice() && !game.over);
  renderAlarm();
  renderHeroStatus();
  renderQuest();
  // Le tourne-disque de la salle de bain ne joue plus de son (Thomas, 2026-11-13 : « il écrase la sono du jeu ») ;
  // seules ses notes dessinées restent.
  const floorText = String(game.depth);
  if ($("floor-num").textContent !== floorText) $("floor-num").textContent = tr(floorText);
  setWidth(hpFill, `${(100 * shownHp) / game.hero.maxHp}%`);
  // Vie à 20 % ou moins (Thomas, 2026-11-18 : « l'écran qui pulse rouge quand j'arrive à 20 % ») : le bord de la carte
  // rougeoie et palpite, en combat ou non.
  setHidden($("low-hp"), !(game.hero.hp > 0 && !game.over && game.hero.hp <= game.hero.maxHp * 0.2));
  hpOrbs();
  renderHere();
  setText($("hp-label"), tr(`PV ${shownHp}/${game.hero.maxHp}`));
  const xpShown = shownXp();
  // Niveau maximal de la section : la jauge est pleine, grisée, avec un petit panneau « stop ».
  const capped = game.xpBlocked() && xpInFlight === 0;
  xpBar.classList.toggle("capped", capped);
  if ($("xp-stop").hidden === capped) {
    $("xp-stop").hidden = !capped;
    if (capped && !$("xp-stop").firstChild) $("xp-stop").append(uiIcon("stop"));
  }
  setWidth($("xp-fill"), capped ? "100%" : `${(100 * xpShown.xp) / xpShown.need}%`);
  setText($("xp-label"), tr(capped ? `Niv ${game.level} · MAX` : `Niv ${xpShown.level} · XP ${xpShown.xp}/${xpShown.need}`));
  // Seules les méthodes encore possibles sur cette porte sont proposées.
  const doorOptions = game.doorOptions();
  // Avec la clef de l'étage, rien à choisir : elle sert toute seule.
  setHidden(doorActions, doorOptions.length === 0 || game.over || cue !== null || game.usingKey());
  setHidden($("door-key"), !doorOptions.includes("key"));
  setHidden($("door-peek"), !doorOptions.includes("peek"));
  setHidden($("door-pick"), !doorOptions.includes("pick"));
  // Devant un sarcophage à pointes, les deux mêmes boutons : désamorcer (agilité) ou forcer (force).
  const maiden = game.pendingDoor !== null && game.maidenAt(game.pendingDoor.x, game.pendingDoor.y) !== null;
  const pickText = maiden ? "Désamorcer" : "Crocheter";
  const breakText = maiden ? "Forcer" : "Enfoncer";
  if ($("door-pick").textContent !== pickText) $("door-pick").textContent = tr(pickText);
  if ($("door-break").textContent !== breakText) $("door-break").textContent = tr(breakText);
  setHidden($("door-break"), !doorOptions.includes("break"));
  // En arrivant devant une porte verrouillée, le héros bute dessus.
  if (game.pendingDoor && !doorWasPending && !game.usingKey()) {
    renderer.addSlash(game.hero.id, game.hero.x, game.hero.y, game.pendingDoor.x, game.pendingDoor.y, "", false);
    sfx.play("knock");
  }
  doorWasPending = game.pendingDoor !== null;
  setHidden($("recenter"), !renderer.isPanned());
  watchTravel();
  const bow = game.weapon("ranged");
  const aim = $("aim");
  // Le bouton de tir sert aussi à lancer une javeline, même sans arc.
  const canShoot = !!bow || game.shotProfile() !== null;
  aim.hidden = !canShoot;
  if (!canShoot) aimMode = false;
  // Dès qu'un ennemi arrive au contact, on repasse à l'arme de corps à corps.
  if (aimMode && game.isThreatened() && !closeThrowOk()) {
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
    // Le lance-pierre (Thomas, 2026-11-16) : son picto, et le nombre de pierres à côté.
    const picto = bow?.id === "lance_pierre" ? itemIcon("lance_pierre") : ammo && ammo !== "fleche" ? itemIcon(ammo) : uiIcon("arrow");
    aim.replaceChildren(picto, document.createTextNode(Number.isFinite(game.arrows()) ? tr(`×${game.arrows()}`) : "∞"));
  }
  aim.classList.toggle("active", aimMode);
  renderPower();
  renderQuickButton();
  const bossOn = !!game.bossActor()?.boss?.engaged;
  if (bossOn !== document.body.classList.contains("boss-on")) document.body.classList.toggle("boss-on", bossOn);
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
  /** Pour les vérifications : les textes affichés sans traduction anglaise. */
  untranslated: () => [...i18nMissing],
  renderer: () => renderer,
  /** Réglages de couleur de la section 2, à poser avant de lancer la partie (variantes à comparer). */
  champiTune: CHAMPI_TUNE,
  /** Pour les captures : lance le passage d'escalier (le héros doit être sur un escalier). */
  stairs: (variant?: StairsVariant) => beginStairs(variant),
  /** Pour les captures : montre les événements en attente (comme après un toucher). */
  flush: () => collectEvents(),
  /** Pour les vérifications : ce qui retient la boucle de jeu (un personnage « figé »). */
  hold: () => ({ proneShown, stairs: !!stairsScene, stepping, cue: !!cue, queue: queue.map((e) => e.type), menuOpen, bagOpen, foundOpen, shopOpen, talkOpen, wheelOpen }),
};

/** La tête du héros (bouton de son écran) : sa race, son casque et son armure, prises sur son image de repos de face. */
function heroHeadIcon(): SVGSVGElement {
  const gear = game.equipment;
  const look = heroSprites(heroLook(game.race.id, { armor: gear.armor?.defId, hat: gear.hat?.defId }));
  const rows = look.frames.idleDown[0];
  const top = Math.max(0, rows.findIndex((r) => /[^.]/.test(r)));
  return buildIcon(rows.slice(top, top + 9), look.palette);
}

/** Le bouton du héros montre sa tête : on ne la redessine que si la race, l'armure ou le casque ont changé. */
let heroHeadKey = "";
function refreshHeroHead(): void {
  const gear = game.equipment;
  const key = `${game.race.id}|${gear.armor?.defId ?? ""}|${gear.hat?.defId ?? ""}`;
  if (key === heroHeadKey) return;
  heroHeadKey = key;
  $("open-bag").firstElementChild?.replaceWith(heroHeadIcon());
}

/** Une ligne du journal commence par une majuscule (en anglais, « jet de force » devient « strength roll »…). */
function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
