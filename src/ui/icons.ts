import { ItemId } from "../data/items";

/** Icônes en gros pixels (SVG), dessinées à la main : une par objet. `w`×`h` est la grille de pixels. */
const ICONS: Record<ItemId, { w: number; h: number; rects: [number, number, number, number, string][] }> = {
  epee: {
    w: 8,
    h: 16,
    rects: [
      [3, 1, 2, 9, "#cfd6ea"],
      [3, 1, 1, 9, "#eef2ff"],
      [1, 10, 6, 1, "#e0b040"],
      [3, 11, 2, 3, "#6b4a2a"],
      [3, 14, 2, 1, "#e0b040"],
    ],
  },
  dague: {
    w: 8,
    h: 8,
    rects: [
      [3, 0, 2, 4, "#cfd6ea"],
      [2, 4, 4, 1, "#e0b040"],
      [3, 5, 2, 2, "#6b4a2a"],
    ],
  },
  baton: {
    w: 8,
    h: 16,
    rects: [
      [3, 1, 2, 14, "#8a5a2b"],
      [2, 1, 4, 2, "#b9824a"],
    ],
  },
  arc_court: {
    w: 8,
    h: 16,
    rects: [
      [2, 1, 2, 1, "#8a5a2b"],
      [4, 2, 1, 2, "#8a5a2b"],
      [5, 4, 1, 8, "#b9824a"],
      [4, 12, 1, 2, "#8a5a2b"],
      [2, 14, 2, 1, "#8a5a2b"],
      [2, 2, 1, 12, "#d8d4e6"],
    ],
  },
  fleche: {
    w: 8,
    h: 8,
    rects: [
      [1, 6, 1, 1, "#e05060"],
      [2, 5, 1, 1, "#b9824a"],
      [3, 4, 1, 1, "#b9824a"],
      [4, 3, 1, 1, "#b9824a"],
      [5, 2, 1, 1, "#b9824a"],
      [5, 1, 2, 1, "#cfd6ea"],
      [6, 1, 1, 2, "#cfd6ea"],
    ],
  },
  clef: {
    w: 8,
    h: 8,
    rects: [
      [1, 1, 3, 3, "#e0b040"],
      [2, 2, 1, 1, "#1c1a28"],
      [4, 2, 3, 1, "#e0b040"],
      [5, 3, 1, 1, "#e0b040"],
      [6, 3, 1, 2, "#e0b040"],
    ],
  },
};

/** Construit l'icône SVG d'un objet. */
export function itemIcon(id: ItemId): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const icon = ICONS[id];
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${icon.w} ${icon.h}`);
  svg.setAttribute("shape-rendering", "crispEdges");
  for (const [x, y, w, h, color] of icon.rects) {
    const r = document.createElementNS(ns, "rect");
    r.setAttribute("x", String(x));
    r.setAttribute("y", String(y));
    r.setAttribute("width", String(w));
    r.setAttribute("height", String(h));
    r.setAttribute("fill", color);
    svg.appendChild(r);
  }
  return svg;
}
