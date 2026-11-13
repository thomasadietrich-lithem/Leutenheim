/**
 * CATALOGUE DU MATÉRIEL (Thomas, 2026-11-13) : tout ce qui se dessine dans le jeu, à parcourir du doigt. Construit par
 * `node scripts/atelier.mjs` → `demo/catalogue.html`.
 */
import { allItems, allSprites, draw, ICON_PALETTE, Sprite, spriteCanvas } from "./registry";
import { MONSTERS } from "../../src/data/monsters";
import { CODEX_PEOPLE, CODEX_STATES } from "../../src/data/codex";
import { CONCEPTS } from "./concepts";

declare const __PLANCHES__: { title: string; src: string; note: string }[];

const RARITY: Record<string, [string, string]> = {
  common: ["commun", "#a8a8a8"],
  uncommon: ["peu commun", "#5cc860"],
  rare: ["rare", "#4a8fd0"],
  epic: ["épique", "#b48ce0"],
  legendary: ["légendaire", "#f0c050"],
};
const KIND: Record<string, string> = {
  melee: "Armes", ranged: "Arcs", ammo: "Munitions", armor: "Armures", helmet: "Casques", amulet: "Amulettes",
  artifact: "Artefacts et bibelots", use: "Consommables et potions", bag: "Sacs", gem: "Gemmes", gold: "Or", key: "Clefs", quest: "Objets de quête",
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

const app = document.getElementById("app")!;
const tabs = el("nav", "tabs");
const search = el("input", "search");
search.placeholder = "Chercher (nom, groupe)…";
const body = el("main", "body");
const detail = el("aside", "detail");
detail.hidden = true;
app.append(tabs, search, body, detail);

interface Card {
  title: string;
  group: string;
  canvas: () => HTMLCanvasElement;
  big: () => HTMLCanvasElement;
  text?: string;
  badge?: [string, string];
  palette?: Record<string, string>;
}

const sprites = allSprites();
const byGroup = (pred: (s: Sprite) => boolean): Card[] =>
  sprites.filter(pred).map((s) => ({ title: s.name, group: s.group, canvas: () => spriteCanvas(s, 3), big: () => spriteCanvas(s, 8), palette: s.palette }));

const people = new Set(["Personnages"]);
const creatures = new Set(["Héros : Humain Guerrier", "Kobold", "Kobold frondeur", "Araignée", "La Tisseuse et sa nichée"]);
const effects = new Set(["Feu", "États (pictos)", "Races et classes"]);
const SECTIONS: { id: string; label: string; cards: () => Card[] }[] = [
  {
    id: "objets",
    label: "Objets",
    cards: () =>
      allItems()
        .filter((i) => i.rows.length > 0)
        .map((i) => ({
          title: i.name,
          group: KIND[i.kind] ?? i.kind,
          canvas: () => draw(i.rows, ICON_PALETTE, i.rows.length > 16 ? 2 : 3),
          big: () => draw(i.rows, ICON_PALETTE, i.rows.length > 16 ? 5 : 9),
          text: i.description,
          badge: i.rarity ? RARITY[i.rarity] : undefined,
        })),
  },
  {
    id: "creatures",
    label: "Créatures",
    cards: () =>
      byGroup((s) => creatures.has(s.group)).map((c) => {
        const m = Object.values(MONSTERS)
          .sort((a, b) => b.name.length - a.name.length)
          .find((d) => c.group.toLowerCase().startsWith(d.name.toLowerCase()));
        return m ? { ...c, text: `${m.name} — ${m.hp} PV, CA ${m.armorClass}.` } : c;
      }),
  },
  {
    id: "personnages",
    label: "Personnages",
    cards: () =>
      byGroup((s) => people.has(s.group)).map((c) => {
        const p = CODEX_PEOPLE.find((q) => c.title.startsWith(q.name) || q.name.startsWith(c.title));
        return p ? { ...c, text: p.description } : c;
      }),
  },
  { id: "decor", label: "Décor et mobilier", cards: () => byGroup((s) => !people.has(s.group) && !creatures.has(s.group) && !effects.has(s.group)) },
  {
    id: "effets",
    label: "États et effets",
    cards: () =>
      byGroup((s) => effects.has(s.group)).map((c) => {
        const st = CODEX_STATES.find((q) => q.id === c.title);
        return st ? { ...c, title: st.name, text: st.description } : c;
      }),
  },
  {
    id: "concepts",
    label: "À venir (concepts)",
    cards: () =>
      CONCEPTS.map((k) => ({
        title: k.name,
        group: k.group,
        canvas: () => spriteCanvas({ group: k.group, name: k.name, rows: k.frames[0], palette: k.palette, frames: k.frames }, 3),
        big: () => spriteCanvas({ group: k.group, name: k.name, rows: k.frames[0], palette: k.palette, frames: k.frames }, 8),
        text: k.note,
        badge: ["proposition", "#e8782a"],
      })),
  },
  { id: "planches", label: "Planches", cards: () => [] },
];

let current = "objets";

function showDetail(c: Card): void {
  detail.replaceChildren();
  const close = el("button", "close", "×");
  close.onclick = () => (detail.hidden = true);
  const big = c.big();
  big.className = "bigsprite";
  detail.append(close, el("h2", "", c.title), el("div", "group", c.group), big);
  if (c.badge) {
    const b = el("span", "badge", c.badge[0]);
    b.style.background = c.badge[1];
    detail.append(b);
  }
  if (c.text) detail.append(el("p", "", c.text));
  if (c.palette) {
    const pal = el("div", "palette");
    for (const [k, v] of Object.entries(c.palette)) {
      if (k === ".") continue;
      const sw = el("span", "swatch");
      sw.style.background = v;
      sw.title = `${k} ${v}`;
      pal.append(sw);
    }
    detail.append(pal);
  }
  detail.hidden = false;
}

function render(): void {
  tabs.replaceChildren();
  for (const s of SECTIONS) {
    const b = el("button", s.id === current ? "on" : "", s.label);
    b.onclick = () => {
      current = s.id;
      search.value = "";
      render();
    };
    tabs.append(b);
  }
  body.replaceChildren();
  const q = search.value.trim().toLowerCase();
  if (current === "planches") {
    for (const p of __PLANCHES__) {
      if (q && !`${p.title} ${p.note}`.toLowerCase().includes(q)) continue;
      const fig = el("figure", "planche");
      const img = el("img");
      img.src = p.src;
      img.alt = p.title;
      img.loading = "lazy";
      fig.append(el("figcaption", "", p.title), el("p", "note", p.note), img);
      body.append(fig);
    }
    return;
  }
  const cards = SECTIONS.find((s) => s.id === current)!.cards().filter((c) => !q || `${c.title} ${c.group} ${c.text ?? ""}`.toLowerCase().includes(q));
  const groups = new Map<string, Card[]>();
  for (const c of cards) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
  for (const [g, list] of groups) {
    body.append(el("h3", "", `${g} (${list.length})`));
    const grid = el("div", "grid");
    for (const c of list) {
      const card = el("button", "card");
      const cv = c.canvas();
      card.append(cv, el("span", "name", c.title));
      if (c.badge) {
        const dot = el("i", "dot");
        dot.style.background = c.badge[1];
        card.append(dot);
      }
      card.onclick = () => showDetail(c);
      grid.append(card);
    }
    body.append(grid);
  }
  if (cards.length === 0) body.append(el("p", "empty", "Rien ne correspond."));
}

search.oninput = render;
render();
