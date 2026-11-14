/**
 * MUR DE SUCCÈS (Thomas, 2026-11-14, maquette art/succes_v1.html validée : « Fonce »). Les succès se gardent sur
 * l'appareil, toutes parties confondues (salle d'essai exclue) ; la partie les fait avancer par ses événements.
 * La PREMIÈRE fois qu'un rang est obtenu : l'animation (médaillon qui tombe, rayons, bandeau) et une ligne dorée au
 * journal ; ensuite, seulement une ligne au journal avec un mini médaillon.
 */
import type { Game } from "../core/game";
import type { GameEvent } from "../core/events";
import { ACHIEVEMENTS, AchievementDef, FIFRELIN_FEATS, TIER_NAMES, tierOf } from "../data/achievements";
import { QUEST_TASKS } from "../data/quests";
import { tr } from "../i18n/i18n";
import { medal, miniTier, TIER_KEYS, TIER_TEXT } from "./medals";

const KEY = "leutenheim.succes";

interface Profile {
  /** La valeur de chaque succès (total, meilleur ou plus petit). */
  values: Record<string, number>;
  /** Les missions différentes réussies, par PNJ. */
  done: Record<string, string[]>;
  /** Le meilleur rang déjà obtenu (-1 : aucun). */
  tiers: Record<string, number>;
}

let profile: Profile = load();
/** La bourse au dernier tour regardé, pour compter l'or gagné (succès « Radin »). */
let goldSeen: { game: Game | null; gold: number } = { game: null, gold: 0 };

function load(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (p && typeof p === "object" && p.values && p.tiers) return { values: p.values, done: p.done ?? {}, tiers: p.tiers };
  } catch {
    // Rien de lisible : on repart de zéro.
  }
  return { values: {}, done: {}, tiers: {} };
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Stockage plein ou interdit : tant pis.
  }
}

/** Un rang obtenu ou une mention : `first` = la toute première fois (animation). */
export interface Unlock {
  id: string;
  tier: number;
  first: boolean;
  /** La ligne du journal (texte français, traduit à l'affichage). */
  line: string;
}

const defOf = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;
const tierName = (t: number) => (t < 0 ? "" : TIER_NAMES[t]);

/** Une ligne de journal avec le mini médaillon : la marque est lue par `splitMedal`. */
export function medalLine(id: string, tier: number, text: string): string {
  return `\u0001${id}:${tier}\u0001${text}`;
}

/** Sépare la marque du médaillon et le texte d'une ligne du journal. */
export function splitMedal(line: string): { id: string; tier: number; text: string } | null {
  const m = /^\u0001([a-z]+):(-?\d)\u0001(.*)$/s.exec(line);
  return m ? { id: m[1], tier: Number(m[2]), text: m[3] } : null;
}

/** La valeur change : rend le rang gagné (la première fois) ou rien. */
function set(id: string, value: number): Unlock | null {
  const def = defOf(id);
  profile.values[id] = value;
  const t = tierOf(def, value);
  const had = profile.tiers[id] ?? -1;
  if (t <= had) return null;
  profile.tiers[id] = t;
  return { id, tier: t, first: true, line: `${tr("SUCCÈS !")} ${tr(def.name)} (${tr(tierName(t))}) : ${tr(goalText(def, t))}` };
}

/** Ce qu'il fallait faire pour ce rang, en une phrase. */
export function goalText(def: AchievementDef, t: number): string {
  const n = def.tiers[t];
  switch (def.id) {
    case "chasseur":
      return `${n} monstres vaincus.`;
    case "bourreau":
      return `${n} points de dégâts infligés.`;
    case "tisseuse":
      return n === 1 ? "la Tisseuse vaincue." : `la Tisseuse vaincue ${n} fois.`;
    case "course":
      return `la Tisseuse atteinte en moins de ${n} tours.`;
    case "profondeur":
      return `l'étage ${n} atteint.`;
    case "fouineur":
      return n === 1 ? "une salle secrète trouvée." : `${n} salles secrètes trouvées.`;
    case "bousculeur":
      return `${n} poussées réussies.`;
    case "fuyard":
      return `${n} fois dégagé d'un ennemi.`;
    case "portier":
      return `${n} portes verrouillées ouvertes.`;
    case "intouchable":
      return n === 1 ? "un étage quitté sans une égratignure." : `${n} étages quittés sans une égratignure.`;
    case "ombre":
      return `${n} monstres vaincus par surprise.`;
    case "pyromane":
      return `${n} monstres vaincus en feu.`;
    case "alchimiste":
      return `${n} potions lancées.`;
    case "radin":
      return `${n} pièces d'or gagnées.`;
    case "pilleur":
      return `${n} coffres et sarcophages ouverts.`;
    case "poulet":
      return n === 1 ? "un poulet effrayé." : `${n} poulets effrayés.`;
    default:
      return n === 1 ? "une mission réussie." : `${n} missions différentes réussies.`;
  }
}

/** Une mission (ou une issue du tripot) réussie : chacune ne compte qu'une fois. */
function feat(id: string, featId: string, out: Unlock[]): void {
  const list = (profile.done[id] ??= []);
  if (list.includes(featId)) {
    const t = profile.tiers[id] ?? -1;
    out.push({ id, tier: t, first: false, line: `${tr(defOf(id).name)}${t >= 0 ? ` (${tr(tierName(t))})` : ""} : ${tr("mission réussie, déjà faite dans une autre partie.")}` });
    return;
  }
  list.push(featId);
  const u = set(id, list.length);
  if (u) out.push(u);
}

/**
 * Les événements d'un tour font avancer les succès. Rend les rangs gagnés et les mentions, dans l'ordre. Rien en
 * salle d'essai.
 */
export function onEvents(events: readonly GameEvent[], game: Game): Unlock[] {
  if (game.sandbox) return [];
  const out: Unlock[] = [];
  const add = (id: string, n: number) => {
    const u = set(id, (profile.values[id] ?? 0) + n);
    if (u) out.push(u);
  };
  for (const e of events) {
    if (e.type === "death" && e.actor.kind === "monster") {
      add("chasseur", 1);
      if (e.unaware) add("ombre", 1);
      if (e.fire) add("pyromane", 1);
    } else if (e.type === "potionThrown") add("alchimiste", 1);
    else if (e.type === "chest" || e.type === "maiden") add("pilleur", 1);
    else if (e.type === "attack" && e.attacker.kind === "hero" && e.result.hit && e.result.damage > 0) add("bourreau", e.result.damage);
    else if (e.type === "boss" && e.what === "dead") {
      const before = profile.tiers.tisseuse ?? -1;
      add("tisseuse", 1);
      if ((profile.tiers.tisseuse ?? -1) === before && before >= 0)
        out.push({ id: "tisseuse", tier: before, first: false, line: `${tr("Tisseuse")} (${tr(tierName(before))}) : ${tr(`la Tisseuse est vaincue… encore (${profile.values.tisseuse}e victoire).`)}` });
    } else if (e.type === "stairs" && e.direction === "down") {
      if (e.unhurt) add("intouchable", 1);
      const deep = Math.max(profile.values.profondeur ?? 0, game.depth);
      const u = set("profondeur", deep);
      if (u) out.push(u);
      if (game.bossActor()) {
        const best = profile.values.course;
        const value = best && best > 0 ? Math.min(best, game.turn) : game.turn;
        const before = profile.tiers.course ?? -1;
        const won = set("course", value);
        if (won) out.push(won);
        else if (before >= 0)
          out.push({ id: "course", tier: before, first: false, line: `${tr("Course")} (${tr(tierName(before))}) : ${tr(`la Tisseuse atteinte en ${game.turn} tours. Votre record : ${value}.`)}` });
      }
    } else if (e.type === "secret" && e.what === "found") add("fouineur", 1);
    else if (e.type === "chicken") add("poulet", 1);
    else if (e.type === "door" && e.success && e.action !== "peek") add("portier", 1);
    else if (e.type === "push" && e.success) add("bousculeur", 1);
    else if (e.type === "jump" && e.success) add("fuyard", 1);
    else if (e.type === "quest" && e.what === "complete") feat(QUEST_TASKS[e.id].npc, e.id, out);
    else if (e.type === "bout") {
      const f = e.what === "duelWin" ? "fifre_duel" : e.what === "win" ? (e.rigged ? "fifre_truque" : e.winner === "small" ? "fifre_petit" : "fifre_champ") : null;
      if (f && (FIFRELIN_FEATS as readonly string[]).includes(f)) feat("fifrelin", f, out);
    }
  }
  // L'or gagné : ce que la bourse prend en plus depuis la dernière fois (les dépenses ne retirent rien).
  const earned = goldSeen.game === game && game.gold > goldSeen.gold;
  if (earned) add("radin", game.gold - goldSeen.gold);
  goldSeen = { game, gold: game.gold };
  if (earned || out.length > 0 || events.some((e) => e.type === "attack" || e.type === "death")) save();
  return out;
}

/** Combien de médailles de chaque rang (or, argent, cuivre) et le total possible. */
export function tally(): { or: number; ag: number; cu: number; got: number; all: number } {
  let or = 0;
  let ag = 0;
  let cu = 0;
  for (const a of ACHIEVEMENTS) {
    const t = profile.tiers[a.id] ?? -1;
    if (t >= 2) or++;
    else if (t === 1) ag++;
    else if (t === 0) cu++;
  }
  // Chaque rang compte une médaille : un or vaut aussi l'argent et le cuivre.
  const got = ACHIEVEMENTS.reduce((n, a) => n + (profile.tiers[a.id] ?? -1) + 1, 0);
  return { or, ag, cu, got, all: ACHIEVEMENTS.length * 3 };
}

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".0", "").replace(".", ",")}k` : String(n));

/** Le mur : trois rubriques de médaillons, une fiche en bas pour celui qu'on touche. */
export function renderWall(host: HTMLElement, detail: HTMLElement, head: HTMLElement): void {
  const t = tally();
  head.replaceChildren();
  for (const [tier, n] of [[0, t.cu], [1, t.ag], [2, t.or]] as const) {
    const s = document.createElement("span");
    s.append(miniTier(tier, 2), document.createTextNode(String(n)));
    head.append(s);
  }
  const all = document.createElement("span");
  all.className = "dim";
  all.textContent = `· ${t.got} / ${t.all}`;
  head.append(all);
  host.replaceChildren();
  detail.hidden = true;
  for (const [group, title] of [["combat", "COMBAT"], ["quetes", "QUÊTES"], ["exploration", "EXPLORATION"]] as const) {
    const h = document.createElement("div");
    h.className = "succes-sec";
    h.textContent = tr(title);
    const grid = document.createElement("div");
    grid.className = "succes-grid";
    for (const def of ACHIEVEMENTS.filter((a) => a.group === group)) {
      const tier = profile.tiers[def.id] ?? -1;
      const value = profile.values[def.id] ?? 0;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `succes-cell${tier < 0 ? " locked" : ""}`;
      const name = document.createElement("div");
      name.className = "nm";
      name.textContent = tr(def.name);
      const next = Math.min(2, tier + 1);
      const need = def.tiers[next];
      const full = tier >= 2;
      const ratio = full ? 1 : def.kind === "low" ? (value > 0 ? Math.min(1, need / value) : 0) : Math.min(1, value / need);
      const bar = document.createElement("div");
      bar.className = "bar";
      const fill = document.createElement("i");
      fill.style.width = `${Math.round(ratio * 100)}%`;
      if (full) fill.className = "full";
      bar.append(fill);
      const pg = document.createElement("div");
      pg.className = "pg";
      pg.textContent = full ? tr("complet") : def.kind === "low" ? (value > 0 ? tr(`record ${value}`) : "—") : `${fmt(value)}/${fmt(need)}`;
      cell.append(medal(def.id, tier, 3), name, bar, pg);
      cell.addEventListener("click", () => showDetail(detail, def));
      grid.append(cell);
    }
    host.append(h, grid);
  }
}

function showDetail(detail: HTMLElement, def: AchievementDef): void {
  const tier = profile.tiers[def.id] ?? -1;
  const value = profile.values[def.id] ?? 0;
  detail.hidden = false;
  detail.replaceChildren();
  const row = document.createElement("div");
  row.className = "row";
  const text = document.createElement("div");
  const title = document.createElement("div");
  title.className = "ti";
  title.textContent = `${tr(def.name).toUpperCase()}${tier >= 0 ? ` — ${tr(TIER_NAMES[tier]).toUpperCase()}` : ""}`;
  title.style.color = TIER_TEXT[tier < 0 ? "no" : TIER_KEYS[tier]];
  const what = document.createElement("div");
  what.textContent = tr(def.what);
  const next = document.createElement("div");
  next.className = "dim";
  next.textContent =
    tier >= 2
      ? tr("Les trois rangs sont obtenus.")
      : def.kind === "low"
        ? `${tr(`Prochain rang : ${tr(TIER_NAMES[tier + 1])}, moins de ${def.tiers[tier + 1]} tours.`)}${value > 0 ? ` ${tr(`Votre record : ${value}.`)}` : ""}`
        : tr(`Prochain rang : ${tr(TIER_NAMES[tier + 1])}, à ${def.tiers[tier + 1]} (encore ${Math.max(0, def.tiers[tier + 1] - value)}).`);
  text.append(title, what, next);
  row.append(medal(def.id, tier, 2), text);
  const tiers = document.createElement("div");
  tiers.className = "tiers";
  def.tiers.forEach((n, i) => {
    const d = document.createElement("div");
    d.style.color = i <= tier ? TIER_TEXT[TIER_KEYS[i]] : "#9c8f74";
    d.textContent = `● ${tr(TIER_NAMES[i])} ${def.kind === "low" ? "< " : ""}${n}${i <= tier ? " ✓" : ""}`;
    tiers.append(d);
  });
  const close = document.createElement("button");
  close.type = "button";
  close.className = "succes-x";
  close.textContent = "×";
  close.addEventListener("click", () => (detail.hidden = true));
  detail.append(close, row, tiers);
}

/** Pour les tests de l'affichage : tout oublier. */
export function resetAchievements(): void {
  profile = { values: {}, done: {}, tiers: {} };
  save();
}

/**
 * L'animation du premier déblocage, par-dessus la carte (`frame`) : le médaillon tombe en tournoyant, se pose en haut
 * avec des rayons de la couleur du rang, le bandeau s'ouvre 2,5 s, puis le médaillon file vers le bouton du menu.
 * Toucher l'écran l'abrège. `done` est appelé à la fin (pour enchaîner le suivant).
 */
export function playUnlock(frame: HTMLElement, target: HTMLElement | null, u: Unlock, done: () => void): void {
  const def = defOf(u.id);
  const box = document.createElement("div");
  box.className = "succes-pop";
  const rays = document.createElement("canvas");
  rays.className = "succes-rays";
  rays.width = 200;
  rays.height = 200;
  const g = rays.getContext("2d")!;
  g.strokeStyle = TIER_TEXT[TIER_KEYS[u.tier]];
  g.lineWidth = 6;
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    g.beginPath();
    g.moveTo(100 + Math.cos(a) * 52, 100 + Math.sin(a) * 52);
    g.lineTo(100 + Math.cos(a) * 92, 100 + Math.sin(a) * 92);
    g.stroke();
  }
  const m = medal(u.id, u.tier, 3);
  m.classList.add("succes-medal");
  const banner = document.createElement("div");
  banner.className = "succes-banner";
  const a = document.createElement("div");
  a.className = "a";
  a.textContent = tr("SUCCÈS !");
  const b = document.createElement("div");
  b.textContent = `${tr(def.name).toUpperCase()} — ${tr(TIER_NAMES[u.tier]).toUpperCase()}`;
  b.style.color = TIER_TEXT[TIER_KEYS[u.tier]];
  const c = document.createElement("div");
  c.textContent = tr(goalText(def, u.tier));
  banner.append(a, b, c);
  box.append(rays, m, banner);
  frame.append(box);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    box.remove();
    done();
  };
  const fall = m.animate(
    [
      { transform: "translate(0, -160px) rotate(-200deg) scale(.5)", opacity: 0 },
      { transform: "translate(0, 0) rotate(0deg) scale(1.15)", opacity: 1, offset: 0.8 },
      { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1 },
    ],
    { duration: 500, easing: "cubic-bezier(.3,.7,.4,1)", fill: "forwards" },
  );
  rays.animate([{ opacity: 0, transform: "rotate(0deg) scale(.6)" }, { opacity: 0.9, transform: "rotate(20deg) scale(1)", offset: 0.3 }, { opacity: 0, transform: "rotate(45deg) scale(1.2)" }], {
    duration: 1600,
    delay: 400,
    fill: "forwards",
  });
  banner.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 250, delay: 800, fill: "both" });
  let leaving = false;
  const leave = () => {
    if (leaving) return;
    leaving = true;
    banner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
    const from = m.getBoundingClientRect();
    const to = target?.getBoundingClientRect();
    const dx = to ? to.left + to.width / 2 - (from.left + from.width / 2) : 0;
    const dy = to ? to.top + to.height / 2 - (from.top + from.height / 2) : -200;
    const fly = m.animate([{ transform: "translate(0,0) scale(1)" }, { transform: `translate(${dx}px, ${dy}px) scale(.25)`, opacity: 0.9 }], { duration: 450, easing: "ease-in", fill: "forwards" });
    fly.onfinish = () => {
      target?.animate([{ filter: "brightness(1)" }, { filter: "brightness(2.2)" }, { filter: "brightness(1)" }], { duration: 400 });
      finish();
    };
    window.setTimeout(finish, 900);
  };
  fall.onfinish = () => window.setTimeout(leave, 2800);
  box.addEventListener("pointerdown", (ev) => {
    ev.stopPropagation();
    leave();
  });
}
