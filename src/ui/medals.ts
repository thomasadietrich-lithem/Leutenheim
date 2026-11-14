/**
 * Médaillons du mur de succès (maquette art/succes_v1.html, validée par Thomas le 2026-11-14 : « Fonce ») : un anneau
 * 26 × 26 de la couleur du rang (cuivre, argent, or ; gris et cadenas tant qu'il n'est pas obtenu), un picto 16 × 16
 * au milieu. Dessinés en rectangles, contour sombre ajouté ensuite, comme les planches.
 */
const PAL: Record<string, string> = {
  K: "#1a120c", W: "#f4ead0", w: "#b8a888", R: "#c03a3a", r: "#7a1e22", G: "#6ab04a", g: "#3e7a2a", Y: "#f0c050", y: "#a07818",
  B: "#8a5a30", b: "#5a3818", P: "#9a6ac8", p: "#5e3a88", O: "#e08a3a", S: "#9aa2b8", s: "#5e6680", D: "#3a2e26",
};
type Rect = (x: number, y: number, w: number, h: number, c: string) => void;

const ICONS: Record<string, (r: Rect) => void> = {
  intouchable(r) {
    // Un écu intact, sans une rayure, et une étincelle.
    r(3, 2, 10, 7, "S"); r(4, 9, 8, 2, "S"); r(5, 11, 6, 2, "s"); r(6, 13, 4, 1, "s"); r(7, 14, 2, 1, "s");
    r(4, 3, 2, 6, "W"); r(3, 2, 10, 1, "W"); r(11, 3, 1, 7, "s");
    r(12, 0, 1, 3, "Y"); r(11, 1, 3, 1, "Y");
  },
  ombre(r) {
    // Une silhouette encapuchonnée aux yeux jaunes, une dague.
    r(5, 1, 6, 2, "D"); r(4, 3, 8, 9, "D"); r(3, 12, 10, 3, "D"); r(5, 4, 6, 4, "K"); r(6, 6, 1, 1, "Y"); r(9, 6, 1, 1, "Y");
    r(13, 5, 1, 6, "S"); r(12, 10, 3, 1, "y"); r(13, 11, 1, 2, "b");
  },
  pyromane(r) {
    r(6, 1, 2, 2, "Y"); r(9, 2, 1, 2, "O"); r(5, 3, 5, 3, "O"); r(3, 5, 1, 2, "O"); r(4, 6, 8, 5, "O"); r(5, 11, 6, 2, "R"); r(6, 13, 4, 1, "r");
    r(6, 7, 4, 4, "Y"); r(7, 9, 2, 2, "W");
  },
  alchimiste(r) {
    // Une fiole lancée, sa trajectoire en pointillés.
    r(6, 0, 2, 1, "B"); r(6, 1, 2, 3, "S"); r(3, 4, 8, 1, "S"); r(2, 5, 10, 7, "S"); r(3, 12, 8, 1, "S");
    r(3, 6, 8, 5, "P"); r(3, 11, 8, 1, "p"); r(4, 7, 1, 1, "W"); r(8, 9, 1, 1, "W"); r(3, 6, 8, 1, "W");
    r(13, 3, 1, 1, "Y"); r(14, 6, 1, 1, "Y"); r(14, 9, 1, 1, "Y");
  },
  radin(r) {
    // Une pile de pièces d'or.
    r(5, 2, 6, 2, "y"); r(4, 4, 8, 2, "Y"); r(4, 6, 8, 2, "y"); r(3, 8, 10, 2, "Y"); r(3, 10, 10, 2, "y"); r(2, 12, 12, 2, "Y");
    r(5, 2, 2, 1, "W"); r(4, 4, 2, 1, "W"); r(3, 8, 2, 1, "W"); r(2, 12, 2, 1, "W");
  },
  pilleur(r) {
    // Un coffre ouvert, plein d'or.
    r(2, 3, 12, 3, "b"); r(3, 4, 10, 1, "B"); r(2, 6, 12, 1, "Y"); r(3, 5, 3, 1, "Y"); r(9, 5, 3, 1, "Y");
    r(2, 7, 12, 7, "B"); r(2, 7, 12, 1, "b"); r(5, 7, 1, 7, "S"); r(10, 7, 1, 7, "S"); r(7, 9, 2, 2, "Y"); r(2, 13, 12, 1, "b");
    r(7, 0, 2, 1, "Y"); r(13, 1, 1, 1, "Y");
  },
  chasseur(r) {
    r(2, 13, 2, 1, "s");
    for (let i = 0; i < 9; i++) r(3 + i, 12 - i, 1, 1, "S");
    r(11, 2, 3, 1, "S");
    r(2, 11, 3, 3, "y");
    r(1, 12, 1, 1, "Y");
    r(5, 4, 7, 6, "W"); r(6, 10, 5, 2, "W"); r(6, 6, 2, 2, "K"); r(9, 6, 2, 2, "K"); r(8, 8, 1, 1, "K");
    r(6, 11, 1, 1, "K"); r(8, 11, 1, 1, "K"); r(10, 11, 1, 1, "K"); r(5, 4, 7, 1, "w");
  },
  bourreau(r) {
    r(7, 2, 2, 2, "R"); r(6, 4, 4, 2, "R"); r(5, 6, 6, 4, "R"); r(5, 10, 6, 2, "r"); r(6, 12, 4, 1, "r"); r(6, 6, 1, 3, "W");
    for (const [x, y, w, h] of [[1, 4, 2, 1], [13, 4, 2, 1], [2, 9, 1, 1], [13, 9, 2, 1], [3, 1, 1, 2], [12, 1, 1, 2], [1, 13, 2, 1], [13, 13, 2, 1]]) r(x, y, w, h, "Y");
  },
  tisseuse(r) {
    r(5, 1, 6, 1, "Y"); r(5, 0, 1, 1, "Y"); r(7, 0, 2, 1, "Y"); r(10, 0, 1, 1, "Y");
    r(6, 6, 4, 4, "D"); r(7, 4, 2, 2, "D"); r(7, 5, 1, 1, "R"); r(8, 5, 1, 1, "R");
    for (const [x, y, w, h] of [[1, 6, 5, 1], [1, 7, 1, 3], [10, 6, 5, 1], [14, 7, 1, 3], [2, 9, 4, 1], [2, 10, 1, 3], [10, 9, 4, 1], [13, 10, 1, 3], [3, 12, 4, 1], [9, 12, 4, 1]]) r(x, y, w, h, "S");
    r(6, 10, 4, 2, "D"); r(7, 12, 2, 1, "R");
  },
  course(r) {
    r(3, 1, 10, 2, "y"); r(3, 13, 10, 2, "y"); r(4, 3, 8, 1, "Y"); r(5, 4, 6, 2, "W"); r(6, 6, 4, 1, "W"); r(7, 7, 2, 2, "W");
    r(6, 9, 4, 1, "w"); r(5, 10, 6, 2, "w"); r(4, 12, 8, 1, "Y"); r(4, 4, 1, 8, "S"); r(11, 4, 1, 8, "S");
  },
  gluck(r) {
    r(7, 1, 1, 3, "b"); r(8, 1, 4, 2, "G"); r(4, 4, 8, 2, "R"); r(3, 6, 10, 6, "R"); r(4, 12, 8, 2, "r"); r(4, 6, 2, 3, "W"); r(10, 7, 2, 4, "r");
  },
  soeur(r) {
    r(6, 1, 4, 13, "W"); r(2, 5, 12, 4, "W"); r(5, 1, 1, 1, "W"); r(10, 1, 1, 1, "W"); r(5, 13, 1, 1, "W"); r(10, 13, 1, 1, "W");
    r(1, 5, 1, 1, "W"); r(14, 8, 1, 1, "W"); r(7, 2, 1, 11, "w"); r(3, 6, 10, 1, "w");
  },
  krik(r) {
    r(6, 1, 4, 2, "B"); r(7, 3, 2, 2, "S"); r(4, 5, 8, 1, "S"); r(3, 6, 10, 7, "S"); r(4, 8, 8, 4, "P"); r(4, 12, 8, 1, "p"); r(5, 8, 2, 2, "W");
    r(10, 0, 3, 2, "w"); r(12, 2, 3, 2, "w");
  },
  grum(r) {
    r(6, 1, 4, 1, "Y"); r(4, 2, 8, 2, "Y"); r(3, 4, 10, 7, "Y"); r(4, 11, 8, 2, "y"); r(6, 13, 4, 1, "y"); r(5, 3, 2, 3, "W"); r(10, 5, 2, 5, "y");
  },
  fifrelin(r) {
    r(4, 1, 8, 9, "D"); r(4, 7, 8, 2, "R"); r(1, 10, 14, 3, "D"); r(5, 2, 1, 5, "s"); r(2, 10, 12, 1, "s"); r(12, 0, 2, 2, "Y");
  },
  fouineur(r) {
    r(1, 2, 6, 3, "B"); r(8, 2, 7, 3, "B"); r(1, 6, 3, 3, "B"); r(11, 6, 4, 3, "B"); r(1, 10, 6, 3, "B"); r(8, 10, 7, 3, "B");
    r(4, 6, 7, 3, "K"); r(6, 7, 3, 1, "Y"); r(7, 6, 1, 3, "Y"); r(1, 4, 14, 1, "b"); r(1, 12, 14, 1, "b");
  },
  bousculeur(r) {
    // Une flèche rouge qui pousse un crâne (comme le picto « Pousser »).
    r(1, 7, 7, 2, "R"); r(6, 5, 1, 6, "R"); r(7, 6, 1, 4, "R"); r(8, 7, 1, 2, "R"); r(1, 7, 7, 1, "W");
    r(10, 4, 5, 5, "W"); r(11, 9, 3, 2, "W"); r(11, 6, 1, 1, "K"); r(13, 6, 1, 1, "K"); r(11, 10, 1, 1, "K"); r(13, 10, 1, 1, "K");
  },
  fuyard(r) {
    // Une flèche verte qui s'éloigne du crâne (comme le picto « Se dégager »), une botte.
    r(8, 7, 7, 2, "G"); r(9, 5, 1, 6, "G"); r(8, 6, 1, 4, "G"); r(7, 7, 1, 2, "G"); r(8, 7, 7, 1, "W");
    r(1, 4, 5, 5, "W"); r(2, 9, 3, 2, "W"); r(2, 6, 1, 1, "K"); r(4, 6, 1, 1, "K"); r(2, 10, 1, 1, "K"); r(4, 10, 1, 1, "K");
    r(10, 11, 3, 3, "B"); r(10, 13, 5, 1, "b");
  },
  portier(r) {
    // Une porte de planches dans son cadre de pierre, un gros cadenas doré.
    r(2, 1, 12, 14, "S"); r(3, 2, 10, 13, "B"); r(5, 2, 1, 13, "b"); r(8, 2, 1, 13, "b"); r(11, 2, 1, 13, "b");
    r(3, 5, 10, 1, "s"); r(3, 11, 10, 1, "s");
    r(6, 7, 4, 1, "Y"); r(6, 7, 1, 2, "Y"); r(9, 7, 1, 2, "Y"); r(5, 9, 6, 4, "Y"); r(7, 10, 2, 2, "K"); r(5, 12, 6, 1, "y");
  },
  profondeur(r) {
    r(1, 2, 4, 2, "S"); r(1, 4, 7, 2, "S"); r(1, 6, 10, 2, "s"); r(1, 8, 13, 2, "s"); r(1, 10, 14, 4, "D");
    r(11, 1, 2, 4, "Y"); r(10, 4, 4, 1, "Y"); r(11, 5, 2, 1, "Y");
  },
  poulet(r) {
    r(5, 1, 3, 2, "R"); r(4, 3, 5, 4, "W"); r(3, 7, 9, 5, "W"); r(11, 6, 3, 2, "W"); r(2, 4, 2, 2, "Y"); r(5, 4, 1, 1, "K");
    r(4, 7, 1, 1, "R"); r(6, 12, 1, 2, "Y"); r(9, 12, 1, 2, "Y"); r(7, 8, 4, 2, "w");
  },
};

/** Couleurs des rangs : milieu, reflet, ombre ; « no » : pas encore obtenu. */
export const TIER_COLORS: Record<"cu" | "ag" | "or" | "no", [string, string, string]> = {
  cu: ["#c07840", "#e8a878", "#6e3a18"],
  ag: ["#c8ccd8", "#f4f6ff", "#6e7488"],
  or: ["#f0c050", "#fff0a8", "#9a6c10"],
  no: ["#4a4440", "#5e5852", "#24201c"],
};
export const TIER_KEYS = ["cu", "ag", "or"] as const;
/** Couleur du texte de chaque rang. */
export const TIER_TEXT = { cu: "#e0a070", ag: "#e8ecf8", or: "#ffd75e", no: "#6a6050" };

function icon(name: string, dim: boolean): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const g = c.getContext("2d")!;
  ICONS[name]?.((x, y, w, h, col) => {
    g.fillStyle = PAL[col];
    g.fillRect(x, y, w, h);
  });
  const im = g.getImageData(0, 0, 16, 16);
  const d = im.data;
  const a = (x: number, y: number) => x >= 0 && y >= 0 && x < 16 && y < 16 && d[(y * 16 + x) * 4 + 3] > 0;
  const out: [number, number][] = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) out.push([x, y]);
  g.fillStyle = PAL.K;
  for (const [x, y] of out) g.fillRect(x, y, 1, 1);
  if (dim) {
    const im2 = g.getImageData(0, 0, 16, 16);
    for (let i = 0; i < im2.data.length; i += 4) {
      const v = ((im2.data[i] + im2.data[i + 1] + im2.data[i + 2]) / 3) * 0.35 + 20;
      im2.data[i] = v;
      im2.data[i + 1] = v;
      im2.data[i + 2] = v + 4;
    }
    g.putImageData(im2, 0, 0);
  }
  return c;
}

const cache = new Map<string, HTMLCanvasElement>();

/** Le médaillon d'un succès au rang donné (-1 : pas encore obtenu), agrandi `scale` fois sans lissage. */
export function medal(name: string, tier: number, scale: number): HTMLCanvasElement {
  const key = `${name}|${tier}`;
  let base = cache.get(key);
  if (!base) {
    const t = tier < 0 ? "no" : TIER_KEYS[tier];
    const [mid, hi, lo] = TIER_COLORS[t];
    base = document.createElement("canvas");
    base.width = 26;
    base.height = 26;
    const g = base.getContext("2d")!;
    for (let y = 0; y < 26; y++)
      for (let x = 0; x < 26; x++) {
        const dx = x - 12.5;
        const dy = y - 12.5;
        const r = Math.hypot(dx, dy);
        let col: string | null = null;
        if (r <= 12.6) col = PAL.K;
        if (r <= 11.6) col = dx + dy < -6 ? hi : dx + dy > 6 ? lo : mid;
        if (r <= 9.2) col = t === "no" ? "#1c1814" : "#2a2018";
        if (col) {
          g.fillStyle = col;
          g.fillRect(x, y, 1, 1);
        }
      }
    if (t !== "no")
      for (const [x, y] of [[12, 1], [12, 23], [1, 12], [23, 12]]) {
        g.fillStyle = hi;
        g.fillRect(x, y, 2, 2);
      }
    g.drawImage(icon(name, t === "no"), 5, 5);
    if (t === "no") {
      g.fillStyle = "#8a8070";
      g.fillRect(17, 16, 6, 5);
      g.fillRect(18, 13, 1, 3);
      g.fillRect(21, 13, 1, 3);
      g.fillRect(18, 13, 4, 1);
      g.fillStyle = PAL.K;
      g.fillRect(19, 18, 2, 2);
    }
    cache.set(key, base);
  }
  const out = document.createElement("canvas");
  out.width = 26 * scale;
  out.height = 26 * scale;
  const o = out.getContext("2d")!;
  o.imageSmoothingEnabled = false;
  o.drawImage(base, 0, 0, out.width, out.height);
  out.className = "medal";
  return out;
}

/** La petite médaille ronde (9 × 9) du compteur, à la couleur d'un rang. */
export function miniTier(tier: number, scale: number): HTMLCanvasElement {
  const [m, h, l] = TIER_COLORS[tier < 0 ? "no" : TIER_KEYS[tier]];
  const c = document.createElement("canvas");
  c.width = 9 * scale;
  c.height = 9 * scale;
  const g = c.getContext("2d")!;
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const r = Math.hypot(x - 4, y - 4);
      if (r > 4.4) continue;
      g.fillStyle = r > 3.4 ? PAL.K : x + y < 7 ? h : x + y > 9 ? l : m;
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  return c;
}
