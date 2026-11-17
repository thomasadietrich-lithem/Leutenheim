import { HERO_BASE, HERO_PALETTE, HERO_RACE_PALETTE, HERO_WEAPON } from "./sprites/heros";

/**
 * Le héros en CALQUES (Thomas, 2026-11-16 : « quelque chose de modulaire, capable de s'adapter à l'équipement »).
 * `sprites/heros.ts` (généré par `art/races_v1.py export`) donne, par race, les images de base ; ici on pose par-dessus
 * l'arme, l'armure, le casque et la poignée de l'arc, puis le contour sombre. Mêmes règles que le script Python : toute
 * retouche se fait des deux côtés.
 */
export type HeroArmor = "tunique" | "cuir" | "cloute" | "mailles" | "harnois";
export type HeroHelmet = "aucun" | "cuir" | "mailles";
export type HeroWeapon = "poings" | "couteau" | "epee" | "masse" | "cimeterre" | "epee_longue" | "lance";
export type HeroBow = "court" | "puissant" | "fronde";

export interface HeroLook {
  race: string;
  armor: HeroArmor;
  helmet: HeroHelmet;
  weapon: HeroWeapon;
  bow: HeroBow;
}

export interface HeroSprites {
  /** Par pose (idleDown, walkSide, swordUp, bowDown, hurt, prone0, prone1, getUp, dead), ses images 16 × 16. */
  frames: Record<string, readonly (readonly string[])[]>;
  palette: Record<string, string>;
}

/** Ce que porte le héros (identifiants de `src/data/items.ts`) → les calques à dessiner. */
const ARMOR_OF: Record<string, HeroArmor> = { armure_cuir: "cuir", armure_cloutee: "cloute", cotte_mailles: "mailles", harnois: "harnois" };
const HELMET_OF: Record<string, HeroHelmet> = { casque_cuir: "cuir", casque_poulet: "cuir", casque_maille: "mailles" };
const WEAPON_OF: Record<string, HeroWeapon> = {
  epee: "epee",
  dague: "couteau",
  couteau_boucher: "couteau",
  masse: "masse",
  cimeterre: "cimeterre",
  epee_longue: "epee_longue",
  lance: "lance",
  baton: "lance",
  fourche: "lance",
  serpe: "couteau",
};

export function heroLook(race: string, gear: { armor?: string; hat?: string; melee?: string; ranged?: string } = {}): HeroLook {
  return {
    race: HERO_BASE[race] ? race : "humain",
    armor: (gear.armor && ARMOR_OF[gear.armor]) || "tunique",
    helmet: (gear.hat && HELMET_OF[gear.hat]) || "aucun",
    weapon: gear.melee ? WEAPON_OF[gear.melee] ?? "epee" : "poings",
    bow: gear.ranged === "arc_puissant" ? "puissant" : gear.ranged === "lance_pierre" ? "fronde" : "court",
  };
}

const LYING = new Set(["dead", "prone0", "prone1"]);
const ARMOR_TONES: Record<Exclude<HeroArmor, "tunique">, string> = { cuir: "123", cloute: "123", mailles: "456", harnois: "789" };

function applyWeapon(g: string[][], packed: string | undefined): void {
  if (!packed) return;
  for (let i = 0; i + 2 < packed.length; i += 3) {
    const x = parseInt(packed[i], 16);
    const y = parseInt(packed[i + 1], 16);
    g[y][x] = packed[i + 2];
  }
}

function applyArmor(g: string[][], armor: HeroArmor): void {
  if (armor === "tunique") return;
  const tones = ARMOR_TONES[armor];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const c = g[y][x];
      const i = "Wwx".indexOf(c);
      if (i >= 0) {
        let n = tones[i];
        if (armor === "mailles" && c === "W" && (x + y) % 2) n = "5"; // mailles : un damier
        if (armor === "cloute" && c === "W" && x % 2 === 0 && y % 2 === 0) n = "M"; // clous d'acier
        g[y][x] = n;
      } else if (armor === "harnois") {
        if (c === "B" || c === "b") g[y][x] = "9";
        else if (c === "P") g[y][x] = "8"; // jambières
        else if (c === "q") g[y][x] = "9";
      }
    }
  }
  if (armor === "harnois") {
    // La boucle de ceinture devient un rivet d'or.
    for (let y = 0; y < 16; y++) for (let x = 1; x < 15; x++) if (g[y][x] === "M" && g[y][x - 1] === "9" && (g[y][x + 1] === "9" || g[y][x + 1] === "M")) g[y][x] = "Y";
  }
}

/**
 * Casque de cuir : il recouvre les trois premières rangées de cheveux (ou colonnes, si le héros est couché).
 * Casque de mailles (Thomas, 2026-11-16 : « toute la tête sauf le visage ») : une coiffe qui recouvre TOUS les cheveux de
 * la tête (sept rangées depuis le sommet, ou six colonnes si le héros est couché) ; seul le visage reste nu.
 */
function applyHelmet(g: string[][], helmet: HeroHelmet, lying: boolean): void {
  if (helmet === "aucun") return;
  let x0 = 16;
  let x1 = -1;
  let y0 = 16;
  let y1 = -1;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (g[y][x] !== "H" && g[y][x] !== "G") continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return;
  if (helmet === "mailles") {
    if (lying) {
      x1 = Math.min(15, x0 + 5);
      y0 = Math.max(0, y0 - 1);
      y1 = Math.min(15, y1 + 1);
    } else {
      y1 = Math.min(15, y0 + 6);
      x0 = Math.max(0, x0 - 1);
      x1 = Math.min(15, x1 + 1);
    }
    const start = lying ? x0 : y0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // La septième rangée (longs cheveux de l'Elfe) : seulement les mèches claires, pas la lettre « h », qui est
        // aussi la hampe de la flèche encochée.
        if ((!lying && y === y0 + 6 ? "HG" : "HGh").includes(g[y][x])) g[y][x] = (lying ? x : y) === start ? "7" : (x + y) % 2 === 0 ? "4" : "5";
      }
    }
    return;
  }
  const tones = "Cce";
  const first = lying ? x0 : y0;
  for (let i = 0; i < 3 && first + i < 16; i++) {
    for (let k = 0; k < 16; k++) {
      const x = lying ? first + i : k;
      const y = lying ? k : first + i;
      if ("HGh".includes(g[y][x])) g[y][x] = tones[i];
    }
  }
}

function outline(g: string[][]): string[] {
  const out = g.map((r) => r.slice());
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (g[y][x] !== ".") continue;
      if ((x < 15 && g[y][x + 1] !== ".") || (x > 0 && g[y][x - 1] !== ".") || (y < 15 && g[y + 1][x] !== ".") || (y > 0 && g[y - 1][x] !== ".")) out[y][x] = "O";
    }
  }
  return out.map((r) => r.join(""));
}

/**
 * LANCE-PIERRE (Thomas, 2026-11-17 : « mets à jour le sprite du Hobbit pour le lance-pierre ») : dans les poses de tir,
 * l'arc (bois D/d, corde T) et la flèche disparaissent ; une fourche de bois en Y, son élastique rouge et une pierre
 * prennent leur place. Positions pour la taille de l'Halfelin (les autres races gardent l'arc dessiné).
 * Image 0 : élastique tendu (la pierre dans la poche) ; image 1 : lâché, la pierre part.
 */
const SLING: Record<string, { erase: [number, number][]; marks: [string, [number, number][]][] }[]> = {
  bowSide: [
    { erase: [], marks: [["D", [[11, 6], [13, 6], [11, 7], [13, 7]]], ["d", [[12, 7], [12, 9]]], ["A", [[10, 6], [10, 7]]], ["x", [[9, 6]]]] },
    { erase: [], marks: [["D", [[11, 6], [13, 6], [11, 7], [13, 7]]], ["d", [[12, 7], [12, 9]]], ["A", [[12, 6]]], ["x", [[15, 5]]]] },
  ],
  bowDown: [
    { erase: [[7, 14], [7, 15]], marks: [["D", [[5, 10], [9, 10], [6, 11], [8, 11], [7, 12]]], ["d", [[7, 13], [7, 14]]], ["A", [[6, 10], [7, 10], [8, 10]]], ["x", [[7, 9]]]] },
    { erase: [], marks: [["D", [[5, 10], [9, 10], [6, 11], [8, 11], [7, 12]]], ["d", [[7, 13], [7, 14]]], ["A", [[6, 10], [7, 10], [8, 10]]], ["x", [[7, 15]]]] },
  ],
  bowUp: [
    { erase: [[7, 0], [7, 1], [7, 2], [8, 2]], marks: [["D", [[6, 2], [8, 2], [6, 3], [8, 3]]], ["d", [[7, 3], [7, 4]]], ["A", [[7, 2], [7, 5]]], ["x", [[7, 6]]]] },
    { erase: [], marks: [["D", [[6, 2], [8, 2], [6, 3], [8, 3]]], ["d", [[7, 3], [7, 4]]], ["A", [[7, 2]]], ["x", [[7, 0]]]] },
  ],
};
function applySling(g: string[][], pose: string, frame: number): void {
  const spec = SLING[pose]?.[frame];
  if (!spec || g.length !== 16) return;
  for (const row of g) for (let x = 0; x < 16; x++) if (row[x] === "D" || row[x] === "d" || row[x] === "T") row[x] = ".";
  for (const [x, y] of spec.erase) g[y][x] = ".";
  for (const [c, cells] of spec.marks) for (const [x, y] of cells) g[y][x] = c;
}

const cache = new Map<string, HeroSprites>();
const palettes = new Map<string, Record<string, string>>();

/** Les images du héros pour cette tenue. Gardées en mémoire : la même tenue renvoie toujours les mêmes tableaux. */
export function heroSprites(look: HeroLook): HeroSprites {
  const key = `${look.race}|${look.armor}|${look.helmet}|${look.weapon}|${look.bow}`;
  let s = cache.get(key);
  if (s) return s;
  let palette = palettes.get(look.race);
  if (!palette) {
    palette = { ...HERO_PALETTE, ...HERO_RACE_PALETTE[look.race] };
    palettes.set(look.race, palette);
  }
  const weapon = HERO_WEAPON[look.race]?.[look.weapon];
  const frames: Record<string, string[][]> = {};
  for (const [name, list] of Object.entries(HERO_BASE[look.race])) {
    frames[name] = list.map((rows, i) => {
      const g = rows.map((r) => r.split(""));
      applyWeapon(g, weapon?.[name]?.[i]);
      applyArmor(g, look.armor);
      applyHelmet(g, look.helmet, LYING.has(name));
      if (look.bow === "puissant" && name.startsWith("bow")) for (const row of g) for (let x = 0; x < 16; x++) if (row[x] === "d") row[x] = "A";
      if (look.bow === "fronde" && look.race === "halfelin" && name.startsWith("bow")) applySling(g, name, i);
      return outline(g);
    });
  }
  s = { frames, palette };
  cache.set(key, s);
  return s;
}
