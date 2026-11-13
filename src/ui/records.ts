/**
 * Records (Thomas, 2026-11-11 : « mets un gestionnaire de records ») : les meilleures parties du donjon, gardées sur
 * l'appareil. Classées par étage atteint, puis niveau, puis or. La salle d'essai ne compte pas.
 */
export interface RunRecord {
  deepest: number;
  level: number;
  gold: number;
  /** De quoi le héros est mort (« un Kobold », « le poison »…). */
  cause: string;
  hero: string;
  /** Date de la partie (jj/mm/aaaa). */
  date: string;
  /** Boss vaincus pendant la partie (la Tisseuse…). */
  bosses?: number;
  /** Nombre de tours joués (Thomas, 2026-11-13) ; absent des records plus anciens. */
  turns?: number;
}

const KEY = "leutenheim.records";
const MAX = 10;

export function loadRecords(): RunRecord[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((r) => r && typeof r.deepest === "number") : [];
  } catch {
    return [];
  }
}

const better = (a: RunRecord, b: RunRecord) => (b.bosses ?? 0) - (a.bosses ?? 0) || b.deepest - a.deepest || b.level - a.level || b.gold - a.gold;

/** Ajoute une partie ; renvoie son rang (1 = meilleure), ou 0 si elle n'entre pas dans les dix meilleures. */
export function addRecord(record: RunRecord): number {
  const list = [...loadRecords(), record].sort(better).slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Stockage plein ou interdit : tant pis, la partie n'est pas notée.
  }
  return list.indexOf(record) + 1;
}

/** Une ligne lisible : « 1. Étage 5 · Niv 4 · 32 or — un Kobold (11/11/2026) ». */
export function recordLine(r: RunRecord, rank: number): string {
  return `${rank}. Étage ${r.deepest} · Niv ${r.level} · ${r.gold} or${r.turns !== undefined ? ` · ${r.turns} tours` : ""}${r.bosses ? " · Boss vaincu" : ""} — ${r.cause} (${r.date})`;
}
