/**
 * Atelier (Thomas, 2026-11-13 : « naviguer visuellement dans tout le matériel du jeu ») : toutes les images du jeu,
 * lues directement dans les fichiers de dessin (`src/render/sprites`, `src/ui/icons.ts`) : le catalogue est toujours à
 * jour. Chaque image : un groupe, un nom, ses lignes de pixels, sa palette.
 */
import { ARAIGNEE } from "../../src/render/sprites/araignee";
import { ASSIETTE } from "../../src/render/sprites/assiette";
import { ATELIERS } from "../../src/render/sprites/atelier";
import { AUTEL, AUTEL_PALETTE } from "../../src/render/sprites/autel";
import { BAIN } from "../../src/render/sprites/bain";
import { BOSS } from "../../src/render/sprites/boss";
import { CLOCHE } from "../../src/render/sprites/cloche";
import { DECOR, DECOR_PALETTE } from "../../src/render/sprites/decor";
import { DORTOIR } from "../../src/render/sprites/dortoir";
import { FERME, FERMIER } from "../../src/render/sprites/ferme";
import { FIRE_PALETTE, FIRE_STAGES } from "../../src/render/sprites/feu";
import { GUERRIER, GUERRIER_PALETTE } from "../../src/render/sprites/guerrier";
import { MARCHAND, MARCHAND_PALETTE } from "../../src/render/sprites/marchand";
import { PIEGES } from "../../src/render/sprites/pieges";
import { POULET, POULET_PALETTE } from "../../src/render/sprites/poulet";
import { SALLES } from "../../src/render/sprites/salles";
import { SCHRAT, SCHRAT_PALETTE } from "../../src/render/sprites/schrat";
import { SOEUR_PALETTE, SOEUR_SPRITE } from "../../src/render/sprites/soeur";
import { STATUES } from "../../src/render/sprites/statue";
import { TRAINARDS } from "../../src/render/sprites/trainards";
import { PALETTE, STATUS_ICONS, itemIconRows } from "../../src/ui/icons";
import { PICTOS } from "../../src/ui/pictos";
import { ITEMS, ItemId } from "../../src/data/items";

export type Pal = Record<string, string>;
export interface Sprite {
  group: string;
  name: string;
  rows: readonly string[];
  palette: Pal;
  /** Plusieurs images : une animation (elles défilent). */
  frames?: (readonly string[])[];
}

// Recolorations du Kobold (mêmes valeurs que src/render/renderer.ts).
export const KRIK_PALETTE: Pal = { ...SCHRAT_PALETTE, A: "#9a86c8", a: "#5e4a8e", Y: "#7affa0", L: "#d8cce8", C: "#a0785a", c: "#6a4a32", M: "#8e9a54", m: "#b8c070" };
export const GLUCK_PALETTE: Pal = { ...SCHRAT_PALETTE, A: "#c8d48a", a: "#8e9a54", Y: "#ffe27a", L: "#f2ecc0", C: "#8a6a44", c: "#5a4228", M: "#a07848", m: "#c49a64" };
export const FRONDEUR_PALETTE: Pal = { ...SCHRAT_PALETTE, A: "#e08a3a", a: "#9c5420", Y: "#f4e04a", C: "#6e4c2e", c: "#40291a", M: "#7a5230", m: "#a4abc8", T: "#cbbf98" };

/** Un dictionnaire { nom : { rows, palette } } : une image par entrée ; les noms terminés par 0, 1, 2 font une animation. */
function fromTable(group: string, table: Record<string, { rows: readonly string[]; palette: Pal }>): Sprite[] {
  const out: Sprite[] = [];
  const anim = new Map<string, Sprite>();
  for (const [name, s] of Object.entries(table)) {
    const m = /^(.*?)(\d)$/.exec(name);
    if (m) {
      const base = anim.get(m[1]);
      if (base) {
        base.frames!.push(s.rows);
        continue;
      }
      const sp: Sprite = { group, name: m[1], rows: s.rows, palette: s.palette, frames: [s.rows] };
      anim.set(m[1], sp);
      out.push(sp);
    } else out.push({ group, name, rows: s.rows, palette: s.palette });
  }
  return out;
}

/** { pose : [image, image…] } avec une palette commune. */
function fromFrames(group: string, table: Record<string, readonly (readonly string[])[]>, palette: Pal, prefix = ""): Sprite[] {
  return Object.entries(table).map(([name, frames]) => ({ group, name: prefix + name, rows: frames[0], palette, frames: [...frames] }));
}

export function allSprites(): Sprite[] {
  const out: Sprite[] = [];
  out.push(...fromFrames("Héros : Humain Guerrier", GUERRIER as unknown as Record<string, string[][]>, GUERRIER_PALETTE));
  out.push(...fromFrames("Kobold", SCHRAT as unknown as Record<string, string[][]>, SCHRAT_PALETTE));
  out.push(...fromFrames("Kobold frondeur", SCHRAT as unknown as Record<string, string[][]>, FRONDEUR_PALETTE));
  out.push(...fromTable("Araignée", ARAIGNEE));
  out.push(...fromTable("La Tisseuse et sa nichée", BOSS));
  out.push({ group: "Personnages", name: "Gluck", rows: SCHRAT.idleDown[0], palette: GLUCK_PALETTE, frames: [...SCHRAT.idleDown] });
  out.push({ group: "Personnages", name: "Krik", rows: SCHRAT.idleDown[0], palette: KRIK_PALETTE, frames: [...SCHRAT.idleDown] });
  out.push({ group: "Personnages", name: "Sœur Osseuse", rows: SOEUR_SPRITE[0], palette: SOEUR_PALETTE, frames: SOEUR_SPRITE });
  out.push({ group: "Personnages", name: "Le Colporteur", rows: MARCHAND.front, palette: MARCHAND_PALETTE });
  out.push({ group: "Personnages", name: "Le Colporteur (profil)", rows: MARCHAND.side, palette: MARCHAND_PALETTE });
  out.push({ group: "Personnages", name: "Le poulet", rows: POULET.idle, palette: POULET_PALETTE, frames: [POULET.idle, POULET.run] });
  out.push({ group: "Personnages", name: "Grum, le Kobold fermier (à valider)", rows: FERMIER.rows, palette: FERMIER.palette });
  out.push(...fromTable("Dortoir", DORTOIR));
  out.push(...fromTable("Cuisine, prière, torture", SALLES));
  out.push(...fromTable("Forge et alchimiste", ATELIERS));
  out.push(...fromTable("Salle de bain du Kobold", BAIN));
  out.push(...fromTable("Ferme", FERME));
  out.push(...fromTable("Statues", STATUES));
  out.push(...fromTable("Cloche à vache", CLOCHE));
  out.push(...fromTable("Assiette", ASSIETTE));
  out.push(...fromTable("Tonneaux, caisses, toiles", TRAINARDS));
  out.push(...fromTable("Pièges", PIEGES));
  out.push(...Object.entries(DECOR).map(([name, rows]) => ({ group: "Escaliers et coffres", name, rows: rows as string[], palette: DECOR_PALETTE })));
  out.push(...Object.entries(AUTEL).map(([name, rows]) => ({ group: "Autel à la pomme dorée", name, rows: rows as string[], palette: AUTEL_PALETTE })));
  out.push({ group: "Feu", name: "flammes", rows: FIRE_STAGES[1][0], palette: FIRE_PALETTE, frames: FIRE_STAGES.flat() });
  out.push(...Object.entries(STATUS_ICONS).map(([name, rows]) => ({ group: "États (pictos)", name, rows: rows as string[], palette: PALETTE })));
  out.push(...Object.entries(PICTOS).map(([name, s]) => ({ group: "Races et classes", name, rows: s.rows, palette: s.palette })));
  return out;
}

/** Les objets : icône, nom, rareté, description (depuis src/data/items.ts). */
export function allItems(): { id: ItemId; name: string; kind: string; rarity?: string; description: string; rows: readonly string[] }[] {
  return (Object.keys(ITEMS) as ItemId[]).map((id) => {
    const d = ITEMS[id] as { name: string; kind: string; rarity?: string; description: string };
    let rows: readonly string[] = [];
    try {
      rows = itemIconRows(id);
    } catch {
      rows = [];
    }
    return { id, name: d.name, kind: d.kind, rarity: d.rarity, description: d.description, rows };
  });
}

export { PALETTE as ICON_PALETTE };

/** Dessine des lignes de pixels dans un canevas, agrandies sans lissage. */
export function draw(rows: readonly string[], palette: Pal, scale: number): HTMLCanvasElement {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length), 1);
  const c = document.createElement("canvas");
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const col = palette[row[x]];
      if (!col || row[x] === ".") continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
}

/** Une image, animée si elle a plusieurs images. */
export function spriteCanvas(s: Sprite, scale: number): HTMLCanvasElement {
  const frames = s.frames && s.frames.length > 1 ? s.frames : [s.rows];
  const canv = frames.map((f) => draw(f, s.palette, scale));
  if (canv.length === 1) return canv[0];
  const out = document.createElement("canvas");
  out.width = Math.max(...canv.map((c) => c.width));
  out.height = Math.max(...canv.map((c) => c.height));
  const ctx = out.getContext("2d")!;
  let i = 0;
  const tick = () => {
    ctx.clearRect(0, 0, out.width, out.height);
    ctx.drawImage(canv[i % canv.length], 0, out.height - canv[i % canv.length].height);
    i++;
  };
  tick();
  setInterval(tick, 420);
  return out;
}
