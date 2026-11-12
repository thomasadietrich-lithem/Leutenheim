/**
 * Deux langues : français (langue de travail, celle du code) et anglais (Thomas, 2026-11-12 : « implémente l'anglais ;
 * à partir de maintenant, développe en bilingue »).
 *
 * Tous les textes restent écrits en français dans le code. À l'affichage, `tr()` donne leur version anglaise depuis le
 * dictionnaire `en.ts` : une phrase fixe s'y trouve telle quelle ; une phrase avec des morceaux variables y est écrite
 * avec des trous numérotés ({0}, {1}…), dans l'ordre où ils apparaissent en français. Les morceaux variables sont eux-mêmes
 * traduits (un nom d'objet dans une phrase, par exemple).
 *
 * RÈGLE : tout nouveau texte visible a son entrée dans `en.ts`. Le test « i18n » échoue sinon.
 */
import { EN } from "./en";

export type Lang = "fr" | "en";

let lang: Lang = "fr";
const cache = new Map<string, string>();
/** Textes affichés sans traduction (pour les vérifications automatiques). */
export const missing = new Set<string>();

export function setLang(l: Lang): void {
  lang = l;
  cache.clear();
}

export function getLang(): Lang {
  return lang;
}

interface Pattern {
  re: RegExp;
  /** Les morceaux fixes, dans l'ordre : un tri rapide avant l'expression régulière (qui peut être lente). */
  bits: string[];
  to: string;
  size: number;
}
let patterns: Pattern[] | null = null;

const GLUE = ["{0} — {1}", "{0} · {1}", "{0}, {1}", "{0} et {1}"];

function buildPatterns(): Pattern[] {
  const out: Pattern[] = [];
  for (const [fr, en] of Object.entries(EN)) {
    if (!/\{\d\}/.test(fr)) continue;
    const parts = fr.split(/(\{\d\})/);
    const order: number[] = [];
    let src = "^";
    let prevHole = false;
    for (const p of parts) {
      if (p === "") continue;
      const m = /^\{(\d)\}$/.exec(p);
      if (m) {
        order.push(Number(m[1]));
        // Deux trous collés (« {0}{1} ») : le second est un complément (« ×3 », « , portée… »), vide ou commençant
        // par une espace ou une ponctuation ; sinon on ne saurait pas où couper.
        src += prevHole ? "((?:[\\s,.;:!?+−×(\\-][\\s\\S]*?)?)" : "([\\s\\S]*?)";
        prevHole = true;
      } else {
        src += p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        prevHole = false;
      }
    }
    src += "$";
    // `to` utilise les numéros du français ; on les ramène à l'ordre des groupes capturés.
    let to = en;
    order.forEach((n, i) => (to = to.split(`{${n}}`).join(`\u0000${i}\u0000`)));
    const bits = parts.filter((p) => p && !/^\{\d\}$/.test(p));
    // Les simples liaisons (« {0} — {1} », « {0} · {1} »…) passent en dernier, de la plus forte à la plus faible.
    const glue = GLUE.indexOf(fr);
    out.push({ re: new RegExp(src), bits, to, size: glue >= 0 ? -1 - glue : fr.replace(/\{\d\}/g, "").length });
  }
  // Les plus précis d'abord (le plus de texte fixe).
  return out.sort((a, b) => b.size - a.size);
}

function translate(s: string, depth: number): string {
  const exact = EN[s];
  if (exact !== undefined) return exact;
  // Un nom mis en minuscules dans une phrase (« vous ramassez : flèches ») : on cherche sa forme avec majuscule.
  const c = s.charAt(0);
  const flip = (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()) + s.slice(1);
  const alt = flip !== s ? EN[flip] : undefined;
  if (alt !== undefined) {
    const a = alt.charAt(0);
    return (c === c.toUpperCase() ? a.toUpperCase() : a.toLowerCase()) + alt.slice(1);
  }
  if (depth > 3 || !/[A-Za-zÀ-ÿ]/.test(s)) return s;
  patterns ??= buildPatterns();
  for (const p of patterns) {
    let at = 0;
    if (!p.bits.every((b) => (at = s.indexOf(b, at)) >= 0 && (at += b.length) > 0)) continue;
    const m = p.re.exec(s);
    if (!m) continue;
    return p.to.replace(/\u0000(\d+)\u0000/g, (_, i) => tr(m[Number(i) + 1], depth + 1));
  }
  missing.add(s);
  return s;
}

/** Le texte dans la langue choisie (le français tel quel). Les espaces au début et à la fin sont gardés. */
export function tr(s: string, depth = 0): string {
  if (lang === "fr" || !s) return s;
  const hit = depth === 0 ? cache.get(s) : undefined;
  if (hit !== undefined) return hit;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!;
  const out = m[2] ? m[1] + translate(m[2], depth) + m[3] : s;
  if (depth === 0) cache.set(s, out);
  return out;
}
